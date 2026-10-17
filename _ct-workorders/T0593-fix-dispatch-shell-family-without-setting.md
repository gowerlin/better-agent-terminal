---
schema_version: 1
schema_kind: workorder
id: T0593
title: "BUG-149：`settings.json` 沒有 `shell` 鍵時，helper 派工的 shell family 以 PtyManager 實際預設 shell 判斷"
type: bugfix
status: FIXED
started_at: "2026-10-18T01:43:05+0800"
updated_at: "2026-10-18T01:49:10+0800"
completed_at: "2026-10-18T01:49:10+0800"
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

**FIXED**（驗收條件 1–3 全部 PASS；BUG-149 狀態留給塔台收單時改）

### 產出摘要

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 `REPO_ROOT/_ct-workorders/` 下；C-3 `electron/terminal-command-handlers.ts` 存在；C-2 無 `branch` 欄位（`main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**Commit**：`e283abdc` fix(dispatch): quote for the PTY default shell when settings.json has no shell (T0593, BUG-149)（5 檔：`electron/pty-manager.ts`、`electron/terminal-command-handlers.ts`、`electron/__tests__/dispatch-shell-family.test.ts`（新）、`e2e/t0592-codex-tower-worker.spec.ts`、`CLAUDE.md`；`git commit --only`，T0594 的檔案與 `src/styles/settings.css` 未納入）。未 push。

**選擇的修法與理由**：以 PtyManager 實際的預設 shell 判斷（不採「缺鍵視為 `auto`」）。理由：`resolveShellPath('auto')` 是 `shell-path-resolver.ts` 對預設 shell 的**另一份推論**（T0390 起與 `getDefaultShell` 平行維護），工單要求判斷來源與 `ptyManager.create` 同一個；且缺鍵時 `create` 實際不帶 `shell`、跑的就是 `getDefaultShell()`，直接問它最準。`create` 照舊不帶 `shell`（PTY 啟動行為完全不變，restart / recovery 的 `inst.shell` 也不變）。

**修正點**：
- `electron/pty-manager.ts:1008` — `getDefaultShell()` 由 `private` 改為 public（只加註解，邏輯不動）；`create` 仍是 `const shell = shellOverride || this.getDefaultShell()`（source guard 守住）。
- `electron/terminal-command-handlers.ts:59` — `TerminalPtyManager` 介面加選用的 `getDefaultShell?(): string`（本機與 headless 都是真 PtyManager，免改接線；`main.ts` / `headless-entry.ts` 未動）。
- `electron/terminal-command-handlers.ts:315` — 新 `quotingShell(resolution, ptyManager)`：有持久化 / 明確 shell → 用它（不變）；沒有 → `ptyManager.getDefaultShell()`；PtyManager 不在或沒有此方法 → 舊行為 `pty-default`（posix）。
- `electron/terminal-command-handlers.ts:749` — `terminal:create-agent-command` 的 `shellFamily = detectShellFamily(quoting.shell)`，並記 `[agent-command] id=<id> shell family=<f> from=<persisted|explicit|pty-default:<檔名>>`。

**缺鍵時實際的 Worker argv**（e2e `t0592-noshell`，`settings.json shell: (absent) → (absent)`，假 `codex.cmd` 記錄的 shell 解析後 argv；權杖不在 argv 中）：
```
["-c","features.daemon_auto_start=false","-c","mcp_servers.bat.command='node'","-c","mcp_servers.bat.args=['D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\better-agent-terminal\\better-agent-terminal\\scripts\\bat-mcp.mjs']","-c","mcp_servers.bat.env_vars=['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_USER_DATA', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_LOG_DIR', 'BAT_RUNTIME', 'APPDATA', 'XDG_CONFIG_HOME']","-c","mcp_servers.bat.tool_timeout_sec=60","--search","-c","model_reasoning_effort=low","$ct-exec T0592"]
```
（修正前：`["-c","mcp_servers.bat.command=","\\node\\'", …]` → codex exit 1。）主行程 `[bat-mcp] dispatch … → injected:` 為 pwsh 引號（`''node''`）。

**受影響路徑清單**：
| 路徑 | 結果 |
|---|---|
| 本機 helper 派工 `terminal:create-agent-command` + codex（BUG-149 本體） | 受影響 → 已修 |
| 本機 helper 派工 `terminal:create-agent-command` + claude-cli / claude-cli-worktree | **也受影響**（BUG 單原判「不受影響」不正確）：`resolveClaudeBaseCommand(shellFamily)` 以 posix 包路徑 `'C:\…\claude.exe'`，pwsh 下為 ParserError（本機以 `pwsh -Command "'C:\Windows\System32\where.exe' '/?'"` 實測 ParserError；`& '…'` 正常）。同一修正涵蓋，單元測試驗 `& '<claude.exe>' …` |
| 同上，prompt / `--mcp-config=` / `--settings=` 參數 | 同一 family，一併正確 |
| 本機 raw command `terminal:create-with-command` | 不受影響：命令由呼叫者原樣提供，BAT 不加引號（`resolveTerminalShell` 只決定 `create` 的 `shell`，缺鍵時仍是 undefined → 預設 shell，行為不變） |
| `shell` 有值（`auto` / pwsh / git-bash / cmd / 自訂路徑） | 不變（單元測試以「被呼叫即 throw」的 `getDefaultShell` 證明不被諮詢） |
| headless（Linux / macOS）缺鍵 | 同一程式路徑（`createHeadlessTerminalModule` 的 PtyManager 也有 `getDefaultShell`）；Linux `$SHELL` / bash / sh、macOS `$SHELL` / zsh → posix，與修正前相同（單元測試以真 PtyManager + stub `process.platform` 驗 linux / darwin） |
| renderer 分頁啟動（`agent:bat-mcp-launch-args`，renderer 帶 family） | 不經此路徑，未改；renderer 預設 `shell: 'auto'` |

### 驗證證據

- `npx vite build`：exit 0。
- `npm run typecheck`：0；`npm run typecheck:electron`：0。
- `npm run test:unit`：exit 0，Test Files 291 passed，Tests 5070 passed / 3 skipped（工作樹含 T0594 並行中的未提交變更，一併全綠）。
- 新單元 `electron/__tests__/dispatch-shell-family.test.ts`（15 tests）：缺鍵 / 無 settings / `custom` 空路徑 → pwsh、`create` 不帶 shell、codex 引號 = `buildBatMcpLaunchArgs(pwsh)`、日誌 `from=pty-default:pwsh.exe`；`powershell.exe` → pwsh；claude → `& '<path>'`；無 `getDefaultShell` → posix（舊行為）；`auto` / pwsh / git-bash / cmd / 自訂路徑 不變且不諮詢預設 shell；真 PtyManager：win32 → pwsh、linux / darwin → posix；source guard。既有 `terminal-command-handlers.test.ts` 照常通過。
- e2e `npx playwright test e2e/t0592-codex-tower-worker.spec.ts`：**2 passed**（18.1 s）— 主測試（`shell: auto`）8.8 s、缺 `shell` 測試（`test.fixme` → `test`）8.7 s，均未呼叫模型、未連 OpenAI（沿用 T0592 的假 codex shim、空 `CODEX_HOME`、離線 provider；`codex-stderr openaiHost:false`）。
- `CLAUDE.md`：只改「BAT MCP shim（PLAN-047 M1 / T0584）」小節的兩句（已知限制的 BUG-149 句改為「已修（T0593）」並說明缺鍵時以 `PtyManager.getDefaultShell()` 判斷、claude 也受影響、raw command 不受影響、驗證檔；驗證段的 `test.fixme` 句改為第二個 test）。單一 hunk，T0594 尚未改 CLAUDE.md，無需挑 hunk。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- 無阻塞。偏差：BUG-149 單「claude 派工不受影響」的判斷不成立（見上表），已在同一修正內涵蓋並寫進 CLAUDE.md；建議塔台收單時一併更正 BUG 單範圍描述。
- 未做：真 claude / 真 codex TUI 實機派工（D153 B 層，不在本單範圍）。

### 回報時間

2026-10-18T01:48:35+0800
