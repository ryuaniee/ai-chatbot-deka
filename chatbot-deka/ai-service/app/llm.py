from collections.abc import Sequence
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

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
        self.client = self._build_client()

    def respond(self, messages: Sequence[ChatMessage]) -> dict[str, Any]:
        payload = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *self._to_openai_messages(messages),
        ]
        response, model_name = self._invoke_with_fallback(payload)

        return {
            "message": {
                "role": "assistant",
                "content": self._extract_content(response),
            },
            "usage": self._extract_usage(response),
            "model": getattr(response, "model", model_name),
        }

    def generate_title(self, messages: Sequence[ChatMessage]) -> str:
        payload = [
            {"role": "system", "content": TITLE_PROMPT},
            *self._to_openai_messages(messages[:2]),
        ]
        response, _ = self._invoke_with_fallback(payload)

        return self._extract_content(response)[:80]

    def _invoke_with_fallback(
        self,
        payload: Sequence[dict[str, str]],
    ) -> tuple[Any, str]:
        attempted_models = [self.primary_model, *self.fallback_models]
        last_exception: Exception | None = None
        attempt_details: list[dict[str, str]] = []

        for index, model_name in enumerate(attempted_models):
            try:
                response = self._invoke_model(model_name, payload)
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
    def _build_client() -> OpenAI:
        return OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=settings.openai_timeout_seconds,
        )

    def _invoke_model(self, model_name: str, payload: Sequence[dict[str, str]]) -> Any:
        try:
            return self.client.chat.completions.create(
                model=model_name,
                messages=list(payload),
            )
        except APIStatusError as exc:
            if not self._should_try_responses_api(exc):
                raise

        return self.client.responses.create(
            model=model_name,
            input=list(payload),
        )

    @staticmethod
    def _should_try_responses_api(exc: APIStatusError) -> bool:
        if exc.status_code not in {400, 404, 405, 415, 501}:
            return False

        message = str(exc).lower()

        return (
            "responses" in message
            or "chat" in message
            or "completion" in message
            or "not found" in message
            or "unsupported" in message
        )

    @staticmethod
    def _to_openai_messages(messages: Sequence[ChatMessage]) -> list[dict[str, str]]:
        result: list[dict[str, str]] = []

        for message in messages:
            result.append({
                "role": message.role,
                "content": message.content,
            })

        return result

    @staticmethod
    def _extract_content(response: Any) -> str:
        output_text = getattr(response, "output_text", None)

        if isinstance(output_text, str) and output_text.strip() != "":
            return output_text.strip()

        choices = getattr(response, "choices", None) or []

        if choices:
            content = getattr(choices[0].message, "content", None)

            extracted = LlmService._normalize_content(content)

            if extracted != "":
                return extracted

        output = getattr(response, "output", None) or []

        for item in output:
            for part in getattr(item, "content", None) or []:
                extracted = LlmService._normalize_content_part(part)

                if extracted != "":
                    return extracted

        raise ValueError("Model returned empty content.")

    @staticmethod
    def _normalize_content(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts = [
                LlmService._normalize_content_part(part)
                for part in content
            ]

            return "".join(part for part in parts if part).strip()

        return ""

    @staticmethod
    def _normalize_content_part(part: Any) -> str:
        text = getattr(part, "text", None)

        if isinstance(text, str):
            return text

        if isinstance(part, dict):
            part_text = part.get("text")

            if isinstance(part_text, str):
                return part_text

        return ""

    @staticmethod
    def _extract_usage(response: Any) -> dict[str, Any] | None:
        usage = getattr(response, "usage", None)

        if usage is None:
            return None

        if hasattr(usage, "model_dump"):
            return usage.model_dump()

        if isinstance(usage, dict):
            return usage

        return None
