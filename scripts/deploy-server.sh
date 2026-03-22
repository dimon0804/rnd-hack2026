#!/usr/bin/env bash
# Деплой на Ubuntu/Debian: Docker, Let's Encrypt, docker compose prod.
#
# Перед запуском:
#   1) DNS: A-запись ${DEPLOY_DOMAIN:-rnd-hack.clv-digital.tech} → IP сервера (например 158.160.121.110).
#   2) export CERTBOT_EMAIL='your@email.com' — обязательно для первого выпуска сертификата.
#   3) В .env задайте MISTRAL_API_KEY (и при необходимости EMBEDDER_*, STT_*).
#
# Запуск (на сервере, от пользователя с sudo):
#   curl -fsSL ... | bash
#   или: sudo bash scripts/deploy-server.sh
#
set -euo pipefail

DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-rnd-hack.clv-digital.tech}"
GIT_REPO="${GIT_REPO:-https://github.com/dimon0804/rnd-hack2026.git}"
APP_DIR="${APP_DIR:-/opt/rnd-hack26}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
# Пользователь, которому отдать каталог репозитория (при запуске через sudo).
INVOKER="${SUDO_USER:-${USER:-$(whoami)}}"

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

docker_compose() {
  if docker info >/dev/null 2>&1; then
    docker compose "$@"
  else
    $SUDO docker compose "$@"
  fi
}

die() {
  echo "Ошибка: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Нет команды: $1"
}

if [[ -z "${CERTBOT_EMAIL}" ]]; then
  die "Задайте CERTBOT_EMAIL, например: export CERTBOT_EMAIL=you@example.com"
fi

echo "==> Установка пакетов (git, ufw, certbot, gettext/envsubst)…"
$SUDO apt-get update -y
$SUDO apt-get install -y ca-certificates curl git ufw certbot gettext-base

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Установка Docker…"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO systemctl enable --now docker 2>/dev/null || true

echo "==> Фаервол: SSH, 80, 443…"
$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable || true

echo "==> Клонирование / обновление репозитория…"
$SUDO mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  $SUDO git clone "$GIT_REPO" "$APP_DIR"
  $SUDO chown -R "${INVOKER}:${INVOKER}" "$APP_DIR"
fi
cd "$APP_DIR"
if [[ "$(id -u)" -eq 0 ]] && [[ -n "${SUDO_USER:-}" ]]; then
  sudo -u "${SUDO_USER}" git pull --ff-only origin main 2>/dev/null || sudo -u "${SUDO_USER}" git pull --ff-only origin develop
else
  git pull --ff-only origin main 2>/dev/null || git pull --ff-only origin develop
fi

echo "==> Каталог для webroot Let's Encrypt…"
$SUDO mkdir -p /var/www/certbot
$SUDO chmod 755 /var/www/certbot

if [[ ! -f .env ]]; then
  echo "==> Создаю .env из .env.example…"
  cp .env.example .env
fi

echo "==> Подстановка прод-настроек в .env (если ещё не заданы)…"
ORIGIN="https://${DEPLOY_DOMAIN}"
if ! grep -q '^ENVIRONMENT=' .env; then echo "ENVIRONMENT=production" >> .env; fi
sed -i.bak "s|^ENVIRONMENT=.*|ENVIRONMENT=production|" .env 2>/dev/null || true
if grep -q '^CORS_ORIGINS=' .env; then
  sed -i.bak "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${ORIGIN}|" .env
else
  echo "CORS_ORIGINS=${ORIGIN}" >> .env
fi

if grep -q 'change-me-in-production-use-long-random-string\|dev-jwt-secret-change-in-production' .env 2>/dev/null; then
  SECRET="$(openssl rand -hex 32)"
  sed -i.bak "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${SECRET}|" .env || true
  sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" .env || true
fi
if grep -q '^POSTGRES_PASSWORD=app_secret$' .env 2>/dev/null; then
  PGPASS="$(openssl rand -hex 24)"
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PGPASS}|" .env
fi
rm -f .env.bak 2>/dev/null || true

if grep -qE '^MISTRAL_API_KEY=$|^MISTRAL_API_KEY=\s*$' .env 2>/dev/null || ! grep -q '^MISTRAL_API_KEY=' .env; then
  echo "ВНИМАНИЕ: в .env не задан MISTRAL_API_KEY — чат и AI не будут работать. Отредактируйте ${APP_DIR}/.env и перезапустите: docker compose -f docker-compose.prod.yml up -d" >&2
fi

export DEPLOY_DOMAIN
echo "==> Генерация docker/nginx/nginx.prod.conf из шаблона…"
need_cmd envsubst
envsubst '${DEPLOY_DOMAIN}' < docker/nginx/nginx.prod.conf.template > docker/nginx/nginx.prod.conf

if [[ ! -f "/etc/letsencrypt/live/${DEPLOY_DOMAIN}/fullchain.pem" ]]; then
  echo "==> Выпуск сертификата Let's Encrypt (standalone, нужен свободный порт 80)…"
  docker_compose -f docker-compose.prod.yml --env-file .env down 2>/dev/null || true
  $SUDO certbot certonly --standalone \
    -d "${DEPLOY_DOMAIN}" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http
else
  echo "==> Сертификат уже есть: /etc/letsencrypt/live/${DEPLOY_DOMAIN}/ — пропускаю certbot certonly."
fi

echo "==> Сборка и запуск контейнеров…"
docker_compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "==> Статус…"
docker_compose -f docker-compose.prod.yml --env-file .env ps

RENEW_SCRIPT="/usr/local/bin/rnd-hack-certbot-renew.sh"
echo "==> Установка хука обновления сертификата: ${RENEW_SCRIPT}"
$SUDO tee "$RENEW_SCRIPT" >/dev/null <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${APP_DIR}
if docker info >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml --env-file .env stop nginx
  certbot renew --quiet
  docker compose -f docker-compose.prod.yml --env-file .env start nginx
else
  /usr/bin/docker compose -f docker-compose.prod.yml --env-file .env stop nginx
  certbot renew --quiet
  /usr/bin/docker compose -f docker-compose.prod.yml --env-file .env start nginx
fi
EOF
$SUDO chmod 755 "$RENEW_SCRIPT"

CRON_FILE="/etc/cron.weekly/rnd-hack-certbot"
echo "==> Cron: еженедельная проверка сертификата (${CRON_FILE})…"
$SUDO tee "$CRON_FILE" >/dev/null <<EOF
#!/bin/sh
${RENEW_SCRIPT} >> /var/log/rnd-hack-certbot.log 2>&1
EOF
$SUDO chmod 755 "$CRON_FILE"

if [[ -n "${SUDO_USER:-}" ]]; then
  $SUDO usermod -aG docker "${SUDO_USER}" 2>/dev/null || true
  echo "Пользователь ${SUDO_USER} добавлен в группу docker (если ещё не был). Перелогиньтесь в SSH или выполните: newgrp docker"
fi

echo ""
echo "Готово. Откройте: https://${DEPLOY_DOMAIN}"
echo "Adminer (только с сервера / SSH-туннель): http://127.0.0.1:8080"
echo "Правки .env: ${APP_DIR}/.env затем: cd ${APP_DIR} && docker compose -f docker-compose.prod.yml --env-file .env up -d"
