# Agent Handbook — Electricity Prices NordPool

**Read this first.** This repo tracks Baltic NordPool electricity prices (LT, EE, LV, FI) via a Vue 3 frontend, Express API, and PostgreSQL. Canonical strategy: `STRATEGY.md`. Workflow rules: `docs/plans/agentic-workflow-plan.md`.

## Scope

### In scope

- Nordpool application: Vue frontend, Express API, PostgreSQL, PWA, sync worker, Coolify deploy
- Nordpool issues, PRs, CI, and revamp phases (UA0–UA10 checklist adapted locally)

### Out of scope

- Contributing to [alicemq/flows](https://github.com/alicemq/flows): no flows issues, PRs, or releases from this project unless the Product Owner explicitly requests it
- Treating flows as a dependency to maintain or upgrade on a schedule
- Reporting adoption gaps upstream to flows (file a Nordpool issue instead)

## Hybrid flows reference (read-only)

Agent workflow patterns were borrowed from [alicemq/flows](https://github.com/alicemq/flows) **`v0.7.1`** (`vendor/flows` at `bc16808`). Flows is reference material only, not a product dependency.

- **Tracking policy:** `vendor/flows` submodule follows **`main`** (default branch), not a detached tag
- **Local copy:** git submodule at `vendor/flows` — read handbook and templates there (`vendor/flows/README.md`, `vendor/flows/examples/nordpool-revamp-checklist.md`)
- **Refresh to latest:** `git submodule update --remote vendor/flows` (commit the updated gitlink when refreshing intentionally)
- **Clone without submodule:** `git clone --depth 1 https://github.com/alicemq/flows.git ../flows` (one-time; optional)
- **Template sync:** run `install.sh` only when intentionally copying templates into Nordpool:

```bash
git submodule update --init vendor/flows   # if submodule not checked out
git submodule update --remote vendor/flows # optional: pull latest main before install
vendor/flows/install.sh --target . --layout legacy-api-backend \
  --frontend-dir electricity-prices-build --phase ua0 --project-name nordpool
```

Do **not** open Nordpool work to maintain or patch `vendor/flows`. Refresh the submodule when a PO-approved revamp slice needs newer handbook or templates; otherwise read whatever commit is recorded in the parent repo.

Reference checklist: `vendor/flows/examples/nordpool-revamp-checklist.md`. Phase 0/1 (this repo) covers UA0 hygiene and partial UA1/UA2; see GitHub issues #2 (UA0), #3 (secrets), #4 (CI).

## Flows sync ritual

When reviewing whether to refresh templates before a new revamp slice:

1. **Refresh check (optional)** — run `git submodule update --remote vendor/flows` and review the diff; commit the gitlink when adopting newer templates.
2. **Read local reference** — use `vendor/flows` (submodule on `main`); upstream handbook lives at [alicemq/flows](https://github.com/alicemq/flows/tree/main).
3. **Copy-in when needed** — run `vendor/flows/install.sh --layout legacy-api-backend --frontend-dir electricity-prices-build` for the target phase only. Review the diff; commit product-specific fills separately from generic template copies.
4. **Nordpool gaps only** — debt or missing patterns discovered during adoption MUST be filed in [this repo's issues](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues) with `source:ai`. Do not fork flows conventions silently here.
5. **Adopter checklist** — walk `vendor/flows/examples/nordpool-revamp-checklist.md` row by row; mark exit criteria in the matching Nordpool issue or PR. Blockers table at the top requires human decisions before UA0 feature work.

No flows repo work (issues, PRs, releases) from Nordpool unless PO explicitly requests it.

## What this product is

Containerized electricity price monitor with Elering/NordPool sync, multi-country display, and Coolify deployment.

## Current state

| Area | Status | Verify with |
| --- | --- | --- |
| Database | Production | `docker compose ps`, Postgres on internal network |
| API v1 | Production | `GET /api/v1/health`, Swagger at `/api/` |
| Frontend | Vue 3.5 + Vite 7 | `npm run build` in `electricity-prices-build/` |
| CI | Foundation + integration | `.github/workflows/ci.yml`, `.github/workflows/ci-integration.yml` |
| Deploy | Coolify | `COOLIFY_DEPLOYMENT.md`, `docker-compose.coolify-oneclick.yml` |

**Never trust without verification:** README claims, empty databases, stale docs.

## Stack

- **Runtime:** Node.js 20, Express 4.18 (`backend/`)
- **Database:** PostgreSQL 17 (`database/init/` — single init schema, no incremental migrations)
- **Frontend:** Vue 3.5 + Vite 7 + Pinia (`electricity-prices-build/`)
- **Sync:** Cron inside backend container (`backend/src/syncWorker.js`) — do not refactor in foundation PRs
- **Deploy:** Coolify (Docker Compose); see `COOLIFY_DEPLOYMENT.md`

## Module boundaries

```text
backend/src/                    # Express API, sync worker, CLI
backend/src/v1.js               # v1 price routes (large — split planned UA5)
electricity-prices-build/src/   # Vue SPA
swagger-ui/openapi.yaml         # OpenAPI source of truth (UA3 will consolidate duplicates)
database/init/                  # Schema bootstrap (single source of truth)
vendor/flows/                   # Read-only flows reference on main (submodule; do not patch)
```

**Do not modify in foundation/revamp phases unless explicitly scoped:**

- `backend/src/syncWorker.js`
- Sync routes in `backend/src/v1.js`
- `electricity-prices-build/src/services/*` sync/PWA code

## API surface

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /health` | None | Liveness (also `/api/v1/health`) |
| `GET /ready` | None | Readiness: Postgres + 24h price freshness (also `/api/v1/ready`) |
| `GET /api/v1/nps/prices/...` | None | Price data |
| `GET /api/sync/status` | None | Sync worker status |
| Swagger | None | `/api/` via frontend proxy |

OpenAPI: `swagger-ui/openapi.yaml`. HTTP contract changes MUST update OpenAPI in the same PR (UA3+).

Golden integration harness (Postgres fixture + API scenarios): see [docs/testing/golden-harness.md](docs/testing/golden-harness.md).

## License policy

- **Default license:** [AGPL-3.0-only](./LICENSE) (SPDX). Copyright (c) Alice MQ (alicemq).
- **Commercial use:** Closed-source or AGPL-incompatible deployment requires a separate license; see [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md).
- **Contributions:** [CONTRIBUTING.md](./CONTRIBUTING.md) requires DCO sign-off (`git commit -s`).
- **Citation:** [CITATION.cff](./CITATION.cff) for software citation metadata.
- **Staleness:** `package.json` and OpenAPI may still list MIT until a dedicated follow-up issue aligns them.

## Gap reporting (agents)

When you find a defect, missing test, doc drift, or scope gap during work and you are **not** fixing it in the current PR, you MUST open a GitHub issue in **this repo** (label `source:ai`, appropriate `type:*`) before ending the session. Link the issue from your PR or handoff notes. Do not file flows upstream issues from Nordpool work.

## Secrets policy

- **Never commit** `.env`, passwords, or API keys. Use `.env.example` and `deploy/local.env.example` with `CHANGE_ME` placeholders.
- Live `.env`, `.env.development`, and `.env.production` are gitignored; copy from `.env.example` locally (`./scripts/dev.sh` and `./scripts/prod.sh` seed on first run).
- Production secrets belong in Coolify env vars, not YAML in the repo.

## Local verification

```bash
docker compose config -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml config -q
./bin/smoke-local.sh
npm ci --prefix backend && npm ci --prefix electricity-prices-build
npm run build --prefix electricity-prices-build
npm test --prefix backend
npm test --prefix electricity-prices-build
node --test tests/seo/sitemap.routes.test.js
```

Copy `deploy/local.env.example` to `deploy/local.env` for port overrides.

## DB snapshot (Git LFS)

After initial sync completes, capture a portable Postgres dump for dev/CI fixtures:

```bash
./bin/capture-db-lfs.sh          # requires initial_sync_completed
./bin/capture-db-lfs.sh --wait 3600   # poll until sync done
git lfs install && git add data/db-backup/price-data.sql.gz && git commit
```

LFS path: `data/db-backup/*.sql.gz`. Capture: [docs/ops/db-backup-lfs.md](docs/ops/db-backup-lfs.md). Restore and server cron: [docs/ops/backup-restore.md](docs/ops/backup-restore.md) (`bin/restore-db-lfs.sh`, `bin/server-backup.sh`).

## Scope gate

**No issue, no work.** Before implementing features, bugs, or refactors:

1. Create or claim a GitHub issue at https://github.com/alicemq/lt-electricity-full-price-nordpool/issues
2. **User story:** *As a [role], I want [goal], so that [benefit].*
3. **Dev story:** scope, acceptance criteria, out of scope
4. **PRs** MUST use `Fixes #N` or `Refs #N`

**Exceptions:** typos in files already changed in the same PR; explicit hotfix (open follow-up issue).

## Delivery (done means shipped)

**Done** means verified **and** published: commit, push, and open or update a PR (or merge when CI is green unless the PO said "do not merge"). Leaving substantial completed work uncommitted or unpushed is a **flow bug**.

### Shipping precedence

| Precedence | Rule |
| --- | --- |
| **Default** | Solo agent or coordinator → ship subagent MUST commit, push, and open or update PR |
| **Explicit PO skip only** | "do not commit", "local only", "analyze only" — skip commit/push; document skip reason |
| **User-level IDE rules** | MUST NOT override workspace ship-by-default (e.g. "commit only when asked" does not apply here) |

### Who ships

| Role | Shipping duty |
| --- | --- |
| **Solo agent** (no delegation) | MUST commit, push, and open or update PR after quality gates pass |
| **Work subagent** | MUST verify locally and report done or blockers; MUST NOT commit, push, or open PRs when a coordinator is active |
| **Coordinator** (multi-issue delegation) | After synthesis and integration gates, MUST spawn **one** ship subagent; MUST NOT commit, push, or open PR directly when work subagents were spawned |
| **Ship subagent** | Single PR per slice; owns loop-on-ci after push until checks pass or blocked |

## Product Owner policy

The Product Owner does **not** manually merge PRs or perform code review. Agents own quality gates and delivery.

Agents **MUST**:

- Run CI locally before pushing (`npm test`, frontend build, compose config as applicable).
- Squash-merge when required GitHub checks pass (Gitleaks, lint-and-unit, and any job marked required).
- Fix CI failures and retry; rebase dependent stacked PRs onto `main` after each merge.
- Continue the work loop without waiting for PO approval unless blocked (merge conflict, failing checks, or explicit user hold).

### Product Owner operating model

| Role | Responsibility |
| --- | --- |
| **Product Owner (PO)** | Outcomes, priorities, acceptance criteria |
| **Agent** | Full DevOps + fullstack; technical decisions without PO unless blocked |

Agents MUST decide implementation details autonomously. Ask the PO only for ambiguous acceptance criteria, priority conflicts, scope expansion, irreversible product choices, or missing access.

Agents MUST NOT ask the PO to confirm optional polish, housekeeping, or obvious follow-ups from completed work. Same files already in slice and within acceptance criteria → implement now; otherwise register a `source:ai` debt issue. Agents MUST NOT end with "do you want me to…?" unless the choice is a product decision, irreversible posture change, or true blocker.

### Polish decision tree

| Condition | Action |
| --- | --- |
| Same files already in the current slice **and** within stated acceptance criteria | Implement now |
| Touches files or scope outside current AC, or unrelated refactor | Register `source:ai` `type:debt` issue in this repo; do not expand slice |
| Product decision or irreversible posture change | Ask PO once |

## Work loop (revamp and adoption)

When executing a revamp phase or adoption slice, agents MUST NOT stop after the first deliverable while scoped work remains.

1. **Pick** the next issue or checklist row from the active slice (e.g. UA0–UA2 backlog, local revamp validation).
2. **Scope gate** — open or claim a GitHub issue for each unit before non-trivial work.
3. **Register gaps** — if you find debt or a blocker you cannot fix in the current slice, open a GitHub issue (`source:ai`) in **this repo only**.
4. **Fix → verify → ship** — work subagents implement and verify locally; coordinator re-runs gates on combined tree, runs security-review when triggered, then spawns one ship subagent to commit, push, and open or update PR once (`Fixes #N` / `Refs #N`). Solo agent (no delegation) owns ship directly. **Done** includes published PR unless explicit PO skip; user-level IDE commit-only rules MUST NOT override ship-by-default.
5. **Merge when CI green** — squash-merge to `main` when required checks pass, unless the PO said "do not merge". Ship subagent (or coordinator fallback) owns loop-on-ci after push until green or blocked.
6. **Rebase stacked PRs** — immediately update dependent branches onto `main`. **Merge order:** foundation/lowest stack PR first, then dependents top-down. When a stack spans backend and frontend, merge backend PRs before frontend PRs so proxy routes and API contracts land first (see #50).
7. **Continue** — pick the next issue or checklist row until the slice is complete or blocked (document blockers; register debt before PO escalation on secrets).

The scope gate applies to each unit of work; the work loop governs sequencing across units.

### Post-backlog phase

When open revamp issues = 0 (or only operator-blocked, e.g. #34 password rotation):

1. **Run full verification** — `docker compose config -q`, backend tests, frontend build, `./bin/smoke-local.sh`
2. **Run/add E2E (Playwright)** — today, upcoming, settings, legacy API headers; adapt patterns from `vendor/flows/components/e2e-playwright/` (read-only)
3. **File new issues** for any failures or gaps found (`source:ai`); never stop silently
4. **Re-enter work loop** on new issues until the next test gate

E2E lives in `tests/e2e/`; local runner `./bin/run-e2e.sh`; CI workflow `.github/workflows/e2e.yml` (scheduled + `workflow_dispatch`, not a required PR gate until stable).

## Subagent delegation

When the PO lists **multiple separate issues or tasks**, the coordinating agent MUST spawn **one subagent per issue**. Never assign one subagent multiple PO-listed items.

**Example:** PO says "fix login bug and add export button" → scope gate per issue → work subagent A (login only) + work subagent B (export only), parallel when independent; coordinator synthesizes, integration-verifies combined tree, security-reviews if triggered, spawns one ship subagent; coordinator MUST NOT ship directly.

Work subagents return done (verification evidence) or structured blockers. They MUST NOT commit, push, or open PRs when a coordinator is active. Coordinator owns scope gate, sequencing, file-conflict avoidance, integration verification, PO-facing summary, and spawning the ship subagent.

Skill reference: [.cursor/skills/flows-coordinator/SKILL.md](.cursor/skills/flows-coordinator/SKILL.md).

## Skill and subagent routing

| Trigger | Use |
| --- | --- |
| PO lists 2+ separate tasks | flows-coordinator skill; one subagent per issue |
| GitHub issues, PRs, checks, merge | gh-cli skill |
| Ship after verified work (solo agent or coordinator synthesis) | ce-commit-push-pr skill as ship subagent (skip only on explicit PO skip signals) |
| Substantial or risky diff before PR | ce-code-review or code-reviewer subagent |
| Security review requested or security surface changed (see MUST triggers) | review-security skill or security-review subagent (readonly); MUST after synthesis, before ship subagent |
| Test failure or bug | ce-debug or systematic-debugging skill |
| Prior learning in `docs/solutions/` | ce-learnings-researcher skill |
| PR CI failing after push | fix-ci or loop-on-ci skill — ship subagent owns |

**MUST triggers for `security-review` before merge:** auth middleware; API keys or secrets handling; public unauthenticated endpoints; PII handling; payment flows; issues labeled `type:security`.

Agents MUST pick the matching row; MUST NOT ask the PO to choose libraries or paths.

## Issue registration

When debt, follow-up, or cross-track work is found outside the current slice, agents MUST open a GitHub issue in **this repo** and MUST NOT expand scope silently. Do not file flows upstream issues from Nordpool work.

1. **Create** — `gh issue create` or debt/feature/bug template under `.github/ISSUE_TEMPLATE/`.
2. **Labels** — `source:ai` + `type:debt|bug|feature|docs|security` + `priority:p0`–`p2` when known.
3. **Body** — user story, dev story, **Found during:** `#N` or PR, **Suggested owner:** Dev | QA | DevOps | security follow-up.
4. **Report** — `Debt filed: #N` in PR or coordinator summary.

**MAY fix inline:** typos in files already touched in the same PR.

## Agent roles

| Role | Owns | Exit criteria |
| --- | --- | --- |
| AI Developer | Feature code, OpenAPI, migrations | tests/build pass, spec updated |
| AI QA | Golden harness, smoke scripts | CI green, evidence in PR |
| AI DevOps | CI, compose, Coolify runbooks | required checks on PR |

Log shipped work in `PROGRESS_LOG.md` (brief entries, date + PR + issue #).

## Docs hierarchy

| Doc | Use |
| --- | --- |
| `STRATEGY.md` | Why and where we invest |
| `docs/plans/*` | Feature and workflow plans |
| `docs/improvement-backlog.md` | Prioritized ideas |
| `docs/review-debt-register.md` | Tech debt index |
| `documentation/project_planning.md` | Legacy product planning reference |

## Issue tracker

**Live tracker:** https://github.com/alicemq/lt-electricity-full-price-nordpool/issues

**Index:** `docs/review-debt-register.md`

| Label | Use |
| --- | --- |
| `source:human` | Owner request |
| `source:ai` | Agent-found debt |
| `type:debt` / `type:feature` / `type:bug` / `type:docs` / `type:security` | Kind of work |
| `priority:p0`–`p2` | Urgency |

## Revamp phases (flows nordpool checklist)

```text
Blockers → UA0 → UA1 → UA2 → UA3 → UA4 → UA5 → UA6 → UA7 → UA8 → UA9 (opt) → UA10
```

| Phase | Focus | This repo |
| --- | --- | --- |
| Blockers | Human decisions before feature work | Partially open — see `docs/PROJECT-GOVERNANCE.md` §5 |
| UA0 | Hygiene, AGENTS.md, gitignore, issue templates | **Done** (#2, #115) |
| UA1 | `/ready`, env single source, nginx alignment | **Done** (#116, #117) |
| UA2 | CI fixture DB, integration tests | **Done** (#4) — `database/fixtures/ci_seed.sql`, golden runner, `ci-integration.yml` |
| UA3 | OpenAPI repair, Spectral, `/docs` UX | **Done** (#101; #146, #147) |
| UA4 | Golden price / DST / MTU harness | **Planned** — next default slice |
| UA5 | Split `syncWorker.js`, advisory lock | **Planned** — blocked on worker architecture (§5) |
| UA6 | Post-deploy smoke, Coolify runbook | **Done** (#118) |
| UA7–UA8 | PWA shell, client storage tiers | **Planned** |
| UA9 | Push scaffold | **Optional** — not started |
| UA10 | Debt register, checklists, adoption log | **Done** (#119) |

Checklist source: `vendor/flows/examples/nordpool-revamp-checklist.md` (read-only reference). Phase status detail: `docs/PROJECT-GOVERNANCE.md` §3. Post-backlog (2026-06-16): open revamp issues = 0; default next work is UA4.

## Writing style

Avoid em dashes and filler in docs and commits. Prefer plain, verifiable statements.

Agents MUST match the user's language and MUST NOT switch language unless the user explicitly asks. Installed via `.cursor/rules/language-matching.mdc` from flows `install.sh`.
