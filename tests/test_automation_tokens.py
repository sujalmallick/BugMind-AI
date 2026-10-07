"""
Upload tokens: a CI job sends results to ONE project, with nothing else allowed.
Hashed at rest, shown once, expiring, revocable, re-checked against the
creator's access on every use, and the same report is recorded once.
"""

import io
import json
import logging
import zipfile
from datetime import datetime, timedelta

import pytest

from database.models.automation import AutomationRun, AutomationUploadToken
from database.models.project_member import ProjectMember
from database.models.test_case import TestCase
from test_automation import BASE, auto, create_env  # noqa: F401 — auto is a fixture
from test_automation_runs import ready, report  # noqa: F401 — ready is a fixture
from test_knowledge_rag import env  # noqa: F401 — env is a fixture

UPLOAD = "/automation/runs/upload"


def new_token(env, name="GitHub", days=90):
    return env.client.post(f"{BASE}/tokens", json={"name": name, "expires_in_days": days})


def ci_upload(env, token, data):
    headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
    return env.client.post(UPLOAD, files={"file": ("bugmind-results.json", data, "application/json")}, headers=headers)


def failing_report(ready, start="2026-10-08T10:00:00.000Z"):
    return report((f"TC-001 Login [BM-{ready.ready['approved']} v1]", "unexpected", "boom"), start=start)


# ── Managing tokens ──────────────────────────────────────────────────────────

def test_token_is_shown_once_and_stored_hashed(auto):
    response = new_token(auto)
    assert response.status_code == 201 and response.headers["cache-control"] == "no-store"
    body = response.json()
    raw = body["token"]
    assert raw.startswith("bm_up_") and len(raw) > 40
    assert body["prefix"] == raw[:12] and body["status"] == "active"
    expires = datetime.fromisoformat(body["expiresAt"])
    assert timedelta(days=89) < expires - datetime.utcnow() <= timedelta(days=90)

    listed = auto.client.get(f"{BASE}/tokens").json()
    assert "token" not in listed[0] and raw not in json.dumps(listed)
    row = auto.db.get(AutomationUploadToken, body["id"])
    assert raw not in json.dumps([row.token_hash, row.prefix]) and len(row.token_hash) == 64


@pytest.mark.parametrize("payload", [{"name": "x", "expires_in_days": 7}, {"name": "x", "expires_in_days": None},
                                     {"name": "", "expires_in_days": 90}, {"name": "x" * 61}])
def test_invalid_tokens_are_rejected(auto, payload):
    assert auto.client.post(f"{BASE}/tokens", json=payload).status_code == 422


def test_only_editors_manage_tokens(auto):
    token_id = new_token(auto).json()["id"]
    auto.as_user(2)  # viewer
    assert new_token(auto).status_code == 403
    assert auto.client.get(f"{BASE}/tokens").status_code == 403
    assert auto.client.delete(f"{BASE}/tokens/{token_id}").status_code == 403
    auto.as_user(3)  # not a member
    assert auto.client.get(f"{BASE}/tokens").status_code in (403, 404)


def test_active_token_limit_ignores_revoked_ones(auto):
    ids = [new_token(auto, name=f"t{i}").json()["id"] for i in range(5)]
    assert new_token(auto).status_code == 409
    auto.client.delete(f"{BASE}/tokens/{ids[0]}")
    assert new_token(auto).status_code == 201


# ── Uploading with a token ───────────────────────────────────────────────────

def test_ci_upload_records_the_run_and_updates_test_cases(ready, caplog):
    token = new_token(ready).json()
    with caplog.at_level(logging.INFO):
        response = ci_upload(ready, token["token"], failing_report(ready))
    assert response.status_code == 200
    body = response.json()
    assert body["duplicate"] is False and body["totals"]["failed"] == 1 and body["testCasesUpdated"] == 1

    run = ready.db.get(AutomationRun, body["runId"])
    assert run.source == "ci" and run.token_id == token["id"] and run.uploaded_by == 1
    ready.db.expire_all()
    assert ready.db.get(TestCase, 50).status == "fail"
    assert ready.db.get(AutomationUploadToken, token["id"]).last_used_at is not None
    assert token["token"] not in caplog.text                       # never logged
    assert ready.client.get(f"{BASE}/runs").json()[0]["source"] == "ci"


def test_the_same_report_is_recorded_once(ready):
    token = new_token(ready).json()["token"]
    data = failing_report(ready)
    first = ci_upload(ready, token, data).json()
    again = ci_upload(ready, token, data).json()
    assert again == {"duplicate": True, "runId": first["runId"]}
    # By hand, the duplicate is explained instead of silently ignored.
    manual = ready.client.post(f"{BASE}/runs/import", files={"file": ("r.json", data, "application/json")})
    assert manual.status_code == 409 and f"run #{first['runId']}" in manual.json()["detail"]
    assert ready.db.query(AutomationRun).count() == 1


@pytest.mark.parametrize("header", [None, "Bearer", "Bearer abc", "Basic bm_up_x", "Bearer bm_up_" + "x" * 43])
def test_missing_malformed_or_unknown_tokens_are_refused(ready, header):
    headers = {"Authorization": header} if header else {}
    response = ready.client.post(UPLOAD, files={"file": ("r.json", failing_report(ready), "application/json")},
                                 headers=headers)
    assert response.status_code == 401
    assert ready.db.query(AutomationRun).count() == 0


def test_revoked_and_expired_tokens_stop_working(ready):
    revoked = new_token(ready, name="old").json()
    ready.client.delete(f"{BASE}/tokens/{revoked['id']}")
    assert ci_upload(ready, revoked["token"], failing_report(ready)).status_code == 401

    expired = new_token(ready, name="expired").json()
    row = ready.db.get(AutomationUploadToken, expired["id"])
    row.expires_at = datetime.utcnow() - timedelta(minutes=1)
    ready.db.commit()
    response = ci_upload(ready, expired["token"], failing_report(ready))
    assert response.status_code == 401 and "expired" in response.json()["detail"]
    assert ready.client.get(f"{BASE}/tokens").json()[0]["status"] == "expired"


def test_token_stops_when_its_creator_loses_access(ready):
    ready.as_user(4)  # editor creates the token
    token = new_token(ready).json()["token"]
    member = ready.db.query(ProjectMember).filter(ProjectMember.user_id == 4).one()
    member.role = "viewer"
    ready.db.commit()
    response = ci_upload(ready, token, failing_report(ready))
    assert response.status_code == 403 and "can no longer upload" in response.json()["detail"]


def test_a_token_only_reaches_its_own_project(ready):
    """A report naming another project's script changes nothing there."""
    token = new_token(ready).json()["token"]
    body = ci_upload(ready, token, report(("Other project's script [BM-999 v1]", "expected"))).json()
    assert body["totals"]["unknown"] == 1
    assert ready.db.get(AutomationRun, body["runId"]).project_id == 1


def test_signed_in_user_tokens_are_not_upload_tokens(ready):
    """The CI endpoint accepts only upload tokens, never a user's session token."""
    from auth.jwt import create_access_token

    jwt = create_access_token({"sub": "1"})
    assert ci_upload(ready, jwt, failing_report(ready)).status_code == 401


# ── The exported workflow ────────────────────────────────────────────────────

def test_export_wires_the_upload_step(ready, monkeypatch):
    archive = zipfile.ZipFile(io.BytesIO(ready.client.get(f"{BASE}/environments/{ready.ready['env']}/export").content))
    workflow = archive.read("bugmind-e2e/.github/workflows/bugmind-e2e.yml").decode()
    assert "BUGMIND_UPLOAD_TOKEN: ${{ secrets.BUGMIND_UPLOAD_TOKEN }}" in workflow
    assert "BUGMIND_URL: ${{ vars.BUGMIND_URL || 'https://testserver' }}" in workflow
    assert '-F "file=@bugmind-results.json;type=application/json"' in workflow
    assert "if: always()" in workflow and "set -x" not in workflow
    readme = archive.read("bugmind-e2e/README.md").decode()
    assert "BUGMIND_UPLOAD_TOKEN" in readme

    monkeypatch.setenv("PUBLIC_API_URL", "https://api.bugmind.example")
    archive = zipfile.ZipFile(io.BytesIO(ready.client.get(f"{BASE}/environments/{ready.ready['env']}/export").content))
    assert "'https://api.bugmind.example'" in archive.read("bugmind-e2e/.github/workflows/bugmind-e2e.yml").decode()


def test_unsafe_api_urls_never_reach_the_workflow():
    from services.playwright_export import _SAFE_URL

    assert _SAFE_URL.match("https://bugmind-backend.azurewebsites.net")
    assert _SAFE_URL.match("http://localhost:8000")
    for bad in ("https://x.com/' }}\n  run: evil", "javascript:alert(1)", "https://a.com/path", "https://a b.com"):
        assert not _SAFE_URL.match(bad)


def test_deleting_the_project_removes_tokens(ready):
    new_token(ready)
    assert ready.client.delete("/projects/1").status_code in (200, 204)
    ready.db.expire_all()
    assert ready.db.query(AutomationUploadToken).count() == 0
