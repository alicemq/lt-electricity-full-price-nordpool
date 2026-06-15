# Database schema

Fresh installs use a single init script. There is no incremental migration runner.

## Layout

| Path | Purpose |
| --- | --- |
| `init/01_schema.sql` | Full schema, seed data, and configuration rows |
| `../data/db-backup/` | Optional LFS fixture dump for dev/CI (see `docs/ops/db-backup-lfs.md`) |

## Fresh install

Postgres runs `database/init/*.sql` on first boot via `/docker-entrypoint-initdb.d` (see `docker-compose.yml`).

If the Postgres volume already exists, init scripts do not re-run. Drop the volume or apply changes manually.

The backend also calls `initializeDatabaseSchema()` when `price_data` is missing (e.g. volume created without init).

## Schema changes

1. Edit `init/01_schema.sql` with the desired end state.
2. Use `ON CONFLICT ... DO UPDATE` for seed rows that may change over time (e.g. `system_charges`, `price_configurations`).
3. For **existing production databases**, apply the same SQL manually once, or restore from backup after testing.

Do not add incremental migration files; keep one authoritative init schema.

## Verify locally

```bash
docker compose config -q
docker compose up -d db
docker compose exec db psql -U electricity_user -d electricity_prices -c '\dt'
```
