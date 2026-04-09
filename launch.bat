@echo off
cd /d "C:\Users\User\projects\better-agent-terminal"
call npm run compile >nul 2>&1
start "" npx electron .