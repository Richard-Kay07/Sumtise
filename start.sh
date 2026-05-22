#!/bin/sh
set -e

echo "=== Starting Sumtise ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOSTNAME: $HOSTNAME"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "NEXTAUTH_SECRET set: $([ -n "$NEXTAUTH_SECRET" ] && echo yes || echo NO)"
echo "NEXTAUTH_URL: $NEXTAUTH_URL"

echo "=== Syncing database schema ==="

# Retry prisma db push until the database is reachable (Railway PostgreSQL
# may not be ready immediately when the app container starts)
MAX_RETRIES=20
RETRY_DELAY=5
attempt=1

while [ $attempt -le $MAX_RETRIES ]; do
  echo "Attempt $attempt/$MAX_RETRIES: running prisma db push..."
  if node_modules/.bin/prisma db push --skip-generate 2>&1; then
    echo "Database sync successful."
    break
  fi

  if [ $attempt -eq $MAX_RETRIES ]; then
    echo "ERROR: Could not reach database after $MAX_RETRIES attempts. Aborting."
    exit 1
  fi

  echo "Database not ready yet. Retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
  attempt=$((attempt + 1))
done

echo "=== Starting Next.js server ==="
exec node server.js
