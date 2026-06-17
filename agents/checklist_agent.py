from utils import call_gemini


def generate_checklist_agent(

    workflow: str,

    modules: dict,

    critical_workflows: list,

    high_risk_areas: list

):

    prompt = f"""
You are a senior QA engineer specializing in exploratory testing.

Application Workflow:
{workflow}

Identified Modules:
{modules}

Critical Workflows:
{critical_workflows}

High Risk Areas:
{high_risk_areas}

Tasks:
1. Identify all modules involved.
2. Determine the critical user journeys.
3. Generate functional test scenarios.
4. Generate negative test scenarios.
5. Generate important edge cases.
6. Highlight high-risk areas requiring extra attention.

Return the response in the following format:

MODULE: Authentication
Functional:
- [ ] ...

Negative:
- [ ] ...

Edge Cases:
- [ ] ...

High Risk:
- ...

Use concise statements.
Do not explain why the test cases are important.
Keep the response under 30 checklist items.
"""

    return call_gemini(prompt)