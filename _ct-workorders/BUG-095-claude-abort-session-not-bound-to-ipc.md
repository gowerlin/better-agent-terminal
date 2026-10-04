---
schema_version: 1
schema_kind: bug
id: BUG-095
title: "`claude:abort-session` 只進 handler registry、未列入 `PROXIED_CHANNELS`，沒有 `ipcMain.handle` → Claude / Codex 面板的中止（abort）呼叫一律失敗"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
impact:
  - claude-agent-panel
  - codex-agent-panel
links:
  fix_workorder: T0392
  related: [T0386, PLAN-036]
---

# BUG-095 — `claude:abort-session` 沒有 IPC handler

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（本機即壞，影響所有使用者的 Agent 中止操作；推定，待 runtime 確認） |
| 可重現 | 推定 100%（程式碼證據；塔台 2026-10-04 23:56 複核） |
| **狀態** | 🔧 FIXING（T0392） |
| 回報者 | T0386 Worker（研究目標 1 channel 盤點） |

## 現象（程式碼證據）

- `electron/main.ts:2303` `registerHandler('claude:abort-session', …)` —— 只寫進 `handler-registry`（`electron/remote/handler-registry.ts:9-11`）
- `ipcMain.handle` 只由 `bindProxiedHandlersToIpc()`（`electron/main.ts:3062-3089`）對 `PROXIED_CHANNELS` 白名單綁定；`claude:abort-session` **不在** `electron/remote/protocol.ts` 的 `PROXIED_CHANNELS`
- renderer 呼叫點：`src/components/ClaudeAgentPanel.tsx:1302` / `:1475`、`src/components/CodexAgentPanel.tsx:1560` / `:1848`（`electron/preload.ts:148` `ipcRenderer.invoke('claude:abort-session', …)`）
- ⇒ invoke 應得 `No handler registered for 'claude:abort-session'` reject；中止無效

## 待確認

- runtime：Agent 面板執行中按中止 / Esc，DevTools 或 debug log 是否出現 reject；是否有其他路徑（例如 stop）掩蓋了症狀
- 是否還有其他「`registerHandler` 了但不在 `PROXIED_CHANNELS`、也沒有獨立 `ipcMain.handle`」的孤兒 channel（T0392 一併盤點）
