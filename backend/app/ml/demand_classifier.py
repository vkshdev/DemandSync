"""
Demand Pattern Categorization Module.
Implements the Syntetos-Boylan / Petropoulos supply chain demand classification
based on Average Demand Interval (ADI) and Squared Coefficient of Variation (CV^2).
"""

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Union
import numpy as np


@dataclass(frozen=True)
class DemandProfile:
    category: str  # "SMOOTH" | "ERRATIC" | "INTERMITTENT" | "LUMPY"
    adi: float  # Average Demand Interval
    cv2: float  # Squared Coefficient of Variation of non-zero demand
    zero_demand_pct: float  # Percentage of periods with zero sales
    mean_non_zero: float  # Average volume during active demand periods
    is_intermittent_or_lumpy: bool
    recommended_model: str  # "LIGHTGBM_QUANTILE" | "HURDLE_TWO_STAGE" | "TWEEDIE"


ADI_CUTOFF = 1.32
CV2_CUTOFF = 0.49


def categorize_demand(
    series: Union[Sequence[float], np.ndarray, Any],
) -> DemandProfile:
    """
    Categorizes time-series demand into Syntetos-Boylan quadrants:
    1. Smooth: ADI < 1.32, CV^2 < 0.49 (Regular transactions, low variance)
    2. Erratic: ADI < 1.32, CV^2 >= 0.49 (Regular transactions, high variance)
    3. Intermittent: ADI >= 1.32, CV^2 < 0.49 (Sporadic transactions, low variance)
    4. Lumpy: ADI >= 1.32, CV^2 >= 0.49 (Sporadic transactions, high variance)
    """
    arr = np.asarray(series, dtype=np.float64)
    arr = np.nan_to_num(arr, nan=0.0)
    arr = np.maximum(0.0, arr)

    total_periods = len(arr)
    if total_periods == 0:
        return DemandProfile(
            category="SMOOTH",
            adi=1.0,
            cv2=0.0,
            zero_demand_pct=0.0,
            mean_non_zero=0.0,
            is_intermittent_or_lumpy=False,
            recommended_model="LIGHTGBM_QUANTILE",
        )

    non_zero = arr[arr > 0.0]
    num_non_zero = len(non_zero)
    num_zeros = total_periods - num_non_zero
    zero_pct = round((num_zeros / total_periods) * 100.0, 2)

    if num_non_zero == 0:
        # Pure all-zero series
        return DemandProfile(
            category="INTERMITTENT",
            adi=999.0,
            cv2=0.0,
            zero_demand_pct=100.0,
            mean_non_zero=0.0,
            is_intermittent_or_lumpy=True,
            recommended_model="HURDLE_TWO_STAGE",
        )

    # ADI: Average interval between positive demand events
    adi = float(total_periods / num_non_zero)

    # CV^2: (std / mean)^2 of non-zero quantities
    mean_nz = float(np.mean(non_zero))
    std_nz = float(np.std(non_zero, ddof=1)) if num_non_zero > 1 else 0.0
    cv2 = float((std_nz / mean_nz) ** 2) if mean_nz > 0.0 else 0.0

    # Categorization
    is_intermittent = adi >= ADI_CUTOFF
    is_variable = cv2 >= CV2_CUTOFF

    if not is_intermittent and not is_variable:
        category = "SMOOTH"
        rec_model = "LIGHTGBM_QUANTILE"
    elif not is_intermittent and is_variable:
        category = "ERRATIC"
        rec_model = "LIGHTGBM_QUANTILE"
    elif is_intermittent and not is_variable:
        category = "INTERMITTENT"
        rec_model = "HURDLE_TWO_STAGE"
    else:
        category = "LUMPY"
        rec_model = "HURDLE_TWO_STAGE"

    return DemandProfile(
        category=category,
        adi=round(adi, 3),
        cv2=round(cv2, 4),
        zero_demand_pct=zero_pct,
        mean_non_zero=round(mean_nz, 2),
        is_intermittent_or_lumpy=(category in ("INTERMITTENT", "LUMPY")),
        recommended_model=rec_model,
    )
