from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from fastapi.security import OAuth2PasswordRequestForm
from auth.dependencies import get_current_user

from schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)

from services.auth_service import (
    register_user,
    login_user,
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
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    return register_user(
        db=db,
        request=request,
    )

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return login_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )

@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return current_user