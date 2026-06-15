---
title: "feat: Agentic development workflow — AI Dev, AI QA, AI DevOps"
status: template
date: 2026-06-07
type: feat
origin: https://github.com/alicemq/flows
---

# feat: Agentic Development Workflow

## Summary

Establish a machine-verifiable development environment where AI Developer, AI QA, and AI DevOps agents can implement, verify, and deploy product work with minimal human intervention. This plan adds agent onboarding (`AGENTS.md`), contract-first OpenAPI, health/readiness gates, CI fixture strategy, golden-test automation, and deploy runbooks.

Adapt this plan per product. UA0–UA6 are meta-workflow units; product feature units use your own numbering.

---

## Problem Frame

Product plans define **what** to build. Many repos block **autonomous execution**:

| Blocker | Impact on agents |
| --- | --- |
| Broken boot path (empty DB, failed seed) | No reproducible baseline |
| No tests, no CI | Agents cannot get pass/fail signals |
| No OpenAPI | Contract drift; consumers cannot integrate safely |
| Tracked `node_modules` and `.env` | Toxic diffs; secret leakage |
| Port/proxy drift | Flaky integration tests |
| Background jobs coupled to API container | DevOps cannot scale API independently |
| Stale agent instructions | Wrong architectural decisions |
| Manual verification only | QA agents blocked |

**Goal:** Any agent role can start from a clean checkout, know its boundaries, produce verifiable artifacts, and hand off without human-run commands.

---

## Requirements

- A1. `AGENTS.md` MUST define AI Dev, AI QA, and AI DevOps roles with ownership, artifacts, and exit criteria.
- A2. Fresh `docker compose up` MUST expose `GET /health` (liveness) and `GET /ready` (dependency checks) returning machine-parseable JSON.
- A3. `services/api/.env.example` MUST document every env var; no secrets in git.
- A4. Root `.gitignore` MUST exclude `node_modules/`, `.env`, `dist/`, `.worktrees/`.
- A5. `.github/workflows/ci.yml` MUST run on every PR: compose config lint, unit tests, hygiene asserts, OpenAPI validate.
- A6. Golden acceptance scenarios MUST be executable from CI via fixture data without manual curl.
- A7. CI MUST use a slim fixture DB (`database/fixtures/ci_seed.sql` or equivalent), not production dumps.
- A8. OpenAPI at `services/api/openapi.yaml` MUST be the contract source of truth; HTTP changes MUST update spec in same PR.
- A9. Post-deploy smoke MUST assert `/ready` and core acceptance scenarios.
- A10. Deploy runbook MUST document deploy, rollback, env mapping, worker singleton.
- A11. Manual verification steps MUST be replaced with automated equivalents where feasible (UA6 E2E).
- A12. Cross-repo consumer contracts MUST be documented with minimum fields and auth model.
- A13. Feature flags via env MUST allow phased enable without code deploy.
- A14. `lib/*` modules MUST be testable without Express or Docker (pure unit tests).

---

## Key Technical Decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| KA1 | **UA0 precedes product units** | Agents on toxic repo state create worse damage |
| KA2 | OpenAPI skeleton before `/v1/*` implementation | Contract-first prevents rework |
| KA3 | Fixture DB curated from acceptance scenarios | Fast PR CI; trustworthy tests |
| KA4 | Golden tests assert stable ids, not display strings alone | Labels may change without breaking identity |
| KA5 | `/ready` fails when dependencies unhealthy | Catches empty-index or stale-data regression |
| KA6 | Worker exactly 1 replica in prod; API horizontally scalable | Advisory lock requires singleton worker |
| KA7 | Consumer contract tests live in API owner repo | API owner owns the surface |
| KA8 | `AGENTS.md` supersedes stale `.cursorrc` | Single source for all agent types |
| KA9 | Nightly or weekly job may run fuller data read-only | Drift detection needs production-like volume |
| KA10 | Product units and **UA0–UA6** agent units are separate | Meta-workflow vs feature delivery |

---

## Agent Role Contracts

### AI Developer

| Owns | Produces | Must NOT |
| --- | --- | --- |
| Product feature code | PR, OpenAPI diff, migrations, `lib/*` unit tests | Design CI pipelines alone |
| `.env.example` updates | Sample curls from OpenAPI | Commit secrets |
| Feature flags | PROGRESS_LOG entry per merged unit | Skip OpenAPI on HTTP changes |

**Exit criteria (per PR):** `npm test` green locally; OpenAPI updated if routes changed; hands off unit ID + env vars to QA.

### AI QA

| Owns | Produces | Must NOT |
| --- | --- | --- |
| Golden tests, contract tests, smoke scripts | `tests/*`, CI job definitions | Implement features |
| Fixture DB curation | `database/fixtures/ci_seed.sql` | Production deploy |
| Pass/fail evidence | PR comment with scenario IDs | Manual-only verification |

**Exit criteria (per unit):** All acceptance scenarios green in CI; contract covers error codes.

### AI DevOps

| Owns | Produces | Must NOT |
| --- | --- | --- |
| CI workflows, prod compose | `.github/workflows/ci.yml`, `docker-compose.prod.yml` | Product business logic |
| Health monitoring, rollback | Deploy runbook, post-deploy smoke | Golden scenario definitions |
| Secrets in deploy platform only | Rotate/rollback doc | API ranking or UX tuning |

**Exit criteria:** CI required checks on PR; `/ready` monitored; worker singleton enforced.

---

## Skill routing and issue registration

Product `AGENTS.md` (from flows template) and flows cornerstone [AGENTS.md](https://github.com/alicemq/flows/blob/main/AGENTS.md) define:

| Concern | Guidance |
| --- | --- |
| Multiple PO-listed issues | flows-coordinator skill; one subagent per issue |
| GitHub operations | gh-cli skill |
| Security-sensitive diffs | `security-review` subagent (readonly) MUST run before merge |
| Out-of-scope debt | MUST file GitHub issue (`source:ai`, `type:debt`); separate agent or slice picks up |

Agents MUST register follow-up work in the tracker; MUST NOT expand the active slice without PO approval. See flows `.cursor/rules/skill-routing.mdc` and `issue-registration.mdc`.

---

## Implementation Units

### UA0. Agent onboarding and repo hygiene

**Goal:** Clean repo state and single agent instruction doc before product work.

**Files:** `AGENTS.md`, `.gitignore`, `.cursorrc`, OpenAPI skeleton, `PROGRESS_LOG.md`, issue templates

**Verification:** `git status` shows no tracked secrets; Spectral lint passes on skeleton.

---

### UA1. Health, readiness, and env contracts

**Goal:** Machine gates for boot verification and deploy readiness.

**Files:** `services/api/routes/health.js`, `.env.example`, `docker-compose.yml`

**Approach:**
- `GET /health` → `{ status: "ok" }` always
- `GET /ready` → checks Postgres and optional dependencies; 503 when not ready
- Document ports and feature flags in env examples

---

### UA2. CI scaffold and fixture database

**Goal:** Every PR gets automated pass/fail without production data.

**Files:** `.github/workflows/ci.yml`, `database/fixtures/ci_seed.sql`, `bin/smoke-local.sh`

**Approach:** Compose lint → unit tests → hygiene asserts → optional integration with fixture

---

### UA3. Golden and contract test harness

**Goal:** Acceptance scenarios executable; QA verifies without humans.

**Files:** `tests/golden/*`, `tests/contract/openapi.test.js`, full OpenAPI spec

---

### UA4. DevOps automation and deploy runbooks

**Goal:** Deploy, smoke, and rollback without ad-hoc SSH.

**Files:** `docker-compose.prod.yml`, `docs/deploy/`, post-deploy smoke script

---

### UA5. Cross-repo consumer contract

**Goal:** Downstream integrators have pinned minimum fields and auth model.

**Files:** `docs/integrations/` or OpenAPI tags + examples

---

### UA6. Scheduled E2E and drift detection

**Goal:** Replace manual demo verification with Playwright or API E2E in CI (nightly or on main).

**Files:** `tests/e2e/`, optional scheduled workflow

---

## Extended phases (optional, from flows boilerplate)

| Phase | Goal |
| --- | --- |
| UA7 | PWA shell (manifest, service worker) |
| UA8 | Client storage tiers (localStorage → IndexedDB → sync queue) |
| UA9 | Push notification scaffold (VAPID, subscribe endpoint) |
| UA10 | GitHub discipline (labels, debt register, PR template) |

Install via flows: `./install.sh --with-pwa --with-storage --with-push`

---

## Scope Boundaries

### In scope

- Agent handbook, health/readiness, env examples, CI scaffold
- Fixture DB, golden harness, contract tests
- Deploy doc, post-deploy smoke, rollback runbook
- Repo hygiene

### Deferred

- Full visual regression suite
- Billing automation
- Multi-agent orchestration platform

---

## Verification pyramid

| Layer | Artifact | CI trigger |
| --- | --- | --- |
| L0 Static | OpenAPI Spectral, migration lint, compose config | PR |
| L1 Unit | `lib/*` tests | PR |
| L2 Golden | acceptance scenario tests | PR (fixture) + nightly (full) |
| L3 Contract | OpenAPI response shape tests | PR |
| L4 Boot smoke | `bin/smoke-local.sh` | PR subset, main full |
| L5 E2E | Playwright or API journey tests | Nightly or main |

---

## References

- flows cornerstone: https://github.com/alicemq/flows
- install: `./install.sh --target . --phase ua2`
- checklists: `docs/checklists/ua0-hygiene.md`
