from typing import Any, Optional, Union
from pydantic import Field
from app.schemas.common import StrictBaseModel


class InventoryAlert(StrictBaseModel):
    sku_id: str
    store_id: str
    current_stock: int
    safety_stock_units: int = 0
    reorder_point_units: int = 0
    stockout_risk_pct: float = 0.0
    stock_deficit_units: int = 0
    urgency: str = "WARNING"
    sku_name: Optional[str] = None
    reorder_point: Optional[int] = None
    safety_stock: Optional[int] = None
    deficit_units: Optional[float] = None
    projected_stockout_loss_usd: Optional[float] = None


class InventoryAlertsResponse(StrictBaseModel):
    alerts: list[InventoryAlert]
    alerts_count: int


class CalculatePolicyRequest(StrictBaseModel):
    sku_id: str
    daily_demand_mean: float
    daily_demand_std: float
    lead_time_days_mean: float
    lead_time_days_std: float
    target_service_level: float = 0.95
    annual_demand_units: Union[float, int] = 0
    order_cost_usd: float = 0.0
    holding_cost_per_unit_year_usd: float = 1.0
    current_stock: int = 0
    unit_retail_price_usd: float = 0.0
    unit_cost_usd: float = 0.0


class CalculatePolicyResponse(StrictBaseModel):
    sku_id: str
    safety_stock_units: int
    reorder_point_units: int
    economic_order_quantity_units: int
    financial_risk: dict[str, Any] = Field(default_factory=dict)
    projected_stockout_loss_usd: float = 0.0
    holding_cost_burden_usd: float = 0.0
    stockout_risk_pct: float = 0.0


# Convenience aliases for component compatibility
InventoryAlertItem = InventoryAlert
InventoryPolicyRequest = CalculatePolicyRequest
InventoryPolicyResponse = CalculatePolicyResponse
