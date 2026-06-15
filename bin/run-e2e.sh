#!/usr/bin/env bash
# Playwright smoke against local frontend + API. Requires stack or dev server running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if [[ -f deploy/local.env ]]; then
  # shellcheck disable=SC1091
  set -a
  source deploy/local.env
  set +a
fi

cd tests/e2e

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "==> installing Playwright deps"
  npm ci
fi

export E2E_BROWSERS="${E2E_BROWSERS:-chromium}"
echo "==> ensuring Playwright browser: ${E2E_BROWSERS}"
npx playwright install "${E2E_BROWSERS}"

export FRONTEND_URL="${FRONTEND_URL:-${LOCAL_FRONTEND_URL:-http://127.0.0.1:5173}}"
export API_URL="${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
export SKIP_WEB_SERVER="${SKIP_WEB_SERVER:-1}"
echo "==> Playwright E2E at ${FRONTEND_URL} (API ${API_URL}, SKIP_WEB_SERVER=${SKIP_WEB_SERVER})"
npm test
