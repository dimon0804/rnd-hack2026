# rag-service

Индексация текста и retrieval для RAG (текущий шаг: in-memory TF-IDF).

## Эндпоинты

- `GET /health`
- `POST /api/v1/rag/index` — индексировать документ (по `document_id`, полный `text`)
- `POST /api/v1/rag/query` — получить top-k релевантных чанков

Текущий baseline быстрый для разработки и демо; следующий шаг — заменить store на постоянный (Postgres + pgvector).
