# Mistral и совместимые LLM

Официальный каталог Mistral: [документация](https://docs.mistral.ai), [модели](https://docs.mistral.ai/getting-started/models/).

В **`ai-service`** режим задаётся **`LLM_MODE`** (см. `.env.example`):

| `LLM_MODE`     | Поведение |
|----------------|-----------|
| `mistral_sdk`  | Официальный Python SDK (`mistralai`) к La Plateforme или другому URL, который поддерживает Mistral SDK. |
| `openai_http`  | Обычный **OpenAI-совместимый** запрос `POST /v1/chat/completions` (Bearer-токен). Подходит для vLLM, шлюзов хакатона и любых прокси с тем же контрактом. |

Переключение между Mistral в облаке и отдельным шлюзом: поменяйте в `.env` **`LLM_MODE`**, **`MISTRAL_BASE_URL`**, **`MISTRAL_API_KEY`**, **`MISTRAL_CHAT_MODEL`**, перезапустите **`ai-service`**.

Диагностика без ключа в ответе: `GET http://localhost:8004/api/v1/ai/llm-config` (или через gateway `http://localhost:8000/api/v1/ai/llm-config`). Список имён моделей на OpenAI-совместимом сервере: `GET .../api/v1/ai/models` (проксирует `GET /v1/models` на `MISTRAL_BASE_URL`).

## Практичные варианты

| Задача | Примеры идентификаторов |
|--------|-------------------------|
| Дешёвый чат / высокий RPS | `mistral-small-latest`, семейство Small |
| Качество ответов (общий диалог) | `mistral-medium-latest`, `mistral-large-latest` |
| Код / агенты | `codestral-latest`, `devstral-*` (см. каталог) |
| Эмбеддинги (будущий RAG) | отдельные эндпоинты Embeddings, модели `mistral-embed` и др. |

Алиасы `*-latest` указывают на актуальную стабильную линию; для фиксации версии используйте явные имена из консоли La Plateforme.

## Ключ API

Ключ выдаётся в [La Plateforme](https://console.mistral.ai); для продакшена храните его в секретах/`.env`, не коммитьте.
