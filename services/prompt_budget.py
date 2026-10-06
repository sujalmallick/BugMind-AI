"""
services/prompt_budget.py — context-window optimization for the analysis prompts.

Counts real tokens for the user's model and splits the model's context window
between the parts of a prompt by priority:

    1. fixed instructions + output room   (always reserved)
    2. the workflow + observed steps      (must fit, or the request is refused up front)
    3. retrieved document excerpts        (shrinks first)
    4. the project's manual test cases    (shrinks first)

Large models (gpt-oss-120b, Gemini, GPT-4o: 128k+) are bounded by the configured
caps, which exist for per-minute token limits. Small-context models get budgets
scaled to what actually fits, instead of a context-length error.
"""

import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("BugMind")

# Used when LiteLLM doesn't know the model (e.g. some OpenRouter free models). Generous on
# purpose: an unknown window never refuses a request, it only sizes the optional context.
UNKNOWN_CONTEXT_TOKENS = 32768
# Instructions, schemas and examples in the largest agent prompt (test cases).
PROMPT_OVERHEAD_TOKENS = 1800
# Room for the JSON answer (test cases are the longest output).
OUTPUT_RESERVE_TOKENS = 4096


def _env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def model_context_tokens(model: str | None) -> int | None:
    """The model's input window from LiteLLM's model registry, or None when unknown."""
    override = _env_int("MODEL_CONTEXT_TOKENS_OVERRIDE", 0)
    if override:
        return override
    if not model:
        return None
    try:
        import litellm

        info = litellm.get_model_info(model)
        value = info.get("max_input_tokens") or info.get("max_tokens")
        return int(value) if value else None
    except Exception:
        return None


def count_tokens(text: str, model: str | None = None) -> int:
    """Tokens for `text` with the model's tokenizer (LiteLLM falls back to tiktoken; ~chars/4 if all else fails)."""
    if not text:
        return 0
    try:
        import litellm

        return int(litellm.token_counter(model=model or "gpt-4o", text=text))
    except Exception:
        return max(1, len(text) // 4)


@dataclass
class PromptBudget:
    context_tokens: int
    workflow_tokens: int
    knowledge_tokens: int        # for retrieved document excerpts (0 = none)
    manual_cases_tokens: int     # for the "don't duplicate these" manual test case list
    context_known: bool = True   # False: the model isn't in LiteLLM's registry

    @property
    def fits(self) -> bool:
        if not self.context_known:
            return True  # never refuse on a guessed window; the provider has the final say
        return self.workflow_tokens + PROMPT_OVERHEAD_TOKENS + OUTPUT_RESERVE_TOKENS <= self.context_tokens


# Below this, an excerpt budget can't hold even one useful excerpt: send none instead.
MIN_KNOWLEDGE_TOKENS = 120


def plan_budget(model: str | None, workflow_text: str) -> PromptBudget:
    known_context = model_context_tokens(model)
    context = known_context or UNKNOWN_CONTEXT_TOKENS
    workflow_tokens = count_tokens(workflow_text, model)
    free = max(0, context - PROMPT_OVERHEAD_TOKENS - OUTPUT_RESERVE_TOKENS - workflow_tokens)
    # Optional context may use at most half of what's left, split 60/40 between excerpts and manual cases.
    knowledge = min(_env_int("KNOWLEDGE_CONTEXT_TOKENS", 1200), int(free * 0.5 * 0.6))
    if knowledge < MIN_KNOWLEDGE_TOKENS:
        knowledge = 0
    manual = min(_env_int("MANUAL_CASES_CONTEXT_TOKENS", 800), int(free * 0.5 * 0.4))
    budget = PromptBudget(context, workflow_tokens, knowledge, manual, context_known=known_context is not None)
    logger.info(
        f"Prompt budget | model={model} context={context} workflow={workflow_tokens} "
        f"knowledge={knowledge} manual_cases={manual} fits={budget.fits}"
    )
    return budget


def fit_items(items: list, render, max_tokens: int, model: str | None = None) -> list:
    """Keep items in order while their rendered text fits in max_tokens."""
    kept, used = [], 0
    for item in items:
        cost = count_tokens(render(item), model)
        if used + cost > max_tokens:
            break
        kept.append(item)
        used += cost
    return kept
