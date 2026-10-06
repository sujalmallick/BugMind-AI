"""
P2c: answer grounding + hallucination checks for generated test cases, and
context-window optimization for the analysis prompts.
"""

import json
from types import SimpleNamespace

import pytest

from agents.grounding import ground_test_cases, limit_claims

WORKFLOW = "Shoppers add items to the cart, apply a coupon and pay by card at checkout."
EXCERPTS = [
    {"documentId": 7, "filename": "payments-spec.md", "heading": "Payments",
     "text": "Card payments above 10,000 INR require an OTP. Three wrong OTPs cancel the payment."},
    {"documentId": 7, "filename": "payments-spec.md", "heading": "Refunds",
     "text": "Refunds return money to the original card within 5 days."},
]


def case(description, expected="Payment succeeds", steps=("Open cart", "Pay by card"), sources=None):
    tc = {"description": description, "objective": "o", "preconditions": "p", "inputData": "d",
          "expectedResult": expected, "steps": list(steps)}
    if sources is not None:
        tc["sources"] = sources
    return tc


def ground(*cases, excerpts=EXCERPTS):
    return ground_test_cases(list(cases), WORKFLOW, None, excerpts)


# ── Grounding ────────────────────────────────────────────────────────────────


def test_workflow_claim_that_holds_is_grounded():
    [tc], summary = ground(case("Apply a coupon at checkout and pay by card", sources=["workflow"]))
    assert tc["grounding"] == {"status": "grounded", "sources": [{"type": "workflow"}], "notes": []}
    assert "sources" not in tc  # the raw claim is replaced by the verified result
    assert summary["grounded"] == 1


def test_valid_document_citation_resolves_to_the_document():
    [tc], _ = ground(case("Card payment above 10,000 INR asks for an OTP", expected="OTP is required",
                          sources=["doc:1"]))
    assert tc["grounding"]["status"] == "grounded"
    assert tc["grounding"]["sources"] == [
        {"type": "document", "documentId": 7, "filename": "payments-spec.md", "heading": "Payments"}]


def test_citation_to_a_missing_excerpt_is_a_hallucination():
    [tc], summary = ground(case("Wallet top-up limits", expected="Top-up blocked", sources=["doc:5"]))
    assert tc["grounding"]["status"] == "assumed"
    assert "doesn't exist" in tc["grounding"]["notes"][0]
    assert summary["invalidCitations"] == 1


def test_citation_that_does_not_support_the_case_is_flagged():
    [tc], _ = ground(case("Profile photo upload rejects GIF files", expected="Upload refused",
                          steps=["Open profile", "Upload GIF"], sources=["doc:2"]))
    assert tc["grounding"]["status"] == "assumed"
    assert "doesn't support it" in tc["grounding"]["notes"][0]


def test_invented_limits_are_flagged_even_when_the_topic_is_grounded():
    [tc], summary = ground(case("Coupon code at checkout accepts at most 12 characters",
                                expected="Codes longer than 12 characters are rejected", sources=["workflow"]))
    assert tc["grounding"]["status"] == "assumed"
    assert tc["grounding"]["notes"][0].startswith("Mentions 12")
    assert summary["unverifiedValues"] == 1


def test_limits_found_in_the_documents_are_fine_in_any_format():
    [tc], _ = ground(case("Pay ₹10,000 by card at checkout", expected="OTP prompt after 3 wrong attempts? no",
                          sources=["workflow", "doc:1"]))
    assert limit_claims("Pay ₹10,000 by card") == {"10000"}
    assert tc["grounding"]["status"] == "grounded"


def test_small_numbers_are_not_treated_as_limits():
    assert limit_claims("Add 1 item and 2 coupons to the cart") == set()


def test_honest_assumed_label_stays_assumed():
    [tc], _ = ground(case("Session expires after inactivity", sources=["assumed"]))
    assert tc["grounding"]["status"] == "assumed"
    assert "general QA practice" in tc["grounding"]["notes"][0]


def test_unlabeled_cases_are_checked_against_the_workflow():
    [supported, unrelated], _ = ground(case("Pay by card at checkout with a coupon"),
                                       case("Dark mode toggle persists", expected="Theme saved",
                                            steps=["Open settings", "Toggle theme"]))
    assert supported["grounding"]["status"] == "grounded"
    assert unrelated["grounding"]["status"] == "assumed"


def test_model_source_labels_are_normalized():
    from agents.output_schemas import GeneratedTestCase

    tc = GeneratedTestCase.model_validate(
        {"description": "x", "sources": ["Workflow", "[2]", "doc 3", "Document #4", "assumed", "junk"]})
    assert tc.sources == ["workflow", "doc:2", "doc:3", "doc:4", "assumed", "unrecognized"]
    assert "sources" not in GeneratedTestCase.model_validate({"description": "x"}).model_dump(exclude_none=True)


# ── End to end + persistence ─────────────────────────────────────────────────


def test_analysis_response_carries_verified_grounding(client, fake_llm, agent_router):
    test_cases = json.dumps({"test_cases": [
        {"module": "Checkout", "category": "Functional", "description": "Pay by card at checkout with a coupon",
         "steps": ["Add items to cart", "Apply coupon", "Pay by card"], "expectedResult": "Order placed",
         "sources": ["workflow"]},
        {"module": "Checkout", "category": "Negative", "description": "Coupon longer than 40 characters is rejected",
         "steps": ["Apply long coupon"], "expectedResult": "Error after 40 characters", "sources": ["doc:3"]},
    ]})
    fake_llm.responder = agent_router(
        module=json.dumps({"confirmed_modules": ["Checkout"]}),
        checklist=json.dumps({"checklist": [{"module": "Checkout", "items": [{"text": "Pay"}]}]}),
        test_cases=test_cases)

    body = client.post("/analyze-workflow", json={"workflow": WORKFLOW}).json()
    first, second = body["testCases"]
    assert first["grounding"]["status"] == "grounded"
    assert second["grounding"]["status"] == "assumed"
    assert any("doesn't exist" in n for n in second["grounding"]["notes"])  # hallucinated citation
    assert any("Mentions 40" in n for n in second["grounding"]["notes"])   # invented limit


def test_grounding_is_saved_and_client_tampering_is_sanitized(db_session):
    from database.models.project import Project
    from database.models.test_case import TestCase
    from database.models.user import User
    from database.models.workspace import Workspace
    from services.test_case_service import save_test_cases
    from test_workload_tool_guardrail import make

    make(db_session, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    make(db_session, Project, id=1, owner_id=1, name="Shop")
    ws = make(db_session, Workspace, project_id=1)
    db_session.commit()
    grounded = {"status": "grounded", "sources": [{"type": "workflow"}], "notes": []}
    tampered = {"status": "verified-by-admin", "sources": [], "notes": []}
    noisy = {"status": "assumed", "sources": [{"type": "document", "documentId": "7; DROP", "filename": "x" * 999,
                                               "extra": "<script>"}, "junk"], "notes": ["n" * 900] * 9}
    save_test_cases(db_session, 1, 1, [
        {"id": "TC-001", "description": "A", "grounding": grounded},
        {"id": "TC-002", "description": "B", "grounding": tampered},
        {"id": "TC-003", "description": "C", "grounding": noisy},
    ])
    rows = {r.test_case_id: r for r in db_session.query(TestCase).filter(TestCase.workspace_id == ws.id)}
    assert rows["TC-001"].grounding == grounded
    assert rows["TC-002"].grounding is None
    saved = rows["TC-003"].grounding
    assert saved["sources"] == [{"type": "document", "documentId": None, "filename": "x" * 255, "heading": None}]
    assert len(saved["notes"]) == 3 and all(len(n) == 300 for n in saved["notes"])


# ── Context window optimization ──────────────────────────────────────────────


def test_budget_shrinks_for_small_context_models(monkeypatch):
    import services.prompt_budget as pb

    large = pb.plan_budget("groq/openai/gpt-oss-120b", WORKFLOW)
    assert large.context_tokens == 131072 and large.knowledge_tokens == 1200 and large.fits

    monkeypatch.setattr(pb, "model_context_tokens", lambda model: 8192)
    small = pb.plan_budget("tiny/model", WORKFLOW)
    assert 0 < small.knowledge_tokens < 1200 and small.manual_cases_tokens < 800 and small.fits


def test_too_long_workflow_is_refused_before_any_model_call(client, fake_llm, monkeypatch):
    import services.prompt_budget as pb

    monkeypatch.setattr(pb, "model_context_tokens", lambda model: 6000)
    long_workflow = "Users browse the catalog and compare products. " * 80
    body = client.post("/analyze-workflow", json={"workflow": long_workflow}).json()
    assert body["success"] is False and body["code"] == "context_too_long"
    assert "too long for the selected AI model" in body["error"]
    assert fake_llm.calls == []


def test_manual_case_list_is_trimmed_to_its_token_budget():
    from agents.test_case_agent import _manual_test_cases_section

    cases = [{"module": "Auth", "description": f"Manual case number {i} about login lockout"} for i in range(40)]
    full = _manual_test_cases_section(cases)
    trimmed = _manual_test_cases_section(cases, token_budget=60)
    assert full.count("- [Auth]") == 40
    assert 0 < trimmed.count("- [Auth]") < 10


def test_excerpt_compression_keeps_relevant_sentences_in_order():
    from agents.coverage import keywords
    from services.knowledge_retrieval import compress_excerpt

    text = ("The company was founded in 2010. " * 20 + "Card payments need an OTP at checkout. "
            + "Our office has a cafe. " * 20 + "Refunds go back to the card.")
    out = compress_excerpt(text, keywords("card payment OTP checkout refund"), max_tokens=40)
    assert "Card payments need an OTP at checkout." in out and "Refunds go back to the card." in out
    assert "founded in 2010" not in out and "…" in out
    assert out.index("Card payments") < out.index("Refunds")


# ── Phase review regressions ─────────────────────────────────────────────────


def test_unknown_models_never_refuse_and_get_a_generous_window(monkeypatch):
    import services.prompt_budget as pb

    budget = pb.plan_budget("openrouter/google/gemma-4-31b-it:free", "Users log in. " * 3000)
    assert budget.context_known is False and budget.context_tokens == pb.UNKNOWN_CONTEXT_TOKENS
    assert budget.fits  # a guessed window must not refuse; the provider has the final say


def test_tiny_knowledge_budget_sends_no_excerpts(monkeypatch):
    import services.prompt_budget as pb

    monkeypatch.setattr(pb, "model_context_tokens", lambda model: 6400)
    assert pb.plan_budget("tiny", "Users log in and pay by card. " * 20).knowledge_tokens == 0


@pytest.mark.parametrize("sources", [["workflow", "doc:9"], ["workflow", "assumed"], ["workflow", "unrecognized"]])
def test_any_fake_citation_or_admitted_assumption_blocks_grounded(sources):
    [tc], _ = ground(case("Apply a coupon at checkout and pay by card", sources=sources))
    assert tc["grounding"]["status"] == "assumed"
    assert tc["grounding"]["notes"]


def test_honest_and_odd_source_labels_are_normalized_safely():
    from agents.output_schemas import _sources

    assert _sources(["General QA practice"]) == ["assumed"]
    assert _sources(["assumption based on QA best practices"]) == ["assumed"]
    assert _sources(["Observed step 4", "step 3"]) == ["workflow"]
    assert _sources(["PRD section 12"]) == ["unrecognized"]
    assert _sources(["doc 1, doc 2"]) == ["doc:1", "doc:2"]


def test_generic_overlap_is_not_evidence():
    login_cases = [case(f"Login with variant {i}", expected="Dashboard shown", steps=["Open login", "Submit"])
                   for i in range(4)]
    sql = case("Check SQL injection in login password field", expected="Request rejected",
               steps=["Open login", "Type SQL payload in password"], sources=["workflow"])
    cases, _ = ground_test_cases(login_cases + [sql], "Users log in with email and password.", None, [])
    assert cases[-1]["grounding"]["status"] == "assumed"


@pytest.mark.parametrize("text, claims", [
    ("Discount of 50% is applied", {"50"}),
    ("Discount of 15 percent is applied", {"15"}),
    ("Server errors 404 are logged", set()),
    ("TC-100 items are listed", set()),
    ("Order placed on 2024-01-05 user list", set()),
    ("Retries 5 retries then stops", {"5"}),
])
def test_limit_claim_extraction_edge_cases(text, claims):
    assert limit_claims(text) == claims


def test_boundary_values_decimals_and_ids():
    from agents.grounding import known_numbers

    wf = "Passwords must be 8 to 64 characters. Orders get IDs like ORD-50. Delivery costs $10.5."
    boundary = case("Password of 65 characters is rejected", expected="Error shown", sources=["workflow"])
    decimal = case("Delivery fee of $10.50 is shown", expected="Fee shown", sources=["workflow"])
    invented = case("Order note accepts 50 characters", expected="Saved", sources=["workflow"])
    cases, _ = ground_test_cases([boundary, decimal, invented], wf, None, [])
    notes = [c["grounding"]["notes"] for c in cases]
    assert not any(n.startswith("Mentions") for n in notes[0])   # 65 = 64 + 1: a boundary test
    assert not any(n.startswith("Mentions") for n in notes[1])   # $10.50 == $10.5
    assert any(n.startswith("Mentions 50") for n in notes[2])    # ORD-50 doesn't make "50 characters" real
    assert "50" not in known_numbers("Orders get IDs like ORD-50.")


def test_fill_in_cases_cannot_cite_documents_they_never_saw(fake_llm, monkeypatch):
    from graph import workflow_graph

    monkeypatch.setenv("COVERAGE_MAX_ROUNDS", "1")
    first = json.dumps({"test_cases": [{"module": "Checkout", "category": "Functional",
                                        "description": "Pay by card at checkout", "steps": ["a", "b"],
                                        "expectedResult": "Paid", "sources": ["workflow"]}]})
    fill = json.dumps({"test_cases": [{"module": "Checkout", "category": "Negative",
                                       "description": "Coupon rejected when expired at checkout",
                                       "steps": ["a", "b"], "expectedResult": "Rejected", "sources": ["doc:1"]}]})

    def respond(messages):
        prompt = messages[-1]["content"]
        if "Principal AI Engineer" in prompt:
            return json.dumps({"confirmed_modules": ["Checkout"]})
        if "exploratory testing checklist" in prompt:
            return json.dumps({"checklist": []})
        if "fill coverage gaps" in prompt:
            return fill
        return first

    fake_llm.responder = respond
    state = workflow_graph.invoke({"user_id": None, "workflow": WORKFLOW, "project_knowledge": EXCERPTS})
    filled = state["test_cases"][-1]
    assert filled["grounding"]["status"] == "assumed"
    assert any("never shown" in n for n in filled["grounding"]["notes"])


@pytest.mark.parametrize("bad", [
    {"status": "assumed", "sources": {"type": "workflow"}, "notes": []},
    {"status": "assumed", "sources": [], "notes": 5},
    {"status": "assumed", "sources": [], "notes": "hello"},
])
def test_malformed_client_grounding_never_crashes(bad):
    from services.test_case_service import sanitize_grounding

    assert sanitize_grounding(bad) == {"status": "assumed", "sources": [], "notes": []}


def test_editing_content_clears_a_stale_badge_but_status_changes_keep_it(db_session):
    from database.models.project import Project
    from database.models.test_case import TestCase
    from database.models.user import User
    from database.models.workspace import Workspace
    from services.test_case_service import update_test_case
    from test_workload_tool_guardrail import make

    make(db_session, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    make(db_session, Project, id=1, owner_id=1, name="Shop")
    ws = make(db_session, Workspace, project_id=1)
    tc = make(db_session, TestCase, workspace_id=ws.id, test_case_id="TC-001", description="Pay by card",
              grounding={"status": "grounded", "sources": [{"type": "workflow"}], "notes": []})
    db_session.commit()

    update_test_case(db_session, 1, tc.id, 1, {"status": "pass"})
    assert db_session.get(TestCase, tc.id).grounding is not None
    update_test_case(db_session, 1, tc.id, 1, {"description": "Pay by UPI"})
    assert db_session.get(TestCase, tc.id).grounding is None


def test_tiny_retrieval_budget_returns_early(monkeypatch):
    from services import knowledge_retrieval

    calls = []
    monkeypatch.setattr(knowledge_retrieval, "require_project_role", lambda *a, **k: calls.append(1))
    assert knowledge_retrieval.retrieve(None, 1, 1, "card payment otp", token_budget=50) == []


def test_focused_batches_are_not_penalized_for_sharing_their_topic():
    # A test plan phase about lockout: every case shares "login", "account", "lock".
    workflow = ("Login and account lockout: user logs in with email and password; after 5 failed login "
                "attempts the account locks for 15 minutes.")
    cases = [
        {"description": "Account locks after 5 consecutive failed login attempts", "objective": "",
         "preconditions": "Registered account", "expectedResult": "Account locks for 15 minutes",
         "steps": ["Enter a wrong password 5 times"], "sources": ["workflow"]},
        {"description": "Login during the lockout period is refused", "objective": "",
         "preconditions": "Account locked", "expectedResult": "Login is refused while the account is locked",
         "steps": ["Log in with the correct password"], "sources": ["workflow"]},
        {"description": "Successful login with email and password", "objective": "",
         "preconditions": "Registered account", "expectedResult": "User is logged in",
         "steps": ["Enter email and password"], "sources": ["workflow"]},
        {"description": "Account lock message hides whether the email exists", "objective": "",
         "preconditions": "Account locked", "expectedResult": "Generic message without disclosure",
         "steps": ["Log in with an unknown email"], "sources": ["assumed"]},
    ]
    graded, _ = ground_test_cases(cases, workflow)
    assert [tc["grounding"]["status"] for tc in graded] == ["grounded", "grounded", "grounded", "assumed"]


def test_topic_words_alone_still_do_not_ground_a_case():
    graded, _ = ground_test_cases(
        [case("Checkout shows a promotional banner carousel with seasonal offers", sources=["workflow"],
              expected="Banner rotates every few seconds", steps=("Open checkout", "Watch banner"))],
        WORKFLOW)
    assert graded[0]["grounding"]["status"] == "assumed"
