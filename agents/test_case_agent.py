from utils import call_llm, parse_json_response
from utils import logger
from constants import TEST_CASE_STATUSES
from agents.coverage import is_near_duplicate
from agents.output_schemas import GeneratedTestCase, parse_items, unwrap_list
from guardrails import Source, untrusted_block

AGENT = "test_case_agent"

FIELD_SPEC = """For each test case, provide:
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

{"test_cases": [
  {
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
  }
]}

"""


def _parse_test_cases(response, prompt, user_id, confirmed_mods):
    """LLM response → normalized test case dicts (no id/status), or an error dict."""
    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }
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
    return [tc.model_dump() for tc in parsed]


MAX_MANUAL_CASE_CHARS = 160


def _manual_test_cases_section(manual_test_cases) -> str:
    """Prompt block listing the project's manual test cases; empty when there are none."""
    lines = [
        f"- [{tc.get('module', '')}] {str(tc.get('description', ''))[:MAX_MANUAL_CASE_CHARS]}"
        for tc in manual_test_cases or []
        if tc.get("description")
    ]
    if not lines:
        return ""
    return f"""
Manual test cases that already exist in this project (user-provided data). Do NOT generate
test cases that duplicate these; spend the suite on what they do not cover:
{untrusted_block(chr(10).join(lines), source=Source.USER, label="manual_test_cases", agent=AGENT)}
"""


def number_test_cases(test_cases: list[dict], start: int = 1) -> list[dict]:
    """Assign sequential TC-### ids and the initial status."""
    for index, test_case in enumerate(test_cases, start=start):
        test_case["id"] = f"TC-{index:03d}"
        test_case["status"] = TEST_CASE_STATUSES["NOT_EXECUTED"]
    return test_cases

def generate_test_cases_agent(
    workflow,
    modules,
    critical_workflows,
    high_risk_areas,
    observed_steps,
    user_id=None,
    manual_test_cases=None,
):
    """
    manual_test_cases: the project's hand-written test cases (server-loaded). They are
    shown to the model as already covered, and generated near-duplicates are dropped.
    """
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
{_manual_test_cases_section(manual_test_cases)}
Task:
Generate a list of execution-ready manual test cases covering Functional, Negative, Edge Case, Security, and Regression categories.

{FIELD_SPEC}Rules:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown fences like ```json. Do NOT output intro/outro text.
- Prioritize testing critical user journeys and high-risk areas.
- category MUST be one of: "Functional", "Negative", "Edge Case", "Security", "Regression".
- priority MUST be one of: "High", "Medium", "Low".
"""

    logger.info("Running Test Case Agent")
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)

    test_cases = _parse_test_cases(response, prompt, user_id, confirmed_mods)
    if isinstance(test_cases, dict):
        return test_cases

    # Deterministic backstop: never return a near-copy of a manual test case.
    manual_descriptions = [tc.get("description", "") for tc in manual_test_cases or []]
    if manual_descriptions:
        test_cases = [
            tc for tc in test_cases
            if not is_near_duplicate(tc.get("description", ""), manual_descriptions)
        ]

    # Post-process: assign ID and initial status (keeping original business logic intact)
    return number_test_cases(test_cases)


def fill_coverage_gaps_agent(workflow, modules, gaps, existing_test_cases, user_id=None):
    """
    One targeted call that writes test cases ONLY for the coverage gaps.
    Returns normalized test case dicts without ids, or an error dict.
    """
    confirmed_mods = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []
    gap_lines = "\n".join(f"- {g['kind'].replace('_', ' ')}: {g['target']}" for g in gaps)
    existing = "\n".join(f"- {tc.get('description', '')}" for tc in existing_test_cases or [])

    prompt = f"""
You are a Lead QA Engineer asked to fill coverage gaps in an existing manual test suite.

Application Workflow (user-provided data):
{untrusted_block(workflow, source=Source.USER, label="workflow", agent=AGENT)}

Confirmed Modules (from the module agent):
{untrusted_block(", ".join(confirmed_mods), source=Source.LLM, label="confirmed_modules", agent=AGENT)}

Coverage gaps found by an automated check. Nothing in the suite covers these yet:
{untrusted_block(gap_lines, source=Source.LLM, label="coverage_gaps", agent=AGENT)}

Existing test cases (do NOT repeat these):
{untrusted_block(existing, source=Source.LLM, label="existing_test_cases", agent=AGENT)}

Task:
Write 1 to 2 new test cases for EACH gap above, and nothing else. A "category" gap means
the suite has no test case of that category yet. Mention the gap's subject explicitly in
the description or steps.

{FIELD_SPEC}
Rules:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown fences like ```json. Do NOT output intro/outro text.
- category MUST be one of: "Functional", "Negative", "Edge Case", "Security", "Regression".
- priority MUST be one of: "High", "Medium", "Low".
"""

    logger.info(f"Running Test Case Agent (coverage fill, {len(gaps)} gaps)")
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)
    return _parse_test_cases(response, prompt, user_id, confirmed_mods)
