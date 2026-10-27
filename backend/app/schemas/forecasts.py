from typing import Optional, List
from app.schemas.common import StrictBaseModel


class DailyForecastPoint(StrictBaseModel):
    date: str
    p10: float
    p50: float
    p90: float
    actual: Optional[float] = None
    day: Optional[int] = None


class TreeShapDriver(StrictBaseModel):
    feature: str
    attribution_value: float
    impact: str


class SKUForecastResponse(StrictBaseModel):
    sku_id: str
    store_id: str
    time_series: list[DailyForecastPoint]
    shap_drivers: list[TreeShapDriver]


class ForecastOverviewResponse(StrictBaseModel):
    projected_chain_demand_units: float
    macro_trend: str
    daily_aggregate_forecast: list[DailyForecastPoint]


# Backtesting & Performance Evaluation Schemas (EPIC-1 P0)
class BacktestPoint(StrictBaseModel):
    date: str
    day: int
    actual: float
    p10: float
    p50: float
    p90: float
    error: float
    abs_error: float


class BacktestMetrics(StrictBaseModel):
    wape_pct: float
    bias_pct: float
    mase: float
    pinball_loss_p10: float
    pinball_loss_p50: float
    pinball_loss_p90: float
    tracking_signal_status: str  # "OPTIMAL" | "OVER_FORECASTING" | "UNDER_FORECASTING"
    total_actual_units: float
    total_forecast_p50_units: float
    test_days: int


class BacktestResponse(StrictBaseModel):
    sku_id: str
    store_id: str
    cutoff_date: str
    metrics: BacktestMetrics
    time_series: List[BacktestPoint]


# Hierarchical Demand Reconciliation Schemas (EPIC-6 P2)
class ReconciliationResponse(StrictBaseModel):
    method: str
    hierarchy_levels: list[str]
    reconciled_totals: dict[str, float]
    sku_forecasts: dict[str, float]
    category_forecasts: dict[str, float]
    store_forecasts: dict[str, float]
    chain_total: float
    max_coherence_error: float
    is_coherent: bool


# Convenience aliases for component compatibility
DailyAggregateForecastPoint = DailyForecastPoint
DailyAggregateForecast = DailyForecastPoint
ForecastTimeSeriesPoint = DailyForecastPoint
SKUForecastPoint = DailyForecastPoint
SHAPDriver = TreeShapDriver
SHAPDriverItem = TreeShapDriver
