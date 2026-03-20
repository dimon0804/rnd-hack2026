import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class IngestRequest(BaseModel):
    document_id: UUID
    storage_path: str
    mime_type: str
    user_id: int | None = None


class IngestResponse(BaseModel):
    status: str = Field(default="accepted")
    document_id: str
    detail: str = "Queued for chunking and embedding (stub)"


@router.post("/ingest", response_model=IngestResponse, status_code=202)
def ingest(body: IngestRequest) -> IngestResponse:
    root = Path(settings.upload_dir)
    full = (root / body.storage_path).resolve()
    if not str(full).startswith(str(root.resolve())):
        logger.warning("Invalid storage_path rejected: %s", body.storage_path)
    elif full.is_file():
        logger.info(
            "RAG ingest accepted document_id=%s path=%s size=%s",
            body.document_id,
            body.storage_path,
            full.stat().st_size,
        )
    else:
        logger.warning("Ingest file not found yet: %s", full)

    return IngestResponse(document_id=str(body.document_id))
