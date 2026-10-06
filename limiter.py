import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request) -> str:
    """
    The caller's IP. Behind a reverse proxy (Azure App Service front-end) the
    socket peer is the proxy, so every user would share one bucket. When
    RATE_LIMIT_TRUST_PROXY_HEADERS=true, use the right-most X-Forwarded-For
    entry: the address the trusted proxy itself saw (left-most entries are
    client-supplied and spoofable). Only enable this behind a proxy that always
    sets the header.
    """
    if os.getenv("RATE_LIMIT_TRUST_PROXY_HEADERS", "").lower() in ("1", "true", "yes"):
        forwarded = request.headers.get("x-forwarded-for", "")
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return hops[-1].split(":")[0] if hops[-1].count(":") == 1 else hops[-1]
    return get_remote_address(request)


def rate_limit_key(request) -> str:
    """Authenticated callers are limited per user; everyone else per IP."""
    auth = request.headers.get("authorization", "")
    if auth[:7].lower() == "bearer ":
        from auth.jwt import verify_access_token

        try:
            return f"user:{verify_access_token(auth[7:].strip())['sub']}"
        except Exception:
            pass  # invalid token: fall back to IP so it can't dodge limits
    return f"ip:{client_ip(request)}"


limiter = Limiter(key_func=rate_limit_key, default_limits=["300/minute"])
