---
schema_version: 1
schema_kind: bug
id: BUG-236
title: "塔台開著原生選單（AskUserQuestion）時，待辦分頁的回答被直接送進選單（顯示「已送出」而不是「已排入待送」），選單收到的答案與使用者在待辦分頁選的不同"
status: CLOSED
severity: medium
reproducibility: "使用者實機一次（`0.8.1-pre.3`，2026-11-28 12:24）；未查證"
created_at: "2026-11-28T12:27:02+0800"
updated_at: "2026-11-28T15:05:12+0800"
impact:
  - tower-inbox
  - notify-hold
links:
  discovered_in: "使用者實機（U-57 / U-58，2026-11-28 第一百四十 session）"
  related: [BUG-235, BUG-196, T0964, T0788, T0908, T0926]
---
# BUG-236 — 待辦分頁的回答被打進開著的選單

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（答案可能被選錯：本次使用者在待辦分頁選 U-57：A，塔台收到的選單結果是兩題都「放棄」） |
| 可重現 | 使用者實機一次，待查證 |
| **狀態** | 🚫 CLOSED（交付版 `v0.8.1-pre.4` × CT 6.4.0-pre.1 / 6.3.0 隔離實例雙方驗收 T0969：H-2 / H-3 / H-5 / H-11 / H-12 / H-13 PASS，D496） |
| 回報者 | 使用者（2026-11-28 12:26） |
| 影響版本 | `v0.8.1-pre.3`（更早的版本未確認） |

## 現象（預期 vs 實際）

- 情境：塔台（Claude CLI · Tower，契約 v2）12:23 開了兩題的原生選單（U-57 合併、U-58 後續），同時寫進待辦分頁。
- 預期（T0788 / T0908 設計）：塔台開著選單時是 `question` blocked，待辦分頁送出的回答要保留在「📨 待送」，選單關閉後才送。
- 實際：
  - 待辦分頁 U-57 顯示「✓ 已送出：U-57：A（12:24）」（`sent`，不是 `held`）。
  - 截圖中終端選單的 U-57 已打勾、游標停在 U-58；之後塔台收到的選單結果是 U-57、U-58 **都是「放棄」**，與使用者在待辦分頁選的 A 不同。
  - 使用者原話：「兩邊都呈現選單時，似乎只能由終端輸入，能否能任由哪邊輸入都可」。
- 推論（未查證）：`U-57：A`＋Enter 以按鍵送進選單，被選單當成數字 / 方向鍵 / 選取處理；可能原因是 `question` blocked 還沒設上（hook 晚到）、或 AskUserQuestion 的提示沒有被判成 prompt reason。

## 線索（塔台整理，未查證）

- 日誌：`%APPDATA%\BetterAgentTerminal\Logs` 同日最新 `debug-*.log`，塔台分頁 `f32bfa46…` 在 04:23–04:26Z 的 `ask-user-question` / `permission-request` hook、`[notify-hold]`、`[tower-inbox] answer … → sent`。
- 相關：BUG-196（Worker 通知替塔台作答，T0788 保留）、BUG-224 / T0926（AskUserQuestion 晚到的 hook）、BUG-235 / T0964（回答被 draft 擋）。

## 修正紀錄

- 2026-11-28 12:27 開單 OPEN；修法方向（待辦分頁能否在選單開著時作答）交使用者 U-59（D479）
- 2026-11-28 12:32 U-59：A（兩邊都能答：選單開著時 BAT 先按 Esc 關選單、等回到輸入框再送文字）→ FIXING（T0965，D481）
- 2026-11-28 12:48 T0965 DONE（`e5a0ad16`）：原因是分頁內一次滑鼠按下（T0757 規則）清掉 `question`，選單仍開著，BAT 沒有「選單還開著」的紀錄，回答 `holdReason` 為 null 而直接寫入。修正：tracker 另記 AskUserQuestion 選單紀錄（與 `blocked` 分開）；契約 2 塔台的回答在 `question` 或只剩選單紀錄時保留，條件齊備時 BAT 送 Esc、確認選單關閉後再送文字。合併工單 T0967（D486）
- 2026-11-28 12:53 → FIXED：U-61：A，T0965 經 T0967 合併進 `main` `8a1c1318`（產品樹 = `84f8c900`），D489；T0965〈待實機〉確認後 CLOSED
- 2026-11-28 14:01 隨 `v0.8.1-pre.4` 發佈（D494）；A-26 實機確認後 CLOSED
- 2026-11-28 15:05 → CLOSED：交付版 `v0.8.1-pre.4` 隔離實例雙方驗收 T0969（真 claude）：選單開著時從待辦分頁回答 → 一次 Esc → 送出、Esc 後輸入框為空、選單開著時沒有持續輸出、不在選單的回答保留、Worker 通知保留、舊 BAT / 舊 CT 降級皆 PASS（D496）；提示行不看 `opened_at` 另開 BUG-237
