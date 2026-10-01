@echo off
REM ============================================================
REM  M2 SEO Audit - standalone runner for Windows
REM  Copy this file to your Desktop and double-click it.
REM
REM  First run: sets up Python packages and downloads Claude SEO
REM  (MIT, github.com/AgriciDaniel/claude-seo) into
REM  %LOCALAPPDATA%\M2SEOAudit. After that it just asks for a URL,
REM  runs the audit and opens the HTML report in your browser.
REM  Reports are saved in Documents\M2 SEO Audits.
REM ============================================================
setlocal enabledelayedexpansion
title M2 SEO Audit

set "HOME_DIR=%LOCALAPPDATA%\M2SEOAudit"
set "VENV=%HOME_DIR%\venv"
set "ENGINE=%HOME_DIR%\m2_audit.py"
set "SEO_DIR=%HOME_DIR%\claude-seo"
set "CLAUDE_SEO_VERSION=v2.4.1"
set "OUT_DIR=%USERPROFILE%\Documents\M2 SEO Audits"
set "PYTHONIOENCODING=utf-8"

if not exist "%HOME_DIR%" mkdir "%HOME_DIR%"

REM ---------- 1. Find Python 3.10+ ----------
set "PY="
where py >nul 2>nul && (py -3 -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>nul && set "PY=py -3")
if not defined PY (
    where python >nul 2>nul && (python -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>nul && set "PY=python")
)
if not defined PY (
    echo Python 3.10 or newer is not installed.
    echo Get it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
    echo Then double-click this file again.
    pause
    exit /b 1
)

REM ---------- 2. Get the engine script (m2_audit.py) ----------
REM Looks next to this .bat, then in the Workbench repo layout. If this .bat
REM lives on the Desktop, it asks once for your m2-Work-bench folder.
set "SRC="
if exist "%~dp0m2_audit.py" set "SRC=%~dp0m2_audit.py"
if not defined SRC if exist "%~dp0..\seo-engine\m2_audit.py" set "SRC=%~dp0..\seo-engine\m2_audit.py"
if not defined SRC if exist "%HOME_DIR%\workbench_path.txt" (
    set /p WB=<"%HOME_DIR%\workbench_path.txt"
    if exist "!WB!\seo-engine\m2_audit.py" set "SRC=!WB!\seo-engine\m2_audit.py"
)
if not defined SRC if not exist "%ENGINE%" (
    echo.
    echo First run: where is your m2-Work-bench folder?
    echo Example: C:\Users\you\Documents\m2-Work-bench
    set /p WB="Folder: "
    set "WB=!WB:"=!"
    if not exist "!WB!\seo-engine\m2_audit.py" (
        echo Could not find seo-engine\m2_audit.py in that folder.
        echo Pull the latest Workbench code first, then try again.
        pause
        exit /b 1
    )
    > "%HOME_DIR%\workbench_path.txt" echo !WB!
    set "SRC=!WB!\seo-engine\m2_audit.py"
)
REM Always refresh from the source so updates to the repo are picked up.
if defined SRC copy /y "!SRC!" "%ENGINE%" >nul

REM ---------- 3. One-time setup: venv + packages ----------
if not exist "%VENV%\Scripts\python.exe" (
    echo Setting up Python packages ^(one time, about a minute^)...
    %PY% -m venv "%VENV%" || (echo Could not create the Python environment. & pause & exit /b 1)
    "%VENV%\Scripts\python.exe" -m pip install --quiet --upgrade pip
    "%VENV%\Scripts\python.exe" -m pip install --quiet "beautifulsoup4>=4.12,<5" "requests>=2.32,<3" "urllib3>=2.2,<3" "lxml>=5.0,<7"
    if errorlevel 1 (
        echo Package install failed. Check your internet connection and try again.
        rmdir /s /q "%VENV%"
        pause
        exit /b 1
    )
)

REM ---------- 4. One-time setup: Claude SEO scripts ----------
if not exist "%SEO_DIR%\scripts\url_safety.py" (
    echo Downloading Claude SEO %CLAUDE_SEO_VERSION%...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$zip=Join-Path $env:TEMP 'claude-seo.zip'; $tmp=Join-Path $env:TEMP 'claude-seo-x';" ^
      "Invoke-WebRequest -UseBasicParsing 'https://github.com/AgriciDaniel/claude-seo/archive/refs/tags/%CLAUDE_SEO_VERSION%.zip' -OutFile $zip;" ^
      "if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force };" ^
      "Expand-Archive $zip $tmp -Force;" ^
      "$inner=Get-ChildItem $tmp | Select-Object -First 1;" ^
      "if (Test-Path '%SEO_DIR%') { Remove-Item '%SEO_DIR%' -Recurse -Force };" ^
      "Move-Item $inner.FullName '%SEO_DIR%';" ^
      "Remove-Item $zip, $tmp -Recurse -Force"
    if not exist "%SEO_DIR%\scripts\url_safety.py" (
        echo Download failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
)
set "CLAUDE_SEO_SCRIPTS=%SEO_DIR%\scripts"

REM ---------- 5. Audit loop ----------
:ask
echo.
echo ============================================
echo   M2 SEO Audit
echo ============================================
set "URL="
set /p URL="Website to audit (or press Enter to quit): "
if not defined URL goto :eof
set "URL=!URL:"=!"

set "PSI="
set /p PSIANS="Include Google PageSpeed? Slower, about a minute. (y/N): "
if /i "!PSIANS!"=="y" set "PSI=--psi"

echo.
echo Auditing !URL! ...
set "REPORT="
for /f "usebackq delims=" %%L in (`""%VENV%\Scripts\python.exe" "%ENGINE%" "!URL!" --out-dir "%OUT_DIR%" !PSI!"`) do (
    set "LINE=%%L"
    if "!LINE:~0,7!"=="REPORT=" (set "REPORT=!LINE:~7!") else (echo !LINE!)
)

if defined REPORT (
    echo Report saved: !REPORT!
    start "" "!REPORT!"
) else (
    echo The audit did not finish. See the message above.
)
goto ask
