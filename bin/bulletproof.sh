#!/usr/bin/env bash
# Regression bundle: smoke-local + golden integration + optional Playwright E2E.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"
cd "$ROOT"

echo "==> smoke-local"
bash bin/smoke-local.sh

if [[ -f tests/golden/runner.test.js ]]; then
  API_URL="${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    echo "==> golden runner (integration)"
    INTEGRATION_TESTS=1 API_URL="${API_URL}" node tests/golden/runner.test.js
  else
    echo "SKIP: golden runner (API not running at ${API_URL})"
  fi
fi

API_URL="${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
if curl -sf "${API_URL}/health" >/dev/null 2>&1 && [[ -f bin/run-e2e.sh ]]; then
  echo "==> Playwright E2E (${FRONTEND_URL:-${LOCAL_FRONTEND_URL}})"
  FRONTEND_URL="${FRONTEND_URL:-${LOCAL_FRONTEND_URL}}" bash bin/run-e2e.sh --with-stack
else
  echo "SKIP: Playwright E2E (API not running at ${API_URL} or bin/run-e2e.sh missing)"
fi

echo "bulletproof: OK"
