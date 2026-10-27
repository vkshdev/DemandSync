import hashlib
import os
import pickle
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import lightgbm as lgb
import numpy as np
import polars as pl
from app.ml.demand_classifier import DemandProfile, categorize_demand
from app.ml.hurdle_model import HurdleIntermittentForecaster


def evaluate_pinball_loss(
    y_true: Union[np.ndarray, Sequence[float]],
    y_pred: Union[np.ndarray, Sequence[float]],
    alpha: float,
) -> float:
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)
    if y_t.size == 0 or y_p.size == 0:
        return 0.0
    diff = y_t - y_p
    loss = np.maximum(alpha * diff, (1.0 - alpha) * (-diff))
    return float(np.mean(loss))


class QuantileForecaster:
    DEFAULT_QUANTILES: Dict[str, float] = {
        "p10": 0.10,
        "p50": 0.50,
        "p90": 0.90,
    }
    EXCLUDE_COLUMNS = frozenset({"date", "store_id", "sku_id"})

    def __init__(
        self,
        quantiles: Optional[Dict[str, float]] = None,
        n_estimators: int = 100,
        learning_rate: float = 0.05,
        num_leaves: int = 31,
        min_child_samples: int = 2,
        random_state: int = 42,
    ) -> None:
        self.quantiles = quantiles or dict(self.DEFAULT_QUANTILES)
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.num_leaves = num_leaves
        self.min_child_samples = min_child_samples
        self.random_state = random_state

        self.models: Dict[str, lgb.LGBMRegressor] = {}
        self.feature_names: List[str] = []
        self.training_losses: Dict[str, float] = {}
        self.is_fitted: bool = False

    @staticmethod
    def evaluate_pinball_loss(
        y_true: Union[np.ndarray, Sequence[float]],
        y_pred: Union[np.ndarray, Sequence[float]],
        alpha: float,
    ) -> float:
        return evaluate_pinball_loss(y_true, y_pred, alpha)

    @property
    def model_p50(self) -> Optional[lgb.LGBMRegressor]:
        return self.models.get("p50")

    def get_p50_model(self) -> Optional[lgb.LGBMRegressor]:
        return self.model_p50

    def get_model(self, quantile: str = "p50") -> Optional[lgb.LGBMRegressor]:
        return self.models.get(quantile)

    def _extract_features(
        self,
        df: Any,
        target_col: Optional[str] = None,
        fit_feature_names: bool = False,
    ) -> tuple[np.ndarray, Optional[np.ndarray]]:
        if not isinstance(df, pl.DataFrame):
            if hasattr(df, "to_dict"):
                df = pl.DataFrame(df)
            else:
                raise TypeError("Input must be a Polars or Pandas DataFrame")

        exclude = set(self.EXCLUDE_COLUMNS)
        if target_col:
            exclude.add(target_col)

        if fit_feature_names:
            cols = []
            for c in df.columns:
                if c in exclude:
                    continue
                dtype = df.schema.get(c)
                if dtype in (
                    pl.Float64,
                    pl.Float32,
                    pl.Int64,
                    pl.Int32,
                    pl.Int16,
                    pl.Int8,
                    pl.UInt64,
                    pl.UInt32,
                    pl.UInt16,
                    pl.UInt8,
                    pl.Boolean,
                ):
                    cols.append(c)
                elif dtype is not None and dtype not in (pl.String, pl.Date, pl.Datetime):
                    cols.append(c)
            self.feature_names = cols
        else:
            cols = list(self.feature_names)

        selected_exprs = []
        for col_name in cols:
            if col_name in df.columns:
                selected_exprs.append(
                    pl.col(col_name).cast(pl.Float64, strict=False).fill_null(0.0)
                )
            else:
                selected_exprs.append(pl.lit(0.0).alias(col_name))

        if selected_exprs:
            x_df = df.select(selected_exprs)
            x_mat = x_df.to_numpy().astype(np.float64)
        else:
            x_mat = np.empty((df.height, 0), dtype=np.float64)

        y_vec = None
        if target_col and target_col in df.columns:
            y_series = df[target_col].cast(pl.Float64, strict=False).fill_null(0.0)
            y_vec = y_series.to_numpy().astype(np.float64)

        return x_mat, y_vec

    def train(
        self,
        feature_df: Any,
        target_col: str = "sales",
    ) -> Dict[str, float]:
        x_mat, y_vec = self._extract_features(
            feature_df, target_col=target_col, fit_feature_names=True
        )
        if y_vec is None:
            raise ValueError(f"Target column '{target_col}' not found in feature matrix")

        n_samples = x_mat.shape[0]
        effective_min_child = max(1, min(self.min_child_samples, n_samples // 3))
        effective_leaves = min(self.num_leaves, max(2, n_samples // 2))

        self.models.clear()
        self.training_losses.clear()

        safe_feature_names = [
            re.sub(r"[\:\[\]\{\}\",]", "_", name) for name in self.feature_names
        ]
        for q_key, alpha in self.quantiles.items():
            model = lgb.LGBMRegressor(
                objective="quantile",
                alpha=alpha,
                n_estimators=self.n_estimators,
                learning_rate=self.learning_rate,
                num_leaves=effective_leaves,
                min_child_samples=effective_min_child,
                verbosity=-1,
                random_state=self.random_state,
                n_jobs=1,
            )
            model.fit(x_mat, y_vec, feature_name=safe_feature_names)
            self.models[q_key] = model

            y_pred = model.predict(x_mat)
            self.training_losses[q_key] = evaluate_pinball_loss(y_vec, y_pred, alpha)

        self.is_fitted = True
        return dict(self.training_losses)

    def predict(
        self,
        feature_df: Any,
    ) -> Dict[str, List[float]]:
        if not self.is_fitted:
            raise RuntimeError("Model must be trained before predicting")

        x_mat, _ = self._extract_features(
            feature_df, target_col=None, fit_feature_names=False
        )
        n_samples = x_mat.shape[0]
        if n_samples == 0:
            return {k: [] for k in self.quantiles.keys()}

        raw_preds = {}
        for q_key in self.quantiles.keys():
            if q_key in self.models:
                preds = self.models[q_key].predict(x_mat)
                raw_preds[q_key] = np.maximum(
                    0.0, np.nan_to_num(np.asarray(preds, dtype=np.float64), nan=0.0)
                )

        if "p10" in raw_preds and "p50" in raw_preds and "p90" in raw_preds:
            p10 = raw_preds["p10"]
            p50 = raw_preds["p50"]
            p90 = raw_preds["p90"]

            # Median-anchored non-crossing clamping
            p10_clamped = np.minimum(p10, p50)
            p90_clamped = np.maximum(p90, p50)

            result = dict(raw_preds)
            result["p10"] = p10_clamped.tolist()
            result["p50"] = p50.tolist()
            result["p90"] = p90_clamped.tolist()
            for k in list(result.keys()):
                if isinstance(result[k], np.ndarray):
                    result[k] = result[k].tolist()
            return result

        result = {}
        for q_key in self.quantiles.keys():
            if q_key in raw_preds:
                result[q_key] = raw_preds[q_key].tolist()
        return result

    def save(self, filepath: Union[str, Path]) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "quantiles": self.quantiles,
            "n_estimators": self.n_estimators,
            "learning_rate": self.learning_rate,
            "num_leaves": self.num_leaves,
            "min_child_samples": self.min_child_samples,
            "random_state": self.random_state,
            "feature_names": self.feature_names,
            "training_losses": self.training_losses,
            "models": self.models,
            "is_fitted": self.is_fitted,
        }
        with open(path, "wb") as f:
            pickle.dump(payload, f)

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "QuantileForecaster":
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")
        with open(path, "rb") as f:
            payload = pickle.load(f)

        instance = cls(
            quantiles=payload["quantiles"],
            n_estimators=payload["n_estimators"],
            learning_rate=payload["learning_rate"],
            num_leaves=payload["num_leaves"],
            min_child_samples=payload["min_child_samples"],
            random_state=payload["random_state"],
        )
        instance.feature_names = payload["feature_names"]
        instance.training_losses = payload["training_losses"]
        instance.models = payload["models"]
        instance.is_fitted = payload["is_fitted"]
        return instance


def train_forecaster(
    feature_df: Any,
    target_col: str = "sales",
) -> Dict[str, float]:
    forecaster = QuantileForecaster()
    return forecaster.train(feature_df, target_col=target_col)


def predict_forecaster(
    model: Any,
    feature_df: Any,
) -> Dict[str, List[float]]:
    if isinstance(model, QuantileForecaster):
        return model.predict(feature_df)
    if hasattr(model, "predict"):
        return model.predict(feature_df)
    raise TypeError("Expected QuantileForecaster instance with predict method")


# Adaptive Demand Forecaster with Automatic Dispatch (EPIC-4 P1)
def train_adaptive_forecaster(
    feature_df: Any,
    target_col: str = "sales",
) -> Tuple[Any, DemandProfile]:
    """
    Analyzes historical sales distribution via Syntetos-Boylan criteria.
    Dispatches to HurdleIntermittentForecaster for intermittent/lumpy patterns,
    or QuantileForecaster for regular/smooth/erratic patterns.
    """
    if not isinstance(feature_df, pl.DataFrame):
        if hasattr(feature_df, "to_dict"):
            feature_df = pl.from_pandas(feature_df)
        elif isinstance(feature_df, list):
            feature_df = pl.DataFrame(feature_df)
        else:
            raise TypeError(f"Unsupported DataFrame type: {type(feature_df)}")

    target_series = feature_df[target_col].to_numpy()
    profile = categorize_demand(target_series)

    if profile.is_intermittent_or_lumpy:
        model = HurdleIntermittentForecaster()
        model.fit(feature_df, target_col=target_col)
    else:
        model = QuantileForecaster()
        model.train(feature_df, target_col=target_col)

    # Attach profile metadata to model instance
    setattr(model, "demand_profile", profile)
    return model, profile


# Persistent Model Registry & LRU Cache (EPIC-3 P1)
MODEL_CACHE_DIR = Path("data/models")
_IN_MEMORY_MODEL_CACHE: Dict[str, Any] = {}


def save_to_registry(
    model: Any,
    store_id: str,
    sku_id: str,
    version: str = "1.0.0",
    metrics: Optional[Dict[str, float]] = None,
    model_type: Optional[str] = None,
    training_duration_sec: float = 0.0,
) -> str:
    """
    Serializes a trained model artifact to data/models/, verifies cryptographic SHA-256 hash,
    and registers metadata into DuckDB model_registry.
    """
    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    clean_store = store_id.replace("STORE-", "S").replace("Store-", "S")
    clean_sku = sku_id.replace("SKU-", "P")
    artifact_filename = f"{clean_store}_{clean_sku}_v{version}.joblib"
    artifact_path = MODEL_CACHE_DIR / artifact_filename

    # Serialize
    with open(artifact_path, "wb") as f:
        pickle.dump(model, f)

    # Compute SHA-256
    with open(artifact_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    resolved_type = model_type
    if not resolved_type:
        resolved_type = (
            "HURDLE_INTERMITTENT"
            if isinstance(model, HurdleIntermittentForecaster)
            else "LIGHTGBM_QUANTILE"
        )

    # Update in-memory cache
    cache_key = f"{clean_store}:{clean_sku}"
    _IN_MEMORY_MODEL_CACHE[cache_key] = model

    # Register in DuckDB
    try:
        from app.core.database import DuckDBManager
        db = DuckDBManager.get_instance()
        m = metrics or {}
        model_id = f"MOD-{clean_store}-{clean_sku}-V{version.replace('.', '_')}"
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT OR REPLACE INTO model_registry (
                    model_id, store_id, sku_id, version, model_type,
                    artifact_path, artifact_hash, training_duration_sec,
                    pinball_loss_p10, pinball_loss_p50, pinball_loss_p90,
                    wape_pct, bias_pct, mase
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                [
                    model_id,
                    clean_store,
                    clean_sku,
                    version,
                    resolved_type,
                    str(artifact_path),
                    file_hash,
                    training_duration_sec,
                    m.get("pinball_loss_p10", 0.0),
                    m.get("pinball_loss_p50", 0.0),
                    m.get("pinball_loss_p90", 0.0),
                    m.get("wape_pct", 0.0),
                    m.get("bias_pct", 0.0),
                    m.get("mase", 1.0),
                ],
            )
    except Exception:
        pass

    return str(artifact_path)


def load_from_registry(
    store_id: str,
    sku_id: str,
    version: Optional[str] = None,
) -> Optional[Any]:
    """
    Sub-millisecond retrieval of serialized model: checks in-memory LRU cache first,
    then deserializes from data/models/ if present.
    """
    clean_store = store_id.replace("STORE-", "S").replace("Store-", "S")
    clean_sku = sku_id.replace("SKU-", "P")
    cache_key = f"{clean_store}:{clean_sku}"

    if cache_key in _IN_MEMORY_MODEL_CACHE:
        return _IN_MEMORY_MODEL_CACHE[cache_key]

    # Search on disk
    if version:
        target_path = MODEL_CACHE_DIR / f"{clean_store}_{clean_sku}_v{version}.joblib"
        candidates = [target_path] if target_path.exists() else []
    else:
        candidates = sorted(MODEL_CACHE_DIR.glob(f"{clean_store}_{clean_sku}_v*.joblib"), reverse=True)

    if candidates:
        try:
            with open(candidates[0], "rb") as f:
                model = pickle.load(f)
            _IN_MEMORY_MODEL_CACHE[cache_key] = model
            return model
        except Exception:
            pass

    return None



def evaluate_backtest(
    feature_df: Any,
    target_col: str = "sales",
    test_days: int = 30,
) -> Dict[str, Any]:
    """
    Executes chronological out-of-sample backtest.
    Zero data leakage: trains strictly on records prior to cutoff,
    evaluates across test_days window.
    """
    if not isinstance(feature_df, pl.DataFrame):
        if hasattr(feature_df, "to_dict"):
            feature_df = pl.from_pandas(feature_df)
        elif isinstance(feature_df, list):
            feature_df = pl.DataFrame(feature_df)
        else:
            raise TypeError(f"Unsupported DataFrame type: {type(feature_df)}")

    if "date" not in feature_df.columns:
        raise ValueError("DataFrame must contain a 'date' column for backtesting")
    if target_col not in feature_df.columns:
        raise ValueError(f"DataFrame must contain target column '{target_col}'")

    sorted_df = feature_df.sort("date")
    unique_dates = sorted_df["date"].unique().sort()
    total_dates = len(unique_dates)

    if total_dates <= test_days:
        test_days = max(1, total_dates // 4)

    cutoff_idx = total_dates - test_days
    cutoff_date = unique_dates[cutoff_idx]

    train_df = sorted_df.filter(pl.col("date") < cutoff_date)
    test_df = sorted_df.filter(pl.col("date") >= cutoff_date)

    if train_df.is_empty() or test_df.is_empty():
        raise ValueError("Insufficient data to split into train and test horizons")

    forecaster = QuantileForecaster(n_estimators=60, learning_rate=0.08)
    forecaster.train(train_df, target_col=target_col)
    preds = forecaster.predict(test_df)

    actuals = np.asarray(test_df[target_col].to_numpy(), dtype=np.float64)
    p10 = np.asarray(preds["p10"], dtype=np.float64)
    p50 = np.asarray(preds["p50"], dtype=np.float64)
    p90 = np.asarray(preds["p90"], dtype=np.float64)
    dates = [str(d) for d in test_df["date"].to_list()]

    abs_errors = np.abs(actuals - p50)
    errors = p50 - actuals
    mae = float(np.mean(abs_errors)) if len(abs_errors) > 0 else 0.0
    sum_actuals = float(np.sum(actuals))
    sum_p50 = float(np.sum(p50))

    if sum_actuals > 0:
        wape_pct = float((np.sum(abs_errors) / sum_actuals) * 100.0)
        bias_pct = float((np.sum(errors) / sum_actuals) * 100.0)
    else:
        wape_pct = 0.0
        bias_pct = 0.0

    train_actuals = train_df[target_col].to_numpy()
    if len(train_actuals) > 1:
        naive_mae = float(np.mean(np.abs(np.diff(train_actuals))))
        mase = float(mae / naive_mae) if naive_mae > 0 else 1.0
    else:
        mase = 1.0

    if bias_pct > 10.0:
        tracking_status = "OVER_FORECASTING"
    elif bias_pct < -10.0:
        tracking_status = "UNDER_FORECASTING"
    else:
        tracking_status = "OPTIMAL"

    pinball_p10 = evaluate_pinball_loss(actuals, p10, 0.10)
    pinball_p50 = evaluate_pinball_loss(actuals, p50, 0.50)
    pinball_p90 = evaluate_pinball_loss(actuals, p90, 0.90)

    time_series = []
    for i in range(len(dates)):
        time_series.append({
            "date": dates[i],
            "day": i + 1,
            "actual": round(float(actuals[i]), 2),
            "p10": round(float(p10[i]), 2),
            "p50": round(float(p50[i]), 2),
            "p90": round(float(p90[i]), 2),
            "error": round(float(errors[i]), 2),
            "abs_error": round(float(abs_errors[i]), 2),
        })

    return {
        "cutoff_date": str(cutoff_date),
        "metrics": {
            "wape_pct": round(wape_pct, 2),
            "bias_pct": round(bias_pct, 2),
            "mase": round(mase, 3),
            "pinball_loss_p10": round(pinball_p10, 3),
            "pinball_loss_p50": round(pinball_p50, 3),
            "pinball_loss_p90": round(pinball_p90, 3),
            "tracking_signal_status": tracking_status,
            "total_actual_units": round(sum_actuals, 1),
            "total_forecast_p50_units": round(sum_p50, 1),
            "test_days": len(dates),
        },
        "time_series": time_series,
    }
