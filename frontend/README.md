# Frontend

Vite + React + TypeScript. Страница загрузки документов обращается к API через прокси dev-сервера на `http://127.0.0.1:8000` (см. `vite.config.ts`).

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`. Для списка «Мои документы» вставьте access token из ответа `POST /api/v1/auth/login` (сохраняется в `localStorage`).

Переменная `VITE_API_BASE` (если задана) задаёт абсолютный базовый URL API вместо относительного пути.
