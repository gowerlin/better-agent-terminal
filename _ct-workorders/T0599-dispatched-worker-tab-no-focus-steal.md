---
schema_version: 1
schema_kind: workorder
id: T0599
title: "BUG-152：helper 派出的 Worker 分頁不搶鍵盤焦點（D154）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T03:13:30+0800"
depends_on: [T0598]
related:
  - BUG-152
  - D154
  - "BUG-135 / T0532（`addExternalTerminal` 落在非 active 工作區不搶 focus 的既有規則；`src/stores/__tests__/workspace-store.focusFallback.test.ts`）"
  - "T0598 回報區（焦點被搶的日誌與機制）"
  - "並行工單 T0600（Worker 啟動確認：hook / helper / query channel，不碰 renderer store）"
affects_files:
  - src/stores/workspace-store.ts
  - "src/App.tsx / src/components/WorkspaceView.tsx / src/components/TerminalPanel.tsx（只在外部分頁加入或 focus 路徑需要時）"
  - "electron/ 下送出外部分頁事件給 renderer 的位置（只在需要帶「來源 = helper 派工」標記時；不得碰 T0600 的檔案：`electron/terminal-blocked-state.ts`、`electron/bat-mcp-launch.ts`、`electron/terminal-query-handlers.ts`、`scripts/bat-hook.mjs`、`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`）"
  - "src/stores/__tests__/workspace-store.focusFallback.test.ts 或新增的對應測試"
  - "e2e/（新增一支：派工時焦點留在塔台分頁）"
  - "docs/agent-guide/（找到描述外部分頁焦點的主題檔時一併更新；沒有則在 worker-tab-recycle.md 或 bat-mcp-shim.md 補一句）"
  - _ct-workorders/T0599-dispatched-worker-tab-no-focus-steal.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0600 同時在主 checkout 改 hook / helper / query channel 相關檔與 `CLAUDE.md`。你不碰它的檔；`CLAUDE.md` 原則上不改（若必須改，只 commit 自己的 hunk）。commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 範圍（D154）：只有 helper 派出的分頁（`terminal:create-agent-command` / `terminal:create-with-command` 經 helper 建立）不搶焦點。手動開的分頁（`+` 選單、快捷鍵）、UI 上的 ct-exec / ct-done 按鈕、還原分頁的行為一律不變。不加 Settings 開關。"
  - "🔴 不得在使用者正在使用的 BAT 分頁送任何輸入；實機重現用隔離實例或 e2e。"
---

# T0599 — helper 派出的 Worker 分頁不搶焦點

## 背景

BUG-152。`addExternalTerminal`（`src/stores/workspace-store.ts`）在分頁落在 active 工作區時設 `focusedTerminalId`，TerminalPanel 的 `isActive` effect 隨之 `terminal.focus()`。塔台派工時使用者常在塔台分頁打字，焦點被搶走後字跑進 Worker 分頁（BUG-151 的觸發條件；T0598 已讓輸入不再破壞啟動指令，但仍誤送）。

## 要做的事

1. 找出 helper 派出的分頁如何進入 renderer（`addExternalTerminal` 的呼叫端與 main 送出的事件），判斷能否辨識「helper 派工」來源；不能時在事件 payload 加一個來源標記（不改 helper 對外契約）。
2. helper 派工的分頁：加入分頁清單與縮圖、維持既有標題規則（`externalTerminalTitle`），但**不**改變 `focusedTerminalId`、不呼叫 `terminal.focus()`、不切換目前顯示的分頁。若目前顯示的分頁會被切換（active terminal），一併保持不變，並在回報區說明原本的行為。
3. 其他來源（手動、UI 按鈕、還原、detached 取回）行為不變；既有 BUG-135 測試全綠。
4. 測試：store 單元測試（helper 來源不搶 focus / 其他來源照舊）；e2e（隔離實例：塔台分頁取得焦點 → helper 派工 → 焦點仍在塔台分頁，於塔台分頁打字只進塔台 PTY；Worker 分頁照常出現在清單）。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；新增 e2e 與 `e2e/t0598-dispatch-input-before-command.spec.ts`、`e2e/t0523-dispatch-workspace.spec.ts` 通過。
- 回報區：原本的焦點 / active 分頁行為、改動摘要、測試、實機驗收步驟（給使用者：在塔台分頁打字時派一張單，字仍留在塔台分頁）。
- commit 只含 `affects_files`；訊息 `fix(dispatch): …（BUG-152, T0599）`。

---

## 回報區

（Worker 填寫）
