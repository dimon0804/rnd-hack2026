import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.ai import ChatRequest, ChatResponse, ExtractTableRequest, ExtractTableResponse, TranscribeResponse
from app.services.mistral_client import MistralClient

router = APIRouter()
client = MistralClient()


def _strip_markdown_fences(raw: str) -> str:
    t = raw.strip()
    if not t.startswith("```"):
        return t
    lines = t.split("\n")
    if len(lines) < 2:
        return t
    lines = lines[1:]
    while lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


@router.post("/extract-table", response_model=ExtractTableResponse)
async def extract_table(body: ExtractTableRequest) -> ExtractTableResponse:
    """Структурирование неструктурированного текста в CSV (для Excel / импорта)."""
    system = """Ты извлекаешь структурированные данные в одну таблицу.
Правила ответа:
- Выведи ТОЛЬКО CSV: первая строка — заголовки столбцов.
- Разделитель полей — запятая. Если значение содержит запятую или перенос строки — заключи его в двойные кавычки.
- Без markdown, без обрамления ```, без пояснений до или после таблицы.
- 2–20 строк данных (плюс заголовок); если фактов мало — меньше строк допустимо.
- Язык заголовков и ячеек согласуй с исходным текстом (обычно русский)."""
    user_parts = [
        "Извлеки из текста ниже осмысленную таблицу (сущности, даты, числа, статусы — по контексту).\n\n---\n",
        body.source_text,
        "\n---",
    ]
    if body.focus and body.focus.strip():
        user_parts.append(f"\nПожелание к содержанию столбцов или строк: {body.focus.strip()}")
    chat_req = ChatRequest(
        prompt="".join(user_parts),
        system_prompt=system,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )
    res = await client.chat(chat_req)
    csv_text = _strip_markdown_fences(res.content)
    return ExtractTableResponse(csv_text=csv_text, model=res.model)


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


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    model: str | None = Form(default=None),
) -> TranscribeResponse:
    """Прокси к STT: multipart на внешний /v1/audio/transcriptions (как OpenAI Whisper API)."""
    base_raw = (settings.stt_base_url or "").strip()
    if not base_raw:
        raise HTTPException(status_code=503, detail="STT_BASE_URL не задан (распознавание речи отключено).")
    base = base_raw.rstrip("/")
    url = f"{base}/v1/audio/transcriptions"

    api_key = (settings.stt_api_key or "").strip() or (settings.mistral_api_key or "").strip()
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    data = await file.read()
    max_b = settings.stt_max_upload_mb * 1024 * 1024
    if len(data) > max_b:
        raise HTTPException(
            status_code=413,
            detail=f"Файл больше {settings.stt_max_upload_mb} МБ",
        )

    filename = file.filename or "audio.webm"
    content_type = file.content_type or "application/octet-stream"
    form_data: dict[str, str] = {"response_format": "json", "stream": "false"}
    m = (model or "").strip() or (settings.stt_model or "").strip()
    if m:
        form_data["model"] = m
    if language and language.strip():
        form_data["language"] = language.strip()

    timeout = httpx.Timeout(settings.stt_timeout_seconds)
    files = {"file": (filename, data, content_type)}

    async with httpx.AsyncClient(timeout=timeout) as http:
        try:
            r = await http.post(url, headers=headers, files=files, data=form_data)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"STT недоступен: {exc}") from exc

    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=(r.text or r.reason_phrase)[:800])

    try:
        payload = r.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="STT вернул не JSON") from exc

    text = payload.get("text") if isinstance(payload, dict) else None
    if not isinstance(text, str):
        raise HTTPException(status_code=502, detail="В ответе STT нет поля text")
    return TranscribeResponse(text=text.strip())


@router.get("/stt-models")
async def list_stt_models() -> dict:
    """Список моделей на STT-сервере (GET {STT_BASE_URL}/v1/models). Нужны STT_BASE_URL и Bearer (STT_API_KEY или MISTRAL_API_KEY)."""
    base_raw = (settings.stt_base_url or "").strip()
    if not base_raw:
        raise HTTPException(status_code=503, detail="STT_BASE_URL не задан")
    api_key = (settings.stt_api_key or "").strip() or (settings.mistral_api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Нужен STT_API_KEY или MISTRAL_API_KEY (Bearer для GET /v1/models на STT).",
        )
    base = base_raw.rstrip("/")
    url = f"{base}/v1/models"
    timeout = httpx.Timeout(settings.stt_timeout_seconds)
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=timeout) as http:
        try:
            r = await http.get(url, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"STT unreachable: {exc}") from exc
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=(r.text or "")[:600])
    try:
        return r.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON from STT /v1/models") from exc


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
