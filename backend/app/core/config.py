import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "DemandSync"
    API_V1_STR: str = "/api/v1"

    # CORS Whitelist Configuration
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    # In-memory Rate Limiting Configuration
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "200"))
    RATE_LIMIT_BURST: int = int(os.getenv("RATE_LIMIT_BURST", "200"))
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")

    # Copilot AI Configuration
    # Options: "local_qwen" (default on-device private), "groq", "gemini", "mock"
    COPILOT_PROVIDER: str = os.getenv("COPILOT_PROVIDER", "local_qwen")

    # Local HuggingFace Model Settings
    LOCAL_MODEL_ID: str = os.getenv("LOCAL_MODEL_ID", "Qwen/Qwen2.5-1.5B-Instruct")
    DEVICE: str = os.getenv("DEVICE", "cpu")
    LOW_CPU_MEM_USAGE: bool = True
    MAX_NEW_TOKENS: int = int(os.getenv("MAX_NEW_TOKENS", "256"))
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", "0.2"))

    # Optional Cloud API Keys (for testing with pseudonymized masking)
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY", None)
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", None)


settings = Settings()
