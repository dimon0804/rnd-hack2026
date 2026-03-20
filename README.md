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

Инфраструктура поднимается через `docker-compose`: PostgreSQL, Redis, Adminer, Nginx, **api-gateway**, **auth-service**, **rag-service**, **ai-service**.

Распределение ролей: [`docs/TEAM.md`](docs/TEAM.md). Git-процесс: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Быстрый старт (локально)

```bash
cp .env.example .env
# задайте SECRET_KEY и при необходимости пароли БД

docker compose up -d --build
```

- API Gateway: `http://localhost:8000` (напрямую) или через Nginx: `http://localhost`
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

- **api-gateway:** health, CORS, rate limit, HTTP-прокси для `/api/v1/auth/*`, `/api/v1/rag/*`, `/api/v1/ai/*`
- **auth-service:** PostgreSQL, bcrypt, JWT access + refresh в БД, эндпоинты register / login / refresh / logout
- **rag-service:** baseline индексация текста и retrieval (`/api/v1/rag/index`, `/api/v1/rag/query`)
- **ai-service:** интеграция с Mistral (`/api/v1/ai/chat`)

Проверка: `POST http://localhost:8000/api/v1/auth/register` с JSON `{"email":"a@b.c","password":"password12"}`.

Следующий шаг: связать `document-service` Никиты с `rag-service` (авто-индексация после загрузки).
