import os
import logging
from datetime import datetime

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from database.models.user import User
from auth.security import (
    hash_password,
    verify_password,
)
from auth.jwt import create_access_token
from auth.password_reset import (
    PASSWORD_RESET_EXPIRE_MINUTES,
    create_password_reset_token,
    read_password_reset_token,
    password_fingerprint_matches,
)
from services.email_service import send_password_reset_email

logger = logging.getLogger("BugMind")

from schemas.auth import (
    RegisterRequest,
    LoginRequest,
)


def register_user(
    db: Session,
    request: RegisterRequest,
):

    existing_user = (
        db.query(User)
        .filter(User.email == request.email.lower().strip())
        .first()
    )

    if not request.password or len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long",
        )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=request.name,
        email=request.email.lower().strip(),
        password_hash=hash_password(
            request.password
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def login_user(
    db: Session,
    email: str,
    password: str,
):

    user = (
        db.query(User)
        .filter(User.email == email.lower().strip())
        .first()
    )

    if (
        not user
        or not verify_password(
            password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


def request_password_reset(
    db: Session,
    email: str,
):
    # SECURITY: the response is identical whether or not the account exists,
    # so this endpoint can't be used to discover registered emails.
    generic_response = {
        "message": "If an account exists for that email, a password reset link has been sent.",
    }

    user = (
        db.query(User)
        .filter(User.email == email.lower().strip())
        .first()
    )

    if not user or user.deleted_at is not None:
        return generic_response

    token = create_password_reset_token(user.id, user.password_hash)
    frontend_url = os.getenv("FRONTEND_URL", "https://black-smoke-05d3e7e00.5.azurestaticapps.net")
    reset_url = f"{frontend_url.rstrip('/')}/reset-password?token={token}"

    send_password_reset_email(
        to_email=user.email,
        reset_url=reset_url,
        user_name=user.name or "there",
        expire_minutes=PASSWORD_RESET_EXPIRE_MINUTES,
    )

    return generic_response


def reset_password(
    db: Session,
    token: str,
    new_password: str,
):
    invalid_link = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired. Please request a new one.",
    )

    decoded = read_password_reset_token(token)
    if decoded is None:
        raise invalid_link

    user_id, fingerprint = decoded
    user = db.query(User).filter(User.id == user_id).first()

    # Fingerprint mismatch means the password already changed since the
    # link was issued, i.e. the link was used or superseded.
    if (
        not user
        or user.deleted_at is not None
        or not password_fingerprint_matches(fingerprint, user.password_hash)
    ):
        raise invalid_link

    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long",
        )

    user.password_hash = hash_password(new_password)
    # Log out every existing session; see change_password in routes/user.py
    # for why this is truncated to whole seconds.
    user.credentials_updated_at = datetime.utcnow().replace(microsecond=0)
    user.updated_at = datetime.utcnow()
    db.commit()

    logger.info(f"Password reset completed for user={user.id}")

    return {
        "message": "Your password has been reset. Please sign in with your new password.",
    }
