"""
agents/test_plan_agent.py — AI Test Planning: splits a feature into ordered
test phases. Each phase is later approved by a person and only then turned
into test cases by the existing test case agent.
"""

from guardrails import Source, untrusted_block
from agents.context_blocks import environment_section, knowledge_section
from agents.output_schemas import MAX_PLAN_PHASES, TestPlanDraft
from utils import call_llm, parse_json_response

AGENT = "test_plan_agent"


def plan_tests_agent(scope: str, user_id=None, knowledge=None, environment=None):
    prompt = f"""
You are a QA Test Manager writing a phased test plan.

Feature / workflow to plan for (user-provided data, the source of truth):
{untrusted_block(scope, source=Source.USER, label="workflow", agent=AGENT)}
{knowledge_section(knowledge, AGENT)}{environment_section(environment, AGENT)}
Task: split testing of this feature into 2 to {MAX_PLAN_PHASES} ordered phases. Each phase covers one
coherent part of the flow (for example: account access, cart, payment, order follow-up), ordered so
that earlier phases unblock later ones. Phases must not overlap.

For every phase give:
- "title": short name.
- "objective": what this phase proves, one sentence.
- "scope": the part of the workflow this phase tests, written as steps (it is the input for test case
  generation, so be concrete and use the workflow's own words).
- "modules": modules involved. "risks": what is most likely to break.
- "entryCriteria" / "exitCriteria": when testing can start / is done.
- "priority": "High", "Medium" or "Low".
- "sources": where it comes from: "workflow", "doc:N" for documentation excerpt [N], or "assumed".

Rules:
- Use only what the workflow (and excerpts, if any) describe. Do not invent features, screens, limits or numbers.
- "gaps": up to 5 things the plan needs that the input doesn't say.

Return ONLY a single JSON object, no markdown fences:

{{
  "title": "Test plan name",
  "summary": "Two sentences on the approach.",
  "phases": [
    {{
      "title": "Account access",
      "objective": "Users can sign in and recover access.",
      "scope": "User opens the login page → enters email and password → lands on the dashboard",
      "modules": ["Authentication"],
      "risks": ["Wrong-password handling"],
      "entryCriteria": "Test accounts exist",
      "exitCriteria": "All High priority cases pass",
      "priority": "High",
      "sources": ["workflow"]
    }}
  ],
  "gaps": ["Password reset rules are not described"]
}}
"""
    response = call_llm(prompt, user_id=user_id, agent=AGENT, json_mode=True)
    if response is None:
        return {"success": False, "error": "AI Provider error (e.g. invalid API key, quota exceeded, or no response)."}
    data = response if isinstance(response, dict) else parse_json_response(
        response, prompt, user_id=user_id, agent=AGENT, json_mode=True)
    if isinstance(data, dict) and data.get("success") is False:
        return data
    return TestPlanDraft.model_validate(data).model_dump()
