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

logger = logging.getLogger("BugMind")

JOB_KIND = "document.process"

MAX_DOCUMENTS_PER_PROJECT = 20
MAX_PDF_PAGES = 300
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # zip-bomb guard
MAX_EXTRACTED_CHARS = 500_000
MIN_TEXT_CHARS = 20
CHUNK_TARGET_CHARS = 1800

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
    if b"\x00" in data[:8192]:
        raise DocumentError(400, "This file looks binary, not text.")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise DocumentError(400, "Text files must be UTF-8 encoded.")


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


# ── Extraction ───────────────────────────────────────────────────────────────

Section = tuple[str | None, str]  # (heading, text)


def _extract_pdf(data: bytes) -> tuple[list[Section], int]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise jobs.PermanentJobError("Password-protected PDFs aren't supported.")
        page_count = len(reader.pages)
        if page_count > MAX_PDF_PAGES:
            raise jobs.PermanentJobError(f"This PDF has {page_count} pages; the limit is {MAX_PDF_PAGES}.")
        sections = [(f"Page {i}", page.extract_text() or "") for i, page in enumerate(reader.pages, start=1)]
    except PdfReadError:
        raise jobs.PermanentJobError("This PDF couldn't be read; it may be damaged.")
    return sections, page_count


def _extract_docx(data: bytes) -> list[Section]:
    import docx
    from docx.table import Table

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        if sum(info.file_size for info in zf.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
            raise jobs.PermanentJobError("This Word document is too large once uncompressed.")

    document = docx.Document(io.BytesIO(data))
    sections: list[Section] = []
    heading, lines = None, []
    for block in document.iter_inner_content():
        if isinstance(block, Table):
            for row in block.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    lines.append(" | ".join(cells))
            continue
        text = block.text.strip()
        style = (block.style.name if block.style is not None else "") or ""
        if text and (style.startswith("Heading") or style == "Title"):
            if lines:
                sections.append((heading, "\n\n".join(lines)))
            heading, lines = text[:255], []
        elif text:
            lines.append(text)
    if lines:
        sections.append((heading, "\n\n".join(lines)))
    return sections


_MD_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$")


def _extract_markdown(text: str) -> list[Section]:
    sections: list[Section] = []
    heading, lines = None, []
    for line in text.splitlines():
        match = _MD_HEADING.match(line)
        if match:
            if any(l.strip() for l in lines):
                sections.append((heading, "\n".join(lines)))
            heading, lines = match.group(1)[:255], []
        else:
            lines.append(line)
    if any(l.strip() for l in lines):
        sections.append((heading, "\n".join(lines)))
    return sections


def extract_sections(file_type: str, data: bytes) -> tuple[list[Section], int | None]:
    """Raw bytes → [(heading, text)] and the page count (PDF only)."""
    if file_type == "pdf":
        return _extract_pdf(data)
    if file_type == "docx":
        return _extract_docx(data), None
    text = _decode_text(data)
    return (_extract_markdown(text) if file_type == "md" else [(None, text)]), None


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
        sections, page_count = extract_sections(doc.file_type, data)
    except DocumentError as exc:  # unreadable content: retrying can't help
        raise jobs.PermanentJobError(exc.detail)

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

    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
    chunks = chunk_sections(kept)
    flagged_count = 0
    for ordinal, (heading, text) in enumerate(chunks):
        # Secrets never reach the chunk table; PII is masked again on the way to the LLM.
        text = masker.mask(text, kinds=(SECRET,), stage="ingest").text
        report = injection_detector.assess(text, source=Source.RETRIEVED)
        flagged = policy.injection_decision(Source.RETRIEVED, report.score) != Decision.ALLOW
        flagged_count += flagged
        db.add(DocumentChunk(document_id=doc.id, project_id=doc.project_id, ordinal=ordinal,
                             heading=heading, text=text, token_estimate=max(1, len(text) // 4),
                             flagged=flagged))

    doc.status = "ready"
    doc.page_count = page_count
    doc.char_count = total
    doc.chunk_count = len(chunks)
    doc.flagged_chunk_count = flagged_count
    doc.processed_at = datetime.utcnow()
    db.commit()
    logger.info(f"Document {doc.id} processed: {doc.chunk_count} chunks, {flagged_count} flagged")


def _mark_failed(db: Session, job: Job, exc: Exception) -> None:
    doc = db.get(ProjectDocument, job.payload.get("document_id"))
    if doc is None:
        return
    doc.status = "failed"
    doc.error = str(exc) if isinstance(exc, jobs.PermanentJobError) else (
        "Processing failed after several attempts. Try again in a few minutes."
    )


jobs.register(JOB_KIND, process_document, on_final_failure=_mark_failed)


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
