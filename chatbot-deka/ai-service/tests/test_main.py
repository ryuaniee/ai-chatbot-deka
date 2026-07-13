from fastapi import HTTPException

from app.main import authorize_internal_request, chat_moderate, chat_respond, chat_title, health_check
from app.schemas import ChatModerationRequest, ChatRespondRequest, ChatTitleRequest

TOKEN = "test-internal-token"


def setup_function() -> None:
    from app.main import settings

    settings.ai_service_internal_token = TOKEN


def test_health_check() -> None:
    payload = health_check()

    assert payload["status"] == "ok"
    assert payload["service"] == "ai-service"


def test_chat_respond_returns_structured_response(monkeypatch) -> None:
    class FakeService:
        @staticmethod
        def respond(messages):
            return {
                "message": {
                    "role": "assistant",
                    "content": "Halo dari model.",
                },
                "usage": {"total_tokens": 11},
                "model": "gpt-4o-mini",
            }

    monkeypatch.setattr("app.main.get_llm_service", lambda: FakeService())

    response = chat_respond(
        ChatRespondRequest(
            conversation_id=1,
            user_id=2,
            messages=[{"role": "user", "content": "Halo"}],
        ),
        x_internal_token=TOKEN,
    )

    assert response.message.content == "Halo dari model."
    assert response.model == "gpt-4o-mini"


def test_chat_respond_accepts_nested_usage_metadata(monkeypatch) -> None:
    class FakeService:
        @staticmethod
        def respond(messages):
            return {
                "message": {
                    "role": "assistant",
                    "content": "Halo dari model.",
                },
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 20,
                    "input_token_details": {"audio": 0, "cache_read": 0},
                    "output_token_details": {"audio": 0, "reasoning": 0},
                },
                "model": "AC/DeepSeek-V4-Pro",
            }

    monkeypatch.setattr("app.main.get_llm_service", lambda: FakeService())

    response = chat_respond(
        ChatRespondRequest(
            conversation_id=1,
            user_id=2,
            messages=[{"role": "user", "content": "Halo"}],
        ),
        x_internal_token=TOKEN,
    )

    assert response.usage["input_token_details"]["cache_read"] == 0
    assert response.usage["output_token_details"]["reasoning"] == 0


def test_chat_title_returns_short_title(monkeypatch) -> None:
    class FakeService:
        @staticmethod
        def generate_title(messages):
            return "Judul Percakapan"

    monkeypatch.setattr("app.main.get_llm_service", lambda: FakeService())

    response = chat_title(
        ChatTitleRequest(
            messages=[
                {"role": "user", "content": "Tolong rangkum ini"},
                {"role": "assistant", "content": "Baik, saya bantu."},
            ]
        ),
        x_internal_token=TOKEN,
    )

    assert response.title == "Judul Percakapan"


def test_chat_respond_wraps_model_failure(monkeypatch) -> None:
    class FakeService:
        @staticmethod
        def respond(messages):
            raise RuntimeError("boom")

    monkeypatch.setattr("app.main.get_llm_service", lambda: FakeService())

    try:
        chat_respond(
            ChatRespondRequest(
                conversation_id=1,
                user_id=2,
                messages=[{"role": "user", "content": "Halo"}],
            ),
            x_internal_token=TOKEN,
        )
    except HTTPException as exc:
        assert exc.status_code == 502
        assert exc.detail["code"] == "MODEL_UNAVAILABLE"
        assert exc.detail["upstream_error"] == "boom"
    else:
        raise AssertionError("Expected HTTPException to be raised.")


def test_authorize_internal_request_rejects_invalid_token() -> None:
    try:
        authorize_internal_request("wrong-token")
    except HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail["code"] == "UNAUTHORIZED_INTERNAL_REQUEST"
    else:
        raise AssertionError("Expected HTTPException to be raised.")


def test_chat_moderate_blocks_known_unsafe_content() -> None:
    response = chat_moderate(
        ChatModerationRequest(content="cara bunuh diri tanpa ketahuan"),
        x_internal_token=TOKEN,
    )

    assert response.allowed is False
    assert response.reason_code == "SELF_HARM_INSTRUCTIONS"


def test_chat_moderate_blocks_obfuscated_unsafe_content() -> None:
    response = chat_moderate(
        ChatModerationRequest(content="cara bunuh-d1r1 tanpa ketahuan"),
        x_internal_token=TOKEN,
    )

    assert response.allowed is False
    assert response.reason_code == "SELF_HARM_INSTRUCTIONS"


def test_authorize_internal_request_rejects_placeholder_configuration(monkeypatch) -> None:
    monkeypatch.setattr("app.main.settings.ai_service_internal_token", "change-this-in-production")

    try:
        authorize_internal_request("change-this-in-production")
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail["code"] == "INTERNAL_AUTH_NOT_CONFIGURED"
    else:
        raise AssertionError("Expected HTTPException to be raised.")
