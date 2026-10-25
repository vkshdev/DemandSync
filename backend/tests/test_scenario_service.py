import pytest


def test_scenario_simulation_response_structure():
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    sim_fn = getattr(scenario_mod, "simulate_scenario", None)
    if sim_fn is None:
        service_cls = getattr(scenario_mod, "ScenarioService", None)
        assert service_cls is not None, "simulate_scenario or ScenarioService required"
        sim_fn = getattr(service_cls, "simulate_scenario")

    res = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.20,
        weather_temp_celsius_shift=-10.0,
        extreme_weather_flag=True,
        supplier_lead_time_days_shock=7
    )

    if hasattr(res, "model_dump"):
        res = res.model_dump()

    required_keys = [
        "sku_id", "store_id", "simulation_horizon_days",
        "baseline_p50_total", "simulated_p50_total", "demand_delta_pct",
        "baseline_stockout_risk_pct", "simulated_stockout_risk_pct",
        "revised_safety_stock_units", "revised_reorder_point_units",
        "daily_simulation_series"
    ]
    for key in required_keys:
        assert key in res, f"Scenario response missing required key: {key}"

    assert isinstance(res["revised_safety_stock_units"], int), "revised_safety_stock_units must be int"
    assert isinstance(res["revised_reorder_point_units"], int), "revised_reorder_point_units must be int"


def test_scenario_promo_discount_boosts_demand():
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    service_cls = getattr(scenario_mod, "ScenarioService", None)
    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(service_cls, "simulate_scenario", None))

    res_no_promo = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.0,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=4
    )
    res_high_promo = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.25,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=4
    )

    base = res_no_promo.simulated_p50_total if hasattr(res_no_promo, "simulated_p50_total") else res_no_promo["simulated_p50_total"]
    promo = res_high_promo.simulated_p50_total if hasattr(res_high_promo, "simulated_p50_total") else res_high_promo["simulated_p50_total"]

    assert promo >= base, f"Promotional markdown should stimulate higher or equal demand: {promo} vs {base}"


def test_scenario_lead_time_shock_increases_buffers():
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    service_cls = getattr(scenario_mod, "ScenarioService", None)
    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(service_cls, "simulate_scenario", None))

    res_normal = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.10,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=3
    )
    res_shock = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.10,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=14
    )

    ss_normal = res_normal.revised_safety_stock_units if hasattr(res_normal, "revised_safety_stock_units") else res_normal["revised_safety_stock_units"]
    ss_shock = res_shock.revised_safety_stock_units if hasattr(res_shock, "revised_safety_stock_units") else res_shock["revised_safety_stock_units"]

    assert ss_shock >= ss_normal, (
        f"Supplier transit delay should increase required safety stock: {ss_shock} vs {ss_normal}"
    )


def test_scenario_daily_series_consistency():
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    service_cls = getattr(scenario_mod, "ScenarioService", None)
    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(service_cls, "simulate_scenario", None))

    res = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.15,
        weather_temp_celsius_shift=-5.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=5
    )

    series = res.daily_simulation_series if hasattr(res, "daily_simulation_series") else res["daily_simulation_series"]
    assert len(series) > 0

    for item in series:
        if hasattr(item, "model_dump"):
            item = item.model_dump()
        p10 = item.get("simulated_p10", 0.0)
        p50 = item.get("simulated_p50", 0.0)
        p90 = item.get("simulated_p90", 0.0)
        assert p10 <= p50 + 1e-5, f"Daily simulation crossing: p10={p10} > p50={p50}"
        assert p50 <= p90 + 1e-5, f"Daily simulation crossing: p50={p50} > p90={p90}"


def test_scenario_delta_percentage_math():
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    service_cls = getattr(scenario_mod, "ScenarioService", None)
    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(service_cls, "simulate_scenario", None))

    res = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.20,
        weather_temp_celsius_shift=0.0,
        extreme_weather_flag=False,
        supplier_lead_time_days_shock=4
    )

    baseline = res.baseline_p50_total if hasattr(res, "baseline_p50_total") else res["baseline_p50_total"]
    simulated = res.simulated_p50_total if hasattr(res, "simulated_p50_total") else res["simulated_p50_total"]
    delta_pct = res.demand_delta_pct if hasattr(res, "demand_delta_pct") else res["demand_delta_pct"]

    expected_delta = round(((simulated - baseline) / baseline) * 100.0, 2)
    assert delta_pct == pytest.approx(expected_delta, rel=1e-2)
