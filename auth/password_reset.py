import hashlib
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from auth.config import SECRET_KEY, ALGORITHM

PASSWORD_RESET_EXPIRE_MINUTES = 30

_PURPOSE = "password_reset"


def _password_fingerprint(password_hash: str) -> str:
    # Ties the token to the current password: once the password changes,
    # the fingerprint no longer matches, so each reset link works only once.
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


def create_password_reset_token(user_id: int, password_hash: str) -> str:
    payload = {
        "sub": str(user_id),
        "purpose": _PURPOSE,
        "fp": _password_fingerprint(password_hash),
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def read_password_reset_token(token: str) -> tuple[int, str] | None:
    """
    Returns (user_id, password_fingerprint) for a valid, unexpired reset
    token, otherwise None. The caller must compare the fingerprint against
    the user's current password hash with password_fingerprint_matches().
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    # A normal access token must never be usable as a reset token.
    if payload.get("purpose") != _PURPOSE:
        return None

    try:
        return int(payload["sub"]), payload["fp"]
    except (KeyError, TypeError, ValueError):
        return None


def password_fingerprint_matches(fingerprint: str, password_hash: str) -> bool:
    return fingerprint == _password_fingerprint(password_hash)
