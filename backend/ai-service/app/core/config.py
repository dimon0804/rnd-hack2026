from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # mistral_sdk — официальный Python SDK (La Plateforme). openai_http — POST /v1/chat/completions (OpenAI-совместимо: хакатон, vLLM, часть прокси).
    llm_mode: Literal["mistral_sdk", "openai_http"] = Field(default="mistral_sdk", alias="LLM_MODE")

    mistral_api_key: str = Field(default="", alias="MISTRAL_API_KEY")
    # Базовый URL: La Plateforme или OpenAI-совместимый шлюз (без завершающего /)
    mistral_base_url: str = Field(default="https://api.mistral.ai", alias="MISTRAL_BASE_URL")
    # Идентификатор модели для чата (для openai_http — как на сервере, см. GET /api/v1/ai/models)
    mistral_chat_model: str = Field(default="mistral-small-latest", alias="MISTRAL_CHAT_MODEL")
    request_timeout_seconds: float = Field(default=120.0, alias="AI_REQUEST_TIMEOUT_SECONDS")

    # STT (OpenAI-совместимый POST /v1/audio/transcriptions), напр. hackai…:6640
    stt_base_url: str | None = Field(default=None, alias="STT_BASE_URL")
    stt_api_key: str = Field(default="", alias="STT_API_KEY")
    stt_model: str | None = Field(default=None, alias="STT_MODEL")
    stt_timeout_seconds: float = Field(default=180.0, alias="STT_TIMEOUT_SECONDS")
    stt_max_upload_mb: int = Field(default=25, ge=1, le=100, alias="STT_MAX_UPLOAD_MB")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
