"""Прокси стоковых фото по поисковой фразе: Pexels (ключ) → Openverse (поиск по запросу) → Picsum."""

from __future__ import annotations

import hashlib

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from app.core.config import settings

router = APIRouter(prefix="/api/v1/stock-image", tags=["stock-image"])

_OPENVERSE_UA = "rnd-hack2026-ai-platform/1.0 (stock-image proxy)"


def _picsum_seed(q: str, idx: int) -> str:
    h = hashlib.sha256(f"{q}|{idx}".encode()).hexdigest()[:24]
    return f"h{h}"


async def _fetch_image_bytes(client: httpx.AsyncClient, url: str) -> bytes | None:
    try:
        r = await client.get(
            url,
            follow_redirects=True,
            timeout=30.0,
            headers={"User-Agent": _OPENVERSE_UA},
        )
        if r.status_code != 200 or not r.content:
            return None
        return r.content
    except (httpx.HTTPError, OSError):
        return None


async def _pexels(client: httpx.AsyncClient, q: str, idx: int) -> bytes | None:
    key = (settings.pexels_api_key or "").strip()
    if not key:
        return None
    r = await client.get(
        "https://api.pexels.com/v1/search",
        params={"query": q, "per_page": 15, "orientation": "landscape"},
        headers={"Authorization": key},
        timeout=30.0,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    photos = data.get("photos") or []
    if not photos:
        return None
    chosen = photos[idx % len(photos)]
    src = chosen.get("src") or {}
    img_url = src.get("large2x") or src.get("large") or src.get("original")
    if not img_url:
        return None
    return await _fetch_image_bytes(client, str(img_url))


async def _openverse(client: httpx.AsyncClient, q: str, idx: int) -> bytes | None:
    """Поиск по тексту запроса; поле url у результата — прямая ссылка на файл."""
    r = await client.get(
        "https://api.openverse.org/v1/images/",
        params={"q": q, "page_size": 20, "page": 1},
        timeout=30.0,
        headers={"User-Agent": _OPENVERSE_UA},
    )
    if r.status_code != 200:
        return None
    data = r.json()
    results = data.get("results") or []
    if not results:
        return None
    chosen = results[idx % len(results)]
    img_url = chosen.get("url")
    if not img_url:
        return None
    return await _fetch_image_bytes(client, str(img_url))


async def _picsum(client: httpx.AsyncClient, q: str, idx: int) -> bytes | None:
    seed = _picsum_seed(q, idx)
    url = f"https://picsum.photos/seed/{seed}/960/540"
    return await _fetch_image_bytes(client, url)


def _media_type(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


@router.get("/photo")
async def stock_photo(request: Request, q: str = "", i: int = 0) -> Response:
    q = (q or "").strip()[:240]
    if not q:
        raise HTTPException(status_code=400, detail="query required")

    client: httpx.AsyncClient = request.app.state.http_client
    data = await _pexels(client, q, i)
    if data is None:
        data = await _openverse(client, q, i)
    if data is None:
        data = await _picsum(client, q, i)
    if data is None:
        raise HTTPException(status_code=502, detail="image fetch failed")

    return Response(
        content=data,
        media_type=_media_type(data),
        headers={"Cache-Control": "public, max-age=3600"},
    )
