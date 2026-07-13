from dataclasses import dataclass
import re
from typing import Any

from openai import OpenAI

from app.config import settings


@dataclass(frozen=True)
class ModerationResult:
    allowed: bool
    reason_code: str | None = None
    message: str | None = None


class ModerationService:
    BLOCK_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
        (
            "SELF_HARM_INSTRUCTIONS",
            re.compile(
                r"\b("
                r"suicide|kill\s*myself|bunuh\s*diri|self\s*harm|overdose|gantung\s*diri|"
                r"sayat\s*nadi|lompat\s*dari|akhiri\s*hidup"
                r")\b",
                re.IGNORECASE,
            ),
            "Message blocked by safety policy.",
        ),
        (
            "VIOLENT_WRONGDOING_INSTRUCTIONS",
            re.compile(
                r"\b("
                r"make\s*a\s*bomb|bikin\s*bom|cara\s*membunuh|how\s*to\s*murder|"
                r"racun(?!\s*makanan)|merakit\s*peledak|firearm\s*ghost\s*gun"
                r")\b",
                re.IGNORECASE,
            ),
            "Message blocked by safety policy.",
        ),
    )

    def __init__(self) -> None:
        self.client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        ) if settings.openai_api_key and settings.moderation_mode == "provider" else None

    def moderate(self, content: str) -> ModerationResult:
        normalized = self._normalize(content)

        local_result = self._check_local_rules(normalized)
        if local_result is not None:
            return local_result

        if settings.moderation_mode == "local_only":
            return ModerationResult(allowed=True)

        if self.client is None:
            return ModerationResult(
                allowed=False,
                reason_code="MODERATION_UNAVAILABLE",
                message="Moderation service is not configured.",
            )

        result = self.client.moderations.create(
            model=settings.moderation_model,
            input=content,
        )
        categories = result.results[0].categories
        flagged = bool(result.results[0].flagged)

        if not flagged:
            return ModerationResult(allowed=True)

        reason_code = self._reason_from_categories(categories.model_dump())

        return ModerationResult(
            allowed=False,
            reason_code=reason_code,
            message="Message blocked by safety policy.",
        )

    def _check_local_rules(self, normalized: str) -> ModerationResult | None:
        for reason_code, pattern, message in self.BLOCK_RULES:
            if pattern.search(normalized):
                return ModerationResult(
                    allowed=False,
                    reason_code=reason_code,
                    message=message,
                )

        return None

    @staticmethod
    def _normalize(content: str) -> str:
        normalized = content.casefold()
        normalized = normalized.replace("@", "a").replace("4", "a").replace("1", "i").replace("3", "e")
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()

        return normalized

    @staticmethod
    def _reason_from_categories(categories: dict[str, Any]) -> str:
        if categories.get("self-harm") or categories.get("self-harm/instructions"):
            return "SELF_HARM_INSTRUCTIONS"

        if categories.get("violence") or categories.get("violence/graphic"):
            return "VIOLENT_WRONGDOING_INSTRUCTIONS"

        return "MODERATION_BLOCKED"
