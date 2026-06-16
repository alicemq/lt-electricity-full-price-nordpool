# Readiness SLO (`GET /ready`)

**Status:** UA1 default adopted 2026-06-16 (Refs #116). PO may revise per [PROJECT-GOVERNANCE.md](../PROJECT-GOVERNANCE.md) section 5 row 3.

## Endpoint

| Path | Auth | Purpose |
| --- | --- | --- |
| `GET /ready` | None | Orchestrator readiness (Postgres + price freshness) |
| `GET /api/v1/ready` | None | Same handler via v1 router |

Liveness remains `GET /health` and `GET /api/v1/health` (always HTTP 200 with degraded payload when unhealthy).

## Checks

| Check | Pass when |
| --- | --- |
| `postgres` | `SELECT 1` succeeds via app pool |
| `price_data_fresh` | At least one country row in `price_data` has `MAX(timestamp)` within the last 24 hours |

HTTP **200** when all checks pass; **503** with `{ status, checks }` otherwise.

## Out of scope (this default)

- Initial sync completion gate (use `/api/v1/sync/initial-status` separately)
- Sync worker running (covered by `/health`, not `/ready`)
- Per-country freshness for all Baltic markets

## Verification

```bash
curl -sf http://127.0.0.1:3000/ready
curl -sf http://127.0.0.1:3000/api/v1/ready
```

With CI fixture DB seeded (`database/fixtures/ci_seed.sql`), `/ready` returns **503** `not_ready` because seed data is historical; `checks.postgres` is true and `checks.price_data_fresh` is false. Golden scenario G5 asserts this.
