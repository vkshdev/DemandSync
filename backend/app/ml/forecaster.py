import os
import pickle
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union

import lightgbm as lgb
import numpy as np
import polars as pl


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
