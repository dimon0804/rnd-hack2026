# Mistral: модели для платформы

Официальный каталог и API: [документация Mistral](https://docs.mistral.ai), [модели](https://docs.mistral.ai/getting-started/models/).

В **`ai-service`** используется Chat Completions через официальный Python SDK (`mistralai`). Модель задаётся переменной **`MISTRAL_CHAT_MODEL`** (см. `.env.example`).

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
