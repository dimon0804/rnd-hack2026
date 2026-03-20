# rag-service

Индексация и retrieval для RAG: **ingest** от document-service + baseline **TF-IDF** (матрица в памяти после старта).

## Персистентность

Чанки текста хранятся в **PostgreSQL** (таблица `rag_index_chunks`). При старте сервиса чанки загружаются из БД и пересобирается TF-IDF. Переменные как у остальных сервисов: `POSTGRES_*`, плюс **`RAG_ENABLE_DB`** (по умолчанию `true`). Для локального запуска без Postgres: `RAG_ENABLE_DB=false`.

## Эндпоинты

- `GET /health`
- `POST /api/v1/rag/ingest` — извлечение текста из файла в volume, чанкинг, запись в БД + память
- `POST /api/v1/rag/index` — полный текст документа (ручной вызов)
- `POST /api/v1/rag/query` — top-k релевантных чанков
- `GET /api/v1/rag/documents/{id}/chunks` — все чанки документа по порядку

Том `document_uploads` в compose смонтирован в `/data/uploads` и совпадает с document-service.
