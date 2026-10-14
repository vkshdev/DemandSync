from typing import Any, Optional
from pydantic import Field
from app.schemas.common import StrictBaseModel


class SHAPFeature(StrictBaseModel):
    feature: str
    impact: Optional[str] = None
    attribution_value: Optional[float] = None


class CopilotBriefingRequest(StrictBaseModel):
    sku_id: str = "SKU-409"
    sku_name: str = "Winter Thermal Parka"
    store_id: str = "Store-12 (Chicago Downtown)"
    current_stock: int = 42
    p10_forecast: float = 65.0
    p50_forecast: float = 95.0
    p90_forecast: float = 140.0
    safety_stock: int = 50
    reorder_point: int = 78
    stockout_risk_pct: float = 84.5
    lead_time_days: int = 4
    unit_margin_usd: float = 45.0
    baseline_p50_total: float = 0.0
    simulated_p50_total: float = 0.0
    simulated_stockout_risk_pct: float = 0.0
    revised_safety_stock_units: int = 0
    revised_reorder_point_units: int = 0
    top_drivers: list[SHAPFeature] = Field(default_factory=list)


class CopilotBriefingResponse(StrictBaseModel):
    sku_id: str
    store_id: Optional[str] = None
    risk_level: str
    projected_stockout_loss_usd: float = 0.0
    recommended_action: str = ""
    executive_summary: str
    key_drivers: list[str] = Field(default_factory=list)
    action_recommendations: list[str] = Field(default_factory=list)
    model_used: str


class CopilotChatRequest(StrictBaseModel):
    query: str
    context: Optional[dict[str, Any]] = None


class CopilotChatResponse(StrictBaseModel):
    answer: str
    model_used: str


class CopilotStatusResponse(StrictBaseModel):
    provider: str = "local_qwen"
    model_id: str = "Qwen/Qwen2.5-1.5B-Instruct"
    model_name: str = "Qwen/Qwen2.5-1.5B-Instruct"
    device: str = "cpu"
    privacy: str = "100% On-Device Private - Zero Data Egress"
    low_cpu_mem_usage: bool = True
    status: str = "ready"
    local_inference: bool = True
    model_loaded: bool = False
    air_gapped: bool = True
    model_status: str = "ready"
