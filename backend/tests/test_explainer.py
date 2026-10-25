import numpy as np
import pytest

try:
    import polars as pl
except ImportError:
    pl = None


def test_explainer_extract_shap_attributions(sample_feature_matrix):
    explainer_mod = pytest.importorskip("app.ml.explainer")
    forecaster_mod = pytest.importorskip("app.ml.forecaster")

    forecaster_cls = getattr(forecaster_mod, "QuantileForecaster")
    forecaster = forecaster_cls()
    forecaster.train(sample_feature_matrix)

    explainer_cls = getattr(explainer_mod, "TreeShapExplainer", None)
    if explainer_cls is None:
        explain_fn = getattr(explainer_mod, "explain_forecast")
        attributions = explain_fn(forecaster, sample_feature_matrix)
    else:
        explainer = explainer_cls(forecaster)
        attributions = explainer.explain(sample_feature_matrix)

    assert isinstance(attributions, list), "TreeSHAP explanation must return a list of attributions"
    assert len(attributions) > 0, "Attribution list should not be empty"

    first_item = attributions[0]
    assert "feature" in first_item, "Attribution dict must contain 'feature'"
    assert "attribution_value" in first_item, "Attribution dict must contain 'attribution_value'"


def test_explainer_attributions_sorted_by_magnitude(sample_feature_matrix):
    explainer_mod = pytest.importorskip("app.ml.explainer")
    forecaster_mod = pytest.importorskip("app.ml.forecaster")

    forecaster = getattr(forecaster_mod, "QuantileForecaster")()
    forecaster.train(sample_feature_matrix)

    explainer_cls = getattr(explainer_mod, "TreeShapExplainer", None)
    if explainer_cls is None:
        explain_fn = getattr(explainer_mod, "explain_forecast")
        attributions = explain_fn(forecaster, sample_feature_matrix)
    else:
        explainer = explainer_cls(forecaster)
        attributions = explainer.explain(sample_feature_matrix)

    magnitudes = [abs(item["attribution_value"]) for item in attributions]
    # Check descending order
    for i in range(len(magnitudes) - 1):
        assert magnitudes[i] >= magnitudes[i + 1] - 1e-6, (
            f"TreeSHAP attributions must be sorted descending by magnitude: "
            f"{magnitudes[i]} < {magnitudes[i + 1]}"
        )


def test_explainer_zero_variance_feature():
    """Confirms TreeSHAP handles a constant (zero-variance) feature without division by zero."""
    explainer_mod = pytest.importorskip("app.ml.explainer")
    forecaster_mod = pytest.importorskip("app.ml.forecaster")

    n = 30
    df = pl.DataFrame({
        "sales": [float(i % 10) for i in range(n)],
        "constant_feature": [1.0] * n,
        "varying_feature": [float(i) for i in range(n)],
        "day_of_week": [(i % 7) + 1 for i in range(n)],
        "day_of_month": [(i % 28) + 1 for i in range(n)],
        "month": [1] * n,
        "is_weekend": [0] * n,
        "discount_pct": [0.0] * n,
        "promo_active": [0] * n,
        "temperature_celsius": [20.0] * n,
        "precipitation_mm": [0.0] * n,
        "extreme_weather_flag": [0] * n,
        "sales_lag_1": [0.0] * n,
        "sales_lag_7": [0.0] * n,
        "sales_lag_14": [0.0] * n,
        "sales_lag_28": [0.0] * n,
        "sales_roll_mean_7": [1.0] * n,
        "sales_roll_std_7": [0.5] * n,
        "sales_roll_mean_28": [1.0] * n,
        "sales_roll_min_7": [0.0] * n,
        "sales_roll_max_7": [5.0] * n,
    })

    forecaster = getattr(forecaster_mod, "QuantileForecaster")()
    forecaster.train(df)

    explainer_cls = getattr(explainer_mod, "TreeShapExplainer", None)
    if explainer_cls is None:
        explain_fn = getattr(explainer_mod, "explain_forecast")
        attributions = explain_fn(forecaster, df)
    else:
        explainer = explainer_cls(forecaster)
        attributions = explainer.explain(df)

    # Find the constant feature in attributions
    const_attr = next((item for item in attributions if item["feature"] == "constant_feature"), None)
    if const_attr is not None:
        assert not np.isnan(const_attr["attribution_value"])
        assert abs(const_attr["attribution_value"]) == pytest.approx(0.0, abs=1e-5)


def test_explainer_feature_names_integrity(sample_feature_matrix):
    explainer_mod = pytest.importorskip("app.ml.explainer")
    forecaster_mod = pytest.importorskip("app.ml.forecaster")

    forecaster = getattr(forecaster_mod, "QuantileForecaster")()
    forecaster.train(sample_feature_matrix)

    explainer_cls = getattr(explainer_mod, "TreeShapExplainer", None)
    if explainer_cls is None:
        explain_fn = getattr(explainer_mod, "explain_forecast")
        attributions = explain_fn(forecaster, sample_feature_matrix)
    else:
        explainer = explainer_cls(forecaster)
        attributions = explainer.explain(sample_feature_matrix)

    col_set = set(sample_feature_matrix.columns)
    for attr in attributions:
        assert attr["feature"] in col_set, f"Unknown feature {attr['feature']} in attributions"


def test_explainer_top_n_filtering(sample_feature_matrix):
    explainer_mod = pytest.importorskip("app.ml.explainer")
    forecaster_mod = pytest.importorskip("app.ml.forecaster")

    forecaster = getattr(forecaster_mod, "QuantileForecaster")()
    forecaster.train(sample_feature_matrix)

    explainer_cls = getattr(explainer_mod, "TreeShapExplainer", None)
    if explainer_cls is None:
        explain_fn = getattr(explainer_mod, "explain_forecast")
        attributions = explain_fn(forecaster, sample_feature_matrix, top_n=3)
    else:
        explainer = explainer_cls(forecaster)
        attributions = explainer.explain(sample_feature_matrix, top_n=3)

    assert len(attributions) <= 3, f"Expected at most 3 top drivers, got {len(attributions)}"
