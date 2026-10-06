import bcrypt
from fastapi import HTTPException, status

# bcrypt only uses the first 72 bytes and bcrypt>=5 raises ValueError beyond it.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


def validate_new_password(password: str) -> None:
    """Reject passwords bcrypt can't hash faithfully (400, not a 500)."""
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at most {MAX_PASSWORD_BYTES} bytes long",
        )


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()

    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        salt,
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:

    encoded = plain_password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        return False  # can't match any stored hash; bcrypt>=5 would raise
    return bcrypt.checkpw(
        encoded,
        hashed_password.encode("utf-8"),
    )


# Used when the account doesn't exist, so login takes the same time either way
# (otherwise response timing reveals which emails are registered).
_DUMMY_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt()).decode("utf-8")


def burn_password_check(plain_password: str) -> None:
    verify_password(plain_password, _DUMMY_HASH)