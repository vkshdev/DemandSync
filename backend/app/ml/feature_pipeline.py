import polars as pl

FEATURE_SCHEMA = {
    "date": pl.Date,
    "store_id": pl.String,
    "sku_id": pl.String,
    "sales": pl.Float64,
    "price": pl.Float64,
    "discount_pct": pl.Float64,
    "promo_active": pl.Int32,
    "temperature_celsius": pl.Float64,
    "precipitation_mm": pl.Float64,
    "extreme_weather_flag": pl.Int32,
    "day_of_week": pl.Int32,
    "day_of_month": pl.Int32,
    "month": pl.Int32,
    "is_weekend": pl.Int32,
    "sales_lag_1": pl.Float64,
    "sales_lag_7": pl.Float64,
    "sales_lag_14": pl.Float64,
    "sales_lag_28": pl.Float64,
    "sales_roll_mean_7": pl.Float64,
    "sales_roll_std_7": pl.Float64,
    "sales_roll_mean_28": pl.Float64,
    "sales_roll_min_7": pl.Float64,
    "sales_roll_max_7": pl.Float64,
}


def _rolling(col: pl.Expr, method: str, window: int, min_periods: int) -> pl.Expr:
    fn = getattr(col, f"rolling_{method}")
    try:
        return fn(window_size=window, min_samples=min_periods)
    except (TypeError, AttributeError):
        return fn(window_size=window, min_periods=min_periods)


def build_feature_matrix(
    df: pl.DataFrame,
    drop_burn_in: bool = False
) -> pl.DataFrame:
    """Builds tabular feature matrix with zero temporal leakage."""
    if df.is_empty():
        return pl.DataFrame(schema=FEATURE_SCHEMA)

    res = df.sort(["store_id", "sku_id", "date"])

    if res.schema.get("date") != pl.Date:
        if res.schema.get("date") in (pl.String, pl.Categorical):
            res = res.with_columns(pl.col("date").str.to_date(strict=False))
        else:
            try:
                res = res.with_columns(pl.col("date").cast(pl.Date))
            except Exception:
                res = res.with_columns(pl.col("date").str.to_date(strict=False))

    res = res.with_columns(pl.col("sales").cast(pl.Float64))

    calendar_exprs = [
        pl.col("date").dt.weekday().cast(pl.Int32).alias("day_of_week"),
        pl.col("date").dt.day().cast(pl.Int32).alias("day_of_month"),
        pl.col("date").dt.month().cast(pl.Int32).alias("month"),
        (pl.col("date").dt.weekday() >= 6).cast(pl.Int32).alias("is_weekend"),
    ]

    lag_exprs = [
        pl.col("sales")
        .shift(lag)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias(f"sales_lag_{lag}")
        for lag in [1, 7, 14, 28]
    ]

    # Pre-shift sales by 1 day to strictly exclude target y_t from rolling statistics
    res = res.with_columns(
        pl.col("sales").shift(1).over(["store_id", "sku_id"]).alias("_sales_shifted")
    )

    rolling_exprs = [
        _rolling(pl.col("_sales_shifted"), "mean", 7, 1)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias("sales_roll_mean_7"),

        _rolling(pl.col("_sales_shifted"), "std", 7, 2)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias("sales_roll_std_7"),

        _rolling(pl.col("_sales_shifted"), "mean", 28, 1)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias("sales_roll_mean_28"),

        _rolling(pl.col("_sales_shifted"), "min", 7, 1)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias("sales_roll_min_7"),

        _rolling(pl.col("_sales_shifted"), "max", 7, 1)
        .over(["store_id", "sku_id"])
        .fill_null(0.0)
        .alias("sales_roll_max_7"),
    ]

    res = res.with_columns(calendar_exprs + lag_exprs + rolling_exprs)

    if drop_burn_in:
        res = res.filter(
            pl.col("sales").shift(28).over(["store_id", "sku_id"]).is_not_null()
        )

    res = res.drop("_sales_shifted")
    feature_cols = [c for c in FEATURE_SCHEMA.keys() if c in res.columns]
    return res.select(feature_cols)
