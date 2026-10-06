"""Regression tests for the Low-severity audit items."""

import asyncio
import io
from datetime import datetime

import pytest

from database.models.comment import Comment
from database.models.invitation import Invitation
from database.models.notification import Notification
from database.models.organization import Organization
from database.models.project_member import ProjectMember
from database.models.test_case import TestCase
from test_security_fixes import _auth, api, world  # noqa: F401  (fixtures)
from test_workload_tool_guardrail import make


def _comment(db, author_id, entity_id=11, entity_type="test_case", **kw):
    c = make(db, Comment, author_id=author_id, entity_type=entity_type, entity_id=entity_id,
             body=kw.pop("body", "hello"), is_edited=False, created_at=datetime.utcnow(),
             updated_at=datetime.utcnow(), deleted_at=None, **kw)
    db.commit()
    return c


# ── Comments ────────────────────────────────────────────────────────────────

def test_cannot_react_to_comments_in_projects_you_cannot_see(api, world):
    c = _comment(world["db"], world["vic"].id)
    res = api.post(f"/api/comments/{c.id}/reactions", json={"emoji": "👍"}, headers=_auth(world["mal"]))
    assert res.status_code == 403
    assert api.post(f"/api/comments/{c.id}/reactions", json={"emoji": "👍"},
                    headers=_auth(world["vic"])).status_code == 204


def test_reply_parent_must_be_on_the_same_item(api, world):
    db = world["db"]
    other_tc = make(db, TestCase, id=12, workspace_id=1, description="other case")
    db.commit()
    parent_elsewhere = _comment(db, world["vic"].id, entity_id=other_tc.id)
    body = {"entity_type": "test_case", "entity_id": 11, "body": "reply", "parent_id": parent_elsewhere.id}
    assert api.post("/api/comments/", json=body, headers=_auth(world["vic"])).status_code == 400

    deleted_parent = _comment(db, world["vic"].id, entity_id=11)
    deleted_parent.deleted_at = datetime.utcnow()
    db.commit()
    body["parent_id"] = deleted_parent.id
    assert api.post("/api/comments/", json=body, headers=_auth(world["vic"])).status_code == 400

    # A valid parent passes the check. (Reply responses themselves currently 500
    # because of a pre-existing Comment.replies relationship bug, tracked separately.)
    parent_here = _comment(db, world["vic"].id, entity_id=11)
    body["parent_id"] = parent_here.id
    assert api.post("/api/comments/", json=body, headers=_auth(world["vic"])).status_code != 400


def test_mentions_only_notify_project_members(api, world):
    db = world["db"]
    # adm is a P1 member; otto (5) is not.
    body = {"entity_type": "test_case", "entity_id": 11, "body": "cc @ada and @otto"}
    assert api.post("/api/comments/", json=body, headers=_auth(world["vic"])).status_code == 201
    notified = {n.user_id for n in db.query(Notification).filter(Notification.type == "mention")}
    assert notified == {world["adm"].id}


def test_author_removed_from_project_can_no_longer_edit(api, world):
    db = world["db"]
    c = _comment(db, world["adm"].id)
    db.query(ProjectMember).filter_by(project_id=1, user_id=world["adm"].id).delete()
    db.commit()
    res = api.put(f"/api/comments/{c.id}", json={"body": "edited"}, headers=_auth(world["adm"]))
    assert res.status_code == 403


@pytest.mark.parametrize("payload", [{"body": "x" * 10_001}, {"body": ""}])
def test_comment_body_is_bounded(api, world, payload):
    res = api.post("/api/comments/", json={"entity_type": "test_case", "entity_id": 11, **payload},
                   headers=_auth(world["vic"]))
    assert res.status_code == 422


def test_reaction_emoji_is_bounded(api, world):
    c = _comment(world["db"], world["vic"].id)
    res = api.post(f"/api/comments/{c.id}/reactions", json={"emoji": "x" * 50}, headers=_auth(world["vic"]))
    assert res.status_code == 422


# ── Notifications / SSE ──────────────────────────────────────────────────────

@pytest.mark.parametrize("query", ["limit=-1", "limit=100000", "offset=-5"])
def test_notification_paging_is_validated(api, world, query):
    assert api.get(f"/api/notifications?{query}", headers=_auth(world["vic"])).status_code == 422


def test_sse_connections_are_capped_per_user_and_globally(monkeypatch):
    import services.sse_manager as sse

    async def scenario():
        mgr = sse.SSEManager()
        queues = [mgr.connect(1) for _ in range(sse.MAX_CONNECTIONS_PER_USER)]
        newest = mgr.connect(1)
        # The oldest stream was told to close; the user still has exactly the cap.
        assert queues[0].get_nowait() is sse.CLOSE_STREAM
        assert len(mgr._connections[1]) == sse.MAX_CONNECTIONS_PER_USER and newest in mgr._connections[1]

        monkeypatch.setattr(sse, "MAX_CONNECTIONS_TOTAL", sse.MAX_CONNECTIONS_PER_USER)
        assert mgr.connect(2) is None  # server-wide cap reached
        assert 2 not in mgr._connections

        # A client that never reads can't make broadcast block or grow memory.
        for _ in range(sse.QUEUE_SIZE + 50):
            await mgr.broadcast(1, {"event": "new_notification", "unread_count": 1})
        assert newest.qsize() == sse.QUEUE_SIZE

    asyncio.run(scenario())


# ── Dashboard / invitations / profile / orgs ─────────────────────────────────

def test_personal_dashboard_drops_items_after_access_is_revoked(api, world):
    db = world["db"]
    tc = db.get(TestCase, 11)
    tc.assignee_id = world["adm"].id
    db.commit()
    assert "victim case" in api.get("/api/dashboard/me", headers=_auth(world["adm"])).text

    db.query(ProjectMember).filter_by(project_id=1, user_id=world["adm"].id).delete()
    db.commit()
    assert "victim case" not in api.get("/api/dashboard/me", headers=_auth(world["adm"])).text


def test_invitation_to_deleted_org_cannot_be_accepted(api, world):
    db = world["db"]
    make(db, Invitation, token="tok-deleted-org", type="organization", target_id=1, role="member",
         invited_email=None, invited_by=world["vic"].id, status="pending",
         expires_at=datetime(2099, 1, 1), created_at=datetime.utcnow())
    db.get(Organization, 1).deleted_at = datetime.utcnow()
    db.commit()
    res = api.post("/api/invitations/tok-deleted-org/accept", headers=_auth(world["out"]))
    assert res.status_code == 410


@pytest.mark.parametrize("logo, ok", [
    ("https://cdn.example.com/logo.png", True),
    ("", True),
    ("javascript:alert(1)", False),
    ("http://tracker.example/pixel.gif", False),
    ("https://x/\" onerror=\"alert(1)", False),
])
def test_org_logo_url_must_be_https(api, world, logo, ok):
    res = api.put("/api/organizations/1", json={"logo_url": logo}, headers=_auth(world["vic"]))
    assert (res.status_code == 200) is ok, res.text


def test_profile_fields_are_bounded(api, world):
    assert api.patch("/api/me", json={"bio": "x" * 1001}, headers=_auth(world["vic"])).status_code == 422
    assert api.patch("/api/me", json={"bio": "QA lead"}, headers=_auth(world["vic"])).status_code == 200


def test_avatar_storage_names_are_random_and_old_files_removed(api, world, tmp_path, monkeypatch):
    from pathlib import Path

    from PIL import Image

    def png():
        buf = io.BytesIO()
        Image.new("RGB", (16, 16), "red").save(buf, format="PNG")
        return buf.getvalue()

    first = api.post("/api/me/avatar", files={"file": ("a.png", png(), "image/png")}, headers=_auth(world["vic"]))
    second = api.post("/api/me/avatar", files={"file": ("a.png", png(), "image/png")}, headers=_auth(world["vic"]))
    url1, url2 = first.json()["avatar_url"], second.json()["avatar_url"]
    assert url1 != url2
    import uuid
    predictable = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"user-{world['vic'].id}"))
    assert predictable not in url1 and predictable not in url2
    assert not Path(url1).exists() and Path(url2).exists()
    Path(url2).unlink()


# ── Encryption key rotation ──────────────────────────────────────────────────

def test_encryption_key_rotation(monkeypatch):
    from cryptography.fernet import Fernet

    from services.encryption_service import EncryptionService

    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    monkeypatch.setenv("ENCRYPTION_KEY", old)
    stored = EncryptionService().encrypt_key("sk-user-byok-key")

    monkeypatch.setenv("ENCRYPTION_KEY", f"{new},{old}")
    rotated = EncryptionService()
    assert rotated.decrypt_key(stored) == "sk-user-byok-key"          # old data still readable
    fresh = rotated.encrypt_key("sk-user-byok-key")
    monkeypatch.setenv("ENCRYPTION_KEY", new)
    assert EncryptionService().decrypt_key(fresh) == "sk-user-byok-key"  # new data uses the new key
