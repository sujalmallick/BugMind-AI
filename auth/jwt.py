from datetime import datetime, timedelta, timezone

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from auth.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_DELTA,
)


def create_access_token(data: dict) -> str:
    payload = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + ACCESS_TOKEN_EXPIRE_DELTA
    )

    payload.update(
        {
            "exp": expire,
            # iat is used by auth middleware to invalidate sessions
            # that predate a security event (password change, etc.).
            "iat": datetime.now(timezone.utc),
        }
    )

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def verify_access_token(token: str):
    """Decode a session token. Raises ExpiredSignatureError / InvalidTokenError."""
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )

    # Purpose-scoped tokens (password reset, ...) share the signing key but
    # must never work as a session. Access tokens always carry iat, which the
    # revocation check in auth.dependencies relies on.
    if payload.get("purpose") is not None or payload.get("iat") is None:
        raise InvalidTokenError("Not an access token")

    return payload


STREAM_TICKET_TTL_SECONDS = 60


def create_stream_ticket(user_id: int) -> str:
    """
    Short-lived, single-purpose token for the SSE stream. EventSource can't
    send headers, so the credential ends up in the URL (and in proxy logs);
    a 60-second ticket that only opens the stream is safe to leak there.
    """
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "purpose": "sse",
            "iat": now,
            "exp": now + timedelta(seconds=STREAM_TICKET_TTL_SECONDS),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def verify_purpose_token(token: str, purpose: str):
    """Decode a purpose-scoped token. Raises ExpiredSignatureError / InvalidTokenError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("purpose") != purpose or payload.get("iat") is None:
        raise InvalidTokenError(f"Not a {purpose} token")
    return payload
