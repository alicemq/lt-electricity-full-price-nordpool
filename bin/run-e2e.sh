#!/usr/bin/env bash
# Playwright smoke against local frontend + API. Requires stack or dev server running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

cd tests/e2e

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "==> installing Playwright deps"
  npm ci
fi

export E2E_BROWSERS="${E2E_BROWSERS:-chromium}"
echo "==> ensuring Playwright browser: ${E2E_BROWSERS}"
npx playwright install "${E2E_BROWSERS}"

export FRONTEND_URL="${FRONTEND_URL:-${LOCAL_FRONTEND_URL:-http://127.0.0.1:5173}}"

resolve_api_url() {
  local candidate url
  for candidate in "${API_URL:-}" "${LOCAL_API_URL:-}" "http://127.0.0.1:3000" "http://127.0.0.1:3003"; do
    [[ -z "${candidate}" ]] && continue
    url="${candidate%/}"
    if curl -sf "${url}/health" >/dev/null 2>&1; then
      echo "${url}"
      return 0
    fi
  done
  echo "${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
}

export API_URL="$(resolve_api_url)"
export SKIP_WEB_SERVER="${SKIP_WEB_SERVER:-1}"
echo "==> Playwright E2E at ${FRONTEND_URL} (API ${API_URL}, SKIP_WEB_SERVER=${SKIP_WEB_SERVER})"
npm test
