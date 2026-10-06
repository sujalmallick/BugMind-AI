"""
services/project_context.py — read-only project context for the agents.

Every function is scoped to one project and checks that the caller can at
least view it. Nothing here writes, and nothing here calls an LLM: lookups
are plain queries and keyword similarity, so they cost no tokens.

Values returned here are user-written project data. When they go into a
prompt, wrap them with untrusted_block(..., source=Source.USER).
"""

from sqlalchemy.orm import Session

from agents.coverage import keywords
from auth.permissions import require_project_role
from database.models.issue import Issue
from database.models.test_case import TestCase
from database.models.workspace import Workspace

# Bounded scan: duplicate search looks at the most recent issues only.
MAX_ISSUES_SCANNED = 500
DUPLICATE_THRESHOLD = 0.3
MAX_DUPLICATES = 3


def get_test_case_by_ref(db: Session, user_id: int, project_id: int, ref: str) -> dict | None:
    """A project test case by its display id (e.g. "TC-003"), or None."""
    require_project_role(db, user_id, project_id, "viewer")
    ref = (ref or "").strip().upper()
    if not ref:
        return None

    tc = (
        db.query(TestCase)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(Workspace.project_id == project_id, TestCase.test_case_id == ref)
        .order_by(TestCase.id)
        .first()
    )
    if not tc:
        return None
    return {
        "dbId": tc.id,
        "id": tc.test_case_id,
        "module": tc.module or "",
        "description": tc.description or "",
        "preconditions": tc.preconditions or "",
        "steps": [s for s in (tc.steps or "").split("\n") if s.strip()],
        "expectedResult": tc.expected_result or "",
    }


def _similarity(query: set[str], candidate: set[str]) -> float:
    union = query | candidate
    return len(query & candidate) / len(union) if union else 0.0


def find_similar_issues(
    db: Session,
    user_id: int,
    project_id: int,
    text: str,
    limit: int = MAX_DUPLICATES,
    threshold: float = DUPLICATE_THRESHOLD,
) -> list[dict]:
    """Existing project issues whose title/description resemble `text`, best match first."""
    require_project_role(db, user_id, project_id, "viewer")
    query = keywords(text)
    if not query:
        return []

    issues = (
        db.query(Issue)
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .filter(Workspace.project_id == project_id)
        .order_by(Issue.id.desc())
        .limit(MAX_ISSUES_SCANNED)
        .all()
    )

    scored = []
    for issue in issues:
        score = _similarity(query, keywords(f"{issue.title} {issue.description}"))
        if score >= threshold:
            scored.append((score, issue))
    scored.sort(key=lambda pair: (-pair[0], -pair[1].id))

    return [
        {
            "id": issue.id,
            "bugId": issue.bug_id,
            "title": issue.title,
            "status": issue.status,
            "similarity": round(score, 2),
        }
        for score, issue in scored[:limit]
    ]
