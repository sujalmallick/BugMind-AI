"""
services/document_extraction.py — turn uploaded file bytes into text sections.

Parsing untrusted PDF/DOCX files is the riskiest step in Project Knowledge: a
crafted file can burn CPU or memory inside the parser. extract_isolated() runs
the parser in a separate, freshly spawned process with a time limit (and, on
Linux, an address-space limit), so a hostile file can only take down that
child process, never the app or its job worker.

This module stays dependency-light on purpose: the child process imports it,
and nothing here touches the database or app configuration.
"""

import io
import logging
import multiprocessing
import os
import re
import zipfile

logger = logging.getLogger("BugMind")

MAX_PDF_PAGES = 300
MAX_EXTRACT_CHARS = 600_000  # a little over what processing keeps (500k)
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # zip-bomb guard (zipfile caps output at the declared size)
CHILD_MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024

Section = tuple[str | None, str]  # (heading, text)


class ExtractionError(Exception):
    """The file can't be read. The message is shown to users; retrying won't help."""


def decode_text(data: bytes) -> str:
    if b"\x00" in data[:8192]:
        raise ExtractionError("This file looks binary, not text.")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ExtractionError("Text files must be UTF-8 encoded.")


def _extract_pdf(data: bytes) -> tuple[list[Section], int]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ExtractionError("Password-protected PDFs aren't supported.")
        page_count = len(reader.pages)
        if page_count > MAX_PDF_PAGES:
            raise ExtractionError(f"This PDF has {page_count} pages; the limit is {MAX_PDF_PAGES}.")
        sections, total = [], 0
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            sections.append((f"Page {i}", text))
            total += len(text)
            if total >= MAX_EXTRACT_CHARS:
                break  # the rest would be discarded anyway
    except PdfReadError:
        raise ExtractionError("This PDF couldn't be read; it may be damaged.")
    return sections, page_count


def _extract_docx(data: bytes) -> list[Section]:
    import docx
    from docx.table import Table

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        if sum(info.file_size for info in zf.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
            raise ExtractionError("This Word document is too large once uncompressed.")

    document = docx.Document(io.BytesIO(data))  # python-docx's XML parser doesn't resolve entities
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
    """Raw bytes → [(heading, text)] and the page count (PDF only). In-process."""
    if file_type == "pdf":
        return _extract_pdf(data)
    if file_type == "docx":
        return _extract_docx(data), None
    text = decode_text(data)
    return (_extract_markdown(text) if file_type == "md" else [(None, text)]), None


# ── Isolation ────────────────────────────────────────────────────────────────


def _limit_child_memory() -> None:
    try:
        import resource  # POSIX only

        resource.setrlimit(resource.RLIMIT_AS, (CHILD_MEMORY_LIMIT_BYTES, CHILD_MEMORY_LIMIT_BYTES))
    except Exception:
        pass  # Windows / restricted environments: the time limit still applies


def _child(func, args, conn) -> None:
    _limit_child_memory()
    try:
        conn.send(("ok", func(*args)))
    except ExtractionError as exc:
        conn.send(("error", str(exc)))
    except MemoryError:
        conn.send(("error", "This document needs too much memory to read."))
    except Exception as exc:  # parser bug or hostile input: report, don't crash the parent
        conn.send(("crash", f"{type(exc).__name__}: {exc}"[:500]))
    finally:
        conn.close()


def extraction_timeout() -> float:
    try:
        return max(1.0, float(os.getenv("DOCUMENT_EXTRACTION_TIMEOUT_SECONDS", "60")))
    except ValueError:
        return 60.0


def run_isolated(func, args: tuple, timeout: float):
    """
    Run func(*args) in a fresh process; return its result. Raises ExtractionError
    when the child reports one, runs past `timeout`, crashes or dies.
    """
    # "spawn", never fork: the app process has threads (job worker, thread pool),
    # and forking a threaded process can deadlock the child.
    ctx = multiprocessing.get_context("spawn")
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_child, args=(func, args, child_conn), daemon=True)
    proc.start()
    child_conn.close()
    try:
        if not parent_conn.poll(timeout):
            raise ExtractionError("This document took too long to read and was skipped.")
        try:
            status, payload = parent_conn.recv()
        except EOFError:  # the child died without reporting (e.g. killed by the memory limit)
            raise ExtractionError("This document couldn't be read safely and was skipped.")
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(5)
        parent_conn.close()

    if status == "ok":
        return payload
    if status == "error":
        raise ExtractionError(payload)
    logger.warning(f"Document extraction crashed in the isolated process: {payload}")
    raise ExtractionError("This document couldn't be read; it may be damaged.")


def extract_isolated(file_type: str, data: bytes, timeout: float | None = None):
    """extract_sections() in an isolated process. DOCUMENT_EXTRACTION_ISOLATED=false runs it in-process."""
    if os.getenv("DOCUMENT_EXTRACTION_ISOLATED", "true").strip().lower() == "false":
        return extract_sections(file_type, data)
    return run_isolated(extract_sections, (file_type, data), timeout or extraction_timeout())
