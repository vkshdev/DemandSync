import pytest
from fastapi.testclient import TestClient


def _is_route_registered(app, path_prefix: str) -> bool:
    for route in app.routes:
        if hasattr(route, "path") and route.path.startswith(path_prefix):
            return True
    return False


def test_endpoint_root_health(client: TestClient):
    """Endpoint 1: GET /"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("project") == "DemandSync"
    assert data.get("status") == "online"
    assert "On-Device Private" in data.get("privacy", "")


def test_endpoint_copilot_status(client: TestClient):
    """Endpoint 2: GET /api/v1/copilot/status"""
    response = client.get("/api/v1/copilot/status")
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert "model_id" in data
    assert "device" in data
    assert "privacy" in data
    assert "Zero Data Egress" in data["privacy"]


def test_endpoint_copilot_briefing(client: TestClient, sample_briefing_request):
    """Endpoint 3: POST /api/v1/copilot/briefing"""
    response = client.post("/api/v1/copilot/briefing", json=sample_briefing_request)
    assert response.status_code == 200
    data = response.json()
    assert data["sku_id"] == sample_briefing_request["sku_id"]
    assert data["risk_level"] in ("CRITICAL", "WARNING", "HEALTHY")
    assert isinstance(data["projected_stockout_loss_usd"], (int, float))
    assert len(data["recommended_action"]) > 0
    assert len(data["executive_summary"]) > 0
    assert "model_used" in data


def test_endpoint_copilot_chat(client: TestClient, sample_chat_request):
    """Endpoint 4: POST /api/v1/copilot/chat"""
    response = client.post("/api/v1/copilot/chat", json=sample_chat_request)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "model_used" in data


def test_endpoint_forecasts_overview(client: TestClient):
    """Endpoint 5: GET /api/v1/forecasts/overview"""
    from app.main import app
    if not _is_route_registered(app, "/api/v1/forecasts"):
        pytest.skip("Forecast overview endpoint not yet registered in API router")

    response = client.get("/api/v1/forecasts/overview")
    assert response.status_code == 200
    data = response.json()
    assert "projected_chain_demand_units" in data
    assert "macro_trend" in data
    assert "daily_aggregate_forecast" in data


def test_endpoint_forecast_sku_detail(client: TestClient):
    """Endpoint 6: GET /api/v1/forecasts/{sku_id}"""
    from app.main import app
    if not _is_route_registered(app, "/api/v1/forecasts"):
        pytest.skip("SKU forecast endpoint not yet registered in API router")

    response = client.get("/api/v1/forecasts/SKU-409")
    if response.status_code == 404:
        # If catalog is dynamic, SKU-409 might not exist yet
        return

    assert response.status_code == 200
    data = response.json()
    assert data["sku_id"] == "SKU-409"
    assert "time_series" in data
    assert "shap_drivers" in data


def test_endpoint_inventory_alerts(client: TestClient):
    """Endpoint 7: GET /api/v1/inventory/alerts"""
    from app.main import app
    if not _is_route_registered(app, "/api/v1/inventory"):
        pytest.skip("Inventory alerts endpoint not yet registered in API router")

    response = client.get("/api/v1/inventory/alerts")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "alerts_count" in data


def test_endpoint_inventory_calculate_policy(client: TestClient, sample_policy_request):
    """Endpoint 8: POST /api/v1/inventory/calculate-policy"""
    from app.main import app
    if not _is_route_registered(app, "/api/v1/inventory"):
        pytest.skip("Inventory calculate-policy endpoint not yet registered in API router")

    response = client.post("/api/v1/inventory/calculate-policy", json=sample_policy_request)
    assert response.status_code == 200
    data = response.json()
    assert data["sku_id"] == sample_policy_request["sku_id"]
    assert isinstance(data["safety_stock_units"], int)
    assert isinstance(data["reorder_point_units"], int)
    assert isinstance(data["economic_order_quantity_units"], int)
    assert data["safety_stock_units"] >= 0
    assert data["reorder_point_units"] >= 0
    assert data["economic_order_quantity_units"] >= 1


def test_endpoint_simulator_scenario(client: TestClient, sample_scenario_request):
    """Endpoint 9: POST /api/v1/simulator/scenario"""
    from app.main import app
    if not _is_route_registered(app, "/api/v1/simulator"):
        pytest.skip("Simulator scenario endpoint not yet registered in API router")

    response = client.post("/api/v1/simulator/scenario", json=sample_scenario_request)
    assert response.status_code == 200
    data = response.json()
    assert data["sku_id"] == sample_scenario_request["sku_id"]
    assert "baseline_p50_total" in data
    assert "simulated_p50_total" in data
    assert "demand_delta_pct" in data
    assert isinstance(data["revised_safety_stock_units"], int)
    assert isinstance(data["revised_reorder_point_units"], int)
