import os
import pytest
import polars as pl

from app.ml.dataset_loader import (
    load_retail_dataset,
    normalize_dataset_columns,
    extract_stores_metadata,
    extract_products_metadata,
    calculate_inventory_snapshots,
    seed_database_from_csv,
    resolve_csv_path,
)
from app.core.database import DuckDBManager


def test_normalize_dataset_columns():
    """Verify that Kaggle CSV column variants are properly mapped to canonical names."""
    raw_df = pl.DataFrame({
        "Date": ["2024-01-01"],
        "Store ID": ["STORE-001"],
        "Product ID": ["SKU-001"],
        "Units Sold": [15],
        "Inventory Level": [40],
        "Price": [29.99],
        "Discount": [0.10],
        "Weather Condition": ["Sunny"],
        "Holiday": [0],
        "Category": ["Apparel"],
        "Region": ["Midwest"],
    })
    norm = normalize_dataset_columns(raw_df)
    assert "date" in norm.columns
    assert "store_id" in norm.columns
    assert "sku_id" in norm.columns
    assert "sales" in norm.columns
    assert "current_stock" in norm.columns
    assert "price" in norm.columns
    assert "discount_pct" in norm.columns


def test_load_retail_dataset_default_csv():
    """Verify that default starter CSV loads with valid types and non-negative constraints."""
    df = load_retail_dataset()
    assert isinstance(df, pl.DataFrame)
    assert df.height > 0

    expected_cols = [
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
    ]
    for col in expected_cols:
        assert col in df.columns, f"Expected column {col} missing in loaded dataset"

    # Verify types and value ranges
    assert df.schema["date"] == pl.Date
    assert df.select(pl.col("sales").min()).item() >= 0.0
    assert df.select(pl.col("price").min()).item() > 0.0
    assert df.select(pl.col("discount_pct").min()).item() >= 0.0
    assert df.select(pl.col("discount_pct").max()).item() <= 1.0

    promos = set(df.select("promo_active").unique().to_series().to_list())
    assert promos.issubset({0, 1})


def test_load_retail_dataset_filtering():
    """Verify store and SKU filtering during dataset load."""
    full_df = load_retail_dataset()
    first_store = full_df["store_id"][0]
    first_sku = full_df["sku_id"][0]
    df = load_retail_dataset(stores=[first_store], skus=[first_sku])
    assert df.height > 0
    unique_stores = set(df.select("store_id").unique().to_series().to_list())
    unique_skus = set(df.select("sku_id").unique().to_series().to_list())
    assert unique_stores == {first_store}
    assert unique_skus == {first_sku}


def test_load_retail_dataset_missing_file_raises():
    """Verify FileNotFoundError when nonexistent CSV is requested."""
    with pytest.raises(FileNotFoundError):
        load_retail_dataset(csv_path="nonexistent_folder/missing_dataset.csv")


def test_extract_stores_metadata():
    """Verify store dimension extraction from sales dataset."""
    df = load_retail_dataset()
    stores_df = extract_stores_metadata(df)
    assert "store_id" in stores_df.columns
    assert "store_name" in stores_df.columns
    assert "region" in stores_df.columns
    assert "store_type" in stores_df.columns
    assert "square_footage" in stores_df.columns
    assert stores_df.height >= 1


def test_extract_products_metadata():
    """Verify product dimension extraction with derived unit costs and lead times."""
    df = load_retail_dataset()
    products_df = extract_products_metadata(df)
    assert "sku_id" in products_df.columns
    assert "sku_name" in products_df.columns
    assert "unit_cost" in products_df.columns
    assert "retail_price" in products_df.columns
    assert "lead_time_days" in products_df.columns
    assert "min_order_qty" in products_df.columns

    for row in products_df.iter_rows(named=True):
        assert row["unit_cost"] < row["retail_price"], "Wholesale cost must be below retail price"
        assert row["lead_time_days"] > 0
        assert row["min_order_qty"] >= 1


def test_calculate_inventory_snapshots():
    """Verify that inventory engine calculations populate snapshots correctly."""
    df = load_retail_dataset()
    products_df = extract_products_metadata(df)
    snapshots_df = calculate_inventory_snapshots(df, products_df)

    expected_cols = [
        "store_id",
        "sku_id",
        "current_stock",
        "mean_daily_demand",
        "std_daily_demand",
        "safety_stock",
        "reorder_point",
        "economic_order_qty",
        "is_breached",
        "stockout_risk_pct",
        "projected_stockout_loss_usd",
    ]
    for col in expected_cols:
        assert col in snapshots_df.columns

    for row in snapshots_df.iter_rows(named=True):
        assert row["safety_stock"] >= 0
        assert row["reorder_point"] >= row["safety_stock"]
        assert row["economic_order_qty"] >= 1
        assert 0.0 <= row["stockout_risk_pct"] <= 100.0


def test_seed_database_from_csv():
    """Verify full end-to-end ingestion into an in-memory DuckDB manager."""
    db = DuckDBManager(db_path=":memory:")
    counts = seed_database_from_csv(db_manager=db)

    assert counts["stores"] > 0
    assert counts["products"] > 0
    assert counts["historical_sales"] > 0
    assert counts["inventory_snapshots"] > 0
    assert counts["precomputed_features"] > 0

    alerts = db.get_inventory_alerts()
    assert isinstance(alerts, list)
    db.close()
