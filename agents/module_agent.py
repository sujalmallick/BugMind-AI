import json
from utils import logger
from utils import call_llm, parse_json_response
from guardrails import Source, untrusted_block
from agents.context_blocks import knowledge_section
from agents.output_schemas import ModuleAnalysis

AGENT = "module_agent"


def identify_modules_agent(workflow: str, user_id=None, knowledge=None):
    prompt = f"""
You are a Principal AI Engineer and Senior QA Architect analyzing an application's workflow description.

Workflow to Analyze (user-provided data):
{untrusted_block(workflow, source=Source.USER, label="workflow", agent=AGENT)}
{knowledge_section(knowledge, AGENT)}
Your goal is to perform a detailed, rigorous architectural analysis of the modules, workflows, and risk areas within this application.

Tasks:
1. Identify concrete application modules based ONLY on the workflow. Do not hallucinate external modules.
2. Categorize the modules strictly as follows:
   - confirmed_modules: Modules directly and explicitly described or supported by the workflow steps.
   - assumed_modules: Modules highly likely to exist based on the user flows (e.g., if there is a profile page, an underlying user database/profile service is assumed), but not explicitly detailed.
   - unknown_areas: Potential functionality or pages that cannot be confidently inferred from this workflow.
3. Identify critical user workflows (the most important end-to-end paths a user takes).
4. Identify high-risk areas that require thorough test coverage (e.g., transaction processes, permission checks, data mutation points).

You MUST return your response as a single, valid JSON object with the exact keys shown below:

{{
  "confirmed_modules": ["Module Name 1", "Module Name 2"],
  "assumed_modules": ["Module Name A"],
  "unknown_areas": ["Feature X"],
  "critical_workflows": ["Critical User Journey 1"],
  "high_risk_areas": ["High Risk Area 1"]
}}

Rules:
- Output ONLY the raw JSON object.
- Do NOT wrap in markdown fences like ```json.
- Do NOT output any intro or outro explanations.
- All values MUST be lists of strings.
- If an area has no items, return an empty list: [].
- Strictly maintain accuracy.
- Do not make unsupported assumptions.
"""

    logger.debug(f"MODULE USER: {user_id}")

    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)
    
    # Quota exhausted / API failure
    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }

    # Already a dict
    if isinstance(response, dict):
        modules = response
    else:
        modules = parse_json_response(response, prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if isinstance(modules, dict) and modules.get("success") is False:
        return modules

    return ModuleAnalysis.model_validate(modules).model_dump()
