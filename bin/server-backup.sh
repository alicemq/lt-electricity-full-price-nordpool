#!/usr/bin/env bash
# Postgres backup via docker compose (or docker exec) with timestamp and retention.
# Adapted from vendor/flows/components/backup-restore/server-backup.example.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

POSTGRES_DB="${POSTGRES_DB:-electricity_prices}"
POSTGRES_USER="${POSTGRES_USER:-electricity_user}"
DB_CONTAINER="${DB_CONTAINER:-electricity_db}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
RETENTION_WEEKS="${RETENTION_WEEKS:-4}"

COMPOSE=(docker compose -f docker-compose.yml)
if [[ -f docker-compose.dev.yml ]]; then
  COMPOSE+=(-f docker-compose.dev.yml)
fi

usage() {
  cat <<'EOF'
Usage: bin/server-backup.sh

Create a pg_dump custom-format backup with daily/weekly retention.

Env:
  BACKUP_DIR       Backup root (default: ./backups/postgres)
  POSTGRES_DB      Database name
  POSTGRES_USER    Database user
  DB_CONTAINER     Container name for docker exec (default: electricity_db)
  RETENTION_DAYS   Daily retention (default: 7)
  RETENTION_WEEKS  Weekly retention (default: 4)
  USE_COMPOSE=0    Force docker exec via DB_CONTAINER instead of compose exec

Uses compose exec db when the db service is running; otherwise docker exec DB_CONTAINER.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
daily_dir="${BACKUP_DIR}/daily"
weekly_dir="${BACKUP_DIR}/weekly"
mkdir -p "$daily_dir" "$weekly_dir"

daily_file="${daily_dir}/${POSTGRES_DB}-${timestamp}.dump"

run_pg_dump() {
  local dest="$1"
  if [[ "${USE_COMPOSE:-1}" != "0" ]] && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx 'db'; then
    echo "Backing up via docker compose exec (db service) -> ${dest}"
    "${COMPOSE[@]}" exec -T db pg_dump \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -Fc \
      --no-owner \
      --no-acl \
      > "$dest"
    return 0
  fi

  if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
    echo "ERROR: db service not running and container not found: $DB_CONTAINER" >&2
    echo "Start stack: docker compose up -d db" >&2
    exit 1
  fi

  echo "Backing up via docker exec ${DB_CONTAINER} -> ${dest}"
  docker exec "$DB_CONTAINER" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Fc \
    --no-owner \
    --no-acl \
    > "$dest"
}

run_pg_dump "$daily_file"

if [[ ! -s "$daily_file" ]]; then
  echo "ERROR: backup file is empty: $daily_file" >&2
  exit 1
fi

size_bytes="$(wc -c < "$daily_file" | tr -d ' ')"
echo "OK: wrote ${daily_file} (${size_bytes} bytes)"

# Weekly snapshot on Sunday (copy daily, do not re-dump)
if [[ "$(date +%u)" -eq 7 ]]; then
  weekly_file="${weekly_dir}/${POSTGRES_DB}-${timestamp}.dump"
  cp "$daily_file" "$weekly_file"
  echo "Weekly copy: ${weekly_file}"
fi

find "$daily_dir" -type f -name '*.dump' -mtime +"$RETENTION_DAYS" -print -delete || true

weekly_cutoff_days=$((RETENTION_WEEKS * 7))
find "$weekly_dir" -type f -name '*.dump' -mtime +"$weekly_cutoff_days" -print -delete || true

echo "Retention applied: daily>${RETENTION_DAYS}d weekly>${RETENTION_WEEKS}w"
