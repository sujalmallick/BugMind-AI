"""
AI test cases keep a stable identity across saves.

The frontend re-sends the whole list on every status change. That used to
delete and re-insert every AI test case. Once issues could link to a real
test case (PR #18), the delete hit the issues foreign key: a 500 on Postgres,
silently swallowed by the status-change handler. Deleting one test case also
cascade-deleted its bug reports. These tests run with SQLite foreign keys ON
so they fail the way Postgres does.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import event

from database.models.issue import Issue
from database.models.project import Project
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from test_workload_tool_guardrail import make


@pytest.fixture
def fk_db(db_session):
    """db_session with SQLite foreign key enforcement, like Postgres."""
    from database.database import engine

    def _fk_on(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    event.listen(engine, "connect", _fk_on)
    db_session.close()
    engine.dispose()  # new connections pick up the pragma
    try:
        yield db_session
    finally:
        db_session.close()
        event.remove(engine, "connect", _fk_on)
        engine.dispose()


@pytest.fixture
def project(fk_db):
    db = fk_db
    make(db, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    make(db, User, id=2, name="Bob", email="bob@corp.io", username="bob")
    make(db, Project, id=1, owner_id=1, name="Shop")
    ws = make(db, Workspace, project_id=1)
    db.commit()
    return db, ws


def ai_case(display_id, description, status="not-executed", **extra):
    return {"id": display_id, "description": description, "module": "Auth", "category": "Functional",
            "priority": "High", "status": status, "steps": ["Open", "Submit"], "expectedResult": "OK", **extra}


def ai_rows(db, ws):
    return (db.query(TestCase)
            .filter(TestCase.workspace_id == ws.id, TestCase.is_manual == False)  # noqa: E712
            .order_by(TestCase.test_case_id).all())


def link_issue(db, test_case_row):
    from services.issue_service import save_issue

    return save_issue(db, project_id=1, owner_id=1,
                      issue={"title": "Login broken", "linked_test_case_id": test_case_row.id})


def test_status_change_with_a_linked_issue_saves_and_keeps_identity(project):
    from services.test_case_service import save_test_cases

    db, ws = project
    cases = [ai_case("TC-001", "Login works"), ai_case("TC-002", "Logout works")]
    save_test_cases(db, 1, 1, cases)
    tc1 = ai_rows(db, ws)[0]
    tc1.assignee_id = 2
    tc1.custom_fields = {"browser": "Firefox"}
    db.commit()
    tc1_id = tc1.id
    issue = link_issue(db, tc1)

    # What the status-change handler sends: the same list with one status changed.
    cases[0]["status"] = "fail"
    save_test_cases(db, 1, 1, cases)  # raised IntegrityError before the fix

    db.expire_all()
    row = db.get(TestCase, tc1_id)
    assert row is not None and row.status == "fail"
    assert row.assignee_id == 2 and row.custom_fields == {"browser": "Firefox"}
    assert db.get(Issue, issue.id).test_case_id == tc1_id


def test_reanalysis_replaces_cases_and_moves_their_issues_to_the_placeholder(project):
    from services.test_case_service import save_test_cases

    db, ws = project
    save_test_cases(db, 1, 1, [ai_case("TC-001", "Login works")])
    issue = link_issue(db, ai_rows(db, ws)[0])

    # A re-analysis produces different test cases (same display ids, new content).
    save_test_cases(db, 1, 1, [ai_case("TC-001", "Checkout works"), ai_case("TC-002", "Refund works")])

    db.expire_all()
    assert [r.description for r in ai_rows(db, ws)] == ["Checkout works", "Refund works"]
    moved = db.get(Issue, issue.id)
    assert moved is not None
    assert db.get(TestCase, moved.test_case_id).test_case_id == "IMPORT-DEFAULT"


def test_manual_cases_are_never_touched(project):
    from services.test_case_service import save_test_cases

    db, ws = project
    manual = make(db, TestCase, workspace_id=ws.id, test_case_id="MANUAL-1", description="Hand-written",
                  is_manual=True)
    db.commit()
    save_test_cases(db, 1, 1, [ai_case("TC-001", "Login works")])
    save_test_cases(db, 1, 1, [])
    assert db.get(TestCase, manual.id) is not None
    assert ai_rows(db, ws) == []


def test_new_cases_can_carry_custom_fields(project):
    from services.test_case_service import save_test_cases

    db, ws = project
    save_test_cases(db, 1, 1, [ai_case("TC-001", "Login works", custom_fields={"env": "staging"})])
    assert ai_rows(db, ws)[0].custom_fields == {"env": "staging"}


def test_deleting_a_test_case_keeps_its_bug_reports(project):
    from services.test_case_service import delete_test_case, save_test_cases

    db, ws = project
    save_test_cases(db, 1, 1, [ai_case("TC-001", "Login works")])
    row = ai_rows(db, ws)[0]
    issue = link_issue(db, row)

    delete_test_case(db, 1, row.id, 1)  # used to cascade-delete the issue

    db.expire_all()
    kept = db.get(Issue, issue.id)
    assert kept is not None
    assert db.get(TestCase, kept.test_case_id).test_case_id == "IMPORT-DEFAULT"


def test_placeholder_with_issues_cannot_be_deleted(project):
    from services.issue_service import save_issue
    from services.test_case_service import delete_test_case

    db, ws = project
    issue = save_issue(db, project_id=1, owner_id=1, issue={"title": "Imported bug"})
    placeholder_id = issue.test_case_id

    with pytest.raises(HTTPException) as exc:
        delete_test_case(db, 1, placeholder_id, 1)
    assert exc.value.status_code == 409
    assert db.get(Issue, issue.id) is not None
