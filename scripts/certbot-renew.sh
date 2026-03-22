#!/usr/bin/env bash
# Ручной запуск обновления сертификата (тот же сценарий, что в cron после deploy-server.sh).
# Использование на сервере: sudo bash scripts/certbot-renew.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/rnd-hack26}"
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml --env-file .env stop nginx
certbot renew
docker compose -f docker-compose.prod.yml --env-file .env start nginx
