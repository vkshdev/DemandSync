"""
Two-Stage Hurdle Architecture and Zero-Inflated Intermittent Demand Forecaster.
Stage 1: Binary Classifier predicting probability of positive demand event P(sales > 0).
Stage 2: Quantile Regressors conditioned on non-zero sales, with Syntetos-Boylan
         Approximation (SBA) fallback for extreme low-volume series.
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import polars as pl
from lightgbm import LGBMClassifier, LGBMRegressor


class HurdleIntermittentForecaster:
    """
    Two-Stage Hurdle Forecaster designed for intermittent and lumpy demand.
    Combines binary classification with non-zero quantile regression.
    """

    def __init__(
        self,
        quantiles: Optional[Dict[str, float]] = None,
        n_estimators: int = 60,
        learning_rate: float = 0.05,
        random_state: int = 42,
    ):
        self.quantiles = quantiles or {"p10": 0.10, "p50": 0.50, "p90": 0.90}
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.random_state = random_state

        self.classifier: Optional[LGBMClassifier] = None
        self.regressors: Dict[str, LGBMRegressor] = {}
        self.feature_names: List[str] = []
        self.is_fitted: bool = False

        # Croston / SBA fallbacks if non-zero data is scarce
        self.sba_mean_size: float = 1.0
        self.sba_demand_probability: float = 0.5

    def _prepare_features(
        self,
        feature_df: Any,
        target_col: Optional[str] = "sales",
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        if not isinstance(feature_df, pl.DataFrame):
            if hasattr(feature_df, "to_dict"):
                feature_df = pl.from_pandas(feature_df)
            elif isinstance(feature_df, list):
                feature_df = pl.DataFrame(feature_df)
            else:
                raise TypeError(f"Unsupported DataFrame type: {type(feature_df)}")

        drop_cols = {"date", "store_id", "sku_id"}
        if target_col:
            drop_cols.add(target_col)

        feature_cols = [c for c in feature_df.columns if c not in drop_cols]
        numeric_cols = [
            c for c in feature_cols if feature_df[c].dtype.is_numeric()
        ]

        if not self.feature_names:
            self.feature_names = numeric_cols

        x_df = feature_df.select(self.feature_names).fill_null(0.0)
        x_mat = x_df.to_numpy()

        y_vec = None
        if target_col and target_col in feature_df.columns:
            y_raw = feature_df[target_col].fill_null(0.0).to_numpy()
            y_vec = np.asarray(y_raw, dtype=np.float64)

        return x_mat, y_vec

    def fit(
        self,
        feature_df: Any,
        target_col: str = "sales",
    ) -> Dict[str, float]:
        """Trains the two-stage model."""
        x_mat, y_vec = self._prepare_features(feature_df, target_col=target_col)
        if y_vec is None:
            raise ValueError("Target column is required for fitting")

        n_samples = len(y_vec)
        if n_samples == 0:
            raise ValueError("Cannot fit on empty dataset")

        # Binary indicator: 1 if positive demand, 0 otherwise
        y_binary = (y_vec > 0.0).astype(int)
        pos_count = int(np.sum(y_binary))

        # Check for degenerate cases
        if pos_count == 0:
            self.sba_mean_size = 0.0
            self.sba_demand_probability = 0.0
            self.is_fitted = True
            return {"loss_p50": 0.0, "positive_rate": 0.0}

        if pos_count == n_samples:
            # 100% positive: standard probability is 1.0
            self.sba_demand_probability = 1.0
        else:
            self.sba_demand_probability = float(pos_count / n_samples)

        # Stage 1: Fit occurrence classifier if both classes exist
        if 0 < pos_count < n_samples:
            self.classifier = LGBMClassifier(
                n_estimators=self.n_estimators,
                learning_rate=self.learning_rate,
                random_state=self.random_state,
                verbose=-1,
                min_child_samples=max(2, min(20, n_samples // 5)),
            )
            safe_features = [f"f_{i}" for i in range(x_mat.shape[1])]
            self.classifier.fit(x_mat, y_binary, feature_name=safe_features)
        else:
            self.classifier = None

        # Stage 2: Fit non-zero quantile regressors
        pos_mask = y_vec > 0.0
        x_pos = x_mat[pos_mask]
        y_pos = y_vec[pos_mask]

        self.sba_mean_size = float(np.mean(y_pos)) if len(y_pos) > 0 else 1.0

        if len(y_pos) >= 8:
            safe_features = [f"f_{i}" for i in range(x_pos.shape[1])]
            min_child = max(2, min(10, len(y_pos) // 4))
            for q_name, alpha in self.quantiles.items():
                reg = LGBMRegressor(
                    objective="quantile",
                    alpha=alpha,
                    n_estimators=self.n_estimators,
                    learning_rate=self.learning_rate,
                    random_state=self.random_state,
                    verbose=-1,
                    min_child_samples=min_child,
                )
                reg.fit(x_pos, y_pos, feature_name=safe_features)
                self.regressors[q_name] = reg
        else:
            self.regressors = {}

        self.is_fitted = True
        return {
            "positive_rate": float(pos_count / n_samples),
            "sba_mean_size": self.sba_mean_size,
        }

    def predict(
        self,
        feature_df: Any,
    ) -> Dict[str, List[float]]:
        """Generates two-stage probability-weighted predictions."""
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predict")

        x_mat, _ = self._prepare_features(feature_df, target_col=None)
        n_samples = x_mat.shape[0]
        if n_samples == 0:
            return {k: [] for k in self.quantiles.keys()}

        # 1. Occurrence probabilities
        if self.classifier is not None:
            safe_features = [f"f_{i}" for i in range(x_mat.shape[1])]
            probs = self.classifier.predict_proba(x_mat)[:, 1]
        else:
            probs = np.full(n_samples, self.sba_demand_probability)

        probs = np.clip(probs, 0.0, 1.0)

        # 2. Non-zero quantile estimates
        nz_preds: Dict[str, np.ndarray] = {}
        for q_name, alpha in self.quantiles.items():
            if q_name in self.regressors:
                preds = self.regressors[q_name].predict(x_mat)
                nz_preds[q_name] = np.maximum(0.1, preds)
            else:
                # Syntetos-Boylan Approximation scale factor
                if q_name == "p10":
                    nz_preds[q_name] = np.full(n_samples, max(0.1, self.sba_mean_size * 0.6))
                elif q_name == "p90":
                    nz_preds[q_name] = np.full(n_samples, max(0.1, self.sba_mean_size * 1.5))
                else:
                    nz_preds[q_name] = np.full(n_samples, max(0.1, self.sba_mean_size))

        # 3. Combine stages:
        # Expected median sales = P(sales > 0) * median_size
        p50 = np.maximum(0.0, probs * nz_preds["p50"])
        
        # P10: if probability of occurrence < 0.85, the 10th percentile is naturally 0
        p10 = np.where(probs < 0.85, 0.0, probs * nz_preds["p10"])
        
        # P90: Upper ceiling during positive occurrences
        p90 = np.maximum(p50, probs * nz_preds["p90"])

        # Enforce non-crossing and clamping
        p10_clamped = np.minimum(p10, p50)
        p50_clamped = p50
        p90_clamped = np.maximum(p90, p50)

        return {
            "p10": [round(float(v), 2) for v in p10_clamped],
            "p50": [round(float(v), 2) for v in p50_clamped],
            "p90": [round(float(v), 2) for v in p90_clamped],
        }
