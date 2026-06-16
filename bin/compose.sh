#!/usr/bin/env bash
# Docker Compose wrapper — loads deploy/local.env for port and URL substitution.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/deploy/local.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${ROOT}/deploy/local.env.example"
fi
exec docker compose --env-file "${ENV_FILE}" "$@"
