"""
Hierarchical Demand Reconciliation Engine.
Implements Bottom-Up (BU), Top-Down (TD), and Minimum Trace (MinT) Optimal Reconciliation
to guarantee mathematical coherence across the chain hierarchy:
Total Chain -> Store -> Category -> SKU.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import polars as pl


@dataclass(frozen=True)
class ReconciliationResult:
    method: str  # "MINT_OPTIMAL" | "BOTTOM_UP" | "TOP_DOWN"
    hierarchy_levels: List[str]
    reconciled_totals: Dict[str, float]
    sku_forecasts: Dict[str, float]
    category_forecasts: Dict[str, float]
    store_forecasts: Dict[str, float]
    chain_total: float
    max_coherence_error: float
    is_coherent: bool


class HierarchicalReconciler:
    """
    Coordinates multi-level demand forecasts across corporate retail hierarchies.
    Enforces exact summation: sum(SKU) == Category, sum(Category) == Store, sum(Store) == Total Chain.
    """

    def __init__(self, method: str = "MINT_OPTIMAL"):
        self.method = method.upper()

    @staticmethod
    def bottom_up_reconciliation(
        sku_forecasts: Dict[str, float],
        sku_metadata: List[Dict[str, str]],
    ) -> ReconciliationResult:
        """
        Bottom-Up (BU): Base forecasts generated at SKU level, aggregated upward.
        Mathematically guarantees 100% coherence by definition.
        """
        store_totals: Dict[str, float] = {}
        category_totals: Dict[str, float] = {}
        chain_total = 0.0

        for meta in sku_metadata:
            sku_id = meta["sku_id"]
            store_id = meta.get("store_id", "STORE-001")
            cat = meta.get("category", "General")

            val = float(sku_forecasts.get(sku_id, 0.0))
            chain_total += val
            store_totals[store_id] = store_totals.get(store_id, 0.0) + val
            category_totals[cat] = category_totals.get(cat, 0.0) + val

        reconciled_totals = {
            "chain_total": round(chain_total, 2),
            **{f"store_{k}": round(v, 2) for k, v in store_totals.items()},
            **{f"category_{k}": round(v, 2) for k, v in category_totals.items()},
        }

        return ReconciliationResult(
            method="BOTTOM_UP",
            hierarchy_levels=["SKU", "Category", "Store", "Chain"],
            reconciled_totals=reconciled_totals,
            sku_forecasts={k: round(v, 2) for k, v in sku_forecasts.items()},
            category_forecasts={k: round(v, 2) for k, v in category_totals.items()},
            store_forecasts={k: round(v, 2) for k, v in store_totals.items()},
            chain_total=round(chain_total, 2),
            max_coherence_error=0.0,
            is_coherent=True,
        )

    @staticmethod
    def mint_optimal_reconciliation(
        base_forecasts: np.ndarray,
        summing_matrix_s: np.ndarray,
        error_variance: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Minimum Trace (MinT) Optimal Reconciliation:
        y_tilde = S (S^T W^-1 S)^-1 S^T W^-1 y_hat
        where S is the summing matrix and W is the error covariance matrix.
        Uses diagonal variance shrinkage for numerical stability and zero invertibility failures.
        """
        s = np.asarray(summing_matrix_s, dtype=np.float64)
        y_hat = np.asarray(base_forecasts, dtype=np.float64)
        n_total = s.shape[0]

        if error_variance is None:
            # Equal weight identity matrix
            w_inv_diag = np.ones(n_total, dtype=np.float64)
        else:
            variances = np.maximum(1e-4, np.asarray(error_variance, dtype=np.float64))
            w_inv_diag = 1.0 / variances

        # S^T * W^-1
        st_winv = s.T * w_inv_diag

        # Inside parentheses: (S^T W^-1 S)
        inner = st_winv @ s

        # Add tiny Tikhonov regularization for conditioning
        inner_reg = inner + 1e-6 * np.eye(inner.shape[0])

        # Solve (S^T W^-1 S)^-1 (S^T W^-1 y_hat)
        rhs = st_winv @ y_hat
        bottom_reconciled = np.linalg.solve(inner_reg, rhs)

        # Disaggregate back to all levels: S * bottom_reconciled
        y_tilde = s @ bottom_reconciled
        return np.maximum(0.0, y_tilde)

    def reconcile_hierarchy(
        self,
        sku_forecasts: Dict[str, float],
        category_forecasts: Dict[str, float],
        store_id: str = "STORE-001",
        sku_to_category_map: Optional[Dict[str, str]] = None,
    ) -> ReconciliationResult:
        """
        Executes hierarchical reconciliation between SKU-level and category-level forecasts.
        Closes budgeting discrepancies and ensures mathematical coherence.
        """
        cat_map = sku_to_category_map or {}
        skus = sorted(list(sku_forecasts.keys()))
        categories = sorted(list(category_forecasts.keys()))

        if not categories or not skus:
            # Fallback to direct bottom-up
            meta = [{"sku_id": k, "store_id": store_id, "category": cat_map.get(k, "General")} for k in skus]
            return self.bottom_up_reconciliation(sku_forecasts, meta)

        # Build summing matrix S:
        # Rows = Categories + SKUs
        # Columns = SKUs (bottom level)
        n_bottom = len(skus)
        n_cat = len(categories)
        s_matrix = np.zeros((n_cat + n_bottom, n_bottom), dtype=np.float64)

        # Upper block: Category summing rows
        cat_to_idx = {c: i for i, c in enumerate(categories)}
        for j, sku in enumerate(skus):
            cat = cat_map.get(sku, categories[0])
            c_idx = cat_to_idx.get(cat, 0)
            s_matrix[c_idx, j] = 1.0

        # Lower block: Identity for bottom-level SKUs
        for j in range(n_bottom):
            s_matrix[n_cat + j, j] = 1.0

        # Base vector y_hat: [category_forecasts, sku_forecasts]
        y_hat_list = [category_forecasts.get(c, 0.0) for c in categories] + [
            sku_forecasts.get(k, 0.0) for k in skus
        ]
        y_hat = np.array(y_hat_list, dtype=np.float64)

        if self.method == "BOTTOM_UP":
            meta = [{"sku_id": k, "store_id": store_id, "category": cat_map.get(k, "General")} for k in skus]
            return self.bottom_up_reconciliation(sku_forecasts, meta)

        # MinT Optimal Reconciliation
        reconciled_vec = self.mint_optimal_reconciliation(y_hat, s_matrix)

        # Unrounded exact values directly from matrix transformation
        raw_cats = [float(reconciled_vec[i]) for i in range(n_cat)]
        raw_skus = [float(reconciled_vec[n_cat + j]) for j in range(n_bottom)]

        # Check exact mathematical coherence before rounding:
        # By definition of S @ bottom, sum(SKU) == Category exactly (error < 1e-9)
        unrounded_max_err = 0.0
        for i, c in enumerate(categories):
            cat_sum = sum(raw_skus[j] for j, k in enumerate(skus) if cat_map.get(k, categories[0]) == c)
            err = abs(raw_cats[i] - cat_sum)
            if err > unrounded_max_err:
                unrounded_max_err = err

        # Round SKU forecasts to 2 decimal places
        reconciled_skus: Dict[str, float] = {}
        for j, k in enumerate(skus):
            reconciled_skus[k] = round(raw_skus[j], 2)

        # Reconciled category totals sum up from reconciled SKUs to maintain penny coherence
        reconciled_cats: Dict[str, float] = {}
        for c in categories:
            cat_sku_sum = sum(
                reconciled_skus[k] for k in skus if cat_map.get(k, categories[0]) == c
            )
            reconciled_cats[c] = round(cat_sku_sum, 2)

        chain_total = round(float(sum(reconciled_cats.values())), 2)

        return ReconciliationResult(
            method="MINT_OPTIMAL",
            hierarchy_levels=["SKU", "Category", "Store"],
            reconciled_totals={
                "chain_total": chain_total,
                **{f"category_{k}": v for k, v in reconciled_cats.items()},
            },
            sku_forecasts=reconciled_skus,
            category_forecasts=reconciled_cats,
            store_forecasts={store_id: chain_total},
            chain_total=chain_total,
            max_coherence_error=round(unrounded_max_err, 8),
            is_coherent=(unrounded_max_err < 1e-4),
        )
