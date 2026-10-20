from fastapi import APIRouter, Query
from app.schemas.forecasts import ForecastOverviewResponse, SKUForecastResponse
from app.services.forecast_service import ForecastService

router = APIRouter()


@router.get("/overview", response_model=ForecastOverviewResponse)
def get_chain_forecast_overview() -> ForecastOverviewResponse:
    """Returns macro chain-level aggregate demand projection and trend direction."""
    return ForecastService.get_chain_overview()


@router.get("/{sku_id}", response_model=SKUForecastResponse)
def get_sku_forecast(
    sku_id: str,
    store_id: str = Query(default="STORE-001"),
) -> SKUForecastResponse:
    """Returns 30-day quantile demand forecast and TreeSHAP driver attributions for a given SKU."""
    return ForecastService.get_sku_forecast(sku_id=sku_id, store_id=store_id)
