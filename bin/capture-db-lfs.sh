#!/usr/bin/env bash
# Capture Postgres snapshot to Git LFS path after initial sync completes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"

POSTGRES_DB="${POSTGRES_DB:-electricity_prices}"
POSTGRES_USER="${POSTGRES_USER:-electricity_user}"
LOCAL_API_URL="${LOCAL_API_URL:-http://127.0.0.1:3000}"
OUTPUT_DIR="${ROOT}/data/db-backup"
OUTPUT_FILE="${OUTPUT_DIR}/price-data.sql.gz"
WAIT_SECONDS=0
FORCE=false
CHECK_ONLY=false

COMPOSE=(docker compose -f docker-compose.yml)
if [[ -f docker-compose.dev.yml ]]; then
  COMPOSE+=(-f docker-compose.dev.yml)
fi

usage() {
  cat <<'EOF'
Usage: bin/capture-db-lfs.sh [OPTIONS]

Capture a gzipped pg_dump to data/db-backup/price-data.sql.gz (Git LFS).

Options:
  --wait SECONDS   Poll until initial sync completes (max SECONDS, check every 30s)
  --force          Skip initial-sync completion check
  --check-only     Report sync status and exit (no dump)
  -h, --help       Show this help

Requires: docker compose, running db service, initial sync complete (unless --force).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait)
      WAIT_SECONDS="${2:?--wait requires seconds argument}"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --check-only)
      CHECK_ONLY=true
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

initial_sync_complete_db() {
  local value
  value="$("${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT setting_value FROM user_settings WHERE setting_key = 'initial_sync_completed' LIMIT 1" 2>/dev/null || true)"
  value="$(echo "$value" | tr -d '[:space:]')"
  [[ -n "$value" ]]
}

initial_sync_complete_api() {
  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi
  local body
  body="$(curl -sf "${LOCAL_API_URL}/api/sync/initial-status" 2>/dev/null || true)"
  [[ "$body" == *'"isComplete":true'* || "$body" == *'"isComplete": true'* ]]
}

report_sync_status() {
  if initial_sync_complete_db; then
    echo "initial_sync_completed: yes (database)"
    return 0
  fi
  if initial_sync_complete_api; then
    echo "initial_sync_completed: yes (API ${LOCAL_API_URL})"
    return 0
  fi
  echo "initial_sync_completed: no"
  return 1
}

wait_for_initial_sync() {
  local elapsed=0
  local interval=30
  echo "Waiting for initial sync (timeout ${WAIT_SECONDS}s, interval ${interval}s)..."
  while [[ "$elapsed" -lt "$WAIT_SECONDS" ]]; do
    if report_sync_status; then
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  echo "Timed out waiting for initial sync after ${WAIT_SECONDS}s" >&2
  return 1
}

ensure_initial_sync_complete() {
  if [[ "$FORCE" == true ]]; then
    echo "Skipping initial sync check (--force)"
    return 0
  fi
  if [[ "$WAIT_SECONDS" -gt 0 ]]; then
    wait_for_initial_sync
    return $?
  fi
  if report_sync_status; then
    return 0
  fi
  echo "" >&2
  echo "Initial sync is not complete. Options:" >&2
  echo "  - Wait for backend initial sync to finish, then re-run" >&2
  echo "  - ./bin/capture-db-lfs.sh --wait 3600   # poll up to 1 hour" >&2
  echo "  - curl ${LOCAL_API_URL}/api/sync/initial-status" >&2
  echo "  - ./bin/capture-db-lfs.sh --force        # dump anyway (not recommended)" >&2
  return 1
}

print_lfs_instructions() {
  cat <<EOF

==> Capture complete: ${OUTPUT_FILE}
    Size: $(du -h "$OUTPUT_FILE" | cut -f1)

Commit via Git LFS:
  git lfs install
  git add .gitattributes data/db-backup/price-data.sql.gz
  git commit -m "chore: add price data snapshot after initial sync"

Verify:
  git lfs ls-files
  git lfs track

Restore locally: ./bin/restore-db-lfs.sh --fresh-volume
See: docs/ops/backup-restore.md
EOF
}

if ! db_container_running; then
  echo "db service is not running. Start stack first:" >&2
  echo "  docker compose up -d db" >&2
  echo "  # or with dev overrides:" >&2
  echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db" >&2
  exit 1
fi

if [[ "$CHECK_ONLY" == true ]]; then
  report_sync_status
  exit $?
fi

ensure_initial_sync_complete

mkdir -p "$OUTPUT_DIR"
tmp_file="${OUTPUT_FILE}.partial"

echo "==> pg_dump via docker compose (db service)"
"${COMPOSE[@]}" exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-acl \
  | gzip -c > "$tmp_file"

mv -f "$tmp_file" "$OUTPUT_FILE"
print_lfs_instructions
