#!/usr/bin/env bash
# Non-destructive Postgres restore drill: temp DB, pg_restore, verify, drop.
# Adapted from vendor/flows/components/backup-restore/server-restore.example.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

POSTGRES_DB="${POSTGRES_DB:-electricity_prices}"
POSTGRES_USER="${POSTGRES_USER:-electricity_user}"
DB_CONTAINER="${DB_CONTAINER:-electricity_db}"
DUMP_FILE="${DUMP_FILE:-}"

COMPOSE=(docker compose -f docker-compose.yml)
if [[ -f docker-compose.dev.yml ]]; then
  COMPOSE+=(-f docker-compose.dev.yml)
fi

usage() {
  cat <<'EOF'
Usage: bin/server-restore-drill.sh

Non-destructive restore drill into a temporary database.

Env:
  DUMP_FILE        Path to pg_dump custom-format (.dump) file (required)
  POSTGRES_DB      Production database name (not modified)
  POSTGRES_USER    Database user
  DB_CONTAINER     Container for docker exec fallback
  USE_COMPOSE=0    Force docker exec via DB_CONTAINER

Example:
  DUMP_FILE=backups/postgres/daily/electricity_prices-20260615-030000.dump ./bin/server-restore-drill.sh
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$DUMP_FILE" ]]; then
  echo "ERROR: set DUMP_FILE to a pg_dump custom-format (.dump) file" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

use_compose=false
if [[ "${USE_COMPOSE:-1}" != "0" ]] && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx 'db'; then
  use_compose=true
elif ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: db service not running and container not found: $DB_CONTAINER" >&2
  exit 1
fi

drill_db="restore_drill_$(date +%Y%m%d_%H%M%S)"

psql_admin() {
  if [[ "$use_compose" == true ]]; then
    "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
  else
    docker exec "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
  fi
}

pg_restore_drill() {
  if [[ "$use_compose" == true ]]; then
    "${COMPOSE[@]}" exec -T db pg_restore \
      -U "$POSTGRES_USER" \
      -d "$drill_db" \
      --no-owner \
      --no-acl \
      --verbose \
      < "$DUMP_FILE"
  else
    docker exec -i "$DB_CONTAINER" pg_restore \
      -U "$POSTGRES_USER" \
      -d "$drill_db" \
      --no-owner \
      --no-acl \
      --verbose \
      < "$DUMP_FILE"
  fi
}

psql_drill_sql() {
  if [[ "$use_compose" == true ]]; then
    "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$drill_db" -v ON_ERROR_STOP=1
  else
    docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$drill_db" -v ON_ERROR_STOP=1
  fi
}

echo "Creating drill database: ${drill_db}"
psql_admin -c "CREATE DATABASE \"${drill_db}\";"

cleanup() {
  echo "Dropping drill database: ${drill_db}"
  psql_admin -c "DROP DATABASE IF EXISTS \"${drill_db}\";" || true
}
trap cleanup EXIT

echo "Restoring ${DUMP_FILE} into ${drill_db}"
pg_restore_drill

echo "Verification queries on ${drill_db}"
psql_drill_sql <<'SQL'
SELECT current_database() AS db, now() AS verified_at;
SELECT count(*) AS public_tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT count(*) AS price_rows FROM price_data;
SELECT setting_value AS initial_sync_completed
  FROM user_settings WHERE setting_key = 'initial_sync_completed' LIMIT 1;
SQL

echo "Drill complete. Production database ${POSTGRES_DB} was not modified."
