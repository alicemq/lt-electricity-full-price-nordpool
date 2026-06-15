# Agent handbook post-install checklist

Complete after running `install.sh` from the [flows](https://github.com/alicemq/flows) cornerstone repo.

## 1. Identity placeholders

Replace in `AGENTS.md`, `STRATEGY.md`, and `docs/ops/github-project-board.md`:

| Placeholder | Example | Your value |
| --- | --- | --- |
| `nordpool` | my-app | |
| `your-org` | your-org | |
| `nordpool` | my-app | |
| `3001` | 3001 | |
| `3000` | 3000 | |
| `backend` | services/api | API package path (see layout profiles below) |
| `backend` | services/worker | Worker package path |
| `electricity-prices-build` | services/frontend | Frontend package path |
| `{{READY_CHECK}}` | postgres | postgres, redis, external-api |
| `1` | 1 | GitHub Project number |
| GraphQL IDs in `bin/project-board-automation.sh` | CONFIGURE_ME | See `docs/ops/github-project-board.md` Field ID discovery |

## 2. Product docs

- [ ] Write `STRATEGY.md` target problem, users, metrics, and tracks
- [ ] Link product requirements plan in `AGENTS.md` (path to `docs/plans/`)
- [ ] Fill `docs/agent-capabilities.md` parity map for your HTTP surface

## 2b. Layout profiles (non-boilerplate monorepos)

If your repo does not use `services/api` paths, re-run install with a layout profile or explicit dirs:

```bash
# NordPool-style legacy layout
./install.sh --target . --phase ua0 --layout legacy-api-backend \
  --frontend-dir electricity-prices-build

# Or explicit overrides
./install.sh --target . --api-dir backend --frontend-dir web --worker-dir backend
```

| Profile | `backend` | `backend` | `electricity-prices-build` |
| --- | --- | --- | --- |
| `monorepo` (default) | services/api | services/worker | services/frontend |
| `flat` / `legacy-api-backend` | backend | backend (inline worker) | frontend |

After install, verify `AGENTS.md` module boundaries and CI workflow paths match your layout. See [adoption-guide.md](https://github.com/alicemq/flows/blob/main/docs/adoption-guide.md#layout-profiles).

Verification:

```bash
grep -E 'backend|services/api' AGENTS.md && echo "WARN: unresolved placeholders" || echo OK
```

## 3. Hygiene (UA0 gate)

- [ ] Root `.gitignore` excludes `node_modules/`, `.env`, `dist/`, `.worktrees/`
- [ ] No tracked secrets; only `*.env.example` files in git
- [ ] Follow [gitignore-untrack-incomplete](https://github.com/alicemq/flows/blob/main/docs/solutions/gitignore-untrack-incomplete.md): `git ls-files` must not list `.env`, `.history/`, or `node_modules/`
- [ ] `PROGRESS_LOG.md` started with first entry
- [ ] Issue templates tested: create a dummy issue with user story + dev story

Verification:

```bash
git ls-files | grep -E '\.env$|\.history/|node_modules/' && echo FAIL || echo OK
```

## 4. Runtime config (UA1, often same PR as UA0)

- [ ] Copy `deploy/local.env.example` to `deploy/local.env` (gitignored override pattern)
- [ ] All scripts use `source bin/load-env.sh` or `bin/compose.sh`
- [ ] `GET /health` and `GET /ready` implemented (see `components/health-routes/`)

## 5. CI (UA2)

- [ ] Customize `.github/workflows/ci.yml` paths for your monorepo layout (`backend`, not hardcoded `services/api` when using legacy layout)
- [ ] Keep gitleaks enabled unless org policy requires `CI_GITLEAKS_ENABLED=0`
- [ ] Add `database/fixtures/ci_seed.sql` or equivalent slim fixture
- [ ] `./bin/smoke-local.sh` passes locally before first CI PR
- [ ] Legacy layout? Use `install.sh --layout legacy-api-backend` or `--api-dir` flags (see section 2b)

## 6. Testing (UA6)

- [ ] Copy golden runner + scenarios from `components/api-testing/`
- [ ] Copy E2E scaffold from `components/e2e-playwright/` to `tests/e2e/`
- [ ] Optional Vitest: `components/vitest/` for frontend `lib/`
- [ ] Enable `ci-integration.example.yml` when Postgres fixture job is fast enough
- [ ] Complete `docs/checklists/ua-testing.md`

## 7. Deploy (UA4+)

- [ ] Copy `deploy.yml`, `validate-deploy-env.js`, `post-deploy-smoke.sh`
- [ ] Configure project board GraphQL IDs (`bin/project-board-automation.sh`) and `PROJECT_BOARD_PAT` secret
- [ ] Configure `DEPLOY_WEBHOOK_*` secrets (skip-if-unconfigured OK for test)
- [ ] Set `GOLDEN_API_PATH` for post-deploy probe
- [ ] Complete `docs/checklists/ua-deploy.md`

## 8. Push / VAPID (optional, `--with-push`)

- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in deploy secrets
- [ ] Server returns public key; client uses Uint8Array conversion (see flows `docs/solutions/vapid-key-must-be-uint8array.md`)
- [ ] iOS: require installed PWA before subscribe
- [ ] Cron reminders: read `components/push-notifications/cron-reminder.example.md`

## 9. Scope gate

- [ ] Every agent reads `AGENTS.md` scope gate before coding
- [ ] First real work is issue `#1` UA0 hygiene PR referencing flows adoption

## 10. Optional extensions

| Flag | Follow-up |
| --- | --- |
| `--with-pwa` | Complete `docs/checklists/ua-pwa.md`, Lighthouse stub |
| `--with-storage` | Wire `src/lib/storage/` into your SPA |
| `--with-push` | Complete `docs/checklists/ua-push.md` |

## 11. Link back to flows

Add to `PROGRESS_LOG.md`:

```markdown
## [YYYY-MM-DD] Agent infra from flows

- Adopted flows v0.3.0 via `install.sh --phase ua6`.
- Cornerstone: https://github.com/alicemq/flows
- Matrix: docs/source-repos-matrix.md
```
