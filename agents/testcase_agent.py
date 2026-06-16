from utils import call_gemini


def generate_test_cases_agent(
    workflow: str,
    observed_steps: list[str] | None = None
):

    steps_section = ""

    if observed_steps:

        formatted_steps = "\n".join(
            f"{i + 1}. {step}"
            for i, step in enumerate(observed_steps)
        )

        steps_section = f"""
Observed User Steps:
{formatted_steps}

Use these exact steps as the basis for generating test cases.

Generate additional negative and edge case scenarios around these steps.
"""

    else:

        steps_section = """
No observed steps were provided.

Generate high-level test cases.
Clearly indicate where execution steps are assumed.
"""

    prompt = f"""
You are an experienced QA Engineer.

Application Workflow:
{workflow}

{steps_section}

Generate execution-ready manual test cases.

For each test case, use EXACTLY the following format:

Test Case ID:
Test Description:
Test Objective:
Preconditions:
Test Steps:
Input Data:
Expected Results:
Actual Results:
Test Environment:
Test Execution Status:
Priority:
Attachments:
Test Case Author:Sujal
Test Case Reviewer:
Notes:
Developer Remarks:
Solved:

Requirements:
- Generate functional, negative, and edge case scenarios.
- Prioritize important user journeys first.
- Leave the following fields blank:
    Actual Results
    Test Environment
    Test Execution Status
    Attachments
    Test Case Author
    Test Case Reviewer
    Notes
    Developer Remarks
    Solved
- Use concise language.
- Keep steps clear and actionable.
- Generate between 5 and 15 test cases.
"""

    return call_gemini(prompt)