# Project Guidance (redirect)

This file was replaced by **[PROJECT-GOVERNANCE.md](PROJECT-GOVERNANCE.md)** — goals, rules, phased decisions, and PO review items.

- **Operators:** [README.md](../README.md)
- **Agents:** [AGENTS.md](../AGENTS.md)

## Env single source (UA1, #117)

Local ports and URLs MUST come from one loading path so scripts, Compose, and E2E stay aligned.

| File | Purpose |
| --- | --- |
| `deploy/local.env` | Canonical local config (copy from `deploy/local.env.example`; gitignored) |
| `deploy/local.override.env` | Optional per-machine overrides (copy from `deploy/local.override.env.example`; gitignored) |
| `bin/load-env.sh` | Sources `local.env` (or example) then `local.override.env`; export vars for scripts |
| `bin/compose.sh` | Compose wrapper that sources `load-env.sh` before `docker compose` |

**Script convention:** every `bin/*.sh` that needs ports or URLs MUST `source "${ROOT}/bin/load-env.sh"` (or call `bin/compose.sh` for Compose). E2E reads `FRONTEND_URL` / `API_URL` / `LOCAL_*` from the same source via `bin/run-e2e.sh`.

First-time setup: `./scripts/dev.sh` seeds `deploy/local.env` from the example. See [AGENTS.md](../AGENTS.md) local verification and [docs/ops/post-deploy-verification.md](ops/post-deploy-verification.md) for smoke URLs.
