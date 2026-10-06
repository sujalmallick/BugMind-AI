"""
Default and fallback models must be ones the providers still serve. Groq
retired llama-3.3-70b-versatile / llama-3.1-8b-instant and Google retired the
Gemini 1.5 / 2.0 models; users who saved one of them are rerouted at call time.
"""

from types import SimpleNamespace

import litellm.exceptions as lx
import pytest

from config import DEFAULT_MODEL, DEFAULT_PROVIDER

RETIRED = {
    "groq": ["groq/llama-3.3-70b-versatile", "groq/llama-3.1-8b-instant"],
    "gemini": ["gemini/gemini-1.5-flash", "gemini/gemini-1.5-pro", "gemini/gemini-2.0-flash"],
}
FALLBACK = {"groq": DEFAULT_MODEL, "gemini": "gemini/gemini-2.5-flash"}


def test_default_model_is_current():
    assert (DEFAULT_PROVIDER, DEFAULT_MODEL) == ("groq", "groq/openai/gpt-oss-120b")


class RetiredModelCompletion:
    """Raises Groq/Gemini-style 404s for retired models, answers for anything else."""

    def __init__(self, retired):
        self.retired = set(retired)
        self.models = []

    def __call__(self, **kwargs):
        self.models.append(kwargs["model"])
        if kwargs["model"] in self.retired:
            raise lx.NotFoundError(
                message=f"The model `{kwargs['model']}` does not exist or you do not have access to it.",
                model=kwargs["model"], llm_provider=kwargs["model"].split("/")[0],
            )
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))], usage=None)


@pytest.mark.parametrize("provider, saved_model", [(p, m) for p, models in RETIRED.items() for m in models])
def test_saved_retired_model_falls_back_to_a_current_one(monkeypatch, provider, saved_model):
    import providers.litellm_provider as provider_module

    fake = RetiredModelCompletion(RETIRED[provider])
    monkeypatch.setattr(provider_module, "completion", fake)

    text, usage = provider_module.LiteLLMProvider(provider, saved_model, api_key="test-key").generate_with_usage("hi")

    assert text == "OK"
    assert fake.models == [saved_model, FALLBACK[provider]]
    assert usage["model"] == FALLBACK[provider]


def test_settings_default_for_new_users_is_current(db_session):
    from services.ai_settings_service import ai_settings_service

    assert ai_settings_service.get_model(db_session, user_id=12345) == DEFAULT_MODEL
    assert ai_settings_service.get_provider(db_session, user_id=12345) == DEFAULT_PROVIDER


def test_settings_endpoint_offers_the_default_and_rejects_retired_models(client, db_session):
    res = client.get("/ai-settings")
    assert res.status_code == 200
    assert res.json()["model"] == DEFAULT_MODEL

    for retired in RETIRED["groq"]:
        body = client.put("/ai-settings", json={"provider": "groq", "model": retired}).json()
        assert body.get("success") is False, retired


def test_settings_accept_the_new_default(client, db_session):
    """Guards the allow-list: the server must accept its own default model."""
    import main
    from auth.dependencies import get_current_user
    from database.models.user import User

    user = User(email="qa-settings@example.com", username="qa_settings", name="QA", password_hash="x")
    db_session.add(user)
    db_session.commit()
    main.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user.id)

    body = client.put("/ai-settings", json={"provider": "groq", "model": DEFAULT_MODEL}).json()
    assert body.get("success") is not False, body
    assert client.get("/ai-settings").json()["model"] == DEFAULT_MODEL
