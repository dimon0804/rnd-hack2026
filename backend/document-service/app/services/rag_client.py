import logging
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def notify_ingest(
    client: httpx.AsyncClient,
    document_id: uuid.UUID,
    storage_path: str,
    mime_type: str,
    user_id: int | None,
) -> None:
    base = settings.rag_service_url.rstrip("/")
    url = f"{base}/api/v1/rag/ingest"
    payload = {
        "document_id": str(document_id),
        "storage_path": storage_path,
        "mime_type": mime_type,
        "user_id": user_id,
    }
    resp = await client.post(url, json=payload, timeout=30.0)
    resp.raise_for_status()


async def notify_ingest_safe(
    client: httpx.AsyncClient,
    document_id: uuid.UUID,
    storage_path: str,
    mime_type: str,
    user_id: int | None,
) -> str | None:
    try:
        await notify_ingest(client, document_id, storage_path, mime_type, user_id)
        return None
    except Exception as exc:  # noqa: BLE001 — surface to caller as status message
        logger.warning("RAG ingest failed: %s", exc)
        return str(exc)
