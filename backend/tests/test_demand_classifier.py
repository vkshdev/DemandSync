import numpy as np
import pytest
from app.ml.demand_classifier import (
    ADI_CUTOFF,
    CV2_CUTOFF,
    categorize_demand,
)


def test_categorize_demand_smooth():
    """Smooth demand: non-zero in almost every period with stable quantities (low CV^2)."""
    # ADI ~ 1.0 (< 1.32), CV^2 low (< 0.49)
    sales = [10.0, 11.0, 9.0, 10.0, 12.0, 10.0, 11.0, 10.0, 9.0, 10.0]
    profile = categorize_demand(sales)

    assert profile.category == "SMOOTH"
    assert profile.adi < ADI_CUTOFF
    assert profile.cv2 < CV2_CUTOFF
    assert profile.zero_demand_pct == 0.0
    assert not profile.is_intermittent_or_lumpy
    assert profile.recommended_model == "LIGHTGBM_QUANTILE"


def test_categorize_demand_erratic():
    """Erratic demand: frequent transactions (low ADI) but wildly varying batch sizes (high CV^2)."""
    # ADI = 1.0 (< 1.32), CV^2 >= 0.49
    sales = [1.0, 50.0, 2.0, 80.0, 1.0, 65.0, 3.0, 90.0, 2.0, 70.0]
    profile = categorize_demand(sales)

    assert profile.category == "ERRATIC"
    assert profile.adi < ADI_CUTOFF
    assert profile.cv2 >= CV2_CUTOFF
    assert not profile.is_intermittent_or_lumpy
    assert profile.recommended_model == "LIGHTGBM_QUANTILE"


def test_categorize_demand_intermittent():
    """Intermittent demand: sparse periods of demand (high ADI) with consistent sizes (low CV^2)."""
    # Demand occurs once every 3 days (ADI = 3.0 >= 1.32), sizes are around 10
    sales = [0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 11.0, 0.0, 0.0, 9.0]
    profile = categorize_demand(sales)

    assert profile.category == "INTERMITTENT"
    assert profile.adi >= ADI_CUTOFF
    assert profile.cv2 < CV2_CUTOFF
    assert profile.zero_demand_pct > 50.0
    assert profile.is_intermittent_or_lumpy
    assert profile.recommended_model == "HURDLE_TWO_STAGE"


def test_categorize_demand_lumpy():
    """Lumpy demand: sparse periods (high ADI) and wildly varying quantities (high CV^2)."""
    # Demand occurs sporadically, batch sizes are erratic
    sales = [0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 85.0, 0.0, 0.0, 0.0, 15.0]
    profile = categorize_demand(sales)

    assert profile.category == "LUMPY"
    assert profile.adi >= ADI_CUTOFF
    assert profile.cv2 >= CV2_CUTOFF
    assert profile.is_intermittent_or_lumpy
    assert profile.recommended_model == "HURDLE_TWO_STAGE"


def test_categorize_demand_edge_cases():
    """Empty and all-zero demand series."""
    # Empty series
    empty_profile = categorize_demand([])
    assert empty_profile.category == "SMOOTH"
    assert empty_profile.zero_demand_pct == 0.0

    # All-zero series
    zero_profile = categorize_demand([0.0, 0.0, 0.0, 0.0])
    assert zero_profile.category == "INTERMITTENT"
    assert zero_profile.zero_demand_pct == 100.0
    assert zero_profile.is_intermittent_or_lumpy
    assert zero_profile.recommended_model == "HURDLE_TWO_STAGE"
