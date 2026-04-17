# CLAUDE.md - Project Guidelines

## No Regressions Policy

- **NEVER** break existing features when implementing new ones.
- Before committing, verify ALL existing features still work — not just the new changes.
- Run the build (`npx vite build`) to confirm compilation succeeds.
- When modifying shared code (stores, IPC handlers, types), trace all consumers to ensure nothing breaks.

## Logging

- **Frontend (renderer)**: Use `window.electronAPI.debug.log(...)` instead of `console.log()`. This sends logs to the electron main process logger, which writes to disk.
- **Backend (electron)**: Use `logger.log(...)` / `logger.error(...)` from `./logger`.
- Do NOT use `console.log()` for debugging — use the logger so logs are persisted and visible in the log file.
- **Log file location**: `~/Library/Application Support/better-agent-terminal/debug.log`

## Sub-agent / Active Tasks Tracking

- The Claude Agent SDK does **NOT** reliably emit `task_started` / `task_progress` / `task_notification` system messages.
- We track Agent/Task tools from `tool_use` blocks directly in `session.activeTasks` (in `claude-agent-manager.ts`).
- `stopTask()` falls back to using `toolUseId` as `task_id` when no mapping exists.
- Tool results for Agent/Task must clean up `activeTasks` entries.

## React Rendering

- Use `flushSync` from `react-dom` for Agent/Task tool state changes (`setMessages` in `onToolUse` and `onToolResult`) to prevent rendering delays from React 18 batching during streaming.
- Do NOT use `flushSync` for regular tool calls — only for state changes that affect the active tasks bar visibility.

## Status Line

- Our status line implementation is superior to external alternatives (e.g., ccstatusline). Do not replace it.
- 13 configurable items with custom colors, zone alignment, and template-based config.
- Usage polling: Chrome session key (primary, lenient rate limits) → OAuth fallback (strict rate limits).

## Electron Runtime

- 本專案使用 Electron 41.x（Node 24、Chromium M146）；於 PLAN-016 Phase 2 從 Electron 28.3.3 升級（EXP-ELECTRON41-001 CONCLUDED）。
- native modules 依 ABI 145 建置；`package.json` 的 `postinstall` 已自動跑 `npm rebuild better-sqlite3`。若手動安裝後 app 啟動異常（例如 `NODE_MODULE_VERSION mismatch`），先執行 `npm rebuild better-sqlite3`。
- BAT 內執行 `npm run dev` 需確認 `ELECTRON_RUN_AS_NODE` 未被污染（見 BUG-038 / T0161）。若 renderer 無法啟動且 log 出現 `ELECTRON_RUN_AS_NODE=1`，清除該環境變數後重試。
- electron-builder 目前仍為 24.x（PLAN-016 Phase 3 延後處理，不影響本地 `npm run dev`）。

## Control Tower 本專案規則

- 塔台啟動時**必須讀取** `_ct-workorders/_local-rules.md` 並遵循其中所有規範
- 該檔案定義了本專案的擴充單據類型（BUG/PLAN）、索引同步原則、歸檔策略等
- 此為 Layer 3 附加規則，優先級高於 skill 預設行為

## Release

- **正式版**: `release new tag version` → 基於最新 tag 遞增 patch 版號，建立 tag 並 push
  - 例：目前 `v2.1.3` → 建立 `v2.1.4` tag
- **預覽版**: `release new pre tag version` → 基於最新 tag 遞增 patch 版號，加 `-pre.1` 後綴
  - 例：目前 `v2.1.3` → 建立 `v2.1.4-pre.1`
  - 若已有 `v2.1.4-pre.1` → 建立 `v2.1.4-pre.2`
- Tag 含 `-pre` 時 GitHub Release 自動標為 Pre-release，不更新 Homebrew tap
- Tag 不含 `-pre` 時為正式版，更新 Homebrew tap
