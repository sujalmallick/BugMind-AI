from urllib import response

from utils import call_llm, parse_json_response
from utils import logger
from constants import TEST_CASE_STATUSES

def generate_test_cases_agent(
    workflow,
    modules,
    critical_workflows,
    high_risk_areas,
    observed_steps
):
    confirmed_mods = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []

    if observed_steps:
        formatted_steps = "\n".join(
            f"{i + 1}. {step}"
            for i, step in enumerate(observed_steps)
        )
        steps_section = f"""
Observed User Steps:
{formatted_steps}

Your execution steps for the test cases MUST be guided by these observed steps wherever applicable.
"""
    else:
        steps_section = """
No observed user steps were provided. 
Assume standard, logical execution steps required to navigate and complete actions.
"""

    prompt = f"""
You are a Lead QA Engineer generating production-ready manual test cases.

Application Workflow:
---
{workflow}
---

Confirmed Modules:
{", ".join(confirmed_mods)}

Critical Workflows:
{", ".join(critical_workflows)}

High Risk Areas:
{", ".join(high_risk_areas)}

{steps_section}

Task:
Generate a list of execution-ready manual test cases covering Functional, Negative, Edge Case, Security, and Regression categories.

For each test case, provide:
1. "module": The confirmed module name this test case belongs to.
2. "category": Strictly one of: "Functional", "Negative", "Edge Case", "Security", "Regression".
3. "description": A short, clear description of what is being tested (e.g., "Verify login form rejects email without '@' symbol").
4. "objective": The exact purpose of the test (e.g., "Ensure email format validation protects login endpoint").
5. "preconditions": Required state before starting the test (e.g., "User is on the login page, network is connected").
6. "steps": An array of clear, step-by-step user actions (e.g., ["Navigate to login", "Type 'invaliduser' in email", "Type 'password123' in password", "Click Login"]).
7. "inputData": Specific data inputs used in this test (e.g., "Email: invaliduser, Password: password123").
8. "expectedResult": Detailed description of the correct system reaction (e.g., "Validation warning displays: 'Invalid email format' and login is blocked").
9. "priority": Strictly one of: "High", "Medium", "Low".

Return your response strictly as a JSON array of test case objects matching the exact format below:

[
  {{
    "module": "Authentication",
    "category": "Functional",
    "description": "Verify login with valid credentials",
    "objective": "Verify successful login",
    "preconditions": "User account exists and is active",
    "steps": [
      "Open Application",
      "Navigate to Login page",
      "Enter valid email",
      "Enter valid password",
      "Click Login button"
    ],
    "inputData": "Valid Email, Valid Password",
    "expectedResult": "User is redirected to the dashboard page",
    "priority": "High"
  }}
]

Rules:
- Return ONLY the raw JSON array. Do NOT wrap it in markdown fences like ```json. Do NOT output intro/outro text.
- Prioritize testing critical user journeys and high-risk areas.
- category MUST be one of: "Functional", "Negative", "Edge Case", "Security", "Regression".
- priority MUST be one of: "High", "Medium", "Low".
"""

    logger.info("Running Test Case Agent")
    response = call_llm(prompt)

    if response is None:
     return {
        "success": False,
        "error": "Gemini API quota exceeded or no response returned."
    }
    # Validate and normalize test cases
    if isinstance(response, dict):
     test_cases = response
    else:
     test_cases = parse_json_response(response, prompt)

    if not isinstance(test_cases, list): test_cases = []
   

    valid_priorities = {"High", "Medium", "Low"}
    valid_categories = {"Functional", "Negative", "Edge Case", "Security", "Regression"}

    normalized_test_cases = []
    for tc in test_cases:
        if not isinstance(tc, dict):
            continue

        # Standard normalization & fallback assignment
        module_val = str(tc.get("module", "")).strip()
        if not module_val:
            # Fallback to first confirmed module or a generic test module
            module_val = confirmed_mods[0] if confirmed_mods else "General"

        category_val = str(tc.get("category", "Functional")).strip()
        # Normalization maps
        category_map = {
            "functional": "Functional",
            "negative": "Negative",
            "edge case": "Edge Case",
            "edgecase": "Edge Case",
            "security": "Security",
            "regression": "Regression",
        }
        category_val = category_map.get(category_val.lower(), "Functional")
        if category_val not in valid_categories:
            category_val = "Functional"

        priority_val = str(tc.get("priority", "Medium")).strip()
        priority_map = {
            "high": "High",
            "critical": "High",
            "p0": "High",
            "p1": "High",
            "medium": "Medium",
            "p2": "Medium",
            "low": "Low",
            "p3": "Low",
        }
        priority_val = priority_map.get(priority_val.lower(), "Medium")
        if priority_val not in valid_priorities:
            priority_val = "Medium"

        steps_val = tc.get("steps", [])
        if isinstance(steps_val, list):
            steps_val = [str(step).strip() for step in steps_val if step is not None]
        else:
            steps_val = [str(steps_val).strip()] if steps_val else []

        normalized_tc = {
            "module": module_val,
            "category": category_val,
            "description": str(tc.get("description", "Perform test case execution")).strip(),
            "objective": str(tc.get("objective", "Verify correct system response")).strip(),
            "preconditions": str(tc.get("preconditions", "None")).strip(),
            "steps": steps_val,
            "inputData": str(tc.get("inputData", "N/A")).strip(),
            "expectedResult": str(tc.get("expectedResult", "System responds correctly")).strip(),
            "priority": priority_val
        }
        normalized_test_cases.append(normalized_tc)

    # Post-process: assign ID and initial status (keeping original business logic intact)
    for index, test_case in enumerate(normalized_test_cases, start=1):
        test_case["id"] = f"TC-{index:03d}"
        test_case["status"] = TEST_CASE_STATUSES["NOT_EXECUTED"]

    return normalized_test_cases