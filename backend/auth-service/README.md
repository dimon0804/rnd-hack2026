# auth-service

- Регистрация и вход (`/api/v1/auth/register`, `/login`)
- JWT access + opaque refresh (хранится в БД как SHA-256)
- Обновление пары (`/refresh`), выход (`/logout`)
- Пароли: bcrypt (passlib)

Через **api-gateway** те же пути: `http://localhost:8000/api/v1/auth/...`

Напрямую (dev): `http://localhost:8001/docs`

Таблицы создаются при старте (`create_all`). Для продакшена — миграции Alembic.
