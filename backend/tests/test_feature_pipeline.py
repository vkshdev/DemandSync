import pytest

try:
    import polars as pl
except ImportError:
    pl = None


def test_feature_pipeline_output_columns(sample_sales_df):
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix", None)
    assert build_fn is not None, "build_feature_matrix must be defined"

    feature_df = build_fn(sample_sales_df)
    assert isinstance(feature_df, pl.DataFrame), "Output must be a polars DataFrame"

    required_calendar = ["day_of_week", "day_of_month", "month", "is_weekend"]
    required_lags = ["sales_lag_1", "sales_lag_7", "sales_lag_14", "sales_lag_28"]
    required_rolling = [
        "sales_roll_mean_7", "sales_roll_std_7", "sales_roll_mean_28",
        "sales_roll_min_7", "sales_roll_max_7"
    ]

    for col in required_calendar + required_lags + required_rolling:
        assert col in feature_df.columns, f"Feature matrix missing required column {col}"


def test_feature_pipeline_no_temporal_leakage(sample_sales_df):
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix")

    feature_df = build_fn(sample_sales_df).sort(["store_id", "sku_id", "date"])

    # For a specific store and SKU, check that sales_lag_1 at row index 1 equals sales at row index 0
    sub_df = feature_df.filter((pl.col("store_id") == "STORE-001") & (pl.col("sku_id") == "SKU-001"))
    sales_series = sub_df["sales"].to_list()
    lag_1_series = sub_df["sales_lag_1"].to_list()

    assert len(sales_series) > 5
    for idx in range(1, len(sales_series)):
        assert lag_1_series[idx] == pytest.approx(sales_series[idx - 1], rel=1e-5), (
            f"Temporal leakage detected: sales_lag_1 at step {idx} ({lag_1_series[idx]}) "
            f"does not match previous step sales ({sales_series[idx - 1]})"
        )


def test_feature_pipeline_rolling_min_max_bounds(sample_sales_df):
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix")

    feature_df = build_fn(sample_sales_df)

    # Check min_7 <= mean_7 <= max_7 (with small numerical tolerance)
    sub = feature_df.filter(pl.col("sales_roll_min_7").is_not_null() & pl.col("sales_roll_max_7").is_not_null())
    mins = sub["sales_roll_min_7"].to_numpy()
    means = sub["sales_roll_mean_7"].to_numpy()
    maxs = sub["sales_roll_max_7"].to_numpy()

    assert (mins <= means + 1e-5).all(), "Rolling minimum must be less than or equal to rolling mean"
    assert (means <= maxs + 1e-5).all(), "Rolling mean must be less than or equal to rolling maximum"


def test_feature_pipeline_weekend_indicator(sample_sales_df):
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix")

    feature_df = build_fn(sample_sales_df)
    unique_weekend_vals = set(feature_df["is_weekend"].unique().to_list())
    assert unique_weekend_vals.issubset({0, 1}), f"is_weekend must contain only 0 or 1, got {unique_weekend_vals}"


def test_feature_pipeline_grouping_isolation():
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix")

    from datetime import date, timedelta
    dates = [date(2025, 1, 1) + timedelta(days=i) for i in range(10)]
    df = pl.DataFrame({
        "date": dates * 2,
        "store_id": ["STORE-A"] * 10 + ["STORE-B"] * 10,
        "sku_id": ["SKU-1"] * 20,
        "sales": [10.0] * 10 + [500.0] * 10,
        "price": [10.0] * 20,
        "discount_pct": [0.0] * 20,
        "promo_active": [0] * 20,
        "temperature_celsius": [20.0] * 20,
        "precipitation_mm": [0.0] * 20,
        "extreme_weather_flag": [0] * 20
    })

    result = build_fn(df)
    store_a_lags = result.filter(pl.col("store_id") == "STORE-A")["sales_lag_1"].to_list()
    assert all(val in (0.0, 10.0) for val in store_a_lags), "STORE-A lags must not leak STORE-B sales"


def test_feature_pipeline_cold_start_empty_df():
    pipeline_mod = pytest.importorskip("app.ml.feature_pipeline")
    build_fn = getattr(pipeline_mod, "build_feature_matrix")

    schema = {
        "date": pl.Date,
        "store_id": pl.Utf8,
        "sku_id": pl.Utf8,
        "sales": pl.Float64,
        "price": pl.Float64,
        "discount_pct": pl.Float64,
        "promo_active": pl.Int32,
        "temperature_celsius": pl.Float64,
        "precipitation_mm": pl.Float64,
        "extreme_weather_flag": pl.Int32
    }
    empty_df = pl.DataFrame(schema=schema)
    res = build_fn(empty_df)
    assert res.height == 0, "Empty dataframe should produce empty feature matrix without crashing"
