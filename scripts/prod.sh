#!/bin/bash

# Production startup script
echo "🚀 Starting Electricity Prices in Production Mode..."

# Local env files are gitignored — seed from .env.example on first run
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example — set strong POSTGRES_PASSWORD before production use."
fi
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