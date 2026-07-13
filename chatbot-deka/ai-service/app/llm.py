from collections.abc import Sequence

from openai import APIConnectionError, APIStatusError, APITimeoutError
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.prompts import SYSTEM_PROMPT, TITLE_PROMPT
from app.schemas import ChatMessage


class LlmFallbackExhausted(Exception):
    def __init__(self, attempts: list[dict[str, str]], last_exception: Exception) -> None:
        self.attempts = attempts
        self.last_exception = last_exception
        super().__init__(str(last_exception))


class LlmService:
    def __init__(self) -> None:
        self.primary_model = settings.langchain_model
        self.fallback_models = settings.langchain_fallback_models_list

    def respond(self, messages: Sequence[ChatMessage]) -> dict:
        payload = [SystemMessage(content=SYSTEM_PROMPT), *self._to_langchain_messages(messages)]
        response, model_name = self._invoke_with_fallback(payload)

        content = self._extract_content(response)
        return {
            "message": {
                "role": "assistant",
                "content": content,
            },
            "usage": response.usage_metadata,
            "model": response.response_metadata.get("model_name", model_name),
        }

    def generate_title(self, messages: Sequence[ChatMessage]) -> str:
        payload = [
            SystemMessage(content=TITLE_PROMPT),
            *self._to_langchain_messages(messages[:2]),
        ]
        response, _ = self._invoke_with_fallback(payload)

        return self._extract_content(response)[:80]

    def _invoke_with_fallback(
        self,
        payload: Sequence[BaseMessage],
    ) -> tuple[AIMessage, str]:
        attempted_models = [self.primary_model, *self.fallback_models]
        last_exception: Exception | None = None
        attempt_details: list[dict[str, str]] = []

        for index, model_name in enumerate(attempted_models):
            try:
                response = self._build_model(model_name).invoke(payload)
                return response, model_name
            except Exception as exc:
                last_exception = exc
                attempt_details.append({
                    "model": model_name,
                    "error": str(exc),
                })

                if index == len(attempted_models) - 1 or not self._should_try_fallback(exc):
                    raise LlmFallbackExhausted(attempt_details, exc) from exc

        if last_exception is not None:
            raise LlmFallbackExhausted(attempt_details, last_exception)

        raise RuntimeError("No model attempts were made.")

    @staticmethod
    def _should_try_fallback(exc: Exception) -> bool:
        if isinstance(exc, (APIConnectionError, APITimeoutError)):
            return True

        if isinstance(exc, APIStatusError):
            return exc.status_code in {408, 409, 425, 429, 500, 502, 503, 504}

        return False

    @staticmethod
    def _build_model(model_name: str) -> ChatOpenAI:
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=settings.openai_timeout_seconds,
        )

    @staticmethod
    def _to_langchain_messages(messages: Sequence[ChatMessage]) -> list[BaseMessage]:
        result: list[BaseMessage] = []

        for message in messages:
            if message.role == "assistant":
                result.append(AIMessage(content=message.content))
                continue

            result.append(HumanMessage(content=message.content))

        return result

    @staticmethod
    def _extract_content(response: AIMessage) -> str:
        if isinstance(response.content, str):
            content = response.content.strip()
        else:
            content = "".join(
                part.get("text", "")
                for part in response.content
                if isinstance(part, dict)
            ).strip()

        if not content:
            raise ValueError("Model returned empty content.")

        return content
