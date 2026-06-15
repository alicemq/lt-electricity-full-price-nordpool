# Legacy API compatibility (`/api/*`)

## Overview

The backend mounts versioned routes at `/api/v1/*` via `backend/src/v1.js`. A compatibility shim in `backend/src/legacyApi.js` forwards unversioned `/api/*` requests to the same handlers so older clients keep working during migration.

## Canonical vs legacy paths

| Legacy (deprecated) | Canonical successor |
| --- | --- |
| `GET /api/nps/prices?date=...` | `GET /api/v1/nps/prices?date=...` |
| `GET /api/sync/status` | `GET /api/v1/sync/status` |
| `POST /api/sync/trigger` | `POST /api/v1/sync/trigger` |
| Any other `/api/<path>` | `/api/v1/<path>` |

Requests that already target `/api/v1/*` are not rewritten.

## Deprecation headers

Legacy requests receive RFC 8594-style headers on every response:

- `Deprecation: true`
- `Link: </api/v1/...>; rel="successor-version"` (full successor URL including query string)
- `Warning: 299 - "Legacy /api/* path; use /api/v1/*"`

New integrations MUST use `/api/v1/*`. The shim exists for backward compatibility only.

## Mount order

In `backend/src/index.js`:

1. `app.use('/api/v1', v1Router)` — primary API
2. `app.use('/api', legacyApiShim)` — legacy forwarding (skips paths starting with `/v1`)

Root `GET /health` (without `/api`) is a separate liveness endpoint on the Express app; `GET /api/v1/health` is the richer diagnostics handler in `v1.js`.

## OpenAPI source of truth

Interactive docs and the machine-readable contract live under `swagger-ui/`:

- Source: `swagger-ui/openapi.yaml`
- Generated: `swagger-ui/openapi.json` (run `node bin/openapi-json-from-yaml.js --write`)
- CI checks: `bin/validate-openapi-routes.js` and `bin/openapi-json-from-yaml.js --check`

Swagger UI is served at `/api/` through the frontend proxy in production.
