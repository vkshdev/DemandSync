from fastapi import APIRouter
from app.schemas.simulator import (
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
)
from app.services.scenario_service import simulate_scenario

router = APIRouter()


@router.post("/scenario", response_model=ScenarioSimulationResponse)
def run_scenario_simulation(
    request: ScenarioSimulationRequest,
) -> ScenarioSimulationResponse:
    """Executes what-if pricing discount, weather shift, and supplier disruption scenario."""
    return simulate_scenario(
        sku_id=request.sku_id,
        store_id=request.store_id,
        discount_pct=request.discount_pct,
        weather_temp_celsius_shift=request.weather_temp_celsius_shift,
        extreme_weather_flag=request.extreme_weather_flag,
        supplier_lead_time_days_shock=request.supplier_lead_time_days_shock,
        horizon_days=request.horizon_days,
    )
