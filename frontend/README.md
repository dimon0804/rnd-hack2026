# Frontend

Vite + React + TypeScript. Запросы к API идут на `/api/...`; dev-сервер Vite проксирует их на gateway (см. `vite.config.ts`, переменная `DEV_PROXY_TARGET`).

## Вариант 1 — Docker (npm не нужен на ПК)

Из корня репозитория:

```bash
docker compose --profile dev up -d --build
```

Откройте `http://localhost:3000`. Прокси внутри контейнера указывает на `http://api-gateway:8000`.

## Вариант 2 — локальный Node.js

1. Установите Node.js LTS ([nodejs.org](https://nodejs.org/) или `winget install OpenJS.NodeJS.LTS`).
2. В PowerShell из корня репо: **`. .\tools\use-node-path.ps1`** (с точкой в начале — иначе не обновится PATH).
3. `cd frontend && npm ci && npm run dev` → `http://localhost:3000` (прокси на `http://127.0.0.1:8000`).

Для списка «Мои документы» вставьте access token из ответа `POST /api/v1/auth/login` (сохраняется в `localStorage`).

Переменная `VITE_API_BASE` (если задана) задаёт абсолютный базовый URL API вместо относительного пути.
