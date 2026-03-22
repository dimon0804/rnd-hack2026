# AI Platform (NotebookLM-style)

Микросервисная AI-платформа: загрузка документов, RAG, генерация саммари, тестов, карточек, mindmap.

## Структура репозитория

```
backend/
  api-gateway/      # единая точка входа (FastAPI, прокси к микросервисам)
  auth-service/
  document-service/
  rag-service/
  ai-service/
  generation-service/
frontend/           # React
docker/
  nginx/            # reverse proxy; пример HTTPS (TLS 1.2/1.3): `nginx-tls.conf.example`
```

Инфраструктура поднимается через `docker-compose`: PostgreSQL, Redis, Adminer, Nginx, **api-gateway**, **auth-service**, **document-service**, **rag-service**, **ai-service** (общий volume для загрузок).

Распределение ролей: [`docs/TEAM.md`](docs/TEAM.md). Git-процесс: [`CONTRIBUTING.md`](CONTRIBUTING.md). Mistral (модели, ключ): [`docs/MISTRAL_MODELS.md`](docs/MISTRAL_MODELS.md). Соответствие формулировкам кейса (RAG, чат, подкаст, отчёт, mindmap): [`docs/CASE_REQUIREMENTS.md`](docs/CASE_REQUIREMENTS.md). STT hackai :6640 (Bearer, `GET /v1/models`): [`docs/HACKAI_STT.md`](docs/HACKAI_STT.md). **Проверка по чек-листу** (микросервисы, LLM/TLS/контур, LangChain/PPTX/TTS, опции): [`docs/COMPLIANCE_CHECKLIST.md`](docs/COMPLIANCE_CHECKLIST.md).

## Быстрый старт (локально)

```bash
cp .env.example .env
# задайте SECRET_KEY, JWT_SECRET_KEY, при необходимости MISTRAL_API_KEY
# для релевантных фото в PPTX презентации: бесплатный ключ Pexels → PEXELS_API_KEY в `.env` (см. https://www.pexels.com/api/ )

docker compose up -d --build
```

- API Gateway: `http://localhost:8000` (напрямую) или через Nginx: `http://localhost`
- document-service (напрямую): `http://localhost:8002` · rag-service: `http://localhost:8003` · ai-service: `http://localhost:8004`
- **Frontend без локального Node:** `docker compose --profile dev up -d --build` → UI на **`http://localhost:3000`** (прокси на `api-gateway` внутри сети Docker). Образ монтирует папку `./frontend` с хоста — изменения в коде подхватываются Vite без пересборки. Том `frontend_node_modules` отделён от кода: при старте контейнера, если хэш `package-lock.json` не совпадает с сохранённым в томе, автоматически выполняется **`npm ci`** (подтягиваются новые пакеты, например `pptxgenjs`). Если зависимости всё ещё не те — пересоберите образ и при необходимости удалите том: `docker compose --profile dev build --no-cache frontend` и `docker volume rm <имя_тома_frontend_node_modules>` (см. `docker volume ls`).
- **Важно:** стандартный `docker compose up -d` **без** `--profile dev` **не поднимает** контейнер фронта. UI на порту **80** (Nginx) сейчас проксирует только **API**, не React — открывайте **`http://localhost:3000`** с включённым профилем `dev`.
- **Frontend с локальным npm:** установите [Node.js LTS](https://nodejs.org/) или `winget install OpenJS.NodeJS.LTS`. В PowerShell: **`. .\tools\use-node-path.ps1`** (dot-source — иначе `node` не попадёт в PATH для postinstall-скриптов), затем `cd frontend && npm ci && npm run dev`. Новые терминалы в Cursor/VS Code подхватывают [`.vscode/settings.json`](.vscode/settings.json).
- Adminer: `http://localhost:8080` (сервер `postgres`, пользователь/БД из `.env`)

## Ветки Git

- `main` — стабильная
- `develop` — интеграция
- `feature/*` — фичи (например `feature/auth`, `feature/rag`)

## Роли (кратко)

| Зона | Tech Lead | Никита |
|------|-----------|--------|
| Инфра, **api-gateway**, **auth**, **rag** | основной | ревью |
| **document-service** | ревью, контракты | основной |
| **generation-service** | промпты/API | основной |
| **ai-service** | Mistral, схемы | частично реализация |
| **frontend** (UI, загрузка, чат, результаты) | при необходимости | основной |

Полная таблица: [`docs/TEAM.md`](docs/TEAM.md).

## Текущий этап

- **api-gateway:** прокси на `/api/v1/auth/*`, `/api/v1/documents/*`, `/api/v1/rag/*`, `/api/v1/ai/*`; `GET /api/v1/stock-image/photo` — стоковое фото по поисковой фразе (Pexels при `PEXELS_API_KEY`, иначе Openverse, затем Picsum)
- **auth-service:** JWT, register / login / refresh / logout
- **document-service:** загрузка PDF/DOCX/PPTX/TXT, метаданные в БД, вызов **rag** `ingest` после сохранения; коллекции (метки) и **read-only ссылки** `/share/{token}` на набор меток для команды
- **rag-service:** `ingest` — извлечение текста (pypdf / python-docx / **python-pptx** / TXT), чанкинг (**LangChain** `RecursiveCharacterTextSplitter` или **LlamaIndex** `SentenceSplitter`, см. `RAG_CHUNKER` в `.env.example`); **чанки в PostgreSQL**; поиск — **TF-IDF** или **эмбеддер** (`EMBEDDER_BASE_URL`); `index` / `query`
- **ai-service:** `POST /api/v1/ai/chat` — Mistral SDK или OpenAI-совместимый HTTP (`LLM_MODE`, см. [`docs/MISTRAL_MODELS.md`](docs/MISTRAL_MODELS.md)); `POST /api/v1/ai/extract-table` — CSV по тексту из RAG; при **`STT_BASE_URL`** — `POST /api/v1/ai/transcribe`
- **frontend:** Vite + React — главная, `/login`, `/register`, `/upload`, **`/workspace/:documentId`**, **`/share/:token`** (общая коллекция без входа), `/chat` редиректит на загрузку

Проверка auth: `POST http://localhost:8000/api/v1/auth/register` с JSON `{"email":"a@b.c","password":"password12"}`.

Загрузка через gateway: `POST http://localhost:8000/api/v1/documents/upload` (`multipart/form-data`, поле `file`). Для dev можно `ALLOW_ANONYMOUS_UPLOAD=true` в compose.

**Что дальше** — см. [`docs/ROADMAP.md`](docs/ROADMAP.md) (RAG после парсинга файла, чат, generation-service, роли).
