# rag-service

Индексация и retrieval для RAG: **ingest** от document-service + поиск в памяти.

**Форматы файлов при ingest:** PDF (`pypdf`), DOCX (`python-docx`), **PPTX** (`python-pptx` — текст слайдов и ячеек таблиц), TXT.

**Чанкинг:** переменная **`RAG_CHUNKER`**: **`semantic`** (по умолчанию — сначала абзацы, длинные абзацы режутся по предложениям; без склейки разных абзацев в один чанк), `langchain` (`RecursiveCharacterTextSplitter`), `llama_index` (**LlamaIndex** `SentenceSplitter`), `legacy` (скользящее окно по символам).

- **По умолчанию** — **TF-IDF** (scikit-learn).
- Если задан **`EMBEDDER_BASE_URL`** — запросы к OpenAI-совместимому **`POST /v1/embeddings`** (vLLM и т.п., напр. порт **6620**), релевантность — косинусное сходство по эмбеддингам чанков и запроса.

Переменные эмбеддера: `EMBEDDER_BASE_URL`, опционально `EMBEDDER_MODEL`, `EMBEDDER_BATCH_SIZE`, `EMBEDDER_TIMEOUT_SECONDS`.

### Эмбеддер от кейсодержателя (хакатон)

Обычно организаторы выдают **внешний URL** (часто `https://…:6620` или другой порт) и **имя модели** для `POST /v1/embeddings`. Укажите их в `.env` как `EMBEDDER_BASE_URL` и `EMBEDDER_MODEL`. Контейнер `rag-service` обращается к этому хосту **по сети**, как браузер — `localhost` здесь **не нужен** (он только путает, если сервис у организаторов, а не на вашей машине). Имя модели можно посмотреть у них в доке или через `GET /v1/models` на том же хосте, если эндпоинт открыт.

### Эмбеддер только на вашем ПК + Docker

Если векторизатор крутится **локально у вас**, а приложение в **Docker**, из контейнера `localhost` — это не ваш ПК. Тогда: `http://host.docker.internal:<порт>` (на Linux в compose для `rag-service` добавлен `extra_hosts: host.docker.internal:host-gateway`).

При **недоступном** эмбеддере при старте `rag-service` переключается на **TF-IDF**, чтобы загрузка документов не ломалась.

## Персистентность

Чанки текста хранятся в **PostgreSQL** (таблица `rag_index_chunks`). При старте сервиса чанки загружаются из БД и пересобирается матрица (TF-IDF или эмбеддинги). Векторы эмбеддингов в БД не хранятся — при старте пересчитываются через эмбеддер. Переменные как у остальных сервисов: `POSTGRES_*`, плюс **`RAG_ENABLE_DB`** (по умолчанию `true`). Для локального запуска без Postgres: `RAG_ENABLE_DB=false`.

## Эндпоинты

- `GET /health`
- `POST /api/v1/rag/ingest` — извлечение текста из файла в volume, чанкинг, запись в БД + память
- `POST /api/v1/rag/index` — полный текст документа (ручной вызов)
- `POST /api/v1/rag/query` — top-k релевантных чанков
- `GET /api/v1/rag/documents/{id}/chunks` — все чанки документа по порядку

Том `document_uploads` в compose смонтирован в `/data/uploads` и совпадает с document-service.
