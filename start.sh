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
node_modules/.bin/prisma db push

echo "=== Starting Next.js server ==="
exec node server.js
