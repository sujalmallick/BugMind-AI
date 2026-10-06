from datetime import datetime

import pytest

import services.auth_service as auth_service

EMAIL = "reset.user@example.com"


@pytest.fixture
def outbox(monkeypatch):
    """Captures reset emails instead of sending them; set .ok = False to simulate a send failure."""

    class Outbox(list):
        ok = True

    box = Outbox()

    def fake_send(**kwargs):
        box.append(kwargs)
        return box.ok

    monkeypatch.setattr(auth_service, "send_password_reset_email", fake_send)
    return box


@pytest.fixture
def user(client, db_session):
    r = client.post("/auth/register", json={"name": "Reset User", "email": EMAIL, "password": "oldpassword1"})
    assert r.status_code == 200, r.text
    return r.json()


def login(client, password):
    return client.post("/auth/login", data={"username": EMAIL, "password": password})


def test_unknown_email_says_no_account(client, db_session, outbox):
    r = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 404
    assert r.json()["detail"] == "No account found with that email address."
    assert outbox == []


def test_deactivated_account_says_no_account(client, db_session, user, outbox):
    from database.models.user import User

    db_session.query(User).filter(User.email == EMAIL).update({"deleted_at": datetime.utcnow()})
    db_session.commit()
    r = client.post("/auth/forgot-password", json={"email": EMAIL})
    assert r.status_code == 404
    assert outbox == []


def test_send_failure_is_reported_not_hidden(client, user, outbox):
    outbox.ok = False
    r = client.post("/auth/forgot-password", json={"email": EMAIL})
    assert r.status_code == 503
    assert "couldn't send the reset email" in r.json()["detail"]


def test_full_reset_flow_and_link_is_single_use(client, user, outbox):
    r = client.post("/auth/forgot-password", json={"email": EMAIL.upper()})
    assert r.status_code == 200
    assert r.json()["message"] == f"We've sent a password reset link to {EMAIL}."
    token = outbox[0]["reset_url"].split("token=", 1)[1]

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "newpassword1"})
    assert r.status_code == 200, r.text
    assert login(client, "oldpassword1").status_code == 401
    assert login(client, "newpassword1").status_code == 200

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "anotherpass1"})
    assert r.status_code == 400


def test_reset_rejects_bad_tokens_and_short_passwords(client, user, outbox):
    access_token = login(client, "oldpassword1").json()["access_token"]
    for bad in ("garbage", access_token):
        r = client.post("/auth/reset-password", json={"token": bad, "new_password": "newpassword1"})
        assert r.status_code == 400

    client.post("/auth/forgot-password", json={"email": EMAIL})
    token = outbox[0]["reset_url"].split("token=", 1)[1]
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "short"})
    assert r.status_code == 400
