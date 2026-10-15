---
schema_version: 1
schema_kind: bug
id: BUG-137
title: "程序已結束的分頁按 ⏻ 重啟沒有任何反應（PtyManager.restart 找不到 instance 回 false，UI 未檢查）"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T17:30:31+0800"
fixed_at: "2026-10-15T17:30:31+0800"
fixed_by: T0539
fix_commit: 2ff55bdd
impact:
  - terminal-lifecycle
links:
  discovered_in: "T0534 研究回報 §1.2、§8-5"
  related: [PLAN-042, T0539]
---

# BUG-137 — 已結束分頁的 ⏻ 重啟無效

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（繞行：關掉分頁重開） |
| 可重現 | 必現（T0539 隔離實例實測：`pty:kill` 後與 shell `exit` 後皆是） |
| **狀態** | ✅ FIXED（T0539，`2ff55bdd`） |

## 現象（程式碼推論）

- 分頁程序結束後（`pty:kill`、shell `exit`），`PtyManager.kill` 已把 instance 刪除（`electron/pty-manager.ts` `kill`）。
- 使用者按 ⏻：`WorkspaceView.tsx` 的重啟流程呼叫 `pty.restart(id, cwd, shell)`，`PtyManager.restart` 找不到 instance 直接回 `false`（`pty-manager.ts` `restart`），UI 沒有檢查回傳值，畫面停在 `[Process exited …]`。
- 程序自行結束（shell `exit`）時 instance 是否也被移除，需實測確認。

## 預期

按 ⏻ 會以同一個 id 建立新的 shell（沿用分頁的 cwd、shell、工作區 env），行為與程序仍存活時的重啟一致。

## 備註

T0525 起 `restart` 會沿用 `customEnv` / `agentPreset`。instance 不存在時這些資訊已遺失，修正時改用分頁自己的資料（工作區 env、`agentPreset`），不得遺漏 T0525 的 env 組裝規則（`buildPtyEnv`）。

## 修正（T0539，`2ff55bdd`）

- 實測（隔離實例，Terminal Server 模式）：`pty:kill` 後與 shell 自行 `exit` 後，`PtyManager` 都已無 instance，`pty:restart` 回 `false`，⏻ 後沒有新 shell；agent 分頁的啟動命令也不會重跑。
- 修正在 renderer：`WorkspaceView.handleRestart` 的一般終端分支改用 `restartOrCreatePty`（`src/lib/pty-replay.ts`）。`pty:restart` 回 `true` → 與修正前相同；否則以同一 id `pty:create`（工作區 env、`workspaceId`、`agentPreset`，env 由 `buildPtyEnv` 組裝），再依 `spawned` 重送 terminal-driven agent 的啟動命令。仍失敗 → 分頁內印 `terminal.restartFailedNotice`。
- 限制：補建的 PTY 沒有原 Worker 的 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `workorder`（main 已無記錄）；`--close-worker` 仍可經 T0537 已存歸屬找到該分頁。
- 驗證：`src/lib/__tests__/pty-restart-or-create.test.ts`、e2e `e2e/t0539-restart-exited-terminal.spec.ts`。細節見 T0539 回報區。
