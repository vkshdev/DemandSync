from typing import Optional
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


# Convenience aliases for component compatibility
DailyAggregateForecastPoint = DailyForecastPoint
DailyAggregateForecast = DailyForecastPoint
ForecastTimeSeriesPoint = DailyForecastPoint
SKUForecastPoint = DailyForecastPoint
SHAPDriver = TreeShapDriver
SHAPDriverItem = TreeShapDriver
