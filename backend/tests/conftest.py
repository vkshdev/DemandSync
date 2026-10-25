import os
import sys
from pathlib import Path
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

os.environ["TESTING"] = "1"

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def make_mock_sales_df(n_stores: int = 2, n_skus: int = 2, days: int = 30, seed: int = 42):
    if n_stores <= 0:
        raise ValueError("n_stores must be positive")
    if n_skus <= 0:
        raise ValueError("n_skus must be positive")
    if days <= 0:
        raise ValueError("days must be positive")
    import polars as pl
    base_date = date(2024, 1, 1)
    rows = []
    for s_idx in range(1, n_stores + 1):
        store_id = f"STORE-{s_idx:03d}"
        for k_idx in range(1, n_skus + 1):
            sku_id = f"SKU-{k_idx:03d}"
            for d in range(days):
                cur_date = base_date + timedelta(days=d)
                sales_val = 5.0 + (d % 7) + (k_idx * 2)
                rows.append({
                    "date": cur_date,
                    "store_id": store_id,
                    "sku_id": sku_id,
                    "sales": float(sales_val),
                    "price": 29.99,
                    "discount_pct": 0.10 if d % 7 == 5 else 0.0,
                    "promo_active": 1 if d % 7 == 5 else 0,
                    "temperature_celsius": 18.5 + (d % 5),
                    "precipitation_mm": 2.0 if d % 10 == 0 else 0.0,
                    "extreme_weather_flag": 1 if d == 20 else 0,
                    "stock_on_hand": 50,
                })
    return pl.DataFrame(rows)


def make_mock_stores_df(n_stores: int = 2):
    if n_stores <= 0:
        raise ValueError("n_stores must be positive")
    import polars as pl
    return pl.DataFrame([
        {
            "store_id": f"STORE-{i+1:03d}",
            "store_name": f"Store {i+1}",
            "region": "Midwest",
            "store_type": "Supercenter",
            "square_footage": 45000,
        }
        for i in range(n_stores)
    ])


def make_mock_products_df(n_skus: int = 2):
    if n_skus <= 0:
        raise ValueError("n_skus must be positive")
    import polars as pl
    return pl.DataFrame([
        {
            "sku_id": f"SKU-{i+1:03d}",
            "sku_name": f"Product {i+1}",
            "department": "General",
            "category": "Retail",
            "unit_cost": 12.0,
            "retail_price": 25.0,
            "lead_time_days": 7.0,
            "lead_time_std": 1.5,
            "min_order_qty": 10,
            "holding_cost_annual_rate": 0.20,
            "order_cost": 50.0,
            "service_level": 0.95,
        }
        for i in range(n_skus)
    ])


@pytest.fixture
def sample_sales_df():
    try:
        import polars as pl
    except ImportError:
        pytest.skip("Polars is required for dataframe fixtures")
    return make_mock_sales_df(n_stores=2, n_skus=3, days=35)


@pytest.fixture
def sample_feature_matrix(sample_sales_df):
    try:
        import polars as pl
    except ImportError:
        pytest.skip("Polars is required for feature matrix fixture")

    df = sample_sales_df.sort(["store_id", "sku_id", "date"])
    df = df.with_columns([
        pl.col("date").dt.weekday().alias("day_of_week"),
        pl.col("date").dt.day().alias("day_of_month"),
        pl.col("date").dt.month().alias("month"),
        (pl.col("date").dt.weekday() >= 6).cast(pl.Int32).alias("is_weekend"),
        pl.col("sales").shift(1).over(["store_id", "sku_id"]).fill_null(0.0).alias("sales_lag_1"),
        pl.col("sales").shift(7).over(["store_id", "sku_id"]).fill_null(0.0).alias("sales_lag_7"),
        pl.col("sales").shift(14).over(["store_id", "sku_id"]).fill_null(0.0).alias("sales_lag_14"),
        pl.col("sales").shift(28).over(["store_id", "sku_id"]).fill_null(0.0).alias("sales_lag_28"),
        pl.col("sales").rolling_mean(window_size=7).over(["store_id", "sku_id"]).fill_null(pl.col("sales")).alias("sales_roll_mean_7"),
        pl.col("sales").rolling_std(window_size=7).over(["store_id", "sku_id"]).fill_null(0.0).alias("sales_roll_std_7"),
        pl.col("sales").rolling_mean(window_size=28).over(["store_id", "sku_id"]).fill_null(pl.col("sales")).alias("sales_roll_mean_28"),
        pl.col("sales").rolling_min(window_size=7).over(["store_id", "sku_id"]).fill_null(pl.col("sales")).alias("sales_roll_min_7"),
        pl.col("sales").rolling_max(window_size=7).over(["store_id", "sku_id"]).fill_null(pl.col("sales")).alias("sales_roll_max_7"),
    ])
    return df


@pytest.fixture
def sample_briefing_request():
    return {
        "sku_id": "SKU-409",
        "sku_name": "Winter Thermal Parka",
        "store_id": "Store-12 (Chicago Downtown)",
        "current_stock": 42,
        "p10_forecast": 65.0,
        "p50_forecast": 95.0,
        "p90_forecast": 140.0,
        "safety_stock": 50,
        "reorder_point": 78,
        "stockout_risk_pct": 84.5,
        "lead_time_days": 4,
        "unit_margin_usd": 45.0,
        "top_drivers": [
            {"feature": "unseasonal_polar_vortex_temp_drop", "impact": "+36% surge"},
            {"feature": "historical_weekend_traffic_lift", "impact": "+14% lift"}
        ]
    }


@pytest.fixture
def sample_chat_request():
    return {
        "query": "Which outerwear products are at risk of stockout this week?",
        "context": {
            "store_id": "Store-12",
            "department": "Apparel"
        }
    }


@pytest.fixture
def sample_policy_request():
    return {
        "sku_id": "SKU-409",
        "daily_demand_mean": 6.8,
        "daily_demand_std": 2.4,
        "lead_time_days_mean": 4.0,
        "lead_time_days_std": 1.2,
        "target_service_level": 0.95,
        "annual_demand_units": 2480,
        "order_cost_usd": 50.0,
        "holding_cost_per_unit_year_usd": 6.5,
        "current_stock": 42,
        "unit_retail_price_usd": 85.0,
        "unit_cost_usd": 40.0
    }


@pytest.fixture
def sample_scenario_request():
    return {
        "sku_id": "SKU-409",
        "store_id": "Store-12",
        "discount_pct": 0.20,
        "weather_temp_celsius_shift": -10.0,
        "extreme_weather_flag": True,
        "supplier_lead_time_days_shock": 7
    }


@pytest.fixture
def block_external_sockets(monkeypatch):
    """Guarantees zero outbound network egress during on-device AI testing."""
    import socket
    orig_connect = socket.socket.connect

    def guarded_connect(self, address):
        host, port = address[0], address[1]
        if host in ("127.0.0.1", "localhost", "testserver"):
            return orig_connect(self, address)
        raise ConnectionRefusedError(
            f"Zero egress policy: blocked external connection attempt to {host}:{port}"
        )

    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
