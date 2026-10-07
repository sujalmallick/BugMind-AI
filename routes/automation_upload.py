"""
CI upload of test results with a project upload token (services/automation_tokens.py).

Deliberately separate from the signed-in API: no user session, no cookies,
one endpoint. The token in the Authorization header decides the project.
"""

import hashlib
import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from database.session import get_db
from limiter import client_ip, limiter
from services.automation_results import MAX_REPORT_BYTES
from services.automation_tokens import upload_with_token


def _automation_enabled():
    if os.getenv("AUTOMATION_ENABLED", "true").strip().lower() == "false":
        raise HTTPException(status_code=404, detail="Not Found")


def upload_token_key(request: Request) -> str:
    """Rate-limit bucket per token (CI runners change IPs), never the token itself."""
    auth = request.headers.get("authorization", "")
    raw = auth[7:].strip() if auth[:7].lower() == "bearer " else ""
    if raw:
        return "upload-token:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"ip:{client_ip(request)}"


router = APIRouter(prefix="/automation", tags=["Automation CI upload"], dependencies=[Depends(_automation_enabled)])


@router.post("/runs/upload")
@limiter.limit("60/hour", key_func=upload_token_key)
@limiter.limit("30/minute", key_func=lambda request: f"ip:{client_ip(request)}")
def upload_results_with_token(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    `curl -H "Authorization: Bearer $BUGMIND_UPLOAD_TOKEN" -F "file=@bugmind-results.json" .../automation/runs/upload`
    """
    data = file.file.read(MAX_REPORT_BYTES + 1)
    return upload_with_token(db, request.headers.get("authorization"), data)
