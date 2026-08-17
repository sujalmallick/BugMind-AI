"""
services/organization_service.py

Business logic for organizations and teams.
All DB mutations go through here so routes stay thin.
"""

import re
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database.models.organization import Organization
from database.models.organization_member import OrganizationMember
from database.models.team import Team
from database.models.team_member import TeamMember
from database.models.user import User


# ── Helpers ──────────────────────────────────────────────────────────────────

def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-") or "org"


def _ensure_unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    """Append a numeric suffix if the slug is already taken."""
    slug = base
    counter = 1
    while True:
        query = db.query(Organization).filter(
            Organization.slug == slug,
            Organization.deleted_at.is_(None),
        )
        if exclude_id:
            query = query.filter(Organization.id != exclude_id)
        if not query.first():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


def _org_or_404(db: Session, org_id: int) -> Organization:
    org = (
        db.query(Organization)
        .filter(Organization.id == org_id, Organization.deleted_at.is_(None))
        .first()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org


def _serialize_org(org: Organization, role: str | None = None) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "logo_url": org.logo_url,
        "owner_id": org.owner_id,
        "member_count": len(org.members),
        "team_count": len(org.teams),
        "created_at": org.created_at,
        "updated_at": org.updated_at,
        **({"my_role": role} if role is not None else {}),
    }


def _serialize_member(m: OrganizationMember) -> dict:
    u = m.user
    return {
        "user_id": m.user_id,
        "role": m.role,
        "joined_at": m.joined_at,
        "user": {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "job_title": u.job_title,
        } if u else None,
    }


def _serialize_team(team: Team, user_role: str | None = None) -> dict:
    return {
        "id": team.id,
        "organization_id": team.organization_id,
        "name": team.name,
        "description": team.description,
        "created_by": team.created_by,
        "member_count": len(team.members),
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        **({"my_role": user_role} if user_role is not None else {}),
    }


def _serialize_team_member(m: TeamMember) -> dict:
    u = m.user
    return {
        "user_id": m.user_id,
        "role": m.role,
        "added_at": m.added_at,
        "user": {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "job_title": u.job_title,
        } if u else None,
    }


# ── Organization CRUD ────────────────────────────────────────────────────────

def create_organization(
    db: Session,
    name: str,
    owner_id: int,
    slug: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    base_slug = slug or _slugify(name)
    unique_slug = _ensure_unique_slug(db, base_slug)

    org = Organization(
        name=name.strip(),
        slug=unique_slug,
        description=description,
        owner_id=owner_id,
    )
    db.add(org)
    db.flush()  # get org.id before adding member

    # Auto-add the creator as owner
    membership = OrganizationMember(
        organization_id=org.id,
        user_id=owner_id,
        role="owner",
    )
    db.add(membership)
    db.commit()
    db.refresh(org)

    return _serialize_org(org, role="owner")


def get_organizations_for_user(db: Session, user_id: int) -> list[dict]:
    memberships = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user_id)
        .all()
    )
    result = []
    for m in memberships:
        org = m.organization
        if org and org.deleted_at is None:
            result.append(_serialize_org(org, role=m.role))
    return result


def get_organization(db: Session, org_id: int, user_id: int) -> dict:
    org = _org_or_404(db, org_id)
    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this organization.")
    return _serialize_org(org, role=membership.role)


def update_organization(
    db: Session,
    org_id: int,
    user_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    logo_url: Optional[str] = None,
) -> dict:
    from auth.permissions import require_org_role
    require_org_role(db, user_id, org_id, "admin")

    org = _org_or_404(db, org_id)

    if name is not None:
        org.name = name.strip()
    if description is not None:
        org.description = description
    if logo_url is not None:
        org.logo_url = logo_url

    org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(org)

    from auth.permissions import get_org_role
    role = get_org_role(db, user_id, org_id)
    return _serialize_org(org, role=role)


def delete_organization(db: Session, org_id: int, user_id: int) -> dict:
    from auth.permissions import require_org_role
    require_org_role(db, user_id, org_id, "owner")

    org = _org_or_404(db, org_id)
    org.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Organization deleted successfully."}


# ── Organization Members ─────────────────────────────────────────────────────

def list_org_members(db: Session, org_id: int, user_id: int) -> list[dict]:
    from auth.permissions import require_org_role
    require_org_role(db, user_id, org_id, "member")
    _org_or_404(db, org_id)

    members = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == org_id)
        .all()
    )
    return [_serialize_member(m) for m in members]


def update_org_member_role(
    db: Session, org_id: int, target_user_id: int, new_role: str, requester_id: int
) -> dict:
    from auth.permissions import require_org_role, ROLE_HIERARCHY
    requester_role = require_org_role(db, requester_id, org_id, "admin")

    # Can't demote someone of equal or higher rank unless you're the owner
    target_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == target_user_id,
        )
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found in this organization.")

    if (
        ROLE_HIERARCHY.get(target_membership.role, 0) >= ROLE_HIERARCHY.get(requester_role, 0)
        and target_user_id != requester_id
        and requester_role != "owner"
    ):
        raise HTTPException(status_code=403, detail="Cannot modify a member with equal or higher role.")

    # Only one owner allowed — transferring ownership re-demotes the old owner
    if new_role == "owner":
        old_owner = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "owner",
            )
            .first()
        )
        if old_owner and old_owner.user_id != target_user_id:
            old_owner.role = "admin"

    target_membership.role = new_role
    db.commit()
    db.refresh(target_membership)
    return _serialize_member(target_membership)


def remove_org_member(
    db: Session, org_id: int, target_user_id: int, requester_id: int
) -> dict:
    from auth.permissions import require_org_role, ROLE_HIERARCHY
    requester_role = require_org_role(db, requester_id, org_id, "admin")

    target_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == target_user_id,
        )
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found.")

    # The owner can never be forcibly removed — not by admins, not by anyone.
    # To remove an owner they must transfer ownership first.
    if target_membership.role == "owner":
        raise HTTPException(
            status_code=403,
            detail="Cannot remove the organization owner. Transfer ownership first."
        )

    # Admins can only remove members below their own rank.
    if (
        ROLE_HIERARCHY.get(target_membership.role, 0) >= ROLE_HIERARCHY.get(requester_role, 0)
        and target_user_id != requester_id
    ):
        raise HTTPException(status_code=403, detail="Cannot remove a member with equal or higher role.")

    # Cascade delete any team memberships for this user within the organization
    db.query(TeamMember).filter(
        TeamMember.team_id.in_(
            db.query(Team.id).filter(Team.organization_id == org_id)
        ),
        TeamMember.user_id == target_user_id,
    ).delete(synchronize_session=False)

    db.delete(target_membership)
    db.commit()
    return {"message": "Member removed successfully."}


# ── Teams ────────────────────────────────────────────────────────────────────

def create_team(
    db: Session,
    org_id: int,
    name: str,
    description: Optional[str],
    creator_id: int,
) -> dict:
    from auth.permissions import require_org_role
    require_org_role(db, creator_id, org_id, "admin")
    _org_or_404(db, org_id)

    # Unique name within org
    existing = (
        db.query(Team)
        .filter(Team.organization_id == org_id, Team.name == name.strip())
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A team with this name already exists.")

    team = Team(
        organization_id=org_id,
        name=name.strip(),
        description=description,
        created_by=creator_id,
    )
    db.add(team)
    db.flush()

    # Auto-add creator as team_lead
    db.add(TeamMember(team_id=team.id, user_id=creator_id, role="team_lead"))
    db.commit()
    db.refresh(team)
    return _serialize_team(team, user_role="team_lead")


def list_teams(db: Session, org_id: int, user_id: int) -> list[dict]:
    from auth.permissions import require_org_role, get_team_role
    require_org_role(db, user_id, org_id, "member")
    _org_or_404(db, org_id)

    teams = db.query(Team).filter(Team.organization_id == org_id).all()
    result = []
    for t in teams:
        role = get_team_role(db, user_id, t.id)
        result.append(_serialize_team(t, user_role=role))
    return result


def get_team(db: Session, org_id: int, team_id: int, user_id: int) -> dict:
    from auth.permissions import require_org_role, get_team_role
    require_org_role(db, user_id, org_id, "member")

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    role = get_team_role(db, user_id, team_id)
    return _serialize_team(team, user_role=role)


def update_team(
    db: Session,
    org_id: int,
    team_id: int,
    user_id: int,
    name: Optional[str],
    description: Optional[str],
) -> dict:
    from auth.permissions import require_org_role, get_team_role
    require_org_role(db, user_id, org_id, "admin")

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    if name is not None:
        team.name = name.strip()
    if description is not None:
        team.description = description
    team.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(team)
    role = get_team_role(db, user_id, team_id)
    return _serialize_team(team, user_role=role)


def delete_team(db: Session, org_id: int, team_id: int, user_id: int) -> dict:
    from auth.permissions import require_org_role
    require_org_role(db, user_id, org_id, "admin")

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully."}


# ── Team Members ─────────────────────────────────────────────────────────────

def list_team_members(db: Session, org_id: int, team_id: int, user_id: int) -> list[dict]:
    from auth.permissions import require_org_role
    require_org_role(db, user_id, org_id, "member")

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    return [_serialize_team_member(m) for m in members]


def add_team_member(
    db: Session,
    org_id: int,
    team_id: int,
    target_user_id: int,
    role: str,
    requester_id: int,
) -> dict:
    from auth.permissions import require_org_role

    # Must be org admin to add people
    require_org_role(db, requester_id, org_id, "admin")

    # Ensure the target user is an organization member; if not, add them as a member
    target_in_org = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == target_user_id,
        )
        .first()
    )
    if not target_in_org:
        # Auto-add as a regular member
        new_membership = OrganizationMember(
            organization_id=org_id,
            user_id=target_user_id,
            role="member",
        )
        db.add(new_membership)
        db.flush()  # obtain ID if needed
        # No commit yet; will commit later with team member

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    already = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        .first()
    )
    if already:
        raise HTTPException(status_code=409, detail="User is already a member of this team.")

    member = TeamMember(team_id=team_id, user_id=target_user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return _serialize_team_member(member)


def remove_team_member(
    db: Session,
    org_id: int,
    team_id: int,
    target_user_id: int,
    requester_id: int,
) -> dict:
    from auth.permissions import require_org_role

    # Org admins can remove anyone; a member can remove themselves
    if requester_id != target_user_id:
        require_org_role(db, requester_id, org_id, "admin")
    else:
        require_org_role(db, requester_id, org_id, "member")

    membership = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found in this team.")

    db.delete(membership)
    db.commit()
    return {"message": "Member removed from team."}


# ── User profile helper ──────────────────────────────────────────────────────

def get_memberships_for_user(db: Session, user_id: int) -> dict:
    """
    Returns the memberships object for GET /api/me.
    Shape: { enabled: True, items: [{ org, org_id, team?, role }] }
    """
    org_memberships = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user_id)
        .all()
    )

    items = []
    for om in org_memberships:
        org = om.organization
        if org and org.deleted_at is None:
            items.append({
                "org_id": org.id,
                "org": org.name,
                "org_slug": org.slug,
                "role": om.role,
            })

    return {"enabled": True, "items": items}
