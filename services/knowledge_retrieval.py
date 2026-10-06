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
import re

from sqlalchemy.orm import Session

from agents.coverage import keywords
from auth.permissions import require_project_role
from database.models.project_document import DocumentChunk, ProjectDocument
from services.prompt_budget import count_tokens

BM25_K1 = 1.5
BM25_B = 0.75
MAX_EXCERPTS = 6
MAX_CHUNKS_SCANNED = 6000
# Drop weak matches: below this share of the best score, an excerpt is noise.
RELATIVE_SCORE_FLOOR = 0.3
# Excerpts this similar (keyword Jaccard) to one already chosen add nothing new.
DUPLICATE_SIMILARITY = 0.7
MIN_EXCERPT_TOKENS = 120


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
    model: str | None = None,
) -> list[dict]:
    """Best-matching excerpts for `query`, most relevant first, within the token budget."""
    require_project_role(db, user_id, project_id, "viewer")
    if os.getenv("PROJECT_KNOWLEDGE_ENABLED", "true").strip().lower() == "false":
        return []  # switching the feature off also keeps existing documents out of prompts
    budget = context_token_budget() if token_budget is None else token_budget
    query_terms = keywords(query)
    if not query_terms or budget < MIN_EXCERPT_TOKENS:
        return []  # too small for even one useful excerpt: skip the scan entirely

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
        .order_by(DocumentChunk.document_id, DocumentChunk.ordinal)
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
        scored.append((score, chunk, filename, terms))
    if not scored:
        return []
    scored.sort(key=lambda item: (-item[0], item[1].document_id, item[1].ordinal))
    floor = scored[0][0] * RELATIVE_SCORE_FLOOR

    # Each excerpt may use at most half the budget, so a long chunk can't crowd out the rest.
    per_excerpt = max(MIN_EXCERPT_TOKENS, budget // 2)
    excerpts, chosen_terms, used = [], [], 0
    for score, chunk, filename, terms in scored:
        if score < floor or len(excerpts) >= max_excerpts:
            break
        if any(_jaccard(terms, other) >= DUPLICATE_SIMILARITY for other in chosen_terms):
            continue  # near-duplicate of an excerpt already chosen
        text = compress_excerpt(chunk.text, query_terms, per_excerpt, model)
        cost = count_tokens(text, model)
        if used + cost > budget:
            continue  # a smaller, slightly less relevant chunk may still fit
        used += cost
        chosen_terms.append(terms)
        excerpts.append({
            "chunkId": chunk.id,
            "documentId": chunk.document_id,
            "filename": filename,
            "heading": chunk.heading,
            "text": text,
            "compressed": text != chunk.text,
            "tokens": cost,
            "score": round(score, 3),
        })
    return excerpts


def _jaccard(a: set, b: set) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def compress_excerpt(text: str, query_terms: set, max_tokens: int, model: str | None = None) -> str:
    """
    Extractive compression: if `text` is over max_tokens, keep the sentences that
    share the most query terms (in their original order, "…" marking gaps), so
    more relevant facts fit in fewer tokens. Nothing is paraphrased.
    """
    if count_tokens(text, model) <= max_tokens:
        return text
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    ranked = sorted(
        ((len(keywords(s) & query_terms), i) for i, s in enumerate(sentences)),
        key=lambda item: (-item[0], item[1]),
    )
    chosen, used = set(), 0
    for overlap, i in ranked:
        if overlap == 0:
            break
        cost = count_tokens(sentences[i], model)
        if used + cost <= max_tokens:
            chosen.add(i)
            used += cost
    if not chosen:  # nothing matched sentence by sentence: keep the opening, cut to size (by tokens)
        cut = text[: max_tokens * 4]
        while cut and count_tokens(cut, model) > max_tokens:
            cut = cut[: int(len(cut) * 0.8)]
        return cut.rsplit(" ", 1)[0] + " …" if " " in cut else cut + " …"
    parts, previous = [], None
    for i in sorted(chosen):
        if previous is not None and i != previous + 1:
            parts.append("…")
        parts.append(sentences[i])
        previous = i
    return " ".join(parts)


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
