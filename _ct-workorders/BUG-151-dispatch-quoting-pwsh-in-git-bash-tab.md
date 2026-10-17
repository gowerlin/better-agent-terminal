---
schema_version: 1
schema_kind: bug
id: BUG-151
title: "helper 派工指令寫入前打進新分頁的輸入被接在指令前面（例 `, '…claude.exe'`），Worker 起不來但 helper 仍 exit 0"
status: CLOSED
fixed_at: "2026-10-18T03:02:58+0800"
closed_at: "2026-10-18T04:19:32+0800"
fixed_by: T0598
fix_commit: "45943d16"
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
| **狀態** | 🚫 CLOSED（T0598 `45943d16`；`v0.7.0-pre.6` 安裝版實機 T0601 + 隔離實例 e2e T0602 PASS，2026-10-18） |

## 現象（BMad-Guide 塔台回報）

- BAT `0.7.0-pre.4`。`settings.json`：`shell = "git-bash"`、`customShellPath = ""`（塔台 02:43 讀檔確認）。
- 02:29 BMad-Guide 塔台：`bat-terminal.mjs --notify-id <tower> --workspace bc439ad7-… --cwd "D:\ForgejoGit\@Gower_Labs\BMad-Guide" --mode yolo --no-interactive --agent default --skill ct-exec --workorder T0161` → exit 0，分頁 `7b14ff899afa15d3e920fc0999726362`（`Claude CLI · Worker · T0161`）。
- 分頁 shell 是 Git Bash（UCRT64 提示字元），收到的指令開頭是 `, 'C:\Users\Gower\.local\bin\claude.exe' '--mcp-config=…\bat-mcp\claude.json' '--settings=…\bat-mcp\claude-settings.json' --dangerously-skip-permissions --effort high '/ct-exec T0161'` → `bash: ,: command not found`，claude 沒有啟動。
- 預期：引號依分頁實際的 shell（Git Bash → posix）組出。

## 初步線索（塔台，未做程式分析）

- 派工引號的 shell 由 `quotingShell`（`electron/terminal-command-handlers.ts`，BUG-149 / T0593）決定：有持久化 shell 用它，否則 `PtyManager.getDefaultShell()`。使用者有持久化 `git-bash`，理論上應走 posix；開頭的 `, ` 推測是 PowerShell call operator `&` 之類前綴被組錯或被 shell 吃掉。
- 同一份 settings 下，本工作區（better-agent-terminal）02:26 派 T0596 正常 → 差異可能在工作區（BMad-Guide 工作區的工作區層級設定 / 環境變數）、落點視窗，或 claude 執行檔路徑（系統 claude `C:\Users\Gower\.local\bin\claude.exe` 的路徑解析分支）。
- 研究與修正：T0598。

## 根因更正（T0598，2026-10-18）

- **引號沒有錯**：T0161 與 T0596 的派工日誌相同（`shell family=posix from=persisted`、`bash.exe`、posix 單引號），指令本身是 posix 形式。開頭的 `, ` 不是 PowerShell 前綴，而是**一次鍵盤輸入**。
- 機制（實測）：派工分頁落在使用中工作區時會取得鍵盤焦點（`addExternalTerminal`，BUG-135 / T0532）；主行程在 PTY 建立 500 ms 後才寫入啟動指令，這段時間打進來的字先進 shell 輸入緩衝，指令接在後面成為同一行。隔離重現逐字吻合 `bash: ,: command not found`。
- 推論：使用者當時正在 BMad-Guide 視窗打字給塔台，焦點被新分頁搶走約 3 秒。
- 修正：`PtyManager.holdInputForDispatch` / `writeDispatchCommand` 把指令寫入前的輸入移到指令之後；派工 shell 改由 `resolveDispatchShell` 只解析一次（spawn 與引號同值）。
- 未處理（另議）：派工分頁仍會搶焦點；helper exit 0 時指令尚未送出，無法得知 shell 報錯（T0598 建議以 claude `SessionStart` hook 作為已啟動信號）。
