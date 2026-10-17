---
schema_version: 1
schema_kind: bug
id: BUG-151
title: "helper 派工在 Git Bash 分頁送出 PowerShell 形式的啟動指令（開頭 `, '…claude.exe'`），Worker 起不來但 helper 仍 exit 0"
status: FIXING
severity: high
reproducibility: conditional
created_at: "2026-10-18T02:43:24+0800"
impact:
  - helper-dispatch
  - ct-dispatch
links:
  discovered_in: "BMad-Guide 塔台跨 session 回報（2026-10-18 02:29 派 T0161），使用者有截圖"
  related: [BUG-149, T0593, T0596, PLAN-047]
---

# BUG-151 — Git Bash 分頁收到 PowerShell 引號的派工指令

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（該工作區 helper 派工一律起不來；helper exit 0，塔台無從察覺） |
| 可重現 | 條件式（BMad-Guide 工作區重現；本工作區 02:26 派 T0596 正常，條件待查） |
| **狀態** | 🔧 FIXING（T0598） |

## 現象（BMad-Guide 塔台回報）

- BAT `0.7.0-pre.4`。`settings.json`：`shell = "git-bash"`、`customShellPath = ""`（塔台 02:43 讀檔確認）。
- 02:29 BMad-Guide 塔台：`bat-terminal.mjs --notify-id <tower> --workspace bc439ad7-… --cwd "D:\ForgejoGit\@Gower_Labs\BMad-Guide" --mode yolo --no-interactive --agent default --skill ct-exec --workorder T0161` → exit 0，分頁 `7b14ff899afa15d3e920fc0999726362`（`Claude CLI · Worker · T0161`）。
- 分頁 shell 是 Git Bash（UCRT64 提示字元），收到的指令開頭是 `, 'C:\Users\Gower\.local\bin\claude.exe' '--mcp-config=…\bat-mcp\claude.json' '--settings=…\bat-mcp\claude-settings.json' --dangerously-skip-permissions --effort high '/ct-exec T0161'` → `bash: ,: command not found`，claude 沒有啟動。
- 預期：引號依分頁實際的 shell（Git Bash → posix）組出。

## 初步線索（塔台，未做程式分析）

- 派工引號的 shell 由 `quotingShell`（`electron/terminal-command-handlers.ts`，BUG-149 / T0593）決定：有持久化 shell 用它，否則 `PtyManager.getDefaultShell()`。使用者有持久化 `git-bash`，理論上應走 posix；開頭的 `, ` 推測是 PowerShell call operator `&` 之類前綴被組錯或被 shell 吃掉。
- 同一份 settings 下，本工作區（better-agent-terminal）02:26 派 T0596 正常 → 差異可能在工作區（BMad-Guide 工作區的工作區層級設定 / 環境變數）、落點視窗，或 claude 執行檔路徑（系統 claude `C:\Users\Gower\.local\bin\claude.exe` 的路徑解析分支）。
- 研究與修正：T0598。
