# Agent Handbook — Electricity Prices NordPool

**Read this first.** This repo tracks Baltic NordPool electricity prices (LT, EE, LV, FI) via a Vue 3 frontend, Express API, and PostgreSQL.

## Cornerstone: flows v0.6.2

Agent workflow patterns come from [alicemq/flows](https://github.com/alicemq/flows) **v0.6.2**. Install or refresh templates:

```bash
git clone --depth 1 --branch v0.6.2 https://github.com/alicemq/flows.git /tmp/flows
/tmp/flows/install.sh --target . --phase ua0 --project-name nordpool
```

Reference checklist: `examples/nordpool-revamp-checklist.md` in flows. Phase 0/1 (this repo) covers UA0 hygiene and partial UA1/UA2; see GitHub issues #2 (UA0), #3 (secrets), #4 (CI).

## Flows sync ritual

When flows ships a tag relevant to this adopter, sync templates before starting a new revamp slice:

1. **Pin tag** — record the flows version in this file (`Cornerstone` above). Prefer tagged releases over `main`.
2. **Upgrade** — shallow-clone the tag, run `install.sh` for the target phase only (e.g. `--phase ua0`, then `--phase ua2` when CI/env work starts). Review the diff; commit product-specific fills separately from generic template copies.
3. **Upstream gaps** — debt or missing patterns discovered during adoption MUST be filed in [flows/issues](https://github.com/alicemq/flows/issues) with `source:ai` and a link back here. Do not fork flows conventions silently in this repo.
4. **Adopter checklist** — walk `examples/nordpool-revamp-checklist.md` row by row; mark exit criteria in the matching GitHub issue or PR. Blockers table at the top requires human decisions before UA0 feature work.

## What this product is

Containerized electricity price monitor with Elering/NordPool sync, multi-country display, and Coolify deployment.

## Current state

| Area | Status | Verify with |
| --- | --- | --- |
| Database | Production | `docker compose ps`, Postgres on internal network |
| API v1 | Production | `GET /api/v1/health`, Swagger at `/api/` |
| Frontend | Vue 3.5 + Vite 7 | `npm run build` in `electricity-prices-build/` |
| CI | Foundation | `.github/workflows/ci.yml` |
| Deploy | Coolify | `COOLIFY_DEPLOYMENT.md`, `docker-compose.coolify-oneclick.yml` |

**Never trust without verification:** README claims, empty databases, stale docs.

## Stack

- **Runtime:** Node.js 20, Express 4.18 (`backend/`)
- **Database:** PostgreSQL 17 (`database/init/`, `database/migrations/`)
- **Frontend:** Vue 3.5 + Vite 7 + Pinia (`electricity-prices-build/`)
- **Sync:** Cron inside backend container (`backend/src/syncWorker.js`) — do not refactor in foundation PRs
- **Deploy:** Coolify (Docker Compose); see `COOLIFY_DEPLOYMENT.md`

## Module boundaries

```text
backend/src/           # Express API, sync worker, CLI
backend/src/v1.js      # v1 price routes (large — split planned UA5)
electricity-prices-build/src/   # Vue SPA
swagger-ui/openapi.yaml         # OpenAPI source of truth (UA3 will consolidate duplicates)
database/init/                  # Schema bootstrap
database/migrations/            # Numbered SQL migrations
```

**Do not modify in foundation/revamp phases unless explicitly scoped:**

- `backend/src/syncWorker.js`
- Sync routes in `backend/src/v1.js`
- `electricity-prices-build/src/services/*` sync/PWA code

## API surface

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /health` | None | Liveness (also `/api/v1/health`) |
| `GET /api/v1/nps/prices/...` | None | Price data |
| `GET /api/sync/status` | None | Sync worker status |
| Swagger | None | `/api/` via frontend proxy |

OpenAPI: `swagger-ui/openapi.yaml`. HTTP contract changes MUST update OpenAPI in the same PR (UA3+).

## License policy

- **Default license:** [AGPL-3.0-only](./LICENSE) (SPDX). Copyright (c) Alice MQ (alicemq).
- **Commercial use:** Closed-source or AGPL-incompatible deployment requires a separate license; see [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md).
- **Contributions:** [CONTRIBUTING.md](./CONTRIBUTING.md) requires DCO sign-off (`git commit -s`).
- **Citation:** [CITATION.cff](./CITATION.cff) for software citation metadata.
- **Staleness:** `package.json` and OpenAPI may still list MIT until a dedicated follow-up issue aligns them.

## Gap reporting (agents)

When you find a defect, missing test, doc drift, or scope gap during work and you are **not** fixing it in the current PR, you MUST open a GitHub issue (label `source:ai`, appropriate `type:*`) before ending the session. Link the issue from your PR or handoff notes.

## Secrets policy

- **Never commit** `.env`, passwords, or API keys. Use `.env.example` and `deploy/local.env.example` with `CHANGE_ME` placeholders.
- Tracked `.env.development` / `.env.production` remain in git history until a dedicated untrack PR (issue #3); new local files MUST use gitignored copies.
- Production secrets belong in Coolify env vars, not YAML in the repo.

## Local verification

```bash
docker compose config -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml config -q
./bin/smoke-local.sh
npm ci --prefix backend && npm ci --prefix electricity-prices-build
npm run build --prefix electricity-prices-build
```

Copy `deploy/local.env.example` to `deploy/local.env` for port overrides.

## DB snapshot (Git LFS)

After initial sync completes, capture a portable Postgres dump for dev/CI fixtures:

```bash
./bin/capture-db-lfs.sh          # requires initial_sync_completed
./bin/capture-db-lfs.sh --wait 3600   # poll until sync done
git lfs install && git add data/db-backup/price-data.sql.gz && git commit
```

LFS path: `data/db-backup/*.sql.gz`. Details: [docs/ops/db-backup-lfs.md](docs/ops/db-backup-lfs.md).

## Scope gate

**No issue, no work.** Before implementing features, bugs, or refactors:

1. Create or claim a GitHub issue at https://github.com/alicemq/lt-electricity-full-price-nordpool/issues
2. **User story:** *As a [role], I want [goal], so that [benefit].*
3. **Dev story:** scope, acceptance criteria, out of scope
4. **PRs** MUST use `Fixes #N` or `Refs #N`

**Exceptions:** typos in files already changed in the same PR; explicit hotfix (open follow-up issue).

## Product Owner policy

The Product Owner does **not** manually merge PRs or perform code review. Agents own quality gates and delivery.

Agents **MUST**:

- Run CI locally before pushing (`npm test`, frontend build, compose config as applicable).
- Squash-merge when required GitHub checks pass (Gitleaks, lint-and-unit, and any job marked required).
- Fix CI failures and retry; rebase dependent stacked PRs onto `main` after each merge.
- Continue the work loop without waiting for PO approval unless blocked (merge conflict, failing checks, or explicit user hold).

## Work loop (revamp and adoption)

When executing a revamp phase or adoption slice, agents MUST NOT stop after the first deliverable while scoped work remains.

1. **Pick** the next issue or checklist row from the active slice (e.g. UA0–UA2 backlog, adopter validation).
2. **Register gaps** — if you find debt or a blocker you cannot fix in the current slice, open a GitHub issue (`source:ai`) in this repo or [flows](https://github.com/alicemq/flows/issues).
3. **Fix → commit → PR** — implement, verify locally, publish; use `Fixes #N` / `Refs #N`.
4. **Merge when CI green** — squash-merge to `main` (repo default) when required checks pass, unless the user said "do not merge" or the PR needs a human review hold. Merging is not a stop point; agents continue the slice unless blocked.
5. **Rebase stacked PRs** — immediately update dependent branches onto `main`. **Merge order:** foundation/lowest stack PR first, then dependents top-down.
6. **Continue** — pick the next issue or checklist row until the slice is complete or you are blocked (document blockers in issue/PR).

The scope gate applies to each unit of work; the work loop governs sequencing across units.

## Agent roles

| Role | Owns | Exit criteria |
| --- | --- | --- |
| AI Developer | Feature code, OpenAPI, migrations | tests/build pass, spec updated |
| AI QA | Golden harness, smoke scripts | CI green, evidence in PR |
| AI DevOps | CI, compose, Coolify runbooks | required checks on PR |

## Issue tracker

**Live tracker:** https://github.com/alicemq/lt-electricity-full-price-nordpool/issues

| Label | Use |
| --- | --- |
| `source:human` | Owner request |
| `source:ai` | Agent-found debt |
| `type:debt` / `type:feature` / `type:bug` / `type:docs` | Kind of work |
| `priority:p0`–`p2` | Urgency |

## Revamp phases (flows nordpool checklist)

```text
Blockers → UA0 → UA1 → UA2 → UA3 → UA4 → UA5 → UA6 → UA7 → UA8 → UA9 (opt) → UA10
```

| Phase | Focus | This repo |
| --- | --- | --- |
| UA0 | Hygiene, AGENTS.md, gitignore, issue templates | **In progress** (#2) |
| UA1 | `/ready`, env single source, nginx alignment | Follow-up |
| UA2 | CI fixture DB, integration tests | Partial (#4) |
| UA3+ | OpenAPI repair, golden tests, sync split, PWA | Planned |

## Writing style

Avoid em dashes and filler in docs and commits. Prefer plain, verifiable statements.
