#!/usr/bin/env bash
# Playwright smoke against local frontend + API.
# Modes: --frontend-only (Playwright starts Vite) or --with-stack (stack already up).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

E2E_MODE="with-stack"

usage() {
  cat <<'EOF'
Usage: bin/run-e2e.sh [OPTIONS]

Run Playwright E2E smoke tests.

Modes:
  --frontend-only   Playwright starts Vite (no Docker stack). ~10/16 tests pass
                    without API (smoke UI + settings a11y); api.spec and proxy
                    health need a running backend.
  --with-stack      Expect frontend + API already running; default. Set via
                    ./scripts/dev.sh or docker compose dev stack.

Options:
  --print-config    Print resolved URLs and mode, then exit (no tests)
  -h, --help        Show this help

Environment (optional overrides):
  FRONTEND_URL      Frontend base URL (default: LOCAL_FRONTEND_URL or :5173)
  API_URL           Backend base URL for api.spec.js (auto-detected when possible)
  SKIP_WEB_SERVER   Legacy: 1 skips Vite webServer; unset lets Playwright start Vite.
                    Mode flags take precedence over SKIP_WEB_SERVER.

Examples:
  ./bin/run-e2e.sh --frontend-only
  ./scripts/dev.sh &  ./bin/run-e2e.sh --with-stack
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend-only)
      E2E_MODE="frontend-only"
      shift
      ;;
    --with-stack)
      E2E_MODE="with-stack"
      shift
      ;;
    --print-config)
      PRINT_CONFIG=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

apply_e2e_mode() {
  case "${E2E_MODE}" in
    frontend-only)
      unset SKIP_WEB_SERVER
      ;;
    with-stack)
      export SKIP_WEB_SERVER=1
      ;;
    *)
      echo "internal error: unknown E2E_MODE=${E2E_MODE}" >&2
      exit 2
      ;;
  esac
}

apply_e2e_mode

export E2E_BROWSERS="${E2E_BROWSERS:-chromium}"
export FRONTEND_URL="${FRONTEND_URL:-${LOCAL_FRONTEND_URL:-http://127.0.0.1:5173}}"

if [[ "${PRINT_CONFIG:-}" == "1" ]]; then
  printf 'E2E_MODE=%s\n' "${E2E_MODE}"
  printf 'FRONTEND_URL=%s\n' "${FRONTEND_URL}"
  printf 'API_URL=%s\n' "${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
  if [[ -n "${SKIP_WEB_SERVER:-}" ]]; then
    printf 'SKIP_WEB_SERVER=%s\n' "${SKIP_WEB_SERVER}"
  else
    printf 'SKIP_WEB_SERVER=\n'
  fi
  exit 0
fi

resolve_api_url() {
  local candidate url
  for candidate in "${API_URL:-}" "${LOCAL_API_URL:-}" "http://127.0.0.1:3000" "http://127.0.0.1:3003"; do
    [[ -z "${candidate}" ]] && continue
    url="${candidate%/}"
    if curl -sf --connect-timeout 1 --max-time 2 "${url}/health" >/dev/null 2>&1; then
      echo "${url}"
      return 0
    fi
  done
  echo "${API_URL:-${LOCAL_API_URL:-http://127.0.0.1:3000}}"
}

export API_URL="$(resolve_api_url)"

cd tests/e2e

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "==> installing Playwright deps"
  npm ci
fi

echo "==> ensuring Playwright browser: ${E2E_BROWSERS}"
npx playwright install "${E2E_BROWSERS}"

echo "==> Playwright E2E mode=${E2E_MODE} at ${FRONTEND_URL} (API ${API_URL}, SKIP_WEB_SERVER=${SKIP_WEB_SERVER:-})"
npm test
