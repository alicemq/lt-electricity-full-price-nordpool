FROM node:20-alpine

WORKDIR /app

# Build argument for NODE_ENV
ARG NODE_ENV=production

# Copy package files
COPY backend/package*.json ./

# Install dependencies based on environment
RUN if [ "$NODE_ENV" = "development" ]; then \
        npm install; \
    else \
        npm install --omit=dev; \
    fi

# Copy source code
COPY backend/src/ ./src/

# Copy database schema for initialization (build context is now root)
COPY database/init/01_schema.sql ./database/init/01_schema.sql

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Default command (will be overridden by docker-compose)
CMD ["node", "src/index.js"] 