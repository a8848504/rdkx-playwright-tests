@echo off
chcp 65001 >nul
set "PATH=C:\Users\94773\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.2-win-x64;%PATH%"
cd /d "%~dp0"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0.browsers"
curl.exe --noproxy "*" -fsS http://127.0.0.1:9323/ >nul 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:9323/"
  exit /b 0
)
call "%~dp0node_modules\.bin\playwright.cmd" test --ui --ui-host=127.0.0.1 --ui-port=9323
pause

