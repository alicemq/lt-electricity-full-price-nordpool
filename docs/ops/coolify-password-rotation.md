# Coolify Postgres password rotation (#34)

Operator runbook for rotating `POSTGRES_PASSWORD` after `.env*` untrack (issue #3 / PR #25). **Do not commit secret values** to this repo; record rotation metadata only in Coolify or your private ops log.

## When to rotate

- Production `POSTGRES_PASSWORD` may still match the old dev default (`electricity_password`) that was once tracked in git history.
- Rotate if production reused compose defaults or if credential exposure is suspected.

## Local development (agent-completable)

Local stacks no longer fall back to `electricity_password` in `docker-compose.yml`. `./scripts/dev.sh` seeds `.env.development` and `deploy/local.env` from examples and generates a strong random `POSTGRES_PASSWORD` when the placeholder is `CHANGE_ME`. Those files are gitignored.

If Postgres was initialized with the old default, reset the dev volume before restarting:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
./scripts/dev.sh
```

## Production rotation (operator-only)

### Preconditions

- Coolify UI access at your deployment host (see [COOLIFY_DEPLOYMENT.md](../../COOLIFY_DEPLOYMENT.md)).
- Maintenance window: backend will restart; brief API unavailability is expected.
- New password chosen (strong, unique; store in a password manager).

### Rotation steps

1. **Confirm current state** — In Coolify → application → Environment Variables, check whether `POSTGRES_PASSWORD` matches the historical dev default. Do not paste values into tickets or this repo.

2. **Generate new password** — Use your password manager or `openssl rand -base64 32` locally (output stays off-repo).

3. **Update Coolify env vars** (both MUST match):
   - `POSTGRES_PASSWORD` = new password
   - `DATABASE_URL` = `postgresql://electricity_user:<new_password>@db:5432/electricity_prices`

4. **Rotate Postgres inside the db container** — After env vars are set, either:
   - **Preferred:** Redeploy with a fresh Postgres volume only if you have a verified backup and accept data loss; otherwise use `ALTER USER`.
   - **In-place (keeps data):** Exec into the running `db` service and run:
     ```bash
     psql -U electricity_user -d electricity_prices -c "ALTER USER electricity_user WITH PASSWORD 'REPLACE_WITH_NEW_PASSWORD';"
     ```
     Replace the placeholder with the new password; run from a secure shell, not from committed scripts.

5. **Redeploy / restart stack** — Restart `backend` (and `db` if needed) from Coolify so the backend picks up `DATABASE_URL`.

6. **Verify**
   - `GET /health` returns 200
   - `GET /api/v1/sync/status` returns JSON (no DB connection errors in backend logs)
   - Frontend loads price data

7. **Record rotation (no secrets)** — In your private ops log or Coolify notes, record:
   - Date (UTC)
   - Operator initials
   - Confirmation that prod no longer uses the dev default

Local dev acceptance is complete when `./scripts/dev.sh` generates non-default credentials; production rotation closes #34 when an operator confirms Coolify no longer uses the historical default.

## Rollback

If the backend cannot connect after rotation:

1. Restore previous `POSTGRES_PASSWORD` and `DATABASE_URL` in Coolify (from password manager backup).
2. `ALTER USER` back to the previous password if Postgres was already changed.
3. Redeploy and re-verify `/health`.

## Related docs

- [COOLIFY_DEPLOYMENT.md](../../COOLIFY_DEPLOYMENT.md) — env var reference
- [COOLIFY_TROUBLESHOOTING.md](../../COOLIFY_TROUBLESHOOTING.md) — connection failures
- [backup-restore.md](backup-restore.md) — server backups before destructive volume ops
