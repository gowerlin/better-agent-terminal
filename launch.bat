@echo off
cd /d "C:\Users\User\projects\better-agent-terminal"
call npm run compile >nul 2>&1
:: Log file for diagnostics (hidden from user)
start "" npx electron . > "%APPDATA%\better-agent-terminal\launch.log" 2>&1