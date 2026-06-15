# Backup and restore runbook

Operational reference for Nordpool Postgres. Patterns adapted from flows `vendor/flows/components/backup-restore/` and [backup-restore-small-team.md](../../vendor/flows/docs/solutions/backup-restore-small-team.md).

## Two tiers

| Tier | Purpose | Format | Script |
| --- | --- | --- | --- |
| **Git LFS fixture** | Dev/CI portable snapshot after initial sync | Plain SQL, gzip | `bin/capture-db-lfs.sh`, `bin/restore-db-lfs.sh` |
| **Server backup** | Production/host cron with retention | `pg_dump -Fc` | `bin/server-backup.sh`, `bin/server-restore-drill.sh` |

LFS fixtures ship in-repo for fast local setup. Server backups stay on the host (or off-site) and MUST NOT replace LFS for dev fixtures.

## Infrastructure

| Item | Value |
| --- | --- |
| Compose db service | `db` |
| Container name | `electricity_db` |
| Database | `electricity_prices` |
| User | `electricity_user` |
| LFS fixture | `data/db-backup/price-data.sql.gz` |
| Host backup dir | `backups/postgres/` (gitignored) |

## Tier 1: Git LFS fixture

Full capture/restore details: [db-backup-lfs.md](db-backup-lfs.md).

### Capture (after initial sync)

```bash
./bin/capture-db-lfs.sh
# or poll until sync completes:
./bin/capture-db-lfs.sh --wait 3600
```

### Restore locally (fresh volume)

Destructive to the compose Postgres volume; resets schema then imports the LFS dump:

```bash
git lfs pull
./bin/restore-db-lfs.sh --fresh-volume
```

Restore into a running db (resets `public` schema first):

```bash
./bin/restore-db-lfs.sh
```

Verify without changes:

```bash
./bin/restore-db-lfs.sh --verify-only
```

Post-restore smoke:

```bash
curl -s http://127.0.0.1:3000/health
./bin/smoke-local.sh
```

## Tier 2: Server backup (production / Coolify host)

### Automated backup

```bash
./bin/server-backup.sh
```

On a Coolify host where compose project names differ, use the container directly:

```bash
DB_CONTAINER=electricity_db USE_COMPOSE=0 BACKUP_DIR=/var/backups/nordpool/postgres ./bin/server-backup.sh
```

Output layout:

```text
backups/postgres/daily/electricity_prices-YYYYMMDD-HHMMSS.dump
backups/postgres/weekly/   # Sunday copy of daily dump
```

Retention defaults: daily 7 days, weekly 4 weeks. Override with `RETENTION_DAYS` and `RETENTION_WEEKS`.

### Cron recommendations

| Job | Schedule | Command |
| --- | --- | --- |
| Daily dump | `0 3 * * *` | `cd /opt/nordpool && ./bin/server-backup.sh` |
| Restore drill | `0 4 1 * *` | See below |

Store copies **off the VPS** (object storage, second machine). A dump on the same disk as Postgres is not disaster recovery.

### Restore drill (monthly, non-destructive)

Creates `restore_drill_*`, restores latest dump, verifies row counts, drops drill DB. Production `electricity_prices` is not modified.

```bash
DUMP_FILE="$(ls -t backups/postgres/daily/*.dump | head -1)" ./bin/server-restore-drill.sh
```

On Coolify host:

```bash
DUMP_FILE=/var/backups/nordpool/postgres/daily/electricity_prices-20260615-030000.dump \
  DB_CONTAINER=electricity_db USE_COMPOSE=0 ./bin/server-restore-drill.sh
```

### Pre-deploy backup (manual)

Before risky migrations or compose changes on production:

```bash
BACKUP_DIR=/var/backups/nordpool/manual ./bin/server-backup.sh
# or one-off:
docker exec electricity_db pg_dump -U electricity_user -d electricity_prices -Fc --no-owner \
  > /var/backups/nordpool/manual/pre-deploy-$(date +%Y%m%d).dump
```

Document the dump path in your deploy notes. Coolify does not run this automatically; operators run it before deploy.

## Production restore (incident)

Only with explicit approval. Test on drill DB first.

1. Stop writers: `docker compose stop backend` (sync worker runs in backend)
2. Choose dump file from `backups/postgres/daily/` or off-site copy
3. Restore to production DB (product-specific; prefer `pg_restore` from `-Fc` dumps)
4. Start services: `docker compose up -d`
5. Run `./bin/smoke-local.sh` or hit `/health` and a price endpoint

If restore fails mid-incident, keep the pre-restore dump and volume snapshot paths documented in deploy notes.

## Restore drill checklist

- [ ] Latest `pg_dump` file exists and is non-zero bytes
- [ ] Dump age within your SLA (e.g. under 24h for daily cron)
- [ ] `./bin/server-restore-drill.sh` succeeded this calendar month
- [ ] LFS round-trip tested locally: `./bin/restore-db-lfs.sh --fresh-volume` then `--verify-only`
- [ ] Off-site copy verified (download one file manually)
- [ ] Pre-deploy backup noted before last production migration

## Out of scope

- Client IndexedDB export (Nordpool settings are server-backed; no flows client-export adoption yet)
- Automatic LFS capture on sync completion (explicit human step)
- Coolify-native backup UI configuration

## Related

- [db-backup-lfs.md](db-backup-lfs.md) — LFS capture and commit workflow
- [data/db-backup/README.md](../../data/db-backup/README.md) — fixture directory
- flows reference: `vendor/flows/components/backup-restore/`
