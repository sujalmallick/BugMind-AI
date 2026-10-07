"""
Free-to-run automation (P5): approved scripts export as Playwright code / a
ready-to-run project, and an uploaded Playwright JSON report becomes a run that
updates linked test cases, notifies assignees and logs activity.
"""

import io
import json
import subprocess
import zipfile
from pathlib import Path

import pytest

from database.models.activity_log import ActivityLog
from database.models.automation import AutomationRun, AutomationScript
from database.models.notification import Notification
from database.models.test_case import TestCase
from test_automation import BASE, ENV, GOOD_STEPS, auto, create_env  # noqa: F401 — auto is a fixture
from test_knowledge_rag import env  # noqa: F401 — env is a fixture

TRICKY = 'He said "hi"\n`${process.exit(1)}` </script>   done'


@pytest.fixture
def ready(auto):
    """An environment, an approved script linked to TC-001 (assigned to user 4) and a draft one."""
    env_id = create_env(auto).json()["id"]
    tc = auto.db.get(TestCase, 50)
    tc.assignee_id = 4
    auto.db.commit()
    steps = GOOD_STEPS + [{"action": "expect_text", "target": {"by": "role", "value": "heading", "name": TRICKY},
                           "value": "Welcome {{vars.USER_EMAIL}} " + TRICKY, "match": "equals"}]
    approved = auto.client.post(f"{BASE}/scripts", json={"name": "Login " + TRICKY[:20], "steps": steps,
                                                         "environment_id": env_id, "test_case_id": 50}).json()
    auto.client.patch(f"{BASE}/scripts/{approved['id']}", json={"status": "approved"})
    draft = auto.client.post(f"{BASE}/scripts", json={"name": "Draft", "steps": GOOD_STEPS,
                                                      "environment_id": env_id}).json()
    auto.ready = {"env": env_id, "approved": approved["id"], "draft": draft["id"]}
    return auto


def report(*specs, start="2026-10-07T10:00:00.000Z"):
    """A Playwright JSON report: specs as (title, status, error) in a nested suite."""
    def spec(title, status, error=None):
        result = {"status": "failed" if status == "unexpected" else "passed", "duration": 1200}
        if error:
            result["error"] = {"message": error}
        return {"title": title, "ok": status != "unexpected", "tests": [{"status": status, "results": [result]}]}
    return json.dumps({
        "config": {}, "stats": {"startTime": start, "duration": 5000},
        "suites": [{"title": "login.spec.ts", "specs": [], "suites": [
            {"title": "group", "specs": [spec(*s) for s in specs], "suites": []}]}],
    }).encode()


def upload(env, data, name="bugmind-results.json"):
    return env.client.post(f"{BASE}/runs/import", files={"file": (name, data, "application/json")})


# ── Export ───────────────────────────────────────────────────────────────────

def test_single_export_is_safe_playwright_code(ready):
    response = ready.client.get(f"{BASE}/scripts/{ready.ready['approved']}/export")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith('attachment; filename="login-')
    code = response.text
    assert f"[BM-{ready.ready['approved']} v1]" in code
    assert "TC-001" in code
    assert "page.getByRole(\"button\", { name: \"Sign in\" })" in code
    assert "await expect(page).toHaveURL(contains(\"/dashboard\"));" in code
    assert 'v("USER_EMAIL")' in code and 'v("USER_PASSWORD")' in code
    assert "s3cret" not in code and "qa@example.com" not in code       # values never exported
    # Script text only ever appears as escaped string literals, never as code.
    assert json.dumps(TRICKY).replace(" ", "\\u2028") in code
    assert "\n`${process.exit(1)}`" not in code
    assert '["shop.example.com", "pay.example.com"]' in code


def test_generated_code_is_valid_typescript(ready, tmp_path):
    """Compiles the export with the frontend's bundler (rolldown), which parses TypeScript."""
    bin_dir = Path(__file__).resolve().parents[1] / "frontend" / "node_modules" / ".bin"
    rolldown = next((p for p in (bin_dir / "rolldown.cmd", bin_dir / "rolldown") if p.exists()), None)
    if rolldown is None:
        pytest.skip("frontend dependencies not installed")
    spec = tmp_path / "t.spec.ts"
    spec.write_text(ready.client.get(f"{BASE}/scripts/{ready.ready['approved']}/export").text, encoding="utf-8")
    result = subprocess.run([str(rolldown), str(spec), "--format", "esm", "--external", "@playwright/test",
                             "-d", str(tmp_path / "out")], capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr


def test_drafts_cannot_be_exported(ready):
    assert ready.client.get(f"{BASE}/scripts/{ready.ready['draft']}/export").status_code == 409


def test_project_export_contains_a_ready_to_run_project(ready):
    response = ready.client.get(f"{BASE}/environments/{ready.ready['env']}/export")
    assert response.status_code == 200 and response.headers["content-type"] == "application/zip"
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    names = set(archive.namelist())
    assert {"bugmind-e2e/playwright.config.ts", "bugmind-e2e/package.json", "bugmind-e2e/.env.example",
            "bugmind-e2e/.gitignore", "bugmind-e2e/README.md",
            "bugmind-e2e/.github/workflows/bugmind-e2e.yml"} <= names
    specs = [n for n in names if n.endswith(".spec.ts")]
    assert len(specs) == 1                                             # drafts are left out
    everything = "\n".join(archive.read(n).decode() for n in names)
    assert "s3cret" not in everything
    env_example = archive.read("bugmind-e2e/.env.example").decode()
    assert "USER_EMAIL=qa@example.com" in env_example and "USER_PASSWORD=\n" in env_example
    workflow = archive.read("bugmind-e2e/.github/workflows/bugmind-e2e.yml").decode()
    assert "USER_PASSWORD: ${{ secrets.USER_PASSWORD }}" in workflow
    assert "'json', { outputFile: 'bugmind-results.json' }" in archive.read("bugmind-e2e/playwright.config.ts").decode()


def test_project_export_needs_an_approved_script(auto):
    env_id = create_env(auto).json()["id"]
    assert auto.client.get(f"{BASE}/environments/{env_id}/export").status_code == 409


def test_viewers_can_export_but_outsiders_cannot(ready):
    ready.as_user(2)
    assert ready.client.get(f"{BASE}/scripts/{ready.ready['approved']}/export").status_code == 200
    ready.as_user(3)
    assert ready.client.get(f"{BASE}/scripts/{ready.ready['approved']}/export").status_code in (403, 404)
    assert ready.client.get(f"{BASE}/environments/{ready.ready['env']}/export").status_code in (403, 404)


# ── Results ──────────────────────────────────────────────────────────────────

def test_failed_run_updates_the_test_case_notifies_and_logs(ready):
    sid = ready.ready["approved"]
    data = report((f"TC-001 Login [BM-{sid} v1]", "unexpected", "\x1b[31mTimeout\x1b[39m waiting for getByRole('button')"),
                  ("some other test", "expected"),
                  ("Not ours [BM-999999 v1]", "expected"))
    run = upload(ready, data).json()

    assert run["totals"] == {"passed": 0, "failed": 1, "flaky": 0, "skipped": 0, "unknown": 1}
    result = run["results"][0]
    assert result["status"] == "failed" and result["applied"] is True and result["testCaseCode"] == "TC-001"
    assert result["error"] == "Timeout waiting for getByRole('button')"   # ANSI colours stripped

    ready.db.expire_all()
    tc = ready.db.get(TestCase, 50)
    assert tc.status == "fail"          # the canonical vocabulary (constants.TEST_CASE_STATUSES)
    assert tc.automation == {"runId": run["id"], "scriptId": sid, "result": "failed", "at": tc.automation["at"]}
    note = ready.db.query(Notification).filter(Notification.user_id == 4).one()
    assert note.title == f"TC-001 changed to Failed by automated run #{run['id']}"
    log = ready.db.query(ActivityLog).filter(ActivityLog.entity_id == 50).order_by(ActivityLog.id.desc()).first()
    meta = json.loads(log.meta) if isinstance(log.meta, str) else log.meta
    assert meta["automated"] is True and meta["to"] == "fail"


def test_results_of_a_changed_script_are_recorded_but_not_applied(ready):
    sid = ready.ready["approved"]
    ready.client.patch(f"{BASE}/scripts/{sid}", json={"steps": GOOD_STEPS})   # now v2, back to draft
    run = upload(ready, report((f"Login [BM-{sid} v1]", "expected"))).json()
    assert run["results"][0]["applied"] is False and run["results"][0]["currentVersion"] == 2
    ready.db.expire_all()
    assert ready.db.get(TestCase, 50).status != "pass"


def test_flaky_counts_as_passed_and_failure_wins_across_retries(ready):
    from services.automation_results import merge_outcomes

    sid = ready.ready["approved"]
    run = upload(ready, report((f"Login [BM-{sid} v1]", "flaky"))).json()
    assert run["totals"]["flaky"] == 1
    ready.db.expire_all()
    assert ready.db.get(TestCase, 50).status == "pass"
    merged = merge_outcomes([{"scriptId": 1, "version": 1, "status": "passed", "error": None, "durationMs": 1},
                             {"scriptId": 1, "version": 1, "status": "failed", "error": "x", "durationMs": 2}])
    assert merged[1]["status"] == "failed" and merged[1]["durationMs"] == 3


def test_a_person_changing_the_status_clears_the_automation_badge(ready):
    sid = ready.ready["approved"]
    upload(ready, report((f"Login [BM-{sid} v1]", "unexpected", "boom")))
    assert ready.client.put("/test-cases/1/50", json={"status": "pass"}).status_code == 200
    ready.db.expire_all()
    assert ready.db.get(TestCase, 50).automation is None


@pytest.mark.parametrize("data, message", [
    (b"not json", "isn't a Playwright JSON report"),
    (b'{"suites": "nope"}', "isn't a Playwright JSON report"),
    (json.dumps({"suites": [{"specs": [{"title": "plain test", "tests": [{"status": "expected"}]}]}]}).encode(),
     "No BugMind tests"),
    (b" " * (4 * 1024 * 1024 + 10), "larger than 4 MB"),
], ids=["not-json", "no-suites", "no-bugmind-tests", "too-large"])
def test_bad_reports_are_rejected(ready, data, message):
    response = upload(ready, data)
    assert response.status_code == 422 and message in response.json()["detail"]
    assert ready.db.query(AutomationRun).count() == 0


def test_viewers_cannot_upload_results(ready):
    ready.as_user(2)
    sid = ready.ready["approved"]
    assert upload(ready, report((f"Login [BM-{sid} v1]", "expected"))).status_code == 403


def test_runs_are_listed_and_old_ones_trimmed(ready, monkeypatch):
    import services.automation_runs_service as service

    monkeypatch.setattr(service, "MAX_RUNS_KEPT", 2)
    sid = ready.ready["approved"]
    # Different start times: an identical report is only recorded once.
    ids = [upload(ready, report((f"Login [BM-{sid} v1]", "expected"), start=f"2026-10-07T10:0{i}:00.000Z")).json()["id"]
           for i in range(3)]
    listed = ready.client.get(f"{BASE}/runs").json()
    assert [r["id"] for r in listed] == ids[:0:-1]
    assert ready.client.get(f"{BASE}/runs/{ids[0]}").status_code == 404
    assert ready.client.get(f"{BASE}/runs/{ids[2]}").json()["results"][0]["scriptId"] == sid


def test_deeply_nested_or_huge_reports_are_bounded():
    from services.automation_results import ReportError, parse_report

    suite = {"specs": [{"title": "deep [BM-1 v1]", "tests": [{"status": "expected"}]}], "suites": []}
    for _ in range(50):
        suite = {"specs": [], "suites": [suite]}
    assert parse_report(json.dumps({"suites": [suite]}).encode())["tests"] == []   # beyond the depth limit
    many = {"suites": [{"specs": [{"title": f"t [BM-{i} v1]", "tests": [{"status": "expected"}]}
                                  for i in range(2001)]}]}
    with pytest.raises(ReportError, match="more than 2000"):
        parse_report(json.dumps(many).encode())


def test_deleting_the_project_removes_runs(ready):
    sid = ready.ready["approved"]
    upload(ready, report((f"Login [BM-{sid} v1]", "expected")))
    assert ready.client.delete("/projects/1").status_code in (200, 204)
    ready.db.expire_all()
    assert ready.db.query(AutomationRun).count() == 0 and ready.db.query(AutomationScript).count() == 0


def test_absurdly_nested_json_is_a_clean_error():
    from services.automation_results import ReportError, parse_report

    with pytest.raises(ReportError):
        parse_report(b"[" * 100_000 + b"]" * 100_000)


# ── Hardening of the exported project ────────────────────────────────────────

def test_export_pins_versions_limits_ci_permissions_and_guards_popups(ready):
    archive = zipfile.ZipFile(io.BytesIO(ready.client.get(f"{BASE}/environments/{ready.ready['env']}/export").content))
    package = json.loads(archive.read("bugmind-e2e/package.json"))
    for version in package["devDependencies"].values():
        assert version[0].isdigit(), version                       # exact versions, no ^ or ~ ranges
    workflow = archive.read("bugmind-e2e/.github/workflows/bugmind-e2e.yml").decode()
    assert "permissions:\n  contents: read" in workflow
    assert "npm ci" in workflow
    config = archive.read("bugmind-e2e/playwright.config.ts").decode()
    assert "actionTimeout: 15_000" in config
    spec = next(archive.read(n).decode() for n in archive.namelist() if n.endswith(".spec.ts"))
    assert "page.context().route(" in spec and "parentFrame() === null" in spec   # popups and new tabs too
    assert "'bugmind-blocked-navigation'" in spec


def test_blocked_navigation_gets_a_clear_message():
    from services.automation_results import parse_report

    report = {"suites": [{"specs": [{"title": "x [BM-1 v1]", "tests": [{
        "status": "unexpected",
        "annotations": [{"type": "bugmind-blocked-navigation", "description": "https://todomvc.com/"}],
        "results": [{"status": "failed", "error": {"message": "Error: expect(page).toHaveURL(expected) failed"}}],
    }]}]}]}
    error = parse_report(json.dumps(report).encode())["tests"][0]["error"]
    assert error.startswith("Navigation to https://todomvc.com/ was blocked: it isn't one of the environment's")
    assert "toHaveURL" in error
