@echo off
REM Double-click to launch the CRILOS Dashboard (Windows). Always runs on port
REM 3000 so the Memberful sign-in redirect (registered for :3000) keeps working.
REM After launch this window closes and the server keeps running hidden in the
REM background. Stop it with "Sign out & quit" in the dashboard, or by
REM relaunching this script.
cd /d "%~dp0"

REM Free port 3000 so a leftover dashboard instance can't push this one onto
REM 3001 (which would break sign-in). Kills whatever is listening on 3000.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; exit 0"

REM Install dependencies on first run (visible so you can watch progress).
if not exist node_modules ( call npm install )

REM Open the browser a few seconds after the server starts listening.
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"

REM Start the dev server hidden and detached so this window can close without
REM stopping it. Output goes to a temp log for troubleshooting.
powershell -NoProfile -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'crilos-dashboard-dev.log') -RedirectStandardError (Join-Path $env:TEMP 'crilos-dashboard-dev.err.log')"

REM Done - close this window.
exit
