# ==========================================
# Stage 1: Dependencies Cache
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install build essentials and openssl for Prisma native binary
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# Stage 2: Build & TypeScript Compilation
# ==========================================
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Remove development dependencies and clean npm cache to save disk space
RUN npm prune --production && rm -rf ~/.npm

# ==========================================
# Stage 3: Minimal Production Runtime
# ==========================================
FROM node:20-alpine AS runtime
WORKDIR /app

# Install tini init process, curl and openssl for Prisma runtime
RUN apk add --no-cache tini curl openssl

ENV NODE_ENV=production
ENV PORT=4000

# Copy runtime production assets with proper ownership directly (no duplicate layer)
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node scripts/migrate.sh ./scripts/migrate.sh
COPY --chown=node:node scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/*.sh

# Run as non-privileged node user for security
USER node

EXPOSE 4000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./scripts/docker-entrypoint.sh"]

# Default command starts the API service; worker overrides with "node", "dist/worker.js"
CMD ["node", "dist/server.js"]
