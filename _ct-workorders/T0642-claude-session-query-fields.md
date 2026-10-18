---
schema_version: 1
schema_kind: workorder
id: T0642
title: "PLAN-050 B：查詢回傳 `claudeSessionName` / `claudeSessionId`（R3）——`SessionStart` hook 回報 sessionId（改 T0600）、BAT 重開後還原"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T16:44:32+0800"
depends_on: [T0641]
related:
  - "D167（使用者同意改 T0600 契約讓 hook 回報 session_id）；T0640 回報區（Q1-5 hook stdin 欄位、Q2-2 現況與落點、介面契約草案 C-4 / C-5 / C-8、實作切分 B）"
  - "T0641（`claudeSessionNameRecords`，`electron/claude-session-name-record.ts`：每個分頁實際注入的名稱與原因；`docs/agent-guide/claude-session-name.md`）"
  - "T0590 / T0600（`bat-hook.mjs`、`terminal:report-hook`、`TerminalBlockedTracker`、`agentStarted` 生命週期）；T0582（`terminal:whoami` / `list` / `get-state` 契約）；T0584（`scripts/bat-mcp.mjs`）；T0537（`withSavedWorkerOwnership` / 已存分頁）"
  - "並行：T0644（D，「以塔台開啟 Claude」，只改 `src/**` 與 locales）"
affects_files:
  - scripts/bat-hook.mjs
  - "electron/terminal-blocked-state.ts（`terminal:report-hook` 接受 `sessionId`）"
  - electron/claude-session-name-record.ts
  - electron/terminal-query-handlers.ts
  - "scripts/bat-mcp.mjs（tool 說明與輸出欄位）"
  - "electron/pty-manager.ts、electron/main.ts、electron/window-registry.ts、electron/worker-ownership.ts、electron/remote/headless-entry.ts（只在記錄 / 還原需要時）"
  - "electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**"
  - "e2e/t0642-claude-session-query.spec.ts（新，或擴充 e2e/t0600 系列）"
  - "docs/agent-guide/claude-session-name.md、docs/agent-guide/worker-launch-confirmation.md、docs/agent-guide/blocked-state.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/bat-mcp-shim.md、CLAUDE.md（相關節各補一兩句；PLAN-050 那一節由本單更新）"
  - _ct-workorders/T0642-claude-session-query-fields.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **C-4 狀態欄位**（T0640 草案，可微調並在回報說明）：`terminal:whoami`、`terminal:list` 每列、`terminal:get-state` 多 `claudeSessionName: string | null`（取 T0641 紀錄中實際注入的名稱；沒注入 = `null`）與 `claudeSessionId: string | null`（UUID；尚未回報、`blockedDetection: none`、BAT 重開後無紀錄都是 `null`，🔴 `null` 不代表沒有 session）。結束紀錄（exited）保留最後的值。既有欄位與值域一律不變。查詢範圍沿用 `authorizeHelperQueryTarget`，本單不放寬（`scope: 'towers'` 是 T0643）。"
  - "🔴 **C-5 hook 回報（D167 同意改 T0600）**：`terminal:report-hook { event: 'session-start', sessionId?: string }`。`bat-hook.mjs` 只在 `session-start` 讀 stdin 的 `session_id`，驗證 UUID 格式，不合格就不帶。🔴 T0590 / T0600 其他規則不變：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 1.8 s；除了 `session_id` 不送其他 payload（不送 `source` / `transcript_path` / `cwd` 等）。舊 BAT 不認得 `sessionId` 時 hook 仍 exit 0。`startup` / `resume` / `clear` / `compact` 的 `SessionStart` 都更新 sessionId（`agentStartedAt` 仍只記第一次，T0600 契約不變）。日誌（`[blocked]` / `[agent-start]` / bat-scripts.log）只記 sessionId 前 8 碼。"
  - "🔴 **C-8 持久化**：Electron 把 `claudeSessionName` / `claudeSessionId` 存進分頁紀錄（不含權杖），BAT 重開且 Terminal Server 存活時還原；headless 不持久化（已知限制）。持久化位置自選，限 `electron/**`；若必須經 renderer 的 `workspace:save`，先在工單提問（避免與 T0644 同時改 `src/**`）。"
  - "🔴 **並行工單 T0644** 同時改 `src/components/**`、`src/stores/**`、`src/types/index.ts`、`src/locales/**`：本單**不得改這些檔案**。CLAUDE.md 與 `docs/agent-guide/claude-session-name.md` 只由本單改（T0644 的文件段落由後續 T0643 併入）。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。不 push。"
  - "🔴 與另一張工單並行：`npx vite build` / e2e 共用 `dist` / `dist-electron`，兩邊同時 build 可能互相覆寫或鎖檔 —— build 或 e2e 出現與自己變更無關的失敗時，先重跑一次再判斷，並在回報區記錄。"
---

# T0642 — 查詢回傳 claude session 名稱與 sessionId（PLAN-050 B）

## 背景

T0641 已讓 claude-cli 分頁啟動時帶 `--name`，並在主行程記下每個分頁實際注入的名稱。本單把名稱與 sessionId 開放給查詢（R3），讓 CT 能由 BAT 分頁對應到 ListAgents 上的 session。sessionId 由已注入的 `SessionStart` hook 回報（T0640：`--session-id` 會讓 claude 在 resume / 重啟時啟動失敗，不用）。

## 要做的事

1. `bat-hook.mjs`：`session-start` 時讀 `session_id`，UUID 驗證後帶進 `terminal:report-hook`。
2. `terminal:report-hook`：接受並記錄 `sessionId`（只限呼叫者自己的分頁，現行規則）；不合格的值忽略（不回錯誤、不影響 `agentStarted`）。
3. 查詢欄位：`whoami` / `list` / `get-state` 加 `claudeSessionName` / `claudeSessionId`；exited 保留；MCP（`bat-mcp.mjs`）tool 說明補一句欄位意義（仍 `readOnlyHint: true`）。
4. 持久化與還原（C-8）。
5. 文件：`claude-session-name.md` 加 R3 一節（欄位、來源、`null` 的意義、生命週期、持久化）；`worker-launch-confirmation.md` / `blocked-state.md` 註明 hook 契約的改變（T0600 → 本單）；`helper-query-channels.md` 契約表加兩欄；CLAUDE.md PLAN-050 節補一句；`bat-mcp-shim.md` 一句。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（基線 5334 / 307）
- `npx vite build` 成功
- 測試涵蓋：hook 只帶合格 UUID、仍 exit 0 無 stdout；`/clear` 類的第二次 `session-start` 更新 sessionId 但不改 `agentStartedAt`；三個查詢的欄位（注入 / 未注入 / codex / exited）；舊 BAT 對 `sessionId` 欄位的相容；持久化還原
- e2e（隔離實例、不耗 token，可沿用 T0600 / T0590 的假 claude 腳本跑 `bat-hook.mjs session-start` 並餵 stdin）：塔台 MCP `bat_get_state` / `bat_list_terminals` 拿到 `claudeSessionName` 與 `claudeSessionId`；日誌只有 sessionId 前 8 碼

## 驗收

- R3：塔台可由 BAT 查到自己 Worker（及自己）的 session 名稱與 sessionId
- hook 規則（exit 0、stdout 空、時限）不變；既有欄位與 exit code 不變
- 驗證全部通過；回報區附：最終欄位定義（給 CT-T021 用）、持久化設計、測試清單、commit

---

## 回報區

（Worker 填寫）
