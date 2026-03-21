#!/usr/bin/env bash
# Список моделей STT. Ключ: STT_API_KEY или по умолчанию hackaton2026
#   bash tools/fetch-stt-models.sh

set -euo pipefail
BASE="${STT_BASE_URL:-https://hackai.centrinvest.ru:6640}"
BASE="${BASE%/}"
KEY="${STT_API_KEY:-hackaton2026}"

echo "GET ${BASE}/v1/models"
echo ""
JSON=$(curl -sS "${BASE}/v1/models" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${KEY}")

if command -v jq >/dev/null 2>&1; then
  echo "$JSON" | jq .
  echo ""
  echo "=== id моделей (STT_MODEL в .env) ==="
  echo "$JSON" | jq -r '.data[]?.id? // empty'
else
  echo "$JSON"
fi
