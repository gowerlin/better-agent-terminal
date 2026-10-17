---
schema_version: 1
schema_kind: workorder
id: T0594
title: "PLAN-047 M1b-1 補強：`blocked` 加兩個清除 hook（`PostToolUse` AskUserQuestion、`PermissionDenied`），補滑鼠回答時一直掛著的漏洞"
type: feature
status: PENDING
started_at: null
updated_at: "2026-10-18T01:41:50+0800"
completed_at: null
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T01:41:50+0800"
target_version: "0.7.0-pre.4"
depends_on: [T0590]
related:
  - "T0590 回報區「遭遇問題」第 1 點（清除規則漏洞與建議）；CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節"
  - "並行工單 T0593（BUG-149：`electron/terminal-command-handlers.ts` 等 shell family）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - "scripts/bat-mcp.mjs（只在 tool 說明需要時）"
  - "electron/__tests__/terminal-blocked-state.test.ts、electron/__tests__/blocked-hooks-launch.test.ts、scripts/__tests__/bat-hook.test.mjs、electron/remote/__tests__/headless-blocked-state-e2e.test.ts、electron/__tests__/bat-mcp-launch.test.ts"
  - e2e/t0590-blocked-state.spec.ts
  - "CLAUDE.md（只改「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節）"
  - _ct-workorders/T0594-blocked-clear-hooks.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0593 同時在主 checkout 改 `electron/terminal-command-handlers.ts`、`electron/shell-path-resolver.ts`、可能的 `electron/pty-manager.ts`（預設 shell accessor）、`e2e/t0592-codex-tower-worker.spec.ts` 與 CLAUDE.md 的「BAT MCP shim」小節。你不碰這些檔；`CLAUDE.md` 若兩邊都有改，commit 時只納入**你自己的 hunk**（`git apply --cached` 挑出，T0585 做法），commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、stdout 不輸出、不影響 claude 決策、不送 `tool_input` / 內容 / 權杖。不得呼叫模型做驗證以外的事；實機查證最多 1 次、`--model claude-haiku-5-5`、提示詞極短，可略過。"
---

# T0594 — `blocked` 清除 hook 補強

## 背景

T0590 的清除點是 `UserPromptSubmit` / `Stop` / 使用者鍵盤輸入 / PTY 結束。使用者**只用滑鼠**在 claude TUI 回答 AskUserQuestion 或拒絕權限時，滑鼠回報屬終端自動回應、不算輸入，也沒有 hook → `blocked` 一直掛到該回合 `Stop`（claude 繼續工作期間仍顯示 blocked）。T0590 Worker 建議加兩個只在特定情況才啟動 node 的 hook。

## 介面契約變更（在 T0590 契約上增補）

- `terminal:report-hook` 的 `event` 增加：
  - `ask-user-question-done`：`PostToolUse`，matcher `AskUserQuestion` → 若目前 `blocked` 且 `blockedReason` = `question` → 清除
  - `permission-denied`：`PermissionDenied`（請以內嵌 claude 2.1.300 二進位 / 官方 hooks 文件確認事件名與 payload；不存在則不加並在回報說明）→ 若目前 `blockedReason` = `permission` → 清除
- 原因不符時不清除（例：`question` 卡住時收到 `permission-denied` → `unchanged`）。
- 兩個新 hook 都設 `async: true`、`timeout` 同既有（清除類）。
- 舊 BAT 主程式收到新的 `event` 值會回 `INVALID_ARGS`：hook 腳本照樣 exit 0、靜默（版本混搭不影響 claude）。
- **不加** `PostToolUse` 全工具 matcher（成本），允許的權限仍靠鍵盤輸入 / `Stop` 清除，寫進已知限制。

## 任務

1. `bat-mcp-launch.ts` 的 hooks 設定加兩項；`terminal-blocked-state.ts` 狀態機與 `terminal:report-hook` 參數驗證加兩個事件；`bat-hook.mjs` 對應 stdin 事件名。
2. 測試：狀態機（各原因配對 / 不配對）、設定檔內容（新 matcher、`async`）、`bat-hook.mjs` 真程序（新事件、舊 BAT 回 `INVALID_ARGS` 仍 exit 0 且 stdout 空）、headless e2e 測試、`e2e/t0590-blocked-state.spec.ts` 加一段：`ask-user-question` → `blocked` → `ask-user-question-done` → 清除（不經鍵盤）。
3. CLAUDE.md「blocked 狀態偵測」小節：事件表、清除規則、已知限制（滑鼠回答的漏洞改寫：AskUserQuestion / 拒絕權限已涵蓋，允許權限仍未涵蓋）。不改其他小節。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. `npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0584-bat-mcp-shim.spec.ts` 通過。
3. 回報區附：新的設定檔 hooks 片段、`PermissionDenied` 查證結果（事件名、payload 欄位、來源）、實機查證結果或略過原因。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
