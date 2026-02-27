@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Добавляю файлы...
git add .
echo Коммит...
git commit -m "Update %date% %time%" 2>nul
if errorlevel 1 (
  echo Нет изменений или уже закоммичено. Пушу...
) else (
  echo Пушу на GitHub...
)
git push origin main
echo.
echo Готово. Закрой это окно или нажми любую клавишу.
pause >nul
