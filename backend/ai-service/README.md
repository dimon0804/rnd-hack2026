# ai-service

Интеграция с **La Plateforme** через официальный пакет **`mistralai`** (`mistral.chat.complete_async`). См. каталог моделей: [`docs/MISTRAL_MODELS.md`](../../docs/MISTRAL_MODELS.md).

## Эндпоинты

- `GET /health`
- `POST /api/v1/ai/chat`

Пример:

```json
{
  "prompt": "Explain retrieval-augmented generation in simple terms",
  "system_prompt": "You are a concise assistant.",
  "temperature": 0.2,
  "max_tokens": 600
}
```

Через gateway: `POST /api/v1/ai/chat`.
