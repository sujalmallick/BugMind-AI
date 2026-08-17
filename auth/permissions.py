"""
auth/permissions.py — centralised role-based access control helpers.

Role hierarchy (lowest → highest):
  viewer < editor < admin < owner

Each phase adds its own helpers here.  Phase 1 covers org-level roles.
Phase 2 will add project-level roles.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# ── Role hierarchy ───────────────────────────────────────────────────────────

ROLE_HIERARCHY: dict[str, int] = {
    "viewer":   0,
    "member":   1,   # org-level alias for the general "member" role
    "editor":   2,
    "team_lead": 3,
    "admin":    4,
    "owner":    5,
}


def role_satisfies(user_role: str, min_role: str) -> bool:
    """Return True if user_role is at least as powerful as min_role."""
    return ROLE_HIERARCHY.get(user_role, -1) >= ROLE_HIERARCHY.get(min_role, 999)


# ── Phase 1: Organization-level permissions ──────────────────────────────────

def get_org_role(db: Session, user_id: int, org_id: int) -> str | None:
    """
    Return the current user's role in the given organization, or None if they
    are not a member (or the org is soft-deleted).
    """
    from database.models.organization import Organization
    from database.models.organization_member import OrganizationMember

    org = (
        db.query(Organization)
        .filter(Organization.id == org_id, Organization.deleted_at.is_(None))
        .first()
    )
    if org is None:
        return None

    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        .first()
    )
    return membership.role if membership else None


def require_org_role(
    db: Session,
    user_id: int,
    org_id: int,
    min_role: str,
) -> str:
    """
    Assert the user has at least `min_role` in the org.
    Raises HTTP 403 if they don't; returns the actual role if they do.
    """
    role = get_org_role(db, user_id, org_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization.",
        )
    if not role_satisfies(role, min_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires at least the '{min_role}' role.",
        )
    return role


def get_team_role(db: Session, user_id: int, team_id: int) -> str | None:
    """Return the user's role in a specific team, or None."""
    from database.models.team_member import TeamMember

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    return membership.role if membership else None

# ── Phase 2: Project-level permissions ───────────────────────────────────────

PROJECT_ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 0,
    "editor": 1,
    "admin":  2,
    "owner":  3,
}

def project_role_satisfies(user_role: str, min_role: str) -> bool:
    return PROJECT_ROLE_HIERARCHY.get(user_role, -1) >= PROJECT_ROLE_HIERARCHY.get(min_role, 999)

def get_project_role(db: Session, user_id: int, project_id: int) -> str | None:
    """
    Calculate the effective role of a user on a project.
    If the user is the project's direct owner (owner_id), they are "owner".
    If they have direct membership via project_members, we check that role.
    If they have team access via project_team_access, we check that role.
    We return the highest of these.
    """
    from database.models.project import Project
    from database.models.project_member import ProjectMember
    from database.models.project_team_access import ProjectTeamAccess
    from database.models.team_member import TeamMember

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    if project.owner_id == user_id:
        return "owner"

    roles = []

    # 1. Direct membership
    direct_mem = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if direct_mem:
        roles.append(direct_mem.role)

    # 2. Team membership
    team_access = (
        db.query(ProjectTeamAccess.role)
        .join(TeamMember, TeamMember.team_id == ProjectTeamAccess.team_id)
        .filter(
            ProjectTeamAccess.project_id == project_id,
            TeamMember.user_id == user_id
        )
        .all()
    )
    for (r,) in team_access:
        roles.append(r)

    if not roles:
        return None

    # Find the maximum role
    best_role = "viewer"
    best_val = -1
    for r in roles:
        val = PROJECT_ROLE_HIERARCHY.get(r, -1)
        if val > best_val:
            best_val = val
            best_role = r

    return best_role


def require_project_role(
    db: Session,
    user_id: int,
    project_id: int,
    min_role: str = "viewer",
) -> str:
    role = get_project_role(db, user_id, project_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )
    if not project_role_satisfies(role, min_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires at least the '{min_role}' role on this project.",
        )
    return role
