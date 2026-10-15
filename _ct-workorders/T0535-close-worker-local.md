---
schema_version: 1
schema_kind: workorder
id: T0535
title: "PLAN-041 B'-1：BAT 本機 `--close-worker`（歸屬驗證、延遲計時與取消、與 ✕ 相同的關閉路徑）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: M
created_at: "2026-10-15T15:44:39+0800"
updated_at: "2026-10-15T15:44:39+0800"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - PLAN-041
  - T0534（研究回報 §1、§4–§6）
  - D144
affects_files:
  - electron/pty-manager.ts
  - electron/terminal-command-handlers.ts
  - electron/handlers/terminal.ts
  - electron/handlers/pty.ts
  - electron/preload.ts
  - electron/main.ts
  - src/types/electron.d.ts
  - src/App.tsx
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - scripts/bat-terminal.mjs
  - electron/__tests__/
  - src/**/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0535-close-worker-local.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。e2e 一律隔離實例，Worker 用自訂 CLI 跑 node 腳本，不耗 token（範本 `e2e/t0529-workspace-agent-launch.spec.ts`）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141），只跑本單新增 / 相關 spec。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 **No Regressions**：使用者按 ✕ 的行為（確認框條件、`stopSession` / `pty.kill` 分支、worktree 清理勾選）必須完全不變。"
  - "🔴 **不加 Settings 開關**（D144：要不要回收、延遲多久由 CT `*config` 決定）。"
---

# T0535 — BAT 本機 `--close-worker`

## 背景

見 PLAN-041 與 T0534 回報區。介面契約（參數、exit code）**以 PLAN-041「介面契約」節為準**，CT-T011 依同一份契約撰寫，不得自行更改；確有必要更改時在回報區說明理由，由塔台同步更新 PLAN 與 CT-T011。

## 任務

1. **記錄工單與查詢（`electron/pty-manager.ts`）**
   - `PtyInstance` 新增 `workorder?: string`。`terminal:create-agent-command` 有 `workorder` 參數時寫入（`terminal-command-handlers.ts` → `createWithCommand` → `ptyManager.create`）。`pty:restart` 與 Terminal Server recovery 沿用（比照 T0525 的 `customEnv` / `agentPreset`）。
   - 新增 public 查詢：`findWorkerTerminals(towerId, workorder): string[]`（比對 `customEnv.BAT_TOWER_TERMINAL_ID` 與 `workorder`）、`getLastOutputAt(id)`、`getLastUserInputAt(id)`（後兩者若既有欄位可用就沿用）。
   - 工單編號比對：大小寫一致、去掉前後空白；格式同 helper `--workorder` 規則。
2. **主行程 handler `terminal:close-worker`**（`{ towerId, workorder, delayMs? }`）
   - 參數驗證失敗 → `{ ok:false, code:'INVALID_ARGS' }`。
   - 查詢：0 個 → `NOT_FOUND`；>1 個 → `AMBIGUOUS`。
   - 歸屬：以工單查到分頁，但它的 `BAT_TOWER_TERMINAL_ID` 不是 `towerId` → `NOT_OWNER`。實作方式：先只以 `workorder` 找候選，再比對 tower，以區分 `NOT_FOUND` 與 `NOT_OWNER`。
   - 閒置：最近 `CLOSE_WORKER_IDLE_MS = 5000` 內有輸出 → `BUSY`（常數，不開放設定）。
   - 通過 → 回 `{ ok:true, terminalId, closeAt }`，`delayMs` 夾在 `0–300000`。
   - **延遲在 main 計時**。到期前若該分頁有**新輸出**或**來自 renderer 的 `pty:write`**（使用者打字）→ 取消，`logger.log` 記原因。到期時分頁已不存在 → 靜默結束。同一分頁重複請求 → 以最新一次為準（重設計時器）。
   - 到期 → 送 `terminal:close-requested { id }` 給**所有視窗**（含 detached；持有該分頁的 `WorkspaceView` 處理，其他視窗忽略）。
   - 日誌前綴 `[close-worker]`，記錄 towerId / workorder / 結果 / 取消原因。`bat-scripts.log` 由 helper 記事件 `close-worker`。
3. **Renderer**
   - 把 `WorkspaceView.tsx` `handleConfirmClose` 的關閉邏輯抽成共用函式（例如 `closeTerminalNow(id, { cleanWorktree })`）。✕ 路徑改呼叫它，**行為逐項不變**。
   - 收到 `terminal:close-requested`：分頁屬於本視窗 → `closeTerminalNow(id, { cleanWorktree: false })`（不跳確認框，不清 worktree）→ `removeTerminal` + `save()`。
   - preload / `electron.d.ts` 補上事件型別。
4. **Helper `scripts/bat-terminal.mjs`**
   - 新增 `--close-worker <T####>`、`--delay-ms <n>`；`--notify-id` 必填。與建立分頁的參數互斥（用法錯誤 exit 1）。
   - 依 PLAN-041 契約對應 exit code：`0` / `3 NOT_FOUND` / `4 NOT_OWNER` / `5 AMBIGUOUS` / `6 BUSY` / `1` 其他；stderr 印 `close-worker: <CODE>`；成功時 stdout 印 `✓ Worker close scheduled: <id> (in <n> ms)`。
   - 回應以 frame id 比對（BUG-114 規則，沿用 `waitForMessage`）。`--help` 補說明。
   - 確認舊版行為：在 `--close-worker` 之前沒有位置參數時，舊版會 `Unknown option` exit 1、不建立分頁（契約依此設計，回報區附實際輸出）。
5. **文件**：CLAUDE.md 新增「Worker 分頁回收（PLAN-041）」小節：契約、BAT 檢查、延遲取消條件、已知限制（BAT 重開後在 T0537 之前回 `NOT_FOUND`、遠端見 T0536）。

## 驗收條件

- [ ] 單元測試：`INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS` / `BUSY` / 成功；延遲期間新輸出取消、使用者輸入取消、重複請求重設計時；`delayMs` 夾值；restart 後 `workorder` 保留
- [ ] source guard 或測試：✕ 路徑（確認框條件、`stopSession` / `pty.kill` 分支、worktree 清理）不變
- [ ] helper 測試：各 exit code、互斥參數、`--help`（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp）
- [ ] e2e（隔離實例，自訂 CLI 跑 node 腳本）：派工 → Worker 輸出停止 → `--close-worker` → 分頁消失、registry 不含該 id → 重開實例不還原；detached 視窗中的 Worker 同樣可關；延遲期間打字會取消
- [ ] Windows Terminal Server 模式關閉後子程序是否結束，由 T0540（PLAN-042）專責實測與修正；本單不改 `killPty`，只要求不退化
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

（Worker 填寫）
