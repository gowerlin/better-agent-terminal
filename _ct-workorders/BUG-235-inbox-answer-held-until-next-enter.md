---
schema_version: 1
schema_kind: bug
id: BUG-235
title: "待辦分頁按「完成」送出的回答被排進「待送」、沒有送到塔台，直到使用者自己在塔台分頁送出下一則訊息才一起送達（重按會送出重複的回答）"
status: FIXING
severity: medium
reproducibility: "使用者實機一次（`0.8.1-pre.3`，2026-11-28 12:00）；未查證是否穩定"
created_at: "2026-11-28T12:02:15+0800"
updated_at: "2026-11-28T15:42:36+0800"
impact:
  - tower-inbox
  - notify-hold
links:
  discovered_in: "使用者實機（A-25 回答，2026-11-28 第一百四十 session）"
  related: [T0964, T0904, T0908, T0940, T0942, BUG-227, BUG-234]
---
# BUG-235 — 待辦分頁的回答卡在「待送」

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（契約 v2 的主要回答路徑送不出去；只能自己在塔台分頁打字，或用縮圖選單「立即送出」） |
| 可重現 | 使用者實機一次，待查證 |
| **狀態** | 🔧 FIXING（T0964 修正不完整：交付版驗收 T0970 R2 FAIL → 重修 T0972，D503） |
| 回報者 | 使用者（2026-11-28 12:00） |
| 影響版本 | `v0.8.1-pre.3`（更早的版本未確認） |

## 現象（預期 vs 實際）

- 預期：塔台閒置（回合已結束、沒有對話框、輸入框沒有字）時，在待辦分頁按 A-25 的「完成」，`A-25：完成` 立刻送進塔台分頁並送出。
- 實際：
  - 該筆顯示「✓ 已排入待送：A-25：完成（12:00）」（`held`），「👷 Worker 等你」區出現「Claude CLI · Tower：待送 2 則通知」（塔台自己的分頁被列在 Worker 區）。
  - 回答沒有送到塔台。使用者接著在塔台分頁打字送出「鍵盤可輸入了, 但是 [截圖]」之後，兩則 `A-25：完成` 才在塔台回合進行中一起送到（= 同一個回答送了兩次），使用者再補一句「無法送出」。
- 時間點：塔台上一個回合在 12:00 前結束（回合結尾列出 `🙋 待你執行：A-25`），塔台當時沒有權限框或 AskUserQuestion。使用者在塔台分頁裡是否打過字、捲動、或切換焦點未知。

## 線索（塔台整理，未查證）

- 回答走 `tower-inbox:answer` → `NotifyHoldController.enqueueAnswer`，只受 prompt reason 與 `draft` 擋（`reading` 不擋）。最可能的原因是塔台分頁被判成 `draft`（S1：最後一次 Enter / Ctrl+C 之後有其他「使用者輸入」），但使用者回報時沒有在塔台輸入框留字。
- 可能把非打字的輸入記成草稿的來源（待查）：焦點回報（claude 開 DECSET 1004 時 xterm 在失焦 / 取得焦點送 `ESC[I` / `ESC[O`，點待辦分頁就會失焦）、滾輪回報（alt screen 滑鼠追蹤）、BUG-234 修正前後的 launch 保留、`/control-tower` 啟動參數後沒有任何使用者 Enter。
- 「2 則」：使用者可能按了兩次（`held` 後按鈕仍可按，T0942 D412 送出後不攔）；排進待送的相同回答沒有去重。
- 日誌：`%APPDATA%\BetterAgentTerminal\Logs\debug-20261128-115756.log`（或同日最新）應有 `[notify-hold] held terminal=f32bfa46… source=answer reason=…` 與 `[tower-inbox] answer … → held`。

## 修正紀錄

- 2026-11-28 12:02 開單 → FIXING（T0964，D476）
- 2026-11-28 12:23 T0964 DONE（`511b547e`）：觸發來源未確定（日誌與實驗排除焦點 / 滑鼠 / 滾輪回報、launch 保留、啟動參數，剩使用者實際按鍵）；修正：契約 2 claude 塔台 `user-prompt-submit` 時清掉送出前的草稿（300 ms 輸入窗＋2 s Enter 防護）、`draft set … cause=<類別>` 診斷日誌、待送佇列相同回答去重。整合分支 `ct-merge/T0964` `3837c663` 待斷點 E（U-57，D477）
- 2026-11-28 12:31 → FIXED：U-57：A，T0964 合併進 `main` `ee5d364f`（產品樹 = `511b547e`），D480；實機（T0964〈待實機〉）與 `draft set … cause=` 診斷日誌確認後 CLOSED
- 2026-11-28 14:01 隨 `v0.8.1-pre.4` 發佈（D494）；A-26 實機確認後 CLOSED
- 2026-11-28 15:42 → FIXING（退回）：交付版 `v0.8.1-pre.4` 驗收 T0970：閒置時回答（R1）PASS，但「以塔台開啟 Claude」後、啟動參數回合送出前按過鍵 → 回合結束後第一筆回答仍 `held … reason=draft`（R2 FAIL，pre.3 相同）。原因：T0964 的清除以 `isContractTower` 為前提，而啟動參數回合的 `user-prompt-submit` 早於塔台 `--set-role --bat-contract 2` 約 1 分鐘；這正是 BUG-235 原始時段。重修 T0972（D503）
