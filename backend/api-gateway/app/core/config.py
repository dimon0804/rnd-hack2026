from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    api_gateway_host: str = Field(default="0.0.0.0", alias="API_GATEWAY_HOST")
    api_gateway_port: int = Field(default=8000, alias="API_GATEWAY_PORT")

    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost",
        alias="CORS_ORIGINS",
    )
    rate_limit_per_minute: int = Field(default=120, alias="RATE_LIMIT_PER_MINUTE")

    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")

    auth_service_url: str = Field(
        default="http://auth-service:8001",
        alias="AUTH_SERVICE_URL",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def strip_origins(cls, v: str | list[str]) -> str | list[str]:
        if isinstance(v, str):
            return v.strip()
        return v

    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins
        if isinstance(raw, str):
            return [o.strip() for o in raw.split(",") if o.strip()]
        return list(raw)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
