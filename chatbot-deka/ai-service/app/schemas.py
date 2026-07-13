from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRespondRequest(BaseModel):
    conversation_id: int
    user_id: int
    messages: list[ChatMessage] = Field(min_length=1)


class AssistantMessage(BaseModel):
    role: str = "assistant"
    content: str = Field(min_length=1)


class ChatRespondResponse(BaseModel):
    message: AssistantMessage
    usage: dict[str, Any] | None = None
    model: str | None = None

    model_config = ConfigDict(extra="forbid")


class ChatTitleRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=2)


class ChatTitleResponse(BaseModel):
    title: str = Field(min_length=1, max_length=80)


class ChatModerationRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class ChatModerationResponse(BaseModel):
    allowed: bool
    reason_code: str | None = None
    message: str | None = None
