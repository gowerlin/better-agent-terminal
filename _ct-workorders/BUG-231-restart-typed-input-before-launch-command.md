---
schema_version: 1
schema_kind: bug
id: BUG-231
title: "⏻ 重啟 claude / codex 分頁：新 shell 起來到啟動命令寫入前（約 500 ms）使用者打的字，會黏在啟動命令前面"
status: FIXING
severity: low
reproducibility: "推測必定：⏻ 後 500 ms 內在分頁打字（T0947 查證時發現，未實機重現）"
created_at: "2026-11-27T21:13:26+08:00"
updated_at: "2026-11-27T21:13:26+08:00"
impact:
  - claude-cli
  - terminal-restart
links:
  discovered_in: "T0947 回報區〈後續建議〉（D433）"
  related: [T0947, BUG-229, BUG-151, T0951, D438]
---
# BUG-231 — ⏻ 期間打的字黏在啟動命令前面

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（要在 ⏻ 後很短的時間內打字才會發生；發生時 claude 不會啟動） |
| 可重現 | 推測必定，未實機重現 |
| **狀態** | ⏳ FIXING（T0951，D438） |
| 回報者 | T0947 Worker 查證時發現；使用者裁示開單（2026-11-27 21:13） |
| 影響版本 | `v0.8.0`（既有，T0947 前就如此） |

## 現象（預期 vs 實際）

- 預期：⏻ 後 claude 正常啟動；使用者在啟動前打的字不遺失，也不破壞啟動命令。
- 實際（推測）：`createPtyThenLaunch` 在 `pty:create` 回來後 `setTimeout(500)` 才寫啟動命令；這段時間使用者打的字先進了新 shell 的輸入列，啟動命令接在後面 → 命令被破壞，claude 沒有啟動。與 BUG-229 同一個時間窗，BUG-229 是滑鼠回報，本單是使用者輸入。
- helper 派工已有保護：`PtyManager.holdInputForDispatch` / `writeDispatchCommand` 把派工指令寫入前打進新分頁的輸入移到指令之後（BUG-151）；⏻ 路徑沒有。

## 修正紀錄

- 2026-11-27 21:13 開單 → FIXING（T0951，D438）
