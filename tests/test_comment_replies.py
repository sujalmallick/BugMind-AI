"""
Comment threads: `replies` is the one-to-many list of live child comments and
`parent` the many-to-one link back. Before the fix, `replies` resolved to the
parent comment, so posting a reply returned 500 and GET never showed replies.
"""

from datetime import datetime
from types import SimpleNamespace

import pytest

from database.models.comment import Comment
from database.models.project import Project
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from test_workload_tool_guardrail import make

URL = "/api/comments/"
ENTITY = {"entity_type": "test_case", "entity_id": 11}


@pytest.fixture
def api(client, db_session):
    import main
    from auth.dependencies import get_current_user

    db = db_session
    make(db, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    project = make(db, Project, id=1, owner_id=1, name="Shop")
    ws = make(db, Workspace, project_id=project.id)
    make(db, TestCase, id=11, workspace_id=ws.id, test_case_id="TC-001", description="Login")
    db.commit()
    main.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, email="alice@corp.io")
    return SimpleNamespace(client=client, db=db)


def post(api, body, parent_id=None):
    res = api.client.post(URL, json={**ENTITY, "body": body, "parent_id": parent_id})
    assert res.status_code == 201, res.text
    return res.json()


def thread(api):
    res = api.client.get(URL, params=ENTITY)
    assert res.status_code == 200, res.text
    return res.json()


def test_posting_a_reply_succeeds(api):
    root = post(api, "Root comment")
    reply = post(api, "First reply", parent_id=root["id"])

    assert reply["parent_id"] == root["id"]
    assert reply["replies"] == []
    assert reply["author"]["id"] == 1


def test_thread_nests_replies_under_their_parent(api):
    root = post(api, "Root comment")
    post(api, "First reply", parent_id=root["id"])
    post(api, "Second reply", parent_id=root["id"])
    post(api, "Another root")

    comments = thread(api)
    assert [c["body"] for c in comments] == ["Root comment", "Another root"]  # replies aren't top level
    assert [r["body"] for r in comments[0]["replies"]] == ["First reply", "Second reply"]
    assert comments[0]["replies"][0]["author"]["name"] == "Alice"
    assert comments[1]["replies"] == []


def test_soft_deleted_replies_are_hidden(api):
    root = post(api, "Root comment")
    reply = post(api, "Regret this", parent_id=root["id"])
    post(api, "Keep this", parent_id=root["id"])

    assert api.client.delete(f"{URL}{reply['id']}").status_code == 204
    assert [r["body"] for r in thread(api)[0]["replies"]] == ["Keep this"]


def test_replies_are_ordered_oldest_first(api):
    root = post(api, "Root comment")
    late = post(api, "Late", parent_id=root["id"])
    early = post(api, "Early", parent_id=root["id"])
    api.db.query(Comment).filter(Comment.id == early["id"]).update({"created_at": datetime(2020, 1, 1)})
    api.db.query(Comment).filter(Comment.id == late["id"]).update({"created_at": datetime(2021, 1, 1)})
    api.db.commit()
    api.db.expire_all()

    assert [r["body"] for r in thread(api)[0]["replies"]] == ["Early", "Late"]


def test_nested_replies_load(api):
    root = post(api, "Root comment")
    reply = post(api, "Reply", parent_id=root["id"])
    post(api, "Reply to reply", parent_id=reply["id"])

    [top] = thread(api)
    assert top["replies"][0]["replies"][0]["body"] == "Reply to reply"


def test_parent_relationship_points_up(api):
    root = post(api, "Root comment")
    reply = post(api, "Reply", parent_id=root["id"])

    child = api.db.get(Comment, reply["id"])
    assert child.parent.id == root["id"]
    assert [c.id for c in api.db.get(Comment, root["id"]).replies] == [reply["id"]]
