"""
agents/e2e_script_agent.py — drafts an end-to-end script (structured steps,
see services/automation_actions.py) from a test case, for a person to review.

The model never sees the website, so locators are educated guesses from the
test case's wording: role / label / text locators are preferred because they
survive markup changes. It sees variable NAMES only, never secret values.
"""

import json

from guardrails import Source, untrusted_block
from services.automation_actions import ACTIONS, LOCATORS, MAX_STEPS
from utils import call_llm, parse_json_response

AGENT = "e2e_script_agent"


def draft_script_agent(test_case: dict, environment: dict, user_id=None):
    case_text = "\n".join([
        f"ID: {test_case.get('code')}",
        f"Description: {test_case.get('description')}",
        f"Preconditions: {test_case.get('preconditions') or 'None'}",
        "Steps:\n" + "\n".join(f"{i}. {s}" for i, s in enumerate(test_case.get("steps") or [], start=1)),
        f"Expected result: {test_case.get('expected_result')}",
    ])
    variables = [v["name"] for v in environment.get("variables") or []]
    env_text = json.dumps({
        "baseUrl": environment["baseUrl"],
        "allowedDomains": environment["allowedDomains"],
        "variables": variables,
    })
    prompt = f"""
You are a senior test automation engineer. Convert a manual test case into an end-to-end browser test
written as JSON steps (not code). A person reviews your draft before it ever runs.

Test case (stored project data):
{untrusted_block(case_text, source=Source.DATABASE, label="test_case", agent=AGENT)}

Target environment (the browser starts at baseUrl):
{untrusted_block(env_text, source=Source.DATABASE, label="environment", agent=AGENT)}

Allowed actions: {", ".join(sorted(ACTIONS))}.
- goto: "value" is a path such as "/login" (preferred) or a full URL on an allowed domain.
- click, hover, check, uncheck, expect_visible, expect_hidden: need "target".
- fill, select: "target" + "value". press: "value" is a key such as "Enter" (optional "target").
- expect_text: "target" + "value" + "match" ("contains" or "equals"). expect_url / expect_title: "value" + "match".
- wait: "value" in milliseconds (avoid; the runner already waits for elements). screenshot: optional "value" name.
Targets: {{"by": one of {", ".join(LOCATORS)}, "value": ..., "name": ... (only for role)}}.
Prefer role (with the accessible name, e.g. {{"by": "role", "value": "button", "name": "Sign in"}}), label or text.
Use css only when nothing else fits.

Rules:
- Follow the test case's steps in order and end with expect steps that check its expected result.
- For credentials or test data the environment defines, use "{{{{vars.NAME}}}}" with one of these names: {variables or "none"}.
  Never write real passwords or secrets. If a value is needed and no variable fits, use an obvious
  placeholder such as "test-user@example.com" and mention it in "notes".
- Do not invent pages, fields, messages or numbers the test case doesn't mention; note guesses in "notes".
- At most {MAX_STEPS} steps. Give every step a short "description".

Return ONLY a single JSON object, no markdown fences:

{{
  "name": "Short script name",
  "steps": [
    {{"action": "goto", "value": "/login", "description": "Open the login page"}},
    {{"action": "fill", "target": {{"by": "label", "value": "Email"}}, "value": "{{{{vars.USER_EMAIL}}}}", "description": "Enter the email"}},
    {{"action": "click", "target": {{"by": "role", "value": "button", "name": "Sign in"}}, "description": "Submit"}},
    {{"action": "expect_url", "value": "/dashboard", "match": "contains", "description": "Lands on the dashboard"}}
  ],
  "notes": ["The Sign in button label is a guess"]
}}
"""
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)
    if response is None:
        return {"success": False, "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."}
    data = response if isinstance(response, dict) else parse_json_response(
        response, prompt, user_id=user_id, agent=AGENT, json_mode=True)
    if isinstance(data, dict) and data.get("success") is False:
        return data
    if not isinstance(data, dict):
        data = {}
    notes = data.get("notes")
    return {
        "name": str(data.get("name") or "").strip()[:200],
        "steps": data.get("steps") if isinstance(data.get("steps"), list) else [],
        "notes": [str(n).strip()[:300] for n in notes if str(n).strip()][:5] if isinstance(notes, list) else [],
    }
