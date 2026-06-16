#!/usr/bin/env bash
# Docker Compose wrapper — loads deploy/local.env (+ optional override) via load-env.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load-env.sh
source "${ROOT}/bin/load-env.sh"
exec docker compose "$@"
