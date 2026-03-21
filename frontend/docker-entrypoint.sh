#!/bin/sh
set -e
cd /app

# Как в Dockerfile: длинные сети к registry не обрываем слишком рано (видно в логах compose).
export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-300000}"
export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
export NPM_CONFIG_PROGRESS="${NPM_CONFIG_PROGRESS:-true}"

# Том node_modules может быть старым (до добавления зависимостей). Сверяем хэш lock-файла.
SYNC_FILE="node_modules/.deps-sync.sha256"
LOCK_FILE="package-lock.json"

if [ ! -f "$LOCK_FILE" ]; then
  echo "frontend: нет package-lock.json" >&2
  exit 1
fi

HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
# POSIX sh: нельзя ${HASH:0:12} (это bash) — иначе dash: «Bad substitution».
HASH_SHORT="$(printf '%s' "$HASH" | cut -c1-12)"
if [ ! -f "$SYNC_FILE" ] || [ "$(cat "$SYNC_FILE" 2>/dev/null)" != "$HASH" ]; then
  echo "frontend: синхронизация node_modules (npm ci), lock ${HASH_SHORT}…"
  npm ci --no-audit --no-fund --loglevel=info
  echo "$HASH" > "$SYNC_FILE"
  echo "frontend: node_modules синхронизированы."
fi

exec "$@"
