from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException
from database.models.project import Project
from database.models.analysis import Analysis
from database.models.test_case import TestCase
from database.models.workspace import Workspace
from database.models.organization import Organization
from database.models.team import Team
from database.models.project_member import ProjectMember
from database.models.project_team_access import ProjectTeamAccess
from database.models.team_member import TeamMember
from auth.permissions import require_project_role, get_project_role, require_org_role, get_team_role

def create_project(
    db: Session,
    name: str,
    description: str,
    owner_id: int,
    organization_id: int | None = None,
    team_id: int | None = None,
) -> Project:
    if organization_id is not None:
        require_org_role(db, owner_id, organization_id, "member")

    if team_id is not None:
        team_query = db.query(Team).filter(Team.id == team_id)
        if organization_id is not None:
            team_query = team_query.filter(Team.organization_id == organization_id)

        team = team_query.first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

        team_role = get_team_role(db, owner_id, team_id)
        org_role = require_org_role(db, owner_id, organization_id, "member") if organization_id is not None else None
        if team_role is None and org_role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="You must belong to the team or be an organization admin to create a project for it.")



    existing_query = db.query(Project).filter(
        func.lower(func.trim(Project.name)) == name.strip().lower()
    )
    if organization_id is not None:
        existing_query = existing_query.filter(Project.organization_id == organization_id)
    else:
        existing_query = existing_query.filter(Project.owner_id == owner_id)

    existing = existing_query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A project named '{name.strip()}' already exists. Please use a unique name."
        )

    project = Project(
        name=name,
        description=description,
        owner_id=owner_id,
        organization_id=organization_id,
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

    if team_id is not None:
        db.add(
            ProjectTeamAccess(
                project_id=project.id,
                team_id=team_id,
                role="editor",
                granted_by=owner_id,
            )
        )



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
        issue_count = 0

        if workspace:
            test_cases = workspace.test_cases or []
            # Exclude system test case used for CSV imports
            user_test_cases = [tc for tc in test_cases if tc.test_case_id != "IMPORT-DEFAULT"]
            test_case_count = len(user_test_cases)
            
            # Count issues: direct Issue records linked through test cases
            for tc in test_cases:
                if tc.issues:
                    issue_count += len(tc.issues)

            if workspace.analysis and workspace.analysis.result:
                module_count = len(workspace.analysis.result.get("confirmedModules", []))

        role = get_project_role(db, user_id, project.id)

        assigned_team_ids = [access.team_id for access in project.team_access]

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
                "issue_count": issue_count,
                "my_role": role,
                "assigned_team_ids": assigned_team_ids,
            }
        )

    return result

def get_project_by_id(
    db: Session,
    project_id: int,
    user_id: int,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    require_project_role(db, user_id, project_id, "viewer")
        
    return project

def update_project(
    db: Session,
    project_id: int,
    user_id: int,
    name: str,
    description: str,
    status: str,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    require_project_role(db, user_id, project_id, "editor")

    # Check for duplicate project name
    dup_query = db.query(Project).filter(
        Project.id != project_id,
        func.lower(func.trim(Project.name)) == name.strip().lower()
    )
    if project.organization_id is not None:
        dup_query = dup_query.filter(Project.organization_id == project.organization_id)
    else:
        dup_query = dup_query.filter(Project.owner_id == project.owner_id)

    if dup_query.first():
        raise HTTPException(
            status_code=400,
            detail=f"A project named '{name.strip()}' already exists. Please use a unique name."
        )

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
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    require_project_role(db, user_id, project_id, "owner")

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}


def touch_project(
    db: Session,
    project_id: int,
    user_id: int,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    require_project_role(db, user_id, project_id, "viewer")

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


def transfer_project_to_org(
    db: Session,
    project_id: int,
    user_id: int,
    org_id: int,
):
    """Transfer a project into an organization. Only the project owner can do this."""
    from database.models.organization_member import OrganizationMember

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Only owner can transfer
    if project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the project owner can transfer it.")

    # Check user is a member of the target org
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

    # Check org exists
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    project.organization_id = org_id
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "organization_id": project.organization_id,
        "message": f"Project transferred to organization '{org.name}' successfully.",
    }