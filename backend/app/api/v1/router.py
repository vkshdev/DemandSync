from fastapi import APIRouter
from app.api.v1.endpoints import copilot, forecasts, inventory, simulator, system

api_router = APIRouter()
api_router.include_router(copilot.router, prefix="/copilot", tags=["AI Executive Copilot (Local Qwen2.5)"])
api_router.include_router(forecasts.router, prefix="/forecasts", tags=["Probabilistic Demand Forecasts"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Prescriptive Inventory Optimization"])
api_router.include_router(simulator.router, prefix="/simulator", tags=["What-If Scenario Simulation"])
api_router.include_router(system.router, prefix="/system", tags=["System Health & Drift Monitoring"])
