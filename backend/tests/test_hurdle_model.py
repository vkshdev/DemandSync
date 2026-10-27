import numpy as np
import polars as pl
import pytest
from app.ml.hurdle_model import HurdleIntermittentForecaster


def test_hurdle_forecaster_fit_and_predict_intermittent():
    """Validates two-stage hurdle forecasting on sparse zero-inflated demand."""
    np.random.seed(42)
    n_samples = 60

    # 70% zeros, 30% positive demand around 15.0
    is_positive = (np.random.rand(n_samples) > 0.70).astype(float)
    demand_qty = is_positive * np.random.normal(15.0, 3.0, n_samples)
    demand_qty = np.maximum(0.0, demand_qty)

    df = pl.DataFrame({
        "sales": demand_qty,
        "price": [19.99] * n_samples,
        "day_of_week": [(i % 7) + 1 for i in range(n_samples)],
        "promo_active": [1 if i % 10 == 0 else 0 for i in range(n_samples)],
        "temperature_celsius": [22.0] * n_samples,
    })

    model = HurdleIntermittentForecaster(n_estimators=30)
    fit_res = model.fit(df, target_col="sales")

    assert model.is_fitted
    assert "positive_rate" in fit_res
    assert 0.0 < fit_res["positive_rate"] < 0.6

    preds = model.predict(df)
    assert "p10" in preds and "p50" in preds and "p90" in preds
    assert len(preds["p50"]) == n_samples

    p10 = np.array(preds["p10"])
    p50 = np.array(preds["p50"])
    p90 = np.array(preds["p90"])

    # 1. Non-negativity constraint
    assert (p10 >= 0.0).all()
    assert (p50 >= 0.0).all()
    assert (p90 >= 0.0).all()

    # 2. Monotonic non-crossing quantile constraint: p10 <= p50 <= p90
    assert (p10 <= p50 + 1e-5).all()
    assert (p50 <= p90 + 1e-5).all()


def test_hurdle_forecaster_all_zero_series():
    """Validates clean handling when demand series is entirely zero."""
    n_samples = 30
    df = pl.DataFrame({
        "sales": [0.0] * n_samples,
        "price": [10.0] * n_samples,
        "day_of_week": [(i % 7) + 1 for i in range(n_samples)],
    })

    model = HurdleIntermittentForecaster(n_estimators=20)
    model.fit(df, target_col="sales")
    preds = model.predict(df)

    assert all(v == 0.0 for v in preds["p10"])
    assert all(v == 0.0 for v in preds["p50"])
    assert all(v == 0.0 for v in preds["p90"])
