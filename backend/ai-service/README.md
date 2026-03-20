# ai-service

Чат с LLM: **`LLM_MODE=mistral_sdk`** — пакет **`mistralai`** (La Plateforme); **`LLM_MODE=openai_http`** — `POST /v1/chat/completions` в OpenAI-формате (vLLM, шлюзы хакатона). Подробности: [`docs/MISTRAL_MODELS.md`](../../docs/MISTRAL_MODELS.md).

## Эндпоинты

- `GET /health`
- `POST /api/v1/ai/chat`
- `GET /api/v1/ai/llm-config` — режим, base URL, модель (без ключа)
- `GET /api/v1/ai/models` — прокси к `GET {MISTRAL_BASE_URL}/v1/models` (подбор `MISTRAL_CHAT_MODEL`)

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
