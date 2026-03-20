from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.auth import router as auth_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.db.session import Base, engine
    from app.models import RefreshToken, User  # noqa: F401 — регистрация таблиц

    Base.metadata.create_all(bind=engine)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform Auth Service",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

    return app


app = create_app()
