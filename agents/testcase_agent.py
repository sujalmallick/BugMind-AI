from utils import call_gemini
import json

def generate_test_cases_agent(
    workflow,
    modules,
    critical_workflows,
    high_risk_areas,
    observed_steps
):

    if observed_steps:

        formatted_steps = "\n".join(
            f"{i + 1}. {step}"
            for i, step in enumerate(observed_steps)
        )

        steps_section = f"""
Observed User Steps:
{formatted_steps}
"""

    else:

        steps_section = """
No observed steps were provided.

Assume reasonable execution steps wherever necessary.
"""

    prompt = f"""
You are a Senior QA Engineer.

Application Workflow:
{workflow}

Confirmed Modules:
{", ".join(modules.get("confirmed_modules", []))}

Critical Workflows:
{", ".join(critical_workflows)}

High Risk Areas:
{", ".join(high_risk_areas)}

{steps_section}

Generate manual test cases.

Return ONLY valid JSON.

Format:

[
    {{
        "module":"",
        "type":"",
        "description":"",
        "objective":"",
        "preconditions":"",
        "steps":[
            ""
        ],
        "input_data":"",
        "expected_result":"",
        "priority":""
    }}
]

Rules:

- Cover every confirmed module.
- Generate functional, negative and edge cases.
- Do not return markdown.
- Do not explain anything.
- Return only JSON.
"""

    response = call_gemini(prompt)
    try:
        cleaned = (
            response
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )
        return json.loads(cleaned)
    except Exception:
        return{
            "raw_response": response,
        }
