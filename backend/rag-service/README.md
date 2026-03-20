# rag-service

Индексация и retrieval для RAG: **ingest** от document-service + baseline **TF-IDF** (in-memory).

## Эндпоинты

- `GET /health`
- `POST /api/v1/rag/ingest` (202) — метаданные от document-service, проверка пути в общем volume (`UPLOAD_DIR`)
- `POST /api/v1/rag/index` — полный текст документа по `document_id` (для ручной/будущей авто-индексации)
- `POST /api/v1/rag/query` — top-k релевантных чанков

Том `document_uploads` в compose смонтирован в `/data/uploads` и совпадает с document-service.

Следующий шаг — постоянное хранилище (Postgres + pgvector) и эмбеддинги.
