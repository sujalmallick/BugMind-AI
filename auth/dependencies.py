from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from auth.jwt import verify_access_token
from jose import JWTError, ExpiredSignatureError
from database.session import get_db
from database.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    try:
        payload = verify_access_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Reject soft-deleted accounts immediately.
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    # Reject tokens that predate the last security event (e.g. password change).
    # NOTE: This lookup runs on every authenticated request -- that is the
    # intentional cost of stateless, immediate session invalidation.
    if user.credentials_updated_at is not None:
        iat_raw = payload.get("iat")
        if iat_raw is not None:
            iat = datetime.fromtimestamp(iat_raw, tz=timezone.utc)
            cua = user.credentials_updated_at.replace(tzinfo=timezone.utc)
            if iat < cua:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired -- please log in again",
                )

    return user