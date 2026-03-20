from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.rag import router as rag_router
from app.services.rag_service import RagService
from app.services.vector_store import InMemoryVectorStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.rag_store = InMemoryVectorStore()
    app.state.rag_service = RagService(app.state.rag_store)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform RAG Service",
        version="0.1.0",
        description="Ingest stub + TF-IDF index/query (in-memory).",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(rag_router, prefix="/api/v1/rag", tags=["rag"])
    return app


app = create_app()
