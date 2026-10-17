---
schema_version: 1
schema_kind: workorder
id: T0604
title: "探針：BUG-149 安裝版缺 `shell` 鍵時 claude-cli Worker 能否啟動"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-18T04:26:44+0800"
started_at: ""
updated_at: "2026-10-18T04:26:44+0800"
completed_at: ""
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

### 產出摘要

### 回報時間
