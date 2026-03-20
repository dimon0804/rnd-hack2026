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

Инфраструктура поднимается через `docker-compose`: PostgreSQL, Redis, Adminer, Nginx, **api-gateway**, **auth-service**, **document-service**, **rag-service** (общий volume для загрузок).

Распределение ролей: [`docs/TEAM.md`](docs/TEAM.md). Git-процесс: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Быстрый старт (локально)

```bash
cp .env.example .env
# задайте SECRET_KEY и при необходимости пароли БД

docker compose up -d --build
```

- API Gateway: `http://localhost:8000` (напрямую) или через Nginx: `http://localhost`
- document-service (напрямую): `http://localhost:8002` · rag-service: `http://localhost:8003`
- Frontend (dev): `cd frontend && npm install && npm run dev` → `http://localhost:3000`
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

- **api-gateway:** health, CORS, rate limit, прокси на `/api/v1/auth/*` и `/api/v1/documents/*`
- **auth-service:** PostgreSQL, bcrypt, JWT access + refresh в БД, register / login / refresh / logout
- **document-service:** загрузка PDF/DOCX/TXT, метаданные в БД, вызов **rag-service** после сохранения
- **rag-service:** stub `POST /api/v1/rag/ingest` (202), общий volume с файлами
- **frontend:** страница загрузки (Vite + React)

Проверка auth: `POST http://localhost:8000/api/v1/auth/register` с JSON `{"email":"a@b.c","password":"password12"}`.

Загрузка через gateway: `POST http://localhost:8000/api/v1/documents/upload` (`multipart/form-data`, поле `file`). Для dev можно включить `ALLOW_ANONYMOUS_UPLOAD=true` (по умолчанию в compose).

Следующий шаг: полноценный RAG (эмбеддинги, векторное хранилище), чат и generation-service — по бэклогу команды.
