# Проверка соответствия требованиям (архитектура, LLM, контур, опции)

Документ фиксирует **фактическое состояние репозитория**: что закрывает формулировки кейса, что настраивается при деплое, и оставшиеся пробелы.

---

## 1. Open-source библиотеки (LangChain / LlamaIndex, PPTX, Piper / Coqui)

| Ожидание | Статус | Факт в проекте |
|----------|--------|----------------|
| **LangChain** | Используется | Чанкинг в `rag-service`: **`langchain-text-splitters`** — `RecursiveCharacterTextSplitter` (режим `RAG_CHUNKER=langchain`; по умолчанию **`semantic`** — абзацы/предложения, для длинных блоков тот же сплиттер). |
| **LlamaIndex** | Используется | Альтернативный чанкинг: **`llama-index-core`** — `SentenceSplitter` при `RAG_CHUNKER=llama_index`. |
| **PPTX (Python)** | Да | **`python-pptx`**: извлечение текста слайдов и таблиц в `rag-service/app/services/text_extract.py`; MIME разрешён в `document-service`; загрузка PPTX на фронте. |
| **TTS Piper / Coqui** | Нет в Docker | Аудиопересказ: **Web Speech API** в браузере (`frontend/src/lib/speech.ts`). Для Piper/Coqui — отдельный контейнер и смена фронта на воспроизведение файла/стрима (roadmap). |

**Прочие открытые стеки:** FastAPI, Uvicorn, Pydantic, HTTPX, psycopg, scikit-learn, NumPy, pypdf, python-docx, Mistral SDK (опционально), React/Vite.

---

## 2. Архитектура: модульность / микросервисы

| Компонент | Роль |
|-----------|------|
| **api-gateway** | Единая точка `/api/v1/*`, прокси к остальным сервисам |
| **auth-service** | Регистрация, JWT, refresh |
| **document-service** | Загрузка, метаданные, вызов RAG `ingest` |
| **rag-service** | Парсинг, чанки, индекс, `query` |
| **ai-service** | Чат LLM, **extract-table**, прокси STT и списков моделей |

Сервисы — отдельные контейнеры в `docker-compose.yml`.

Папка `backend/generation-service` **не в compose**; сценарии генерации идут через **`ai-service` + фронт** (`frontend/src/lib/workspaceAi.ts`).

---

## 3. Закрытый контур (on-prem / air-gapped)

| Зависимость | Как уйти в контур |
|-------------|-------------------|
| **LLM** | `LLM_MODE=openai_http`, `MISTRAL_BASE_URL` → vLLM / совместимый шлюз. См. [`MISTRAL_MODELS.md`](MISTRAL_MODELS.md). |
| **Эмбеддинги** | `EMBEDDER_BASE_URL` + `EMBEDDER_MODEL`. |
| **STT** | `STT_BASE_URL` → Whisper-совместимый `/v1/audio/transcriptions`. |
| **Данные** | Postgres + volume загрузок. |

---

## 4. TLS 1.2 / 1.3

| Статус | Пояснение |
|--------|-----------|
| **Dev** | `docker/nginx/nginx.conf` — HTTP :80. |
| **Прод** | Пример блока с `ssl_protocols TLSv1.2 TLSv1.3` и редиректом на HTTPS: [`docker/nginx/nginx-tls.conf.example`](../docker/nginx/nginx-tls.conf.example). |

---

## 5. Рабочий алгоритм LLM через API

| Элемент | Реализация |
|---------|------------|
| Чат | `POST /api/v1/ai/chat` → `MistralClient` (`mistral_sdk` / `openai_http`) |
| Таблица | `POST /api/v1/ai/extract-table` — ответ `{ csv_text, model }` |
| Фронт | `frontend/src/api/ai.ts` — `aiChat`, `aiExtractTable` |
| Диагностика | `GET /api/v1/ai/llm-config`, `GET /api/v1/ai/models` |

---

## 6. Frontend и backend связаны

API через gateway, Bearer-токен; потоки: загрузка, RAG, чат, STT, workspace (саммари, просто/кратко, отчёт, **таблица**, тесты, карточки, mindmap, подкаст).

---

## 7. Замена провайдеров и открытые модели

1. **Чат / таблица:** тот же LLM через `LLM_MODE` и `MISTRAL_BASE_URL`.
2. **Эмбеддинги:** OpenAI-совместимый `POST /v1/embeddings`.
3. **STT:** OpenAI-совместимый `POST /v1/audio/transcriptions`.

Новый провайдер должен соблюдать эти контракты или добавляется адаптер в `ai-service` / `rag-service`.

---

## 8. Опционально: карточки и тесты

| Функция | Статус |
|---------|--------|
| **Flash-карточки** | Вкладка «Карточки», `generateFlashcards`. |
| **Тесты** | Вкладка «Тесты», `runQuickAction("test")`. |

---

## 9. Опционально: таблица / CSV / Excel

| Статус | Реализация |
|--------|------------|
| **Реализовано** | `POST /api/v1/ai/extract-table` в **ai-service**; вкладка **«Таблица»** в `DocumentWorkspace`: контекст из RAG → CSV, кнопка **Скачать .csv** (UTF-8 BOM — удобно открывать в Excel). Нативный **XLSX** в репозитории не генерируется (при необходимости — `openpyxl` на бэкенде). |

---

## Краткая сводка

| Требование | Оценка |
|------------|--------|
| LangChain | Да (`RAG_CHUNKER=langchain` или внутри `semantic`) |
| LlamaIndex | Да (`RAG_CHUNKER=llama_index`) |
| PPTX | Да |
| Piper / Coqui TTS | Нет; Web Speech API |
| Микросервисы | Да |
| Закрытый контур | Да, через env |
| TLS 1.2/1.3 | Пример в `docker/nginx/nginx-tls.conf.example` |
| LLM API | Да |
| Frontend ↔ Backend | Да |
| Смена провайдеров | Да, при совместимых API |
| Карточки и тесты | Да |
| Таблица CSV | Да |

См. также [`CASE_REQUIREMENTS.md`](CASE_REQUIREMENTS.md), [`README.md`](../README.md).
