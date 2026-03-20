# ai-service

Вызовы Mistral API, единая обёртка над моделями и токенами.

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
