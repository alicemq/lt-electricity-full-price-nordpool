#!/usr/bin/env bash
# Local smoke checks until GitHub Actions CI is fully wired (UA0/UA1 foundation).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

API_URL="${LOCAL_API_URL:-http://127.0.0.1:3000}"

echo "==> docker compose config"
bash bin/compose.sh config -q

if [[ -f docker-compose.dev.yml ]]; then
  echo "==> docker compose dev config"
  bash bin/compose.sh -f docker-compose.yml -f docker-compose.dev.yml config -q
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
  npm run build --prefix electricity-prices-build
fi

fixture_seeded=0
if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
  if curl -sf "${API_URL}/api/v1/nps/prices?date=2024-06-15&country=lt" 2>/dev/null \
    | grep -q '"count":24'; then
    fixture_seeded=1
  fi
fi

if [[ "${SMOKE_REQUIRE_READY:-0}" == "1" ]]; then
  fixture_seeded=1
fi

if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
  echo "==> GET /health OK"
  curl -sf "${API_URL}/health" | head -c 200 || true
  echo ""
  echo "    (degraded during initial sync or before Postgres is ready is expected)"

  echo "==> GET /ready"
  ready_code="$(curl -s -o /tmp/nordpool-ready.json -w '%{http_code}' "${API_URL}/ready")"
  echo "    HTTP ${ready_code}"
  head -c 200 /tmp/nordpool-ready.json || true
  echo ""

  if [[ "${fixture_seeded}" -eq 1 ]]; then
    if [[ "${ready_code}" != "200" ]]; then
      echo "FAIL: /ready HTTP ${ready_code} with CI fixture seeded (expect 200; see docs/ops/ready-slo.md)"
      exit 1
    fi
    echo "    /ready OK (fixture seeded; SMOKE_REQUIRE_READY or ci_seed detected)"
  else
    echo "    /ready non-200 tolerated before fixture seed (set SMOKE_REQUIRE_READY=1 to hard-fail)"
  fi

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
