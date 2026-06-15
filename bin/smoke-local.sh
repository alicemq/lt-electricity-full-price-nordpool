#!/usr/bin/env bash
# Local smoke checks until GitHub Actions CI is fully wired (UA0/UA1 foundation).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f deploy/local.env ]]; then
  # shellcheck disable=SC1091
  set -a
  source deploy/local.env
  set +a
fi

API_URL="${LOCAL_API_URL:-http://127.0.0.1:3000}"

echo "==> docker compose config"
docker compose config -q

if [[ -f docker-compose.dev.yml ]]; then
  echo "==> docker compose dev config"
  docker compose -f docker-compose.yml -f docker-compose.dev.yml config -q
fi

echo "==> OpenAPI file exists"
test -f swagger-ui/openapi.yaml

echo "==> AGENTS.md exists"
test -f AGENTS.md

echo "==> .env.example exists"
test -f .env.example

if command -v npm >/dev/null 2>&1; then
  echo "==> frontend build"
  npm ci --prefix electricity-prices-build
  # npx resolves local vite on Windows where bare "vite" is not on PATH in npm scripts
  npm exec --prefix electricity-prices-build -- vite build
fi

if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
  echo "==> GET /health OK"
  curl -sf "${API_URL}/health" | head -c 200 || true
  echo ""
  echo "    (degraded during initial sync or before Postgres is ready is expected)"

  echo "==> GET /api/v1/sync/status OK"
  curl -sf "${API_URL}/api/v1/sync/status" | head -c 200 || true
  echo ""

  echo "==> legacy /api/sync/status includes Deprecation header"
  legacy_headers="$(curl -sI "${API_URL}/api/sync/status")"
  echo "${legacy_headers}" | grep -qi '^Deprecation:' || { echo "missing Deprecation header on legacy path"; exit 1; }
  echo "${legacy_headers}" | grep -qi 'Link:.*successor-version' || { echo "missing Link successor-version on legacy path"; exit 1; }
else
  echo "SKIP: API not running at ${API_URL} (start with ./scripts/dev.sh or docker compose up)"
fi

if command -v node >/dev/null 2>&1 && [[ -f bin/openapi-json-from-yaml.js ]]; then
  echo "==> OpenAPI JSON sync check"
  if [[ -d backend/node_modules ]]; then
    node bin/openapi-json-from-yaml.js --check
  else
    npm ci --prefix backend >/dev/null
    node bin/openapi-json-from-yaml.js --check
  fi
fi

echo "smoke-local: OK"
