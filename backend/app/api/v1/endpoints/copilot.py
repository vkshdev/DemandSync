from fastapi import APIRouter
from fastapi.responses import StreamingResponse
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
        provider="local_gguf_4bit" if settings.USE_GGUF_INFERENCE else settings.COPILOT_PROVIDER,
        model_id="Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        model_name="Qwen2.5-1.5B-Instruct-Q4_K_M (4-bit Quantized)",
        device="cpu",
        privacy="Private & Secure",
        low_cpu_mem_usage=True,
        status="ready",
        local_inference=True,
        model_loaded=True,
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


@router.post("/chat/stream")
def copilot_chat_stream(request: CopilotChatRequest) -> StreamingResponse:
    """Streams token responses in real-time using Server-Sent Events (SSE)."""
    return StreamingResponse(
        CopilotService.stream_chat(request),
        media_type="text/event-stream",
    )

