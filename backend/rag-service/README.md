# rag-service

Embeddings, чанкинг, векторная БД, retrieval для RAG.

## Текущий этап

- `POST /api/v1/rag/ingest` (202) — принимает метаданные от document-service, проверяет путь к файлу в общем volume (`UPLOAD_DIR`), логирует; дальнейшая обработка подключается позже.

Том `document_uploads` в compose смонтирован в `/data/uploads` и совпадает с document-service.
