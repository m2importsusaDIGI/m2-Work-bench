@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
    echo Git isn't installed. Get it from https://git-scm.com/downloads
    echo then reopen this folder and double-click setup.bat again.
    pause
    exit /b
)

REM --- Git identity ---
for /f "delims=" %%i in ('git config user.name 2^>nul') do set CURNAME=%%i
if "!CURNAME!"=="" (
    echo Git needs a name and email for commits ^(just for the commit log, not a real login^).
    set /p GIT_NAME="Your name: "
    set /p GIT_EMAIL="Your email: "
    git config --global user.name "!GIT_NAME!"
    git config --global user.email "!GIT_EMAIL!"
    echo Saved.
) else (
    echo Git identity: !CURNAME! ^<
    for /f "delims=" %%i in ('git config user.email 2^>nul') do echo !CURNAME! ^(%%i^)
)
echo.

REM --- Repo init if needed ---
if not exist ".git" (
    git init
    git branch -M main
)

REM --- Remote check / fix ---
set CURREMOTE=
for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set CURREMOTE=%%i
if "!CURREMOTE!"=="" (
    echo No GitHub repo connected yet.
) else (
    echo Current remote: !CURREMOTE!
)
echo.
set /p REPO_URL="Paste your FULL GitHub repo URL to set/fix it (e.g. https://github.com/yourname/repo.git), or press Enter to keep the one above: "
if not "!REPO_URL!"=="" (
    git remote remove origin >nul 2>nul
    git remote add origin !REPO_URL!
    echo Remote set to: !REPO_URL!
)
echo.

REM --- Commit & push ---
git add -A
set /p MSG="Describe what changed (or press Enter to skip): "
if "!MSG!"=="" set MSG=Update
git commit -m "!MSG!"

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo Done. If Railway/Render is connected to this repo, it will redeploy automatically.
pause
