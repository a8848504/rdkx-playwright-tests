@echo off
chcp 65001 >nul
set "PATH=C:\Users\94773\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.2-win-x64;%PATH%"
cd /d "%~dp0"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0.browsers"
call "%~dp0node_modules\.bin\playwright.cmd" test tests/business/positions.spec.js tests/business/permissions.spec.js tests/business/users.spec.js --project=rdkx --workers=1 --headed
pause




