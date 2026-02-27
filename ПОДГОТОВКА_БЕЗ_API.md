# Подготовка без оплаченных вебхуков и WhatsApp API

Пока вебхуки amoCRM и API WhatsApp не оплачены (~200к), всё настраиваем и проверяем **без них**. После оплаты останется только подставить ключи и зарегистрировать URL.

---

## Что уже работает без ключей

- **Запуск приложения** — без AMOCRM_*, OPENAI_API_KEY, CALENDLY_* приложение стартует. Отправка в WhatsApp и вызов LLM просто не выполняются (сообщения пишутся в БД, ответы — по шаблонам).
- **БД (Postgres + Redis)** — очередь лидов, сессии, сообщения, стоп-лист, менеджеры, follow-up.
- **Ручная имитация вебхуков** — вместо реальных запросов от amoCRM/WhatCRM можно дергать наши эндпоинты с тестовыми данными.
- **Админка** — конфиг, стоп-лист, менеджеры, эскалация (если поднять `admin-frontend`).
- **Деплой на сервер** — по инструкции в ДЕПЛОЙ_НА_СЕРВЕР.md (Docker, .env без ключей API).

---

## Что подготовить сейчас (без API)

### 1. Сервер и домен

- Убедиться, что **https://chatbot1.vps.webdock.cloud/** открывается и на нём развернут проект (или заглушка).
- Настроить **проксирование** на бэкенд: запросы к `https://chatbot1.vps.webdock.cloud/api/*` должны уходить на приложение (порт 3000). Тогда после оплаты в amoCRM можно сразу указать destination = `https://chatbot1.vps.webdock.cloud/api/webhooks/amo`.

### 2. Файл .env на сервере

- Скопировать **.env.example** в **.env**.
- Заполнить только то, что не требует оплаты:
  - **DATABASE_URL** — строка подключения к Postgres на сервере.
  - **REDIS_HOST**, **REDIS_PORT** — Redis на сервере.
  - **JWT_SECRET** — любая длинная случайная строка для админки.
  - **PORT** — 3000 (или как настроен прокси).
- Поля **AMOCRM_SUBDOMAIN**, **AMOCRM_ACCESS_TOKEN**, **OPENAI_API_KEY**, **CALENDLY_API_TOKEN** можно оставить пустыми — приложение не падает, эти функции просто не активны.

### 3. Миграции и первый запуск

- На сервере (или локально как репетиция):
  ```bash
  npm install
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  # Запуск: pm2 start dist/main.js --name ai-sales-bot (или через systemd/docker)
  ```
- Проверить, что **GET https://chatbot1.vps.webdock.cloud/api/admin/system-config** возвращает JSON (дефолтные значения или из БД).

### 4. Тестовый сценарий без вебхуков и WhatsApp

Имитация полного цикла с одного компьютера (Postman, curl или PowerShell):

**Шаг 1 — «пришёл новый лид» (вместо вебхука amoCRM):**
```http
POST https://chatbot1.vps.webdock.cloud/api/webhooks/amo/lead-created
Content-Type: application/json

{"deal_id": "99901", "phone": "+77001234567", "contact_id": "100"}
```
В ответе взять **leadSessionId**.

**Шаг 2 — «клиент ответил в WhatsApp» (вместо вебхука WhatCRM):**
```http
POST https://chatbot1.vps.webdock.cloud/api/webhooks/whatsapp/incoming
Content-Type: application/json

{"leadSessionId": "СЮДА_UUID_ИЗ_ШАГА_1", "text": "Привет, интересно"}
```
В ответе будет **reply** — ответ бота (шаблонный, т.к. без LLM).

Так можно гонять сценарий многократно, меняя deal_id и текст, и смотреть в **Prisma Studio** или в админке сессии и сообщения.

### 5. Стоп-лист и менеджеры

- Через **Admin API** (если бэкенд поднят) или напрямую в БД:
  - Добавить тестовые номера в стоп-лист: `POST /api/admin/stop-list` с телом `{"phone": "+77001111111", "reason": "тест"}`.
  - Добавить менеджеров для эскалации: `POST /api/admin/managers` с телом `{"amoUserId": 123, "name": "Никита"}`.
- Так к понедельнику будут готовы и стоп-лист, и ротация менеджеров.

### 6. Документация под рукой

- **КЛЮЧИ_И_НАСТРОЙКИ.md** — что подставить в .env после оплаты (amoCRM, Calendly, OpenAI и т.д.).
- **docs/WEBHOOKS_AMOCRM.md** — какой URL вебхука указать в amoCRM и какие события (add_lead, status_lead).
- **ДЕПЛОЙ_НА_СЕРВЕР.md** — как развернуть и обновлять с GitHub.

---

## Что сделать в понедельник–вторник после оплаты

1. В **amoCRM** зарегистрировать вебхук: destination = `https://chatbot1.vps.webdock.cloud/api/webhooks/amo`, settings = **add_lead**, **status_lead**.
2. В **.env** на сервере прописать **AMOCRM_SUBDOMAIN** и **AMOCRM_ACCESS_TOKEN** (и при необходимости OPENAI_API_KEY, CALENDLY_API_TOKEN).
3. Подключить WhatsApp (WhatCRM) по инструкции amoCRM; тогда входящие пойдут на тот же сервер (настроить приём в WhatCRM на ваш URL, если потребуется).
4. Прогнать тест: создать сделку в amoCRM с контактом и телефоном — в боте должна создаться сессия и уйти первое сообщение в WhatsApp (если WhatCRM уже настроен).

Всё, что можно подготовить без API и вебхуков, к понедельнику уже будет настроено; после оплаты останется только ключи и регистрация вебхуков.
