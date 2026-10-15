---
schema_version: 1
schema_kind: bug
id: BUG-137
title: "程序已結束的分頁按 ⏻ 重啟沒有任何反應（PtyManager.restart 找不到 instance 回 false，UI 未檢查）"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T16:13:05+0800"
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
| 可重現 | 程式碼推論為必現，未實測 |
| **狀態** | 📂 OPEN（PLAN-042 / T0539） |

## 現象（程式碼推論）

- 分頁程序結束後（`pty:kill`、shell `exit`），`PtyManager.kill` 已把 instance 刪除（`electron/pty-manager.ts` `kill`）。
- 使用者按 ⏻：`WorkspaceView.tsx` 的重啟流程呼叫 `pty.restart(id, cwd, shell)`，`PtyManager.restart` 找不到 instance 直接回 `false`（`pty-manager.ts` `restart`），UI 沒有檢查回傳值，畫面停在 `[Process exited …]`。
- 程序自行結束（shell `exit`）時 instance 是否也被移除，需實測確認。

## 預期

按 ⏻ 會以同一個 id 建立新的 shell（沿用分頁的 cwd、shell、工作區 env），行為與程序仍存活時的重啟一致。

## 備註

T0525 起 `restart` 會沿用 `customEnv` / `agentPreset`。instance 不存在時這些資訊已遺失，修正時改用分頁自己的資料（工作區 env、`agentPreset`），不得遺漏 T0525 的 env 組裝規則（`buildPtyEnv`）。
