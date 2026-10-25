import math
import pytest


def test_safety_stock_formula_and_integer_type():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    ss_fn = getattr(inv_mod, "calculate_safety_stock", None)
    assert ss_fn is not None, "calculate_safety_stock must be defined in inventory_engine"

    # L_mean = 4.0, L_std = 1.0, d_mean = 10.0, d_std = 2.0, service_level = 0.95 (Z = 1.64485)
    # Inside sqrt: 4.0 * (2.0^2) + (10.0^2) * (1.0^2) = 4 * 4 + 100 * 1 = 16 + 100 = 116
    # sqrt(116) = 10.7703
    # raw_ss = 1.64485 * 10.7703 = 17.715
    # ceil(17.715) = 18
    ss = ss_fn(
        mean_lead_time=4.0,
        std_lead_time=1.0,
        mean_demand=10.0,
        std_demand=2.0,
        service_level=0.95
    )

    assert isinstance(ss, int), f"Safety stock must be strictly an integer, got {type(ss)}"
    assert ss >= 0, f"Safety stock must be non-negative, got {ss}"
    assert ss in (17, 18), f"Expected safety stock ~18, got {ss}"


def test_safety_stock_zero_variances():
    """When both demand and lead time variances are zero, safety stock must be 0."""
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    ss_fn = getattr(inv_mod, "calculate_safety_stock")

    ss = ss_fn(
        mean_lead_time=5.0,
        std_lead_time=0.0,
        mean_demand=20.0,
        std_demand=0.0,
        service_level=0.95
    )
    assert ss == 0, f"Expected SS=0 when variance is 0, got {ss}"
    assert isinstance(ss, int)


def test_reorder_point_formula_and_bounds():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    rop_fn = getattr(inv_mod, "calculate_reorder_point", None)
    assert rop_fn is not None, "calculate_reorder_point must be defined"

    # mean_demand = 10.0, mean_lead_time = 4.0, safety_stock = 18
    # Lead time demand = 10.0 * 4.0 = 40.0
    # ROP = ceil(40.0 + 18) = 58
    rop = rop_fn(mean_demand=10.0, mean_lead_time=4.0, safety_stock=18)

    assert isinstance(rop, int), f"ROP must be strictly an integer, got {type(rop)}"
    assert rop >= 0, f"ROP must be non-negative, got {rop}"
    assert rop == 58, f"Expected ROP=58, got {rop}"


def test_eoq_formula_and_bounds():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    eoq_fn = getattr(inv_mod, "calculate_eoq", None)
    assert eoq_fn is not None, "calculate_eoq must be defined"

    # annual_demand = 2400, order_cost = 50.0, holding_cost = 6.0
    # 2 * 2400 * 50 / 6 = 240000 / 6 = 40000
    # sqrt(40000) = 200
    eoq = eoq_fn(
        annual_demand=2400.0,
        order_cost=50.0,
        holding_cost_per_unit=6.0,
        min_order_qty=1
    )

    assert isinstance(eoq, int), f"EOQ must be an integer, got {type(eoq)}"
    assert eoq == 200, f"Expected EOQ=200, got {eoq}"


def test_eoq_moq_enforcement():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    eoq_fn = getattr(inv_mod, "calculate_eoq")

    # annual_demand = 10, order_cost = 1.0, holding_cost = 10.0 -> raw eoq = sqrt(2) = 1.41 -> 2
    # But MOQ is 50
    eoq = eoq_fn(
        annual_demand=10.0,
        order_cost=1.0,
        holding_cost_per_unit=10.0,
        min_order_qty=50
    )
    assert eoq >= 50, f"EOQ must respect MOQ bound, got {eoq}"
    assert isinstance(eoq, int)


def test_financial_risk_tradeoffs():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    risk_fn = getattr(inv_mod, "calculate_financial_risk", None)
    assert risk_fn is not None, "calculate_financial_risk must be defined"

    # Under-stocked scenario: stock = 20, p50 = 50, margin = unit_price - unit_cost = 80 - 50 = 30
    # Deficit = 30 units, projected stockout loss = 30 * 30 = 900.0
    risk_deficit = risk_fn(
        current_stock=20,
        forecast_p50=50.0,
        forecast_p90=80.0,
        unit_cost=50.0,
        unit_price=80.0,
        holding_rate=0.20
    )
    assert isinstance(risk_deficit, dict)
    assert "projected_stockout_loss_usd" in risk_deficit
    assert risk_deficit["projected_stockout_loss_usd"] == pytest.approx(900.0)

    # Over-stocked scenario: stock = 100, p50 = 50 -> Deficit = 0
    risk_healthy = risk_fn(
        current_stock=100,
        forecast_p50=50.0,
        forecast_p90=80.0,
        unit_cost=50.0,
        unit_price=80.0,
        holding_rate=0.20
    )
    assert risk_healthy["projected_stockout_loss_usd"] == pytest.approx(0.0)


def test_inventory_service_level_sensitivity():
    """Higher target service level must yield higher or equal safety stock."""
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    ss_fn = getattr(inv_mod, "calculate_safety_stock")

    params = {
        "mean_lead_time": 4.0,
        "std_lead_time": 1.0,
        "mean_demand": 15.0,
        "std_demand": 3.0
    }
    ss_90 = ss_fn(**params, service_level=0.90)
    ss_95 = ss_fn(**params, service_level=0.95)
    ss_99 = ss_fn(**params, service_level=0.99)

    assert ss_90 <= ss_95 <= ss_99, (
        f"Safety stock should scale monotonically with service level: {ss_90} <= {ss_95} <= {ss_99}"
    )


def test_inventory_invalid_inputs_raise_errors():
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    eoq_fn = getattr(inv_mod, "calculate_eoq")
    ss_fn = getattr(inv_mod, "calculate_safety_stock")

    # Holding cost <= 0
    with pytest.raises(ValueError):
        eoq_fn(annual_demand=1000.0, order_cost=50.0, holding_cost_per_unit=0.0)

    with pytest.raises(ValueError):
        eoq_fn(annual_demand=1000.0, order_cost=50.0, holding_cost_per_unit=-5.0)

    # Service level <= 0 or >= 1.0
    with pytest.raises(ValueError):
        ss_fn(mean_lead_time=4.0, std_lead_time=1.0, mean_demand=10.0, std_demand=2.0, service_level=1.0)

    with pytest.raises(ValueError):
        ss_fn(mean_lead_time=4.0, std_lead_time=1.0, mean_demand=10.0, std_demand=2.0, service_level=0.0)
