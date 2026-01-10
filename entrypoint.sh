#!/bin/sh

echo "--- Backend Startup Sequence ---"
npx prisma generate
npx prisma db push   # 💡 DB 구조 업데이트는 여기서만!
echo "--- Starting Backend Server ---"

exec "$@"