"""
services/workflow_draft.py — "Draft workflow from documents".

Turns the project's documents into a workflow description the user reviews in
the workflow box before running an analysis:

    excerpts (focus → BM25 retrieval, else each document's opening sections)
      → draft agent (one LLM call: ordered steps with citations)
      → safety checks on every generated string
      → grounding check per step (deterministic)
      → workflow text from the supported steps only

Steps the documents don't support are left out of the text and returned
separately, so a hallucinated step never lands in the workflow silently.
"""

import logging
import os

from sqlalchemy.orm import Session

from agents.grounding import ground_draft_steps
from agents.workflow_draft_agent import AGENT, draft_workflow_agent
from auth.permissions import require_project_role
from config import DEFAULT_MODEL
from guardrails import Source, input_guardrail
from services.ai_output import safe_generated_text
from services.ai_settings_service import ai_settings_service
from services.knowledge_retrieval import MIN_EXCERPT_TOKENS, overview_excerpts, retrieve, summarize_sources
from services.prompt_budget import UNKNOWN_CONTEXT_TOKENS, model_context_tokens

logger = logging.getLogger("BugMind")

STEP_SEPARATOR = " → "
DRAFT_PROMPT_OVERHEAD_TOKENS = 700
DRAFT_OUTPUT_RESERVE_TOKENS = 1200


def draft_token_budget(model: str | None) -> int:
    """Excerpt tokens for the draft prompt: the configured cap, scaled down for small-context models."""
    try:
        cap = max(0, int(os.getenv("DRAFT_CONTEXT_TOKENS", "2400")))
    except ValueError:
        cap = 2400
    context = model_context_tokens(model) or UNKNOWN_CONTEXT_TOKENS
    free = max(0, context - DRAFT_PROMPT_OVERHEAD_TOKENS - DRAFT_OUTPUT_RESERVE_TOKENS)
    return min(cap, int(free * 0.6))


def _error(code: str, message: str) -> dict:
    return {"success": False, "code": code, "error": message}


def _safe(text: str) -> str | None:
    return safe_generated_text(text, AGENT)


def draft_workflow(db: Session, user_id: int, project_id: int, focus: str | None = None) -> dict:
    require_project_role(db, user_id, project_id, "viewer")

    focus_text = None
    if focus and focus.strip():
        focus_check = input_guardrail.validate(focus.strip(), source=Source.USER, field="focus")
        if focus_check.blocked:
            return focus_check.error_response()
        focus_text = focus_check.sanitized_text

    try:
        model = ai_settings_service.get_model(db, user_id)
    except Exception:  # settings lookup failed: size the prompt for the default model
        db.rollback()
        model = DEFAULT_MODEL
    budget = draft_token_budget(model)
    if budget < MIN_EXCERPT_TOKENS:
        return _error("context_too_long", "The selected AI model's context window is too small to read documents.")

    if focus_text:
        excerpts = retrieve(db, user_id, project_id, focus_text, token_budget=budget, max_excerpts=8, model=model)
        if not excerpts:
            return _error("no_match", "Nothing in your documents matches that focus. Try other words, or leave it empty.")
    else:
        excerpts = overview_excerpts(db, user_id, project_id, token_budget=budget, model=model)
        if not excerpts:
            return _error("no_documents", "Attach a document and wait until it's Ready, with “Use in AI” on.")

    draft = draft_workflow_agent(excerpts, focus=focus_text, user_id=user_id)
    if isinstance(draft, dict) and draft.get("success") is False:
        return draft

    steps, removed = [], 0
    for step in draft["steps"]:
        text = _safe(step["text"])
        if text is None:
            removed += 1
            continue
        steps.append({**step, "text": text})
    gaps = [g for g in (_safe(g) for g in draft["gaps"]) if g]
    title = _safe(draft["title"]) if draft["title"] else None

    checked = ground_draft_steps(steps, excerpts)
    kept = [s for s in checked if s["status"] != "unsupported"]
    left_out = [{"text": s["text"], "note": s["note"]} for s in checked if s["status"] == "unsupported"]
    logger.info(
        f"Workflow draft | project={project_id} excerpts={len(excerpts)} steps={len(checked)} "
        f"kept={len(kept)} left_out={len(left_out)} removed_unsafe={removed}"
    )
    # A draft needs at least one step the documents actually back up.
    if not any(s["status"] == "grounded" for s in kept):
        return _error(
            "no_workflow",
            "Couldn't draft a workflow your documents support. Check they describe a user flow, "
            "or try a focus such as a feature name.",
        )

    used_ids = {ref["documentId"] for s in kept for ref in s["sources"]}
    return {
        "success": True,
        "title": title,
        "workflow": STEP_SEPARATOR.join(s["text"] for s in kept),
        "steps": [{k: s[k] for k in ("text", "status", "sources")} for s in kept],
        "leftOut": left_out,
        "gaps": gaps,
        "removedForSafety": removed,
        "sources": [s for s in summarize_sources(excerpts) if s["documentId"] in used_ids],
    }
