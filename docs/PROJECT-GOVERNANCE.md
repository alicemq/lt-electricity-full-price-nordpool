# Project Governance — Electricity Prices NordPool

**For operators:** see [README.md](../README.md) (run, deploy, architecture overview).

**For agents:** see [AGENTS.md](../AGENTS.md) (work loop, verification commands, module paths).

This document is for **Product Owner review** of goals, rules, phased decisions, and open choices. It does not duplicate runbooks or agent playbooks.

**Last reviewed:** 2026-06-16

---

## 1. Product goals and success criteria

### What we are building

A containerized electricity price monitor for Baltic NordPool markets (LT, EE, LV, FI): Elering/NordPool sync, multi-country Vue SPA, REST API, Coolify deployment.

### Primary goals

| Goal | Success looks like |
| --- | --- |
| **Accurate prices** | DST- and MTU-aware data (60-min history, 15-min MTU transition); golden harness covers edge cases (UA4) |
| **Reliable sync** | Automated worker keeps DB fresh; operators can see sync status; no silent stale data in production |
| **Safe deploy** | Backend and DB not internet-exposed; secrets only in platform env; post-deploy smoke passes `/ready` + one golden scenario (UA6) |
| **Agent-maintainable** | Scope gate, debt register, revamp phases traceable to issues; agents ship without PO code review |
| **Open contract** | OpenAPI is source of truth; HTTP changes update spec in same PR (UA3+) |

### Non-goals (unless PO re-scopes)

- Contributing to or maintaining [alicemq/flows](https://github.com/alicemq/flows) as a product dependency
- Upstream flows issue filing for Nordpool-specific gaps (file in **this repo** instead)
- Large refactors of `syncWorker.js` or sync/PWA services during foundation slices
- Required E2E on every PR until Playwright suite is stable (scheduled + manual for now)

---

## 2. Rules and constraints

Normative terms use [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) (MUST, SHOULD, MAY).

### Scope gate

- **No issue, no work** for features, bugs, or refactors.
- Every PR MUST reference an issue (`Fixes #N` or `Refs #N`).
- **Exceptions:** typos in files already changed in the same PR; explicit hotfix (follow-up issue required).

### Module boundaries (do not cross without scoped issue)

| Area | Rule |
| --- | --- |
| `backend/src/syncWorker.js` | MUST NOT refactor in foundation/revamp PRs unless issue explicitly scopes it |
| Sync routes in `backend/src/v1.js` | Same as above until UA5 split |
| `electricity-prices-build/src/services/*` (sync/PWA) | Same as above until UA7+ |
| `vendor/flows/` | Read-only reference submodule; MUST NOT patch in Nordpool PRs |
| `database/init/` | Single init schema; no incremental migrations without PO-approved migration issue |
| `swagger-ui/openapi.yaml` | HTTP contract changes MUST update OpenAPI in the same PR (UA3+) |

### License and contributions

- **Default:** [AGPL-3.0-only](../LICENSE). Commercial closed-source use requires [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md).
- **Contributions:** DCO sign-off required (`git commit -s`); see [CONTRIBUTING.md](../CONTRIBUTING.md).
- **Known drift:** `package.json` and OpenAPI may still list MIT until aligned in a dedicated issue.

### Secrets

- MUST NOT commit `.env`, passwords, or API keys.
- Production secrets live in Coolify env vars, not committed YAML.
- Use `.env.example` and `deploy/local.env.example` with `CHANGE_ME` placeholders only.

### Flows reference policy

- `vendor/flows` tracks **`main`** (currently **v0.7.1**, gitlink `bc16808`).
- Refresh submodule only when PO approves a revamp slice needing newer templates.
- Run `install.sh` only when intentionally copying templates; product-specific fills are separate commits.
- Adoption gaps MUST become Nordpool issues (`source:ai`), not silent forks or upstream flows issues.

### Verification discipline

- MUST NOT trust README claims, empty databases, or stale docs without running checks.
- Agent verification commands live in [AGENTS.md](../AGENTS.md); integration harness in [docs/testing/golden-harness.md](testing/golden-harness.md).

---

## 3. Revamp phases and adopted decisions

Checklist source (read-only): [vendor/flows/examples/nordpool-revamp-checklist.md](../vendor/flows/examples/nordpool-revamp-checklist.md).

```text
Blockers → UA0 → UA1 → UA2 → UA3 → UA4 → UA5 → UA6 → UA7 → UA8 → UA9 (opt) → UA10
```

### Phase status (Nordpool, 2026-06-16)

| Phase | Focus | Status | Tracking |
| --- | --- | --- | --- |
| **Blockers** | Human decisions before feature work | **Partially open** | See §5 |
| **UA0** | Hygiene, AGENTS.md, templates, agent infra | **Mostly done**; v0.7.1 cursor rules pending | #2 closed; **#115 open** |
| **UA1** | `/ready`, env single source, nginx alignment | **Done** | `/ready` #116; env SSOT #117 |
| **UA2** | CI fixture DB, integration tests | **Done** | #4; golden harness, `ci-integration.yml` |
| **UA3** | OpenAPI repair, Spectral, `/docs` UX | **In progress** | #101; Spectral `spectral:oas` (#128); live contract CI (#136); **#122** closed |
| **UA4** | Golden price / DST / MTU harness | **Planned** | Product golden data in-repo |
| **UA5** | Split `syncWorker.js`, advisory lock | **Planned** | Blocked on worker architecture decision |
| **UA6** | Post-deploy smoke, Coolify runbook | **Done** | #118; [docs/ops/post-deploy-verification.md](ops/post-deploy-verification.md) |
| **UA7–UA8** | PWA shell, client storage tiers | **Planned** | Not installed |
| **UA9** | Push scaffold | **Optional** | Not started |
| **UA10** | Debt register, checklists, adoption log | **In progress** | **#119**; register + `ua-testing` checklist landed; `PROGRESS_LOG.md` active |

### Decisions already made

| Decision | Choice | Rationale |
| --- | --- | --- |
| Deploy target | **Coolify** (Docker Compose) | Runbook: [COOLIFY_DEPLOYMENT.md](../COOLIFY_DEPLOYMENT.md) |
| API layout | **legacy-api-backend** (`backend/`, inline worker) | Matches existing compose; flows `--layout legacy-api-backend` |
| Frontend path | `electricity-prices-build/` | Historical; flows templates use `--frontend-dir` |
| OpenAPI location | `swagger-ui/openapi.yaml` | Single source pending UA3 consolidation of duplicates |
| CI integration | Fixture DB + golden runner | UA2 exit met (#4) |
| Fresh DB onboarding | LFS restore **or** wait for initial sync | Documented in README; #106 closed via #121 |
| E2E gate | Scheduled + `workflow_dispatch`; not required on PR | Until suite stable |
| PO code review | **Agents own merge** when required checks green | Unless PO says "do not merge" or hold |

### Adopted from flows v0.7.1

| Pattern | Nordpool location |
| --- | --- |
| AGENTS.md handbook | Root `AGENTS.md` (partial v0.7 ship-by-default sync pending #115) |
| smoke-local | `bin/smoke-local.sh` |
| Git LFS DB snapshot | `bin/capture-db-lfs.sh`, `docs/ops/db-backup-lfs.md` |
| Release window sync | `backend/src/lib/sync/`, frontend `releaseWindow.js` |
| Revamp checklist (local) | `vendor/flows/examples/nordpool-revamp-checklist.md` |
| Spectral baseline (UA3 quick-win) | `.spectral.yaml`, CI in `lint-and-unit` (#123) |

### Not yet adopted from flows v0.7.1

| Pattern | Blocker / issue |
| --- | --- |
| Full cursor rules + `quality-gates.mdc` | #115 |
| `flows-coordinator` skill | #115 |
| `debt.yml` issue template | #115 |
| `STRATEGY.md`, `PROGRESS_LOG.md` | #115, #119 |
| `GET /ready` + freshness SLO | **Done** — [docs/ops/ready-slo.md](ops/ready-slo.md); #116 closed |
| `load-env.sh` / `compose.sh` single source | **Done** — #117; [PROJECT-GUIDANCE.md](PROJECT-GUIDANCE.md) |
| `post-deploy-smoke.sh`, `bulletproof.sh` | **Done** — #118 |
| `review-debt-register.md`, ua checklists | #119 |
| Full `spectral:oas` ruleset | Spectral crash; #122 |
| Worker split + advisory lock | PO decision §5; UA5 |

### Intentionally product-specific (not upstreamed to flows)

Price charts/color bands, screen layout editor, MTU completeness golden data, SERP/prerender choices, domain SEO — per checklist adoption section.

---

## 4. Agent directives and quality gates

Detail and commands: [AGENTS.md](../AGENTS.md). Cursor rules (when #115 lands): `.cursor/rules/`.

### Operating model

| Role | Responsibility |
| --- | --- |
| **Product Owner** | Outcomes, priorities, acceptance criteria; resolves §5 decisions |
| **Agent** | Dev + QA + DevOps: implement, verify, ship; MUST NOT stall on optional polish |

### Ship-by-default

- **Done** means verified **and** published (commit, push, PR; squash-merge when required CI green).
- User-level IDE rules ("commit only when asked") MUST NOT override workspace ship-by-default in AGENTS.md.
- **Skip ship only** on explicit PO signals: "do not commit", "local only", "analyze only", or true blocker.

### Coordinator model (multi-issue requests)

When PO lists **2+ separate issues**, coordinating agent MUST:

1. Scope-gate each issue before delegation
2. Spawn **one work subagent per issue** (never one subagent for multiple PO-listed items)
3. Re-run quality gates on **combined** tree after synthesis
4. Run security review when triggered (auth, secrets, public endpoints, `type:security`)
5. Spawn **one ship subagent** for a single PR; coordinator MUST NOT commit/push when work subagents ran

### Debt registration

Agents MUST open a GitHub issue (`source:ai`, appropriate `type:*`) when finding defects, missing tests, or scope gaps they are **not** fixing in the current PR. MUST NOT file flows upstream for Nordpool domain gaps.

### Required PR checks (today)

Gitleaks (`secret-scan`), `lint-and-unit` (compose validate, unit tests, frontend build, OpenAPI checks). Integration job on backend/database/golden path changes. E2E and Lighthouse: informative, not required merge gates yet.

### Post-revamp-backlog gate

When open revamp issues = 0 (or only operator-blocked, e.g. #34 password rotation): full verification, expand E2E, file new `source:ai` issues for failures, re-enter work loop.

---

## 5. Open decisions needing PO input

These match the checklist **Blockers** table. Agents MUST NOT assume a default for rows marked **OPEN** without PO confirmation.

| # | Decision | Options | Status |
| --- | --- | --- | --- |
| 1 | **Sync admin API** | Restore `sync/trigger` + `sync/status` vs deprecate and rewrite docs | **OPEN** — OpenAPI drift (UA3) |
| 2 | **Worker architecture** | Keep cron inside API container vs split `services/worker` | **OPEN** — blocks UA5 |
| 3 | **`/ready` SLO** | Postgres only vs price data freshness vs initial sync complete | **DECIDED: Postgres + 24h price freshness** — see [docs/ops/ready-slo.md](ops/ready-slo.md); #116 closed |
| 4 | **Secrets rotation** | Rotate keys that lived in tracked `.env` files | **Operator-blocked** — #34 |
| 5 | **Deploy target** | Coolify vs CapRover | **DECIDED: Coolify** |

**PO action requested:** Confirm rows 1–3 so UA1, UA3, and UA5 slices can proceed without rework.

---

## 6. Backlog priorities (as decisions, not file lists)

Ordered by revamp dependency and PO impact. Live tracker: https://github.com/alicemq/lt-electricity-full-price-nordpool/issues

### P1 — Unblock revamp foundation

| Issue | Decision / outcome needed |
| --- | --- |
| **#115** | Adopt flows v0.7.1 agent infra (cursor rules, debt template, PROGRESS_LOG) — **prerequisite for consistent autonomous shipping** |
| **#116** | Define and implement `/ready` SLO (depends on §5 row 3) |
| **#101** | Complete UA3 OpenAPI contract hygiene (Spectral full ruleset blocked by #122) |

### P2 — Operational reliability and env consistency

| Issue | Decision / outcome needed |
| --- | --- |
| **#105** | Startup `/health` behavior when Postgres not ready — degraded vs hard fail |
| **#117** | Single env loading path for scripts, compose, E2E |
| **#118** | Post-deploy smoke bundle (after `/ready`) |
| **#119** | Debt register + UA checklists for auditable revamp progress |

### P2 — Quality and UX (parallel when foundation stable)

| Issue | Decision / outcome needed |
| --- | --- |
| **#122** | Resolve Spectral `spectral:oas` crash or switch lint strategy |
| **#120** | A11y spot-checks in scheduled E2E |
| **#124** | Bottom nav settings after today→upcoming chain (product bug) |

### Recently closed (context)

| Issue | Outcome |
| --- | --- |
| **#106** / **#121** | Fresh DB onboarding documented (LFS restore path) |
| **#123** | UA3 quick-win: Spectral baseline in CI |

### Active slice (agent default)

**UA3 OpenAPI** (#101, #122) after **#115** lands; **UA1 env** (#117) and **UA6 post-deploy smoke** (#118) after `/ready` SLO decision (§5 row 3 decided).

---

## 7. Historical documentation

[documentation/project_planning.md](../documentation/project_planning.md) records the 2024 migration (architecture diagrams, performance notes, usage commands). It is **historical context**, not governance. Prefer this document for rules and phase decisions; prefer README for how to run the stack.

---

## 8. Related documents (links only)

| Document | Purpose |
| --- | --- |
| [README.md](../README.md) | Quick start, architecture, local run |
| [AGENTS.md](../AGENTS.md) | Agent handbook, verification commands |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | DCO, contribution workflow |
| [COOLIFY_DEPLOYMENT.md](../COOLIFY_DEPLOYMENT.md) | Production deploy |
| [docs/testing/golden-harness.md](testing/golden-harness.md) | Integration test harness |
| [docs/ops/db-backup-lfs.md](ops/db-backup-lfs.md) | Portable DB snapshots |
| [vendor/flows/examples/nordpool-revamp-checklist.md](../vendor/flows/examples/nordpool-revamp-checklist.md) | UA0–UA10 task reference (read-only) |
