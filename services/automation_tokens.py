"""
services/automation_tokens.py — upload tokens: a CI job sends its test results
straight to BugMind, with no manual download and upload.

A token is NOT a login. It can call exactly one endpoint (upload results) for
exactly one project, and it acts with the rights of the person who created it,
re-checked on every use. Only its SHA-256 hash is stored; the token is shown
once. Tokens expire (30–365 days) and can be revoked at any time.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth.permissions import require_project_role
from database.models.automation import AutomationRun, AutomationUploadToken

logger = logging.getLogger("BugMind")

TOKEN_PREFIX = "bm_up_"
EXPIRY_DAYS = (30, 90, 180, 365)
DEFAULT_EXPIRY_DAYS = 90
MAX_ACTIVE_TOKENS = 5


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _status(token: AutomationUploadToken, now: datetime) -> str:
    if token.revoked_at:
        return "revoked"
    if token.expires_at and token.expires_at <= now:
        return "expired"
    return "active"


def serialize_token(token: AutomationUploadToken, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    iso = lambda value: value.isoformat() if value else None  # noqa: E731
    return {
        "id": token.id,
        "name": token.name,
        "prefix": token.prefix,
        "status": _status(token, now),
        "createdBy": token.created_by,
        "createdAt": iso(token.created_at),
        "expiresAt": iso(token.expires_at),
        "lastUsedAt": iso(token.last_used_at),
        "revokedAt": iso(token.revoked_at),
    }


def list_tokens(db: Session, user_id: int, project_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "editor")
    now = datetime.utcnow()
    tokens = (db.query(AutomationUploadToken).filter(AutomationUploadToken.project_id == project_id)
              .order_by(AutomationUploadToken.id.desc()).all())
    return [serialize_token(t, now) for t in tokens]


def create_token(db: Session, user_id: int, project_id: int, name: str, expires_in_days: int) -> dict:
    """The new token's details plus the token itself — the only time it is ever shown."""
    require_project_role(db, user_id, project_id, "editor")
    if expires_in_days not in EXPIRY_DAYS:
        raise HTTPException(status_code=422, detail=f"Expiry must be one of {', '.join(map(str, EXPIRY_DAYS))} days.")
    now = datetime.utcnow()
    active = [t for t in db.query(AutomationUploadToken).filter(AutomationUploadToken.project_id == project_id)
              if _status(t, now) == "active"]
    if len(active) >= MAX_ACTIVE_TOKENS:
        raise HTTPException(status_code=409, detail=f"A project can have {MAX_ACTIVE_TOKENS} active upload tokens. "
                                                    "Revoke one you no longer use first.")
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)  # 256 bits of randomness
    token = AutomationUploadToken(
        project_id=project_id, created_by=user_id, name=name, token_hash=hash_token(raw), prefix=raw[:12],
        expires_at=now + timedelta(days=expires_in_days),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    logger.info(f"Upload token created | project={project_id} token={token.id} prefix={token.prefix}")
    return {**serialize_token(token, now), "token": raw}


def revoke_token(db: Session, user_id: int, project_id: int, token_id: int) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    token = db.query(AutomationUploadToken).filter(
        AutomationUploadToken.id == token_id, AutomationUploadToken.project_id == project_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found.")
    if not token.revoked_at:
        token.revoked_at = datetime.utcnow()
        db.commit()
        db.refresh(token)
        logger.info(f"Upload token revoked | project={project_id} token={token.id} by={user_id}")
    return serialize_token(token)


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=401, detail=message, headers={"WWW-Authenticate": "Bearer"})


def authenticate(db: Session, authorization: str | None) -> AutomationUploadToken:
    """The token from an `Authorization: Bearer bm_up_...` header, or 401/403 saying why not."""
    value = (authorization or "").strip()
    raw = value[7:].strip() if value[:7].lower() == "bearer " else ""
    if not raw.startswith(TOKEN_PREFIX) or len(raw) > 200:
        raise _unauthorized("Send an upload token: Authorization: Bearer bm_up_...")
    token = db.query(AutomationUploadToken).filter(AutomationUploadToken.token_hash == hash_token(raw)).first()
    if token is None:
        raise _unauthorized("This upload token isn't valid.")
    status = _status(token, datetime.utcnow())
    if status != "active":
        raise _unauthorized(f"This upload token was {status}. Create a new one in BugMind (Automation → Runs).")
    # The token acts for its creator: they must still be allowed to upload to this project.
    if token.created_by is None:
        raise HTTPException(status_code=403, detail="The person who created this token no longer exists.")
    try:
        require_project_role(db, token.created_by, token.project_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=403, detail="The person who created this token can no longer upload to "
                                                    "this project.") from None
    return token


def upload_with_token(db: Session, authorization: str | None, data: bytes) -> dict:
    """Records an uploaded report for the token's project. The same report twice is recorded once."""
    from services.automation_runs_service import import_results

    token = authenticate(db, authorization)
    report_hash = hashlib.sha256(data).hexdigest()
    existing = db.query(AutomationRun.id).filter(
        AutomationRun.project_id == token.project_id, AutomationRun.report_hash == report_hash).first()
    token.last_used_at = datetime.utcnow()
    db.commit()
    if existing:
        return {"duplicate": True, "runId": existing[0]}
    run = import_results(db, token.created_by, token.project_id, data, source="ci", token_id=token.id,
                         report_hash=report_hash)
    return {"duplicate": False, "runId": run["id"], "totals": run["totals"],
            "testCasesUpdated": sum(1 for r in run["results"] if r.get("applied"))}
