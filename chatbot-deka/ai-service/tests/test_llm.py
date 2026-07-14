from types import SimpleNamespace

import httpx
from openai import APIConnectionError, AuthenticationError, InternalServerError, NotFoundError

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


def make_not_found_error(body: dict) -> NotFoundError:
    request = httpx.Request("POST", "http://localhost:20127/v1/chat/completions")
    response = httpx.Response(
        status_code=404,
        request=request,
        json=body,
    )
    return NotFoundError(
        "not found",
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

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            calls.append(model)

            if model == "primary-model":
                raise make_status_error(
                    503,
                    {"error": {"message": "All accounts unavailable"}},
                )

            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Halo dari fallback."))],
                usage=SimpleNamespace(model_dump=lambda: {"total_tokens": 9}),
                model=model,
            )

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )

    result = service.respond([ChatMessage(role="user", content="Halo")])

    assert calls == ["primary-model", "fallback-model"]
    assert result["message"]["content"] == "Halo dari fallback."
    assert result["model"] == "fallback-model"


def test_llm_service_retries_fallback_on_connection_error(monkeypatch) -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = ["fallback-model"]

    calls: list[str] = []

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            calls.append(model)

            if model == "primary-model":
                raise make_connection_error()

            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Judul fallback"))],
                usage=SimpleNamespace(model_dump=lambda: {"total_tokens": 3}),
                model=model,
            )

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )

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

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            calls.append(model)
            raise make_auth_error()

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )

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

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            calls.append(model)
            raise make_status_error(
                503,
                {"error": {"message": f"{model} unavailable"}},
            )

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )

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


def test_llm_service_extracts_output_text_from_responses_api_fallback() -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = []

    calls: list[str] = []

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            calls.append(f"chat:{model}")
            raise make_not_found_error(
                {"error": {"message": "chat completions not supported"}},
            )

    class FakeResponses:
        @staticmethod
        def create(*, model, input):
            calls.append(f"responses:{model}")
            return SimpleNamespace(
                output_text="Halo dari responses.",
                usage=SimpleNamespace(model_dump=lambda: {"total_tokens": 7}),
                model=model,
            )

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions()),
        responses=SimpleNamespace(create=FakeResponses.create),
    )

    result = service.respond([ChatMessage(role="user", content="Halo")])

    assert calls == ["chat:primary-model", "responses:primary-model"]
    assert result["message"]["content"] == "Halo dari responses."
    assert result["model"] == "primary-model"


def test_llm_service_extracts_text_from_content_parts() -> None:
    service = LlmService()
    service.primary_model = "primary-model"
    service.fallback_models = []

    class FakeCompletions:
        @staticmethod
        def create(*, model, messages):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=[
                                {"type": "output_text", "text": "Halo "},
                                {"type": "output_text", "text": "berbagian."},
                            ]
                        )
                    )
                ],
                usage=SimpleNamespace(model_dump=lambda: {"total_tokens": 5}),
                model=model,
            )

    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions()),
        responses=SimpleNamespace(create=lambda **kwargs: None),
    )

    result = service.respond([ChatMessage(role="user", content="Halo")])

    assert result["message"]["content"] == "Halo berbagian."
