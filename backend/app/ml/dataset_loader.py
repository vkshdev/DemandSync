import argparse
import datetime
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import polars as pl

from app.core.config import settings
from app.core.database import DuckDBManager
from app.ml.feature_pipeline import FEATURE_SCHEMA, build_feature_matrix
from app.services.inventory_engine import (
    calculate_eoq,
    calculate_financial_risk,
    calculate_reorder_point,
    calculate_safety_stock,
)

logger = logging.getLogger("demandsync.dataset_loader")

DEFAULT_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "retail_store_inventory.csv",
)

# Canonical mapping strictly covering the authentic terms present in the Kaggle CSV:
# Date, Store ID, Product ID, Category, Region, Inventory Level, Units Sold,
# Units Ordered, Demand Forecast, Price, Discount, Weather Condition,
# Holiday/Promotion, Competitor Pricing, Seasonality
COLUMN_ALIAS_MAP: Dict[str, str] = {
    # 1. Date
    "date": "date",
    # 2. Store ID
    "store_id": "store_id",
    # 3. Product ID
    "product_id": "sku_id",
    "sku_id": "sku_id",
    # 4. Category
    "category": "category",
    # 5. Region
    "region": "region",
    # 6. Inventory Level
    "inventory_level": "current_stock",
    "current_stock": "current_stock",
    "stock_on_hand": "current_stock",
    # 7. Units Sold
    "units_sold": "sales",
    "sales": "sales",
    # 8. Units Ordered
    "units_ordered": "units_ordered",
    # 9. Demand Forecast
    "demand_forecast": "demand_forecast",
    # 10. Price
    "price": "price",
    # 11. Discount
    "discount": "discount_pct",
    "discount_pct": "discount_pct",
    # 12. Weather Condition
    "weather_condition": "weather",
    "weather": "weather",
    # 13. Holiday/Promotion
    "holiday_promotion": "holiday",
    "holidaypromotion": "holiday",
    "holiday": "holiday",
    "promo_active": "holiday",
    # 14. Competitor Pricing
    "competitor_pricing": "competitor_price",
    "competitor_price": "competitor_price",
    # 15. Seasonality
    "seasonality": "seasonality",
}


def _clean_header_name(header: str) -> str:
    """Normalize column header into alphanumeric lowercase with underscores."""
    s = header.strip().lower()
    s = re.sub(r"[\s\-\/\.]+", "_", s)
    s = re.sub(r"[^\w_]", "", s)
    return s.strip("_")


def resolve_csv_path(custom_path: Optional[str] = None) -> str:
    """Finds CSV path, checking custom_path, env var, and default locations."""
    if custom_path is not None:
        return os.path.abspath(custom_path)

    env_path = os.getenv("DEMANDSYNC_DATASET_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    if os.path.exists(DEFAULT_CSV_PATH):
        return os.path.abspath(DEFAULT_CSV_PATH)

    # Fallback to local cwd 'data/retail_store_inventory.csv'
    cwd_fallback = os.path.abspath(os.path.join("data", "retail_store_inventory.csv"))
    if os.path.exists(cwd_fallback):
        return cwd_fallback

    # Fallback to backend 'data/retail_store_inventory.csv'
    backend_fallback = os.path.abspath(
        os.path.join("backend", "data", "retail_store_inventory.csv")
    )
    if os.path.exists(backend_fallback):
        return backend_fallback

    return DEFAULT_CSV_PATH


def normalize_dataset_columns(df: pl.DataFrame) -> pl.DataFrame:
    """Maps various Kaggle column namings to DemandSync canonical column names."""
    rename_dict: Dict[str, str] = {}
    for col in df.columns:
        norm = _clean_header_name(col)
        if norm in COLUMN_ALIAS_MAP:
            target = COLUMN_ALIAS_MAP[norm]
            if target not in rename_dict.values():
                rename_dict[col] = target

    res = df.rename(rename_dict)
    return res


def load_retail_dataset(
    csv_path: Optional[str] = None,
    stores: Optional[List[str]] = None,
    skus: Optional[List[str]] = None,
) -> pl.DataFrame:
    """
    Ingests and normalizes the Retail Store Inventory dataset via Polars.
    Returns cleaned DataFrame strictly matching historical_sales schema requirements.
    """
    target_path = resolve_csv_path(csv_path)
    if not os.path.exists(target_path):
        raise FileNotFoundError(
            f"Dataset CSV not found at '{target_path}'. Please place "
            f"'retail_store_inventory.csv' in 'backend/data/' or specify a valid path."
        )

    # Load CSV using Polars
    raw_df = pl.read_csv(target_path, ignore_errors=True, try_parse_dates=True)
    if raw_df.is_empty():
        raise ValueError(f"Dataset at '{target_path}' is completely empty.")

    norm_df = normalize_dataset_columns(raw_df)

    required_canonical = ["date", "store_id", "sku_id", "sales"]
    for req in required_canonical:
        if req not in norm_df.columns:
            raise KeyError(
                f"Required column '{req}' could not be identified in CSV headers: {raw_df.columns}"
            )

    # 1. Parse Date column
    if norm_df.schema.get("date") != pl.Date:
        try:
            norm_df = norm_df.with_columns(
                pl.col("date")
                .cast(pl.String)
                .str.replace_all("/", "-")
                .str.to_date("%Y-%m-%d", strict=False)
            )
        except Exception:
            norm_df = norm_df.with_columns(
                pl.col("date").str.to_date(strict=False)
            )

    # 2. Parse Store & SKU IDs
    norm_df = norm_df.with_columns([
        pl.col("store_id").cast(pl.String).str.strip_chars(),
        pl.col("sku_id").cast(pl.String).str.strip_chars(),
        pl.col("sales").cast(pl.Float64).fill_null(0.0).clip(lower_bound=0.0),
    ])

    # 3. Parse Price
    if "price" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("price").cast(pl.Float64).fill_null(25.0).clip(lower_bound=0.01)
        )
    else:
        norm_df = norm_df.with_columns(pl.lit(25.0).alias("price"))

    # 4. Parse Discount Pct
    if "discount_pct" in norm_df.columns:
        # Check if discounts are formatted in percent (e.g. 10.0 for 10%)
        max_disc = norm_df.select(pl.col("discount_pct").max()).item()
        if max_disc is not None and max_disc > 1.0:
            norm_df = norm_df.with_columns(
                (pl.col("discount_pct").cast(pl.Float64) / 100.0)
                .fill_null(0.0)
                .clip(0.0, 1.0)
            )
        else:
            norm_df = norm_df.with_columns(
                pl.col("discount_pct").cast(pl.Float64).fill_null(0.0).clip(0.0, 1.0)
            )
    else:
        norm_df = norm_df.with_columns(pl.lit(0.0).alias("discount_pct"))

    # 5. Parse Promo Active / Holiday
    if "holiday" in norm_df.columns:
        if norm_df.schema.get("holiday") in (pl.String, pl.Categorical):
            norm_df = norm_df.with_columns(
                pl.when(
                    pl.col("holiday").str.to_lowercase().is_in(["1", "true", "yes", "holiday"])
                )
                .then(1)
                .otherwise(0)
                .cast(pl.Int32)
                .alias("promo_active")
            )
        else:
            norm_df = norm_df.with_columns(
                pl.when(pl.col("holiday").cast(pl.Int32) > 0)
                .then(1)
                .otherwise(0)
                .cast(pl.Int32)
                .alias("promo_active")
            )
    elif "discount_pct" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.when(pl.col("discount_pct") > 0.05).then(1).otherwise(0).alias("promo_active")
        )
    else:
        norm_df = norm_df.with_columns(pl.lit(0).alias("promo_active"))

    # 6. Parse Weather / Temperature
    if "temperature" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("temperature").cast(pl.Float64).fill_null(20.0).alias("temperature_celsius")
        )
    elif "weather" in norm_df.columns:
        # Categorical weather mapping (e.g., Sunny -> 24.0, Snowy -> -2.0)
        norm_df = norm_df.with_columns([
            pl.when(pl.col("weather").str.to_lowercase().str.contains("snow"))
            .then(-2.0)
            .when(pl.col("weather").str.to_lowercase().str.contains("rain"))
            .then(14.0)
            .when(pl.col("weather").str.to_lowercase().str.contains("cloud"))
            .then(18.0)
            .otherwise(24.0)
            .cast(pl.Float64)
            .alias("temperature_celsius"),
            pl.when(pl.col("weather").str.to_lowercase().str.contains("rain"))
            .then(12.0)
            .when(pl.col("weather").str.to_lowercase().str.contains("snow"))
            .then(6.0)
            .otherwise(0.0)
            .cast(pl.Float64)
            .alias("precipitation_mm"),
            pl.when(
                pl.col("weather").str.to_lowercase().str.contains("snow|storm|extreme")
            )
            .then(1)
            .otherwise(0)
            .cast(pl.Int32)
            .alias("extreme_weather_flag"),
        ])
    else:
        norm_df = norm_df.with_columns([
            pl.lit(20.0).alias("temperature_celsius"),
            pl.lit(0.0).alias("precipitation_mm"),
            pl.lit(0).alias("extreme_weather_flag"),
        ])

    if "precipitation_mm" not in norm_df.columns:
        norm_df = norm_df.with_columns(pl.lit(0.0).alias("precipitation_mm"))

    if "extreme_weather_flag" not in norm_df.columns:
        norm_df = norm_df.with_columns(pl.lit(0).alias("extreme_weather_flag"))

    # 7. Parse Inventory / Stock On Hand
    if "current_stock" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("current_stock").cast(pl.Int32).fill_null(0).alias("stock_on_hand")
        )
    elif "stock_on_hand" not in norm_df.columns:
        norm_df = norm_df.with_columns(pl.lit(0).alias("stock_on_hand"))

    # 8. Parse Units Ordered
    if "units_ordered" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("units_ordered").cast(pl.Float64).fill_null(0.0).clip(lower_bound=0.0)
        )
    else:
        norm_df = norm_df.with_columns(pl.lit(0.0).alias("units_ordered"))

    # 9. Parse Demand Forecast
    if "demand_forecast" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("demand_forecast").cast(pl.Float64).fill_null(pl.col("sales")).clip(lower_bound=0.0)
        )
    else:
        norm_df = norm_df.with_columns(pl.col("sales").alias("demand_forecast"))

    # 10. Parse Competitor Price
    if "competitor_price" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("competitor_price").cast(pl.Float64).fill_null(pl.col("price")).clip(lower_bound=0.01)
        )
    else:
        norm_df = norm_df.with_columns(pl.col("price").alias("competitor_price"))

    # 11. Parse Seasonality
    if "seasonality" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("seasonality").cast(pl.String).fill_null("Autumn").alias("seasonality")
        )
    else:
        norm_df = norm_df.with_columns(pl.lit("Autumn").alias("seasonality"))

    # 12. Parse Category & Region
    if "category" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("category").cast(pl.String).fill_null("General").alias("category")
        )
    else:
        norm_df = norm_df.with_columns(pl.lit("General").alias("category"))

    if "region" in norm_df.columns:
        norm_df = norm_df.with_columns(
            pl.col("region").cast(pl.String).fill_null("General").alias("region")
        )
    else:
        norm_df = norm_df.with_columns(pl.lit("General").alias("region"))

    # Optional filtering
    if stores:
        norm_df = norm_df.filter(pl.col("store_id").is_in(stores))
    if skus:
        norm_df = norm_df.filter(pl.col("sku_id").is_in(skus))

    final_cols = [
        "date",
        "store_id",
        "sku_id",
        "sales",
        "price",
        "discount_pct",
        "promo_active",
        "temperature_celsius",
        "precipitation_mm",
        "extreme_weather_flag",
        "stock_on_hand",
        "units_ordered",
        "demand_forecast",
        "competitor_price",
        "weather",
        "seasonality",
        "category",
        "region",
    ]

    selected_cols = [c for c in final_cols if c in norm_df.columns]
    return norm_df.select(selected_cols).sort(["date", "store_id", "sku_id"])


def extract_stores_metadata(df: pl.DataFrame) -> pl.DataFrame:
    """Extracts unique stores and generates metadata matching the stores table schema."""
    if "region" in df.columns:
        store_regions = (
            df.select(["store_id", "region"])
            .drop_nulls()
            .unique(subset=["store_id"], keep="first")
        )
    else:
        store_regions = (
            df.select("store_id")
            .unique()
            .with_columns(pl.lit("General").alias("region"))
        )

    return store_regions.select([
        pl.col("store_id").cast(pl.String),
        (pl.lit("Store ") + pl.col("store_id").cast(pl.String)).alias("store_name"),
        pl.col("region").cast(pl.String).fill_null("General").alias("region"),
        pl.lit("Supercenter").alias("store_type"),
        pl.lit(45000).cast(pl.Int64).alias("square_footage"),
    ]).sort("store_id")


def extract_products_metadata(df: pl.DataFrame) -> pl.DataFrame:
    """
    Extracts unique SKUs and generates realistic inventory metadata
    (wholesale unit cost at ~55% retail price, 7-day lead time, MOQ 10).
    """
    if "category" in df.columns:
        sku_cat = (
            df.select(["sku_id", "category"])
            .drop_nulls()
            .unique(subset=["sku_id"], keep="first")
        )
    else:
        sku_cat = (
            df.select("sku_id")
            .unique()
            .with_columns(pl.lit("General").alias("category"))
        )

    sku_price = (
        df.group_by("sku_id")
        .agg(pl.col("price").median().alias("median_price"))
    )

    combined = sku_cat.join(sku_price, on="sku_id", how="left")

    return combined.select([
        pl.col("sku_id").cast(pl.String),
        (pl.lit("Product ") + pl.col("sku_id").cast(pl.String)).alias("sku_name"),
        pl.col("category").cast(pl.String).fill_null("General").alias("department"),
        pl.col("category").cast(pl.String).fill_null("General").alias("category"),
        (pl.col("median_price").fill_null(25.0).clip(lower_bound=0.99) * 0.55).round(2).alias("unit_cost"),
        pl.col("median_price").fill_null(25.0).clip(lower_bound=0.99).round(2).alias("retail_price"),
        pl.lit(7.0).alias("lead_time_days"),
        pl.lit(1.5).alias("lead_time_std"),
        pl.lit(10).cast(pl.Int64).alias("min_order_qty"),
        pl.lit(0.20).alias("holding_cost_annual_rate"),
        pl.lit(50.0).alias("order_cost"),
        pl.lit(0.95).alias("service_level"),
    ]).sort("sku_id")


def calculate_inventory_snapshots(
    df: pl.DataFrame,
    products_df: pl.DataFrame,
) -> pl.DataFrame:
    """
    Calculates live inventory operational metrics (Safety Stock, ROP, EOQ,
    stockout risk %, and financial loss) per store/SKU pair.
    """
    prod_map: Dict[str, Dict[str, Any]] = {}
    for p in products_df.iter_rows(named=True):
        prod_map[p["sku_id"]] = p

    # Find latest date per store-sku to extract latest stock on hand
    latest_rows = (
        df.sort("date", descending=True)
        .unique(subset=["store_id", "sku_id"], keep="first")
    )

    # Compute historical demand statistics
    demand_stats = df.group_by(["store_id", "sku_id"]).agg([
        pl.col("sales").mean().alias("mean_demand"),
        pl.col("sales").std().alias("std_demand"),
    ])

    stats_map = {
        (r["store_id"], r["sku_id"]): (
            float(r["mean_demand"] or 0.0),
            float(r["std_demand"] or 0.5),
        )
        for r in demand_stats.iter_rows(named=True)
    }

    rows = []
    for r in latest_rows.iter_rows(named=True):
        store_id = r["store_id"]
        sku_id = r["sku_id"]
        current_stock = int(r.get("stock_on_hand") or 0)

        p = prod_map.get(
            sku_id,
            {
                "unit_cost": 12.0,
                "retail_price": 25.0,
                "lead_time_days": 7.0,
                "lead_time_std": 1.5,
                "min_order_qty": 10,
                "holding_cost_annual_rate": 0.20,
                "order_cost": 50.0,
                "service_level": 0.95,
            },
        )

        mean_d, std_d = stats_map.get((store_id, sku_id), (5.0, 1.5))
        mean_d = max(0.1, mean_d)
        std_d = max(0.1, std_d if std_d is not None and not np.isnan(std_d) else 1.0)

        ss = calculate_safety_stock(
            mean_lead_time=p["lead_time_days"],
            std_lead_time=p["lead_time_std"],
            mean_demand=mean_d,
            std_demand=std_d,
            service_level=p["service_level"],
        )

        rop = calculate_reorder_point(
            mean_demand=mean_d,
            mean_lead_time=p["lead_time_days"],
            safety_stock=ss,
        )

        annual_demand = mean_d * 365.0
        holding_unit_cost = max(0.01, p["unit_cost"] * p["holding_cost_annual_rate"])
        eoq = calculate_eoq(
            annual_demand=annual_demand,
            order_cost=p["order_cost"],
            holding_cost_per_unit=holding_unit_cost,
            min_order_qty=p["min_order_qty"],
        )

        risk = calculate_financial_risk(
            current_stock=current_stock,
            forecast_p50=mean_d * p["lead_time_days"],
            forecast_p90=mean_d * p["lead_time_days"] * 1.35,
            unit_cost=p["unit_cost"],
            unit_price=p["retail_price"],
            holding_rate=p["holding_cost_annual_rate"],
        )

        is_breached = bool(current_stock < rop)

        rows.append({
            "store_id": store_id,
            "sku_id": sku_id,
            "current_stock": current_stock,
            "mean_daily_demand": round(mean_d, 2),
            "std_daily_demand": round(std_d, 2),
            "safety_stock": ss,
            "reorder_point": rop,
            "economic_order_qty": eoq,
            "is_breached": is_breached,
            "stockout_risk_pct": float(risk["stockout_risk_pct"]),
            "projected_stockout_loss_usd": float(risk["projected_stockout_loss_usd"]),
        })

    return pl.DataFrame(
        rows,
        schema={
            "store_id": pl.String,
            "sku_id": pl.String,
            "current_stock": pl.Int32,
            "mean_daily_demand": pl.Float64,
            "std_daily_demand": pl.Float64,
            "safety_stock": pl.Int32,
            "reorder_point": pl.Int32,
            "economic_order_qty": pl.Int32,
            "is_breached": pl.Boolean,
            "stockout_risk_pct": pl.Float64,
            "projected_stockout_loss_usd": pl.Float64,
        },
    ).sort(["store_id", "sku_id"])


def seed_database_from_csv(
    csv_path: Optional[str] = None,
    db_manager: Optional[DuckDBManager] = None,
    stores: Optional[List[str]] = None,
    skus: Optional[List[str]] = None,
) -> Dict[str, int]:
    """
    Master ingestion pipeline:
    1. Loads and validates Kaggle retail dataset CSV.
    2. Populates stores, products, historical_sales, inventory_snapshots,
       and precomputed_features tables in DuckDB.
    """
    db = db_manager or DuckDBManager.get_instance()
    db.initialize()

    logger.info("Loading retail dataset from CSV...")
    sales_df = load_retail_dataset(csv_path=csv_path, stores=stores, skus=skus)
    logger.info("Loaded %d sales records.", sales_df.height)

    stores_df = extract_stores_metadata(sales_df)
    products_df = extract_products_metadata(sales_df)
    snapshots_df = calculate_inventory_snapshots(sales_df, products_df)

    # Prepare historical_sales clean schema covering all authentic dataset columns
    hist_sales_cols = [
        "date",
        "store_id",
        "sku_id",
        "sales",
        "price",
        "discount_pct",
        "promo_active",
        "temperature_celsius",
        "precipitation_mm",
        "extreme_weather_flag",
        "stock_on_hand",
        "units_ordered",
        "demand_forecast",
        "competitor_price",
        "weather",
        "seasonality",
        "category",
        "region",
    ]
    clean_sales_df = sales_df.select([c for c in hist_sales_cols if c in sales_df.columns])

    # Ingest entities
    logger.info("Ingesting stores (%d)...", stores_df.height)
    db.save_stores(stores_df, mode="upsert")

    logger.info("Ingesting products (%d)...", products_df.height)
    db.save_products(products_df, mode="upsert")

    logger.info("Ingesting historical_sales (%d)...", clean_sales_df.height)
    db.save_historical_sales(clean_sales_df, mode="replace")

    logger.info("Ingesting inventory_snapshots (%d)...", snapshots_df.height)
    db.save_inventory_snapshots(snapshots_df, mode="replace")

    # Compute & save lag/rolling features
    logger.info("Computing precomputed feature matrix...")
    features_df = build_feature_matrix(clean_sales_df, drop_burn_in=False)
    feature_cols = [c for c in FEATURE_SCHEMA.keys() if c in features_df.columns]
    features_df = features_df.select(feature_cols)
    db.save_precomputed_features(features_df, mode="replace")

    result = {
        "stores": stores_df.height,
        "products": products_df.height,
        "historical_sales": clean_sales_df.height,
        "inventory_snapshots": snapshots_df.height,
        "precomputed_features": features_df.height,
    }
    logger.info("Database successfully seeded: %s", result)
    return result


def seed_database_if_empty(csv_path: Optional[str] = None) -> bool:
    """
    Checks if DuckDB is initialized and populated.
    If empty and CSV is available, automatically seeds it.
    """
    try:
        db = DuckDBManager.get_instance()
        db.initialize()
        records = db.query_records("SELECT COUNT(*) AS cnt FROM stores")
        count = records[0]["cnt"] if records else 0
        if count == 0:
            target = resolve_csv_path(csv_path)
            if os.path.exists(target):
                logger.info("DuckDB empty. Auto-seeding from '%s'...", target)
                seed_database_from_csv(csv_path=target, db_manager=db)
                return True
            else:
                logger.warning(
                    "DuckDB is unpopulated, but dataset CSV was not found at '%s'. "
                    "Skipping auto-seeding.",
                    target,
                )
        return False
    except Exception as exc:
        logger.warning("Auto-seeding check skipped due to exception: %s", exc)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(
        description="Ingest Kaggle Retail Store Inventory Dataset into DemandSync DuckDB."
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Path to retail_store_inventory.csv (default: backend/data/retail_store_inventory.csv)",
    )
    parser.add_argument(
        "--stores",
        nargs="+",
        default=None,
        help="Optional list of Store IDs to filter (e.g. --stores STORE-001 STORE-002)",
    )
    parser.add_argument(
        "--skus",
        nargs="+",
        default=None,
        help="Optional list of SKU IDs to filter (e.g. --skus SKU-001 SKU-002)",
    )
    args = parser.parse_args()

    counts = seed_database_from_csv(
        csv_path=args.csv,
        stores=args.stores,
        skus=args.skus,
    )
    print("\n[SUCCESS] Ingestion completed successfully!")
    for tbl, cnt in counts.items():
        print(f"  - {tbl}: {cnt} rows")
