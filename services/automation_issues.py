"""
services/automation_issues.py — turn a failed automated result into a bug report.

Deterministic (no AI call, no cost): the report is assembled from what's
known for certain — the script's steps up to the failure, the test case's
expected result and the error the runner reported — so nothing in it is
invented. One report per failed result: asking again returns the same one.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth.permissions import require_project_role
from database.models.automation import AutomationRun
from database.models.issue import Issue
from services.automation_service import _get_script, _test_case
from services.issue_service import save_issue

_PRIORITY = {"high": "High", "medium": "Medium", "low": "Low"}


def describe_step(step: dict) -> str:
    """A readable sentence for a step without a description."""
    if step.get("description"):
        return step["description"]
    target = step.get("target") or {}
    element = (f'{target.get("value")} "{target["name"]}"' if target.get("by") == "role" and target.get("name")
               else f'"{target.get("value")}"') if target else ""
    action = step["action"].replace("_", " ")
    value = f' "{step["value"]}"' if step.get("value") else ""
    return f"{action} {element}{value}".strip().replace("  ", " ")


def _reproduction(steps: list[dict], failed_step: int | None) -> str:
    last = failed_step if failed_step and 1 <= failed_step <= len(steps) else len(steps)
    lines = [f"{i}. {describe_step(step)}" for i, step in enumerate(steps[:last], start=1)]
    if failed_step and failed_step <= len(steps):
        lines[-1] += "  ← failed here"
    return "\n".join(lines)


def create_issue_from_result(db: Session, user_id: int, project_id: int, run_id: int, script_id: int) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    run = db.query(AutomationRun).filter(AutomationRun.id == run_id, AutomationRun.project_id == project_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    results = [dict(r) for r in run.results or []]
    index = next((i for i, r in enumerate(results) if r.get("scriptId") == script_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="This script isn't in that run.")
    result = results[index]
    if result.get("status") != "failed":
        raise HTTPException(status_code=409, detail="Only failed results can become bug reports.")

    # One report per failure: return the existing one if it's still there.
    if result.get("issueId"):
        existing = db.get(Issue, result["issueId"])
        if existing is not None:
            return {"created": False, "issueId": existing.id, "bugId": existing.bug_id, "title": existing.title}

    script = _get_script(db, project_id, script_id)
    tc = _test_case(db, project_id, result.get("testCaseId"))
    failed_step = result.get("failedStep")
    error = (result.get("error") or "The automated test failed without an error message.").strip()
    where = f" at step {failed_step}" if failed_step else ""
    code = f"{tc.test_case_id}: " if tc else ""
    outdated = result.get("exportedVersion") != script.version
    page = result.get("page") or {}

    lines = [f"Automated run #{run.id} failed{where} (script \"{script.name}\", "
             f"version {result.get('exportedVersion')})."]
    if outdated:
        lines.append("The script has changed since this run; the steps below are its current version.")
    if page.get("url"):
        lines.append(f"Page: {page['url']}")
    lines += ["", "Error reported by the test runner:", error[:2000]]
    description = "\n".join(lines)

    issue = save_issue(db, project_id, user_id, {
        "title": f"{code}{script.name} fails{where}"[:255],
        "description": description,
        "severity": _PRIORITY.get((tc.priority or "").lower(), "Medium") if tc else "Medium",
        "priority": _PRIORITY.get((tc.priority or "").lower(), "Medium") if tc else "Medium",
        "reproduction_steps": _reproduction(script.steps or [], failed_step),
        "expected_result": (tc.expected_result if tc else "") or "The automated test passes.",
        "actual_result": error.splitlines()[0][:1000] if error else "",
        "linked_test_case_id": tc.id if tc else None,
        "custom_fields": {"source": "automation", "runId": run.id, "scriptId": script.id},
    })
    issue.reporter_id = user_id

    results[index] = {**result, "issueId": issue.id}
    run.results = results  # JSON column: assign a new list so the change is saved
    db.commit()
    return {"created": True, "issueId": issue.id, "bugId": issue.bug_id, "title": issue.title}
