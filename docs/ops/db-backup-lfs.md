# Postgres snapshot via Git LFS

After the backend finishes **initial sync** (`initial_sync_completed` in `user_settings`), capture a portable database dump into the repo using Git LFS.

## Prerequisites

- Docker Compose stack running (`db` service healthy)
- Initial sync complete (check below)
- [Git LFS](https://git-lfs.com/) installed (`git lfs install` once per machine)

## Check initial sync status

**API** (backend on port 3000 in dev):

```bash
curl -s http://127.0.0.1:3000/api/sync/initial-status | head -c 500
# data.isComplete must be true
```

**Database** (direct):

```bash
docker compose exec -T db psql -U electricity_user -d electricity_prices \
  -tAc "SELECT setting_value FROM user_settings WHERE setting_key = 'initial_sync_completed'"
```

Non-empty output means initial sync has completed.

## Capture dump

From repo root:

```bash
./bin/capture-db-lfs.sh
```

Options:

| Flag | Purpose |
| --- | --- |
| `--wait SECONDS` | Poll until initial sync completes (default: fail if incomplete) |
| `--force` | Dump even if initial sync is not marked complete |
| `--check-only` | Exit after status check; no dump |

Output: `data/db-backup/price-data.sql.gz` (LFS-tracked).

### Manual pg_dump (equivalent)

```bash
docker compose exec -T db pg_dump \
  -U electricity_user -d electricity_prices --no-owner --no-acl \
  | gzip -c > data/db-backup/price-data.sql.gz
```

With dev overrides (exposed Postgres port):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db pg_dump \
  -U electricity_user -d electricity_prices --no-owner --no-acl \
  | gzip -c > data/db-backup/price-data.sql.gz
```

## Commit to Git LFS

```bash
git lfs install
git add .gitattributes data/db-backup/price-data.sql.gz
git commit -m "chore: add price data snapshot after initial sync"
```

Verify LFS pointer:

```bash
git lfs ls-files
```

## Restore locally

Preferred (scripted, includes schema reset and verification):

```bash
git lfs pull
./bin/restore-db-lfs.sh --fresh-volume
```

Restore into a running db without removing the volume:

```bash
./bin/restore-db-lfs.sh
```

Verify current database state:

```bash
./bin/restore-db-lfs.sh --verify-only
```

Server cron backups and production drills: [backup-restore.md](backup-restore.md).

## Notes

- Capture is **explicit** (script or manual); the sync worker only logs a reminder when initial sync completes.
- Temp/partial dumps under `data/db-backup/` are gitignored; only the final `price-data.sql.gz` is intended for LFS.
- Do not commit production secrets; dumps contain schema and price data only (no `.env` values).
