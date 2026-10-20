from typing import Any, Dict, List, Optional, Union
import numpy as np

try:
    import polars as pl
except ImportError:
    pl = None

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import shap
except ImportError:
    shap = None


def _extract_p50_model(forecaster: Any) -> Any:
    if hasattr(forecaster, "model_p50"):
        model = getattr(forecaster, "model_p50")
        if model is not None:
            return model

    if hasattr(forecaster, "get_p50_model") and callable(forecaster.get_p50_model):
        try:
            model = forecaster.get_p50_model()
            if model is not None:
                return model
        except Exception:
            pass

    if hasattr(forecaster, "get_model") and callable(forecaster.get_model):
        try:
            model = forecaster.get_model("p50")
            if model is not None:
                return model
        except Exception:
            pass

    if hasattr(forecaster, "models") and isinstance(forecaster.models, dict):
        for key in ("p50", "P50", 0.50, 0.5, "0.50", "0.5"):
            if key in forecaster.models and forecaster.models[key] is not None:
                return forecaster.models[key]

    for attr in ("p50_model", "median_model", "p50"):
        if hasattr(forecaster, attr):
            model = getattr(forecaster, attr)
            if model is not None:
                return model

    if hasattr(forecaster, "predict") and hasattr(forecaster, "fit"):
        return forecaster

    raise ValueError("Unable to extract median (P50) LightGBM model from forecaster")


def _resolve_feature_names(forecaster: Any, p50_model: Any, input_df: Any) -> List[str]:
    for attr in ("feature_names", "feature_cols", "features"):
        if hasattr(forecaster, attr):
            names = getattr(forecaster, attr)
            if isinstance(names, (list, tuple)) and len(names) > 0:
                return list(names)

    if hasattr(p50_model, "feature_name_"):
        names = getattr(p50_model, "feature_name_")
        if names is not None and len(names) > 0:
            return list(names)

    booster = getattr(p50_model, "booster_", None)
    if booster is not None and hasattr(booster, "feature_name") and callable(booster.feature_name):
        try:
            names = booster.feature_name()
            if names and len(names) > 0:
                return list(names)
        except Exception:
            pass

    excluded = {"date", "store_id", "sku_id", "sales"}
    if pl is not None and isinstance(input_df, pl.DataFrame):
        numeric_types = (
            pl.Float64, pl.Float32,
            pl.Int64, pl.Int32, pl.Int16, pl.Int8,
            pl.UInt64, pl.UInt32, pl.UInt16, pl.UInt8,
            pl.Boolean,
        )
        return [
            col for col, dtype in input_df.schema.items()
            if col not in excluded and dtype in numeric_types
        ]

    if hasattr(input_df, "columns"):
        return [col for col in input_df.columns if col not in excluded]

    raise ValueError("Unable to determine feature names for TreeSHAP explainer")


def _prepare_matrix(
    feature_df: Any,
    feature_names: List[str]
) -> tuple[np.ndarray, List[str]]:
    if pl is not None and isinstance(feature_df, pl.DataFrame):
        if feature_df.is_empty():
            return np.empty((0, len(feature_names)), dtype=np.float64), feature_names

        exprs = []
        for col_name in feature_names:
            if col_name in feature_df.columns:
                exprs.append(pl.col(col_name).cast(pl.Float64, strict=False).fill_null(0.0))
            else:
                exprs.append(pl.lit(0.0).alias(col_name))

        x_df = feature_df.select(exprs)
        return x_df.to_numpy().astype(np.float64), feature_names

    if hasattr(feature_df, "columns"):
        cols_data = []
        for col_name in feature_names:
            if col_name in feature_df.columns:
                col_vals = np.nan_to_num(np.asarray(feature_df[col_name], dtype=np.float64), nan=0.0)
            else:
                col_vals = np.zeros(len(feature_df), dtype=np.float64)
            cols_data.append(col_vals)
        if cols_data:
            return np.column_stack(cols_data), feature_names
        return np.empty((len(feature_df), 0), dtype=np.float64), feature_names

    mat = np.asarray(feature_df, dtype=np.float64)
    if mat.ndim == 1:
        mat = np.expand_dims(mat, axis=0)
    return mat, feature_names


class TreeShapExplainer:
    def __init__(self, forecaster: Any, top_n: Optional[int] = None) -> None:
        self.forecaster = forecaster
        self.default_top_n = top_n
        self._explainer: Optional[Any] = None
        self._cached_model_id: Optional[int] = None

    def _get_explainer(self, p50_model: Any) -> Any:
        if shap is None:
            raise ImportError("The 'shap' package is required for TreeShapExplainer")

        current_id = id(p50_model)
        if self._explainer is None or self._cached_model_id != current_id:
            try:
                self._explainer = shap.TreeExplainer(p50_model)
            except Exception:
                booster = getattr(p50_model, "booster_", p50_model)
                self._explainer = shap.TreeExplainer(booster)
            self._cached_model_id = current_id
        return self._explainer

    def explain(
        self,
        feature_df: Any,
        top_n: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        p50_model = _extract_p50_model(self.forecaster)
        feature_names = _resolve_feature_names(self.forecaster, p50_model, feature_df)
        x_mat, active_names = _prepare_matrix(feature_df, feature_names)

        n_samples = x_mat.shape[0]
        if n_samples == 0:
            return []

        explainer = self._get_explainer(p50_model)
        raw_shap = explainer.shap_values(x_mat)

        if isinstance(raw_shap, list):
            raw_shap = raw_shap[0]
        if isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 3:
            raw_shap = np.squeeze(raw_shap, axis=-1)
        if isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 1:
            raw_shap = np.expand_dims(raw_shap, axis=0)

        shap_matrix = np.asarray(raw_shap, dtype=np.float64)

        attributions: List[Dict[str, Any]] = []
        for idx, col_name in enumerate(active_names):
            if idx < shap_matrix.shape[1]:
                col_vals = shap_matrix[:, idx]
                mean_val = float(np.mean(col_vals))
                mean_val = float(np.nan_to_num(mean_val, nan=0.0, posinf=0.0, neginf=0.0))
            else:
                mean_val = 0.0

            attributions.append({
                "feature": col_name,
                "attribution_value": mean_val,
            })

        # Rank descending by absolute magnitude of attribution
        attributions.sort(key=lambda item: abs(item["attribution_value"]), reverse=True)

        effective_top_n = top_n if top_n is not None else self.default_top_n
        if effective_top_n is not None:
            if effective_top_n <= 0:
                return []
            attributions = attributions[:effective_top_n]

        return attributions


def explain_forecast(
    forecaster: Any,
    feature_df: Any,
    top_n: Optional[int] = None
) -> List[Dict[str, Any]]:
    explainer = TreeShapExplainer(forecaster)
    return explainer.explain(feature_df, top_n=top_n)


def format_impact_string(attribution_value: float, baseline: Optional[float] = None) -> str:
    if baseline is not None and baseline > 0.0:
        pct = (attribution_value / baseline) * 100.0
    else:
        pct = attribution_value * 100.0

    if pct >= 0.0:
        return f"+{abs(pct):.1f}% lift"
    return f"-{abs(pct):.1f}% drag"


def explain_with_impact(
    forecaster: Any,
    feature_df: Any,
    top_n: Optional[int] = None,
    baseline: Optional[float] = None,
) -> List[Dict[str, Any]]:
    attributions = explain_forecast(forecaster, feature_df, top_n=top_n)
    for item in attributions:
        item["impact"] = format_impact_string(item["attribution_value"], baseline=baseline)
    return attributions
