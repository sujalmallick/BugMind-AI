"""
services/activity_service.py

Central hub for writing and reading activity log entries.
"""

import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.models.activity_log import ActivityLog
from database.models.user import User
from auth.permissions import require_project_role


# ── VERB CONSTANTS ────────────────────────────────────────────────────────────

class Verb:
    # Test cases
    CREATED_TEST_CASE    = "created_test_case"
    UPDATED_TEST_CASE    = "updated_test_case"
    DELETED_TEST_CASE    = "deleted_test_case"
    ASSIGNED_TEST_CASE   = "assigned_test_case"
    UNASSIGNED_TEST_CASE = "unassigned_test_case"
    STATUS_TEST_CASE     = "changed_test_case_status"

    # Issues
    CREATED_ISSUE        = "created_issue"
    ASSIGNED_ISSUE       = "assigned_issue"
    UNASSIGNED_ISSUE     = "unassigned_issue"
    STATUS_ISSUE         = "changed_issue_status"

    # Members
    MEMBER_JOINED        = "member_joined"
    MEMBER_LEFT          = "member_left"
    MEMBER_ROLE_CHANGED  = "changed_member_role"

    # Invitations
    INVITE_ACCEPTED      = "accepted_invitation"
    INVITE_SENT          = "sent_invitation"

    # Projects
    CREATED_PROJECT      = "created_project"
    UPDATED_PROJECT      = "updated_project"


# ── ICON / LABEL MAP (used on the frontend) ───────────────────────────────────

VERB_META = {
    Verb.CREATED_TEST_CASE:    {"icon": "ListPlus",     "color": "text-blue-500",   "label": "created test case"},
    Verb.UPDATED_TEST_CASE:    {"icon": "Pencil",       "color": "text-indigo-500", "label": "updated test case"},
    Verb.DELETED_TEST_CASE:    {"icon": "Trash2",       "color": "text-red-500",    "label": "deleted test case"},
    Verb.ASSIGNED_TEST_CASE:   {"icon": "UserPlus",     "color": "text-violet-500", "label": "assigned test case"},
    Verb.UNASSIGNED_TEST_CASE: {"icon": "UserMinus",    "color": "text-slate-500",  "label": "unassigned test case"},
    Verb.STATUS_TEST_CASE:     {"icon": "RefreshCw",    "color": "text-teal-500",   "label": "updated status"},
    Verb.CREATED_ISSUE:        {"icon": "Bug",          "color": "text-red-500",    "label": "logged issue"},
    Verb.ASSIGNED_ISSUE:       {"icon": "UserPlus",     "color": "text-violet-500", "label": "assigned issue"},
    Verb.UNASSIGNED_ISSUE:     {"icon": "UserMinus",    "color": "text-slate-500",  "label": "unassigned issue"},
    Verb.STATUS_ISSUE:         {"icon": "RefreshCw",    "color": "text-teal-500",   "label": "updated issue status"},
    Verb.MEMBER_JOINED:        {"icon": "UserCheck",    "color": "text-green-500",  "label": "joined"},
    Verb.MEMBER_LEFT:          {"icon": "UserX",        "color": "text-red-500",    "label": "left"},
    Verb.MEMBER_ROLE_CHANGED:  {"icon": "Shield",       "color": "text-amber-500",  "label": "role changed"},
    Verb.INVITE_ACCEPTED:      {"icon": "MailCheck",    "color": "text-green-500",  "label": "accepted invitation"},
    Verb.INVITE_SENT:          {"icon": "Mail",         "color": "text-blue-500",   "label": "sent invitation"},
    Verb.CREATED_PROJECT:      {"icon": "FolderPlus",   "color": "text-blue-500",   "label": "created project"},
    Verb.UPDATED_PROJECT:      {"icon": "FolderEdit",   "color": "text-indigo-500", "label": "updated project"},
}


# ── WRITER ────────────────────────────────────────────────────────────────────

def log_activity(
    db: Session,
    verb: str,
    entity_type: str,
    entity_id: int,
    entity_label: str = None,
    actor_id: int = None,
    project_id: int = None,
    org_id: int = None,
    meta: dict = None,
):
    """Write a single activity row. Fire-and-forget — never raises."""
    try:
        entry = ActivityLog(
            actor_id=actor_id,
            verb=verb,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            project_id=project_id,
            org_id=org_id,
            meta=json.dumps(meta) if meta else None,
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


def _serialize(log: ActivityLog) -> dict:
    actor = log.actor
    return {
        "id": log.id,
        "verb": log.verb,
        "verb_label": VERB_META.get(log.verb, {}).get("label", log.verb),
        "verb_icon": VERB_META.get(log.verb, {}).get("icon", "Activity"),
        "verb_color": VERB_META.get(log.verb, {}).get("color", "text-muted"),
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "entity_label": log.entity_label,
        "project_id": log.project_id,
        "org_id": log.org_id,
        "meta": json.loads(log.meta) if log.meta else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "actor": {
            "id": actor.id,
            "name": actor.name,
            "email": actor.email,
            "avatar_url": actor.avatar_url if hasattr(actor, "avatar_url") else None,
        } if actor else None,
    }


# ── READERS ───────────────────────────────────────────────────────────────────

def get_project_activity(
    db: Session,
    project_id: int,
    current_user_id: int,
    page: int = 1,
    limit: int = 30,
) -> dict:
    require_project_role(db, current_user_id, project_id, "viewer")

    offset = (page - 1) * limit
    total = db.query(ActivityLog).filter(ActivityLog.project_id == project_id).count()
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.project_id == project_id)
        .order_by(desc(ActivityLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [_serialize(l) for l in logs],
    }


def get_my_activity(
    db: Session,
    user_id: int,
    page: int = 1,
    limit: int = 30,
) -> dict:
    offset = (page - 1) * limit
    total = db.query(ActivityLog).filter(ActivityLog.actor_id == user_id).count()
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.actor_id == user_id)
        .order_by(desc(ActivityLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [_serialize(l) for l in logs],
    }
