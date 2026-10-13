import math
import threading
import time
from typing import Tuple
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings


class TokenBucketRateLimiter:
    def __init__(self, requests_per_minute: int = 200, burst_capacity: int = 200):
        self.rate = float(requests_per_minute) / 60.0
        self.capacity = float(burst_capacity)
        self._clients: dict[str, Tuple[float, float]] = {}
        self._lock = threading.Lock()

    def check(self, client_ip: str) -> Tuple[bool, float]:
        now = time.monotonic()
        with self._lock:
            tokens, last_time = self._clients.get(client_ip, (self.capacity, now))
            elapsed = now - last_time
            tokens = min(self.capacity, tokens + elapsed * self.rate)

            if tokens >= 1.0:
                tokens -= 1.0
                self._clients[client_ip] = (tokens, now)
                return True, 0.0
            else:
                self._clients[client_ip] = (tokens, now)
                retry_after = (1.0 - tokens) / max(0.001, self.rate)
                return False, retry_after

    def reset(self) -> None:
        with self._lock:
            self._clients.clear()


limiter = TokenBucketRateLimiter(
    requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
    burst_capacity=settings.RATE_LIMIT_BURST,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate_limiter: TokenBucketRateLimiter = limiter):
        super().__init__(app)
        self.limiter = rate_limiter

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED or request.method == "OPTIONS":
            return await call_next(request)

        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client and request.client.host:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

        allowed, retry_after = self.limiter.check(client_ip)
        if not allowed:
            wait_seconds = max(1, int(math.ceil(retry_after)))
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please wait before retrying.",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                },
                headers={"Retry-After": str(wait_seconds)},
            )

        return await call_next(request)
