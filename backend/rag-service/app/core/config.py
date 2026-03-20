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

    # Персистентные чанки RAG в PostgreSQL (TF-IDF в памяти пересобирается при старте)
    rag_enable_db: bool = Field(default=True, alias="RAG_ENABLE_DB")
    postgres_user: str = Field(default="app", alias="POSTGRES_USER")
    postgres_password: str = Field(default="app_secret", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="ai_platform", alias="POSTGRES_DB")
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
