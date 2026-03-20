import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.rag import router as rag_router
from app.core.config import settings
from app.db.chunk_repository import ChunkRepository, load_persisted_into_store
from app.services.embeddings_client import embed_texts_openai_compatible
from app.services.rag_service import RagService
from app.services.vector_store import InMemoryVectorStore

logger = logging.getLogger(__name__)


def _make_embed_fn():
    base = (settings.embedder_base_url or "").strip()
    if not base:
        return None

    def embed(texts: list[str]) -> list[list[float]]:
        return embed_texts_openai_compatible(
            texts,
            base_url=base,
            model=settings.embedder_model,
            timeout=settings.embedder_timeout_seconds,
            batch_size=settings.embedder_batch_size,
        )

    return embed


def _embed_fn_or_none_after_probe():
    """Если URL задан, но хост не резолвится / нет TCP — не падаем при старте, только TF-IDF."""
    embed_fn = _make_embed_fn()
    if embed_fn is None:
        return None
    probe_timeout = min(15.0, float(settings.embedder_timeout_seconds))
    try:
        embed_texts_openai_compatible(
            ["."],
            base_url=(settings.embedder_base_url or "").strip(),
            model=settings.embedder_model,
            timeout=probe_timeout,
            batch_size=1,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "RAG: эмбеддер не отвечает (%s). Используем TF-IDF. "
            "Docker + эмбеддер на хосте: EMBEDDER_BASE_URL=http://host.docker.internal:6620 "
            "(не localhost).",
            exc,
        )
        return None
    return embed_fn


@asynccontextmanager
async def lifespan(app: FastAPI):
    embed_fn = _embed_fn_or_none_after_probe()
    if embed_fn is not None:
        logger.info("RAG: embedder enabled (%s)", settings.embedder_base_url)
    else:
        logger.info("RAG: TF-IDF only; set EMBEDDER_BASE_URL for /v1/embeddings")

    store = InMemoryVectorStore(embed_texts=embed_fn)
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
        description="Ingest; поиск: TF-IDF или эмбеддер (EMBEDDER_BASE_URL → /v1/embeddings). Чанки в PostgreSQL.",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(rag_router, prefix="/api/v1/rag", tags=["rag"])
    return app


app = create_app()
