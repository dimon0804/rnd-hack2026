import json
import re
import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ExtractTableRequest,
    ExtractTableResponse,
    TopicGroupsRequest,
    TopicGroupsResponse,
    TranscribeResponse,
)
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


def _fallback_topic_groups(n: int) -> list[list[int]]:
    return [[i] for i in range(n)]


def _validate_topic_groups(groups: list[list[int]], n: int) -> bool:
    flat = [i for g in groups for i in g]
    if len(flat) != n:
        return False
    return sorted(flat) == list(range(n))


def _parse_topic_groups_json(raw: str) -> list[list[int]] | None:
    t = raw.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        t = "\n".join(lines[1:])
        if "```" in t:
            t = t.rsplit("```", 1)[0]
    m = re.search(r"\{[\s\S]*\}", t)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except ValueError:
        return None
    g = data.get("groups")
    if not isinstance(g, list):
        return None
    out: list[list[int]] = []
    for item in g:
        if not isinstance(item, list):
            return None
        row: list[int] = []
        for x in item:
            if isinstance(x, bool):
                return None
            if isinstance(x, int):
                row.append(x)
            elif isinstance(x, float) and float(int(x)) == x:
                row.append(int(x))
            else:
                return None
        out.append(row)
    return out


@router.post("/topic-groups", response_model=TopicGroupsResponse)
async def partition_topic_groups(body: TopicGroupsRequest) -> TopicGroupsResponse:
    """Разбиение индексов файлов по тематике (для пакетной загрузки в document-service)."""
    n = len(body.items)
    parts: list[str] = []
    for i, it in enumerate(body.items):
        parts.append(f"--- Файл index={i}, name={it.filename} ---\n{it.preview[:3500]}\n")
    user_text = "\n".join(parts)
    system = """Ты классификатор тематики документов. Даны фрагменты текста из нескольких файлов.
Разбей индексы файлов 0..N-1 на группы так, чтобы в одной группе были только файлы об ОДНОЙ предметной области
(одна тема, один проект, одна учебная дисциплина, один продукт, один предмет договора).
Если файлы явно про разные темы — не смешивай их.
Ответь ТОЛЬКО JSON без markdown: {"groups":[[0,1],[2]]} — groups это список групп, внутри каждой — индексы файлов. Каждый индекс от 0 до N-1 встречается ровно один раз."""
    req = ChatRequest(
        prompt=user_text,
        system_prompt=system,
        temperature=0.12,
        max_tokens=900,
    )
    try:
        res = await client.chat(req)
        parsed = _parse_topic_groups_json(res.content)
    except Exception:  # noqa: BLE001
        return TopicGroupsResponse(groups=_fallback_topic_groups(n))
    if parsed is None or not _validate_topic_groups(parsed, n):
        return TopicGroupsResponse(groups=_fallback_topic_groups(n))
    return TopicGroupsResponse(groups=parsed)


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
