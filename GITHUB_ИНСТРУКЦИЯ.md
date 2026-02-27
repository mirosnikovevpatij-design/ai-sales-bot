# Работа через GitHub (логи для заказчика)

Все изменения ведём в Git и пушим в GitHub — у заказчика будет полная история коммитов.

**Файлы на своём компьютере** — клонируй репо: `git clone https://github.com/mirosnikovevpatij-design/ai-sales-bot.git` (подробнее и автодеплой при пуше на сервер — в **[ПУШ_С_GITHUB_НА_СЕРВЕР.md](ПУШ_С_GITHUB_НА_СЕРВЕР.md)**).

## Что уже сделано в проекте

- Файл **.gitignore** — в репозиторий не попадут `node_modules`, `.env` (ключи), `dist`, служебные папки. В репо будут только исходники и конфиги без секретов.

## Первая настройка (один раз)

### 1. Создать репозиторий на GitHub

- Зайди на https://github.com (под своим или аккаунтом заказчика).
- **New repository** → название, например `ai-sales-bot`.
- **Не** добавляй README / .gitignore при создании (они уже есть в проекте).
- Скопируй URL репозитория (например `https://github.com/username/ai-sales-bot.git`).

### 2. Инициализировать Git в проекте и первый пуш

В PowerShell в папке проекта:

```powershell
cd "C:\Users\eweti\OneDrive\Рабочий стол\AsistentBot"

git init
git add .
git status
```

Проверь по `git status`, что в списке **нет** файла `.env` (он должен быть проигнорирован). Если `.env` есть в списке — не делай `git add .env`.

```powershell
git commit -m "Initial: NestJS + Prisma, лиды, очередь, диалог, админка, ключи в .env.example"
git branch -M main
git remote add origin https://github.com/mirosnikovevpatij-design/ai-sales-bot.git
git push -u origin main
```

Репозиторий: https://github.com/mirosnikovevpatij-design/ai-sales-bot GitHub может попросить логин/пароль или токен — введи их.

## Дальше (каждый раз после изменений)

```powershell
git add .
git status
git commit -m "Краткое описание: что сделал"
git push
```

Заказчик сможет смотреть историю коммитов, ветки и изменения прямо на GitHub.

## Важно

- **Файл `.env` с ключами в репозиторий не попадает** (он в .gitignore). Ключи заказчик подставляет у себя или на сервере отдельно.
- Шаблон переменных — в **.env.example** и в **КЛЮЧИ_И_НАСТРОЙКИ.md**; их можно коммитить.
