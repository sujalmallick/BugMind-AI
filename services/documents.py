"""
services/documents.py — Project Knowledge: uploaded documents that give the AI
extra project context.

    Upload → Validate → Store → (job) Extract → Normalize → Mask secrets
           → Chunk → Injection-scan → ready

The workflow stays the primary source of truth; documents are optional. Only
chunks (never whole documents) are retrieved into prompts, and chunks that look
like prompt-injection attempts are kept out of the AI entirely.
"""

import hashlib
import io
import logging
import os
import re
import zipfile
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth.permissions import require_project_role
from database.models.job import Job
from database.models.project_document import DocumentChunk, ProjectDocument
from guardrails import Source, injection_detector, masker
from guardrails.detection import SECRET
from guardrails.models import Decision
from guardrails.policy_engine import policy
from services import document_storage, jobs
from services.document_extraction import ExtractionError, Section, decode_text, extract_isolated

logger = logging.getLogger("BugMind")

JOB_KIND = "document.process"

MAX_DOCUMENTS_PER_PROJECT = 20
MAX_EXTRACTED_CHARS = 500_000
MIN_TEXT_CHARS = 20
CHUNK_TARGET_CHARS = 1800
# Many tiny headings could otherwise explode the chunk count (and retrieval scans).
MAX_CHUNKS_PER_DOCUMENT = 400

FILE_TYPES = {
    ".pdf": ("pdf", "application/pdf"),
    ".docx": ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ".txt": ("txt", "text/plain; charset=utf-8"),
    ".md": ("md", "text/markdown; charset=utf-8"),
    ".markdown": ("md", "text/markdown; charset=utf-8"),
}


def max_file_bytes() -> int:
    return int(os.getenv("DOCUMENT_MAX_BYTES", 10 * 1024 * 1024))


class DocumentError(HTTPException):
    """A user-facing validation error (status + message)."""

    def __init__(self, status_code: int, message: str):
        super().__init__(status_code=status_code, detail=message)


# ── Validation ───────────────────────────────────────────────────────────────

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_filename(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    base = _CONTROL.sub("", base).strip().strip(".") or "document"
    return base[:255]


def _decode_text(data: bytes) -> str:
    try:
        return decode_text(data)
    except ExtractionError as exc:
        raise DocumentError(400, str(exc))


def detect_file_type(filename: str, data: bytes) -> tuple[str, str]:
    """(file_type, content_type), checked against the file's actual bytes."""
    ext = os.path.splitext(filename.lower())[1]
    if ext not in FILE_TYPES:
        raise DocumentError(400, "Unsupported file type. Upload PDF, DOCX, TXT or Markdown.")
    file_type, content_type = FILE_TYPES[ext]

    if file_type == "pdf" and not data.startswith(b"%PDF-"):
        raise DocumentError(400, "This file isn't a valid PDF.")
    if file_type == "docx":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if "word/document.xml" not in zf.namelist():
                    raise DocumentError(400, "This file isn't a valid Word (.docx) document.")
        except zipfile.BadZipFile:
            raise DocumentError(400, "This file isn't a valid Word (.docx) document.")
    if file_type in ("txt", "md"):
        _decode_text(data)
    return file_type, content_type


# ── Normalize + chunk ────────────────────────────────────────────────────────

_SPACES = re.compile(r"[ \t ]+")
_BLANK_LINES = re.compile(r"\n\s*\n\s*\n+")


def normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", text)
    text = "\n".join(_SPACES.sub(" ", line).strip() for line in text.split("\n"))
    return _BLANK_LINES.sub("\n\n", text).strip()


def _split_long(paragraph: str, limit: int) -> list[str]:
    parts, current = [], ""
    for word in paragraph.split(" "):
        if current and len(current) + 1 + len(word) > limit:
            parts.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        parts.append(current)
    return parts


def chunk_sections(sections: list[Section], target: int = CHUNK_TARGET_CHARS) -> list[Section]:
    """Pack paragraphs into ~target-char chunks without crossing section boundaries."""
    chunks: list[Section] = []
    for heading, text in sections:
        current = ""
        for paragraph in (p for p in text.split("\n\n") if p.strip()):
            pieces = _split_long(paragraph, target) if len(paragraph) > target else [paragraph]
            for piece in pieces:
                if current and len(current) + 2 + len(piece) > target:
                    chunks.append((heading, current))
                    current = piece
                else:
                    current = f"{current}\n\n{piece}" if current else piece
        if current:
            chunks.append((heading, current))
    return chunks


# ── Processing (job handler) ─────────────────────────────────────────────────


def process_document(db: Session, job: Job) -> None:
    doc = db.get(ProjectDocument, job.payload.get("document_id"))
    if doc is None or doc.deleted_at is not None:
        return  # deleted while queued: nothing to do

    doc.status, doc.error = "processing", None
    db.commit()

    data = document_storage.get(doc.storage_path)
    try:
        # Parsing runs in an isolated, time-limited process: hostile files can't hang the worker.
        sections, page_count = extract_isolated(doc.file_type, data)
    except ExtractionError as exc:  # unreadable content: retrying can't help
        raise jobs.PermanentJobError(str(exc))

    total, kept = 0, []
    for heading, text in sections:
        text = normalize(text)
        if not text:
            continue
        if total + len(text) > MAX_EXTRACTED_CHARS:
            text = text[: MAX_EXTRACTED_CHARS - total]
        kept.append((heading, text))
        total += len(text)
        if total >= MAX_EXTRACTED_CHARS:
            break
    if total < MIN_TEXT_CHARS:
        raise jobs.PermanentJobError(
            "No readable text found. Scanned documents need OCR, which isn't supported yet."
        )

    # Prepare every chunk before touching the table (the CPU work stays outside the row lock).
    prepared = []
    for ordinal, (heading, text) in enumerate(chunk_sections(kept)[:MAX_CHUNKS_PER_DOCUMENT]):
        # Secrets never reach the chunk table; PII is masked again on the way to the LLM.
        text = masker.mask(text, kinds=(SECRET,), stage="ingest").text
        report = injection_detector.assess(text, source=Source.RETRIEVED)
        flagged = policy.injection_decision(Source.RETRIEVED, report.score) != Decision.ALLOW
        prepared.append(DocumentChunk(document_id=doc.id, project_id=doc.project_id, ordinal=ordinal,
                                      heading=heading, text=text, token_estimate=max(1, len(text) // 4),
                                      flagged=flagged))

    # Row lock: a concurrent run of this job, or a delete, waits instead of interleaving
    # with the chunk replacement (no duplicated chunks, no text outliving a delete).
    doc = (
        db.query(ProjectDocument)
        .filter(ProjectDocument.id == doc.id)
        .with_for_update()
        .populate_existing()  # fresh values, not the cached object from the start of the job
        .one()
    )
    if doc.deleted_at is not None:
        db.rollback()
        return
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
    db.add_all(prepared)
    doc.status = "ready"
    doc.page_count = page_count
    doc.char_count = total
    doc.chunk_count = len(prepared)
    doc.flagged_chunk_count = sum(1 for c in prepared if c.flagged)
    doc.processed_at = datetime.utcnow()
    db.commit()
    logger.info(f"Document {doc.id} processed: {doc.chunk_count} chunks, {doc.flagged_chunk_count} flagged")


def _mark_failed(db: Session, job: Job, exc: Exception) -> None:
    doc = db.get(ProjectDocument, job.payload.get("document_id"))
    if doc is None:
        return
    doc.status = "failed"
    doc.error = str(exc) if isinstance(exc, jobs.PermanentJobError) else (
        "Processing failed after several attempts. Try again in a few minutes."
    )


jobs.register(JOB_KIND, process_document, on_final_failure=_mark_failed)


def purge_deleted_document_chunks(db: Session) -> int:
    """Backstop for the delete/process race: no chunk text outlives its document."""
    from sqlalchemy import select

    deleted_ids = select(ProjectDocument.id).where(ProjectDocument.deleted_at.isnot(None))
    count = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id.in_(deleted_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return count


jobs.register_maintenance(purge_deleted_document_chunks)


# ── CRUD ─────────────────────────────────────────────────────────────────────


def _active(db: Session, project_id: int):
    return db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id, ProjectDocument.deleted_at.is_(None)
    )


def _get(db: Session, project_id: int, document_id: int) -> ProjectDocument:
    doc = _active(db, project_id).filter(ProjectDocument.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


def upload_document(db: Session, project_id: int, user_id: int, filename: str, data: bytes) -> ProjectDocument:
    require_project_role(db, user_id, project_id, "editor")
    filename = sanitize_filename(filename)
    if not data:
        raise DocumentError(400, "The file is empty.")
    if len(data) > max_file_bytes():
        raise DocumentError(413, f"Files can be at most {max_file_bytes() // (1024 * 1024)} MB.")
    file_type, content_type = detect_file_type(filename, data)

    if _active(db, project_id).count() >= MAX_DOCUMENTS_PER_PROJECT:
        raise DocumentError(400, f"A project can have at most {MAX_DOCUMENTS_PER_PROJECT} documents.")
    sha256 = hashlib.sha256(data).hexdigest()
    duplicate = _active(db, project_id).filter(ProjectDocument.sha256 == sha256).first()
    if duplicate:
        raise DocumentError(409, f"This file is already uploaded as \"{duplicate.filename}\".")

    storage_path = document_storage.put(project_id, data, content_type)
    try:
        doc = ProjectDocument(project_id=project_id, uploaded_by=user_id, filename=filename,
                              file_type=file_type, content_type=content_type, size_bytes=len(data),
                              sha256=sha256, storage_path=storage_path, status="uploaded")
        db.add(doc)
        db.flush()
        jobs.enqueue(db, JOB_KIND, {"document_id": doc.id}, project_id=project_id)
        db.commit()
    except Exception:
        db.rollback()
        document_storage.delete(storage_path)
        raise
    db.refresh(doc)
    return doc


def list_documents(db: Session, project_id: int, user_id: int) -> list[ProjectDocument]:
    require_project_role(db, user_id, project_id, "viewer")
    return _active(db, project_id).order_by(ProjectDocument.created_at.desc(), ProjectDocument.id.desc()).all()


def get_document(db: Session, project_id: int, user_id: int, document_id: int) -> ProjectDocument:
    require_project_role(db, user_id, project_id, "viewer")
    return _get(db, project_id, document_id)


def set_ai_enabled(db: Session, project_id: int, user_id: int, document_id: int, enabled: bool) -> ProjectDocument:
    require_project_role(db, user_id, project_id, "editor")
    doc = _get(db, project_id, document_id)
    doc.ai_enabled = bool(enabled)
    db.commit()
    db.refresh(doc)
    return doc


def retry_document(db: Session, project_id: int, user_id: int, document_id: int) -> ProjectDocument:
    require_project_role(db, user_id, project_id, "editor")
    doc = _get(db, project_id, document_id)
    if doc.status != "failed":
        raise DocumentError(409, "Only documents that failed processing can be retried.")
    doc.status, doc.error = "uploaded", None
    jobs.enqueue(db, JOB_KIND, {"document_id": doc.id}, project_id=project_id)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, project_id: int, user_id: int, document_id: int) -> None:
    require_project_role(db, user_id, project_id, "editor")
    doc = _get(db, project_id, document_id)
    doc.deleted_at = datetime.utcnow()
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
    db.commit()
    document_storage.delete(doc.storage_path)


def read_document(db: Session, project_id: int, user_id: int, document_id: int) -> tuple[ProjectDocument, bytes]:
    doc = get_document(db, project_id, user_id, document_id)
    return doc, document_storage.get(doc.storage_path)


def serialize(doc: ProjectDocument) -> dict:
    return {
        "id": doc.id,
        "filename": doc.filename,
        "fileType": doc.file_type,
        "sizeBytes": doc.size_bytes,
        "status": doc.status,
        "error": doc.error,
        "aiEnabled": doc.ai_enabled,
        # Usable as AI context: processed, switched on, and has at least one clean chunk.
        "availableToAi": doc.status == "ready" and doc.ai_enabled and doc.chunk_count > doc.flagged_chunk_count,
        "pageCount": doc.page_count,
        "chunkCount": doc.chunk_count,
        "flaggedChunkCount": doc.flagged_chunk_count,
        "uploadedBy": {"id": doc.uploader.id, "name": doc.uploader.name} if doc.uploader else None,
        "createdAt": doc.created_at.isoformat() if doc.created_at else None,
        "processedAt": doc.processed_at.isoformat() if doc.processed_at else None,
    }
