---
schema_version: 1
schema_kind: bug
id: BUG-237
title: "待辦分頁「塔台正以選單詢問此題：在這裡回答會先關掉選單」提示不看 `opened_at`：殘留的 `menu_open` 遇到別的選單時仍顯示，但 BAT 實際判 `stale`、不會關選單"
status: OPEN
severity: low
reproducibility: "T0969 H-7 實測（人為殘留 `menu_open`＋不含 U-n 的需求對齊選單）；CT 6.4.0 正常流程只有「使用者 Esc 後、塔台下一次寫入前就開了不含 U-n 的選單」才會遇到"
created_at: "2026-11-28T15:05:12+0800"
updated_at: "2026-11-28T15:09:41+0800"
impact:
  - tower-inbox
links:
  discovered_in: "T0969（CT 6.4.0-pre.1 × BAT 0.8.1-pre.4 雙方驗收 H-7）"
  related: [T0968, T0969, BUG-236]
---
# BUG-237 — 選單提示行不看 `opened_at`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只有提示文字與實際行為不一致；回答照樣保留到選單關閉，不會送錯） |
| 可重現 | T0969 H-7（人為殘留） |
| **狀態** | 📂 OPEN |
| 回報者 | T0969 Worker（2026-11-28 15:04） |
| 影響版本 | `v0.8.1-pre.4` |

## 現象（預期 vs 實際）

- 預期：只有 BAT 真的會為這題代按 Esc 時，才顯示「塔台正以選單詢問此題：在這裡回答會先關掉選單」。
- 實際：T0969 H-7，需求對齊選單（不含 U-n）開著、狀態檔留著舊的 `menu_open.ids` 含 U-5（`opened_at` 早 1 小時），待辦分頁 U-5 仍顯示提示；主行程判 `stale`、不送 Esc，回答保留到選單關閉後才送（`ACC/results-640/H-7.md` 備註 1、`03-inbox.png`）。
- 原因：提示行只看「塔台分頁是 `question`＋該題在 `menu_open.ids`」（T0968 Q-2 的做法），renderer 不知道選單紀錄的開始時間；主行程的判斷另外比對 `opened_at`（`menuEscDecision`）。docs `tower-inbox.md`「提示行」已寫明這個限制。

## 修法方向（未定）

- 提示行也比對選單紀錄開始時間（主行程已有 `questionMenuOpenedAt`），需要把它帶到 renderer（attention 或查詢），或由主行程直接回「這題會不會代按 Esc」。

## 修正紀錄

- 2026-11-28 15:05 開單 OPEN（T0969 建議，D496）
- 2026-11-28 15:09 U-66：A → 開單修、放進 `0.8.1-pre.5`；等 CT T0584 判定（觀察 ① 可能要 BAT 把「ids 不在 awaiting_user」當 stale）後合成一張工單（D497）
