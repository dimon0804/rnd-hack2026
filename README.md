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
  nginx/            # reverse proxy
```

Инфраструктура поднимается через `docker-compose`: PostgreSQL, Redis, Adminer, Nginx, **api-gateway**, **auth-service**, **document-service**, **rag-service**, **ai-service** (общий volume для загрузок).

Распределение ролей: [`docs/TEAM.md`](docs/TEAM.md). Git-процесс: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Быстрый старт (локально)

```bash
cp .env.example .env
# задайте SECRET_KEY, JWT_SECRET_KEY, при необходимости MISTRAL_API_KEY

docker compose up -d --build
```

- API Gateway: `http://localhost:8000` (напрямую) или через Nginx: `http://localhost`
- document-service (напрямую): `http://localhost:8002` · rag-service: `http://localhost:8003` · ai-service: `http://localhost:8004`
- **Frontend без локального Node:** `docker compose --profile dev up -d --build` → UI на `http://localhost:3000` (прокси на `api-gateway` внутри сети Docker).
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

- **api-gateway:** прокси на `/api/v1/auth/*`, `/api/v1/documents/*`, `/api/v1/rag/*`, `/api/v1/ai/*`
- **auth-service:** JWT, register / login / refresh / logout
- **document-service:** загрузка PDF/DOCX/TXT, метаданные в БД, вызов **rag** `ingest` после сохранения
- **rag-service:** `ingest` (stub) + TF-IDF `index` / `query` (in-memory)
- **ai-service:** Mistral `POST /api/v1/ai/chat`
- **frontend:** страница загрузки (Vite + React)

Проверка auth: `POST http://localhost:8000/api/v1/auth/register` с JSON `{"email":"a@b.c","password":"password12"}`.

Загрузка через gateway: `POST http://localhost:8000/api/v1/documents/upload` (`multipart/form-data`, поле `file`). Для dev можно `ALLOW_ANONYMOUS_UPLOAD=true` в compose.

Следующий шаг: читать текст из файла после upload и дергать `/api/v1/rag/index`, generation-service, чат с RAG.
