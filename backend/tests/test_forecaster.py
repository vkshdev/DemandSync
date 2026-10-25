import numpy as np
import pytest

try:
    import polars as pl
except ImportError:
    pl = None


def test_pinball_loss_formula_exact_math():
    """Validates mathematical correctness of quantile pinball loss."""
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    loss_fn = getattr(forecaster_mod, "evaluate_pinball_loss", None)
    if loss_fn is None:
        forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)
        assert forecaster_cls is not None, "forecaster module must define evaluate_pinball_loss or QuantileForecaster"
        loss_fn = getattr(forecaster_cls, "evaluate_pinball_loss", None)

    assert loss_fn is not None, "Pinball loss evaluation function must exist"

    # Perfect prediction: loss must be 0
    y_true = np.array([10.0, 20.0, 30.0])
    y_pred = np.array([10.0, 20.0, 30.0])
    assert loss_fn(y_true, y_pred, alpha=0.50) == pytest.approx(0.0)

    # Under-prediction: y_true > y_pred, error is positive (e.g. true=15, pred=10, diff=5)
    # alpha=0.90 -> loss = 0.90 * 5.0 = 4.5
    y_true_under = np.array([15.0])
    y_pred_under = np.array([10.0])
    assert loss_fn(y_true_under, y_pred_under, alpha=0.90) == pytest.approx(4.5)

    # Over-prediction: y_true < y_pred, diff = -5
    # alpha=0.10 -> loss = (1 - 0.10) * 5.0 = 4.5
    y_true_over = np.array([10.0])
    y_pred_over = np.array([15.0])
    assert loss_fn(y_true_over, y_pred_over, alpha=0.10) == pytest.approx(4.5)


def test_forecaster_train_returns_pinball_losses(sample_feature_matrix):
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)
    if forecaster_cls is None:
        train_fn = getattr(forecaster_mod, "train_forecaster", None)
        assert train_fn is not None, "Forecaster class or train function required"
        losses = train_fn(sample_feature_matrix)
    else:
        model = forecaster_cls()
        losses = model.train(sample_feature_matrix)

    assert isinstance(losses, dict), "train() must return a dictionary of losses"
    for q in ["p10", "p50", "p90"]:
        assert q in losses, f"Loss dictionary must contain key {q}"
        assert losses[q] >= 0.0, f"Pinball loss for {q} must be non-negative"


def test_forecaster_predict_structure_and_types(sample_feature_matrix):
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)
    if forecaster_cls is None:
        train_fn = getattr(forecaster_mod, "train_forecaster")
        predict_fn = getattr(forecaster_mod, "predict_forecaster")
        model = train_fn(sample_feature_matrix)
        preds = predict_fn(model, sample_feature_matrix)
    else:
        model = forecaster_cls()
        model.train(sample_feature_matrix)
        preds = model.predict(sample_feature_matrix)

    assert isinstance(preds, dict), "predict() must return a dictionary"
    assert "p10" in preds and "p50" in preds and "p90" in preds
    n_rows = sample_feature_matrix.height
    assert len(preds["p10"]) == n_rows
    assert len(preds["p50"]) == n_rows
    assert len(preds["p90"]) == n_rows


def test_forecaster_monotonic_clamping(sample_feature_matrix):
    """Guarantees p10 <= p50 <= p90 everywhere (monotonic non-crossing constraint)."""
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)
    if forecaster_cls is None:
        train_fn = getattr(forecaster_mod, "train_forecaster")
        predict_fn = getattr(forecaster_mod, "predict_forecaster")
        model = train_fn(sample_feature_matrix)
        preds = predict_fn(model, sample_feature_matrix)
    else:
        model = forecaster_cls()
        model.train(sample_feature_matrix)
        preds = model.predict(sample_feature_matrix)

    p10 = np.array(preds["p10"])
    p50 = np.array(preds["p50"])
    p90 = np.array(preds["p90"])

    assert (p10 <= p50 + 1e-5).all(), "Quantile crossing: p10 must be <= p50 for all timesteps"
    assert (p50 <= p90 + 1e-5).all(), "Quantile crossing: p50 must be <= p90 for all timesteps"


def test_forecaster_non_negative_predictions(sample_feature_matrix):
    """Ensures retail demand forecasts are strictly non-negative."""
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)
    if forecaster_cls is None:
        train_fn = getattr(forecaster_mod, "train_forecaster")
        predict_fn = getattr(forecaster_mod, "predict_forecaster")
        model = train_fn(sample_feature_matrix)
        preds = predict_fn(model, sample_feature_matrix)
    else:
        model = forecaster_cls()
        model.train(sample_feature_matrix)
        preds = model.predict(sample_feature_matrix)

    for q in ["p10", "p50", "p90"]:
        vals = np.array(preds[q])
        assert (vals >= 0.0).all(), f"Predictions for {q} must be >= 0.0"


def test_forecaster_intermittent_demand_handling():
    """Tests forecaster stability when series has sparse/intermittent zero sales."""
    forecaster_mod = pytest.importorskip("app.ml.forecaster")
    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster", None)

    # Synthetic intermittent matrix
    n_samples = 40
    data = {
        "sales": [0.0] * 32 + [5.0, 12.0, 0.0, 0.0, 8.0, 0.0, 0.0, 15.0],
        "day_of_week": [(i % 7) + 1 for i in range(n_samples)],
        "day_of_month": [(i % 28) + 1 for i in range(n_samples)],
        "month": [1] * n_samples,
        "is_weekend": [1 if (i % 7) in (5, 6) else 0 for i in range(n_samples)],
        "discount_pct": [0.0] * n_samples,
        "promo_active": [0] * n_samples,
        "temperature_celsius": [20.0] * n_samples,
        "precipitation_mm": [0.0] * n_samples,
        "extreme_weather_flag": [0] * n_samples,
        "sales_lag_1": [0.0] * n_samples,
        "sales_lag_7": [0.0] * n_samples,
        "sales_lag_14": [0.0] * n_samples,
        "sales_lag_28": [0.0] * n_samples,
        "sales_roll_mean_7": [1.0] * n_samples,
        "sales_roll_std_7": [0.5] * n_samples,
        "sales_roll_mean_28": [1.0] * n_samples,
        "sales_roll_min_7": [0.0] * n_samples,
        "sales_roll_max_7": [5.0] * n_samples,
    }
    df = pl.DataFrame(data)

    if forecaster_cls is not None:
        model = forecaster_cls()
        losses = model.train(df)
        preds = model.predict(df)
        assert losses["p50"] >= 0.0
        assert not np.isnan(preds["p50"]).any()
