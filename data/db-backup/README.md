# Database backup (Git LFS)

Portable PostgreSQL snapshot captured after initial sync completes.

| File | Description |
| --- | --- |
| `price-data.sql.gz` | Gzipped `pg_dump` of the `electricity_prices` database |

This directory is tracked via Git LFS. The snapshot file is not committed until you run capture locally after a successful initial sync.

**Capture:** `./bin/capture-db-lfs.sh`

**Restore (local dev):** see [docs/ops/db-backup-lfs.md](../docs/ops/db-backup-lfs.md)
