# Decision: Swagger UI delivery model

**Status:** Decided 2026-06-16 (Refs #101, #136)

## Context

UA3 requires interactive API docs at `/docs` or `/api/` with OpenAPI as the single source of truth (`swagger-ui/openapi.yaml`).

## Decision

Keep the **dedicated `swagger-ui` Docker service** (pinned `swaggerapi/swagger-ui:v5.11.0`). Do **not** embed Swagger UI in the Express backend.

| Surface | Delivery |
| --- | --- |
| Production / compose | `swagger-ui` container; nginx in frontend proxies `/api/` and `/docs` → swagger-ui |
| Vite dev | `electricity-prices-build/vite.config.js` proxies `/api/` and redirects `/docs` → `/api/` |
| OpenAPI files | Mounted read-only from `swagger-ui/openapi.yaml` and generated `openapi.json` |

## Rationale

- Matches existing Coolify compose layout; no backend static-asset or CSP work
- Spectral and `bin/openapi-json-from-yaml.js` already target `swagger-ui/`
- Express embed would duplicate nginx proxy rules and increase backend attack surface

## Out of scope (follow-up)

- Consolidating duplicate OpenAPI copies under `documentation/` (UA3 #101)
- Optional Express redirect-only `/docs` route (not needed while nginx/Vite handle aliases)

## Verification

```bash
curl -sf http://127.0.0.1:5173/docs   # dev redirect
curl -sf http://127.0.0.1/api/        # prod Swagger UI (via frontend nginx)
node --test tests/contract/openapi-samples.test.js
```
