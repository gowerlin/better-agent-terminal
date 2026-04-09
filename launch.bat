@echo off
cd /d "C:\Users\User\projects\better-agent-terminal"
call npm run compile >nul 2>&1
:: Run electron directly (no "start") so it inherits the hidden console from VBS
npx electron . > "%APPDATA%\better-agent-terminal\launch.log" 2>&1