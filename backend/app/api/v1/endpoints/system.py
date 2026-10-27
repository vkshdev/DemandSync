from fastapi import APIRouter
from app.ml.drift_detector import DriftDetector, PipelineDriftReport

router = APIRouter()


@router.get("/drift-report")
def get_pipeline_drift_report():
    """
    Automated health check calculating Kolmogorov-Smirnov and Population Stability Index (PSI)
    drift scores across retail sales, pricing, and weather features.
    """
    report = DriftDetector.generate_system_drift_report()
    return {
        "timestamp": report.timestamp,
        "total_series_evaluated": report.total_series_evaluated,
        "overall_system_status": report.overall_system_status,
        "features_drifted_count": report.features_drifted_count,
        "recommended_action": report.recommended_action,
        "feature_metrics": [
            {
                "feature_name": m.feature_name,
                "ks_statistic": m.ks_statistic,
                "p_value": m.p_value,
                "psi_score": m.psi_score,
                "drift_status": m.drift_status,
                "is_drift_detected": m.is_drift_detected,
                "baseline_mean": m.baseline_mean,
                "current_mean": m.current_mean,
            }
            for m in report.feature_metrics
        ],
    }
