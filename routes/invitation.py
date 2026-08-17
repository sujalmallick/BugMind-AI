"""
routes/invitation.py

Phase 3 — Invitation endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from services.invitation_service import (
    accept_invitation,
    create_invitation,
    decline_invitation,
    list_invitations,
    resolve_token,
    revoke_invitation,
)

router = APIRouter(prefix="/invitations", tags=["Invitations"])


class InviteCreate(BaseModel):
    type: str                         # 'project' | 'organization'
    target_id: int
    role: str = "viewer"
    invited_email: Optional[str] = None
    expiry_hours: int = 48


@router.post("/")
def create_invite(
    body: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_invitation(
        db=db,
        invite_type=body.type,
        target_id=body.target_id,
        role=body.role,
        invited_by=current_user.id,
        invited_email=body.invited_email,
        expiry_hours=body.expiry_hours,
    )


@router.get("/")
def get_invitations(
    type: str = Query(...),
    target_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_invitations(db, type, target_id, current_user.id)


@router.get("/{token}")
def get_invite_by_token(
    token: str,
    db: Session = Depends(get_db),
):
    """Public route — no auth required. Used by the accept page."""
    return resolve_token(db, token)


@router.post("/{token}/accept")
def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return accept_invitation(db, token, current_user.id)


@router.post("/{token}/decline")
def decline_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return decline_invitation(db, token, current_user.id)


@router.delete("/{token}")
def revoke_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return revoke_invitation(db, token, current_user.id)
