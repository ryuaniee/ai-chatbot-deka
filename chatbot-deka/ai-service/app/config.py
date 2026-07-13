from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Chatbot Deka AI Service"
    app_env: str = "local"
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    langchain_model: str = "gpt-4o-mini"
    langchain_fallback_models: str = ""
    openai_timeout_seconds: float = 30.0
    ai_service_internal_token: str | None = None
    moderation_model: str = "omni-moderation-latest"
    moderation_mode: str = "provider"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def langchain_fallback_models_list(self) -> list[str]:
        return [
            model.strip()
            for model in self.langchain_fallback_models.split(",")
            if model.strip()
        ]


settings = Settings()
