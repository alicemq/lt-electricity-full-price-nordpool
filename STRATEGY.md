---
name: lt-electricity-full-price-nordpool
last_updated: 2026-06-16
---

# Electricity Prices NordPool Strategy

## Target problem

Households and small businesses in the Baltic states and Finland need timely, trustworthy NordPool electricity price data to plan consumption, compare countries, and integrate with home automation. Manual checks on operator sites are slow and do not expose historical context or API access for tools.

## Our approach

Run a self-hosted stack (Vue SPA, Express API, PostgreSQL) that syncs from Elering/NordPool, serves multi-country views, and documents a stable HTTP contract. Prioritize operator-deployable packaging (Docker Compose, Coolify) and agent-maintainable hygiene (flows playbook, CI, golden harness) over feature sprawl.

## Who it's for

**Primary:** electricity price watchers in LT, EE, LV, FI — hourly planning and country comparison.

**Secondary:** self-hosters and integrators — API consumers, PWA users, Home Assistant-style automations.

## Key metrics

- **Data freshness** — sync worker keeps today and upcoming prices current; stale sync visible via `/api/sync/status`
- **API correctness** — golden harness and integration CI against fixture Postgres
- **Availability** — production health at `GET /api/v1/health`; Coolify deploy uptime
- **Adoption hygiene** — revamp phases UA0–UA10 tracked in GitHub issues with flows templates

## Tracks

### Track 1 — Revamp foundation (UA0–UA2)

Agent handbook, CI, fixture DB, smoke scripts, debt registration.

_Why it serves the approach:_ autonomous agents can ship fixes without PO code review; quality gates prevent regressions.

### Track 2 — Contract and test hardening (UA3–UA6)

OpenAPI consolidation, golden scenarios, E2E Playwright, ops runbooks.

_Why it serves the approach:_ stable API and tests unlock safe feature work and external integrators.

### Track 3 — Product depth (UA7+)

PWA polish, sync split, performance, optional auth — only after foundation gates pass.

_Why it serves the approach:_ defers risky refactors until harness and docs are trustworthy.

## Not working on

- Upstream flows maintenance or releases from this repo
- Full auth/billing product (unless explicitly scoped later)
- Replacing Elering/NordPool as data authority

## References

- Agent workflow: `docs/plans/agentic-workflow-plan.md`
- Product planning (legacy): `documentation/project_planning.md`
- Adoption from flows: https://github.com/alicemq/flows (pinned `v0.7.1` at `vendor/flows` `bc16808`)
- Revamp checklist: `vendor/flows/examples/nordpool-revamp-checklist.md`
