import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.schemas.rag import IndexDocumentRequest, IndexDocumentResponse, QueryRequest, QueryResponse
from app.services.text_extract import extract_text_from_file

logger = logging.getLogger(__name__)

router = APIRouter()

_DEFAULT_CHUNK = 700
_DEFAULT_OVERLAP = 100


class IngestRequest(BaseModel):
    document_id: UUID
    storage_path: str
    mime_type: str
    user_id: int | None = None


class IngestResponse(BaseModel):
    """Синхронная обработка: извлечение текста + чанкинг + TF-IDF."""

    status: str = Field(description="indexed | failed")
    document_id: str
    chunks_indexed: int = 0
    detail: str = ""


@router.post("/ingest", response_model=IngestResponse)
def ingest(body: IngestRequest, request: Request) -> IngestResponse:
    doc_id = str(body.document_id)
    root = Path(settings.upload_dir).resolve()
    try:
        full = (root / body.storage_path).resolve()
    except (OSError, ValueError) as e:
        logger.warning("Bad storage_path: %s", e)
        return IngestResponse(status="failed", document_id=doc_id, detail="Некорректный путь к файлу")

    if not str(full).startswith(str(root)):
        logger.warning("Path traversal rejected: %s", body.storage_path)
        return IngestResponse(status="failed", document_id=doc_id, detail="Недопустимый путь")

    if not full.is_file():
        return IngestResponse(status="failed", document_id=doc_id, detail="Файл не найден на диске")

    try:
        text = extract_text_from_file(body.mime_type, full)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Text extraction failed for %s", doc_id)
        d = f"Извлечение текста: {exc}"
        return IngestResponse(status="failed", document_id=doc_id, detail=d[:500])

    text = text.strip()
    if not text:
        return IngestResponse(
            status="failed",
            document_id=doc_id,
            detail="В документе не найдено текста для индексации",
        )

    rag_service = request.app.state.rag_service
    try:
        result = rag_service.index_document(
            document_id=doc_id,
            text=text,
            chunk_size=_DEFAULT_CHUNK,
            chunk_overlap=_DEFAULT_OVERLAP,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Index failed for %s", doc_id)
        return IngestResponse(status="failed", document_id=doc_id, detail=str(exc)[:500])

    logger.info("Indexed document_id=%s chunks=%s", doc_id, result.chunks_indexed)
    return IngestResponse(
        status="indexed",
        document_id=doc_id,
        chunks_indexed=result.chunks_indexed,
        detail=f"Проиндексировано фрагментов: {result.chunks_indexed}",
    )


@router.post("/index", response_model=IndexDocumentResponse)
def index_document(body: IndexDocumentRequest, request: Request) -> IndexDocumentResponse:
    rag_service = request.app.state.rag_service
    return rag_service.index_document(
        document_id=body.document_id,
        text=body.text,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
    )


@router.post("/query", response_model=QueryResponse)
def query(body: QueryRequest, request: Request) -> QueryResponse:
    rag_service = request.app.state.rag_service
    return rag_service.query(
        query_text=body.query,
        top_k=body.top_k,
        document_ids=body.document_ids,
    )


@router.get("/documents/{document_id}/chunks", response_model=QueryResponse)
def get_document_chunks(document_id: str, request: Request) -> QueryResponse:
    """Все чанки документа по порядку (без TF-IDF). Для UI: саммари, карточки, когда query даёт пусто."""
    rag_service = request.app.state.rag_service
    return rag_service.chunks_for_document(document_id)
