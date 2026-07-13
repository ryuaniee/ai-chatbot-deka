import logging
from functools import lru_cache
from hmac import compare_digest

from fastapi import FastAPI, Header, HTTPException
from pydantic import ValidationError

from app.config import settings
from app.llm import LlmFallbackExhausted, LlmService
from app.moderation import ModerationService
from app.schemas import (
    ChatModerationRequest,
    ChatModerationResponse,
    ChatRespondRequest,
    ChatRespondResponse,
    ChatTitleRequest,
    ChatTitleResponse,
)

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)


@lru_cache
def get_llm_service() -> LlmService:
    return LlmService()


@lru_cache
def get_moderation_service() -> ModerationService:
    return ModerationService()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ai-service",
        "environment": settings.app_env,
    }


def authorize_internal_request(x_internal_token: str | None) -> None:
    configured_token = settings.ai_service_internal_token

    if (
        configured_token is None
        or configured_token == ''
        or configured_token == 'change-this-in-production'
    ):
        raise HTTPException(
            status_code=503,
            detail={
                "code": "INTERNAL_AUTH_NOT_CONFIGURED",
                "message": "Internal service authentication is not configured.",
            },
        )

    if x_internal_token is None or not compare_digest(
        x_internal_token,
        configured_token,
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED_INTERNAL_REQUEST",
                "message": "Invalid internal service token.",
            },
        )


def model_error_detail(message: str, exc: Exception) -> dict[str, object]:
    detail: dict[str, object] = {
        "code": "MODEL_UNAVAILABLE",
        "message": message,
    }

    if settings.app_env == "local":
        detail["upstream_error"] = str(exc)

        if isinstance(exc, LlmFallbackExhausted):
            detail["attempts"] = exc.attempts

    return detail


@app.post("/chat/respond", response_model=ChatRespondResponse)
def chat_respond(
    payload: ChatRespondRequest,
    x_internal_token: str | None = Header(default=None),
) -> ChatRespondResponse:
    authorize_internal_request(x_internal_token)

    try:
        return ChatRespondResponse.model_validate(
            get_llm_service().respond(payload.messages)
        )
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "MODEL_RESPONSE_INVALID",
                "message": str(exc),
            },
        ) from exc
    except Exception as exc:
        logger.exception("Assistant response generation failed.")
        raise HTTPException(
            status_code=502,
            detail=model_error_detail(
                "Unable to generate assistant response.",
                exc,
            ),
        ) from exc


@app.post("/chat/title", response_model=ChatTitleResponse)
def chat_title(
    payload: ChatTitleRequest,
    x_internal_token: str | None = Header(default=None),
) -> ChatTitleResponse:
    authorize_internal_request(x_internal_token)

    try:
        return ChatTitleResponse(title=get_llm_service().generate_title(payload.messages))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "MODEL_RESPONSE_INVALID",
                "message": str(exc),
            },
        ) from exc
    except Exception as exc:
        logger.exception("Conversation title generation failed.")
        raise HTTPException(
            status_code=502,
            detail=model_error_detail(
                "Unable to generate conversation title.",
                exc,
            ),
        ) from exc


@app.post("/chat/moderate", response_model=ChatModerationResponse)
def chat_moderate(
    payload: ChatModerationRequest,
    x_internal_token: str | None = Header(default=None),
) -> ChatModerationResponse:
    authorize_internal_request(x_internal_token)

    result = get_moderation_service().moderate(payload.content)

    return ChatModerationResponse(
        allowed=result.allowed,
        reason_code=result.reason_code,
        message=result.message,
    )
