import uuid
import asyncio
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("BugMind")

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Redact sensitive headers for logging
        redact = {"authorization", "cookie"}
        safe_headers = {
            k: ("***" if k.lower() in redact else v)
            for k, v in request.headers.items()
        }
        
        logger.info(f"[{request_id}] {request.method} {request.url.path} headers={safe_headers}")
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        max_bytes = 5 * 1024 * 1024  # 5MB
        
        # Check header if present
        if request.headers.get("content-length"):
            try:
                if int(request.headers["content-length"]) > max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Payload Too Large"}
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length Header"}
                )
                
        return await call_next(request)

class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # AI routes need longer timeout
        timeout = 180 if "analyze" in request.url.path else 30
        try:
            return await asyncio.wait_for(call_next(request), timeout=timeout)
        except asyncio.TimeoutError:
            return JSONResponse(status_code=504, content={"detail": "Gateway Timeout"})
