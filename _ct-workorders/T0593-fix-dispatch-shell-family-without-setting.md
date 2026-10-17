---
schema_version: 1
schema_kind: workorder
id: T0593
title: "BUG-149：`settings.json` 沒有 `shell` 鍵時，helper 派工的 shell family 以 PtyManager 實際預設 shell 判斷"
type: bugfix
status: PENDING
started_at: null
updated_at: "2026-10-18T01:41:50+0800"
completed_at: null
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: S
created_at: "2026-10-18T01:41:50+0800"
target_version: "0.7.0-pre.4"
depends_on: [T0592]
related:
  - "BUG-149（T0592 發現；現象、證據、修正方向見 BUG 單）"
  - "T0592 `e2e/t0592-codex-tower-worker.spec.ts` 的 `test.fixme('codex Worker dispatch with settings.json lacking \"shell\" …')`"
  - "T0584 / T0586（codex BAT MCP 參數為含 `'` 的 TOML literal string，依 shell family `quoteArgForShell`）；並行工單 T0594（T0590 blocked 清除事件）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/shell-path-resolver.ts（若修在這裡）"
  - "electron/pty-manager.ts（只在需要公開預設 shell 查詢時，例：把 `getDefaultShell` 開成 public 或新增 accessor；不改其他邏輯）"
  - "electron/main.ts、electron/remote/headless-entry.ts（只在接線需要時）"
  - "electron/__tests__/**"
  - e2e/t0592-codex-tower-worker.spec.ts
  - "CLAUDE.md（只改「BAT MCP shim（PLAN-047 M1 / T0584）」小節中 T0592 / BUG-149 相關的句子）"
  - _ct-workorders/T0593-fix-dispatch-shell-family-without-setting.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0594 同時在主 checkout 改 `electron/terminal-blocked-state.ts`、`electron/bat-mcp-launch.ts`、`scripts/bat-hook.mjs`、相關測試、`e2e/t0590-blocked-state.spec.ts` 與 CLAUDE.md 的「blocked 狀態偵測（T0590）」小節。你不碰這些檔；`CLAUDE.md` 若兩邊都有改，commit 時只納入**你自己的 hunk**（`git diff CLAUDE.md` 確認後以 `git apply --cached` 挑出，T0585 做法），commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 e2e 測試仍不得呼叫模型、不得連 OpenAI（沿用 T0592 spec 的假 codex shim、空 `CODEX_HOME`、離線 model provider 與安全閥）。"
---

# T0593 — 修 BUG-149：沒有 `shell` 設定時 helper 派工的引號

## 背景

見 BUG-149。`terminal:create-agent-command` 在 `settings.json` 沒有 `shell` 鍵時，`resolveTerminalShell`（`electron/terminal-command-handlers.ts:275`）→ `shellPath` undefined → `detectShellFamily` 預設 posix；Windows PTY 實際由 `PtyManager.getDefaultShell()`（`electron/pty-manager.ts:1004`）啟動 pwsh。codex 的 BAT MCP 參數含 `'`，posix 引號在 pwsh 被拆開 → Codex Worker 啟動即失敗。全新安裝的 Windows 使用者必中。

## 任務

1. **修正**：沒有持久化 shell（缺鍵）時，shell family 必須與 PTY 實際啟動的 shell 一致。建議以 PtyManager 實際的預設 shell 判斷（`getDefaultShell` 的同一結果），或在解析時把缺鍵視為 `auto`（與 Settings 預設一致）；擇一並說明理由。要求：
   - 判斷用的 shell 與 `ptyManager.create` 實際用的 shell 是**同一個來源**（不得再寫一份平行的預設 shell 推論）。
   - `shell` 有值（`auto` / 明確值 / 自訂路徑）的行為不變。
   - headless（Linux / macOS 預設 posix）行為不變；若 headless 有同樣的缺鍵路徑，一併確認並在回報說明。
   - 順帶檢查：同一個缺鍵問題是否也影響 helper 的 raw command 模式（`terminal:create-with-command`）或 claude 派工的其他參數，有就一併修並列出。
2. **測試**：
   - 單元：缺鍵 / `auto` / 明確 pwsh / git-bash / cmd 各自的 family 與 codex 參數引號；缺鍵時 family 與 PtyManager 預設 shell 一致（Windows 與非 Windows 各一）。
   - e2e：把 `e2e/t0592-codex-tower-worker.spec.ts` 的 `test.fixme('codex Worker dispatch with settings.json lacking "shell" …')` 改成 `test` 並通過；原本的主測試照常通過。
3. **CLAUDE.md**：「BAT MCP shim」小節中 T0592 寫的 BUG-149 相關句子（已知限制 / 驗證）改成「已修（T0593）」並說明缺鍵時以哪個來源判斷 family。不改其他小節。
4. BUG-149 單：不需要你改（塔台收單時改狀態）；回報區寫清楚修正點即可。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. `npx playwright test e2e/t0592-codex-tower-worker.spec.ts` 兩個 test 都通過（不再有 fixme / skip，內嵌 codex 存在時）。
3. 回報區附：修正點（檔:行）、缺鍵時實際的 Worker argv（不含權杖）、受影響路徑清單（含檢查過但不受影響者）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
