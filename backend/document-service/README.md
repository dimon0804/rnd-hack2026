# document-service

Загрузка PDF/DOCX/TXT, валидация MIME и размера, сохранение в `UPLOAD_DIR`, запись метаданных в PostgreSQL, HTTP-вызов **rag-service** (`POST /api/v1/rag/ingest`).

## API

- `POST /api/v1/documents/upload` — `multipart/form-data`, поле `file`
- `GET /api/v1/documents` — список документов пользователя (нужен `Authorization: Bearer`)
- `GET /api/v1/documents/{id}` — карточка документа
- `GET /api/v1/documents/{id}/file` — скачать оригинальный файл (те же права, что у карточки)
- **Коллекции** (папки пользователя: «Работа», «Учёба»…): `GET|POST /api/v1/documents/collections`, `PATCH|DELETE /api/v1/documents/collections/{id}`, `PATCH /api/v1/documents/{id}/collections` (тело `{ "collection_ids": ["uuid", ...] }`). Список документов: `GET /api/v1/documents?collection_id=uuid`. При загрузке: form-поле `collection_ids` — JSON-массив uuid.

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `POSTGRES_*` | Подключение к БД (та же, что у auth) |
| `JWT_SECRET_KEY` / `JWT_ALGORITHM` | Должны совпадать с auth для проверки access token |
| `RAG_SERVICE_URL` | URL rag-service (по умолчанию `http://rag-service:8003`) |
| `UPLOAD_DIR` | Каталог файлов (в Docker: `/data/uploads`, общий volume с rag) |
| `MAX_UPLOAD_BYTES` | Лимит размера (по умолчанию 50 MiB) |
| `ALLOW_ANONYMOUS_UPLOAD` | `true` — загрузка без JWT (для dev); в prod обычно `false` |

Локально: `uvicorn app.main:app --reload --port 8002` из каталога сервиса (нужен PostgreSQL и при необходимости rag-service).
