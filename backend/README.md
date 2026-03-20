# Backend

Микросервисы платформы. Каждый сервис — отдельная папка со своим `Dockerfile` (по мере появления).

В compose: **api-gateway**, **auth-service**, **document-service**, **rag-service** (PostgreSQL, Redis, общий volume для загрузок). Остальные сервисы — по мере готовности.
