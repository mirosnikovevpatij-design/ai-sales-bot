@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Скачиваю последние изменения с GitHub...
git pull origin main
echo.
echo Готово. Закрой это окно или нажми любую клавишу.
pause >nul
