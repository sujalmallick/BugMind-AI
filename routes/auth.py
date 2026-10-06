from fastapi import APIRouter, Depends, Request
from limiter import limiter
from sqlalchemy.orm import Session

from database.session import get_db
from fastapi.security import OAuth2PasswordRequestForm
from auth.dependencies import get_current_user

from schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

from services.auth_service import (
    register_user,
    login_user,
    request_password_reset,
    reset_password,
)

from database.models.user import User

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
)
@limiter.limit("3/minute")
def register(
    request: Request,
    request_data: RegisterRequest,
    db: Session = Depends(get_db),
):
    return register_user(
        db=db,
        request=request_data,
    )

@router.post(
    "/login",
    response_model=TokenResponse,
)
@limiter.limit("5/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return login_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    request_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    return request_password_reset(
        db=db,
        email=request_data.email,
    )


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password_route(
    request: Request,
    request_data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    return reset_password(
        db=db,
        token=request_data.token,
        new_password=request_data.new_password,
    )

from pathlib import Path

@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    if current_user.avatar_url and not current_user.avatar_url.startswith(("http://", "https://")):
        if not Path(current_user.avatar_url).exists():
            current_user.avatar_url = None
            db.commit()
            db.refresh(current_user)
    return current_user