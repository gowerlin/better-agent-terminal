---
schema_version: 1
schema_kind: bug
id: BUG-149
title: "`settings.json` 沒有 `shell` 鍵時，helper 以 `--agent codex` 派出的 Codex Worker 起不來（Windows：引號以 posix 組、分頁卻是 pwsh）"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-18T01:40:47+0800"
impact:
  - helper-dispatch
  - codex-cli
  - bat-mcp
links:
  discovered_in: "T0592（D153 A 層 codex e2e，`cab7c9d1`）"
  related: [T0584, T0586, T0592, PLAN-047]
---

# BUG-149 — 沒有 `shell` 設定時，codex 派工的 BAT MCP 參數引號錯誤

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（Codex Worker 啟動即失敗；全新安裝、從未在 Settings 存過設定的 Windows 使用者必中） |
| 可重現 | 必現（T0592 e2e `test.fixme('codex Worker dispatch with settings.json lacking "shell" …')` 改成 `test` 即重現） |
| **狀態** | 🔧 FIXING（T0593） |

## 現象

- `settings.json` 沒有 `shell` 鍵（全新安裝、從未在 Settings 存過；renderer `settingsStore.load` 不會把預設 `shell: 'auto'` 寫回檔案）。
- `terminal:create-agent-command` 判斷 shell family：`resolveTerminalShell` → `shellPath` undefined → basename `pty-default` → `detectShellFamily` 預設 **posix**；但 Windows PTY 實際以 **pwsh** 啟動。
- T0584 起 codex 的 BAT MCP 參數是含 `'` 的 TOML literal string，posix 引號（`'\''`）在 pwsh 被拆開。實跑 argv：`["-c","mcp_servers.bat.command=","\\node\\'", …]` → codex `Error: invalid type: string "[", expected a sequence in mcp_servers.bat.args`，exit 1。
- 預期：引號依分頁實際的 shell 組出，Codex Worker 正常啟動。

## 範圍

- 只影響本機 helper 派工（`bat-terminal.mjs --agent codex`）。`shell: 'auto'` 或明確值時正常；claude 派工的參數不含 `'`，不受影響；codex 分頁（renderer 路徑）用 renderer 的 shell family，未見問題；使用者本機 `shell: git-bash`，不受影響。

## 修正方向（T0592 建議）

`resolveTerminalShell` 在沒有持久化 shell 時，以 PtyManager 實際的預設 shell（`getDefaultShell`）判斷 family；或 `resolvePersistedShellPathWithDiagnostics` 把缺鍵視為 `auto`。
