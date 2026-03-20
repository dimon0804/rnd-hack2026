import logging
import uuid
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestOutcome:
    success: bool
    chunks_indexed: int
    detail: str


async def notify_ingest(
    client: httpx.AsyncClient,
    document_id: uuid.UUID,
    storage_path: str,
    mime_type: str,
    user_id: int | None,
) -> IngestOutcome:
    base = settings.rag_service_url.rstrip("/")
    url = f"{base}/api/v1/rag/ingest"
    payload = {
        "document_id": str(document_id),
        "storage_path": storage_path,
        "mime_type": mime_type,
        "user_id": user_id,
    }
    resp = await client.post(url, json=payload, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    status = data.get("status", "")
    chunks = int(data.get("chunks_indexed", 0))
    detail = (data.get("detail") or "").strip()
    ok = status == "indexed" and chunks > 0
    return IngestOutcome(success=ok, chunks_indexed=chunks, detail=detail or ("Проиндексировано" if ok else "Ошибка индексации"))


async def notify_ingest_safe(
    client: httpx.AsyncClient,
    document_id: uuid.UUID,
    storage_path: str,
    mime_type: str,
    user_id: int | None,
) -> IngestOutcome:
    try:
        return await notify_ingest(client, document_id, storage_path, mime_type, user_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("RAG ingest failed: %s", exc)
        return IngestOutcome(success=False, chunks_indexed=0, detail=str(exc)[:1000])
