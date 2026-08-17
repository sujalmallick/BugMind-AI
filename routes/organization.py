"""
routes/organization.py — REST API for organizations and teams.

Prefix:  /api/organizations
Tags:    Organizations
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from schemas.organization import (
    OrgCreate,
    OrgUpdate,
    OrgMemberRoleUpdate,
    TeamCreate,
    TeamUpdate,
    TeamMemberAdd,
    TeamMemberRoleUpdate,
)
from services.organization_service import (
    create_organization,
    get_organizations_for_user,
    get_organization,
    update_organization,
    delete_organization,
    list_org_members,
    update_org_member_role,
    remove_org_member,
    create_team,
    list_teams,
    get_team,
    update_team,
    delete_team,
    list_team_members,
    add_team_member,
    remove_team_member,
)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


# ── Organizations ─────────────────────────────────────────────────────────────

@router.post("/")
def create_org(
    body: OrgCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new organization. The creator is automatically added as owner."""
    return create_organization(
        db=db,
        name=body.name,
        owner_id=current_user.id,
        slug=body.slug,
        description=body.description,
    )


@router.get("/")
def list_orgs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all organizations the current user belongs to."""
    return get_organizations_for_user(db=db, user_id=current_user.id)


@router.get("/{org_id}")
def get_org(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific organization (must be a member)."""
    return get_organization(db=db, org_id=org_id, user_id=current_user.id)


@router.put("/{org_id}")
def update_org(
    org_id: int,
    body: OrgUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update org name / description / logo (admin+ only)."""
    return update_organization(
        db=db,
        org_id=org_id,
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        logo_url=body.logo_url,
    )


@router.delete("/{org_id}")
def delete_org(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete an organization (owner only)."""
    return delete_organization(db=db, org_id=org_id, user_id=current_user.id)


# ── Organization Members ──────────────────────────────────────────────────────

@router.get("/{org_id}/members")
def get_org_members(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all members of an organization."""
    return list_org_members(db=db, org_id=org_id, user_id=current_user.id)


@router.put("/{org_id}/members/{user_id}/role")
def change_org_member_role(
    org_id: int,
    user_id: int,
    body: OrgMemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change a member's role (admin+ only)."""
    return update_org_member_role(
        db=db,
        org_id=org_id,
        target_user_id=user_id,
        new_role=body.role,
        requester_id=current_user.id,
    )


@router.delete("/{org_id}/members/{user_id}")
def kick_org_member(
    org_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from the organization (admin+ only, or self-leave)."""
    return remove_org_member(
        db=db,
        org_id=org_id,
        target_user_id=user_id,
        requester_id=current_user.id,
    )


# ── Teams ─────────────────────────────────────────────────────────────────────

@router.post("/{org_id}/teams")
def create_org_team(
    org_id: int,
    body: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new team inside an organization (admin+ only)."""
    return create_team(
        db=db,
        org_id=org_id,
        name=body.name,
        description=body.description,
        creator_id=current_user.id,
    )


@router.get("/{org_id}/teams")
def list_org_teams(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all teams in an organization."""
    return list_teams(db=db, org_id=org_id, user_id=current_user.id)


@router.get("/{org_id}/teams/{team_id}")
def get_org_team(
    org_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single team."""
    return get_team(db=db, org_id=org_id, team_id=team_id, user_id=current_user.id)


@router.put("/{org_id}/teams/{team_id}")
def update_org_team(
    org_id: int,
    team_id: int,
    body: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename or update a team's description (admin+ only)."""
    return update_team(
        db=db,
        org_id=org_id,
        team_id=team_id,
        user_id=current_user.id,
        name=body.name,
        description=body.description,
    )


@router.delete("/{org_id}/teams/{team_id}")
def delete_org_team(
    org_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a team (admin+ only)."""
    return delete_team(db=db, org_id=org_id, team_id=team_id, user_id=current_user.id)


# ── Team Members ──────────────────────────────────────────────────────────────

@router.get("/{org_id}/teams/{team_id}/members")
def get_team_members(
    org_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List members of a specific team."""
    return list_team_members(db=db, org_id=org_id, team_id=team_id, user_id=current_user.id)


@router.post("/{org_id}/teams/{team_id}/members")
def add_member_to_team(
    org_id: int,
    team_id: int,
    body: TeamMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an org member to a team (admin+ only)."""
    return add_team_member(
        db=db,
        org_id=org_id,
        team_id=team_id,
        target_user_id=body.user_id,
        role=body.role,
        requester_id=current_user.id,
    )


@router.delete("/{org_id}/teams/{team_id}/members/{user_id}")
def remove_member_from_team(
    org_id: int,
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from a team (admin+ or self-leave)."""
    return remove_team_member(
        db=db,
        org_id=org_id,
        team_id=team_id,
        target_user_id=user_id,
        requester_id=current_user.id,
    )
