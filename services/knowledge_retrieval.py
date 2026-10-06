"""
services/knowledge_retrieval.py — the "R" in RAG for Project Knowledge.

retrieve() ranks a project's usable document chunks against a query with
BM25 (binary term frequency, over the same stemmed keywords the coverage check
uses) and returns the best ones within a token budget. Usable means: document
ready, not deleted, switched on for AI, and the chunk not flagged as a prompt
injection.

Keyword retrieval needs no embeddings API (Groq, the default provider, has
none) and works well for a project's handful of documents. This function is
the single seam for adding vector / hybrid retrieval later.
"""

import math
import os

from sqlalchemy.orm import Session

from agents.coverage import keywords
from auth.permissions import require_project_role
from database.models.project_document import DocumentChunk, ProjectDocument

BM25_K1 = 1.5
BM25_B = 0.75
MAX_EXCERPTS = 6
MAX_CHUNKS_SCANNED = 6000
# Drop weak matches: below this share of the best score, an excerpt is noise.
RELATIVE_SCORE_FLOOR = 0.3


def context_token_budget() -> int:
    try:
        return max(0, int(os.getenv("KNOWLEDGE_CONTEXT_TOKENS", "1200")))
    except ValueError:
        return 1200


def retrieve(
    db: Session,
    user_id: int,
    project_id: int,
    query: str,
    token_budget: int | None = None,
    max_excerpts: int = MAX_EXCERPTS,
) -> list[dict]:
    """Best-matching excerpts for `query`, most relevant first, within the token budget."""
    require_project_role(db, user_id, project_id, "viewer")
    budget = context_token_budget() if token_budget is None else token_budget
    query_terms = keywords(query)
    if not query_terms or budget <= 0:
        return []

    rows = (
        db.query(DocumentChunk, ProjectDocument.filename)
        .join(ProjectDocument, ProjectDocument.id == DocumentChunk.document_id)
        .filter(
            DocumentChunk.project_id == project_id,
            ProjectDocument.project_id == project_id,
            ProjectDocument.deleted_at.is_(None),
            ProjectDocument.status == "ready",
            ProjectDocument.ai_enabled.is_(True),
            DocumentChunk.flagged.is_(False),
        )
        .limit(MAX_CHUNKS_SCANNED)
        .all()
    )
    if not rows:
        return []

    corpus = [(chunk, filename, keywords(f"{chunk.heading or ''} {chunk.text}")) for chunk, filename in rows]
    n_docs = len(corpus)
    avg_len = sum(len(terms) for _, _, terms in corpus) / n_docs or 1.0
    doc_freq = {t: sum(1 for _, _, terms in corpus if t in terms) for t in query_terms}
    idf = {t: math.log(1 + (n_docs - df + 0.5) / (df + 0.5)) for t, df in doc_freq.items()}
    min_matches = 1 if len(query_terms) <= 2 else 2

    scored = []
    for chunk, filename, terms in corpus:
        matched = query_terms & terms
        if len(matched) < min_matches:
            continue
        norm = 1 - BM25_B + BM25_B * len(terms) / avg_len
        score = sum(idf[t] * (BM25_K1 + 1) / (1 + BM25_K1 * norm) for t in matched)
        scored.append((score, chunk, filename))
    if not scored:
        return []
    scored.sort(key=lambda item: (-item[0], item[1].document_id, item[1].ordinal))
    floor = scored[0][0] * RELATIVE_SCORE_FLOOR

    excerpts, used = [], 0
    for score, chunk, filename in scored:
        if score < floor or len(excerpts) >= max_excerpts:
            break
        if used + chunk.token_estimate > budget:
            continue  # a smaller, slightly less relevant chunk may still fit
        used += chunk.token_estimate
        excerpts.append({
            "chunkId": chunk.id,
            "documentId": chunk.document_id,
            "filename": filename,
            "heading": chunk.heading,
            "text": chunk.text,
            "score": round(score, 3),
        })
    return excerpts


def summarize_sources(excerpts: list[dict]) -> list[dict]:
    """Per-document summary of what the analysis used, for the API response."""
    by_doc: dict[int, dict] = {}
    for excerpt in excerpts:
        entry = by_doc.setdefault(excerpt["documentId"], {
            "documentId": excerpt["documentId"], "filename": excerpt["filename"], "sections": [],
        })
        if excerpt["heading"] and excerpt["heading"] not in entry["sections"]:
            entry["sections"].append(excerpt["heading"])
    return list(by_doc.values())
