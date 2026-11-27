---
schema_version: 1
schema_kind: bug
id: BUG-230
title: "BAT 重開、終端接回後，塔台分頁的 `--set-role` 宣告（角色、模式、契約 v2）消失，待辦分頁找不到塔台、回答送不出去，要使用者自己再執行 `/control-tower`"
status: OPEN
severity: medium
reproducibility: "使用者實機一次（A-18，2026-11-27 21:03）；推測必定：BAT 重開後以保留的 Terminal Server／PTY holder 接回塔台分頁"
created_at: "2026-11-27T21:04:06+08:00"
updated_at: "2026-11-27T21:04:06+08:00"
impact:
  - tower-tab
  - inbox
  - terminal-server-reattach
links:
  discovered_in: "A-18（`v0.8.0` 實機驗收，T0944，D434）"
  related: [T0562, T0903, T0861, T0578, PLAN-065, PLAN-068, D434]
---
# BUG-230 — 終端接回後塔台宣告消失

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（契約 v2 的待辦回答、通知保護、💬 卡片等依分頁宣告的功能在接回後全部停用，使用者看不出原因） |
| 可重現 | 使用者實機一次；推測必定 |
| **狀態** | 📂 OPEN（D434） |
| 回報者 | 使用者 A-18 實機驗收（截圖） |
| 影響版本 | `v0.8.0`（宣告本來就不持久化；PLAN-065 讓 PTY 跨 BAT 重開存活後才變得明顯） |

## 現象（預期 vs 實際）

- 情境：塔台分頁開著，關掉 BAT 再開，終端分頁接回（塔台的 claude 程序仍在跑，對話不中斷）。
- 預期：塔台分頁仍是塔台（`Claude CLI · Tower`、模式、`bat-contract: 2`），待辦分頁照常能回答。
- 實際：待辦分頁顯示「塔台：沒有已宣告的塔台分頁（以 `_tower-state.md` 判定）」，以及「這個工作區沒有可接收回答的塔台（需要已宣告契約 v2 的塔台分頁，或面板塔台）。也可以直接在塔台輸入這一行。」使用者必須在塔台分頁自己再執行 `/control-tower`，讓塔台重新 `--set-role`。
- 補充：塔台在 21:03 重送 `--set-role tower --bat-contract 2 --mode on`，exit 0、`bat-contract: 2`、`hooks: ok (injected, set 2)`（權杖仍有效，T0576），宣告即恢復。

## 根因（塔台推測，待 Worker 確認）

`--set-role` 的 `role` / `towerMode` / `towerContract` 只記在主行程的 `PtyInstance`、不持久化（CLAUDE.md「塔台分頁標題」節：「不持久化」）。BAT 重開後接回的 PTY 是同一個程序，但新的主行程沒有這些欄位。CT 端不知道 BAT 重開過，不會自己重新宣告。

## 已知的暫時做法

- 接回後在塔台分頁執行一次 `/control-tower`（或請塔台重新宣告）。

## 修正方向（待決）

- BAT：宣告跟著分頁存（例：已存的分頁資料或 Terminal Server 端的 PTY metadata），只在**同一個 PTY 接回**（程序沒換）時還原；⏻ 重啟、新 PTY、Recovery「重新開始」照舊清除（新 claude 會自己宣告）。

## 修正紀錄

- 2026-11-27 21:04 開單（OPEN，D434）
