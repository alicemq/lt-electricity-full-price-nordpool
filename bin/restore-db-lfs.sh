#!/usr/bin/env bash
# Restore Git LFS Postgres fixture (plain SQL gzip) into compose db service.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f deploy/local.env ]]; then
  # shellcheck disable=SC1091
  set -a
  source deploy/local.env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-electricity_prices}"
POSTGRES_USER="${POSTGRES_USER:-electricity_user}"
DUMP_FILE="${ROOT}/data/db-backup/price-data.sql.gz"
FRESH_VOLUME=false
VERIFY_ONLY=false
START_STACK=true

COMPOSE=(docker compose -f docker-compose.yml)
if [[ -f docker-compose.dev.yml ]]; then
  COMPOSE+=(-f docker-compose.dev.yml)
fi

usage() {
  cat <<'EOF'
Usage: bin/restore-db-lfs.sh [OPTIONS]

Restore data/db-backup/price-data.sql.gz into the compose db service.

Options:
  --fresh-volume   Stop stack, remove postgres_data volume, start db only (destructive)
  --verify-only    Run verification queries; no restore
  --dump-file PATH Override LFS fixture path
  --no-start       Do not start full stack after restore (db only when --fresh-volume)
  -h, --help       Show this help

Requires: docker compose, db service running (or use --fresh-volume).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh-volume)
      FRESH_VOLUME=true
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    --dump-file)
      DUMP_FILE="${2:?--dump-file requires path}"
      shift 2
      ;;
    --no-start)
      START_STACK=false
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

db_container_running() {
  "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx 'db'
}

wait_for_db() {
  local retries=30
  echo "Waiting for Postgres (db service)..."
  while [[ "$retries" -gt 0 ]]; do
    if "${COMPOSE[@]}" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    retries=$((retries - 1))
  done
  echo "Timed out waiting for Postgres" >&2
  return 1
}

find_postgres_volume() {
  docker volume ls -q --filter name=postgres_data 2>/dev/null | head -1
}

reset_public_schema() {
  echo "==> Reset public schema before restore"
  "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;
SQL
}

verify_restore() {
  echo "==> Verification queries"
  "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database() AS db, now() AS verified_at;
SELECT count(*) AS public_tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT count(*) AS price_rows FROM price_data;
SELECT setting_value AS initial_sync_completed
  FROM user_settings WHERE setting_key = 'initial_sync_completed' LIMIT 1;
SQL
}

if [[ "$VERIFY_ONLY" == true ]]; then
  if ! db_container_running; then
    echo "db service is not running" >&2
    exit 1
  fi
  verify_restore
  exit 0
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  echo "Run: git lfs pull" >&2
  exit 1
fi

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "Dump file is empty: $DUMP_FILE" >&2
  exit 1
fi

if [[ "$FRESH_VOLUME" == true ]]; then
  echo "==> Stopping stack and removing postgres_data volume (destructive)"
  "${COMPOSE[@]}" down
  volume_name="$(find_postgres_volume || true)"
  if [[ -n "$volume_name" ]]; then
    docker volume rm "$volume_name"
    echo "Removed volume: $volume_name"
  fi
  echo "==> Starting db service"
  "${COMPOSE[@]}" up -d db
  wait_for_db
else
  if ! db_container_running; then
    echo "db service is not running. Start stack or use --fresh-volume:" >&2
    echo "  docker compose up -d db" >&2
    exit 1
  fi
  wait_for_db
fi

reset_public_schema

echo "==> Restoring ${DUMP_FILE}"
gunzip -c "$DUMP_FILE" | "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

verify_restore

if [[ "$FRESH_VOLUME" == true && "$START_STACK" == true ]]; then
  echo "==> Starting full stack"
  "${COMPOSE[@]}" up -d
fi

cat <<EOF

==> Restore complete

Smoke check:
  curl -s http://127.0.0.1:3000/health
  ./bin/smoke-local.sh

See docs/ops/backup-restore.md
EOF
