---
schema_version: 1
schema_kind: workorder
id: T0597
title: "BUG-150：`PermissionRequest` 的 `tool_name` = `AskUserQuestion` 記為 `question`，並補真實事件順序的測試（T0596 方案 A）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T02:43:24+0800"
depends_on: [T0596]
related:
  - BUG-150
  - "T0596 回報區（根因、Q5 方案 A 與建議測試）"
  - "CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節；docs/agent-guide/blocked-state.md"
  - "並行工單 T0598（BUG-151：helper 派工引號 shell family，`electron/terminal-command-handlers.ts` 等）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/remote/__tests__/headless-blocked-state-e2e.test.ts
  - e2e/t0590-blocked-state.spec.ts
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0597-fix-askuserquestion-blocked-reason.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0598 同時在主 checkout 改 `electron/terminal-command-handlers.ts` 等派工 / shell 相關檔與其測試。你不碰這些檔；commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、stdout 不輸出、不影響 claude 決策、不送 `tool_input` / 內容 / 權杖。本單預期**不需要**改 `scripts/bat-hook.mjs`（它已送 `tool_name`）；若查證後必須改，在回報區說明理由。"
  - "🔴 契約不變：`blockedReason` 列舉、欄位名、channel 參數、`HOOK_EVENT_CLEARS_ONLY` 語意都不改；CLAUDE.md 不改（除非你認為例外對應屬必守規則，先在回報區說明，由塔台決定）。"
---

# T0597 — BUG-150 修正：AskUserQuestion 的 `PermissionRequest` 記為 `question`

## 目標

claude 的 AskUserQuestion 固定觸發 `PreToolUse` → 約 90 ms 後 `PermissionRequest`（`tool_name: AskUserQuestion`），目前後者把 reason 換成 `permission`，T0594 的 `ask-user-question-done` 因此永遠清不掉（只清 `question`）。依 T0596 方案 A：`permission-request` 帶 `toolName === 'AskUserQuestion'` 時 reason 記為 `question`。

## 範圍

1. `electron/terminal-blocked-state.ts` `TerminalBlockedTracker.report`：reason 改由一個小函式決定（例 `reasonOf(event, toolName)`），`permission-request` + `AskUserQuestion` → `question`，其餘照 `HOOK_EVENT_REASON`。結果：
   - 已是 `question` → `unchanged`（`blockedSince` 保留 `PreToolUse` 的時間，不印轉換行）
   - 沒有先收到 `PreToolUse` → 直接 `blocked` / `question`
   - `question` 期間收到 `permission-request(Bash)` 等其他工具 → 照舊換成 `permission`（T0594 情境不變）
2. 測試（T0596 Q5 列的六項，重點是**真實事件順序** `ask-user-question` → `permission-request(AskUserQuestion)` → `ask-user-question-done`）：
   - `electron/__tests__/terminal-blocked-state.test.ts`：狀態機、channel 回傳 `blockedReason: 'question'`、真 `bat-hook.mjs` 程序 stdin `PermissionRequest` + `tool_name: AskUserQuestion` → 塔台 state 為 `question`
   - `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`：driver 照真實順序送三個事件，斷言等待期間 `blocked (question)`、done 之後離開 `blocked`、不經鍵盤
   - `e2e/t0590-blocked-state.spec.ts` 3b 段同上（需先 `npx vite build`）
3. `docs/agent-guide/blocked-state.md`：事件表 `PermissionRequest` 列補「`tool_name` = `AskUserQuestion` → `question`」並寫明原因（claude 2.1.300 / 2.1.302 的 AskUserQuestion `requiresUserInteraction`，T0596 查證）；「已知限制」改寫 bypass 那一條（bypass 下也會有 AskUserQuestion 的 `PermissionRequest`，修正後回報為 `question`）、滑鼠回答 AskUserQuestion 的清除改為 T0597 起實際生效。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；`e2e/t0590-blocked-state.spec.ts` 通過。
- 回報區寫明：改動摘要、測試新增項目、實機驗收步驟（給使用者：系統 claude 分頁問一題 → 塔台 `bat_list_terminals` 為 `blocked` / `question` → 滑鼠回答 → 立刻清除，不必等 `Stop`；debug log `→ cleared (hook ask-user-question-done)`）。
- commit 只含 `affects_files`；訊息 `fix(blocked): …（BUG-150, T0597）`。

---

## 回報區

（Worker 填寫）
