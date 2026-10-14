---
schema_version: 1
schema_kind: bug
id: BUG-131
title: "本機 PTY 重建路徑掉 env：Terminal Server heartbeat 復原重建 PTY 時不帶 env（BAT_* / 工作區環境變數缺或過期）；Electron pty:restart 丟掉 customEnv（工作區環境變數、Worker 的 BAT_TOWER_TERMINAL_ID）"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-14T13:48:52+0800"
updated_at: "2026-10-14T13:48:52+0800"
impact:
  - pty
  - terminal-server
  - control-tower-notify
links:
  discovered_in: "T0523 回報區 §1 #5、§7-2 / §7-3"
  fix_workorder: T0525
  related: [BUG-129, T0523, "T0112（heartbeat recovery）", "T0108（Terminal Server 重接）", "T0448（headless restart 保留 customEnv）"]
---

# BUG-131 — 本機 PTY 重建路徑掉 env

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（重建後的分頁派工 / notify 失效或送錯；工作區環境變數消失） |
| 可重現 | 必現（程式碼證據，T0523） |
| **狀態** | 🔧 FIXING（T0525） |
| 回報者 | T0523 Worker |

## 現象（程式碼證據）

1. **Terminal Server heartbeat 復原**（T0112，`electron/pty-manager.ts` 約 :1080 起）：重建所有 PTY 時送的 `pty:create` **不帶 env**，PTY 只拿到 server 行程繼承的 env ⇒ `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_REMOTE_*` / `BAT_HELPER_DIR` / `BAT_USER_DATA` 不是缺就是過期，工作區 `envVars` / 全域 env 也消失。之後在該分頁裡派工或 notify 會失敗或送錯
2. **Electron `pty:restart`**（:1018）：T0523 已補 `workspaceId`，但 `customEnv` 沒帶（T0448 只對 headless 保留）⇒ 重啟後工作區 / 全域環境變數消失；Worker 分頁重啟後 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` 也沒了，完成時無法通知塔台

## 預期

- 任何重建 / 重啟路徑後，PTY 的 env 與第一次建立時一致（helper env 用當下有效的值重新產生，例如 server token / port 可能已改變）

## 根因與修正

（T0525 回填）
