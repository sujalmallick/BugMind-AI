"""
Regression tests for the security-audit fixes. Requests go through the real
app with real JWTs (no auth override), against a SQLite database.
"""

import io
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from auth.jwt import create_access_token
from auth.password_reset import create_password_reset_token
from auth.security import hash_password
from database.models.issue import Issue
from database.models.organization import Organization
from database.models.organization_member import OrganizationMember
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.team import Team
from database.models.team_member import TeamMember
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from test_workload_tool_guardrail import make


@pytest.fixture
def api(db_session, fake_llm):
    import main
    from limiter import limiter

    limiter.enabled = False
    with TestClient(main.app, raise_server_exceptions=False) as client:
        yield client
    limiter.enabled = False


def _user(db, uid, name, password="Corr3ct-Horse!"):
    user = make(db, User, id=uid, name=name, email=f"{name.lower()}@corp.io", username=name.lower(),
                password_hash=hash_password(password), deleted_at=None, credentials_updated_at=None)
    db.commit()
    return user


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id), 'email': user.email})}"}


@pytest.fixture
def world(db_session):
    """Two tenants: victim (Vic) owns P1 in org O1; attacker (Mal) owns P2 in org O2."""
    db = db_session
    vic = _user(db, 1, "Vic")
    mal = _user(db, 2, "Mal")
    adm = _user(db, 3, "Ada")      # admin in O1 / P1
    mem = _user(db, 4, "Meg")      # plain member of O1
    out = _user(db, 5, "Otto")     # unrelated user

    o1 = make(db, Organization, id=1, name="O1", slug="o1", owner_id=vic.id, deleted_at=None)
    o2 = make(db, Organization, id=2, name="O2", slug="o2", owner_id=mal.id, deleted_at=None)
    for org, uid, role in [(o1, vic.id, "owner"), (o1, adm.id, "admin"), (o1, mem.id, "member"), (o2, mal.id, "owner")]:
        make(db, OrganizationMember, organization_id=org.id, user_id=uid, role=role)

    p1 = make(db, Project, id=1, owner_id=vic.id, name="P1", organization_id=o1.id)
    p2 = make(db, Project, id=2, owner_id=mal.id, name="P2", organization_id=o2.id)
    make(db, ProjectMember, project_id=p1.id, user_id=adm.id, role="admin")
    ws1 = make(db, Workspace, project_id=p1.id)
    make(db, Workspace, project_id=p2.id)
    tc1 = make(db, TestCase, id=11, workspace_id=ws1.id, description="victim case")
    issue = make(db, Issue, id=21, test_case_id=tc1.id, bug_id="BUG-1", title="Victim secret issue",
                 description="confidential", reporter_id=vic.id, created_at=datetime.utcnow())
    t1 = make(db, Team, id=1, organization_id=o1.id, name="Core")
    make(db, TeamMember, team_id=t1.id, user_id=mem.id, role="member")
    db.commit()
    return dict(db=db, vic=vic, mal=mal, adm=adm, mem=mem, out=out, o1=o1, o2=o2, p1=p1, p2=p2, issue=issue, team=t1)


# ── Critical: cross-tenant issue IDOR ────────────────────────────────────────

def test_issue_cannot_be_read_edited_or_deleted_through_another_project(api, world):
    mal, db = world["mal"], world["db"]
    res = api.put("/issues/2/21", json={}, headers=_auth(mal))
    assert res.status_code == 404 and "confidential" not in res.text
    res = api.put("/issues/2/21", json={"title": "pwned"}, headers=_auth(mal))
    assert res.status_code == 404
    assert api.delete("/issues/2/21", headers=_auth(mal)).status_code == 404
    db.expire_all()
    assert db.get(Issue, 21).title == "Victim secret issue"


def test_issue_update_ignores_server_managed_fields(api, world):
    vic, db = world["vic"], world["db"]
    res = api.put("/issues/1/21", json={"title": "Renamed", "reporter_id": 5, "assignee_id": 5,
                                        "test_case": None, "_sa_instance_state": 1}, headers=_auth(vic))
    assert res.status_code == 200 and res.json()["title"] == "Renamed"
    db.expire_all()
    issue = db.get(Issue, 21)
    assert issue.reporter_id == 1 and issue.assignee_id is None


# ── High: role escalation ────────────────────────────────────────────────────

def test_org_admin_cannot_make_themselves_or_others_owner(api, world):
    adm, mem, vic, db = world["adm"], world["mem"], world["vic"], world["db"]
    assert api.put("/api/organizations/1/members/3/role", json={"role": "owner"}, headers=_auth(adm)).status_code == 403
    assert api.put("/api/organizations/1/members/4/role", json={"role": "owner"}, headers=_auth(adm)).status_code == 403
    db.expire_all()
    roles = {m.user_id: m.role for m in db.query(OrganizationMember).filter_by(organization_id=1)}
    assert roles == {vic.id: "owner", adm.id: "admin", mem.id: "member"}


def test_owner_can_transfer_ownership_and_owner_id_follows(api, world):
    vic, adm, db = world["vic"], world["adm"], world["db"]
    assert api.put("/api/organizations/1/members/3/role", json={"role": "owner"}, headers=_auth(vic)).status_code == 200
    db.expire_all()
    assert db.get(Organization, 1).owner_id == adm.id
    roles = {m.user_id: m.role for m in db.query(OrganizationMember).filter_by(organization_id=1)}
    assert roles[vic.id] == "admin" and roles[adm.id] == "owner"


@pytest.mark.parametrize("body", [
    {"user_id": 4, "role": "owner"},       # owner is never grantable
    {"user_id": 3, "role": "admin"},       # self-change
    {"user_id": 5, "role": "viewer"},      # not an org member → must be invited
])
def test_project_member_add_rejects_escalation_and_outsiders(api, world, body):
    res = api.post("/projects/1/members", json=body, headers=_auth(world["adm"]))
    assert res.status_code in (400, 403)
    assert "otto@corp.io" not in res.text


def test_project_member_add_still_works_for_org_members(api, world):
    res = api.post("/projects/1/members", json={"user_id": 4, "role": "editor"}, headers=_auth(world["adm"]))
    assert res.status_code == 200 and res.json()["role"] == "editor"


@pytest.mark.parametrize("body", [
    {"type": "organization", "target_id": 1, "role": "owner"},
    {"type": "project", "target_id": 1, "role": "owner"},
    {"type": "organization", "target_id": 1, "role": "superadmin"},
    {"type": "project", "target_id": 1, "role": "viewer", "invited_email": "not-an-email"},
    {"type": "project", "target_id": 1, "role": "viewer", "expiry_hours": 10**9},
])
def test_invitations_cannot_grant_owner_or_take_bad_input(api, world, body):
    assert api.post("/api/invitations/", json=body, headers=_auth(world["adm"])).status_code in (400, 403, 422)


def test_admin_can_still_invite_members(api, world):
    res = api.post("/api/invitations/", json={"type": "project", "target_id": 1, "role": "editor"},
                   headers=_auth(world["adm"]))
    assert res.status_code == 200 and res.json()["role"] == "editor"


def test_team_member_add_requires_org_membership(api, world):
    res = api.post("/api/organizations/1/teams/1/members", json={"user_id": 5, "role": "member"},
                   headers=_auth(world["vic"]))
    assert res.status_code == 400
    world["db"].expire_all()
    assert world["db"].query(OrganizationMember).filter_by(organization_id=1, user_id=5).first() is None


def test_team_members_cannot_be_removed_through_another_org(api, world):
    res = api.delete("/api/organizations/2/teams/1/members/4", headers=_auth(world["mal"]))
    assert res.status_code == 404
    world["db"].expire_all()
    assert world["db"].query(TeamMember).filter_by(team_id=1, user_id=4).first() is not None


# ── High: reset token used as a session ──────────────────────────────────────

def test_password_reset_token_is_not_a_session_token(api, world):
    vic = world["vic"]
    reset = create_password_reset_token(vic.id, vic.password_hash)
    assert api.get("/api/me", headers={"Authorization": f"Bearer {reset}"}).status_code == 401
    assert api.get(f"/api/notifications/stream?token={reset}").status_code == 401


def test_sse_stream_honours_account_deletion(api, world):
    vic, db = world["vic"], world["db"]
    token = _auth(vic)["Authorization"][7:]
    vic.deleted_at = datetime.utcnow()
    db.commit()
    assert api.get(f"/api/notifications/stream?token={token}").status_code == 401


# ── Abuse / DoS ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("model", ["ollama/llama3", "llamafile/x", "bedrock/anthropic.claude-v2", "x" * 100])
def test_test_key_rejects_models_outside_the_allowlist(api, world, model, fake_llm):
    res = api.post("/ai-settings/test-key", json={"provider": "openai", "model": model, "api_key": "sk-test"},
                   headers=_auth(world["vic"]))
    assert res.json() == {"success": False, "error": "Invalid model for this provider."}
    assert fake_llm.calls == []


def test_login_lockout_per_account(api, world):
    from auth.throttle import failed_logins

    failed_logins.reset("vic@corp.io")
    for _ in range(10):
        assert api.post("/auth/login", data={"username": "vic@corp.io", "password": "wrong-pass"}).status_code == 401
    res = api.post("/auth/login", data={"username": "vic@corp.io", "password": "Corr3ct-Horse!"})
    assert res.status_code == 429
    failed_logins.reset("vic@corp.io")
    assert api.post("/auth/login", data={"username": "vic@corp.io", "password": "Corr3ct-Horse!"}).status_code == 200


def test_password_reset_emails_are_capped_per_account(api, world, monkeypatch):
    import services.auth_service as auth_service
    from auth.throttle import password_reset_requests

    sent = []
    monkeypatch.setattr(auth_service, "send_password_reset_email", lambda **kw: sent.append(kw) or True)
    password_reset_requests.reset("vic@corp.io")
    codes = [api.post("/auth/forgot-password", json={"email": "vic@corp.io"}).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert len(sent) == 3


def test_overlong_password_is_a_400_not_a_500(api, db_session):
    res = api.post("/auth/register", json={"name": "Long", "email": "long@corp.io", "password": "é" * 40})
    assert res.status_code == 400


def test_chunked_body_cannot_bypass_the_size_limit(api, world):
    def chunks():
        for _ in range(7):
            yield b"x" * (1024 * 1024)

    res = api.post("/analyze-workflow", content=chunks(),
                   headers={**_auth(world["vic"]), "Content-Type": "application/json"})
    assert res.status_code == 413


def test_avatar_decompression_bomb_is_rejected(api, world):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("1", (6000, 6000)).save(buf, format="PNG")  # tiny file, 36M pixels
    assert len(buf.getvalue()) < 2 * 1024 * 1024
    res = api.post("/api/me/avatar", files={"file": ("a.png", buf.getvalue(), "image/png")},
                   headers=_auth(world["vic"]))
    assert res.status_code == 413


def test_rate_limit_key_is_per_user_when_authenticated(world):
    from types import SimpleNamespace

    from limiter import rate_limit_key

    def req(headers):
        # Starlette headers are case-insensitive; mimic that with lower-cased keys.
        return SimpleNamespace(headers={k.lower(): v for k, v in headers.items()},
                               client=SimpleNamespace(host="10.0.0.1"))

    assert rate_limit_key(req(_auth(world["vic"]))) == "user:1"
    assert rate_limit_key(req(_auth(world["mal"]))) == "user:2"
    assert rate_limit_key(req({"authorization": "Bearer forged"})) == "ip:10.0.0.1"
    assert rate_limit_key(req({})) == "ip:10.0.0.1"


def test_proxy_header_trust_is_opt_in_and_uses_rightmost_hop(monkeypatch):
    from types import SimpleNamespace

    from limiter import client_ip

    req = SimpleNamespace(headers={"x-forwarded-for": "6.6.6.6, 203.0.113.9"}, client=SimpleNamespace(host="10.0.0.1"))
    assert client_ip(req) == "10.0.0.1"
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY_HEADERS", "true")
    assert client_ip(req) == "203.0.113.9"  # spoofed left-most entry is ignored


def test_rate_limits_apply_to_ai_endpoints(api, world):
    from limiter import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        codes = [api.post("/ai-settings/test-key", json={"provider": "openai", "model": "ollama/x"},
                          headers=_auth(world["vic"])).status_code for _ in range(7)]
    finally:
        limiter.enabled = False
    assert codes[:5] == [200] * 5 and 429 in codes[5:]


# ── Information disclosure ──────────────────────────────────────────────────

def test_invitation_email_escapes_user_controlled_html(monkeypatch):
    import azure.communication.email as acs

    from services.email_service import send_invitation_email

    captured = {}

    class FakeClient:
        @classmethod
        def from_connection_string(cls, _):
            return cls()

        def begin_send(self, message):
            captured.update(message)

    monkeypatch.setattr(acs, "EmailClient", FakeClient)
    monkeypatch.setenv("AZURE_COMMUNICATION_CONNECTION_STRING", "endpoint=https://x/;accesskey=y")
    monkeypatch.setenv("AZURE_COMMUNICATION_SENDER_EMAIL", "noreply@example.com")
    evil = '<a href="https://evil.example/login">Session expired</a>'
    assert send_invitation_email("v@example.com", "https://app/invite/t", evil, "Org\nBcc: x", "Project", "Viewer")
    html = captured["content"]["html"]
    assert "<a href=\"https://evil.example" not in html and "&lt;a href=" in html
    assert "\n" not in captured["content"]["subject"]


def test_health_does_not_leak_database_errors(api, monkeypatch):
    import database.session as session_mod
    from sqlalchemy.orm import Session

    def broken(self, *a, **k):
        raise RuntimeError('connection to server at "prod-db.internal" (10.1.2.3), user "bugmind_admin" failed')

    monkeypatch.setattr(Session, "execute", broken)
    res = api.get("/health/db")
    assert res.status_code == 503 and res.json()["database"] == "error"
    assert "prod-db" not in res.text and "bugmind_admin" not in res.text
    # Plain liveness never touches the database (lets a serverless DB sleep).
    assert api.get("/health").json() == {"status": "healthy"}


def test_docs_and_debug_endpoints_are_off_by_default(api, world):
    assert api.get("/openapi.json").status_code == 404
    assert api.get("/docs").status_code == 404
    assert api.post("/api/notifications/test", headers=_auth(world["vic"])).status_code == 403


# ── Guardrail kill-switch no longer disables authorization ───────────────────

def test_tool_kill_switch_keeps_authorization(set_env):
    from guardrails import Decision, UserContext, tool_guardrail

    set_env(TOOL_GUARDRAILS_ENABLED="false")
    result = tool_guardrail.authorize("drop_database", {}, UserContext(user_id=1, role="viewer"))
    assert result.decision == Decision.DENY and result.reasons == ["tool_not_allowlisted"]


def test_team_dashboard_hides_activity_from_projects_the_member_cannot_open(api, world):
    from database.models.activity_log import ActivityLog

    db = world["db"]
    make(db, ActivityLog, actor_id=1, verb="created_issue", entity_type="issue", entity_id=21,
         entity_label="Victim secret issue", project_id=1, org_id=1, created_at=datetime.utcnow())
    db.commit()

    # Meg is on team Core in O1 but has no access to project P1.
    member_view = api.get("/api/dashboard/organizations/1/teams/1", headers=_auth(world["mem"]))
    assert member_view.status_code == 200
    assert "Victim secret issue" not in member_view.text

    owner_view = api.get("/api/dashboard/organizations/1/teams/1", headers=_auth(world["vic"]))
    assert "Victim secret issue" in owner_view.text


def test_sse_stream_ticket_flow(api, world):
    from auth.jwt import create_stream_ticket

    vic = world["vic"]
    res = api.post("/api/notifications/stream-ticket", headers=_auth(vic))
    assert res.status_code == 200
    ticket = res.json()["ticket"]

    # A ticket only opens the stream: it is not a session token...
    assert api.get("/api/me", headers={"Authorization": f"Bearer {ticket}"}).status_code == 401
    # ...a session or reset token is not a ticket...
    session = _auth(vic)["Authorization"][7:]
    reset = create_password_reset_token(vic.id, vic.password_hash)
    for wrong in (session, reset):
        assert api.get(f"/api/notifications/stream?ticket={wrong}").status_code == 401
    # ...and no credential at all is refused.
    assert api.get("/api/notifications/stream").status_code == 401

    # Tickets also honour account deletion.
    vic.deleted_at = datetime.utcnow()
    world["db"].commit()
    assert api.get(f"/api/notifications/stream?ticket={create_stream_ticket(vic.id)}").status_code == 401


def test_valid_stream_ticket_resolves_to_its_user(world):
    from auth.dependencies import user_from_token
    from auth.jwt import create_stream_ticket

    ticket = create_stream_ticket(world["vic"].id)
    assert user_from_token(ticket, world["db"], purpose="sse").id == world["vic"].id


# ── JWT library migration (python-jose → PyJWT) ──────────────────────────────

# Minted with python-jose 3.5.0 before the migration (HS256, the test
# SECRET_KEY, exp in 2099): sessions issued before the deploy must keep working.
LEGACY_JOSE_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ2aWNAY29ycC5pbyIsImlhdCI6MTc2NzIyNTYwMCwiZXhwIjo0MDcwOTA4ODAwfQ"
    ".FEStKxmUuQ41ckfBbgJK9DGsLlkOCwSagUkNDi0xsyk"
)


def test_tokens_issued_by_python_jose_are_still_accepted(api, world):
    res = api.get("/api/me", headers={"Authorization": f"Bearer {LEGACY_JOSE_TOKEN}"})
    assert res.status_code == 200 and res.json()["email"] == "vic@corp.io"


def test_unsigned_and_wrongly_signed_tokens_are_rejected(api, world):
    import base64
    import json as _json

    import jwt as pyjwt

    def b64(obj):
        return base64.urlsafe_b64encode(_json.dumps(obj).encode()).rstrip(b"=").decode()

    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': '1', 'iat': 1767225600, 'exp': 4070908800})}."
    forged = pyjwt.encode({"sub": "1", "iat": 1767225600, "exp": 4070908800}, "x" * 40, algorithm="HS256")
    for token in (unsigned, forged):
        assert api.get("/api/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
