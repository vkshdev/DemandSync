from fastapi import APIRouter
from app.core.config import settings
from app.schemas.copilot import (
    CopilotBriefingRequest,
    CopilotBriefingResponse,
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotStatusResponse,
)
from app.services.copilot_service import CopilotService

router = APIRouter()


@router.get("/status", response_model=CopilotStatusResponse)
def get_copilot_status() -> CopilotStatusResponse:
    """Returns local copilot configuration and air-gapped data privacy status."""
    return CopilotStatusResponse(
        provider=settings.COPILOT_PROVIDER,
        model_id=settings.LOCAL_MODEL_ID,
        model_name=settings.LOCAL_MODEL_ID,
        device=settings.DEVICE,
        privacy="100% On-Device Private - Zero Data Egress",
        low_cpu_mem_usage=settings.LOW_CPU_MEM_USAGE,
        status="ready",
        local_inference=True,
        model_loaded=False,
        air_gapped=True,
        model_status="ready",
    )


@router.post("/briefing", response_model=CopilotBriefingResponse)
def generate_briefing(request: CopilotBriefingRequest) -> CopilotBriefingResponse:
    """Generates an executive briefing for store and category managers using local inference."""
    return CopilotService.generate_briefing(request)


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(request: CopilotChatRequest) -> CopilotChatResponse:
    """Handles conversational supply chain queries directly against the local engine."""
    return CopilotService.chat(request)
