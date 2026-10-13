import math
from statistics import NormalDist
from typing import Any, Dict


def calculate_safety_stock(
    mean_lead_time: float,
    std_lead_time: float,
    mean_demand: float,
    std_demand: float,
    service_level: float = 0.95,
) -> int:
    """Calculate dynamic safety stock buffer under lead-time and demand variability."""
    if service_level <= 0.0 or service_level >= 1.0:
        raise ValueError(
            f"service_level must be strictly between 0 and 1, got {service_level}"
        )
    if (
        mean_lead_time < 0.0
        or std_lead_time < 0.0
        or mean_demand < 0.0
        or std_demand < 0.0
    ):
        raise ValueError("Lead time and demand parameters must be non-negative")

    # Combined lead-time demand variance by Eve's Law
    variance = (mean_lead_time * (std_demand ** 2)) + (
        (mean_demand ** 2) * (std_lead_time ** 2)
    )
    if variance <= 0.0 or (std_demand == 0.0 and std_lead_time == 0.0):
        return 0

    z_score = NormalDist().inv_cdf(service_level)
    raw_ss = z_score * math.sqrt(variance)
    return max(0, int(math.ceil(raw_ss)))


def calculate_reorder_point(
    mean_demand: float,
    mean_lead_time: float,
    safety_stock: int,
) -> int:
    """Calculate inventory replenishment reorder point trigger."""
    if mean_demand < 0.0 or mean_lead_time < 0.0 or safety_stock < 0:
        raise ValueError("Demand, lead time, and safety stock must be non-negative")

    rop = math.ceil(mean_demand * mean_lead_time + safety_stock)
    return max(0, int(rop))


def calculate_eoq(
    annual_demand: float,
    order_cost: float,
    holding_cost_per_unit: float,
    min_order_qty: int = 1,
) -> int:
    """Calculate Economic Order Quantity with minimum order batch constraints."""
    if holding_cost_per_unit <= 0.0:
        raise ValueError(
            f"holding_cost_per_unit must be strictly positive, got {holding_cost_per_unit}"
        )
    if annual_demand < 0.0 or order_cost < 0.0 or min_order_qty < 0:
        raise ValueError(
            "Annual demand, order cost, and min_order_qty must be non-negative"
        )

    if annual_demand == 0.0:
        return 0

    raw_eoq = math.sqrt((2.0 * annual_demand * order_cost) / holding_cost_per_unit)
    return max(int(min_order_qty), int(round(raw_eoq)))


def calculate_financial_risk(
    current_stock: int,
    forecast_p50: float,
    forecast_p90: float,
    unit_cost: float,
    unit_price: float,
    holding_rate: float = 0.20,
) -> Dict[str, Any]:
    """Calculate financial stockout loss and inventory holding burden trade-offs."""
    if unit_cost < 0.0 or unit_price < 0.0 or holding_rate < 0.0:
        raise ValueError("Cost, price, and holding rate parameters must be non-negative")
    if forecast_p50 < 0.0 or forecast_p90 < 0.0:
        raise ValueError("Forecast values must be non-negative")

    # Account for negative physical stock representing accumulated backorders
    deficit = max(0.0, float(forecast_p50) - float(current_stock))
    unit_margin = max(0.0, float(unit_price) - float(unit_cost))
    stockout_loss = round(deficit * unit_margin, 2)

    # Holding cost applies strictly to positive physical inventory
    holding_units = max(0, int(current_stock))
    holding_cost = round(
        float(holding_units) * float(unit_cost) * float(holding_rate), 2
    )

    if current_stock <= 0:
        stockout_risk_pct = 100.0
    else:
        spread = max(0.0, float(forecast_p90) - float(forecast_p50))
        if spread > 0.0:
            sigma_est = spread / 1.2815515655446004
            z_stock = (float(current_stock) - float(forecast_p50)) / sigma_est
            risk_prob = 1.0 - NormalDist().cdf(z_stock)
            stockout_risk_pct = round(min(100.0, max(0.0, risk_prob * 100.0)), 2)
        else:
            stockout_risk_pct = 100.0 if current_stock < forecast_p50 else 0.0

    return {
        "projected_stockout_loss_usd": stockout_loss,
        "projected_holding_cost_usd": holding_cost,
        "holding_cost_burden_usd": holding_cost,
        "holding_cost_usd": holding_cost,
        "deficit_units": round(deficit, 2),
        "unit_margin_usd": round(unit_margin, 2),
        "stockout_risk_pct": stockout_risk_pct,
        "current_stock": int(current_stock),
    }


class InventoryEngine:
    """Facade class wrapping prescriptive inventory optimization algorithms."""

    calculate_safety_stock = staticmethod(calculate_safety_stock)
    calculate_reorder_point = staticmethod(calculate_reorder_point)
    calculate_eoq = staticmethod(calculate_eoq)
    calculate_financial_risk = staticmethod(calculate_financial_risk)
