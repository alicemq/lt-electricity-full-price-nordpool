# UA testing checklist (pyramid + E2E)

Use after UA2 (CI scaffold green). Aligns with [agentic-workflow-plan.md](../plans/agentic-workflow-plan.md) L0–L5.

## L0 — Static (PR, fast)

- [x] `docker compose config -q` in CI
- [x] OpenAPI Spectral lint (`swagger-ui/openapi.yaml`, `spectral:oas`)
- [x] Hygiene asserts: `AGENTS.md`, `openapi.yaml`, `.env.example`
- [ ] Optional: `oasdiff` breaking-change gate on PR

## L1 — Unit (PR)

- [x] Backend `npm test` (`backend/src/test.js`)
- [x] Frontend `npm test` (Vitest in `electricity-prices-build/`)
- [x] SEO sitemap route tests (`tests/seo/`)

## L2 — Golden / acceptance (fixture DB)

- [x] `tests/golden/scenarios.json` with CI domain data
- [x] `database/fixtures/ci_seed.sql` satisfies golden preconditions
- [x] `ci-integration.yml` sets `INTEGRATION_TESTS=1` with Postgres service
- [x] Golden G5: `/ready` returns `not_ready` on historical fixture

## L3 — Contract (PR + integration)

- [x] `tests/contract/openapi-samples.test.js` (OpenAPI structure, no API)
- [x] `tests/contract/live-api-samples.test.js` (`CONTRACT_LIVE=1`, `CONTRACT_FIXTURE=1` in CI integration)
- [ ] Every public path has sample or golden coverage (UA3 #101)

## L4 — Boot smoke (local + post-deploy)

- [x] `bin/smoke-local.sh`: compose lint, file asserts, optional live `/health`
- [ ] `bin/post-deploy-smoke.sh`: `/ready` + one golden scenario (#118)
- [ ] URLs from single env source (#117)

## L5 — E2E UI (scheduled + local)

- [x] `tests/e2e/smoke.spec.js` (upcoming, today, settings, legacy API)
- [x] `bin/run-e2e.sh` reads `FRONTEND_URL` from env
- [x] Playwright axe spot-checks (#120, #127)
- [ ] Required PR gate (deferred until suite stable)

## Verification commands

```bash
./bin/smoke-local.sh
npm test --prefix backend
npm test --prefix electricity-prices-build
INTEGRATION_TESTS=1 API_URL=http://127.0.0.1:3001 node tests/golden/runner.test.js
CONTRACT_LIVE=1 CONTRACT_FIXTURE=1 API_URL=http://127.0.0.1:3001 node --test tests/contract/live-api-samples.test.js
./bin/run-e2e.sh
```

## Exit criteria (UA3 + UA6)

- QA agent runs golden + contract without manual curl
- `./bin/run-e2e.sh` passes against local compose stack
- CI documents which layers run on PR vs integration vs nightly
