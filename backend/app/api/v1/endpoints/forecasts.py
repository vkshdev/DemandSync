from fastapi import APIRouter, Query
from app.schemas.forecasts import (
    BacktestResponse,
    ForecastOverviewResponse,
    ReconciliationResponse,
    SKUForecastResponse,
)
from app.services.forecast_service import ForecastService

router = APIRouter()


@router.get("/overview", response_model=ForecastOverviewResponse)
def get_chain_forecast_overview() -> ForecastOverviewResponse:
    """Returns macro chain-level aggregate demand projection and trend direction."""
    return ForecastService.get_chain_overview()


@router.get("/backtest", response_model=BacktestResponse)
def get_backtest_evaluation(
    sku_id: str = Query(default="SKU-001"),
    store_id: str = Query(default="STORE-001"),
) -> BacktestResponse:
    """Returns chronological out-of-sample backtesting metrics and actual vs predicted trajectory."""
    return ForecastService.get_backtest_evaluation(sku_id=sku_id, store_id=store_id)


@router.get("/reconciliation", response_model=ReconciliationResponse)
def get_hierarchical_reconciliation(
    store_id: str = Query(default="STORE-001"),
    method: str = Query(default="MINT_OPTIMAL"),
) -> ReconciliationResponse:
    """Returns mathematically coherent reconciled forecasts across SKU, Category, and Store levels."""
    return ForecastService.get_hierarchical_reconciliation(store_id=store_id, method=method)


@router.get("/{sku_id}", response_model=SKUForecastResponse)
def get_sku_forecast(
    sku_id: str,
    store_id: str = Query(default="STORE-001"),
) -> SKUForecastResponse:
    """Returns 30-day quantile demand forecast and TreeSHAP driver attributions for a given SKU."""
    return ForecastService.get_sku_forecast(sku_id=sku_id, store_id=store_id)
