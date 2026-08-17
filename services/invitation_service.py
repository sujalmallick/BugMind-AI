"""
services/invitation_service.py

Business logic for Phase 3: Invitation system.
Handles generating, validating, accepting, and revoking invitations
for both Projects and Organizations.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger("BugMind")

from database.models.invitation import Invitation
from database.models.user import User
from services.activity_service import log_activity, Verb


# Default invite expiry
DEFAULT_EXPIRY_HOURS = 48


# ── Serializer ────────────────────────────────────────────────────────────────

def _serialize(inv: Invitation, include_target_info: bool = False) -> dict:
    return {
        "id": inv.id,
        "token": inv.token,
        "type": inv.type,
        "target_id": inv.target_id,
        "role": inv.role,
        "invited_email": inv.invited_email,
        "invited_by": inv.invited_by,
        "status": inv.status,
        "expires_at": inv.expires_at,
        "created_at": inv.created_at,
        "accepted_at": inv.accepted_at,
        "inviter": {
            "id": inv.inviter.id,
            "name": inv.inviter.name,
            "email": inv.inviter.email,
        } if inv.inviter else None,
    }


# ── Token Generation ──────────────────────────────────────────────────────────

def create_invitation(
    db: Session,
    invite_type: str,          # 'project' | 'organization'
    target_id: int,
    role: str,
    invited_by: int,
    invited_email: Optional[str] = None,
    expiry_hours: int = DEFAULT_EXPIRY_HOURS,
) -> dict:
    """
    Create a new invitation. Enforces that the requester has admin+ role
    on the target before issuing an invite.
    """
    _check_invite_permission(db, invite_type, target_id, invited_by)

    # Revoke any existing pending invite to the same email/target
    if invited_email:
        existing = (
            db.query(Invitation)
            .filter(
                Invitation.type == invite_type,
                Invitation.target_id == target_id,
                Invitation.invited_email == invited_email.lower(),
                Invitation.status == "pending",
            )
            .first()
        )
        if existing:
            existing.status = "revoked"
            db.flush()

    token = secrets.token_urlsafe(64)
    expires = datetime.utcnow() + timedelta(hours=expiry_hours)

    inv = Invitation(
        token=token,
        type=invite_type,
        target_id=target_id,
        role=role,
        invited_email=invited_email.lower() if invited_email else None,
        invited_by=invited_by,
        status="pending",
        expires_at=expires,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    # Log invitation creation (token omitted for security)
    logger.info(f"Created invitation ID={inv.id} for email={invited_email or 'anyone'}")

    return _serialize(inv)


# ── Resolve Token (public) ────────────────────────────────────────────────────

def resolve_token(db: Session, token: str) -> dict:
    """
    Public endpoint – resolve a token and return metadata about the invitation.
    Marks it expired if past expiry date. Does NOT require auth.
    """
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or invalid.")

    # Auto-expire if past due
    if inv.status == "pending" and inv.expires_at and datetime.utcnow() > inv.expires_at:
        inv.status = "expired"
        db.commit()
        db.refresh(inv)

    # Enrich with target name
    target_name = _get_target_name(db, inv.type, inv.target_id)

    result = _serialize(inv)
    result["target_name"] = target_name
    return result


# ── Accept Invitation ─────────────────────────────────────────────────────────

def accept_invitation(db: Session, token: str, user_id: int) -> dict:
    """
    Accept an invitation. Validates the token, checks eligibility, then
    adds the user to the target project or organization with the given role.
    """
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or invalid.")

    if inv.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"This invitation is already {inv.status}.",
        )

    if inv.expires_at and datetime.utcnow() > inv.expires_at:
        inv.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="This invitation has expired.")

    # If directed at a specific email, make sure the current user's email matches
    if inv.invited_email:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.email.lower() != inv.invited_email:
            raise HTTPException(
                status_code=403,
                detail="This invitation was sent to a different email address.",
            )

    # Grant access
    if inv.type == "project":
        _grant_project_access(db, inv.target_id, user_id, inv.role, inv.invited_by)
    elif inv.type == "organization":
        _grant_org_access(db, inv.target_id, user_id, inv.role)

    # Mark accepted
    inv.status = "accepted"
    inv.accepted_by = user_id
    inv.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(inv)
    
    # Log invitation acceptance
    # If project invitation, log to project_id. If org, log to org_id.
    log_activity(
        db=db,
        verb=Verb.INVITE_ACCEPTED,
        entity_type="invitation",
        entity_id=inv.id,
        entity_label=inv.invited_email or "Share Link",
        actor_id=user_id,
        project_id=inv.target_id if inv.type == "project" else None,
        org_id=inv.target_id if inv.type == "organization" else None,
        meta={"type": inv.type, "role": inv.role}
    )

    target_name = _get_target_name(db, inv.type, inv.target_id)
    result = _serialize(inv)
    result["target_name"] = target_name
    return result


# ── Decline Invitation ────────────────────────────────────────────────────────

def decline_invitation(db: Session, token: str, user_id: int) -> dict:
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is already {inv.status}.")

    inv.status = "declined"
    inv.accepted_by = user_id
    inv.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


# ── Revoke Invitation ─────────────────────────────────────────────────────────

def revoke_invitation(db: Session, token: str, requester_id: int) -> dict:
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    _check_invite_permission(db, inv.type, inv.target_id, requester_id)

    if inv.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending invitations can be revoked.")

    inv.status = "revoked"
    db.commit()
    return {"message": "Invitation revoked."}


# ── List Invitations ──────────────────────────────────────────────────────────

def list_invitations(
    db: Session,
    invite_type: str,
    target_id: int,
    requester_id: int,
) -> list[dict]:
    _check_invite_permission(db, invite_type, target_id, requester_id)

    invites = (
        db.query(Invitation)
        .filter(
            Invitation.type == invite_type,
            Invitation.target_id == target_id,
            Invitation.status == "pending",
        )
        .order_by(Invitation.created_at.desc())
        .all()
    )
    return [_serialize(i) for i in invites]


# ── Private helpers ───────────────────────────────────────────────────────────

def _check_invite_permission(db: Session, invite_type: str, target_id: int, user_id: int):
    """Raise 403 if the user doesn't have admin+ on the target."""
    if invite_type == "project":
        from auth.permissions import require_project_role
        require_project_role(db, user_id, target_id, "admin")
    elif invite_type == "organization":
        from auth.permissions import require_org_role
        require_org_role(db, user_id, target_id, "admin")
    else:
        raise HTTPException(status_code=400, detail="Invalid invitation type.")


def _get_target_name(db: Session, invite_type: str, target_id: int) -> str:
    if invite_type == "project":
        from database.models.project import Project
        obj = db.query(Project).filter(Project.id == target_id).first()
        return obj.name if obj else "Unknown Project"
    elif invite_type == "organization":
        from database.models.organization import Organization
        obj = db.query(Organization).filter(Organization.id == target_id).first()
        return obj.name if obj else "Unknown Organization"
    return "Unknown"


def _grant_project_access(db: Session, project_id: int, user_id: int, role: str, granted_by: int):
    from database.models.project_member import ProjectMember

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if existing:
        # Upgrade role if higher
        from auth.permissions import PROJECT_ROLE_HIERARCHY
        if PROJECT_ROLE_HIERARCHY.get(role, -1) > PROJECT_ROLE_HIERARCHY.get(existing.role, -1):
            existing.role = role
    else:
        db.add(ProjectMember(
            project_id=project_id,
            user_id=user_id,
            role=role,
            granted_by=granted_by,
        ))
    db.flush()


def _grant_org_access(db: Session, org_id: int, user_id: int, role: str):
    from database.models.organization_member import OrganizationMember

    existing = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        .first()
    )
    if existing:
        # Update to the invited role only if it is a promotion.
        # Never demote via invitation (e.g. re-inviting as member shouldn't
        # strip an existing admin of their role).
        from auth.permissions import ROLE_HIERARCHY
        if ROLE_HIERARCHY.get(role, 0) > ROLE_HIERARCHY.get(existing.role, 0):
            existing.role = role
    else:
        db.add(OrganizationMember(
            organization_id=org_id,
            user_id=user_id,
            role=role,
        ))
    db.flush()

