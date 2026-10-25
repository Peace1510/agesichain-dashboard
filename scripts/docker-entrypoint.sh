#!/bin/sh
set -e

echo "=========================================="
echo "🚀 [Agesichain] Starting production server"
echo "=========================================="

echo "📦 [Agesichain] Synchronizing PostgreSQL database schema..."
if [ -f "./node_modules/prisma/build/index.js" ]; then
  node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || echo "⚠️ [Agesichain] Prisma db push warning, continuing..."
elif command -v npx > /dev/null 2>&1; then
  npx prisma db push --skip-generate --accept-data-loss || echo "⚠️ [Agesichain] npx prisma db push warning, continuing..."
fi

echo "🌱 [Agesichain] Ensuring default seed users exist..."
if [ -f "./scripts/seed-users.js" ]; then
  node ./scripts/seed-users.js || echo "⚠️ [Agesichain] User seed warning, continuing..."
fi

echo "✨ [Agesichain] Launching Next.js standalone server on port 3000..."
exec node server.js
