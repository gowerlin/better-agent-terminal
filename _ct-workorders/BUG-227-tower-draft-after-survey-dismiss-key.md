---
schema_version: 1
schema_kind: bug
id: BUG-227
title: "契約 2 塔台：用數字鍵關掉 claude 意見調查列後，BAT 把那一鍵當成輸入框有字（`draft`），待辦分頁的回答排進「📨 待送」直到下一次 Enter"
status: FIXED
severity: low
reproducibility: "always（契約 2 塔台分頁出現 claude 意見調查列時，以數字鍵作答或關閉）"
created_at: "2026-11-27T14:09:27+08:00"
updated_at: "2026-11-27T14:35:07+08:00"
fixed_at: "2026-11-27T14:34:00+08:00"
impact:
  - inbox
  - notify-hold
links:
  discovered_in: "T0939（CT 6.3.0-pre.1 雙方驗收 S1 M-3 步驟 5～7，BAT `0.8.0-pre.8`）"
  related: [T0904, T0939, PLAN-068]
---
# BUG-227 — 意見調查列的數字鍵讓塔台被判成有草稿

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（回答不遺失，有「📨 待送」提示；但使用者不知道要在空輸入框按 Enter） |
| 可重現 | 必定：契約 2 塔台分頁出現 claude 的意見調查列（「How is Claude doing this session? … 0: Dismiss」）時按數字鍵 |
| **狀態** | ✅ FIXED（T0940 `8312ee6f` / `f00fb06e`，合併 `ct-merge/T0940` `43272eb9`，D408；待 `0.8.0-pre.9` 實機驗收） |
| 回報者 | T0939 Worker 記錄；使用者 2026-11-27 指示開單 |
| 影響版本 | 自 T0904（PLAN-068 W1＋W2，契約 2 塔台的 `draft` 保留）起 |

## 現象（預期 vs 實際）

- 預期：用數字鍵回答或關掉 claude 的意見調查列後，塔台輸入框是空的，待辦分頁送出的回答立即送進塔台。
- 實際：BAT 仍把那一鍵當成輸入框有字（T0904 `draft`），下一則待辦分頁回答以 `reason=draft` 排進「📨 待送」（`[notify-hold] held … reason=draft`），直到使用者在空的輸入框按一次 Enter 才送出。T0939 實測 13:23:46 送出。

## 根因（塔台推測，待 Worker 確認）

草稿判斷 `trackDraft`（`src/lib/tower-input-draft.ts`）只看使用者送進 PTY 的位元組，看不到 claude 畫面內部；意見調查列消耗了那個數字鍵，但 BAT 照一般文字輸入記成「有字」。同類情況可能還有其他「單鍵作答」的 claude 介面（待 Worker 盤點）。

## 已知的暫時做法

在塔台分頁的空輸入框按一次 Enter；`e2e/manual/README.md`〈已知限制〉已記載（T0939）。

## 處置

CT 判定（CT D913）回來、BAT 端無其他要改的項目 → 開 T0940 修正（D406）。CT 判定單認為不必當 BUG（回答不遺失、文字相同）；本單依使用者指示保留並修正。

T0940 查證（claude 2.1.331）：調查列讓按鍵先進主輸入框、400 ms 後清空，只看按鍵分不出；同類還有逐字稿分享 `y/n/d`、bypass 原因調查，以及權限 / 提問對話框期間的按鍵。修正：唯讀 PTY 輸出辨識單鍵介面圖例（四條件成立才不記草稿）＋提示期間單一按鍵不改草稿（貼上 / 多字元照舊）。殘留保守誤判：調查列先點分頁再按、出現 1 s 內按鍵。

驗收（`0.8.0-pre.9` 起，見 T0940〈待實機〉）：塔台分頁出現調查列 ≥ 1 s 後按 `0`，debug log 有 `single-key prompt shown` / `answered … (no draft)`，之後待辦分頁回答立即送出；權限提示以數字鍵作答後同樣立即送出。
