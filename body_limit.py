"""
Streamed request-body limit.

MaxBodySizeMiddleware only checks the Content-Length header, which a client
can omit by sending Transfer-Encoding: chunked. This pure ASGI middleware
counts the bytes actually received and aborts with 413 once over the limit.
"""

import json
import os
import re

from fastapi import HTTPException

DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024
# Document uploads (10 MB files) need a little more, on that one route only.
DOCUMENT_UPLOAD_MAX_BODY_BYTES = 11 * 1024 * 1024
_DOCUMENT_UPLOAD_PATH = re.compile(r"^/projects/\d+/documents/?$")


def max_body_bytes_for(method: str, path: str, default: int) -> int:
    if method == "POST" and _DOCUMENT_UPLOAD_PATH.match(path or ""):
        return max(default, int(os.getenv("DOCUMENT_UPLOAD_MAX_BODY_BYTES", DOCUMENT_UPLOAD_MAX_BODY_BYTES)))
    return default


class _BodyTooLarge(HTTPException):
    # An HTTPException so FastAPI's body parser re-raises it as a 413 instead
    # of wrapping it in a generic 400 "error parsing the body".
    def __init__(self):
        super().__init__(status_code=413, detail="Payload Too Large")


class StreamingBodyLimitMiddleware:
    def __init__(self, app, max_bytes: int | None = None):
        self.app = app
        self.max_bytes = max_bytes or int(os.getenv("MAX_REQUEST_BODY_BYTES", DEFAULT_MAX_BODY_BYTES))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        received = 0
        response_started = False
        max_bytes = max_body_bytes_for(scope.get("method", ""), scope.get("path", ""), self.max_bytes)

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if response_started:
                raise
            body = json.dumps({"detail": "Payload Too Large"}).encode()
            await send({
                "type": "http.response.start",
                "status": 413,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
            })
            await send({"type": "http.response.body", "body": body})
