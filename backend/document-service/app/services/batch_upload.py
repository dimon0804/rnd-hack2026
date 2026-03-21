import logging
import uuid
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def fallback_singleton_groups(n: int) -> list[list[int]]:
    return [[i] for i in range(n)]


def validate_groups(groups: list[list[int]], n: int) -> bool:
    flat = [i for g in groups for i in g]
    if len(flat) != n:
        return False
    return sorted(flat) == list(range(n))


async def rag_extract_preview(client: httpx.AsyncClient, data: bytes, filename: str, mime: str) -> str:
    url = f"{settings.rag_service_url.rstrip('/')}/api/v1/rag/extract-preview"
    files = {"file": (filename, data, mime)}
    form = {"mime_type": mime}
    r = await client.post(url, files=files, data=form, timeout=180.0)
    r.raise_for_status()
    j = r.json()
    return (j.get("preview") or "").strip()


async def ai_partition_topics(client: httpx.AsyncClient, items: list[dict[str, str]]) -> list[list[int]]:
    url = f"{settings.ai_service_url.rstrip('/')}/api/v1/ai/topic-groups"
    r = await client.post(url, json={"items": items}, timeout=120.0)
    if r.status_code >= 400:
        logger.warning("topic-groups HTTP %s: %s", r.status_code, (r.text or "")[:300])
        raise ValueError(r.text[:500])
    data = r.json()
    groups = data.get("groups")
    if not isinstance(groups, list):
        raise ValueError("no groups in response")
    out: list[list[int]] = []
    for g in groups:
        if not isinstance(g, list):
            raise ValueError("bad group shape")
        row: list[int] = []
        for x in g:
            if isinstance(x, int):
                row.append(x)
            elif isinstance(x, float):
                row.append(int(x))
            else:
                raise ValueError("bad index")
        out.append(row)
    return out


def assign_topic_group_ids(
    groups: list[list[int]],
) -> dict[int, uuid.UUID | None]:
    """Индекс файла → общий topic_group_id для групп из ≥2 файлов, иначе None."""
    m: dict[int, uuid.UUID | None] = {}
    for g in groups:
        gid = uuid.uuid4() if len(g) >= 2 else None
        for idx in g:
            m[idx] = gid
    return m


def groups_note_ru(groups: list[list[int]], filenames: list[str]) -> str:
    parts: list[str] = []
    for g in groups:
        names = ", ".join(filenames[i] for i in g)
        if len(g) > 1:
            parts.append(f"одна тема ({len(g)} файла): {names}")
        else:
            parts.append(f"отдельно: {names}")
    return "; ".join(parts)
