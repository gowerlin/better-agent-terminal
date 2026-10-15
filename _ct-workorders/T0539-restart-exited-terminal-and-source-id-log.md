---
schema_version: 1
schema_kind: workorder
id: T0539
title: "PLAN-042：修 BUG-137（已結束分頁 ⏻ 重啟無效）＋ helper 派工日誌 `sourceTerminalId` 永遠為空"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-042
priority: P3
sizing: S
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T16:13:05+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-042
  - BUG-137
  - T0534（研究回報 §8-4、§8-5）
affects_files:
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - src/components/WorkspaceView.tsx
  - electron/terminal-command-handlers.ts
  - scripts/bat-terminal.mjs
  - electron/__tests__/
  - src/**/__tests__/
  - _ct-workorders/BUG-137-restart-button-no-op-on-exited-terminal.md
  - _ct-workorders/T0539-restart-exited-terminal-and-source-id-log.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。實測一律隔離實例，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 依賴 T0535：本單在 T0535 合入後才開工（兩者都改 `WorkspaceView.tsx` / `terminal-command-handlers.ts`），以 T0535 之後的程式為基礎。"
---

# T0539 — ⏻ 重啟已結束分頁 ＋ `sourceTerminalId` 日誌

## 任務 A：BUG-137

1. 隔離實例實測兩種情境：① 分頁被 `pty:kill` 後按 ⏻；② shell 自己 `exit` 後按 ⏻。記錄 instance 是否存在、`restart` 回傳值、畫面結果。
2. 修正：instance 不存在時，重啟改為以同一 id 建立新 PTY（cwd / shell 取 UI 傳入值；env 一律經 `PtyManager.buildPtyEnv()`，工作區 env 由 renderer 依現有新建分頁的方式帶入，T0525 規則）。實作位置由 Worker 決定（main 端 `restart` fallback 或 renderer 改呼叫 `pty.create`），回報區說明理由。
3. UI 檢查回傳值；仍失敗時在分頁內印一行原因（比照 `registerPtyNoticeSink` 的格式），不得靜默。
4. 不得改變程序存活時的重啟行為（含 terminal-driven agent 重跑啟動命令）。

## 任務 B：`sourceTerminalId` 永遠為空

- `terminal-command-handlers.ts` `createWithCommand` 以 `opts.customEnv?.BAT_TERMINAL_ID` 取 `sourceTerminalId`，但 `bat-terminal.mjs` 從未送這個值（T0534 §8-4）。
- 修正方向擇一並說明：helper 送出呼叫端的 `BAT_TERMINAL_ID`（不放進 Worker 的 `customEnv`，避免污染 Worker env），或日誌改記 `BAT_TOWER_TERMINAL_ID`（派工時與 `--notify-id` 相同）。
- 只影響診斷日誌，不得改變派工落點（T0523）與 env 注入。

## 驗收條件

- [ ] A：單元測試（instance 不存在時的重啟、回傳值檢查）；隔離實例實測兩種情境都能重啟，存活分頁的重啟行為不變
- [ ] B：helper 測試或單元測試確認日誌欄位有值；Worker 的 env 不多出任何變數
- [ ] BUG-137 更新為 FIXED（附 commit）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

（Worker 填寫）
