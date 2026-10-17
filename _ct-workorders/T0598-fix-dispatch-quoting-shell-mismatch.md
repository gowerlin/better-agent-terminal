---
schema_version: 1
schema_kind: workorder
id: T0598
title: "BUG-151：helper 派工在 Git Bash 分頁送出 PowerShell 形式指令 —— 查根因並修正，讓引號一律依分頁實際啟動的 shell"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-18T02:43:24+0800"
depends_on: [T0593]
related:
  - BUG-151
  - BUG-149
  - "T0593 回報區（`quotingShell`、`getDefaultShell`）"
  - "CLAUDE.md「BAT MCP shim（PLAN-047 M1 / T0584）」小節最後一段（BUG-149 / T0593）；docs/agent-guide/bat-mcp-shim.md"
  - "並行工單 T0597（BUG-150：`electron/terminal-blocked-state.ts`、blocked 測試與 `docs/agent-guide/blocked-state.md`）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/shell-path-resolver.ts（只在根因需要時）"
  - "electron/pty-manager.ts（只在根因需要時）"
  - "electron/main.ts（只在根因需要時：派工 deps 組裝）"
  - "electron/claude-runtime-router.ts / electron/claude-resolver.ts（只在根因在 claude 路徑分支時）"
  - "electron/__tests__/ 下對應的測試檔（新增或修改）"
  - "e2e/（新增一支 git-bash 預設 shell 的派工 spec，或擴充 e2e/t0592-codex-tower-worker.spec.ts 以外的既有派工 spec）"
  - "docs/agent-guide/bat-mcp-shim.md（只改 BUG-149 / quotingShell 相關段落）"
  - "CLAUDE.md（只改「BAT MCP shim」小節最後一段，且只在規則改變時）"
  - _ct-workorders/T0598-fix-dispatch-quoting-shell-mismatch.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0597 同時在主 checkout 改 `electron/terminal-blocked-state.ts`、blocked 相關測試、`e2e/t0590-blocked-state.spec.ts`、`docs/agent-guide/blocked-state.md`。你不碰這些檔；commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 不得在使用者或其他塔台的分頁送任何輸入（含 BMad-Guide 的 T0161 Worker 分頁 `7b14ff899afa15d3e920fc0999726362`）；不得替 BMad-Guide 重派 T0161。日誌只引用 `[agent-command]` / `[bat-mcp]` / `[pty]` 等派工相關行，不貼權杖。"
  - "🔴 實機重現用隔離實例或 e2e，不動使用者正在跑的 BAT；不呼叫模型（假 claude 即可）。"
---

# T0598 — BUG-151：派工引號的 shell 與分頁實際 shell 不一致

## 背景

見 BUG-151。要點：

- BAT `0.7.0-pre.4`；`settings.json` `shell = "git-bash"`、`customShellPath = ""`。
- BMad-Guide 塔台 02:29 派 T0161（`--workspace bc439ad7-…`、`--cwd "D:\ForgejoGit\@Gower_Labs\BMad-Guide"`、`--agent default`）→ exit 0，分頁 `7b14ff899afa15d3e920fc0999726362` 為 Git Bash，卻收到 `, 'C:\Users\Gower\.local\bin\claude.exe' '--mcp-config=…' '--settings=…' --dangerously-skip-permissions --effort high '/ct-exec T0161'` → `bash: ,: command not found`。
- 本工作區（better-agent-terminal，`cc0afc4a-…`）02:26 派 T0596 正常，設定檔相同。
- `settings.json` 的 `claudeRuntime` = `{"mode":"system","fallbackToEmbedded":true}`（T0596 查證），系統 claude 為 `C:\Users\Gower\.local\bin\claude.exe`。

## 要做的事

1. **根因**：從本次啟動的 debug log（`%APPDATA%\BetterAgentTerminal\Logs\debug-20261018-020939.log`）找 T0161 分頁與 T0596 分頁（`12245ee949b53ebbf6d63af24d9fe5fe`）各自的 `[agent-command] id=… shell family=… from=…` 與組出的指令、`pty:create` 實際 shell，對照兩者差在哪裡（工作區層級設定 / 環境變數、落點視窗、claude 路徑解析分支 `resolveClaudeBase(opts.shellFamily)`、`quotingShell` 的 `resolution.shell` 來源…）。說明開頭 `, ` 是怎麼來的。
2. **修正**：派工的引號 shell family 必須與 PTY 實際啟動的 shell **同一個來源決定**（不要兩處各自推導）。修正後補測試：至少涵蓋 `shell = git-bash`（本單情境）、缺 `shell` 鍵（BUG-149 情境，不得回歸）、`pwsh` / `cmd` 明確設定，以及根因指出的那個條件。
3. **helper exit code**：評估「指令已送出但分頁內的 shell 報錯」是否能讓 helper 得知（例如送出後短時間內 PTY 輸出含 `command not found` / 程序未啟動）。**只評估、寫建議，不實作**（契約變更需塔台決定）。
4. **繞道**：在回報區寫給 BMad-Guide 塔台的暫時繞道（修正版發佈前怎麼派工能起得來；例如 helper 是否有參數可指定 shell，或工作區設定可調）。若沒有可行繞道，明說。

## 驗收

- 回報區：根因（附日誌行，標「實測 / 推論」）、修正摘要、新增測試、繞道、第 3 點建議。
- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；新增 / 修改的 e2e 通過。
- 若改到 codex 派工路徑，跑 `e2e/t0592-codex-tower-worker.spec.ts`（CLAUDE.md 規定 codex 相關變更必跑）。
- commit 只含 `affects_files`；訊息 `fix(dispatch): …（BUG-151, T0598）`。

---

## 回報區

（Worker 填寫）
