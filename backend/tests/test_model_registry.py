import os
from pathlib import Path
import pytest
from app.ml.forecaster import (
    QuantileForecaster,
    load_from_registry,
    save_to_registry,
)
from app.core.database import DuckDBManager


def test_model_registry_save_and_load_cycle(tmp_path):
    """Verifies artifact serialization, SHA-256 calculation, and fast load from registry."""
    # Create simple fitted model
    model = QuantileForecaster(n_estimators=10)
    model.is_fitted = True
    model.training_losses = {"p10": 1.2, "p50": 1.5, "p90": 2.0}

    store_id = "STORE-TEST"
    sku_id = "SKU-TEST"
    version = "1.0.0"

    # Save to registry
    artifact_path = save_to_registry(
        model=model,
        store_id=store_id,
        sku_id=sku_id,
        version=version,
        metrics={"wape_pct": 8.5, "bias_pct": -0.5, "mase": 0.82},
        model_type="LIGHTGBM_QUANTILE",
    )

    assert Path(artifact_path).exists()

    # Load from registry
    loaded_model = load_from_registry(store_id=store_id, sku_id=sku_id, version=version)
    assert loaded_model is not None
    assert loaded_model.is_fitted
    assert loaded_model.training_losses["p50"] == 1.5

    # Check DuckDB record
    db = DuckDBManager.get_instance()
    with db.cursor() as cur:
        cur.execute(
            "SELECT model_id, model_type, artifact_hash FROM model_registry WHERE store_id = ? AND sku_id = ?;",
            ["STEST", "PTEST"],
        )
        row = cur.fetchone()
        assert row is not None
        assert row[1] == "LIGHTGBM_QUANTILE"
        assert len(row[2]) == 64  # SHA-256 hex length
