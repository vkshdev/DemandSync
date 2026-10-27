import numpy as np
import pytest
from app.ml.drift_detector import (
    DriftDetector,
    compute_ks_test,
    compute_psi,
)


def test_compute_psi_identical_distributions():
    """Identical distributions must have PSI score extremely close to 0."""
    data = [10.0, 12.0, 15.0, 14.0, 18.0, 20.0, 22.0, 25.0, 30.0, 35.0] * 5
    psi = compute_psi(data, data)
    assert psi == pytest.approx(0.0, abs=1e-3)


def test_compute_psi_significant_drift():
    """Significantly shifted distribution must produce PSI >= 0.20."""
    np.random.seed(42)
    baseline = np.random.normal(20.0, 2.0, 100)
    current_shifted = np.random.normal(50.0, 5.0, 100)  # Huge distribution shift

    psi = compute_psi(baseline, current_shifted)
    assert psi > 0.20


def test_compute_ks_test_divergence():
    """Two-sample KS test should yield high D-statistic and small p-value for shifted distributions."""
    np.random.seed(42)
    base = np.random.normal(0.0, 1.0, 100)
    curr = np.random.normal(3.0, 1.0, 100)

    d_stat, p_val = compute_ks_test(base, curr)
    assert d_stat > 0.50
    assert p_val < 0.01


def test_drift_detector_system_report():
    """Validates end-to-end drift reporting structure and categorization."""
    report = DriftDetector.generate_system_drift_report()
    assert report.total_series_evaluated >= 4
    assert report.overall_system_status in ("HEALTHY", "MONITOR", "RETRAINING_REQUIRED")
    assert len(report.feature_metrics) >= 4
    for fm in report.feature_metrics:
        assert fm.drift_status in ("STABLE", "MODERATE_DRIFT", "SIGNIFICANT_DRIFT")
        assert 0.0 <= fm.ks_statistic <= 1.0
        assert fm.psi_score >= 0.0
