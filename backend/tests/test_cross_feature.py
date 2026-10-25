import pytest


def test_cross_data_generator_to_feature_pipeline_to_forecaster():
    """Tier 3: End-to-end integration: Loader -> Polars Pipeline -> LightGBM Quantiles."""
    loader_mod = pytest.importorskip("app.ml.dataset_loader")
    pipe_mod = pytest.importorskip("app.ml.feature_pipeline")
    fore_mod = pytest.importorskip("app.ml.forecaster")

    load_fn = getattr(loader_mod, "load_retail_dataset")
    build_fn = getattr(pipe_mod, "build_feature_matrix")
    forecaster_cls = getattr(fore_mod, "QuantileForecaster")

    # Step 1: Load retail records from dataset loader
    raw_df = load_fn()
    assert raw_df.height > 0

    # Step 2: Vectorized feature transformation
    feature_df = build_fn(raw_df)
    assert "sales_lag_7" in feature_df.columns
    assert "sales_roll_mean_7" in feature_df.columns

    # Step 3: Train multi-quantile forecaster
    forecaster = forecaster_cls()
    losses = forecaster.train(feature_df)
    assert losses["p10"] >= 0.0
    assert losses["p50"] >= 0.0
    assert losses["p90"] >= 0.0

    # Step 4: Inference and monotonic verification
    preds = forecaster.predict(feature_df)
    p10 = preds["p10"]
    p50 = preds["p50"]
    p90 = preds["p90"]
    assert len(p50) == feature_df.height
    for idx in range(len(p50)):
        assert p10[idx] <= p50[idx] + 1e-4 <= p90[idx] + 2e-4


def test_cross_forecaster_to_inventory_engine():
    """Tier 3: Forecaster probabilistic output -> Prescriptive Inventory Engine."""
    inv_mod = pytest.importorskip("app.services.inventory_engine")
    ss_fn = getattr(inv_mod, "calculate_safety_stock")
    rop_fn = getattr(inv_mod, "calculate_reorder_point")
    risk_fn = getattr(inv_mod, "calculate_financial_risk")

    # Given forecast output
    p50_demand = 45.0
    p90_demand = 75.0
    lead_time_mean = 4.0
    lead_time_std = 1.0
    demand_std = 8.0

    # Calculate policy
    ss = ss_fn(
        mean_lead_time=lead_time_mean,
        std_lead_time=lead_time_std,
        mean_demand=p50_demand,
        std_demand=demand_std,
        service_level=0.95
    )
    rop = rop_fn(mean_demand=p50_demand, mean_lead_time=lead_time_mean, safety_stock=ss)

    # Calculate financial risk for current stock = 30 (breaching ROP)
    current_stock = 30
    assert current_stock < rop, "Stock should trigger breach condition"

    risk = risk_fn(
        current_stock=current_stock,
        forecast_p50=p50_demand,
        forecast_p90=p90_demand,
        unit_cost=25.0,
        unit_price=60.0,
        holding_rate=0.20
    )

    # Unit margin = 35.0, Deficit = 15.0 -> loss = 525.0
    assert risk["projected_stockout_loss_usd"] == pytest.approx(525.0)


def test_cross_inventory_breach_to_copilot_briefing():
    """Tier 3: Inventory breach detection -> Copilot executive brief generation."""
    from app.services.copilot_service import (
        CopilotService,
        CopilotBriefingRequest,
        SHAPFeature
    )

    # An inventory breach scenario
    req = CopilotBriefingRequest(
        sku_id="SKU-801",
        sku_name="Organic Dairy Milk",
        store_id="Store-05",
        current_stock=15,
        p10_forecast=40.0,
        p50_forecast=60.0,
        p90_forecast=85.0,
        safety_stock=25,
        reorder_point=55,
        stockout_risk_pct=88.0,
        lead_time_days=2,
        unit_margin_usd=1.80,
        top_drivers=[
            SHAPFeature(feature="weekly_grocery_restock_surge", impact="+22% lift")
        ]
    )

    briefing = CopilotService.generate_briefing(req)
    assert briefing.sku_id == "SKU-801"
    assert briefing.risk_level == "CRITICAL"
    # Deficit = 60.0 - 15 = 45 units. 45 * 1.80 = 81.00 USD
    assert briefing.projected_stockout_loss_usd == pytest.approx(81.00)
    assert "SKU-801" in briefing.executive_summary or "Organic Dairy Milk" in briefing.executive_summary


def test_cross_scenario_simulation_to_safety_stock_scaling():
    """Tier 3: Promo markdown shock -> Forecast curve expansion -> Revised safety buffer."""
    scenario_mod = pytest.importorskip("app.services.scenario_service")
    service_cls = getattr(scenario_mod, "ScenarioService", None)
    sim_fn = getattr(scenario_mod, "simulate_scenario", getattr(service_cls, "simulate_scenario", None))

    res = sim_fn(
        sku_id="SKU-409",
        store_id="Store-12",
        discount_pct=0.25,
        weather_temp_celsius_shift=-12.0,
        extreme_weather_flag=True,
        supplier_lead_time_days_shock=10
    )

    sim_p50 = res.simulated_p50_total if hasattr(res, "simulated_p50_total") else res["simulated_p50_total"]
    base_p50 = res.baseline_p50_total if hasattr(res, "baseline_p50_total") else res["baseline_p50_total"]
    assert sim_p50 >= base_p50

    rev_ss = res.revised_safety_stock_units if hasattr(res, "revised_safety_stock_units") else res["revised_safety_stock_units"]
    rev_rop = res.revised_reorder_point_units if hasattr(res, "revised_reorder_point_units") else res["revised_reorder_point_units"]

    assert isinstance(rev_ss, int) and rev_ss > 0
    assert isinstance(rev_rop, int) and rev_rop > rev_ss
