---
schema_version: 1
schema_kind: workorder
id: T0604
title: "探針：BUG-149 安裝版缺 `shell` 鍵時 claude-cli Worker 能否啟動"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-18T04:26:44+0800"
started_at: "2026-10-18T04:27:09+0800"
updated_at: "2026-10-18T04:27:52+0800"
completed_at: "2026-10-18T04:27:52+0800"
depends_on: [T0593]
related:
  - "BUG-149（FIXED，等安裝版實機）；T0604 / T0605 同批（claude / codex）"
affects_files:
  - _ct-workorders/T0604-probe-bug149-noshell-claude.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 探針單：不讀產品程式碼、不改任何其他檔案；只做下方步驟，只 commit 本檔（`git commit --only <本檔>`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 日誌與輸出不得含權杖；只貼 `[agent-command]` / `shell-resolution` / `[bat-mcp]` 相關行。不得修改 `settings.json`（塔台在派工前已暫時移除 `shell` 鍵，派工後由塔台還原）。"
---

# T0604 — 探針：BUG-149 缺 `shell` 鍵時 claude-cli Worker 能否啟動

塔台派工前已暫時移除 `%APPDATA%\BetterAgentTerminal\settings.json` 的 `shell` 鍵（模擬全新安裝）。你能讀到本工單，就代表 Worker 已啟動（BUG-149 修正前，缺鍵時 Worker 起不來）。

## 步驟

1. 照 ct-exec 流程標 IN_PROGRESS。
2. 在 `%APPDATA%\BetterAgentTerminal\Logs\` 最新的 `debug-*.log` 找**本分頁**（`BAT_TERMINAL_ID`）的派工行並原文貼上：
   - `[agent-command] id=<本分頁> shell family=… from=…`（預期 `family=pwsh from=pty-default:pwsh.exe`）
   - 同一次派工的 `shell-resolution` 行
   - 本分頁的 `[bat-mcp]` 行（若有）
3. 回報本分頁實際的 shell（例：`$PSVersionTable.PSVersion` 有值 → pwsh）。
4. 回報區寫上述結果與 PASS / FAIL → DONE → commit 本檔 → 通知塔台。

---

## 回報區

### 完成狀態

**DONE — PASS**：`settings.json` 缺 `shell` 鍵時，claude-cli Worker 正常啟動（本分頁即為證據），派工 shell 解析為 `pwsh`，與預期一致。

### Landing Zone Check

- C-0：PASS（`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：PASS；C-3：not applicable（`affects_files` 只有本工單）；C-2：無 `branch` 欄位
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- `BAT_TERMINAL_ID` = `c2f4ebfe24e55742a094d9039dcf7d72`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

日誌檔：`%APPDATA%\BetterAgentTerminal\Logs\debug-20261018-041113.log`（最新一檔），以本分頁 id 過濾 `[agent-command]` / `shell-resolution` / `[bat-mcp]`，原文：

```
575:[2026-10-17T20:26:54.950Z] [LOG] [agent-command] id=c2f4ebfe24e55742a094d9039dcf7d72 shell family=pwsh from=pty-default:pwsh.exe
576:[2026-10-17T20:26:54.982Z] [LOG] [bat-mcp] dispatch agent=claude-cli terminal=c2f4ebfe24e55742a094d9039dcf7d72 → injected: '--mcp-config=<使用者資料夾>\AppData\Roaming\BetterAgentTerminal\bat-mcp\claude.json' '--settings=<使用者資料夾>\AppData\Roaming\BetterAgentTerminal\bat-mcp\claude-settings.json'; hooks=yes
579:[2026-10-17T20:26:54.983Z] [LOG] [remote][terminal] shell-resolution channel=terminal:create-with-command id=c2f4ebfe24e55742a094d9039dcf7d72 basename=pty-default persistedShell=unset source=pty-default fallback=yes reason=missing-persisted-shell spawn=pwsh.exe
```

判讀：

| 項目 | 預期 | 實測 | 結果 |
|---|---|---|---|
| `[agent-command]` family / from | `family=pwsh from=pty-default:pwsh.exe` | `family=pwsh from=pty-default:pwsh.exe` | PASS |
| `shell-resolution` | 缺鍵 → fallback 到 PTY 預設 | `persistedShell=unset source=pty-default fallback=yes reason=missing-persisted-shell spawn=pwsh.exe` | PASS |
| 引號 family 與 spawn shell 一致 | 同為 pwsh | family `pwsh` ↔ spawn `pwsh.exe` | PASS |
| `[bat-mcp]` | 注入 MCP / settings | `--mcp-config=` + `--settings=` 已注入，`hooks=yes` | PASS |

本分頁實際 shell：程序樹 `BetterAgentTerminal.exe (47392) → pwsh.exe (47484) → claude.exe (38564)`，PTY shell 為 **pwsh.exe**；`$PSVersionTable.PSVersion` = `7.6.7`（Edition `Core`）。

日誌與輸出未含權杖。未讀產品程式碼、未改 `settings.json` 與其他檔案；只 commit 本檔。

### 偏差紀錄

- 第一次結案腳本因 Python 字串跳脫錯誤沒寫入回報，但後續 `git commit --only` 仍執行，產生 commit `e187a53d`（訊息寫 DONE，實際內容只有 IN_PROGRESS 標記）。本次回報與 DONE 另以新 commit 補上，未 amend。

### 回報時間

2026-10-18T04:27:52+0800
