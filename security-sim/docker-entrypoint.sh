#!/bin/sh
set -e
cd /app

export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-300000}"
export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
export NPM_CONFIG_PROGRESS="${NPM_CONFIG_PROGRESS:-true}"

SYNC_FILE="node_modules/.deps-sync.sha256"

if [ -f package-lock.json ]; then
  REF_FILE="package-lock.json"
  HASH="$(sha256sum "$REF_FILE" | awk '{print $1}')"
else
  REF_FILE="package.json"
  HASH="$(sha256sum "$REF_FILE" | awk '{print $1}')"
fi

HASH_SHORT="$(printf '%s' "$HASH" | cut -c1-12)"
if [ ! -f "$SYNC_FILE" ] || [ "$(cat "$SYNC_FILE" 2>/dev/null)" != "$HASH" ]; then
  echo "security-sim: синхронизация node_modules ($REF_FILE ${HASH_SHORT}…)…"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund --loglevel=info
  else
    npm install --no-audit --no-fund --loglevel=info
  fi
  echo "$HASH" > "$SYNC_FILE"
  echo "security-sim: node_modules готовы."
fi

exec "$@"
