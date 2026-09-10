@echo off
REM Double-click this file to push your latest changes to GitHub.
REM Railway/Render will auto-redeploy once the push lands.

cd /d "%~dp0"

echo Checking for changes...
git add -A

set /p MSG="Describe what changed (or press Enter to skip a message): "
if "%MSG%"=="" set MSG=Update %date% %time%

git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Nothing to commit, or commit failed. Skipping push.
    pause
    exit /b
)

echo.
echo Pushing to GitHub...
git push

echo.
echo Done. Railway/Render will pick this up automatically.
pause
