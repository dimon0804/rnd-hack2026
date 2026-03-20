from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    upload_dir: str = Field(default="/data/uploads", alias="UPLOAD_DIR")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
