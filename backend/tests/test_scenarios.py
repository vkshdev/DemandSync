import pytest


def test_scenario_multi_store_holiday_markdown():
    """Tier 4: Black Friday / Cyber Monday multi-store holiday markdown scenario."""
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    inv_mod = pytest.importorskip("app.services.inventory_engine")

    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(scenario_mod.ScenarioService, "simulate_scenario", None))
    eoq_fn = getattr(inv_mod, "calculate_eoq")

    # Store 1 and Store 2 markdown simulation
    res_store1 = sim_fn(
        sku_id="SKU-HOLIDAY-01",
        store_id="STORE-001",
        discount_pct=0.30,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=5
    )

    delta1 = res_store1.demand_delta_pct if hasattr(res_store1, "demand_delta_pct") else res_store1["demand_delta_pct"]
    assert delta1 > 10.0, "30% holiday discount must induce significant demand lift"

    # Annualized demand surge increases EOQ replenishment batch
    base_annual = 5000.0
    surge_annual = base_annual * (1.0 + delta1 / 100.0)

    base_eoq = eoq_fn(annual_demand=base_annual, order_cost=80.0, holding_cost_per_unit=5.0)
    surge_eoq = eoq_fn(annual_demand=surge_annual, order_cost=80.0, holding_cost_per_unit=5.0)

    assert surge_eoq >= base_eoq, "Holiday surge must adjust EOQ upward to lower per-unit order overhead"


def test_scenario_supplier_disruption_shock():
    """Tier 4: Global port congestion doubling supplier transit lead time."""
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    ss_fn = getattr(inv_mod, "calculate_safety_stock")
    rop_fn = getattr(inv_mod, "calculate_reorder_point")

    mean_demand = 25.0
    std_demand = 6.0

    # Normal supply chain: Lead time 4 days +/- 1 day
    normal_ss = ss_fn(
        mean_lead_time=4.0,
        std_lead_time=1.0,
        mean_demand=mean_demand,
        std_demand=std_demand,
        service_level=0.95
    )
    normal_rop = rop_fn(mean_demand=mean_demand, mean_lead_time=4.0, safety_stock=normal_ss)

    # Disrupted supply chain: Lead time 14 days +/- 4 days
    disrupted_ss = ss_fn(
        mean_lead_time=14.0,
        std_lead_time=4.0,
        mean_demand=mean_demand,
        std_demand=std_demand,
        service_level=0.95
    )
    disrupted_rop = rop_fn(mean_demand=mean_demand, mean_lead_time=14.0, safety_stock=disrupted_ss)

    # Disruption must cause significant buffer expansion
    assert disrupted_ss > normal_ss * 1.5, "Disrupted safety stock must substantially expand"
    assert disrupted_rop > normal_rop * 2.0, "Disrupted ROP must more than double due to lead-time elongation"


def test_scenario_heatwave_extreme_weather_surge():
    """Tier 4: Sudden heatwave (+12C) driving beverage/ice cream demand."""
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    from app.services.copilot_service import (
        CopilotService,
        CopilotBriefingRequest,
        SHAPFeature
    )

    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(scenario_mod.ScenarioService, "simulate_scenario", None))

    sim_res = sim_fn(
        sku_id="SKU-BEV-102",
        store_id="STORE-MIAMI",
        discount_pct=0.0,
        weather_temp_celsius_shift=12.0,
        extreme_weather_flag=True,
        supplier_lead_time_days_shock=3
    )

    risk_pct = sim_res.simulated_stockout_risk_pct if hasattr(sim_res, "simulated_stockout_risk_pct") else sim_res["simulated_stockout_risk_pct"]
    assert risk_pct > 0.0

    # Pass the heatwave surge to the copilot briefing
    req = CopilotBriefingRequest(
        sku_id="SKU-BEV-102",
        sku_name="Electrolyte Sports Drink 1L",
        store_id="STORE-MIAMI",
        current_stock=25,
        p10_forecast=40.0,
        p50_forecast=85.0,
        p90_forecast=130.0,
        safety_stock=35,
        reorder_point=65,
        stockout_risk_pct=risk_pct,
        lead_time_days=3,
        unit_margin_usd=1.20,
        top_drivers=[
            SHAPFeature(feature="heatwave_temp_anomaly_lift", impact="+42% surge")
        ]
    )

    briefing = CopilotService.generate_briefing(req)
    assert "heatwave_temp_anomaly_lift" in briefing.executive_summary
    assert briefing.risk_level in ("CRITICAL", "WARNING")
