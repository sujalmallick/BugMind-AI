import json
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models.ai_assignment_suggestion import AIAssignmentSuggestion
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.organization_member import OrganizationMember
from database.models.test_case import TestCase
from database.models.issue import Issue
from database.models.user import User
from database.models.workspace import Workspace
from services.llm_factory import build_llm_manager

def get_latest_suggestion(db: Session, project_id: int):
    return (
        db.query(AIAssignmentSuggestion)
        .filter(
            AIAssignmentSuggestion.project_id == project_id,
            AIAssignmentSuggestion.status == "pending"
        )
        .order_by(AIAssignmentSuggestion.created_at.desc())
        .first()
    )

def dismiss_suggestion(db: Session, suggestion_id: int):
    suggestion = db.query(AIAssignmentSuggestion).filter(AIAssignmentSuggestion.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    suggestion.status = "dismissed"
    db.commit()

def apply_suggestions(db: Session, suggestion_id: int, selected_indices: list[int]):
    suggestion = db.query(AIAssignmentSuggestion).filter(AIAssignmentSuggestion.id == suggestion_id).first()
    if not suggestion or suggestion.status != "pending":
        raise HTTPException(status_code=404, detail="Pending suggestion not found")
    
    for i, item in enumerate(suggestion.suggestions):
        if i in selected_indices:
            entity_type = item.get("entity_type")
            entity_id = item.get("entity_id")
            assignee_id = item.get("assignee_id")
            
            if entity_type == "test_case":
                tc = db.query(TestCase).filter(TestCase.id == entity_id).first()
                if tc:
                    tc.assignee_id = assignee_id
                    tc.assigned_at = datetime.now(timezone.utc)
            elif entity_type == "issue":
                issue = db.query(Issue).filter(Issue.id == entity_id).first()
                if issue:
                    issue.assignee_id = assignee_id
                    
    suggestion.status = "applied"
    suggestion.applied_at = datetime.now(timezone.utc)
    db.commit()

def generate_suggestions(db: Session, project_id: int, user_id: int):
    # 1. Fetch unassigned items
    unassigned_tcs = (
        db.query(TestCase)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(Workspace.project_id == project_id, TestCase.assignee_id == None)
        .all()
    )
    
    unassigned_issues = (
        db.query(Issue)
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(Workspace.project_id == project_id, Issue.assignee_id == None)
        .all()
    )
    
    if not unassigned_tcs and not unassigned_issues:
        raise HTTPException(status_code=400, detail="No unassigned items found to distribute.")

    # 2. Build assignee pool: project owner + explicit project members + org members (deduplicated)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    seen_user_ids = set()
    user_role_map: dict[int, str] = {}  # user_id -> role label

    # Add project owner first
    owner = db.query(User).filter(User.id == project.owner_id).first()
    if owner:
        seen_user_ids.add(owner.id)
        user_role_map[owner.id] = "owner"

    # Add explicit project members
    project_members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    for pm in project_members:
        if pm.user_id not in seen_user_ids:
            seen_user_ids.add(pm.user_id)
            user_role_map[pm.user_id] = pm.role

    # If project belongs to an org, also pull in org members as potential assignees
    if project.organization_id:
        org_members = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == project.organization_id
        ).all()
        for om in org_members:
            if om.user_id not in seen_user_ids:
                seen_user_ids.add(om.user_id)
                user_role_map[om.user_id] = om.role

    if not seen_user_ids:
        raise HTTPException(status_code=400, detail="No team members found to assign work to.")

    # Fetch user objects
    users = db.query(User).filter(User.id.in_(seen_user_ids)).all()

    member_data = []
    for user in users:
        tc_count = db.query(func.count(TestCase.id)).filter(
            TestCase.assignee_id == user.id,
            TestCase.status.notin_(["pass", "skipped"])
        ).scalar()

        bug_count = db.query(func.count(Issue.id)).filter(
            Issue.assignee_id == user.id,
            Issue.status.notin_(["closed", "resolved", "done", "fixed"])
        ).scalar()

        member_data.append({
            "user_id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip() or user.email,
            "role": user_role_map.get(user.id, "member"),
            "job_title": user.job_title or "Unknown",
            "active_test_cases": tc_count,
            "open_bugs": bug_count
        })

    items_data = []
    for tc in unassigned_tcs:
        items_data.append({
            "entity_type": "test_case",
            "entity_id": tc.id,
            "title": tc.description,
            "priority": tc.priority,
            "module": tc.module
        })
        
    for bug in unassigned_issues:
        items_data.append({
            "entity_type": "issue",
            "entity_id": bug.id,
            "title": bug.title,
            "severity": bug.severity
        })

    # 3. Construct prompt
    prompt = f"""
You are an AI engineering manager helping to distribute workload across a team.
I have a list of team members and a list of unassigned items (test cases and bugs).

Team Members:
{json.dumps(member_data, indent=2)}

Unassigned Items:
{json.dumps(items_data, indent=2)}

Please assign EVERY unassigned item to exactly one team member. 
Try to balance the workload fairly (so no one is overwhelmed), and if someone's job_title implies certain expertise, consider that.

Your output MUST be a valid JSON object matching exactly this schema:
{{
  "suggestions": [
    {{
      "entity_type": "test_case" or "issue",
      "entity_id": integer,
      "assignee_id": integer,
      "reason": "Brief 1-sentence explanation of why this was assigned to them"
    }}
  ]
}}

Output ONLY the JSON and nothing else. No markdown wrappers.
"""

    llm = build_llm_manager(db, user_id)
    response_text = llm.generate(prompt)
    
    # Strip markdown block if present
    response_text = response_text.strip()
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    response_text = response_text.strip()
    
    try:
        parsed = json.loads(response_text)
        suggestions = parsed.get("suggestions", [])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON formatting.")

    # Validate output
    if not isinstance(suggestions, list):
        suggestions = []

    # Filter out anything missing fields
    valid_suggestions = []
    for s in suggestions:
        if "entity_type" in s and "entity_id" in s and "assignee_id" in s and "reason" in s:
            valid_suggestions.append(s)

    if not valid_suggestions:
        raise HTTPException(status_code=500, detail="AI did not generate any valid suggestions.")

    # Clear old pending suggestions for this project
    old_pending = db.query(AIAssignmentSuggestion).filter(
        AIAssignmentSuggestion.project_id == project_id,
        AIAssignmentSuggestion.status == "pending"
    ).all()
    for op in old_pending:
        op.status = "dismissed"
        
    db.commit()

    # Save new suggestion
    suggestion_record = AIAssignmentSuggestion(
        project_id=project_id,
        requested_by=user_id,
        suggestions=valid_suggestions,
        status="pending"
    )
    db.add(suggestion_record)
    db.commit()
    db.refresh(suggestion_record)
    
    return suggestion_record
