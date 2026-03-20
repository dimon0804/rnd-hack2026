import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.rag import router as rag_router
from app.core.config import settings
from app.db.chunk_repository import ChunkRepository, load_persisted_into_store
from app.services.rag_service import RagService
from app.services.vector_store import InMemoryVectorStore

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = InMemoryVectorStore()
    chunk_repo: ChunkRepository | None = None
    if settings.rag_enable_db:
        chunk_repo = ChunkRepository(settings)
        chunk_repo.init_schema()
        n = load_persisted_into_store(store, chunk_repo)
        logger.info("RAG: loaded %s chunks from PostgreSQL", n)
    else:
        logger.warning("RAG_ENABLE_DB=false: chunks are not persisted across restarts")

    app.state.rag_store = store
    app.state.rag_service = RagService(store, chunk_repo)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform RAG Service",
        version="0.1.0",
        description="Ingest, TF-IDF query; чанки в PostgreSQL, матрица в памяти.",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(rag_router, prefix="/api/v1/rag", tags=["rag"])
    return app


app = create_app()
