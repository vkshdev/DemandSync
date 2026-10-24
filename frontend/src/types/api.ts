export interface ErrorResponse {
  detail: string;
  error_code: string;
}

export interface DailyForecastPoint {
  date: string;
  p10: number;
  p50: number;
  p90: number;
  actual?: number | null;
  day?: number | null;
}

export interface TreeShapDriver {
  feature: string;
  attribution_value: number;
  impact: string;
}

export interface SKUForecastResponse {
  sku_id: string;
  store_id: string;
  time_series: DailyForecastPoint[];
  shap_drivers: TreeShapDriver[];
}

export interface ForecastOverviewResponse {
  projected_chain_demand_units: number;
  macro_trend: string;
  daily_aggregate_forecast: DailyForecastPoint[];
}

export interface InventoryAlert {
  sku_id: string;
  store_id: string;
  current_stock: number;
  safety_stock_units: number;
  reorder_point_units: number;
  stockout_risk_pct: number;
  stock_deficit_units: number;
  urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY' | string;
  sku_name?: string | null;
  reorder_point?: number | null;
  safety_stock?: number | null;
  deficit_units?: number | null;
  projected_stockout_loss_usd?: number | null;
}

export interface InventoryAlertsResponse {
  alerts: InventoryAlert[];
  alerts_count: number;
}

export interface CalculatePolicyRequest {
  sku_id: string;
  daily_demand_mean: number;
  daily_demand_std: number;
  lead_time_days_mean: number;
  lead_time_days_std: number;
  target_service_level?: number;
  annual_demand_units?: number;
  order_cost_usd?: number;
  holding_cost_per_unit_year_usd?: number;
  current_stock?: number;
  unit_retail_price_usd?: number;
  unit_cost_usd?: number;
}

export interface CalculatePolicyResponse {
  sku_id: string;
  safety_stock_units: number;
  reorder_point_units: number;
  economic_order_quantity_units: number;
  financial_risk?: Record<string, unknown>;
  projected_stockout_loss_usd: number;
  holding_cost_burden_usd: number;
  stockout_risk_pct: number;
}

export interface DailySimulationPoint {
  day: number;
  date: string;
  baseline_p10: number;
  baseline_p50: number;
  baseline_p90: number;
  simulated_p10: number;
  simulated_p50: number;
  simulated_p90: number;
}

export interface ScenarioSimulationRequest {
  sku_id: string;
  store_id: string;
  discount_pct?: number;
  weather_temp_celsius_shift?: number;
  extreme_weather_flag?: boolean;
  supplier_lead_time_days_shock?: number;
  horizon_days?: number;
}

export interface ScenarioSimulationResponse {
  sku_id: string;
  store_id: string;
  simulation_horizon_days: number;
  baseline_p50_total: number;
  simulated_p50_total: number;
  demand_delta_pct: number;
  baseline_stockout_risk_pct: number;
  simulated_stockout_risk_pct: number;
  revised_safety_stock_units: number;
  revised_reorder_point_units: number;
  daily_simulation_series: DailySimulationPoint[];
}

export interface SHAPFeature {
  feature: string;
  impact?: string | null;
  attribution_value?: number | null;
}

export interface CopilotBriefingRequest {
  sku_id?: string;
  sku_name?: string;
  store_id?: string;
  current_stock?: number;
  p10_forecast?: number;
  p50_forecast?: number;
  p90_forecast?: number;
  safety_stock?: number;
  reorder_point?: number;
  stockout_risk_pct?: number;
  lead_time_days?: number;
  unit_margin_usd?: number;
  baseline_p50_total?: number;
  simulated_p50_total?: number;
  simulated_stockout_risk_pct?: number;
  revised_safety_stock_units?: number;
  revised_reorder_point_units?: number;
  top_drivers?: SHAPFeature[];
}

export interface CopilotBriefingResponse {
  sku_id: string;
  store_id?: string | null;
  risk_level: 'CRITICAL' | 'WARNING' | 'HEALTHY' | string;
  projected_stockout_loss_usd: number;
  recommended_action: string;
  executive_summary: string;
  key_drivers: string[];
  action_recommendations: string[];
  model_used: string;
}

export interface CopilotChatRequest {
  query: string;
  context?: Record<string, unknown> | null;
}

export interface CopilotChatResponse {
  answer: string;
  model_used: string;
}

export interface CopilotStatusResponse {
  provider: string;
  model_id: string;
  model_name: string;
  device: string;
  privacy: string;
  low_cpu_mem_usage: boolean;
  status: string;
  local_inference: boolean;
  model_loaded: boolean;
  air_gapped: boolean;
  model_status: string;
}

export interface RootHealthResponse {
  status: string;
  project: string;
  app: string;
  version: string;
  docs_url: string;
  privacy: string;
}

export interface StoreInfo {
  store_id: string;
  name: string;
  region: string;
  type: string;
  size_sqft: number;
}

export interface SKUInfo {
  sku_id: string;
  name: string;
  department: string;
  category: string;
  base_price: number;
  unit_cost: number;
  lead_time_days: number;
  min_order_qty: number;
}
