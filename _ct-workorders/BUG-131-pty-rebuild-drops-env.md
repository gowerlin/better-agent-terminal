---
schema_version: 1
schema_kind: bug
id: BUG-131
title: "本機 PTY 重建路徑掉 env：Terminal Server heartbeat 復原重建 PTY 時不帶 env（BAT_* / 工作區環境變數缺或過期）；Electron pty:restart 丟掉 customEnv（工作區環境變數、Worker 的 BAT_TOWER_TERMINAL_ID）"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-14T13:48:52+0800"
updated_at: "2026-10-14T13:54:46+0800"
fixed_at: "2026-10-14T13:54:46+0800"
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
| **狀態** | ✅ FIXED（T0525，待塔台驗收） |
| 回報者 | T0523 Worker |

## 現象（程式碼證據）

1. **Terminal Server heartbeat 復原**（T0112，`electron/pty-manager.ts` 約 :1080 起）：重建所有 PTY 時送的 `pty:create` **不帶 env**，PTY 只拿到 server 行程繼承的 env ⇒ `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_REMOTE_*` / `BAT_HELPER_DIR` / `BAT_USER_DATA` 不是缺就是過期，工作區 `envVars` / 全域 env 也消失。之後在該分頁裡派工或 notify 會失敗或送錯
2. **Electron `pty:restart`**（:1018）：T0523 已補 `workspaceId`，但 `customEnv` 沒帶（T0448 只對 headless 保留）⇒ 重啟後工作區 / 全域環境變數消失；Worker 分頁重啟後 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` 也沒了，完成時無法通知塔台

## 預期

- 任何重建 / 重啟路徑後，PTY 的 env 與第一次建立時一致（helper env 用當下有效的值重新產生，例如 server token / port 可能已改變）

## 根因與修正

**根因**：`electron/pty-manager.ts` 的 env 在三條 spawn 分支（Terminal Server / node-pty / child_process）各自內聯組裝，重建路徑沒有共用：
- recovery（`handleServerDeath`）只記得 `shell` / `shellArgs` / `cwd`，送 `pty:create` 時沒有 `env` 欄位；Terminal Server 以 `{ ...process.env, ...req.env }` spawn，所以 PTY 只拿到新 server 行程繼承的 env
- Terminal Server 分支建立 instance 時也沒記 `customEnv`，因此即使想重送也沒有資料
- `restart()` 只在 `deps.helperEnv` 存在（headless，T0448）時帶 `customEnv`；`agentPreset` 兩邊都不帶

**修正**（T0525）：
- 新增 `PtyManager.buildPtyEnv(id, { customEnv, workspaceId, agentPreset }, helperEnv, { noFlicker })`，第一次建立（三條分支）、`restart`、recovery 共用；helper 值（`getRemoteServerInfo` 的 port / token、`localHelperEnv()`、`helperEnv`）在呼叫當下取得，不沿用舊值。child_process fallback 原本就沒有 `CLAUDE_CODE_NO_FLICKER`，以 `noFlicker: false` 保留
- `PtyInstance` 在三條分支都記錄 `customEnv` / `workspaceId` / `agentPreset`；T0108 重接後 renderer 的 idempotent `pty:create` 只補齊缺的欄位，不動執行中的 PTY
- `restart()` 一律沿用 `customEnv` / `workspaceId` / `agentPreset`（Electron 也是）
- recovery 對每個 PTY 以 `buildPtyEnv` 組出完整 env 並放進 `pty:create`
- headless 權杖語意不變：restart 仍是 kill（撤銷舊權杖）→ create（`helperEnv` 簽發同角色新權杖）

驗證：`electron/__tests__/pty-manager-helper-env.test.ts`「rebuilds keep the full env (T0525 / BUG-131)」7 案；細節見 T0525 回報區。
