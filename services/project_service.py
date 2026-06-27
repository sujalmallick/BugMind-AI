from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from database.models.project import Project
from database.models.analysis import Analysis
from database.models.test_case import TestCase
from database.models.workspace import Workspace
from database.models.project_member import ProjectMember
from database.models.project_team_access import ProjectTeamAccess
from database.models.team_member import TeamMember
from fastapi import HTTPException
from auth.permissions import require_project_role, get_project_role

def create_project(
    db: Session,
    name: str,
    description: str,
    owner_id: int,
) -> Project:
    existing = db.query(Project).filter(
        Project.owner_id == owner_id,
        func.lower(func.trim(Project.name)) == name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Project with this name already exists")

    project = Project(
        name=name,
        description=description,
        owner_id=owner_id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    workspace = Workspace(
        project_id=project.id,
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return project

def get_all_projects(
    db: Session,
    user_id: int,
):
    cond_owner = (Project.owner_id == user_id)
    
    cond_member = Project.id.in_(
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == user_id)
    )
    
    cond_team = Project.id.in_(
        db.query(ProjectTeamAccess.project_id)
        .join(TeamMember, TeamMember.team_id == ProjectTeamAccess.team_id)
        .filter(TeamMember.user_id == user_id)
    )

    projects = db.query(Project).filter(or_(cond_owner, cond_member, cond_team)).all()

    result = []

    for project in projects:
        workspace = project.workspace
        module_count = 0
        test_case_count = 0

        if workspace:
            test_case_count = len(workspace.test_cases)
            if workspace.analysis and workspace.analysis.result:
                module_count = len(workspace.analysis.result.get("confirmedModules", []))

        role = get_project_role(db, user_id, project.id)

        result.append(
            {
                "id": project.id,
                "owner_id": project.owner_id,
                "organization_id": project.organization_id,
                "name": project.name,
                "description": project.description,
                "status": project.status,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "module_count": module_count,
                "test_case_count": test_case_count,
                "my_role": role,
            }
        )

    return result

def get_project_by_id(
    db: Session,
    project_id: int,
    user_id: int,
):
    require_project_role(db, user_id, project_id, "viewer")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project

def update_project(
    db: Session,
    project_id: int,
    user_id: int,
    name: str,
    description: str,
    status: str,
):
    require_project_role(db, user_id, project_id, "editor")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.name = name
    project.description = description
    project.status = status
    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project

def delete_project(
    db: Session,
    project_id: int,
    user_id: int,
):
    require_project_role(db, user_id, project_id, "owner")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}


def touch_project(
    db: Session,
    project_id: int,
    user_id: int,
):
    require_project_role(db, user_id, project_id, "editor")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project