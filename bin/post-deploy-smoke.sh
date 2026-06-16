#!/usr/bin/env bash
# Post-deploy smoke: /health, /ready, one golden prices probe, optional frontend.
# Exits non-zero on hard failures. See docs/ops/ready-slo.md for /ready SLO.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

API_URL="${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
FRONTEND_URL="${FRONTEND_URL:-${LOCAL_FRONTEND_URL:-}}"
GOLDEN_API_PATH="${GOLDEN_API_PATH:-/api/v1/nps/prices?date=2024-06-15&country=lt}"
TIMEOUT="${TIMEOUT:-30}"

echo "==> GET ${API_URL}/health"
curl -sf --max-time "$TIMEOUT" "${API_URL}/health" | head -c 200
echo ""

echo "==> GET ${API_URL}/ready"
ready_code="$(curl -s -o /tmp/nordpool-post-ready.json -w '%{http_code}' --max-time "$TIMEOUT" "${API_URL}/ready")"
if [[ "${ready_code}" == "404" ]]; then
  ready_code="$(curl -s -o /tmp/nordpool-post-ready.json -w '%{http_code}' --max-time "$TIMEOUT" "${API_URL}/api/v1/ready")"
fi
echo "    HTTP ${ready_code}"
head -c 400 /tmp/nordpool-post-ready.json || true
echo ""
if [[ "${ready_code}" != "200" ]]; then
  echo "FAIL: /ready returned HTTP ${ready_code} (expected 200 after fixture seed)"
  exit 1
fi
if grep -q '"status":"not_ready"' /tmp/nordpool-post-ready.json 2>/dev/null; then
  echo "FAIL: /ready reports not_ready"
  exit 1
fi

if [[ -n "$GOLDEN_API_PATH" ]]; then
  golden_url="${API_URL}${GOLDEN_API_PATH}"
  echo "==> GET ${golden_url}"
  golden_json="$(curl -sf --max-time "$TIMEOUT" "$golden_url")"
  echo "$golden_json" | head -c 300
  echo ""
  if ! echo "$golden_json" | grep -q '"success":true'; then
    echo "FAIL: golden probe missing success:true (${GOLDEN_API_PATH})"
    exit 1
  fi
  echo "golden probe OK"
fi

if [[ -n "$FRONTEND_URL" ]]; then
  echo "==> GET ${FRONTEND_URL}/"
  curl -sf --max-time "$TIMEOUT" "${FRONTEND_URL}/" | head -c 120
  echo ""
fi

echo "post-deploy-smoke: OK"
