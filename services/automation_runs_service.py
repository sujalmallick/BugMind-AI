"""
services/automation_runs_service.py — running automation at no cost to BugMind.

    export_script / export_project:  approved scripts → Playwright code / a
        ready-to-run project (config, GitHub Actions workflow, README). Tests run
        on the user's machine or their own free CI; BugMind never runs a browser.
    import_results:  the uploaded Playwright JSON report → a recorded run, linked
        test cases marked Passed / Failed ("changed by automation"), assignees
        notified, activity logged.
"""

import logging
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth.permissions import require_project_role
from constants import TEST_CASE_STATUSES
from database.models.automation import AutomationRun, AutomationScript
from database.models.test_case import TestCase
from database.models.workspace import Workspace
from guardrails import masker
from schemas.notification import NotificationBase
from services.activity_service import Verb, log_activity
from services.automation_results import ReportError, merge_outcomes, parse_report
from services.automation_service import _get_environment, _get_script, _test_case, serialize_environment
from services.notification_service import create_notification
from services.playwright_export import build_project_zip, script_to_spec, spec_filename

logger = logging.getLogger("BugMind")

MAX_RUNS_KEPT = 200
# Report outcome → test case status, in the canonical vocabulary the test case table and the
# dashboards use (constants.TEST_CASE_STATUSES). Skipped changes nothing.
_RESULT_STATUS = {"passed": TEST_CASE_STATUSES["PASSED"], "flaky": TEST_CASE_STATUSES["PASSED"],
                  "failed": TEST_CASE_STATUSES["FAILED"]}
_STATUS_LABEL = {TEST_CASE_STATUSES["PASSED"]: "Passed", TEST_CASE_STATUSES["FAILED"]: "Failed"}


def _case_codes(db: Session, project_id: int, case_ids: set[int]) -> dict[int, TestCase]:
    if not case_ids:
        return {}
    return {tc.id: tc for tc in db.query(TestCase).join(Workspace, Workspace.id == TestCase.workspace_id)
            .filter(TestCase.id.in_(case_ids), Workspace.project_id == project_id)}


# ── Export ───────────────────────────────────────────────────────────────────

def export_script(db: Session, user_id: int, project_id: int, script_id: int) -> tuple[str, str]:
    """(filename, TypeScript source) for one approved script."""
    require_project_role(db, user_id, project_id, "viewer")
    script = _get_script(db, project_id, script_id)
    if script.status != "approved" or script.environment_id is None:
        raise HTTPException(status_code=409, detail="Only approved scripts can be exported. Review and approve it first.")
    env = _get_environment(db, project_id, script.environment_id)
    tc = _test_case(db, project_id, script.test_case_id)
    return spec_filename(script), script_to_spec(script, serialize_environment(env), tc.test_case_id if tc else None)


def export_project(db: Session, user_id: int, project_id: int, environment_id: int) -> bytes:
    """Zip of every approved script for one environment, ready to run."""
    require_project_role(db, user_id, project_id, "viewer")
    env = _get_environment(db, project_id, environment_id)
    scripts = (db.query(AutomationScript)
               .filter(AutomationScript.project_id == project_id, AutomationScript.environment_id == env.id,
                       AutomationScript.status == "approved")
               .order_by(AutomationScript.id).all())
    if not scripts:
        raise HTTPException(status_code=409, detail="No approved scripts use this environment yet.")
    cases = _case_codes(db, project_id, {s.test_case_id for s in scripts if s.test_case_id})
    pairs = [(s, cases[s.test_case_id].test_case_id if s.test_case_id in cases else None) for s in scripts]
    return build_project_zip(pairs, serialize_environment(env))


# ── Runs ─────────────────────────────────────────────────────────────────────

def serialize_run(run: AutomationRun, detail: bool = False) -> dict:
    data = {
        "id": run.id,
        "source": run.source,
        "uploadedBy": run.uploaded_by,
        "startedAt": run.started_at.isoformat() if run.started_at else None,
        "durationMs": run.duration_ms,
        "totals": run.totals or {},
        "createdAt": run.created_at.isoformat() if run.created_at else None,
    }
    if detail:
        data["results"] = run.results or []
    return data


def list_runs(db: Session, user_id: int, project_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    runs = (db.query(AutomationRun).filter(AutomationRun.project_id == project_id)
            .order_by(AutomationRun.id.desc()).limit(100).all())
    return [serialize_run(r) for r in runs]


def get_run(db: Session, user_id: int, project_id: int, run_id: int) -> dict:
    require_project_role(db, user_id, project_id, "viewer")
    run = db.query(AutomationRun).filter(AutomationRun.id == run_id, AutomationRun.project_id == project_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    return serialize_run(run, detail=True)


def _masked_page(page: dict | None) -> dict | None:
    """
    The failure snapshot shows the tested website's content. Test variables were already
    redacted on the user's machine; personal data and secrets are masked before it's stored.
    """
    if not page:
        return None
    return {"url": masker.mask(page["url"]).text, "snapshot": masker.mask(page["snapshot"]).text}


def import_results(db: Session, user_id: int, project_id: int, data: bytes) -> dict:
    """
    Records a run from an uploaded report and applies it to linked test cases.
    A script that changed since it was exported is recorded but not applied: only
    the reviewed, exported version may change a test case.
    """
    require_project_role(db, user_id, project_id, "editor")
    try:
        report = parse_report(data)
    except ReportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    outcomes = merge_outcomes(report["tests"])
    if not outcomes:
        raise HTTPException(status_code=422, detail="No BugMind tests found in this report. Upload the "
                                                    "bugmind-results.json written by an exported project.")

    scripts = {s.id: s for s in db.query(AutomationScript).filter(
        AutomationScript.project_id == project_id, AutomationScript.id.in_(list(outcomes)))}
    cases = _case_codes(db, project_id, {s.test_case_id for s in scripts.values() if s.test_case_id})

    totals = {"passed": 0, "failed": 0, "flaky": 0, "skipped": 0, "unknown": 0}
    results = []
    for script_id, outcome in sorted(outcomes.items()):
        script = scripts.get(script_id)
        if script is None:  # another project's script, or deleted since the export
            totals["unknown"] += 1
            continue
        totals[outcome["status"]] += 1
        tc = cases.get(script.test_case_id)
        results.append({
            "scriptId": script.id, "scriptName": script.name, "exportedVersion": outcome["version"],
            "currentVersion": script.version, "status": outcome["status"], "error": outcome["error"],
            "durationMs": outcome["durationMs"], "testCaseId": tc.id if tc else None,
            "testCaseCode": tc.test_case_id if tc else None, "applied": False,
            "failedStep": outcome.get("failedStep"), "page": _masked_page(outcome.get("page")),
        })

    run = AutomationRun(project_id=project_id, uploaded_by=user_id, source="upload",
                        started_at=report["startedAt"], duration_ms=report["durationMs"], totals=totals, results=[])
    db.add(run)
    db.flush()

    now = datetime.utcnow().isoformat()
    changed = []
    for result in results:
        tc = cases.get(result["testCaseId"])
        new_status = _RESULT_STATUS.get(result["status"])
        if tc is None or new_status is None or result["exportedVersion"] != result["currentVersion"]:
            continue
        result["applied"] = True
        if tc.status != new_status:
            changed.append((tc, tc.status, new_status))
        tc.status = new_status
        tc.automation = {"runId": run.id, "scriptId": result["scriptId"], "result": result["status"], "at": now}
    run.results = results
    db.commit()
    db.refresh(run)

    for tc, old_status, new_status in changed:
        log_activity(db=db, verb=Verb.STATUS_TEST_CASE, entity_type="test_case", entity_id=tc.id,
                     entity_label=tc.description or tc.test_case_id, actor_id=user_id, project_id=project_id,
                     meta={"from": old_status, "to": new_status, "automated": True, "runId": run.id})
        if tc.assignee_id:
            create_notification(db, tc.assignee_id, user_id, NotificationBase(
                type="status_change",
                title=f"{tc.test_case_id} changed to {_STATUS_LABEL[new_status]} by automated run #{run.id}",
                message=(tc.description or "")[:200],
                action_url=f"/project/{project_id}/automation",
                entity_type="test_case", entity_id=tc.id, project_id=project_id,
            ))

    _trim_runs(db, project_id)
    logger.info(f"Automation results imported | project={project_id} run={run.id} totals={totals} "
                f"applied={sum(r['applied'] for r in results)} changed={len(changed)}")
    return serialize_run(run, detail=True)


def _trim_runs(db: Session, project_id: int) -> None:
    old = [rid for (rid,) in db.query(AutomationRun.id).filter(AutomationRun.project_id == project_id)
           .order_by(AutomationRun.id.desc()).offset(MAX_RUNS_KEPT)]
    if old:
        db.query(AutomationRun).filter(AutomationRun.id.in_(old)).delete(synchronize_session=False)
        db.commit()
