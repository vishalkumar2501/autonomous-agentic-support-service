#!/bin/sh
set -e

# WHY: Execute production Prisma database migrations safely before launching tasks or API containers
echo "Running database migrations..."
npx prisma migrate deploy
echo "Database migrations applied successfully."
