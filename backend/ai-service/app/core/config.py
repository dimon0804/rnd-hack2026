from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mistral_api_key: str = Field(default="", alias="MISTRAL_API_KEY")
    # Базовый URL La Plateforme (см. https://docs.mistral.ai)
    mistral_base_url: str = Field(default="https://api.mistral.ai", alias="MISTRAL_BASE_URL")
    # Идентификатор модели для Chat Completions (алиасы *-latest или версии вроде mistral-small-2503)
    mistral_chat_model: str = Field(default="mistral-small-latest", alias="MISTRAL_CHAT_MODEL")
    request_timeout_seconds: float = Field(default=120.0, alias="AI_REQUEST_TIMEOUT_SECONDS")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
