import json
from utils import logger
from utils import call_llm, parse_json_response


def identify_modules_agent(workflow: str):
    prompt = f"""
You are a Principal AI Engineer and Senior QA Architect analyzing an application's workflow description.

Workflow to Analyze:
---
{workflow}
---

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

    logger.info("Running Module Agent")

    response = call_llm(prompt)

    # Quota exhausted / API failure
    if response is None:
        return {
            "success": False,
            "error": "Gemini API quota exceeded or no response returned."
        }

    # Already a dict
    if isinstance(response, dict):
        modules = response
    else:
        modules = parse_json_response(response, prompt)

    # Validation safety
    if not isinstance(modules, dict):
        modules = {}

    expected_keys = [
        "confirmed_modules",
        "assumed_modules",
        "unknown_areas",
        "critical_workflows",
        "high_risk_areas"
    ]

    normalized_modules = {}

    for key in expected_keys:
        value = modules.get(key)

        if isinstance(value, list):
            normalized_modules[key] = [
                str(item).strip()
                for item in value
                if item is not None
            ]
        else:
            normalized_modules[key] = []

    return normalized_modules