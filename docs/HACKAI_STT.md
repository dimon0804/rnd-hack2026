# STT на hackai.centrinvest.ru:6640

Сервер **OpenAI-совместимый**: список моделей и транскрибация требуют заголовок **`Authorization: Bearer <API-ключ>`**.  
В Swagger, если не добавить авторизацию, ответ будет **401 Unauthorized** — это нормально.

## Скрипт из репозитория (Windows)

В PowerShell из **корня проекта**:

```powershell
.\tools\fetch-stt-models.ps1
```

С другим ключом:

```powershell
$env:STT_API_KEY = "ваш_ключ"
.\tools\fetch-stt-models.ps1
```

Скрипт выведет JSON и в конце строки **`id`** моделей для **`STT_MODEL`** в `.env`.

## Список моделей (`GET /v1/models`)

Подставьте ключ, который выдали организаторы хакатона:

```bash
curl -sS -X GET "https://hackai.centrinvest.ru:6640/v1/models" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ВАШ_API_КЛЮЧ"
```

Пример с ключом хакатона (если в брифинге указан общий ключ `hackaton2026`):

```bash
curl -sS -X GET "https://hackai.centrinvest.ru:6640/v1/models" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer hackaton2026"
```

В ответе обычно есть поле `data` с элементами `id` — одно из значений `id` укажите в `.env` как **`STT_MODEL`** (если сервер требует явное имя модели).

## Через наш backend

В `.env`:

```env
STT_BASE_URL=https://hackai.centrinvest.ru:6640
STT_API_KEY=hackaton2026
```

После перезапуска **ai-service**:

```bash
curl -sS "http://localhost:8000/api/v1/ai/stt-models"
```

(через **api-gateway**; ключ не передаёте в curl — он берётся из `STT_API_KEY` / `MISTRAL_API_KEY` на сервере.)

## Swagger на стороне hackai

Если в UI есть кнопка **Authorize** / поле API Key — введите тот же ключ; либо в разделе curl вручную добавьте заголовок `Authorization: Bearer …`.
