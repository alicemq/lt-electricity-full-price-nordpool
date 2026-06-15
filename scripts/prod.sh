#!/bin/bash

# Production startup script
echo "🚀 Starting Electricity Prices in Production Mode..."

# Local env files are gitignored — seed from .env.example on first run
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ensure-local-secrets.sh"

ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example."
fi
ensure_postgres_secrets_in_file "$ENV_FILE" || true
cp "$ENV_FILE" .env

# Build and start services
docker-compose --env-file "$ENV_FILE" up -d --build

echo "✅ Production environment started!"
echo ""
echo "📱 Services:"
echo "  Frontend: http://localhost:80 (Nginx served with API proxy)"
echo "  Backend:  Internal only (accessed via frontend proxy)"
echo "  Database: Internal only"
echo ""
echo "🔧 Production features:"
echo "  - Optimized builds"
echo "  - Nginx serving static files"
echo "  - Frontend acts as proxy to backend"
echo "  - Backend not exposed to internet"
echo "  - Production dependencies only"
echo ""
echo "📊 View logs:"
echo "  docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "  docker-compose down" 