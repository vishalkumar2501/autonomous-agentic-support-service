#!/bin/sh
set -e

# If starting the main api server, apply pending DB migrations
if [ "$1" = "node" ] && [ "$2" = "dist/server.js" ]; then
  echo "Applying pending database migrations..."
  npx prisma migrate deploy || echo "Migration warning: proceeding with startup..."

  if [ "$AUTO_SEED" = "true" ]; then
    echo "AUTO_SEED is enabled: Seeding sample users, products, and orders..."
    npx --yes tsx prisma/seed.ts || echo "Seed warning: proceeding with startup..."
  fi
fi

# Hand over execution to provided command (e.g. node dist/server.js or node dist/worker.js)
exec "$@"
