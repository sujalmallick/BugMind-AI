from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from auth.permissions import get_project_role, require_project_role
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.project_team_access import ProjectTeamAccess
from database.models.team_member import TeamMember
from database.models.user import User


def _serialize_project_member(member: ProjectMember) -> dict:
    u = member.user
    return {
        "user_id": member.user_id,
        "role": member.role,
        "granted_at": member.granted_at,
        "user": {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
        } if u else None,
    }


def _serialize_project_team(access: ProjectTeamAccess) -> dict:
    t = access.team
    return {
        "team_id": access.team_id,
        "role": access.role,
        "granted_at": access.granted_at,
        "team": {
            "id": t.id,
            "name": t.name,
            "description": t.description,
        } if t else None,
    }


def list_project_members(db: Session, project_id: int, user_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    return [_serialize_project_member(m) for m in members]


def list_project_teams(db: Session, project_id: int, user_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    teams = db.query(ProjectTeamAccess).filter(ProjectTeamAccess.project_id == project_id).all()
    return [_serialize_project_team(t) for t in teams]


def list_project_assignees(db: Session, project_id: int, user_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_ids: set[int] = {project.owner_id}

    user_ids.update(
        member.user_id
        for member in db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    )

    team_ids = [
        access.team_id
        for access in db.query(ProjectTeamAccess.team_id).filter(ProjectTeamAccess.project_id == project_id).all()
    ]

    if team_ids:
        user_ids.update(
            member.user_id
            for member in db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all()
        )

    users = (
        db.query(User)
        .filter(User.id.in_(list(user_ids)))
        .order_by(User.name.asc().nullslast(), User.email.asc())
        .all()
    )

    return [
        {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar_url": user.avatar_url,
        }
        for user in users
    ]


def add_project_member(
    db: Session,
    project_id: int,
    target_user_id: int,
    role: str,
    requester_id: int,
) -> dict:
    require_project_role(db, requester_id, project_id, "admin")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if target_user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot modify access for the project owner.")

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == target_user_id)
        .first()
    )
    if existing:
        existing.role = role
        existing.granted_by = requester_id
        db.commit()
        db.refresh(existing)
        return _serialize_project_member(existing)

    member = ProjectMember(
        project_id=project_id,
        user_id=target_user_id,
        role=role,
        granted_by=requester_id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _serialize_project_member(member)


def remove_project_member(
    db: Session,
    project_id: int,
    target_user_id: int,
    requester_id: int,
):
    if requester_id != target_user_id:
        require_project_role(db, requester_id, project_id, "admin")
    else:
        # Self-removal
        require_project_role(db, requester_id, project_id, "viewer")

    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == target_user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="User does not have direct access to this project.")

    db.delete(member)
    db.commit()


def add_team_to_project(
    db: Session,
    project_id: int,
    target_team_id: int,
    role: str,
    requester_id: int,
) -> dict:
    require_project_role(db, requester_id, project_id, "admin")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.organization_id:
        raise HTTPException(status_code=400, detail="Cannot add teams to a personal project. Assign it to an organization first.")

    existing = (
        db.query(ProjectTeamAccess)
        .filter(ProjectTeamAccess.project_id == project_id, ProjectTeamAccess.team_id == target_team_id)
        .first()
    )
    if existing:
        existing.role = role
        existing.granted_by = requester_id
        db.commit()
        db.refresh(existing)
        return _serialize_project_team(existing)

    access = ProjectTeamAccess(
        project_id=project_id,
        team_id=target_team_id,
        role=role,
        granted_by=requester_id,
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    return _serialize_project_team(access)


def remove_team_from_project(
    db: Session,
    project_id: int,
    target_team_id: int,
    requester_id: int,
):
    require_project_role(db, requester_id, project_id, "admin")

    access = (
        db.query(ProjectTeamAccess)
        .filter(ProjectTeamAccess.project_id == project_id, ProjectTeamAccess.team_id == target_team_id)
        .first()
    )
    if not access:
        raise HTTPException(status_code=404, detail="Team does not have access to this project.")

    db.delete(access)
    db.commit()
