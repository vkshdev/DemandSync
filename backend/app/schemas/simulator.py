from typing import Any
from app.schemas.common import StrictBaseModel


class DailySimulationPoint(StrictBaseModel):
    day: int
    date: str
    baseline_p10: float
    baseline_p50: float
    baseline_p90: float
    simulated_p10: float
    simulated_p50: float
    simulated_p90: float

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def __contains__(self, item: str) -> bool:
        return hasattr(self, item)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


class ScenarioSimulationRequest(StrictBaseModel):
    sku_id: str
    store_id: str
    discount_pct: float = 0.0
    weather_temp_celsius_shift: float = 0.0
    extreme_weather_flag: bool = False
    supplier_lead_time_days_shock: int = 0
    horizon_days: int = 30


class ScenarioSimulationResponse(StrictBaseModel):
    sku_id: str
    store_id: str
    simulation_horizon_days: int
    baseline_p50_total: float
    simulated_p50_total: float
    demand_delta_pct: float
    baseline_stockout_risk_pct: float
    simulated_stockout_risk_pct: float
    revised_safety_stock_units: int
    revised_reorder_point_units: int
    daily_simulation_series: list[DailySimulationPoint]

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def __contains__(self, item: str) -> bool:
        return hasattr(self, item)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)
