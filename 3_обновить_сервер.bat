@echo off
chcp 65001 >nul
REM ========== Настрой один раз ==========
set SERVER_USER=admin
set SERVER_HOST=chatbot1.vps.webdock.cloud
set SERVER_PATH=/var/www/ai-sales-bot
REM Путь к приватному SSH-ключу (если сервер пускает только по ключу). Пример:
REM set SSH_KEY=C:\Users\eweti\.ssh\webdock_key.pem
set SSH_KEY=
REM ======================================

echo Подключаюсь к серверу и обновляю код...
echo.
if "%SSH_KEY%"=="" (
  ssh %SERVER_USER%@%SERVER_HOST% "cd %SERVER_PATH% && chmod +x deploy.sh 2>nul && ./deploy.sh"
) else (
  ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd %SERVER_PATH% && chmod +x deploy.sh 2>nul && ./deploy.sh"
)
echo.
echo Готово. Закрой окно или нажми любую клавишу.
pause >nul
