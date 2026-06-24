from utils import call_llm, parse_json_response
from utils import logger


def generate_checklist_agent(
    workflow: str,
    modules: dict,
    critical_workflows: list,
    high_risk_areas: list
):
    confirmed = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []

    prompt = f"""
You are an Enterprise Senior QA Engineer compiling a comprehensive, exploratory testing checklist for an application.

Application Workflow:
---
{workflow}
---

Confirmed Modules:
{confirmed}

Critical Workflows:
{critical_workflows}

High Risk Areas:
{high_risk_areas}

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

Return your response strictly as a JSON array of module objects matching the exact format below:

[
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
]

Rules:
- Return ONLY the raw JSON array. Do NOT wrap it in markdown fences like ```json. No introduction or extra text.
- Standardize all IDs to uppercase.
- Ensure "confidence" is strictly one of: "confirmed", "assumed".
"""

    logger.info("Running Checklist Agent")
    response = call_llm(prompt)

    if response is None:
      return {
        "success": False,
        "error": "Gemini API quota exceeded or no response returned."
    }

    # Validate and normalize checklist structure
    if isinstance(response, dict):
     checklist = response
    else:
     checklist = parse_json_response(response, prompt)

     if not isinstance(checklist, list):checklist = []
    

    normalized_checklist = []
    for module_obj in checklist:
        if not isinstance(module_obj, dict):
            continue
        
        module_name = str(module_obj.get("module", "")).strip()
        if not module_name:
            continue
            
        items_list = module_obj.get("items", [])
        if not isinstance(items_list, list):
            items_list = []
            
        normalized_items = []
        for idx, item in enumerate(items_list):
            if not isinstance(item, dict):
                continue
                
            text = str(item.get("text", "")).strip()
            if not text:
                continue
                
            # Normalize confidence
            confidence = str(item.get("confidence", "confirmed")).strip().lower()
            if confidence not in ["confirmed", "assumed"]:
                confidence = "confirmed"
                
            # Make sure id exists or generate a fallback
            item_id = str(item.get("id", "")).strip().upper()
            if not item_id:
                # Generate abbreviated fallback ID
                prefix = "".join([c for c in module_name if c.isalnum()])[:4].upper()
                if not prefix:
                    prefix = "TEST"
                item_id = f"{prefix}-{idx+1:03d}"
                
            normalized_items.append({
                "id": item_id,
                "text": text,
                "confidence": confidence
            })
            
        if normalized_items:
            normalized_checklist.append({
                "module": module_name,
                "items": normalized_items
            })
            
    return normalized_checklist