---
schema_version: 1
schema_kind: bug
id: BUG-095
title: "`claude:abort-session` 只進 handler registry、未列入 `PROXIED_CHANNELS`，沒有 `ipcMain.handle` → Claude / Codex 面板的中止（abort）呼叫一律失敗"
status: CLOSED
severity: high
reproducibility: always
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T01:36:42+08:00"
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
| **狀態** | 🚫 CLOSED（2026-10-05 01:36，T0397 e2e 自動驗收 + 使用者裁決結案） |
| 回報者 | T0386 Worker（研究目標 1 channel 盤點） |

## 現象（程式碼證據）

- `electron/main.ts:2303` `registerHandler('claude:abort-session', …)` —— 只寫進 `handler-registry`（`electron/remote/handler-registry.ts:9-11`）
- `ipcMain.handle` 只由 `bindProxiedHandlersToIpc()`（`electron/main.ts:3062-3089`）對 `PROXIED_CHANNELS` 白名單綁定；`claude:abort-session` **不在** `electron/remote/protocol.ts` 的 `PROXIED_CHANNELS`
- renderer 呼叫點：`src/components/ClaudeAgentPanel.tsx:1302` / `:1475`、`src/components/CodexAgentPanel.tsx:1560` / `:1848`（`electron/preload.ts:148` `ipcRenderer.invoke('claude:abort-session', …)`）
- ⇒ invoke 應得 `No handler registered for 'claude:abort-session'` reject；中止無效

## 待確認

- runtime：Agent 面板執行中按中止 / Esc，DevTools 或 debug log 是否出現 reject；是否有其他路徑（例如 stop）掩蓋了症狀
- 是否還有其他「`registerHandler` 了但不在 `PROXIED_CHANNELS`、也沒有獨立 `ipcMain.handle`」的孤兒 channel（T0392 一併盤點）

## 修復紀錄（T0392，`f72e177`，塔台 2026-10-05 00:09 複驗）

- `electron/remote/protocol.ts` `PROXIED_CHANNELS` 加 `'claude:abort-session'`（產品碼僅此 1 行）
- 守門測試 `electron/remote/__tests__/proxied-channels-binding.test.ts`（5 項）：每個 `registerHandler` channel 必須在 `PROXIED_CHANNELS` ∪ 獨立 `ipcMain.handle` ∪ `REGISTRY_ONLY_CHANNELS`；每個 preload `ipcRenderer.invoke` 都有 IPC 綁定。盤點 106 個 registered channel，`claude:abort-session` 為**唯一**孤兒
- 塔台複驗：守門測試 5/5 pass；Worker 全套 970 tests / vite build / tsc 40（含當時 T0387 dirty tree）
- T0388 headless ledger 已將 `claude:abort-session` 列為 P1（`electron/remote/headless-channel-status.ts:60`）
- runtime（交使用者，下一版 build）：Claude Agent 面板長回應中按中止 / Esc，回應停止、debug log 無 `No handler registered`

## 關閉原因

- 2026-10-05 01:36 使用者裁決 CLOSED。證據：T0397 `e2e/plan036-p0.spec.ts`（`e5215c1`），Worker 2 次 + 塔台 01:34 複跑皆 4/4 PASS
- E1：隔離 runtime 以 renderer `abortSession(<不存在 id>)` → `{ok:true,value:false}`，無 `No handler registered`；`PROXIED_CHANNELS` 內 43 個 `claude:*` 全數有 `ipcMain` handler
- 證據層：source build（`dist-electron/`）；使用者安裝版 build 自 `2e902de`，與測試時 HEAD 之產品程式碼相同（其後 commit 僅 `scripts/` / `e2e/` / `playwright.config.ts` / `_ct-workorders/`）
