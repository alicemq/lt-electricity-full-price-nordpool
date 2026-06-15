# Project Guidance — Electricity Prices NordPool

Operator and developer entry point. For agent-specific rules (work loop, scope gate, flows submodule), see [AGENTS.md](../AGENTS.md).

## Product and stack

**Purpose:** Containerized electricity price monitor for Baltic NordPool markets (LT, EE, LV, FI). Syncs from Elering/NordPool, serves a Vue SPA and REST API, deploys via Coolify.

| Layer | Tech | Path |
| --- | --- | --- |
| Frontend | Vue 3.5, Vite 7, Pinia | `electricity-prices-build/` |
| API | Node.js 20, Express 4.18 | `backend/` |
| Database | PostgreSQL 17 | `database/init/` (single init schema) |
| Sync | Cron in backend container | `backend/src/syncWorker.js` |
| API spec | OpenAPI 3 | `swagger-ui/openapi.yaml` |
| Deploy | Docker Compose, Coolify | `docker-compose.yml`, `COOLIFY_DEPLOYMENT.md` |

**Verify production state:** `GET /api/v1/health`, Swagger at `/api/`, `docker compose ps`. Do not trust README or empty DBs without checking.

## Local development

**Prerequisites:** Docker + Docker Compose, Node.js 20+.

```bash
git clone --recurse-submodules <repo-url>
cd lt-electricity-full-price-nordpool
```

| Mode | Start | Frontend | API |
| --- | --- | --- | --- |
| Dev | `./scripts/dev.sh` | http://localhost:5173 | http://localhost:3000 |
| Prod-like | `./scripts/prod.sh` | http://localhost:80 (nginx proxy) | via proxy only |

First run seeds `.env.development` or `.env.production` from `.env.example`. Optional port overrides: copy `deploy/local.env.example` to `deploy/local.env`.

**npm (without full stack):**

```bash
npm ci --prefix backend && npm ci --prefix electricity-prices-build
npm run build --prefix electricity-prices-build
npm test --prefix backend
npm test --prefix electricity-prices-build
```

**Smoke script (foundation checks):**

```bash
./bin/smoke-local.sh
```

Validates compose config, OpenAPI presence, frontend build, and optional live API health when stack is running.

**Fresh database:** Either wait for initial sync or restore LFS snapshot — see [docs/ops/db-backup-lfs.md](ops/db-backup-lfs.md) and issue #106.

## Testing pyramid

| Layer | What | Run locally | CI |
| --- | --- | --- | --- |
| Unit | Backend + frontend tests | `npm test --prefix backend`, `npm test --prefix electricity-prices-build` | `.github/workflows/ci.yml` (`lint-and-unit`) |
| Integration | Golden harness (Postgres + API scenarios) | See [docs/testing/golden-harness.md](testing/golden-harness.md) | `.github/workflows/ci-integration.yml` |
| SEO smoke | Sitemap routes | `node --test tests/seo/sitemap.routes.test.js` | `ci.yml` |
| E2E | Playwright (today, upcoming, settings) | `./bin/run-e2e.sh` (stack must be up) | `.github/workflows/e2e.yml` (scheduled + manual; not required on PR yet) |
| Lighthouse | Performance/a11y/SEO/PWA warn gates | `npx @lhci/cli autorun --config=electricity-prices-build/lighthouserc.json` | `.github/workflows/lighthouse.yml` |

Golden runner without Postgres exits 0 (skipped). Set `INTEGRATION_TESTS=1` and `API_URL` for real integration runs.

**Full local verification (pre-push):**

```bash
docker compose config -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml config -q
./bin/smoke-local.sh
npm test --prefix backend
npm test --prefix electricity-prices-build
node --test tests/seo/sitemap.routes.test.js
```

## Deploy and ops

| Topic | Doc |
| --- | --- |
| Coolify deploy | [COOLIFY_DEPLOYMENT.md](../COOLIFY_DEPLOYMENT.md) |
| Compose for Coolify | `docker-compose.coolify-oneclick.yml` |
| DB backup (LFS) | [docs/ops/db-backup-lfs.md](ops/db-backup-lfs.md) |
| Backup/restore cron | [docs/ops/backup-restore.md](ops/backup-restore.md) |
| Password rotation | [docs/ops/coolify-password-rotation.md](ops/coolify-password-rotation.md) |
| Push admin | [docs/ops/push-admin.md](ops/push-admin.md) |

Production secrets live in Coolify env vars, not committed YAML. Never commit `.env` files.

## Issues, PRs, and CI

**Scope gate:** Open or claim a GitHub issue before substantial work. PRs MUST reference issues (`Fixes #N` or `Refs #N`).

**Contributions:** DCO sign-off required (`git commit -s`). See [CONTRIBUTING.md](../CONTRIBUTING.md).

**Required PR checks:** Gitleaks (`secret-scan`), `lint-and-unit` (compose validate, unit tests, frontend build, OpenAPI checks). Integration job runs on backend/database/golden path changes.

**Labels:** `source:human` / `source:ai`, `type:*`, `priority:p0`–`p2`, `revamp`, `foundation`, `ci`.

**Agents:** Own delivery end-to-end (local CI, squash-merge when green, rebase stacked PRs). See [AGENTS.md](../AGENTS.md) for work loop and gap reporting.

## Revamp phase status

Checklist source: `vendor/flows/examples/nordpool-revamp-checklist.md` (read-only submodule).

```text
Blockers → UA0 → UA1 → UA2 → UA3 → UA4 → UA5 → UA6 → UA7 → UA8 → UA9 (opt) → UA10
```

| Phase | Focus | Status |
| --- | --- | --- |
| UA0 | Hygiene, AGENTS.md, gitignore, templates | Done (#2) |
| UA1 | `/ready`, env single source, nginx alignment | Partial / follow-up |
| UA2 | CI fixture DB, integration tests | Done (#4) |
| UA3+ | OpenAPI repair, golden tests, sync split, PWA | **Active** — #101 |

Next revamp slice: UA3 OpenAPI contract hygiene (#101).

## Open backlog snapshot

Captured 2026-06-16 via `gh issue list --state open --limit 20`:

| # | Title | Labels |
| --- | --- | --- |
| 106 | docs(dev): fresh DB onboarding — LFS restore vs waiting for initial sync | documentation, source:ai |
| 105 | fix(backend): /health returns degraded or throws when Postgres is not ready on startup | bug, source:ai |
| 101 | UA3: OpenAPI contract hygiene, Spectral lint, and /docs UX | enhancement, revamp, source:ai |

Live tracker: https://github.com/alicemq/lt-electricity-full-price-nordpool/issues

## Key doc links

| Doc | Purpose |
| --- | --- |
| [README.md](../README.md) | Quick start, architecture overview |
| [AGENTS.md](../AGENTS.md) | Agent handbook, module boundaries, work loop |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | DCO, contribution workflow |
| [COOLIFY_DEPLOYMENT.md](../COOLIFY_DEPLOYMENT.md) | Production deploy |
| [docs/testing/golden-harness.md](testing/golden-harness.md) | Integration test harness |
| [docs/ops/db-backup-lfs.md](ops/db-backup-lfs.md) | Portable DB snapshots |
| [docs/ops/backup-restore.md](ops/backup-restore.md) | Server backup/restore |
| [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md) | Non-AGPL use |
