"""
services/automation_summary.py — numbers for the automation dashboard.

Everything is computed from the stored runs, scripts and test cases on
request (a project keeps at most 200 runs), so there's nothing to keep in sync.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from auth.permissions import require_project_role
from database.models.automation import AutomationEnvironment, AutomationRun, AutomationScript
from database.models.test_case import TestCase
from database.models.workspace import Workspace

TREND_RUNS = 20
TOP = 5
NOT_AUTOMATED_LIST = 10


def pass_rate(totals: dict) -> float | None:
    """Share of executed tests that passed (flaky counts as passed); None when nothing executed."""
    passed = (totals.get("passed") or 0) + (totals.get("flaky") or 0)
    executed = passed + (totals.get("failed") or 0)
    return round(passed / executed, 4) if executed else None


def automation_summary(db: Session, user_id: int, project_id: int) -> dict:
    require_project_role(db, user_id, project_id, "viewer")

    scripts = db.query(AutomationScript).filter(AutomationScript.project_id == project_id).all()
    names = {s.id: s.name for s in scripts}
    approved_case_ids = {s.test_case_id for s in scripts if s.status == "approved" and s.test_case_id}
    scripted_case_ids = {s.test_case_id for s in scripts if s.test_case_id}

    cases = (db.query(TestCase).join(Workspace, Workspace.id == TestCase.workspace_id)
             .filter(Workspace.project_id == project_id, TestCase.test_case_id != "IMPORT-DEFAULT")
             .order_by(TestCase.id).all())
    case_ids = {tc.id for tc in cases}
    not_automated = [tc for tc in cases if tc.id not in scripted_case_ids]
    priority_order = {"high": 0, "medium": 1, "low": 2}
    not_automated.sort(key=lambda tc: (priority_order.get((tc.priority or "").lower(), 3), tc.id))

    recent = (db.query(AutomationRun).filter(AutomationRun.project_id == project_id)
              .order_by(AutomationRun.id.desc()).limit(TREND_RUNS).all())
    month_ago = datetime.utcnow() - timedelta(days=30)
    runs_30d = (db.query(AutomationRun)
                .filter(AutomationRun.project_id == project_id, AutomationRun.created_at >= month_ago).count())

    failures: dict[int, int] = {}
    flaky: dict[int, int] = {}
    appearances: dict[int, int] = {}
    last_status: dict[int, str] = {}
    for run in recent:  # newest first: the first status seen per script is its latest
        for result in run.results or []:
            sid = result.get("scriptId")
            if sid not in names:
                continue  # script deleted since
            appearances[sid] = appearances.get(sid, 0) + 1
            last_status.setdefault(sid, result.get("status"))
            if result.get("status") == "failed":
                failures[sid] = failures.get(sid, 0) + 1
            elif result.get("status") == "flaky":
                flaky[sid] = flaky.get(sid, 0) + 1

    def ranked(counts: dict[int, int]) -> list[dict]:
        top = sorted(counts.items(), key=lambda item: (-item[1], names[item[0]].lower()))[:TOP]
        return [{"scriptId": sid, "name": names[sid], "count": n, "runs": appearances[sid],
                 "lastStatus": last_status.get(sid)} for sid, n in top]

    trend = [{
        "runId": run.id,
        "at": (run.started_at or run.created_at).isoformat() if (run.started_at or run.created_at) else None,
        **{k: (run.totals or {}).get(k, 0) for k in ("passed", "failed", "flaky", "skipped")},
        "passRate": pass_rate(run.totals or {}),
    } for run in reversed(recent)]
    last = recent[0] if recent else None

    return {
        "counts": {
            "scripts": len(scripts),
            "approved": sum(1 for s in scripts if s.status == "approved"),
            "environments": db.query(AutomationEnvironment)
                              .filter(AutomationEnvironment.project_id == project_id).count(),
            "testCases": len(cases),
            "automatedTestCases": len(approved_case_ids & case_ids),
            "runs30d": runs_30d,
        },
        "lastRun": {"id": last.id, "passRate": pass_rate(last.totals or {}), "totals": last.totals or {},
                    "at": (last.started_at or last.created_at).isoformat() if (last.started_at or last.created_at) else None}
                   if last else None,
        "trend": trend,
        "failing": ranked(failures),
        "flaky": ranked(flaky),
        "notAutomatedCount": len(not_automated),
        "notAutomated": [{"id": tc.id, "code": tc.test_case_id, "description": tc.description,
                          "priority": tc.priority} for tc in not_automated[:NOT_AUTOMATED_LIST]],
    }
