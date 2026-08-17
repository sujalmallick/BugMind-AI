from __future__ import annotations

import json
from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth.permissions import get_org_role, get_project_role, get_team_role, require_project_role
from database.models.activity_log import ActivityLog
from database.models.issue import Issue
from database.models.notification import Notification
from database.models.organization import Organization
from database.models.organization_member import OrganizationMember
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.team import Team
from database.models.team_member import TeamMember
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from services.organization_service import get_organizations_for_user
from services.project_service import get_all_projects

ARCHIVED_ISSUE_STATUSES = {"closed", "resolved", "done", "fixed"}


def _normalize_key(value: str | None) -> str:
    if not value:
        return "unknown"
    return "-".join(part for part in value.strip().lower().replace("_", " ").split())


def _sort_breakdown(items: list[dict], preferred_order: list[str]) -> list[dict]:
    order_index = {key: index for index, key in enumerate(preferred_order)}
    return sorted(
        items,
        key=lambda item: (
            order_index.get(item["key"], len(preferred_order)),
            -item["count"],
            item["label"].lower(),
        ),
    )


def _serialize_activity(log: ActivityLog) -> dict:
    meta = log.meta
    if isinstance(meta, str) and meta:
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {"raw": meta}

    actor = log.actor
    return {
        "id": log.id,
        "verb": log.verb,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "entity_label": log.entity_label,
        "project_id": log.project_id,
        "org_id": log.org_id,
        "meta": meta if isinstance(meta, dict) else None,
        "created_at": log.created_at,
        "actor": {
            "id": actor.id,
            "name": actor.name,
            "avatar_url": actor.avatar_url,
            "email": actor.email,
        }
        if actor
        else None,
    }


def _serialize_notification(notification: Notification) -> dict:
    actor = notification.actor
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "action_url": notification.action_url,
        "entity_type": notification.entity_type,
        "entity_id": notification.entity_id,
        "project_id": notification.project_id,
        "org_id": notification.org_id,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "actor": {
            "id": actor.id,
            "name": actor.name,
            "avatar_url": actor.avatar_url,
        }
        if actor
        else None,
    }


def _build_breakdown(rows, preferred_order: list[str]) -> list[dict]:
    breakdown = []
    for key, count in rows:
        normalized = _normalize_key(key)
        breakdown.append(
            {
                "key": normalized,
                "label": key or "Unknown",
                "count": int(count or 0),
            }
        )
    return _sort_breakdown(breakdown, preferred_order)


def _counts_for_assigned_test_cases(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(func.lower(TestCase.status), func.count(TestCase.id))
        .filter(TestCase.assignee_id == user_id)
        .group_by(func.lower(TestCase.status))
        .all()
    )
    return _build_breakdown(rows, ["not-executed", "pass", "fail", "blocked", "skipped"])


def _counts_for_assigned_issues(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(func.lower(Issue.severity), func.count(Issue.id))
        .filter(Issue.assignee_id == user_id)
        .group_by(func.lower(Issue.severity))
        .all()
    )
    return _build_breakdown(rows, ["critical", "high", "medium", "low"])


def _current_user_test_cases(db: Session, user_id: int, limit: int = 100) -> list[dict]:
    rows = (
        db.query(TestCase, Project)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .join(Project, Project.id == Workspace.project_id)
        .filter(TestCase.assignee_id == user_id)
        .order_by(TestCase.updated_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for test_case, project in rows:
        items.append(
            {
                "id": test_case.id,
                "test_case_id": test_case.test_case_id,
                "description": test_case.description,
                "status": test_case.status,
                "priority": test_case.priority,
                "module": test_case.module,
                "category": test_case.category,
                "assignee_id": test_case.assignee_id,
                "assigned_at": test_case.assigned_at,
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "status": project.status,
                },
            }
        )
    return items


def _current_user_issues(db: Session, user_id: int, limit: int = 100) -> list[dict]:
    rows = (
        db.query(Issue, Project)
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .join(Project, Project.id == Workspace.project_id)
        .filter(Issue.assignee_id == user_id)
        .order_by(Issue.updated_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for issue, project in rows:
        items.append(
            {
                "id": issue.id,
                "bug_id": issue.bug_id,
                "title": issue.title,
                "description": issue.description,
                "status": issue.status,
                "severity": issue.severity,
                "priority": issue.priority,
                "assignee_id": issue.assignee_id,
                "assigned_at": issue.assigned_at,
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "status": project.status,
                },
            }
        )
    return items


def _recent_activity(db: Session, *, limit: int = 8, **filters) -> list[dict]:
    query = db.query(ActivityLog)
    if filters.get("project_id") is not None:
        query = query.filter(ActivityLog.project_id == filters["project_id"])
    if filters.get("org_id") is not None:
        query = query.filter(ActivityLog.org_id == filters["org_id"])
    if filters.get("actor_id") is not None:
        query = query.filter(ActivityLog.actor_id == filters["actor_id"])

    logs = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [_serialize_activity(log) for log in logs]


def _recent_notifications(db: Session, user_id: int, limit: int = 5) -> list[dict]:
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_notification(notification) for notification in notifications]


def _project_summary_counts(db: Session, project_id: int) -> dict:
    workspace = (
        db.query(Workspace)
        .filter(Workspace.project_id == project_id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    test_case_rows = (
        db.query(func.lower(TestCase.status), func.count(TestCase.id))
        .filter(TestCase.workspace_id == workspace.id)
        .group_by(func.lower(TestCase.status))
        .all()
    )

    issue_rows = (
        db.query(func.lower(Issue.severity), func.count(Issue.id))
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .filter(TestCase.workspace_id == workspace.id)
        .group_by(func.lower(Issue.severity))
        .all()
    )

    total_test_cases = (
        db.query(func.count(TestCase.id))
        .filter(TestCase.workspace_id == workspace.id)
        .scalar()
        or 0
    )

    total_issues = (
        db.query(func.count(Issue.id))
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .filter(TestCase.workspace_id == workspace.id)
        .scalar()
        or 0
    )

    open_issues = (
        db.query(func.count(Issue.id))
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .filter(
            TestCase.workspace_id == workspace.id,
            ~func.lower(Issue.status).in_(ARCHIVED_ISSUE_STATUSES),
        )
        .scalar()
        or 0
    )

    return {
        "workspace_id": workspace.id,
        "total_test_cases": int(total_test_cases),
        "total_issues": int(total_issues),
        "open_issues": int(open_issues),
        "test_case_status_breakdown": _build_breakdown(
            test_case_rows,
            ["not-executed", "pass", "fail", "blocked", "skipped"],
        ),
        "issue_severity_breakdown": _build_breakdown(
            issue_rows,
            ["critical", "high", "medium", "low"],
        ),
    }


def _project_top_assignees(db: Session, project_id: int) -> list[dict]:
    workspace = (
        db.query(Workspace)
        .filter(Workspace.project_id == project_id)
        .first()
    )
    if not workspace:
        return []

    test_case_rows = (
        db.query(TestCase.assignee_id, func.count(TestCase.id))
        .filter(
            TestCase.workspace_id == workspace.id,
            TestCase.assignee_id.isnot(None),
        )
        .group_by(TestCase.assignee_id)
        .all()
    )

    issue_rows = (
        db.query(Issue.assignee_id, func.count(Issue.id))
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .filter(
            TestCase.workspace_id == workspace.id,
            Issue.assignee_id.isnot(None),
        )
        .group_by(Issue.assignee_id)
        .all()
    )

    totals: dict[int, dict] = defaultdict(lambda: {"test_cases": 0, "issues": 0, "total": 0})

    for assignee_id, count in test_case_rows:
        totals[int(assignee_id)]["test_cases"] += int(count or 0)
        totals[int(assignee_id)]["total"] += int(count or 0)

    for assignee_id, count in issue_rows:
        totals[int(assignee_id)]["issues"] += int(count or 0)
        totals[int(assignee_id)]["total"] += int(count or 0)

    users = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(list(totals.keys()))).all()
    }

    items = []
    for user_id, counts in totals.items():
        user = users.get(user_id)
        items.append(
            {
                "user_id": user_id,
                "name": user.name if user else "Unknown",
                "email": user.email if user else None,
                "avatar_url": user.avatar_url if user else None,
                **counts,
            }
        )

    items.sort(key=lambda item: (-item["total"], item["name"].lower()))
    return items


def get_my_dashboard(db: Session, user_id: int) -> dict:
    projects = get_all_projects(db, user_id)
    organizations = get_organizations_for_user(db, user_id)

    team_count = (
        db.query(func.count(func.distinct(TeamMember.team_id)))
        .filter(TeamMember.user_id == user_id)
        .scalar()
        or 0
    )

    assigned_test_cases = _current_user_test_cases(db, user_id)
    assigned_issues = _current_user_issues(db, user_id)

    unread_notifications = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )

    total_assigned = len(assigned_test_cases) + len(assigned_issues)

    return {
        "summary": {
            "projects": len(projects),
            "organizations": len(organizations),
            "teams": int(team_count),
            "assigned_test_cases": len(assigned_test_cases),
            "assigned_issues": len(assigned_issues),
            "assigned_items": total_assigned,
            "unread_notifications": int(unread_notifications),
        },
        "projects": projects,
        "organizations": organizations,
        "assigned_test_cases": assigned_test_cases,
        "assigned_issues": assigned_issues,
        "test_case_status_breakdown": _counts_for_assigned_test_cases(db, user_id),
        "issue_severity_breakdown": _counts_for_assigned_issues(db, user_id),
        "recent_activity": _recent_activity(db, actor_id=user_id, limit=8),
        "recent_notifications": _recent_notifications(db, user_id, limit=5),
    }


def get_project_dashboard(db: Session, user_id: int, project_id: int) -> dict:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    my_role = require_project_role(db, user_id, project_id, "viewer")
    project_summary = _project_summary_counts(db, project_id)

    return {
        "project": {
            "id": project.id,
            "owner_id": project.owner_id,
            "organization_id": project.organization_id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "my_role": my_role,
        },
        **project_summary,
        "top_assignees": _project_top_assignees(db, project_id),
        "recent_activity": _recent_activity(db, project_id=project_id, limit=10),
    }


def get_team_dashboard(db: Session, user_id: int, org_id: int, team_id: int) -> dict:
    org = (
        db.query(Organization)
        .filter(Organization.id == org_id, Organization.deleted_at.is_(None))
        .first()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == org_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    org_role = get_org_role(db, user_id, org_id)
    team_role = get_team_role(db, user_id, team_id)
    if org_role not in {"owner", "admin"} and team_role is None:
        raise HTTPException(status_code=403, detail="You do not have access to this team dashboard.")

    team_member_rows = (
        db.query(TeamMember, User)
        .join(User, User.id == TeamMember.user_id)
        .filter(TeamMember.team_id == team_id)
        .all()
    )
    team_member_ids = [team_member.user_id for team_member, _ in team_member_rows]

    project_ids = [row.id for row in db.query(Project.id).filter(Project.organization_id == org_id).all()]

    member_totals: dict[int, dict] = {
        member_id: {"test_cases": 0, "issues": 0, "total": 0}
        for member_id in team_member_ids
    }

    if team_member_ids:
        tc_rows = (
            db.query(TestCase.assignee_id, func.count(TestCase.id))
            .join(Workspace, Workspace.id == TestCase.workspace_id)
            .filter(
                Workspace.project_id.in_(project_ids) if project_ids else False,
                TestCase.assignee_id.in_(team_member_ids),
            )
            .group_by(TestCase.assignee_id)
            .all()
        )
        issue_rows = (
            db.query(Issue.assignee_id, func.count(Issue.id))
            .join(TestCase, TestCase.id == Issue.test_case_id)
            .join(Workspace, Workspace.id == TestCase.workspace_id)
            .filter(
                Workspace.project_id.in_(project_ids) if project_ids else False,
                Issue.assignee_id.in_(team_member_ids),
            )
            .group_by(Issue.assignee_id)
            .all()
        )

        for assignee_id, count in tc_rows:
            if assignee_id in member_totals:
                member_totals[assignee_id]["test_cases"] += int(count or 0)
                member_totals[assignee_id]["total"] += int(count or 0)

        for assignee_id, count in issue_rows:
            if assignee_id in member_totals:
                member_totals[assignee_id]["issues"] += int(count or 0)
                member_totals[assignee_id]["total"] += int(count or 0)

    member_load = []
    for team_member, user in team_member_rows:
        counts = member_totals.get(team_member.user_id, {"test_cases": 0, "issues": 0, "total": 0})
        member_load.append(
            {
                "user_id": team_member.user_id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "role": team_member.role,
                **counts,
            }
        )

    member_load.sort(key=lambda item: (-item["total"], item["name"].lower()))

    project_count = len(project_ids)
    total_open_items = sum(item["total"] for item in member_load)

    org_activity_query = db.query(ActivityLog).outerjoin(Project, ActivityLog.project_id == Project.id).filter(
        or_(ActivityLog.org_id == org_id, Project.organization_id == org_id)
    )
    recent_activity = [
        _serialize_activity(log)
        for log in org_activity_query.order_by(ActivityLog.created_at.desc()).limit(10).all()
    ]

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
        },
        "team": {
            "id": team.id,
            "organization_id": team.organization_id,
            "name": team.name,
            "description": team.description,
            "created_by": team.created_by,
            "my_role": team_role,
        },
        "summary": {
            "members": len(member_load),
            "projects": project_count,
            "open_items": int(total_open_items),
            "my_org_role": org_role,
        },
        "member_load": member_load,
        "recent_activity": recent_activity,
    }