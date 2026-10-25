from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limiter import RateLimitMiddleware, limiter

logger = logging.getLogger("demandsync.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Auto-seed DuckDB if unpopulated (run off-thread in production)
    import os
    if not os.getenv("TESTING"):
        try:
            import asyncio
            from app.ml.dataset_loader import seed_database_if_empty

            await asyncio.to_thread(seed_database_if_empty)
        except Exception as exc:
            logger.warning("Failed to auto-seed database during startup: %s", exc)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "DemandSync: AI-Driven Probabilistic Demand Forecasting & "
        "Retail Prescriptive Analytics Engine with Private Local Qwen2.5 Copilot."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware, rate_limiter=limiter)

# Restrictive CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Internal unhandled exception: %s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error occurred",
            "error_code": "INTERNAL_SERVER_ERROR",
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code == 500:
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error occurred",
                "error_code": "INTERNAL_SERVER_ERROR",
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": getattr(exc, "error_code", f"HTTP_{exc.status_code}"),
        },
        headers=exc.headers,
    )


@app.get("/")
def root():
    return {
        "status": "online",
        "project": "DemandSync",
        "app": "DemandSync",
        "version": "1.0.0",
        "docs_url": "/docs",
        "privacy": "100% On-Device Private Architecture",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
