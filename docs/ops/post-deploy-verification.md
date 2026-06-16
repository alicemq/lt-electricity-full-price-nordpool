# Post-deploy verification

Scripts for validating a running stack after deploy or local seed.

## Quick smoke

```bash
# Against local compose or Coolify URL (set deploy/local.env first)
API_URL=http://127.0.0.1:3000 FRONTEND_URL=http://127.0.0.1:5173 ./bin/post-deploy-smoke.sh
```

Checks:

- `GET /health` (liveness)
- `GET /ready` (must return HTTP 200 with `status: ready`)
- Golden prices probe (`/api/v1/nps/prices?date=2024-06-15&country=lt` by default)
- Optional frontend root when `FRONTEND_URL` is set

Override the golden path:

```bash
GOLDEN_API_PATH='/api/v1/nps/prices?date=2024-06-15&country=lt' ./bin/post-deploy-smoke.sh
```

## Full regression bundle

```bash
./bin/bulletproof.sh
```

Runs `smoke-local.sh`, golden integration runner (when API is up), and Playwright E2E (when API + frontend are up).

## smoke-local /ready behavior

`bin/smoke-local.sh` tolerates `/ready` HTTP 503 before the CI fixture is seeded. It hard-fails on non-200 only when:

- `SMOKE_REQUIRE_READY=1`, or
- the API returns 24 rows for `2024-06-15` (ci_seed detected)

See [ready-slo.md](./ready-slo.md) for the readiness SLO.

## Live contract samples

```bash
# Production or dev stack with live sync data
CONTRACT_LIVE=1 API_URL=http://127.0.0.1:3000 node --test tests/contract/live-api-samples.test.js

# CI fixture DB (historical seed → /ready not_ready)
CONTRACT_LIVE=1 CONTRACT_FIXTURE=1 API_URL=http://127.0.0.1:3001 node --test tests/contract/live-api-samples.test.js
```

OpenAPI structure samples (no running API) run in CI via `tests/contract/openapi-samples.test.js` on every PR (`ci.yml`). Live contract samples run in `ci-integration.yml` when backend or contract paths change (`CONTRACT_LIVE=1 CONTRACT_FIXTURE=1`). Gate matrix: [ua-testing.md](../checklists/ua-testing.md#contract-pr-gate-ua3).

Swagger UI delivery decision: [docs/decisions/swagger-ui-delivery.md](../decisions/swagger-ui-delivery.md).
