# 🐛 BUG-038:ELECTRON_RUN_AS_NODE=1 洩漏至 terminal 子 shell

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-038 |
| **狀態** | ✅ FIXED（等使用者驗收 → CLOSED） |
| **修復時間** | 2026-04-18 02:33 (UTC+8) |
| **修復方案** | 方案 B — PTY spawn 時刪除 `ELECTRON_RUN_AS_NODE` |
| **嚴重度** | 🟡 Medium |
| **可重現** | ✅ 100%(在 BAT 內執行 `npm run dev` 任何 Electron app) |
| **有 Workaround** | ✅ 有(`env -u ELECTRON_RUN_AS_NODE npm run dev`) |
| **發現時間** | 2026-04-18 02:09 (UTC+8) |
| **發現者** | EXP-ELECTRON41-001 Worker |
| **關聯工單** | EXP-ELECTRON41-001 / T0161(修復) |
| **關聯決策** | D049 |
| **性質** | 既有問題(Electron 28 時代就存在,EXP 中被顯現化) |

---

## 現象

在 BAT 內開啟的 terminal 子 shell 執行 `npm run dev`(或任何 Electron app 啟動命令),主 process 報錯:
```
TypeError: Cannot read properties of undefined (reading 'getPath')
    at ... (e.g. snippet-db.ts:45)
```

`require('electron')` 回傳 exec path 字串(而非 API object),`.app` 存取當然失敗。

## 預期 vs 實際

- **預期**:Electron app 正常啟動,`electron.app` 是合法 API
- **實際**:Electron 以 Node-only mode 啟動(`ELECTRON_RUN_AS_NODE=1` 生效),API 未載入

## 根因(EXP-ELECTRON41-001 診斷)

- BAT 自身 `electron/claude-agent-manager.ts:511, 1233` 設定 `ELECTRON_RUN_AS_NODE=1` 讓 Electron 跑 Claude Agent SDK(非 GUI mode)
- 雖有清理邏輯 `claude-agent-manager.ts:751, 1410`,但**該變數洩漏到 BAT main process spawn 的 terminal 子 shell**
- Terminal 子 shell 啟動 `npm run dev` → 新 electron child process → 繼承環境 → 走 Node mode → GUI API 未載入

## 影響範圍

- 任何在 BAT 內 terminal 開發 Electron app 的場景(包含 BAT 本身的 dogfooding)
- **只要在 BAT 外部 terminal 跑就沒事**(例如系統原生 cmd / Windows Terminal 獨立啟動)
- Workaround 簡單但使用者不一定知道根因

## 修復方向(T0161)

1. **首選**:在 `pty-manager` 或 terminal spawn 流程中,建立乾淨的 `env`(排除 `ELECTRON_RUN_AS_NODE`)
2. **次選**:將 `ELECTRON_RUN_AS_NODE` 設定範圍縮小,只在實際 spawn Claude Agent SDK child 時才設(不洩漏到 main process 的 global env)

需先讀 `claude-agent-manager.ts:511, 1233, 751, 1410` 確認設值/清理時序,和 pty spawn 點是否在兩者之間。

## 塔台備註

- EXP-ELECTRON41-001 找到此 bug,D049 決定**立即派 T0161 修復**(不延後)
- 修復與 Electron 41 升級邏輯獨立,不需綁 T0160(可並行)

## 修復摘要（T0161）

- **方案**：B（PTY spawn 時刪除），方案 A 需改動 SDK 啟動行為（工單硬限制禁止）。
- **改動點**：
  - `electron/pty-manager.ts`：node-pty 分支與 child_process fallback 在 `pty.spawn` / `spawn` 之前 `delete envWithUtf8.ELECTRON_RUN_AS_NODE`。
  - `electron/terminal-server/server.ts`：`createPty` 組 env 後 `delete ptyEnv.ELECTRON_RUN_AS_NODE`。
- **未動**：`claude-agent-manager.ts` 設值/清理邏輯維持，SDK 啟動行為完全未變。
- **回歸風險**：極低。Claude SDK 子程序仍能繼承 `ELECTRON_RUN_AS_NODE=1`（因為 SDK 在 main process 內用 `process.env` 繼承），PTY 子程序明確過濾。
