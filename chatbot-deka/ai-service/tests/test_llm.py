from types import SimpleNamespace

import httpx
from openai import APIConnectionError, AuthenticationError, InternalServerError

from app.llm import LlmFallbackExhausted, LlmService
from app.schemas import ChatMessage


def make_status_error(status_code: int, body: dict) -> InternalServerError:
    request = httpx.Request("POST", "http://localhost:20127/v1/chat/completions")
    response = httpx.Response(
        status_code=status_code,
        request=request,
        json=body,
    )
    return InternalServerError(
        "upstream failure",
        response=response,
        body=body,
    )


def make_auth_error() -> AuthenticationError:
    request = httpx.Request("POST", "http://localhost:20127/v1/chat/completions")
    response = httpx.Response(
        status_code=401,
        request=request,
        json={"error": {"message": "unauthorized"}},
    )
    return AuthenticationError(
        "unauthorized",
        response=response,
        body={"error": {"message": "unauthorized"}},
    )


def make_connection_error() -> APIConnectionError:
    return APIConnectionError(
        request=httpx.Request("POST", "http://localhost:20127/v1/chat/completions"),
    )


def test_llm_service_falls_back_to_secondary_model(monkeypatch) -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = ["fallback-model"]

    calls: list[str] = []

    class FakeModel:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def invoke(self, payload):
            calls.append(self.model_name)

            if self.model_name == "primary-model":
                raise make_status_error(
                    503,
                    {"error": {"message": "All accounts unavailable"}},
                )

            return SimpleNamespace(
                content="Halo dari fallback.",
                usage_metadata={"total_tokens": 9},
                response_metadata={"model_name": self.model_name},
            )

    monkeypatch.setattr(service, "_build_model", lambda model_name: FakeModel(model_name))

    result = service.respond([ChatMessage(role="user", content="Halo")])

    assert calls == ["primary-model", "fallback-model"]
    assert result["message"]["content"] == "Halo dari fallback."
    assert result["model"] == "fallback-model"


def test_llm_service_retries_fallback_on_connection_error(monkeypatch) -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = ["fallback-model"]

    calls: list[str] = []

    class FakeModel:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def invoke(self, payload):
            calls.append(self.model_name)

            if self.model_name == "primary-model":
                raise make_connection_error()

            return SimpleNamespace(
                content="Judul fallback",
                usage_metadata={"total_tokens": 3},
                response_metadata={"model_name": self.model_name},
            )

    monkeypatch.setattr(service, "_build_model", lambda model_name: FakeModel(model_name))

    title = service.generate_title(
        [
            ChatMessage(role="user", content="Tolong kasih judul"),
            ChatMessage(role="assistant", content="Siap"),
        ]
    )

    assert calls == ["primary-model", "fallback-model"]
    assert title == "Judul fallback"


def test_llm_service_does_not_fallback_on_auth_error(monkeypatch) -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = ["fallback-model"]

    calls: list[str] = []

    class FakeModel:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def invoke(self, payload):
            calls.append(self.model_name)
            raise make_auth_error()

    monkeypatch.setattr(service, "_build_model", lambda model_name: FakeModel(model_name))

    try:
        service.respond([ChatMessage(role="user", content="Halo")])
    except LlmFallbackExhausted as exc:
        assert str(exc) == "unauthorized"
        assert exc.attempts == [
            {
                "model": "primary-model",
                "error": "unauthorized",
            },
        ]
    else:
        raise AssertionError("Expected LlmFallbackExhausted to be raised.")

    assert calls == ["primary-model"]


def test_llm_service_reports_all_attempted_models(monkeypatch) -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = ["fallback-a", "fallback-b"]

    calls: list[str] = []

    class FakeModel:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def invoke(self, payload):
            calls.append(self.model_name)
            raise make_status_error(
                503,
                {"error": {"message": f"{self.model_name} unavailable"}},
            )

    monkeypatch.setattr(service, "_build_model", lambda model_name: FakeModel(model_name))

    try:
        service.respond([ChatMessage(role="user", content="Halo")])
    except LlmFallbackExhausted as exc:
        assert str(exc) == "upstream failure"
        assert exc.attempts == [
            {
                "model": "primary-model",
                "error": "upstream failure",
            },
            {
                "model": "fallback-a",
                "error": "upstream failure",
            },
            {
                "model": "fallback-b",
                "error": "upstream failure",
            },
        ]
    else:
        raise AssertionError("Expected fallback exhaustion exception to be raised.")

    assert calls == ["primary-model", "fallback-a", "fallback-b"]
