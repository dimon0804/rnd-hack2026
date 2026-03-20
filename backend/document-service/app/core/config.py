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
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    postgres_user: str = Field(default="app", alias="POSTGRES_USER")
    postgres_password: str = Field(default="app_secret", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="ai_platform", alias="POSTGRES_DB")
    postgres_host: str = Field(default="postgres", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")

    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    upload_dir: str = Field(default="/data/uploads", alias="UPLOAD_DIR")
    max_upload_bytes: int = Field(default=50 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")

    rag_service_url: str = Field(
        default="http://rag-service:8003",
        alias="RAG_SERVICE_URL",
    )

    allow_anonymous_upload: bool = Field(default=False, alias="ALLOW_ANONYMOUS_UPLOAD")

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
