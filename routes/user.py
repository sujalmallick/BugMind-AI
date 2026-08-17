import os
import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path

import filetype
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.jwt import create_access_token
from auth.security import hash_password, verify_password
from database.models.user import User
from database.session import get_db
from services.organization_service import get_memberships_for_user

router = APIRouter(prefix="/api/me", tags=["Profile"])

# ──────────────────────────────────────────────────
# Allowed MIME types for avatar upload
# ──────────────────────────────────────────────────
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB

AVATARS_DIR = Path("uploads/avatars")
AVATARS_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────
class PatchMeRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    job_title: str | None = None
    location: str | None = None
    # avatar=None clears the avatar; omitting the field entirely is a no-op.
    # Use a sentinel to distinguish "not sent" from "explicitly null".
    avatar: str | None = "__UNSET__"

    model_config = {"populate_by_name": True}


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    current_password: str


# ──────────────────────────────────────────────────
# GET /api/me
# ──────────────────────────────────────────────────
@router.get("")
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at,
        "memberships": get_memberships_for_user(db=db, user_id=current_user.id),
        "bio": current_user.bio,
        "job_title": current_user.job_title,
        "location": current_user.location,
    }


# ──────────────────────────────────────────────────
# PATCH /api/me  — update name; avatar=null clears avatar
# ──────────────────────────────────────────────────
@router.patch("")
def patch_me(
    body: PatchMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changed = False

    if body.name is not None:
        current_user.name = body.name.strip()
        changed = True

    if body.bio is not None:
        current_user.bio = body.bio.strip() if body.bio else None
        changed = True

    if body.job_title is not None:
        current_user.job_title = body.job_title.strip() if body.job_title else None
        changed = True

    if body.location is not None:
        current_user.location = body.location.strip() if body.location else None
        changed = True

    # avatar field explicitly sent as None → clear avatar
    if body.avatar is None:
        if current_user.avatar_url:
            # Remove file from disk if it exists
            _delete_avatar_file(current_user.avatar_url)
        current_user.avatar_url = None
        changed = True

    if changed:
        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
    }


# ──────────────────────────────────────────────────
# POST /api/me/avatar  — upload avatar (MIME-validated, EXIF-stripped)
# ──────────────────────────────────────────────────
@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Read file into memory first to check MIME by content, not extension.
    contents = await file.read()

    if len(contents) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar file must be under 2 MB.",
        )

    # Validate MIME type from file magic bytes — extension spoofing is blocked.
    kind = filetype.guess(contents)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP images are accepted.",
        )

    # Strip EXIF metadata (GPS, device info, etc.) using Pillow.
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(contents))
        # Convert to RGB to drop all metadata channels; re-encode cleanly.
        output_format = "WEBP"  # Normalise everything to webp for efficiency
        img_rgb = img.convert("RGBA") if img.mode in ("RGBA", "LA") else img.convert("RGB")
        buf = io.BytesIO()
        img_rgb.save(buf, format=output_format, quality=90)
        clean_contents = buf.getvalue()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not process the image. Please try a different file.",
        )

    # Collision-proof path: each user gets their own UUID-keyed directory.
    # Two users uploading simultaneously will never collide.
    user_avatar_dir = AVATARS_DIR / str(uuid.uuid5(uuid.NAMESPACE_DNS, f"user-{current_user.id}"))
    user_avatar_dir.mkdir(parents=True, exist_ok=True)

    avatar_path = user_avatar_dir / "avatar.webp"

    with open(avatar_path, "wb") as f:
        f.write(clean_contents)

    # Remove old avatar file if it was at a different path
    if current_user.avatar_url and current_user.avatar_url != str(avatar_path):
        _delete_avatar_file(current_user.avatar_url)

    current_user.avatar_url = str(avatar_path).replace("\\", "/")
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)

    return {"avatar_url": current_user.avatar_url}


# ──────────────────────────────────────────────────
# POST /api/me/password  — change password, invalidate other sessions
# ──────────────────────────────────────────────────
@router.post("/password")
def change_password(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SECURITY: current_password is validated but never logged.
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from current password.",
        )

    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters.",
        )

    current_user.password_hash = hash_password(body.new_password)
    # Bump credentials_updated_at. The auth middleware will now reject any
    # JWT whose iat < this timestamp, instantly invalidating all other sessions.
    # Future security events (email change, MFA) should also bump this field.
    current_user.credentials_updated_at = datetime.utcnow()
    current_user.updated_at = datetime.utcnow()
    db.commit()

    # Issue a fresh token for the current session so it stays valid.
    new_token = create_access_token(
        {"sub": str(current_user.id), "email": current_user.email}
    )

    return {
        "message": "Password updated. All other sessions have been logged out.",
        "access_token": new_token,
        "token_type": "bearer",
    }


# ──────────────────────────────────────────────────
# DELETE /api/me  — soft delete (requires current password)
# ──────────────────────────────────────────────────
@router.delete("")
def delete_account(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SECURITY: password is validated but never logged.
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password.",
        )

    # Soft delete — rows are never hard-deleted.
    # deleted_at / deleted_by allow reversal at the data layer.
    current_user.deleted_at = datetime.utcnow()
    current_user.deleted_by = current_user.id  # self-deletion
    db.commit()

    return JSONResponse(
        status_code=200,
        content={"message": "Account deleted. We are sorry to see you go."},
    )


# ──────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────
def _delete_avatar_file(avatar_url: str) -> None:
    """Remove an avatar file from disk silently (best-effort)."""
    try:
        path = Path(avatar_url)
        if path.exists():
            path.unlink()
    except Exception:
        pass  # Disk errors must never block the API response
