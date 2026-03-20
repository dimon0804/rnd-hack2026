import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.ai import ChatRequest, ChatResponse
from app.services.mistral_client import MistralClient

router = APIRouter()
client = MistralClient()


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    return await client.chat(body)


@router.get("/llm-config")
def llm_config() -> dict:
    """Диагностика: режим и параметры без раскрытия ключа."""
    return {
        "llm_mode": settings.llm_mode,
        "base_url": settings.mistral_base_url.rstrip("/"),
        "chat_model": settings.mistral_chat_model,
        "api_key_configured": bool(settings.mistral_api_key.strip()),
    }


@router.get("/models")
async def list_remote_models() -> dict:
    """Список моделей с OpenAI-совместимого сервера (GET /v1/models). Удобно подобрать MISTRAL_CHAT_MODEL."""
    if not settings.mistral_api_key.strip():
        raise HTTPException(status_code=503, detail="MISTRAL_API_KEY is not configured")
    base = settings.mistral_base_url.rstrip("/")
    url = f"{base}/v1/models"
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    headers = {"Authorization": f"Bearer {settings.mistral_api_key}"}
    async with httpx.AsyncClient(timeout=timeout) as http:
        try:
            r = await http.get(url, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Unreachable: {exc}") from exc
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=(r.text or "")[:600])
    try:
        return r.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON from /v1/models") from exc
