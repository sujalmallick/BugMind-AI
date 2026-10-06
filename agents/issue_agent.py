from utils import logger
from utils import call_llm, parse_json_response
from guardrails import Source, untrusted_block

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

    response = call_llm(prompt, user_id=user_id, agent=AGENT)

    if response is None:
        return {
            "success": False,
            "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."
        }
    if isinstance(response, dict):
        result = response
    else:
        result = parse_json_response(response, prompt, user_id=user_id, agent=AGENT)

    if isinstance(result, dict) and result.get("success") is False:
        return result

    # Validate and normalize based on the conditional contract
    if not isinstance(result, dict):
        result = {}

    valid_levels = {"High", "Medium", "Low"}
    severity_priority_map = {
        "high": "High",
        "critical": "High",
        "p0": "High",
        "p1": "High",
        "medium": "Medium",
        "p2": "Medium",
        "low": "Low",
        "p3": "Low",
    }

    if is_failed_test_case:
        # Standard Bug Schema
        severity_val = str(result.get("severity", "Medium")).strip()
        severity_val = severity_priority_map.get(severity_val.lower(), "Medium")
        if severity_val not in valid_levels:
            severity_val = "Medium"

        priority_val = str(result.get("priority", "Medium")).strip()
        priority_val = severity_priority_map.get(priority_val.lower(), "Medium")
        if priority_val not in valid_levels:
            priority_val = "Medium"

        bug_type_val = str(result.get("bugType", "Functional")).strip()
        if not bug_type_val:
            bug_type_val = "Functional"

        title_val = str(result.get("title", "")).strip()
        if not title_val:
            # Generate a sensible default title
            title_val = f"Bug observed during: {observation[:60]}..." if observation else "Unspecified system bug"

        return {
            "reportType": "Bug",
            "title": title_val,
            "bugType": bug_type_val,
            "severity": severity_val,
            "priority": priority_val
        }
    else:
        # Standard Observation Schema
        severity_val = str(result.get("severity", "Medium")).strip()
        severity_val = severity_priority_map.get(severity_val.lower(), "Medium")
        if severity_val not in valid_levels:
            severity_val = "Medium"

        obs_type_val = str(result.get("observationType", "UX Improvement")).strip()
        if not obs_type_val:
            obs_type_val = "UX Improvement"

        suggested_action_val = str(result.get("suggestedAction", "")).strip()
        if not suggested_action_val:
            suggested_action_val = "No suggested action provided."

        return {
            "reportType": "Observation",
            "observationType": obs_type_val,
            "severity": severity_val,
            "suggestedAction": suggested_action_val
        }