---
title: Agent capabilities map
date: {{DATE}}
parity: AGENTS.md + OpenAPI
---

# Agent capabilities map

Maps user-visible actions to API/agent paths. **Parity rule:** if a human can do it in the UI or docs, an agent MUST be able to do it without browser-only steps.

## Public (no auth)

| User action | Agent path | Notes |
| --- | --- | --- |
| View API docs | `GET /docs`, `GET /openapi.yaml` | Swagger or Redoc |
| Health / readiness | `GET /health`, `GET /ready` | CI smoke |
| Sample responses | `GET /v1/.../sample` | Static fixtures for docs |

## Authenticated

| User action | Agent path | Notes |
| --- | --- | --- |
| Primary API | `GET /v1/...` | Document auth header in OpenAPI |

## Admin / operator

| Action | Command or endpoint |
| --- | --- |
| Local smoke | `./bin/smoke-local.sh` |
| Migrations | Document your migration runner |
| Deploy smoke | Document post-deploy script |

## Gaps (fill during UA0)

- [ ] List every OpenAPI path with auth tier
- [ ] Document CLI scripts agents may run
- [ ] Note browser-only flows to eliminate
