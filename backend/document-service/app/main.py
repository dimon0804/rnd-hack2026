from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.documents import router as documents_router
from app.db.session import Base, engine
from app.models import Document  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    async with httpx.AsyncClient(timeout=60.0) as client:
        app.state.http_client = client
        yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform Document Service",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.include_router(health_router)
    app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])

    return app


app = create_app()
