#!/usr/bin/env bash
# Source canonical runtime config. Usage: source "$(dirname "$0")/load-env.sh"
set -a
ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [[ -f "${ROOT}/deploy/local.env" ]]; then
  # shellcheck source=../deploy/local.env
  source "${ROOT}/deploy/local.env"
elif [[ -f "${ROOT}/deploy/local.env.example" ]]; then
  # shellcheck source=../deploy/local.env.example
  source "${ROOT}/deploy/local.env.example"
fi
if [[ -f "${ROOT}/deploy/local.override.env" ]]; then
  # shellcheck source=../deploy/local.override.env
  source "${ROOT}/deploy/local.override.env"
fi
set +a
