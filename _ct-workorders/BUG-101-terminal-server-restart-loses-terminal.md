---
schema_version: 1
schema_kind: bug
id: BUG-101
title: "本機 Terminal Server 模式的終端「重新啟動」會讓終端失聯：舊 PTY 的 onExit 無條件刪掉同 id 的新 entry"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-05T00:41:57+08:00"
updated_at: "2026-10-05T01:01:44+08:00"
impact:
  - local-terminal
links:
  fix_workorder: T0394
  related: [T0390, PLAN-036]
---

# BUG-101 — Terminal Server 模式 restart 後終端失聯

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（影響所有使用者的本機一般終端「重新啟動」按鈕） |
| 可重現 | 100%（T0390 Worker 以 Playwright smoke 在 HEAD 基準 `090ca2a` 與修改後皆重現；塔台 00:41 複核程式碼） |
| **狀態** | ✅ FIXED（T0394 `ea52b03`；待下一版 build 實機，需先結束舊 Terminal Server） |
| 回報者 | T0390 Worker（回報區「偏差 / 風險 / 後續」第 1 點） |

## 現象

- 本機終端（Terminal Server 模式，預設）按「重新啟動」（`WorkspaceView.tsx` `pty.restart`）後，`getCwd` = null、輸入無輸出，renderer 印 `[Process exited]`

## 根因（程式碼證據）

- `restart()` = kill + 同 id create
- `electron/terminal-server/server.ts` 舊 PTY 的 `ptyProcess.onExit` 無條件 `this.ptys.delete(req.id)`、`removePtyEntry`、廣播 `pty:exit` ⇒ 刪掉 server 上**新** PTY 的 entry
- main 端 `PtyManager.handlePtyExit` 也再刪掉新 instance ⇒ 之後 write 回 `pty-not-found`
- 與 T0390 修的 direct 模式 bug 同類（T0390 以 `handleDirectExit` 比對「entry 是否已被新行程取代」修正 direct 模式）

## 修復方向

- `terminal-server/server.ts` onExit 比照 `handleDirectExit`：entry 已屬於較新行程時不刪、不廣播；main 端 `handlePtyExit` 同樣防護
- ⚠️ Terminal Server 跨 BAT 重啟存活，舊版 server 行程需重啟後才換新（驗收時注意）
- 不影響：claude-cli preset（走 kill + `startClaudeCliPty`）

## 修復紀錄（T0394，`ea52b03`，塔台 2026-10-05 01:01 複驗）

- server：`terminal-server/server.ts` `handlePtyExit(id, proc, exitCode)` —— entry 存在且屬於別的 PTY 才視為 stale（不刪、不清 registry、不廣播）；entry 已被 kill 刪除時照常廣播 `pty:exit`（Worker 指出工單字面條件會破壞一般 kill，改採 `handleDirectExit` 同形條件，塔台同意）
- main：`PtyInstance.awaitingCreated`，restart 後收到 `pty:created` 前的 exit 一律視為舊行程（縱深防禦，涵蓋 server 處理 kill 與 create 之間的時序縫隙；不需改 protocol）
- 塔台複驗：1083 tests / vite build exit 0（`dist-electron/terminal-server.js` 含 `stale exit ignored`）/ tsc 40
- ⚠️ 已存活的舊版 Terminal Server 不吃新碼：驗收前關閉 BAT 時勾選「結束 Terminal Server」；正式發版是否在 release note 提示待定

