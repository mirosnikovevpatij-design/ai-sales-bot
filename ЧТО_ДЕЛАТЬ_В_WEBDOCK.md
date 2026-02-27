# Что делать в Webdock по шагам

Сервер: **Чат-бот** (193.180.212.180, Noble LEMP 8.3). Postgres и Redis ставим на нём же через Docker из репо.

---

## Шаг 1. Открыть консоль сервера

В панели Webdock найди свой сервер (chatbot1.vps.webdock.cloud или по имени).

Должна быть одна из кнопок/ссылок:
- **Console** или **Terminal** — открыть консоль в браузере;
- или **SSH** — покажет команду для входа (типа `ssh admin@...`).

**Нужно:** открыть **консоль в браузере** (Console/Terminal), чтобы вводить команды на сервере. Если такой кнопки нет — в разделе сервера ищи «Access», «Connect», «Terminal».

---

## Шаг 2. В консоли — проверить, есть ли Node и Git

В открывшейся консоли (чёрное окно с приглашением вроде `admin@...:~$`) введи по очереди и нажимай Enter:

```bash
node -v
git --version
```

- Если видишь версии (например `v20.x` и `git version 2.x`) — переходи к шагу 3.
- Если пишет «command not found» — на сервере нет Node или Git. Тогда нужно либо установить их (инструкция ниже в разделе «Если нет Node/Git»), либо написать в поддержку Webdock: «Нужны Node.js и Git на сервере».

---

## Шаг 3. Клонировать проект с GitHub

В той же консоли введи (по одной строке, Enter после каждой):

```bash
cd /var/www
sudo git clone https://github.com/mirosnikovevpatij-design/ai-sales-bot.git
cd ai-sales-bot
```

Если папки `/var/www` нет или нет прав — попробуй `cd ~` и потом `git clone ...` в домашнюю папку (путь будет другой, запомни его).

---

## Шаг 4. Postgres и Redis через Docker (рекомендуется)

Ставим на этом же сервере PostgreSQL и Redis из нашего репо: `docker compose up -d` в папке проекта.

**4.1. Проверить, есть ли Docker**

В консоли:
```bash
docker --version
docker compose version
```

Если команды не найдены — установить Docker (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```
После этого **выйти из консоли и зайти снова** (или перезайти по SSH), чтобы группа `docker` применилась.

**4.2. Запустить Postgres и Redis**

Перейди в папку проекта (если ещё не там):
```bash
cd /var/www/ai-sales-bot
```
или, если клонировал в домашнюю папку:
```bash
cd ~/ai-sales-bot
```

Запуск контейнеров:
```bash
sudo docker compose up -d
```

Проверка:
```bash
sudo docker compose ps
```
Должны быть в статусе Up: `postgres` (порт 5433) и `redis` (порт 6379).

**4.3. Что прописать в .env**

В `.env` на сервере укажи:
- `DATABASE_URL="postgresql://ai_bot:ai_bot_password@localhost:5433/ai_sales_bot?schema=public"`
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`

Порт **5433** — потому что в нашем `docker-compose.yml` Postgres снаружи открыт на 5433.

---

## Шаг 5. Создать .env на сервере

В консоли ты в папке проекта (ai-sales-bot). Выполни:

```bash
cp .env.example .env
nano .env
```

Откроется редактор. Заполни минимум:
- `DATABASE_URL` — строка подключения к Postgres (как дал хостинг или как выше для Docker).
- `REDIS_HOST=localhost` и `REDIS_PORT=6379`.
- `JWT_SECRET` — любая длинная случайная строка (для админки).

Остальное пока можно не трогать. Сохранить в nano: **Ctrl+O**, Enter, выход **Ctrl+X**.

---

## Шаг 6. Установка и первый запуск

В консоли, в папке проекта:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

Потом запуск (если установлен PM2):

```bash
pm2 start dist/main.js --name ai-sales-bot
```

Если PM2 нет — можно один раз запустить так (пока не закроешь консоль):

```bash
node dist/main.js
```

Проверка: в браузере открыть `http://IP_СЕРВЕРА:3000/api` (или с доменом, если уже настроен) — должен ответить API.

---

## Кратко

1. В Webdock открыть **Console** (терминал) сервера.
2. В консоли: проверить `node -v` и `git --version`.
3. Клонировать репо в `/var/www/ai-sales-bot` (или в `~/ai-sales-bot`).
4. Поднять Postgres и Redis (панель или `docker compose up -d`).
5. В папке проекта: `cp .env.example .env`, отредактировать `.env`.
6. Выполнить: `npm install`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run build`, затем `pm2 start dist/main.js --name ai-sales-bot`.

Если на каком-то шаге непонятно или ошибка — напиши, на каком именно шаге и что пишет консоль.
