import numpy as np
import pytest
from app.ml.hierarchical_reconciliation import (
    HierarchicalReconciler,
    ReconciliationResult,
)


def test_bottom_up_reconciliation_exact_coherence():
    """Validates that bottom-up reconciliation sums bottom SKU forecasts up to categories and stores exactly."""
    sku_forecasts = {
        "SKU-001": 100.0,
        "SKU-002": 50.0,
        "SKU-003": 75.0,
    }
    sku_metadata = [
        {"sku_id": "SKU-001", "store_id": "STORE-001", "category": "Apparel"},
        {"sku_id": "SKU-002", "store_id": "STORE-001", "category": "Apparel"},
        {"sku_id": "SKU-003", "store_id": "STORE-001", "category": "Electronics"},
    ]

    res = HierarchicalReconciler.bottom_up_reconciliation(sku_forecasts, sku_metadata)

    assert res.is_coherent
    assert res.max_coherence_error == 0.0
    assert res.category_forecasts["Apparel"] == 150.0
    assert res.category_forecasts["Electronics"] == 75.0
    assert res.chain_total == 225.0


def test_mint_optimal_reconciliation_mathematical_coherence():
    """
    Validates Minimum Trace (MinT) Optimal Reconciliation:
    When SKU-level and Category-level forecasts are independently generated with budgeting discrepancy,
    MinT reconciles them linearly such that sum(reconciled_SKU) == reconciled_Category.
    """
    sku_forecasts = {
        "SKU-001": 90.0,   # Apparel
        "SKU-002": 80.0,   # Apparel (Sum = 170.0)
        "SKU-003": 120.0,  # Electronics
        "SKU-004": 60.0,   # Electronics (Sum = 180.0)
    }

    # Macro category estimates with budgeting gap
    category_forecasts = {
        "Apparel": 190.0,     # Discrepancy: +20 vs SKU sum
        "Electronics": 170.0, # Discrepancy: -10 vs SKU sum
    }

    sku_cat_map = {
        "SKU-001": "Apparel",
        "SKU-002": "Apparel",
        "SKU-003": "Electronics",
        "SKU-004": "Electronics",
    }

    reconciler = HierarchicalReconciler(method="MINT_OPTIMAL")
    res = reconciler.reconcile_hierarchy(
        sku_forecasts=sku_forecasts,
        category_forecasts=category_forecasts,
        store_id="STORE-001",
        sku_to_category_map=sku_cat_map,
    )

    assert res.is_coherent
    assert res.max_coherence_error < 1e-4

    # Coherence check: sum of reconciled SKUs in Apparel MUST equal reconciled Apparel category
    apparel_sku_sum = res.sku_forecasts["SKU-001"] + res.sku_forecasts["SKU-002"]
    assert apparel_sku_sum == pytest.approx(res.category_forecasts["Apparel"], abs=1e-2)

    # Coherence check for Electronics
    elec_sku_sum = res.sku_forecasts["SKU-003"] + res.sku_forecasts["SKU-004"]
    assert elec_sku_sum == pytest.approx(res.category_forecasts["Electronics"], abs=1e-2)

    # Coherence check for Chain Total
    assert res.chain_total == pytest.approx(
        res.category_forecasts["Apparel"] + res.category_forecasts["Electronics"], abs=1e-2
    )
