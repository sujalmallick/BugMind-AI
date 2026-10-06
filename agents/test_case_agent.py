from utils import call_llm, parse_json_response
from utils import logger
from constants import TEST_CASE_STATUSES
from agents.output_schemas import GeneratedTestCase, parse_items, unwrap_list
from guardrails import Source, untrusted_block

AGENT = "test_case_agent"

def generate_test_cases_agent(
    workflow,
    modules,
    critical_workflows,
    high_risk_areas,
    observed_steps,
    user_id=None
):
    confirmed_mods = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []

    if observed_steps:
        if isinstance(observed_steps, str):
            steps_list = [s.strip() for s in observed_steps.split("\n") if s.strip()]
        elif isinstance(observed_steps, list):
            steps_list = [str(s).strip() for s in observed_steps if s and str(s).strip()]
        else:
            steps_list = []

        if steps_list:
            formatted_steps = "\n".join(
                f"{i + 1}. {step}"
                for i, step in enumerate(steps_list)
            )
            steps_section = f"""
Observed User Steps (user-provided data):
{untrusted_block(formatted_steps, source=Source.USER, label="observed_steps", agent=AGENT)}

Your execution steps for the test cases MUST be guided by these observed steps wherever applicable.
"""
        else:
            steps_section = """
No observed user steps were provided. 
Assume standard, logical execution steps required to navigate and complete actions.
"""
    else:
        steps_section = """
No observed user steps were provided. 
Assume standard, logical execution steps required to navigate and complete actions.
"""

    prompt = f"""
You are a Lead QA Engineer generating production-ready manual test cases.

Application Workflow (user-provided data):
{untrusted_block(workflow, source=Source.USER, label="workflow", agent=AGENT)}

Confirmed Modules (from the module agent):
{untrusted_block(", ".join(confirmed_mods), source=Source.LLM, label="confirmed_modules", agent=AGENT)}

Critical Workflows (from the module agent):
{untrusted_block(", ".join(critical_workflows), source=Source.LLM, label="critical_workflows", agent=AGENT)}

High Risk Areas (from the module agent):
{untrusted_block(", ".join(high_risk_areas), source=Source.LLM, label="high_risk_areas", agent=AGENT)}

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

Return your response strictly as a JSON object with a single key "test_cases" whose value is an array of test case objects, matching the exact format below:

{{"test_cases": [
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
]}}

Rules:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown fences like ```json. Do NOT output intro/outro text.
- Prioritize testing critical user journeys and high-risk areas.
- category MUST be one of: "Functional", "Negative", "Edge Case", "Security", "Regression".
- priority MUST be one of: "High", "Medium", "Low".
"""

    logger.info("Running Test Case Agent")
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }
    # Validate and normalize test cases
    if isinstance(response, dict):
        test_cases = response
    else:
        test_cases = parse_json_response(response, prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if isinstance(test_cases, dict) and test_cases.get("success") is False:
        return test_cases

    parsed = parse_items(
        GeneratedTestCase,
        unwrap_list(test_cases, "test_cases"),
        context={"default_module": confirmed_mods[0] if confirmed_mods else None},
    )

    # Post-process: assign ID and initial status (keeping original business logic intact)
    normalized_test_cases = []
    for index, tc in enumerate(parsed, start=1):
        test_case = tc.model_dump()
        test_case["id"] = f"TC-{index:03d}"
        test_case["status"] = TEST_CASE_STATUSES["NOT_EXECUTED"]
        normalized_test_cases.append(test_case)

    return normalized_test_cases
