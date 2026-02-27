# Пуш с GitHub на сервер и файлы на своём компьютере

Две вещи: **(1)** чтобы у тебя на компе были актуальные файлы из репозитория; **(2)** чтобы при пуше в GitHub сервер сам подтягивал код и перезапускал приложение.

---

## 1. Файлы на твоём компьютере

Когда подключишься к GitHub, просто клонируй репозиторий в нужную папку:

```powershell
cd "C:\Users\eweti\OneDrive\Рабочий стол"
git clone https://github.com/mirosnikovevpatij-design/ai-sales-bot.git
cd ai-sales-bot
```

После этого у тебя будет полная копия проекта. Дальше:

- **Получить последние изменения** (после того как кто-то что-то запушил):  
  `git pull origin main`
- **Отправить свои изменения в GitHub**:  
  `git add .` → `git commit -m "описание"` → `git push origin main`

Если проект уже лежит в папке (например, AsistentBot) и там уже был `git init` и `remote`, то просто заходишь в эту папку и делаешь `git pull`, чтобы подтянуть обновления.

---

## 2. Автодеплой: при пуше в GitHub сервер сам обновляется

Сейчас после пуша кто-то вручную заходит по SSH и выполняет `git pull`, `npm run build`, `pm2 restart`. Можно сделать так, чтобы сервер делал это **сам**, когда в GitHub приходит пуш.

Есть два рабочих варианта.

### Вариант A: Webhook на сервере (рекомендуется)

GitHub при каждом пуше в репозиторий отправляет запрос (POST) на твой сервер. На сервере стоит маленький скрипт, который принимает этот запрос и запускает обновление.

**На сервере (один раз):**

1. В репозитории уже есть скрипт **deploy.sh** в корне. После клонирования на сервер выполнить:  
   `chmod +x /var/www/ai-sales-bot/deploy.sh`  
   Внутри скрипта: `git pull`, `npm ci`, `prisma generate`, `prisma migrate deploy`, `npm run build`, `pm2 restart ai-sales-bot`.

2. Поднять «приёмник» вебхука — сервис, который слушает POST и вызывает этот скрипт. Варианты:
   - **webhook-сервис в одну команду** (если установлен Node): например пакет `github-webhook-handler` или простой Express-сервер, который по секретному URL вызывает `child_process.exec('deploy.sh')`.
   - Или **отдельный мини-сервер** на порту, например 9000, который принимает POST только с правильным заголовком/токеном и запускает `./deploy.sh`.

3. В **GitHub** в репозитории: **Settings → Webhooks → Add webhook**:
   - **Payload URL**: `https://chatbot1.vps.webdock.cloud/deploy` (или тот путь/порт, куда ты настроил приёмник).
   - **Content type**: `application/json`.
   - **Secret**: придумать длинный случайный пароль и тот же указать в скрипте на сервере, чтобы принимать только запросы с этим секретом.
   - **Events**: «Just the push event».
   - Сохранить.

Тогда при каждом `git push` в ветку (например `main`) GitHub шлёт POST на этот URL, сервер проверяет секрет и запускает `deploy.sh`.

### Вариант B: GitHub Actions (SSH на сервер)

Репозиторий при пуше запускает workflow: по SSH подключается к серверу и выполняет те же команды (git pull, npm install, migrate, build, pm2 restart).

**В репозитории** создать файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to server
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/ai-sales-bot
            git pull origin main
            npm install
            npx prisma migrate deploy
            npm run build
            pm2 restart ai-sales-bot
```

В **GitHub** в репозитории: **Settings → Secrets and variables → Actions** — добавить:

- `SERVER_HOST` — IP или домен сервера (например `chatbot1.vps.webdock.cloud`).
- `SERVER_USER` — пользователь SSH (например `admin`).
- `SSH_PRIVATE_KEY` — полный текст приватного SSH-ключа, которым заходишь на сервер.

После пуша в `main` Actions сам зайдёт на сервер и выполнит деплой.

---

## Что выбрать

- **Вариант A (webhook)**: не нужны секреты в GitHub (кроме секрета вебхука), всё управление на сервере; нужно один раз настроить приёмник POST.
- **Вариант B (Actions)**: не нужен отдельный сервис на сервере, но в GitHub должны лежать секреты доступа к серверу (SSH ключ).

Оба варианта дают результат: **пуш в GitHub → сервер сам обновляется и перезапускает бота**.

Если напишешь, какой вариант удобнее (webhook или Actions), могу расписать шаги под твой хостинг (Webdock) и выбранный способ.
