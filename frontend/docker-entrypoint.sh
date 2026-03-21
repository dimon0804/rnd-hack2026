#!/bin/sh
set -e
cd /app

# Том node_modules может быть старым (до добавления pptxgenjs и др.). Сверяем хэш lock-файла.
SYNC_FILE="node_modules/.deps-sync.sha256"
LOCK_FILE="package-lock.json"

if [ ! -f "$LOCK_FILE" ]; then
  echo "frontend: нет package-lock.json" >&2
  exit 1
fi

HASH="$(sha256sum "$LOCK_FILE" | cut -d' ' -f1)"
if [ ! -f "$SYNC_FILE" ] || [ "$(cat "$SYNC_FILE" 2>/dev/null)" != "$HASH" ]; then
  echo "frontend: синхронизация node_modules (npm ci)…"
  npm ci --no-audit --no-fund
  echo "$HASH" > "$SYNC_FILE"
fi

exec "$@"
