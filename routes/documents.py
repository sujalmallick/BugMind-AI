import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from limiter import limiter
from services import documents


def _knowledge_enabled():
    if os.getenv("PROJECT_KNOWLEDGE_ENABLED", "true").strip().lower() == "false":
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(
    prefix="/projects/{project_id}/documents",
    tags=["Project Knowledge"],
    dependencies=[Depends(_knowledge_enabled)],
)


class DocumentPatch(BaseModel):
    ai_enabled: bool


@router.get("")
def list_project_documents(project_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    return [documents.serialize(d) for d in documents.list_documents(db, project_id, current_user.id)]


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def upload_project_document(request: Request, project_id: int, file: UploadFile = File(...),
                            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = file.file.read(documents.max_file_bytes() + 1)
    doc = documents.upload_document(db, project_id, current_user.id, file.filename, data)
    return documents.serialize(doc)


@router.get("/{document_id}")
def get_project_document(project_id: int, document_id: int, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    return documents.serialize(documents.get_document(db, project_id, current_user.id, document_id))


@router.patch("/{document_id}")
def update_project_document(project_id: int, document_id: int, body: DocumentPatch,
                            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = documents.set_ai_enabled(db, project_id, current_user.id, document_id, body.ai_enabled)
    return documents.serialize(doc)


@router.post("/{document_id}/retry")
def retry_project_document(project_id: int, document_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    return documents.serialize(documents.retry_document(db, project_id, current_user.id, document_id))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_document(project_id: int, document_id: int, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    documents.delete_document(db, project_id, current_user.id, document_id)


@router.get("/{document_id}/download")
def download_project_document(project_id: int, document_id: int, db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    doc, data = documents.read_document(db, project_id, current_user.id, document_id)
    # Always an attachment: user-uploaded content is never rendered by the browser.
    disposition = f"attachment; filename=\"document.{doc.file_type}\"; filename*=UTF-8''{quote(doc.filename)}"
    return Response(content=data, media_type=doc.content_type,
                    headers={"Content-Disposition": disposition, "Cache-Control": "private, no-store"})
