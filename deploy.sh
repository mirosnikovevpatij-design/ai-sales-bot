#!/bin/bash
# Деплой на сервере: подтянуть код, зависимости, миграции, сборка, перезапуск.
# Запускать из корня репозитория (или настроить путь в WEBHOOK-приёмнике).
set -e
cd "$(dirname "$0")"
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart ai-sales-bot --update-env || true
echo "Deploy done."
