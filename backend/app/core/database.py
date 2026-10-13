import os
import threading
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional, Union

import duckdb
import polars as pl

from app.core.config import settings


class DuckDBManager:
    _instance: Optional["DuckDBManager"] = None
    _init_lock = threading.Lock()

    TABLE_PRIMARY_KEYS: Dict[str, List[str]] = {
        "stores": ["store_id"],
        "products": ["sku_id"],
        "historical_sales": ["date", "store_id", "sku_id"],
        "precomputed_features": ["date", "store_id", "sku_id"],
        "inventory_snapshots": ["store_id", "sku_id"],
        "forecast_records": ["forecast_id"],
    }
    ALLOWED_TABLES = frozenset(TABLE_PRIMARY_KEYS.keys())

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or getattr(settings, "DATABASE_PATH", "data/demandsync.duckdb")
        self._conn: Optional[duckdb.DuckDBPyConnection] = None
        self._write_lock = threading.RLock()
        self._is_initialized = False

    @classmethod
    def get_instance(cls, db_path: Optional[str] = None) -> "DuckDBManager":
        with cls._init_lock:
            if cls._instance is None:
                cls._instance = cls(db_path=db_path)
            return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        with cls._init_lock:
            if cls._instance is not None:
                cls._instance.close()
                cls._instance = None

    def initialize(self) -> None:
        if self._is_initialized and self._conn is not None:
            return

        with self._write_lock:
            if self._is_initialized and self._conn is not None:
                return

            if self.db_path != ":memory:":
                db_dir = os.path.dirname(os.path.abspath(self.db_path))
                if db_dir:
                    os.makedirs(db_dir, exist_ok=True)

            self._conn = duckdb.connect(self.db_path)
            self._conn.execute("PRAGMA threads = 4;")
            self._conn.execute("PRAGMA memory_limit = '2GB';")
            self._conn.execute("PRAGMA default_order = 'asc';")
            self._create_tables()
            self._is_initialized = True

    def close(self) -> None:
        with self._write_lock:
            if self._conn is not None:
                try:
                    self._conn.checkpoint()
                except Exception:
                    pass
                self._conn.close()
                self._conn = None
                self._is_initialized = False

    @contextmanager
    def cursor(self) -> Generator[duckdb.DuckDBPyConnection, None, None]:
        if not self._is_initialized or self._conn is None:
            self.initialize()
        cur = self._conn.cursor()
        try:
            yield cur
        finally:
            cur.close()

    def _create_tables(self) -> None:
        cur = self._conn.cursor()
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS stores (
                    store_id VARCHAR PRIMARY KEY,
                    store_name VARCHAR NOT NULL,
                    region VARCHAR NOT NULL,
                    store_type VARCHAR NOT NULL,
                    square_footage INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    sku_id VARCHAR PRIMARY KEY,
                    sku_name VARCHAR NOT NULL,
                    department VARCHAR NOT NULL,
                    category VARCHAR NOT NULL,
                    unit_cost DOUBLE NOT NULL,
                    retail_price DOUBLE NOT NULL,
                    lead_time_days DOUBLE NOT NULL,
                    lead_time_std DOUBLE NOT NULL,
                    min_order_qty INTEGER NOT NULL DEFAULT 1,
                    holding_cost_annual_rate DOUBLE NOT NULL DEFAULT 0.20,
                    order_cost DOUBLE NOT NULL DEFAULT 50.0,
                    service_level DOUBLE NOT NULL DEFAULT 0.95,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS historical_sales (
                    date DATE NOT NULL,
                    store_id VARCHAR NOT NULL,
                    sku_id VARCHAR NOT NULL,
                    sales DOUBLE NOT NULL,
                    price DOUBLE NOT NULL,
                    discount_pct DOUBLE NOT NULL,
                    promo_active INTEGER NOT NULL,
                    temperature_celsius DOUBLE NOT NULL,
                    precipitation_mm DOUBLE NOT NULL,
                    extreme_weather_flag INTEGER NOT NULL,
                    stock_on_hand INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (date, store_id, sku_id)
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_hist_sales_sku_date 
                ON historical_sales (sku_id, date);
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_hist_sales_store_date 
                ON historical_sales (store_id, date);
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS precomputed_features (
                    date DATE NOT NULL,
                    store_id VARCHAR NOT NULL,
                    sku_id VARCHAR NOT NULL,
                    sales DOUBLE NOT NULL,
                    price DOUBLE NOT NULL,
                    day_of_week INTEGER NOT NULL,
                    day_of_month INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    is_weekend INTEGER NOT NULL,
                    discount_pct DOUBLE NOT NULL,
                    promo_active INTEGER NOT NULL,
                    temperature_celsius DOUBLE NOT NULL,
                    precipitation_mm DOUBLE NOT NULL,
                    extreme_weather_flag INTEGER NOT NULL,
                    sales_lag_1 DOUBLE,
                    sales_lag_7 DOUBLE,
                    sales_lag_14 DOUBLE,
                    sales_lag_28 DOUBLE,
                    sales_roll_mean_7 DOUBLE,
                    sales_roll_std_7 DOUBLE,
                    sales_roll_mean_28 DOUBLE,
                    sales_roll_min_7 DOUBLE,
                    sales_roll_max_7 DOUBLE,
                    PRIMARY KEY (date, store_id, sku_id)
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_features_sku_date 
                ON precomputed_features (sku_id, date);
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS inventory_snapshots (
                    store_id VARCHAR NOT NULL,
                    sku_id VARCHAR NOT NULL,
                    current_stock INTEGER NOT NULL,
                    mean_daily_demand DOUBLE NOT NULL,
                    std_daily_demand DOUBLE NOT NULL,
                    safety_stock INTEGER NOT NULL,
                    reorder_point INTEGER NOT NULL,
                    economic_order_qty INTEGER NOT NULL,
                    is_breached BOOLEAN NOT NULL,
                    stockout_risk_pct DOUBLE NOT NULL,
                    projected_stockout_loss_usd DOUBLE NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (store_id, sku_id)
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS forecast_records (
                    forecast_id VARCHAR PRIMARY KEY,
                    store_id VARCHAR NOT NULL,
                    sku_id VARCHAR NOT NULL,
                    forecast_date DATE NOT NULL,
                    horizon_date DATE NOT NULL,
                    p10 DOUBLE NOT NULL,
                    p50 DOUBLE NOT NULL,
                    p90 DOUBLE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_forecasts_sku_horizon 
                ON forecast_records (sku_id, horizon_date);
            """)
        finally:
            cur.close()

    def insert_dataframe(
        self,
        table_name: str,
        df: pl.DataFrame,
        mode: str = "append"
    ) -> int:
        if table_name not in self.ALLOWED_TABLES:
            raise ValueError(f"Table name '{table_name}' is not in allowed tables whitelist")

        if mode not in ("append", "replace", "upsert"):
            raise ValueError(f"Unsupported insert mode: {mode}")

        if df.is_empty():
            if mode == "replace":
                with self._write_lock:
                    with self.cursor() as cur:
                        cur.execute("BEGIN TRANSACTION")
                        try:
                            cur.execute(f'DELETE FROM "{table_name}"')
                            cur.execute("COMMIT")
                        except Exception:
                            try:
                                cur.execute("ROLLBACK")
                            except Exception:
                                pass
                            raise
            return 0

        arrow_table = df.to_arrow()
        view_name = f"_temp_arrow_{os.urandom(4).hex()}"
        col_identifiers = ", ".join(f'"{col}"' for col in df.columns)

        with self._write_lock:
            with self.cursor() as cur:
                cur.register(view_name, arrow_table)
                try:
                    if mode == "replace":
                        cur.execute("BEGIN TRANSACTION")
                        try:
                            cur.execute(f'DELETE FROM "{table_name}"')
                            cur.execute(f'INSERT INTO "{table_name}" ({col_identifiers}) SELECT {col_identifiers} FROM {view_name}')
                            cur.execute("COMMIT")
                        except Exception:
                            try:
                                cur.execute("ROLLBACK")
                            except Exception:
                                pass
                            raise
                    elif mode == "append":
                        cur.execute(f'INSERT INTO "{table_name}" ({col_identifiers}) SELECT {col_identifiers} FROM {view_name}')
                    elif mode == "upsert":
                        pk_cols = self.TABLE_PRIMARY_KEYS[table_name]
                        pk_identifiers = ", ".join(f'"{pk}"' for pk in pk_cols)
                        non_pk_cols = [c for c in df.columns if c not in pk_cols]
                        if non_pk_cols:
                            set_clause = ", ".join(f'"{col}" = EXCLUDED."{col}"' for col in non_pk_cols)
                            conflict_action = f"DO UPDATE SET {set_clause}"
                        else:
                            conflict_action = "DO NOTHING"
                        cur.execute(
                            f'INSERT INTO "{table_name}" ({col_identifiers}) SELECT {col_identifiers} FROM {view_name} '
                            f'ON CONFLICT ({pk_identifiers}) {conflict_action}'
                        )
                finally:
                    cur.unregister(view_name)

        return df.height

    def query_as_polars(
        self,
        query: str,
        params: Optional[Union[tuple, list, dict]] = None
    ) -> pl.DataFrame:
        with self.cursor() as cur:
            if params is not None:
                arrow_table = cur.execute(query, params).arrow()
            else:
                arrow_table = cur.execute(query).arrow()
            return pl.from_arrow(arrow_table)

    def query_records(
        self,
        query: str,
        params: Optional[Union[tuple, list, dict]] = None
    ) -> List[Dict[str, Any]]:
        with self.cursor() as cur:
            if params is not None:
                res = cur.execute(query, params)
            else:
                res = cur.execute(query)
            cols = [desc[0] for desc in res.description]
            rows = res.fetchall()
            return [dict(zip(cols, row)) for row in rows]

    def save_stores(self, df: pl.DataFrame, mode: str = "upsert") -> int:
        return self.insert_dataframe("stores", df, mode=mode)

    def get_stores(self) -> pl.DataFrame:
        return self.query_as_polars("SELECT * FROM stores ORDER BY store_id ASC")

    def save_products(self, df: pl.DataFrame, mode: str = "upsert") -> int:
        return self.insert_dataframe("products", df, mode=mode)

    def get_products(self) -> pl.DataFrame:
        return self.query_as_polars("SELECT * FROM products ORDER BY sku_id ASC")

    def save_historical_sales(self, df: pl.DataFrame, mode: str = "append") -> int:
        return self.insert_dataframe("historical_sales", df, mode=mode)

    def get_historical_sales(
        self,
        store_id: Optional[str] = None,
        sku_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pl.DataFrame:
        conditions = []
        params = []
        if store_id:
            conditions.append("store_id = ?")
            params.append(store_id)
        if sku_id:
            conditions.append("sku_id = ?")
            params.append(sku_id)
        if start_date:
            conditions.append("date >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("date <= ?")
            params.append(end_date)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM historical_sales {where_clause} ORDER BY date ASC, store_id ASC, sku_id ASC"
        return self.query_as_polars(query, params if params else None)

    def save_precomputed_features(self, df: pl.DataFrame, mode: str = "replace") -> int:
        return self.insert_dataframe("precomputed_features", df, mode=mode)

    def get_precomputed_features(
        self,
        store_id: Optional[str] = None,
        sku_id: Optional[str] = None
    ) -> pl.DataFrame:
        conditions = []
        params = []
        if store_id:
            conditions.append("store_id = ?")
            params.append(store_id)
        if sku_id:
            conditions.append("sku_id = ?")
            params.append(sku_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM precomputed_features {where_clause} ORDER BY date ASC, store_id ASC, sku_id ASC"
        return self.query_as_polars(query, params if params else None)

    def save_inventory_snapshots(self, df: pl.DataFrame, mode: str = "replace") -> int:
        return self.insert_dataframe("inventory_snapshots", df, mode=mode)

    def get_inventory_alerts(self) -> List[Dict[str, Any]]:
        query = """
            SELECT s.*, p.sku_name, p.department, p.category, p.unit_cost, p.retail_price
            FROM inventory_snapshots s
            JOIN products p ON s.sku_id = p.sku_id
            WHERE s.is_breached = TRUE
            ORDER BY s.stockout_risk_pct DESC, s.projected_stockout_loss_usd DESC
        """
        return self.query_records(query)

    def save_forecast_records(self, df: pl.DataFrame, mode: str = "append") -> int:
        return self.insert_dataframe("forecast_records", df, mode=mode)

    def get_sku_forecast(self, sku_id: str, store_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if store_id:
            query = """
                SELECT * FROM forecast_records
                WHERE sku_id = ? AND store_id = ?
                ORDER BY horizon_date ASC
            """
            return self.query_records(query, (sku_id, store_id))
        else:
            query = """
                SELECT horizon_date, AVG(p10) as p10, AVG(p50) as p50, AVG(p90) as p90
                FROM forecast_records
                WHERE sku_id = ?
                GROUP BY horizon_date
                ORDER BY horizon_date ASC
            """
            return self.query_records(query, (sku_id,))


db_manager = DuckDBManager.get_instance()


def get_db_cursor() -> Generator[duckdb.DuckDBPyConnection, None, None]:
    with db_manager.cursor() as cur:
        yield cur
