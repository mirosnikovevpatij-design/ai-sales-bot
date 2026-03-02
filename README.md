# AI Sales Bot — ИИ-чатбот для отдела продаж

Бэкенд по ТЗ v5.0: amoCRM, WhatCRM (WhatsApp), Calendly, очередь лидов, диалог, админка.

## Запуск (локально)

1. Установить Node.js, Docker Desktop.
2. В корне проекта:
   ```bash
   cp .env.example .env
   # Отредактировать .env: DATABASE_URL (порт 5433 если Postgres в Docker), REDIS_*
   npm install
   docker compose up -d
   npx prisma generate
   npx prisma migrate dev --name init
   npm run start:dev
   ```
3. API: `http://localhost:3000/api`  
   Тест лида: `POST /api/webhooks/amo/lead-created` с телом `{"deal_id":"12345","phone":"+77001112233"}`.  
   Тест ответа клиента: `POST /api/webhooks/whatsapp/incoming` с телом `{"leadSessionId":"<uuid из ответа лида>","text":"Привет"}`.

## Подготовка без вебхуков и WhatsApp API

Пока вебхуки и API не оплачены, всё можно настроить и тестировать вручную (имитация запросов). Подробно: **[ПОДГОТОВКА_БЕЗ_API.md](ПОДГОТОВКА_БЕЗ_API.md)**.

## Ключи API (для продакшена)

Список переменных окружения и откуда брать ключи — в файле **[КЛЮЧИ_И_НАСТРОЙКИ.md](КЛЮЧИ_И_НАСТРОЙКИ.md)**.  
Шаблон переменных — в **.env.example**.

## Деплой после изменений

1. **Заливка:** запустить **`1_залить_на_гитхаб.bat`**
2. **Сервер:** зайти на сервер и в терминале выполнить команды из **[ДЕПЛОЙ_ЧЕКЛИСТ.md](ДЕПЛОЙ_ЧЕКЛИСТ.md)** (git pull, npm install, миграции, build, pm2 restart)

## Полезные команды

- Просмотр БД: `npx prisma studio`
- Админка (React): `cd admin-frontend && npm install && npm run dev` → http://localhost:5173
