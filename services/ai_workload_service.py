import json
import logging
import math
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth.permissions import PROJECT_ROLE_HIERARCHY, get_project_role
from guardrails import (
    GuardrailViolation,
    MaskingVault,
    RiskLevel,
    Source,
    ToolSpec,
    UserContext,
    input_guardrail,
    tool_guardrail,
    tool_registry,
    wrap_untrusted,
)

from database.models.ai_assignment_suggestion import AIAssignmentSuggestion
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.organization_member import OrganizationMember
from database.models.test_case import TestCase
from database.models.issue import Issue
from database.models.user import User
from database.models.workspace import Workspace
from services.llm_errors import LLMError, LLMRateLimitError
from services.llm_factory import build_llm_manager

logger = logging.getLogger("BugMind")


def _get_project_suggestion(db: Session, project_id: int, suggestion_id: int):
    """Load a suggestion only if it belongs to the given project."""
    return (
        db.query(AIAssignmentSuggestion)
        .filter(
            AIAssignmentSuggestion.id == suggestion_id,
            AIAssignmentSuggestion.project_id == project_id,
        )
        .first()
    )


def _build_assignee_pool(db: Session, project: Project) -> dict[int, str]:
    """
    Returns {user_id: role} for everyone work can be assigned to:
    project owner + explicit project members + org members (deduplicated).
    """
    pool: dict[int, str] = {}

    # Add project owner first
    owner = db.query(User).filter(User.id == project.owner_id).first()
    if owner:
        pool[owner.id] = "owner"

    # Add explicit project members
    project_members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
    for pm in project_members:
        pool.setdefault(pm.user_id, pm.role)

    # If project belongs to an org, also pull in org members as potential assignees
    if project.organization_id:
        org_members = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == project.organization_id
        ).all()
        for om in org_members:
            pool.setdefault(om.user_id, om.role)

    return pool


def _get_project_test_case(db: Session, project_id: int, tc_id: int):
    return (
        db.query(TestCase)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(TestCase.id == tc_id, Workspace.project_id == project_id)
        .first()
    )


def _get_project_issue(db: Session, project_id: int, issue_id: int):
    return (
        db.query(Issue)
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(Issue.id == issue_id, Workspace.project_id == project_id)
        .first()
    )


# ── Tool guardrail: the only action the workload agent may propose ────────────

AGENT = "workload_agent"
ASSIGN_TOOL = "assign_work_item"


class AssignWorkItemArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity_type: Literal["test_case", "issue"]
    entity_id: int = Field(gt=0)
    assignee_id: int = Field(gt=0)
    reason: str = Field(max_length=1000)

    @field_validator("entity_id", "assignee_id", mode="before")
    @classmethod
    def _reject_bool(cls, value):
        if isinstance(value, bool):
            raise ValueError("must be an integer")
        return value

    @field_validator("reason", mode="before")
    @classmethod
    def _clip_reason(cls, value):
        return str(value or "").strip()[:1000]


def _authorize_assignment(args: AssignWorkItemArgs, ctx: UserContext, resources: dict) -> list[str]:
    """Resource checks: the entity is in this project and the assignee is in its pool."""
    db = resources["db"]
    violations = []

    offered = resources.get("allowed_entities")
    if offered is not None:
        # At generation time the offered items came from a project-scoped query.
        if (args.entity_type, args.entity_id) not in offered:
            violations.append("entity_not_offered")
    else:
        getter = _get_project_test_case if args.entity_type == "test_case" else _get_project_issue
        if getter(db, ctx.project_id, args.entity_id) is None:
            violations.append("entity_not_in_project")

    if args.assignee_id not in resources["assignee_pool"]:
        violations.append("assignee_not_in_pool")
    return violations


tool_registry.register(
    ToolSpec(
        name=ASSIGN_TOOL,
        args_model=AssignWorkItemArgs,
        description="Assign a project test case or issue to a member of the project's assignee pool.",
        # Mutates project data, so it is only executed after an admin explicitly applies it.
        risk=RiskLevel.HIGH,
        min_role="admin",
        role_hierarchy=PROJECT_ROLE_HIERARCHY,
        resource_validator=_authorize_assignment,
    ),
    replace=True,
)


def _user_context(db: Session, user_id: int, project_id: int) -> UserContext:
    return UserContext(
        user_id=user_id,
        role=get_project_role(db, user_id, project_id),
        project_id=project_id,
    )


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

def dismiss_suggestion(db: Session, project_id: int, suggestion_id: int):
    suggestion = _get_project_suggestion(db, project_id, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = "dismissed"
    db.commit()

def apply_suggestions(db: Session, project_id: int, suggestion_id: int, selected_indices: list[int], user_id: int):
    suggestion = _get_project_suggestion(db, project_id, suggestion_id)
    if not suggestion or suggestion.status != "pending":
        raise HTTPException(status_code=404, detail="Pending suggestion not found")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Re-check against current membership: it may have changed since the suggestion was generated.
    assignee_pool = _build_assignee_pool(db, project)
    ctx = _user_context(db, user_id, project_id)

    for i, item in enumerate(suggestion.suggestions):
        if i in selected_indices:
            # The admin's explicit apply is the human confirmation for this high-risk action.
            auth = tool_guardrail.authorize(
                ASSIGN_TOOL, item, ctx, confirmed=True,
                resources={"db": db, "assignee_pool": assignee_pool}, agent=AGENT,
            )
            if not auth.allowed:
                logger.warning(
                    f"Skipping suggestion {suggestion_id}[{i}] for project {project_id}: "
                    f"{', '.join(auth.reasons)}"
                )
                continue

            entity_type = auth.sanitized_arguments["entity_type"]
            entity_id = auth.sanitized_arguments["entity_id"]
            assignee_id = auth.sanitized_arguments["assignee_id"]

            if entity_type == "test_case":
                tc = _get_project_test_case(db, project_id, entity_id)
                if tc:
                    tc.assignee_id = assignee_id
                    tc.assigned_at = datetime.now(timezone.utc)
            elif entity_type == "issue":
                issue = _get_project_issue(db, project_id, entity_id)
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

    user_role_map = _build_assignee_pool(db, project)  # user_id -> role label
    seen_user_ids = set(user_role_map)

    if not seen_user_ids:
        raise HTTPException(status_code=400, detail="No team members found to assign work to.")

    # Fetch user objects
    users = db.query(User).filter(User.id.in_(seen_user_ids)).all()

    # Names reach the LLM only as aliases ([NAME_1]); emails never do. The alias map
    # lives in this in-memory vault just long enough to restore names in "reason".
    vault = MaskingVault()

    def contain(text, field):
        return input_guardrail.contain(text or "", source=Source.DATABASE, field=field, agent=AGENT)

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
            "name": vault.token_for("NAME", (user.name or "").strip() or user.email),
            "role": user_role_map.get(user.id, "member"),
            "job_title": contain(user.job_title or "Unknown", "job_title"),
            "active_test_cases": tc_count,
            "open_bugs": bug_count
        })

    items_data = []
    for tc in unassigned_tcs:
        items_data.append({
            "entity_type": "test_case",
            "entity_id": tc.id,
            "title": contain(tc.description, "test_case_title"),
            "priority": tc.priority,
            "module": contain(tc.module, "test_case_module"),
        })
        
    for bug in unassigned_issues:
        items_data.append({
            "entity_type": "issue",
            "entity_id": bug.id,
            "title": contain(bug.title, "issue_title"),
            "severity": bug.severity
        })

    # 3. Construct prompt
    prompt = f"""
You are an AI engineering manager helping to distribute workload across a team.
I have a list of team members and a list of unassigned items (test cases and bugs).

Team Members (database records):
{wrap_untrusted(json.dumps(member_data, indent=2), source=Source.DATABASE, label="team_members")}

Unassigned Items (database records):
{wrap_untrusted(json.dumps(items_data, indent=2), source=Source.DATABASE, label="unassigned_items")}

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
    try:
        response_text = llm.generate(prompt, agent=AGENT)
    except GuardrailViolation as e:
        raise HTTPException(status_code=500, detail=e.user_message)
    except LLMError as e:
        if isinstance(e, LLMRateLimitError):
            headers = {"Retry-After": str(math.ceil(e.retry_after))} if e.retry_after is not None else None
            raise HTTPException(status_code=429, detail=e.user_message, headers=headers)
        raise HTTPException(status_code=502, detail=e.user_message)
    if not response_text:
        raise HTTPException(status_code=500, detail="AI returned an empty response.")
    
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

    # Keep only suggestions that reference items and people we actually sent.
    # The prompt contains user-written titles, so the model's IDs are untrusted.
    allowed_entities = {(item["entity_type"], item["entity_id"]) for item in items_data}
    assigned_entities = set()
    valid_suggestions = []
    ctx = _user_context(db, user_id, project_id)
    resources = {"db": db, "assignee_pool": user_role_map, "allowed_entities": allowed_entities}
    for s in suggestions:
        if not isinstance(s, dict) or "reason" not in s:
            continue

        # Schema, role, injection/secret scan and resource checks. A valid
        # proposal comes back as "requires confirmation": it is only stored
        # as pending until an admin applies it.
        auth = tool_guardrail.authorize(ASSIGN_TOOL, s, ctx, resources=resources, agent=AGENT)
        if not (auth.allowed or auth.requires_confirmation):
            continue

        args = auth.sanitized_arguments
        entity_key = (args["entity_type"], args["entity_id"])
        if entity_key in assigned_entities:
            continue

        assigned_entities.add(entity_key)
        valid_suggestions.append({
            "entity_type": entity_key[0],
            "entity_id": entity_key[1],
            "assignee_id": args["assignee_id"],
            "reason": vault.unmask(args["reason"]),
        })
    vault.clear()

    dropped = len(suggestions) - len(valid_suggestions)
    if dropped:
        logger.warning(f"Dropped {dropped} invalid AI assignment suggestion(s) for project {project_id}")

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
