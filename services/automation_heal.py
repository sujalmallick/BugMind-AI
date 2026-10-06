"""
services/automation_heal.py — self-healing suggestions for failed scripts.

    failed result (+ page snapshot from the user's run) → heal agent → every
    suggested locator verified against the snapshot → a proposed step list

Nothing is saved here: the person reviews the diff and applies it, which sends
the script back to draft for approval like any other edit.
"""

import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from agents.e2e_heal_agent import AGENT, heal_agent
from auth.permissions import require_project_role
from database.models.automation import AutomationRun
from services.ai_output import safe_generated_text
from services.automation_actions import StepError, validate_step
from services.automation_service import _get_script

logger = logging.getLogger("BugMind")


def found_on_page(target: dict, snapshot: str) -> bool:
    """
    Hallucination check: the element must be visible in the accessibility snapshot
    (lines like `- button "Sign in" [ref=e5]`). Test ids and CSS can't be verified there.
    """
    snap = snapshot.lower()
    by, value, name = target["by"], target["value"].lower(), (target.get("name") or "").lower()
    if by == "role":
        return f'{value} "{name}"' in snap if name else f"- {value}" in snap
    if by == "label":
        return f'"{value}"' in snap
    if by in ("text", "placeholder"):
        return value in snap
    return False


def heal_script(db: Session, user_id: int, project_id: int, script_id: int, run_id: int) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    script = _get_script(db, project_id, script_id)
    run = db.query(AutomationRun).filter(AutomationRun.id == run_id, AutomationRun.project_id == project_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    result = next((r for r in run.results or [] if r.get("scriptId") == script.id), None)
    if result is None:
        raise HTTPException(status_code=404, detail="This script isn't in that run.")
    if result.get("status") != "failed":
        raise HTTPException(status_code=409, detail="Only failed results can be healed.")
    if result.get("exportedVersion") != script.version:
        raise HTTPException(status_code=409, detail="The script changed since this run. Export and run it again.")
    page = result.get("page")
    if not page or not page.get("snapshot"):
        raise HTTPException(status_code=409, detail="This failure has no page snapshot. Download the tests again "
                                                    "(newer exports capture one) and re-run them.")

    steps = list(script.steps or [])
    suggestion = heal_agent(steps, result.get("failedStep"), result.get("error"), page, user_id=user_id)
    if suggestion.get("success") is False:
        return suggestion

    proposed = [dict(s) for s in steps]
    changes, rejected = [], []
    for change in suggestion["changes"]:
        if not isinstance(change, dict):
            continue
        number = change.get("step")
        if not isinstance(number, int) or isinstance(number, bool) or not 1 <= number <= len(steps):
            rejected.append("A suggestion pointed at a step that doesn't exist.")
            continue
        original = steps[number - 1]
        if "target" not in original:
            rejected.append(f"Step {number} has no element to change.")
            continue
        try:
            candidate = validate_step({**original, "target": change.get("target")})
        except StepError as exc:
            rejected.append(f"Step {number}: {exc}")
            continue
        new_target = candidate["target"]
        if new_target == original["target"] or any(c["step"] == number for c in changes):
            continue
        if not found_on_page(new_target, page["snapshot"]):
            label = new_target.get("name") or new_target["value"]
            rejected.append(f"Step {number}: suggested element \"{label}\" isn't on the page, so it was ignored.")
            continue
        reason = safe_generated_text(str(change.get("reason") or ""), AGENT) or ""
        proposed[number - 1] = {**original, "target": new_target}
        changes.append({"step": number, "before": original["target"], "after": new_target, "reason": reason[:300]})

    summary = safe_generated_text(suggestion["summary"], AGENT) if suggestion["summary"] else ""
    notes = [n for n in (safe_generated_text(n, AGENT) for n in suggestion["notes"]) if n]
    verdict = suggestion["verdict"]
    if verdict == "locator" and not changes:
        verdict = "unclear"  # every proposed fix failed verification
    logger.info(f"Heal suggestion | project={project_id} script={script.id} run={run.id} verdict={verdict} "
                f"changes={len(changes)} rejected={len(rejected)}")
    return {
        "success": True,
        "verdict": verdict,
        "summary": summary or "",
        "changes": changes,
        "rejected": rejected[:10],
        "notes": notes,
        "steps": proposed,
        "basedOnVersion": script.version,
    }
