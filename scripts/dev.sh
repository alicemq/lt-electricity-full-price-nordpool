#!/bin/bash

# Development startup script
echo "🚀 Starting Electricity Prices in Development Mode..."

# Local env files are gitignored — seed from examples on first run
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ensure-local-secrets.sh"

ENV_FILE=".env.development"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example."
fi
ensure_postgres_secrets_in_file "$ENV_FILE" || true

LOCAL_ENV_FILE="deploy/local.env"
if [ ! -f "$LOCAL_ENV_FILE" ]; then
  cp deploy/local.env.example "$LOCAL_ENV_FILE"
  echo "Created $LOCAL_ENV_FILE from deploy/local.env.example."
fi
ensure_postgres_secrets_in_file "$LOCAL_ENV_FILE" || true
sync_postgres_password_between_files "$ENV_FILE" "$LOCAL_ENV_FILE" || true

cp "$ENV_FILE" .env

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.dev.yml)
if [ -f docker-compose.dev.local.yml ]; then
  COMPOSE_FILES+=(-f docker-compose.dev.local.yml)
  echo "Including docker-compose.dev.local.yml (local port overrides)."
fi

# Build and start services with development override
docker-compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --build

echo "✅ Development environment started!"
echo ""
echo "📱 Services:"
echo "  Frontend: http://localhost:5173 (Vite dev server)"
echo "  Backend:  http://localhost:3000 (Express with nodemon)"
echo "  Database: localhost:5432"
echo ""
echo "🔧 Hot-reload enabled for:"
echo "  - Frontend (Vue.js + Vite)"
echo "  - Backend (Express + nodemon)"
echo "  - Data Sync (nodemon)"
echo ""
COMPOSE_HINT="docker-compose -f docker-compose.yml -f docker-compose.dev.yml"
if [ -f docker-compose.dev.local.yml ]; then
  COMPOSE_HINT="${COMPOSE_HINT} -f docker-compose.dev.local.yml"
fi
echo "📊 View logs:"
echo "  ${COMPOSE_HINT} logs -f"
echo ""
echo "🛑 Stop services:"
echo "  ${COMPOSE_HINT} down" 