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


# Purchase Order (PO) & ERP Integration Schemas (EPIC-2 P0)
class POLineItem(StrictBaseModel):
    sku_id: str
    sku_name: str
    unit_cost_usd: float
    order_quantity: int
    total_cost_usd: float
    moq: int = 1
    case_pack_size: int = 1


class PurchaseOrderRequest(StrictBaseModel):
    sku_id: str
    store_id: str
    current_stock: Optional[int] = None
    safety_stock_units: Optional[int] = None
    reorder_point_units: Optional[int] = None
    eoq_units: Optional[int] = None
    min_order_qty: Optional[int] = None
    unit_cost_usd: Optional[float] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderResponse(StrictBaseModel):
    po_number: str
    created_at: str
    store_id: str
    vendor: str
    line_items: list[POLineItem]
    total_units: int
    total_cost_usd: float
    lead_time_days_expected: float
    status: str = "DRAFT"
    notes: Optional[str] = None


class ERPTransmitRequest(StrictBaseModel):
    po_number: str
    erp_system: str = "SAP_S4HANA"  # "SAP_S4HANA" | "ORACLE_NETSUITE" | "MICROSOFT_DYNAMICS"
    po_data: Optional[PurchaseOrderResponse] = None


class ERPTransmitResponse(StrictBaseModel):
    status: str
    edi_control_number: str
    erp_transaction_id: str
    timestamp: str
    erp_system: str
    message: str

