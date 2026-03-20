from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.rag import router as rag_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform RAG Service",
        version="0.1.0",
        description="Embeddings and retrieval (ingest stub).",
    )

    app.include_router(health_router)
    app.include_router(rag_router, prefix="/api/v1/rag", tags=["rag"])

    return app


app = create_app()
