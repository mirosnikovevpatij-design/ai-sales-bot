# Чек-лист: заливка на GitHub и на сервер

## Что уже есть в репозитории

| Нужно для GitHub / сервера | Есть в проекте |
|----------------------------|----------------|
| Не пушить секреты и мусор | **.gitignore** (.env, node_modules, dist) |
| Шаблон переменных на сервере | **.env.example** |
| Инструкция по ключам | **КЛЮЧИ_И_НАСТРОЙКИ.md** |
| Как пушить и клонировать | **GITHUB_ИНСТРУКЦИЯ.md** |
| Автодеплой при пуше | **ПУШ_С_GITHUB_НА_СЕРВЕР.md** + **deploy.sh** + **.github/workflows/deploy.yml** |
| Деплой на сервер вручную | **ДЕПЛОЙ_НА_СЕРВЕР.md** |
| Postgres + Redis локально/на сервере | **docker-compose.yml** |
| Сборка и миграции | **package.json** (build, prisma), **prisma/schema.prisma** |

Всё перечисленное можно коммитить и пушить — для заливки на GitHub и выкладки на сервер этого достаточно.

---

## Что сделать один раз

### GitHub

1. Репозиторий на GitHub уже есть: **mirosnikovevpatij-design/ai-sales-bot**.
2. На своём компе в папке проекта:
   - если репо ещё не привязан: `git remote add origin https://github.com/mirosnikovevpatij-design/ai-sales-bot.git`;
   - первый пуш: `git add .` → `git commit -m "..."` → `git push -u origin main`.
3. Дальше: изменения → `git add .` → `git commit -m "..."` → `git push`.

### Сервер

1. На сервере: **PostgreSQL** и **Redis** (самостоятельно или через `docker compose` из репо).
2. Клонировать репо (один раз):  
   `git clone https://github.com/mirosnikovevpatij-design/ai-sales-bot.git` в нужную папку (например `/var/www/ai-sales-bot`).
3. На сервере создать **.env** (скопировать с **.env.example** и подставить DATABASE_URL, REDIS_*, JWT_SECRET и при необходимости ключи API).
4. Первый запуск на сервере:  
   `npm ci` → `npx prisma generate` → `npx prisma migrate deploy` → `npm run build` → запуск приложения (например `pm2 start dist/main.js --name ai-sales-bot`).
5. Дальше обновления: вручную выполнять **deploy.sh** или включить автодеплой по **ПУШ_С_GITHUB_НА_СЕРВЕР.md** (webhook или GitHub Actions).

---

## Итог

Для заливки на GitHub и выкладки на сервер в репозитории всё нужное уже есть. Остаётся: настроить remote и пушить с компа, на сервере один раз клонировать, создать .env и первый раз собрать/запустить, при желании настроить автодеплой.
