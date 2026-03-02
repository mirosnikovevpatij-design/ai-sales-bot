## AI Sales Bot — техническая документация проекта

### 1. Назначение и контекст

**AI Sales Bot** — backend‑сервис и админ‑панель для ИИ‑чатбота отдела продаж, реализуемый по ТЗ `TZ_AI_Bot_v5.0_FINAL.md`.  
Цель: автоматизировать обработку лидов из amoCRM через WhatsApp (WhatCRM), вести продажный диалог и доводить до Zoom‑встреч, с управлением через Admin Panel.

Проект состоит из:

- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL + Redis (BullMQ) — основная бизнес‑логика бота, интеграции, state‑machine, очередь инициаций, RAG‑заготовка, эскалации, API для админки.
- **Admin‑frontend**: React + Vite (SPA) — управление конфигом, менеджерами, стоп‑листом, сессиями, базой знаний, промптами, follow‑up шаблонами и тестовый чат с ботом.

### 2. Технологический стек

- **Язык/Runtime**: Node.js, TypeScript.
- **Фреймворк backend**: NestJS.
- **ORM/миграции**: Prisma (`prisma/schema.prisma`).
- **База данных**: PostgreSQL (через `DATABASE_URL`).
- **Очереди**: Redis + BullMQ (`init_queue`).
- **LLM**:
  - DeepSeek (`DEEPSEEK_API_KEY`, модель `deepseek-chat`) **или**
  - OpenAI‑совместимый API (`OPENAI_API_KEY`, `OPENAI_API_BASE`, модель `gpt-4o-mini`).
- **Интеграции**:
  - amoCRM Chats API (через `AmoChatsService`).
  - Calendly API (пока только чтение доступных слотов).
- **Frontend**: React SPA (Vite, TypeScript, кастомная верстка без UI‑библиотек).

### 3. Общая архитектура backend

Backend поднимается из `main.ts` и регистрирует глобальный префикс `api`.  
Корневой модуль `AppModule` подключает:

- `DatabaseModule` — доступ к PostgreSQL через `PrismaService`.
- `LeadsModule` — приём вебхуков amoCRM и создание lead‑сессий.
- `MessagingModule` — приём входящих сообщений WhatCRM / WhatsApp, маршрутизация в диалог.
- `DialogModule` — диалоговый движок и работа с LLM (state‑machine статусов).
- `QueueModule` — очередь инициаций (`init_queue`) на BullMQ.
- `AdminModule` — HTTP‑API для админ‑панели.
- `ObservabilityModule` — логирование запросов и заготовка для метрик.
- `StopListModule` — домен стоп‑листа.
- `IntegrationsModule` — amoCRM Chats API.
- `LlmModule` — обёртка над LLM‑провайдером.
- `AppConfigModule` — доступ к `ConfigService` (Nest).
- `CalendlyModule` — интеграция с Calendly (частично).
- `RagModule` — RAG‑слой (пока без векторного поиска).
- `FollowupModule` — логика follow‑up сообщений.
- `EscalationModule` — эскалация на менеджера с round‑robin ротацией.

### 4. Модель данных (Prisma)

Основные модели (`prisma/schema.prisma`):

- **`LeadSession`** — центральная сущность состояния диалога:
  - Ключевые поля: `amoDealId`, `amoContactId`, `phone`, `phoneMasked`, `conversationId`, `status`, `clientLanguage`, `conversationStateJson`, `assignedManagerId`, `handoffReason`, `handoffAt`, `initMessageId`, `initSentAt`, `initStatus`, `zoomJoinUrl`, `zoomScheduledAt`, `zoomReminder24hSent`, `zoomReminder1hSent`, `source`, `followupStopped`, `proposedSlots`, `createdAt`, `updatedAt`.
  - Связи: `messages`, `initQueues`, `followups`, `offHoursQueues`, `handoffAssignments`, `assignedManager`, `waAccount`.
  - Статусы (`LeadSessionStatus`) полностью соответствуют ТЗ: `PENDING_INIT`, `INIT_SENT`, `ENGAGED`, `QUALIFYING`, `PRESENTING`, `OBJECTION_HANDLING`, `SCHEDULING_ZOOM`, `ZOOM_BOOKED`, `FOLLOWUP_1/2/3`, `HANDOFF_TO_HUMAN`, `INIT_FAILED`, `CLOSED`.

- **`Message`** — хранилище сообщений:
  - Поля: `direction` (`IN`/`OUT`), `channel` (`WHATSAPP`), `messageType`, `text`, `externalMessageId` (amoCRM Chats), `status`, `llmPromptTokens`, `llmCompletionTokens`, `ragScore`, `language`, `createdAt`.
  - Связь `leadSession` с каскадным удалением.

- **`InitQueue`** — персистентная очередь инициаций:
  - Поля: `leadSessionId`, `idempotencyKey`, `runAfter`, `attempts`, `maxAttempts`, `lastError`, `status` (`PENDING`, `PROCESSING`, `DONE`, `FAILED`), `createdAt`, `updatedAt`.

- **`Manager`**, **`HandoffAssignment`** — менеджеры и история эскалаций:
  - `Manager`: `amoUserId`, `name`, `telegramId`, `whatsappPhone`, `active`, `excludeFromRotation`, `weight`, `currentRoundPosition`.
  - `HandoffAssignment`: `leadSessionId`, `managerId`, `assignedAt`, `reason`.

- **`StopList`** — стоп‑лист телефонов:
  - Поля: `phone` (уникальный), `reason`, `addedBy` (`client_request` / `admin` / `system`), `leadSessionId`, `createdAt`.

- **`WhatsAppAccount`** — пул WA‑аккаунтов (структура из ТЗ, без логики ротации в коде бота):
  - `connectionId`, `phone`, `channelId`, `status` (`ACTIVE`, `DISCONNECTED`, `BANNED`, `QR_REQUIRED`), `isPrimary`, `rotationWeight`, `messagesSentToday`, `lastUsedAt`, `bannedAt`, `notes`, `createdAt`.

- **Follow‑up и off‑hours**:
  - `Followup`: `leadSessionId`, `step` (1–3), `templateVariant`, `dueAt`, `sentAt`, `messageId`, `status` (`SCHEDULED`, `SENT`, `CANCELLED`, `FAILED`), `cancelReason`.
  - `FollowupTemplate`: `step`, `language` (`ClientLanguage` — `RU`, `KZ`, `SHALAKAZ`, `OTHER`), `variant` (`A`/`B`), `content`, `isActive`, `createdAt`, `updatedAt`.
  - `OffHoursQueue`: `leadSessionId`, `messageId`, `receivedAt`, `scheduledReplyAt`, `status` (`PENDING`, `PROCESSED`, `CANCELLED`), `processedAt`. (Логика воркера пока не реализована, только модель.)

- **Конфиг, промпты и база знаний (RAG)**:
  - `SystemConfig`: произвольный JSON‑конфиг по `key`.
  - `Prompt`: ключ `key`, версионирование, флаги A/B‑теста, `content`, `variablesDesc`.
  - `KnowledgeDocument`: `filename`, `fileType` (`docx`/`md`), `storagePath`, `content`, `indexingStatus`, `fragmentCount`, `errorMessage`, `uploadedBy`, `uploadedAt`, `indexedAt`.
  - `KnowledgeFragment`: текстовые фрагменты документа, `topic`, `audienceLevel`, `language`, `manuallyEdited`, `sourceFile`, `updatedAt`.

### 5. Основные потоки и сервисы

#### 5.1. Поток создания лида и инициации (init_queue)

Реализован в:

- `LeadsController` (`POST /api/webhooks/amo` и `POST /api/webhooks/amo/lead-created`).
- `LeadsService` — обработка вебхуков amoCRM и создание `LeadSession`.
- `QueueModule` + `InitQueueProcessor` + `MessagingService`.

Фактическая логика:

- Приходит вебхук amoCRM (полноценное тело или упрощённый тестовый JSON).
- `LeadsService.processAmoWebhookPayload`:
  - Унифицирует разные форматы (`body.deal_id`, `leads.add`, `leads.status` и т.д.).
  - Извлекает телефон (`extractPhone`) из контакта/кастомных полей/лида.
  - Для каждого лида вызывает `createLeadSessionFromAmoWebhook`.
- `createLeadSessionFromAmoWebhook`:
  - Нормализует телефон до формата `+7XXXXXXXXXX`.
  - Если телефона нет — создаёт/обновляет `LeadSession` со статусом `INIT_FAILED`, помечает результат `skipped: true, reason: 'no_phone'`.
  - Проверяет стоп‑лист через `StopListService.isInStopList`; если номер в стоп‑листе — создаёт/обновляет `LeadSession` со статусом `INIT_FAILED`, `skipped: true, reason: 'stop_list'`.
  - Иначе создаёт/обновляет `LeadSession` со статусом `PENDING_INIT`, сохраняет `amoDealId`, `amoContactId`, `phone`, `phoneMasked`, `source`.
  - Добавляет задачу в BullMQ‑очередь `init_queue` (`job name "init"`, payload `{ leadSessionId }`).

Обработка очереди:

- `InitQueueProcessor` (`@Processor('init_queue')`) забирает задачи и вызывает `MessagingService.sendInitMessage`.
- В `sendInitMessage`:
  - Загружает `LeadSession`.
  - Формирует базовый текст init‑сообщения (сейчас фиксированный тестовый текст).
  - Если настроен amoCRM Chats (`AmoChatsService.isConfigured`) и есть `amoContactId`:
    - При отсутствии `conversationId` создаёт чат `/api/v4/chats`, сохраняет `conversationId` в `LeadSession`.
    - Отправляет сообщение через `/api/v4/chats/messages`, сохраняет внешний `externalMessageId`.
  - В любом случае создаёт запись `Message` (OUT, WHATSAPP, text, status `SENT`), с `externalMessageId`, если он есть.
  - Обновляет `LeadSession`: `status = INIT_SENT`, `initSentAt`, `lastBotMessageAt`, опционально `initMessageId`.
  - Планирует follow‑up №1 через 24 часа (см. 5.4).

#### 5.2. Входящее сообщение из WhatsApp / WhatCRM

Реализовано в:

- `MessagingController` (`POST /api/webhooks/whatsapp/incoming`).
- `MessagingService.handleIncomingFromWebhook`.
- `DialogService.handleIncomingMessage`.

Фактическая логика:

- `MessagingController` получает входящее тело вебхука WhatCRM/amoCRM Chats (формат упрощённый, но совместимый с ТЗ: поле `message.add[0]`, `chat_id`, `author.id` и т.п.).
- `MessagingService.handleIncomingFromWebhook`:
  - Извлекает текст сообщения, `leadSessionId` (если явно передан), телефон, `conversationId`.
  - Если `leadSessionId` не передан, пытается найти активную `LeadSession` по `conversationId` или по телефону (`phone`, insensitive), берёт последнюю по `updatedAt`.
  - При отсутствии сессии возвращает текст ошибки для клиента.
  - Отменяет все запланированные follow‑up данной сессии (`FollowupService.cancelForSession`).
  - Делегирует обработку текста в `DialogService.handleIncomingMessage`.

#### 5.3. Диалоговый движок и LLM

Реализован в:

- `DialogService`.
- `LlmService`.

Фактическая логика:

- `DialogService.handleIncomingMessage(leadSessionId, text)`:
  - Находит `LeadSession`, создаёт входящее `Message` (`IN`, `WHATSAPP`, text, status `DELIVERED`).
  - Вычисляет следующий статус через `getNextStatus`:
    - `PENDING_INIT/INIT_SENT → ENGAGED`
    - `ENGAGED → QUALIFYING`
    - `QUALIFYING → PRESENTING`
    - `PRESENTING → SCHEDULING_ZOOM`
    - `SCHEDULING_ZOOM → ZOOM_BOOKED`
    - Иначе — статус не меняется.
  - Обновляет `LeadSession.status`, `lastClientMessageAt`.
  - Формирует системный промпт:
    - Бот — продавец отдела продаж, цель — запись на Zoom.
    - Ограничение длины (≤400 символов), один вопрос, запрет слов «бот», «ИИ», «автоматический».
    - Вставляет текущий этап (`nextStatus`) в текст промпта.
  - Если LLM сконфигурирован:
    - Загружает последние 10 сообщений, мапит их в формат истории (`role: user/assistant`).
    - Вызывает `LlmService.generateReply(systemPrompt, userMessages)`.
    - При пустом/ошибочном ответе — fallback‑текст по статусу.
  - Если LLM не сконфигурирован — всегда использует fallback‑текс по статусу (`buildReply`).
  - Создаёт исходящее `Message` (OUT, `text` = ответ), обновляет `lastBotMessageAt`.
  - Возвращает текст ответа.

Дополнительно:

- `DialogService.getTestInitialMessage` — даёт первый ответ без БД (для тестового чата в админке).
- `DialogService.generateReplyForTest` — генерирует ответ по истории сообщений из админки, без работы с `LeadSession`/`Message`; использует упрощённый "синтетический" статус на основе длины истории.

**Замечания по сравнению с ТЗ:**

- Реализована **линейная** схема переходов по статусам без сложной ветвящейся state machine (квалификация/возражения/ограничения по попыткам и т.п.).
- Нет явной реализации ограничений `MAX_OBJECTION_ROUNDS`, `MAX_QUALIFYING_ROUNDS`, `MAX_UNANSWERED_MESSAGES` и т.д. — только последовательный переход по этапам.

#### 5.4. Follow‑up логика

Реализовано в:

- `FollowupService`.
- Модели `Followup`, `FollowupTemplate`.
- Админ‑API и UI (`AdminFollowupTemplatesController`, вкладка "Follow-up" в админке).

Фактическая логика:

- `getTemplateText(step, language, variant)`:
  - Ищет активный шаблон в `FollowupTemplate` по шагу (1–3), языку (`ClientLanguage`) и варианту (`A`/`B`).
  - Если не найден — использует захардкоженный RU‑fallback текст для шагов 1–3, которые совпадают с примерами из ТЗ.

- `scheduleFollowup(leadSessionId, step, dueAt)`:
  - Создаёт запись в `Followup` со статусом `SCHEDULED` и шагом 1–3.

- `cancelForSession(leadSessionId, reason)`:
  - Массово переключает все `SCHEDULED` follow‑up для сессии в `CANCELLED` с причиной.

- `processDue()`:
  - Находит все `SCHEDULED` follow‑up с `dueAt <= now`, подтягивает `leadSession`.
  - Для каждого:
    - Получает текст шаблона (с учётом языка клиента и варианта).
    - Создаёт исходящее `Message` (OUT, WHATSAPP, text, status `SENT`).
    - Обновляет `Followup` → `SENT`, проставляет `sentAt`, `messageId`.
    - Обновляет `LeadSession.lastBotMessageAt` и статус → `FOLLOWUP_1/2/3` в зависимости от шага.
  - При ошибке — помечает Followup как `FAILED` с `cancelReason`.

Планировщик (`ScheduleModule.forRoot()`) подключён в `AppModule`, но отдельный cron‑job для `processDue()` в коде пока не виден — предполагается ручной вызов или последующая доработка.

#### 5.5. Стоп‑лист

Реализовано в:

- `StopListService` и `StopListController`.
- Admin‑вкладка "Стоп‑лист".

Фактическая логика:

- Нормализация телефона (аналогичная в `LeadsService` и `StopListService`): выдёргиваются цифры, берутся последние 10, приставляется `+7`.
- `isInStopList(phone)` — проверка наличия в `StopList` по нормализованному номеру.
- `add(phone, reason, addedBy, leadSessionId?)` — `upsert` записи стоп‑листа; по умолчанию `addedBy = admin`.
- `remove(phone)` — удаление всех записей по номеру.
- API:
  - `GET /api/admin/stop-list` — список номеров.
  - `POST /api/admin/stop-list` — добавление новой записи.
  - `DELETE /api/admin/stop-list/:phone` — удаление номера.
- Использование в потоке лидов:
  - При создании `LeadSession` лиды из стоп‑листа немедленно переводятся в `INIT_FAILED`, задача в init‑очередь не добавляется.

#### 5.6. База знаний и RAG

Реализовано в:

- Модели `KnowledgeDocument`, `KnowledgeFragment`.
- `RagService`.
- `AdminKnowledgeController` + вкладка "База знаний".

Фактическая логика:

- Загрузка документа:
  - `POST /api/admin/knowledge/documents` — принимает `filename`, `fileType` (`md`/`docx`), `content`.
  - Сохраняет документ и сразу вызывает индексацию текста (если `content` задан).
- Индексация:
  - Текст разбивается на фрагменты по параграфам/окнам (`CHUNK_SIZE`, `CHUNK_OVERLAP`).
  - Для каждого фрагмента создаётся `KnowledgeFragment`.
  - `KnowledgeDocument.indexingStatus` → `INDEXED`, `fragmentCount` заполняется.
- Reindex:
  - `POST /api/admin/knowledge/documents/:id/reindex` — очистка старых фрагментов и повторная нарезка.
- Удаление документа и фрагментов.
- Тест RAG:
  - `POST /api/admin/knowledge/test-rag` — вызывет `RagService.search(query, topK)` и возвращает список `{content, score}`.

`RagService.search` сейчас реализован как заглушка:

- Берёт первые `topK` фрагментов из БД без реального векторного поиска.
- Возвращает фиксированный `score = 0.8` для всех фрагментов.
- Метод `shouldEscalate(scores)` сравнивает максимальный score c порогом `minConfidence = 0.65`.

Полноценный pgvector‑поиск и реальные эмбеддинги ещё не реализованы.

#### 5.7. Calendly интеграция

Реализовано в:

- `CalendlyService`.

Фактическая логика:

- Конфиг через `CALENDLY_API_TOKEN`.
- `isConfigured` проверяет наличие токена.
- `getAvailableTimes(eventTypeUuid, startTime, endTime)`:
  - Запрос `GET https://api.calendly.com/event_type_available_times` с параметрами `event_type`, `start_time`, `end_time`.
  - Возвращает `collection` слотов как есть.
  - При ошибке пишет warning‑лог и возвращает пустой список.

Создание встреч, обработка webhook‑ов Calendly и интеграция в state machine ещё не реализованы.

#### 5.8. Эскалация на менеджера

Реализовано в:

- `EscalationService`.
- `AdminEscalationController` (`/api/admin/lead-sessions`).
- Вкладка "Сессии" в админ‑панели.

Фактическая логика:

- `EscalationService.handoff(leadSessionId, reason)`:
  - Загружает всех активных менеджеров (`active = true`, `excludeFromRotation = false`), сортирует по `currentRoundPosition`, потом по `id`.
  - Берёт первого в списке, обновляет `currentRoundPosition` (простая round‑robin схема).
  - В транзакции:
    - Обновляет менеджера.
    - Создаёт запись `HandoffAssignment`.
    - Обновляет `LeadSession`: `status = HANDOFF_TO_HUMAN`, прописывает `handoffReason`, `handoffAt`, `assignedManagerId`.
  - Возвращает `id` назначенного менеджера или `null`, если менеджеров нет.

- Admin‑API:
  - `GET /api/admin/lead-sessions` — список сессий (по желанию можно фильтровать по статусу).
  - `POST /api/admin/lead-sessions/:id/handoff` — ручная эскалация на менеджера.
  - `DELETE /api/admin/lead-sessions/:id` — удаление сессии.
  - `POST /api/admin/lead-sessions` — создание тестовой сессии с автогенерацией `amoDealId`.

Синхронизация с amoCRM (создание задач/смена статусов, SLA‑монитор для напоминаний руководителю) ещё не реализованы, хранится только состояние в нашей БД.

### 6. Admin‑панель (React SPA)

Фронтенд (`admin-frontend/src/App.tsx`) реализует вкладки:

- **`Конфиг`**:
  - Работает с `/api/admin/system-config`:
    - `GET` — возвращает все пары `key → value`.
    - `POST` — добавление/обновление параметра.
    - `DELETE /:key` — удаление.
  - UI поддерживает отображение и добавление любой конфигурации (включая rate‑limit, time window и т.п.) в виде универсального key/value JSON.

- **`Менеджеры`**:
  - Работает с `/api/admin/managers`.
  - Выводит список менеджеров и позволяет:
    - Создавать нового менеджера с `amoUserId`, `name`, `whatsappPhone`, `active`.
    - Удалять менеджеров.
    - Обновление (`PUT`) также поддерживается API.
  - Используется `Manager`‑модель и далее участвует в ротации при `handoff`.

- **`Стоп‑лист`**:
  - Работает с `/api/admin/stop-list`.
  - Позволяет:
    - Просматривать текущий стоп‑лист.
    - Добавлять телефоны (с необязательной причиной).
    - Удалять телефоны из стоп‑листа.

- **`Сессии`**:
  - Работает с `/api/admin/lead-sessions`.
  - Показывает до 50 последних сессий (`phoneMasked`/`phone`, статус, дата создания).
  - Действия:
    - Ручная эскалация (`POST /:id/handoff`) — вызывает `EscalationService`.
    - Удаление сессии (`DELETE /:id`).
    - Создание тестовой сессии (форма "Добавить сессию" с телефоном).

- **`База знаний`**:
  - Работает с `/api/admin/knowledge/*`.
  - Возможности:
    - Список документов, статус индексирования, количество фрагментов, дата загрузки.
    - Добавление нового документа (имя + текстовый контент).
    - Переиндексация документа.
    - Удаление документа.
    - Тестовый RAG‑поиск (`POST /knowledge/test-rag`) с отображением top‑5 фрагментов.

- **`Промпты`**:
  - Работает с `/api/admin/prompts`.
  - Возможности:
    - Просмотр всех промптов, сгруппированных по ключу, с версионированием.
    - Создание новой версии промпта (ключ + текст).
    - Установка активной версии для ключа.
    - Включение/отключение A/B‑теста и процента трафика.
    - Редактирование содержимого версии.
    - Удаление версии.

- **`Follow-up`**:
  - Работает с `/api/admin/followup-templates`.
  - Возможности:
    - Просмотр всех шаблонов (шаг 1/2/3, язык RU/KZ/SHALAKAZ/OTHER, вариант A/B, текст).
    - Добавление нового шаблона (с шагом, языком, вариантом).
    - Удаление шаблона.

- **`Тестирование бота`**:
  - Работает с `/api/admin/test/*`.
  - Позволяет "поиграть" в чат с ботом (DeepSeek/OpenAI), не трогая БД:
    - `POST /admin/test/scenario/start` — создаёт фиктивный `sessionId` и возвращает первый бот‑ответ.
    - `POST /admin/test/:sessionId/send` — отправляет очередное сообщение + историю в `DialogService.generateReplyForTest`.
    - `POST /admin/test/:sessionId/end` — завершает сценарий на стороне UI.

Визуально админка реализована с кастомной лёгкой версткой (таблицы, кнопки, бейджи), соответствует требованиям "современной и удобной" панельки, хотя аналитические дашборды и графики ещё не реализованы.

### 7. Observability (наблюдаемость)

Реализовано в:

- `ObservabilityModule`.
- `LoggingInterceptor`.
- `MetricsService` (заготовка).

Фактическая реализация:

- `LoggingInterceptor` регистрируется как глобальный NestJS‑интерцептор (`APP_INTERCEPTOR`), логирует HTTP‑запросы (статус, длительность и т.п.).
- `MetricsService` пока является заглушкой для будущих метрик (Prometheus и т.д.), но уже экспортируется и может быть использован в других модулях.

Пока **нет** реализации:

- Prometheus‑метрик, Grafana‑дашбордов, алертов в Telegram/email.
- Развёрнутого event‑логирования доменных событий из ТЗ.

### 8. Сопоставление с ТЗ v5.0: прогресс

Ниже — фактический статус реализации по ключевым блокам ТЗ.

#### 8.1. Архитектура и каркас (Этапы 1–2)

- **Сделано:**
  - Каркас NestJS‑проекта с модулями `Leads`, `Messaging`, `Dialog`, `Queue`, `Admin`, `StopList`, `Integrations`, `Followup`, `Rag`, `Escalation`, `Observability`.
  - PostgreSQL + Prisma‑схема, покрывающая основные таблицы из раздела 16 ТЗ (lead sessions, messages, init queue, followups, off hours, managers, handoff assignments, stop list, prompts, system config, knowledge documents/fragments).
  - BullMQ‑очередь `init_queue` и воркер `InitQueueProcessor`.
  - Интеграция с amoCRM Chats API на отправку исходящих сообщений и создание чата (через `AmoChatsService`).
  - Приём вебхуков amoCRM для создания лидов (`/api/webhooks/amo`) и ручной тестовый эндпоинт `/api/webhooks/amo/lead-created`.
  - Проверка стоп‑листа до постановки в очередь, idempotent‑upsert `LeadSession` по `amoDealId`.

- **Частично:**
  - Rate limit/time window для очереди init‑сообщений пока не реализованы как конфигурируемые параметры с крон‑воркером — есть только сама очередь и базовый воркер.
  - Нагрузочное тестирование на 10+ лидов за 2 секунды не автоматизировано.

- **Не сделано:**
  - Отдельная таблица и крон‑джобы для "stale" задач, dead‑letter и полная обвязка надёжности очереди (частично заложено в модели, но без процедур).

#### 8.2. Диалоговый движок и логика продаж (Этапы 3–4)

- **Сделано:**
  - Базовый диалоговый движок (`DialogService`) с переходами через ключевые статусы воронки (ENGAGED → QUALIFYING → PRESENTING → SCHEDULING_ZOOM → ZOOM_BOOKED).
  - Интеграция с LLM‑провайдером через `LlmService` (DeepSeek / OpenAI).
  - Запись всех входящих и исходящих сообщений в таблицу `Message`.
  - Простейшие текстовые фразы по статусам (fallback‑ответы).
  - Админ‑тестовый чат, позволяющий прогнать диалог без участия amoCRM/WhatsApp.

- **Частично:**
  - State machine реализует только прямую линейную последовательность шагов, без:
    - Детальной квалификации по полям (ниша, цель, объём базы и т.д.).
    - Явной обработки возражений с ограничением по количеству раундов.
    - Автоматической эскалации по условиям из раздела 10 (RAG‑score, ошибки LLM, MAX\_* лимиты).

- **Не сделано:**
  - Явный JSON‑state (`conversationStateJson`) с заполненными полями квалификации и управлением шагами по ТЗ.
  - Расширенные правила "не выдавать бота" (сейчас только запрет слов в system‑prompt, без пост‑фильтрации текста LLM).

#### 8.3. Мультиязычность (Раздел 8 ТЗ)

- **Сделано:**
  - Тип `ClientLanguage` с поддержкой `RU`, `KZ`, `SHALAKAZ`, `OTHER`.
  - Follow‑up шаблоны мульти‑язычные на уровне схемы и админ‑UI (выбор языка для каждого шаблона).

- **Не сделано:**
  - Автоопределение языка клиента (LLM‑классификация).
  - Автоматический выбор языка генерации ответов и шаблонов по `clientLanguage`.
  - Специальная промпт‑инструкция для шала‑казахского (как отдельный system prompt).

#### 8.4. Рабочее время и off‑hours (Раздел 9 ТЗ)

- **Сделано:**
  - Модель `OffHoursQueue` в БД.
  - Общий конфиговый слой (`SystemConfig`) + админ‑UI для произвольных параметров, куда могут быть вынесены time window/часовой пояс.

- **Не сделано:**
  - Реальная логика накопления входящих сообщений в нерабочее время и отложенной отправки ответа в начале следующего рабочего окна.
  - Смещение follow‑up/напоминаний и init‑сообщений с учётом рабочего окна.

#### 8.5. Эскалация, SLA и менеджеры (Раздел 10 ТЗ)

- **Сделано:**
  - Модель менеджеров и назначений (`Manager`, `HandoffAssignment`).
  - Сервис `EscalationService` с round‑robin распределением по менеджерам.
  - Обновление `LeadSession` в статус `HANDOFF_TO_HUMAN`, сохранение причины и времени handoff.
  - Админ‑UI для CRUD менеджеров и ручной эскалации сессий.

- **Частично:**
  - Правила распределения только round‑robin; схемы "по нише" и "по расписанию смен" не реализованы.

- **Не сделано:**
  - SLA‑монитор с напоминаниями руководителю по WhatsApp.
  - Автоматическая эскалация при достижении лимитов / ошибках / RAG‑score < порога.
  - Создание задач в amoCRM при handoff.

#### 8.6. Follow‑up (Раздел 11 ТЗ)

- **Сделано:**
  - Модель follow‑up шагов и шаблонов.
  - Админ‑интерфейс для управления мультиязычными шаблонами A/B по шагам 1–3.
  - Сервис `FollowupService` для:
    - Планирования follow‑up.
    - Отмены при ответе клиента.
    - Отправки due‑follow‑up (создание сообщений, обновление статуса сессии).

- **Частично:**
  - График отправки (через 24ч / 3 дня / 10 дней) задан косвенно, но нет явного использования конфиг‑ключей `FOLLOWUP_*` и cron‑задачи, привязанной к ним.
  - A/B‑аналитика и конверсия по вариантам пока не реализованы (есть только хранение варианта).

#### 8.7. Calendly / Zoom (Раздел 12 ТЗ)

- **Сделано:**
  - Клиент `CalendlyService` для запроса доступных слотов.

- **Не сделано:**
  - Создание встреч через Calendly API / Google Calendar.
  - Диалоговое бронирование (предложение 2–3 слотов и парсинг ответа клиента).
  - Обработка webhook‑ов Calendly (invitee.created / invitee.canceled).
  - Напоминания за 24ч и за 1ч по расписанию (кроме полей в `LeadSession`, логики нет).

#### 8.8. База знаний и RAG (Раздел 13 ТЗ)

- **Сделано:**
  - Структура БД под документы и фрагменты.
  - Админ‑интерфейс для загрузки, разрезания на фрагменты и повторной индексации.
  - Тестовый эндпоинт RAG с возвратом списка фрагментов.

- **Частично:**
  - Поиск по базе пока не векторный, а "первые N фрагментов".

- **Не сделано:**
  - Реальная интеграция RAG с LLM‑диалогом.
  - Хранение и учёт score в логике эскалации.

#### 8.9. Admin Panel (Раздел 15 ТЗ)

- **Сделано:**
  - Большая часть CRUD‑функционала:
    - Управление конфигом (generic key/value).
    - Менеджеры и ротация.
    - Стоп‑лист.
    - Lead‑сессии (просмотр, удаление, ручной handoff, создание тестовых).
    - База знаний и тест RAG.
    - Промпты с версионированием и A/B‑флагами.
    - Follow‑up шаблоны (RU/KZ/SHALAKAZ/OTHER, A/B).
    - Тестовый чат бота (DeepSeek/OpenAI) для сценария продаж.

- **Частично:**
  - Нет Dashboard с live‑метриками и графиками.
  - Нет аналитических отчётов и экспорта в CSV/Excel.
  - Нет управляемого UI для всех параметров `system_config` по категориям (есть только общий список).

#### 8.10. Observability и метрики (Раздел 19–20 ТЗ)

- **Сделано:**
  - Глобальное логирование HTTP‑запросов.
  - Общий сервис для будущих метрик.

- **Не сделано:**
  - Конкретные Prometheus‑метрики из ТЗ, аларминги и cost‑tracking LLM.

### 9. Резюме текущего состояния

- **Фактически реализовано**:
  - Каркас NestJS‑сервиса, интеграция с PostgreSQL/Prisma и Redis/BullMQ.
  - Поток "новый лид → LeadSession → init_queue → init‑сообщение → follow‑up#" с учётом стоп‑листа.
  - Базовый диалоговый движок c LLM и статусами воронки.
  - Модели и API для менеджеров, стоп‑листа, lead‑сессий, базы знаний, промптов, follow‑up шаблонов.
  - React‑админка, покрывающая большую часть операционного управления ботом.

- **Частично/не реализовано (следующие шаги)**:
  - Полный state machine по ТЗ (квалификация, возражения, автоматическая эскалация, все лимиты).
  - Мультиязычность в диалоге (RU/KZ/SHALAKAZ) и детальная работа с языками.
  - Полноценный RAG (pgvector, эмбеддинги, интеграция в промпт).
  - Calendly/Zoom end‑to‑end: бронирование слотов, webhook‑и, напоминания.
  - Рабочее время и off‑hours обработка.
  - Наблюдаемость уровня продакшена (метрики, дашборды, алерты).

Этот документ отражает **фактическую реализацию** по состоянию на текущий репозиторий, сверенную с кодом (`src/*`, `prisma/schema.prisma`, `admin-frontend/*`) и требованиями из `TZ_AI_Bot_v5.0_FINAL.md`.

