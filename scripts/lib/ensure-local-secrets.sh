#!/usr/bin/env bash
# Generate local-only Postgres credentials when placeholders remain (issue #34).
# Sourced by scripts/dev.sh and scripts/prod.sh — do not commit output files.
set -euo pipefail

generate_local_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '/+=' | head -c 32
    return
  fi
  # Fallback when openssl is unavailable (e.g. minimal CI shells)
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
}

file_needs_postgres_password() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  grep -qE '^POSTGRES_PASSWORD=(CHANGE_ME|electricity_password)$' "$file"
}

apply_postgres_password() {
  local file="$1"
  local password="$2"
  local tmp="${file}.tmp.$$"
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      POSTGRES_PASSWORD=*)
        printf 'POSTGRES_PASSWORD=%s\n' "$password"
        ;;
      DATABASE_URL=*)
        printf 'DATABASE_URL=postgresql://electricity_user:%s@db:5432/electricity_prices\n' "$password"
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done <"$file" >"$tmp"
  mv "$tmp" "$file"
}

ensure_postgres_secrets_in_file() {
  local file="$1"
  if file_needs_postgres_password "$file"; then
    local password
    password="$(generate_local_password)"
    apply_postgres_password "$file" "$password"
    echo "Generated local POSTGRES_PASSWORD in ${file} (gitignored — do not commit)."
    return 0
  fi
  return 1
}

sync_postgres_password_between_files() {
  local source_file="$1"
  local target_file="$2"
  local password
  password="$(grep -E '^POSTGRES_PASSWORD=' "$source_file" | head -1 | cut -d= -f2-)"
  [[ -n "$password" ]] || return 1
  apply_postgres_password "$target_file" "$password"
}
