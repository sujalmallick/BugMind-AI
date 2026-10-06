from utils import logger
from utils import call_llm, parse_json_response
from guardrails import Source, untrusted_block
from agents.output_schemas import BugReport, ObservationReport

AGENT = "issue_agent"

try:
    from langsmith import traceable
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@traceable(name="Issue Analysis Agent", run_type="chain")
def analyze_issue_agent(
    workflow,
    observation,
    expected_result,
    actual_result,
    failed_test_case,
    user_id=None,
):
    # Enforce failed_test_case as a boolean
    is_failed_test_case = bool(failed_test_case)

    if is_failed_test_case:
        expected_json_structure = """
{
    "reportType": "Bug",
    "title": "A short, descriptive, professional bug title",
    "bugType": "Functional / UI / Security / Crash / Performance / Data Loss",
    "severity": "High / Medium / Low",
    "priority": "High / Medium / Low"
}
"""
    else:
        expected_json_structure = """
{
    "reportType": "Observation",
    "observationType": "UX Improvement / Performance Suggestion / Missing Requirement",
    "severity": "High / Medium / Low",
    "suggestedAction": "Detailed recommended action to address this observation"
}
"""

    prompt = f"""
You are a Lead QA Engineer performing root-cause analysis on an application issue report.

Application Workflow (user-provided data):
{untrusted_block(workflow, source=Source.USER, label="workflow", agent=AGENT)}

Observation (user-provided data):
{untrusted_block(observation, source=Source.USER, label="observation", agent=AGENT)}

Expected Result (user-provided data):
{untrusted_block(expected_result, source=Source.USER, label="expected_result", agent=AGENT)}

Actual Result (user-provided data):
{untrusted_block(actual_result, source=Source.USER, label="actual_result", agent=AGENT)}

Is Failed Test Case (True = Bug, False = Observation):
{is_failed_test_case}

Task:
Perform a deep analysis of the issue. Depending on whether this is a direct test case failure (Bug) or a general user observation, you MUST return a valid JSON object matching the exact structure below.

Expected JSON Format:
{expected_json_structure}

Rules:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown fences like ```json. Do NOT include any explanations or intro text.
- Use the exact field names and casing shown in the expected format. Do NOT use snake_case keys.
- Under severity and priority, strictly return one of: "High", "Medium", "Low".
"""

    logger.info("Running Issue Analysis Agent")

    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }
    if isinstance(response, dict):
        result = response
    else:
        result = parse_json_response(response, prompt, user_id=user_id, agent=AGENT, json_mode=True)

    if isinstance(result, dict) and result.get("success") is False:
        return result

    # Validate and normalize based on the conditional contract
    if is_failed_test_case:
        return BugReport.model_validate(result, context={"observation": observation}).model_dump()
    return ObservationReport.model_validate(result).model_dump()
