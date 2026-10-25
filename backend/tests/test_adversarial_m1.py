import datetime
import pytest
import polars as pl
import duckdb

from tests.conftest import (
    make_mock_sales_df as generate_synthetic_retail_dataset,
    make_mock_stores_df as generate_stores_metadata,
    make_mock_products_df as generate_products_metadata,
)
from app.ml.feature_pipeline import (
    build_feature_matrix,
    FEATURE_SCHEMA,
)
from app.core.database import DuckDBManager


# =====================================================================
# 1. BOUNDARY CONDITIONS
# =====================================================================

def test_dataset_generator_zero_and_negative_inputs():
    """Verify that dataset generator rejects zero and negative parameter counts."""
    # Stores
    with pytest.raises(ValueError, match="n_stores must be positive"):
        generate_synthetic_retail_dataset(n_stores=0, n_skus=5, days=30)
    with pytest.raises(ValueError, match="n_stores must be positive"):
        generate_synthetic_retail_dataset(n_stores=-1, n_skus=5, days=30)

    # SKUs
    with pytest.raises(ValueError, match="n_skus must be positive"):
        generate_synthetic_retail_dataset(n_stores=2, n_skus=0, days=30)
    with pytest.raises(ValueError, match="n_skus must be positive"):
        generate_synthetic_retail_dataset(n_stores=2, n_skus=-5, days=30)

    # Days
    with pytest.raises(ValueError, match="days must be positive"):
        generate_synthetic_retail_dataset(n_stores=2, n_skus=2, days=0)
    with pytest.raises(ValueError, match="days must be positive"):
        generate_synthetic_retail_dataset(n_stores=2, n_skus=2, days=-10)

    # Metadata generators
    with pytest.raises(ValueError, match="n_stores must be positive"):
        generate_stores_metadata(n_stores=0)
    with pytest.raises(ValueError, match="n_skus must be positive"):
        generate_products_metadata(n_skus=0)


def test_dataset_generator_single_day_range():
    """Verify generator behavior at 1-day boundary condition."""
    df = generate_synthetic_retail_dataset(n_stores=2, n_skus=3, days=1, seed=42)
    assert df.height == 6, f"Expected 2*3*1=6 rows, got {df.height}"
    assert df["sales"].min() >= 0.0, "Sales must be non-negative"
    assert df["discount_pct"].min() >= 0.0
    assert df["discount_pct"].max() <= 0.301
    assert set(df["promo_active"].unique().to_list()).issubset({0, 1})
    assert set(df["extreme_weather_flag"].unique().to_list()).issubset({0, 1})


def test_dataset_generator_high_store_and_sku_counts():
    """Verify that high store count (>5) and high SKU count (>15) dynamically synthesize profiles."""
    n_stores = 12
    n_skus = 25
    days = 5
    df = generate_synthetic_retail_dataset(n_stores=n_stores, n_skus=n_skus, days=days, seed=99)
    assert df.height == n_stores * n_skus * days
    assert df["store_id"].n_unique() == n_stores
    assert df["sku_id"].n_unique() == n_skus

    # Verify metadata generation for high counts
    store_meta = generate_stores_metadata(n_stores=n_stores)
    assert store_meta.height == n_stores
    assert store_meta["store_id"].n_unique() == n_stores

    sku_meta = generate_products_metadata(n_skus=n_skus)
    assert sku_meta.height == n_skus
    assert sku_meta["sku_id"].n_unique() == n_skus


def test_feature_pipeline_single_day_boundary():
    """Verify that feature pipeline handles single-day inputs without crashing or returning NaNs."""
    df = generate_synthetic_retail_dataset(n_stores=2, n_skus=2, days=1, seed=123)
    feat_df = build_feature_matrix(df, drop_burn_in=False)
    assert feat_df.height == 4

    # All lags and rolling stats should be filled with 0.0, not NaN or null
    for lag_col in ["sales_lag_1", "sales_lag_7", "sales_lag_14", "sales_lag_28"]:
        assert feat_df[lag_col].null_count() == 0, f"{lag_col} has unexpected nulls"
        assert (feat_df[lag_col] == 0.0).all(), f"{lag_col} on day 1 should be 0.0"

    for roll_col in ["sales_roll_mean_7", "sales_roll_std_7", "sales_roll_mean_28", "sales_roll_min_7", "sales_roll_max_7"]:
        assert feat_df[roll_col].null_count() == 0, f"{roll_col} has unexpected nulls"
        assert (feat_df[roll_col] == 0.0).all(), f"{roll_col} on day 1 should be 0.0"


def test_feature_pipeline_drop_burn_in_boundary():
    """Verify that drop_burn_in=True drops exactly the first 28 days per store-sku."""
    days = 35
    df = generate_synthetic_retail_dataset(n_stores=1, n_skus=1, days=days, seed=42)
    feat_burned = build_feature_matrix(df, drop_burn_in=True)
    expected_rows = days - 28
    assert feat_burned.height == expected_rows, f"Expected {expected_rows} rows after burn-in drop, got {feat_burned.height}"


# =====================================================================
# 2. DATA LEAKAGE VERIFICATION
# =====================================================================

def test_feature_pipeline_strictly_zero_temporal_leakage():
    """Adversarially inject an extreme sales shock at day T.
    Verify that NO feature at t <= T reflects the shock at day T.
    """
    days = 40
    shock_day = 20
    base_date = datetime.date(2024, 1, 1)
    dates = [base_date + datetime.timedelta(days=d) for d in range(days)]

    # Flat sales of 10.0 with extreme shock of 1,000,000.0 on shock_day
    sales = [10.0] * days
    sales[shock_day] = 1_000_000.0

    df = pl.DataFrame({
        "date": dates,
        "store_id": ["STORE-001"] * days,
        "sku_id": ["SKU-001"] * days,
        "sales": sales,
        "price": [20.0] * days,
        "discount_pct": [0.0] * days,
        "promo_active": [0] * days,
        "temperature_celsius": [15.0] * days,
        "precipitation_mm": [0.0] * days,
        "extreme_weather_flag": [0] * days,
    })

    feat = build_feature_matrix(df, drop_burn_in=False).sort("date")

    # At shock_day (index shock_day):
    # sales_lag_1 must be sales[shock_day - 1] = 10.0
    # sales_roll_mean_7 must be 10.0 (NOT influenced by 1,000,000)
    # sales_roll_max_7 must be 10.0
    row_t = feat.filter(pl.col("date") == dates[shock_day])
    assert row_t["sales_lag_1"].item() == pytest.approx(10.0), "Temporal leakage: lag_1 saw shock on shock day"
    assert row_t["sales_roll_mean_7"].item() == pytest.approx(10.0), "Temporal leakage: roll_mean_7 saw shock on shock day"
    assert row_t["sales_roll_max_7"].item() == pytest.approx(10.0), "Temporal leakage: roll_max_7 saw shock on shock day"

    # Only at shock_day + 1 should lag_1 and rolling stats reflect the shock
    row_t_plus_1 = feat.filter(pl.col("date") == dates[shock_day + 1])
    assert row_t_plus_1["sales_lag_1"].item() == pytest.approx(1_000_000.0), "lag_1 should see shock on day T+1"
    assert row_t_plus_1["sales_roll_max_7"].item() == pytest.approx(1_000_000.0), "roll_max_7 should see shock on day T+1"


# =====================================================================
# 3. ENTITY ISOLATION VERIFICATION
# =====================================================================

def test_feature_pipeline_store_entity_isolation():
    """Verify that STORE-001 data never leaks into STORE-002, even with interleaved/shuffled rows."""
    days = 10
    base_date = datetime.date(2024, 1, 1)
    dates = [base_date + datetime.timedelta(days=d) for d in range(days)]

    # Store 1 has massive sales, Store 2 has minimal sales
    rows_s1 = [{
        "date": dates[d],
        "store_id": "STORE-001",
        "sku_id": "SKU-001",
        "sales": 50000.0 + d,
        "price": 10.0,
        "discount_pct": 0.0,
        "promo_active": 0,
        "temperature_celsius": 20.0,
        "precipitation_mm": 0.0,
        "extreme_weather_flag": 0,
    } for d in range(days)]

    rows_s2 = [{
        "date": dates[d],
        "store_id": "STORE-002",
        "sku_id": "SKU-001",
        "sales": 1.0,
        "price": 10.0,
        "discount_pct": 0.0,
        "promo_active": 0,
        "temperature_celsius": 20.0,
        "precipitation_mm": 0.0,
        "extreme_weather_flag": 0,
    } for d in range(days)]

    # Interleave rows to test sorting and grouping robustness
    interleaved = []
    for r1, r2 in zip(rows_s1, rows_s2):
        interleaved.extend([r2, r1])

    df = pl.DataFrame(interleaved)
    feat = build_feature_matrix(df)

    s2_feats = feat.filter(pl.col("store_id") == "STORE-002").sort("date")
    for lag_val in s2_feats["sales_lag_1"].to_list():
        assert lag_val in (0.0, 1.0), f"Entity contamination: STORE-002 lag_1 was {lag_val}, expected 0.0 or 1.0"

    for mean_val in s2_feats["sales_roll_mean_7"].to_list():
        assert mean_val in (0.0, 1.0), f"Entity contamination: STORE-002 roll_mean_7 was {mean_val}, expected 0.0 or 1.0"


def test_feature_pipeline_sku_entity_isolation():
    """Verify that SKU-001 sales never leak into SKU-002 within the same store."""
    days = 10
    base_date = datetime.date(2024, 1, 1)
    dates = [base_date + datetime.timedelta(days=d) for d in range(days)]

    rows_k1 = [{
        "date": dates[d],
        "store_id": "STORE-001",
        "sku_id": "SKU-001",
        "sales": 9999.0,
        "price": 10.0,
        "discount_pct": 0.0,
        "promo_active": 0,
        "temperature_celsius": 20.0,
        "precipitation_mm": 0.0,
        "extreme_weather_flag": 0,
    } for d in range(days)]

    rows_k2 = [{
        "date": dates[d],
        "store_id": "STORE-001",
        "sku_id": "SKU-002",
        "sales": 5.0,
        "price": 10.0,
        "discount_pct": 0.0,
        "promo_active": 0,
        "temperature_celsius": 20.0,
        "precipitation_mm": 0.0,
        "extreme_weather_flag": 0,
    } for d in range(days)]

    df = pl.DataFrame(rows_k1 + rows_k2)
    feat = build_feature_matrix(df)

    k2_feats = feat.filter(pl.col("sku_id") == "SKU-002").sort("date")
    for lag_val in k2_feats["sales_lag_1"].to_list():
        assert lag_val in (0.0, 5.0), f"Entity contamination: SKU-002 lag_1 was {lag_val}"
    for mean_val in k2_feats["sales_roll_mean_7"].to_list():
        assert mean_val in (0.0, 5.0), f"Entity contamination: SKU-002 roll_mean_7 was {mean_val}"


# =====================================================================
# 4. DUCKDB SCHEMA CONSTRAINTS AND TABLE INSERTION EDGE CASES
# =====================================================================

def test_duckdb_schema_isolation_and_primary_key_preservation():
    """Adversarial check: Test whether precomputed_features schema supports
    appending DataFrame produced by build_feature_matrix without binder errors,
    and whether mode='replace' destroys DDL constraints.
    """
    db = DuckDBManager(":memory:")
    db.initialize()

    # 1. Historical sales insertion and primary key check
    raw_df = generate_synthetic_retail_dataset(n_stores=2, n_skus=2, days=5, seed=42)
    db.save_historical_sales(raw_df, mode="append")

    # Attempt duplicate insert under mode='append' -> MUST fail with primary key violation
    with pytest.raises(duckdb.ConstraintException):
        db.save_historical_sales(raw_df, mode="append")

    # 2. Feature matrix insertion
    feat_df = build_feature_matrix(raw_df)

    # Check whether 'price' is in feat_df
    assert "price" in feat_df.columns

    # Verify table column names in precomputed_features
    with db.cursor() as cur:
        cols_info = cur.execute("PRAGMA table_info('precomputed_features')").fetchall()
        col_names = [r[1] for r in cols_info]

    # Verify precomputed_features schema has 'price'
    assert "price" in col_names, "precomputed_features schema must include price column"

    # Verify mode='append' succeeds with feature matrix
    inserted = db.save_precomputed_features(feat_df, mode="append")
    assert inserted == feat_df.height

    # Duplicate insert under mode='append' must fail with primary key violation
    with pytest.raises(duckdb.ConstraintException):
        db.save_precomputed_features(feat_df, mode="append")

    # Check what happens under mode='replace':
    replaced = db.save_precomputed_features(feat_df, mode="replace")
    assert replaced == feat_df.height

    # After mode='replace', check if primary key constraint survived:
    with db.cursor() as cur:
        cols_info_after = cur.execute("PRAGMA table_info('precomputed_features')").fetchall()
        # In PRAGMA table_info, column 5 is pk (1 if primary key, 0 if not)
        pk_flags = [r[5] for r in cols_info_after]
        has_pk = any(pk > 0 for pk in pk_flags)

    assert has_pk, "Primary key constraint must be preserved after mode='replace'"

    # Duplicate insert after mode='replace' must still fail with primary key violation
    with pytest.raises(duckdb.ConstraintException):
        db.save_precomputed_features(feat_df, mode="append")

    # Verify secondary index survived mode='replace'
    with db.cursor() as cur:
        idx_info = cur.execute(
            "SELECT index_name FROM duckdb_indexes() WHERE table_name = 'precomputed_features'"
        ).fetchall()
        idx_names = [r[0] for r in idx_info]

    assert "idx_features_sku_date" in idx_names, "Secondary index must survive mode='replace'"


def test_duckdb_empty_dataframe_inserts():
    """Verify that inserting empty DataFrame does not crash and leaves tables intact."""
    db = DuckDBManager(":memory:")
    db.initialize()

    empty_df = pl.DataFrame(schema=FEATURE_SCHEMA)
    inserted = db.save_precomputed_features(empty_df, mode="append")
    assert inserted == 0

    inserted_sales = db.save_historical_sales(pl.DataFrame(schema={
        "date": pl.Date, "store_id": pl.String, "sku_id": pl.String,
        "sales": pl.Float64, "price": pl.Float64, "discount_pct": pl.Float64,
        "promo_active": pl.Int32, "temperature_celsius": pl.Float64,
        "precipitation_mm": pl.Float64, "extreme_weather_flag": pl.Int32
    }), mode="append")
    assert inserted_sales == 0


def test_duckdb_table_whitelist_and_mode_validation():
    """Verify that insert_dataframe rejects unauthorized table names and invalid modes."""
    db = DuckDBManager(":memory:")
    db.initialize()
    df = pl.DataFrame({"store_id": ["STORE-001"]})

    with pytest.raises(ValueError, match="whitelist"):
        db.insert_dataframe("unauthorized_table", df, mode="append")

    with pytest.raises(ValueError, match="Unsupported insert mode"):
        db.insert_dataframe("stores", df, mode="invalid_mode")


def test_duckdb_upsert_mode():
    """Verify that upsert mode properly updates non-PK columns on conflict."""
    db = DuckDBManager(":memory:")
    db.initialize()

    store_df = pl.DataFrame({
        "store_id": ["S1"],
        "store_name": ["Store One"],
        "region": ["North"],
        "store_type": ["Urban"],
        "square_footage": [1000],
    })
    db.save_stores(store_df, mode="upsert")

    updated_df = pl.DataFrame({
        "store_id": ["S1"],
        "store_name": ["Store One Updated"],
        "region": ["North"],
        "store_type": ["Urban"],
        "square_footage": [1500],
    })
    db.save_stores(updated_df, mode="upsert")

    res = db.get_stores()
    assert res.height == 1
    assert res["store_name"][0] == "Store One Updated"
    assert res["square_footage"][0] == 1500


def test_duckdb_uninitialized_insert_deadlock_free():
    """Verify that calling insert_dataframe or save_stores on an uninitialized
    DuckDBManager instance executes cleanly without deadlocking."""
    db = DuckDBManager(":memory:")
    assert not db._is_initialized
    assert db._conn is None

    store_df = pl.DataFrame({
        "store_id": ["STORE-001"],
        "store_name": ["Flagship"],
        "region": ["Midwest"],
        "store_type": ["Urban"],
        "square_footage": [10000],
    })
    inserted = db.save_stores(store_df, mode="append")
    assert inserted == 1
    assert db._is_initialized

    res = db.get_stores()
    assert res.height == 1
    assert res["store_id"][0] == "STORE-001"

    db2 = DuckDBManager(":memory:")
    assert not db2._is_initialized
    inserted2 = db2.insert_dataframe("stores", store_df, mode="append")
    assert inserted2 == 1
    assert db2._is_initialized
    res2 = db2.get_stores()
    assert res2.height == 1


