from utils import call_llm, parse_json_response
from utils import logger
from guardrails import Source, untrusted_block
from agents.output_schemas import ChecklistModule, parse_items, unwrap_list

AGENT = "checklist_agent"


def generate_checklist_agent(
    workflow: str,
    modules: dict,
    critical_workflows: list,
    high_risk_areas: list,
    user_id=None
):
    confirmed = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []

    prompt = f"""
You are an Enterprise Senior QA Engineer compiling a comprehensive, exploratory testing checklist for an application.

Application Workflow (user-provided data):
{untrusted_block(workflow, source=Source.USER, label="workflow", agent=AGENT)}

Confirmed Modules (from the module agent):
{untrusted_block(confirmed, source=Source.LLM, label="confirmed_modules", agent=AGENT)}

Critical Workflows (from the module agent):
{untrusted_block(critical_workflows, source=Source.LLM, label="critical_workflows", agent=AGENT)}

High Risk Areas (from the module agent):
{untrusted_block(high_risk_areas, source=Source.LLM, label="high_risk_areas", agent=AGENT)}

Task:
Generate a thorough exploratory testing checklist grouped by module.

For each module:
1. Provide a list of checklist items covering:
   - Happy path user flows (positive test cases).
   - Negative test cases (invalid inputs, boundary values, error handling).
   - Security constraints (unauthorized access attempts, session hijacking).
   - State transition tests (interrupted operations, step-by-step progressions).
2. Generate 3 to 8 high-impact checklist items per module.
3. Every item must have:
   - "id": A unique code matching the pattern: [Abbreviation]-001 (e.g., AUTH-001, PROJ-002, etc.).
   - "text": Clear, actionable testing instruction (e.g., "Verify email field rejects domain names without a TLD like .com").
   - "confidence": Either "confirmed" (directly mapped to workflow text) or "assumed" (inferred standard industry practice).

Return your response strictly as a JSON object with a single key "checklist" whose value is an array of module objects, matching the exact format below:

{{"checklist": [
  {{
    "module": "Module Name",
    "items": [
      {{
        "id": "MOD-001",
        "text": "Check validation behavior with blank input fields.",
        "confidence": "confirmed"
      }}
    ]
  }}
]}}

Rules:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown fences like ```json. No introduction or extra text.
- Standardize all IDs to uppercase.
- Ensure "confidence" is strictly one of: "confirmed", "assumed".
"""

    logger.info("Running Checklist Agent")
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }

    # Validate and normalize checklist structure
    if isinstance(response, dict):
        checklist = response
    else:
        checklist = parse_json_response(response, prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if isinstance(checklist, dict) and checklist.get("success") is False:
        return checklist

    modules = parse_items(ChecklistModule, unwrap_list(checklist, "checklist"))
    return [m.model_dump() for m in modules]
