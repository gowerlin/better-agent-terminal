---
schema_version: 1
schema_kind: bug
id: BUG-157
title: "「編輯連線」按「Pin expected fingerprint」後再按「儲存」，會把舊指紋寫回去；釘選失敗的錯誤也被吞掉"
status: CLOSED
closed_at: "2026-10-18T22:24:09+0800"
closed_by: "使用者（T0663 安裝版 0.7.1-pre.2 自動化驗收）"
fixed_at: "2026-10-18T18:41:43+0800"
fixed_by: T0650
fix_commit: "5594ec57"
severity: medium
reproducibility: always（T0650 以 vitest + RTL 重現）
created_at: "2026-10-18T18:33:43+0800"
impact:
  - remote-profile-edit
  - remote-security
links:
  discovered_in: "T0646（`/remote/` 指紋段落依程式碼改寫時發現，回報區「給塔台的後續建議」第 3 點）"
  related: [T0646, T0650, T0182]
---

# BUG-157 — 重新釘選的指紋被「儲存」蓋回

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（伺服器憑證更換後，使用者照 UI 操作仍連不上，只能重跑精靈；不會讓錯誤指紋被信任） |
| 可重現 | 必現（T0650 以 vitest + RTL 重現：修正前 4 項失敗） |
| **狀態** | 🚫 CLOSED（T0650 `5594ec57` 修正；2026-10-18 T0663 安裝版 `0.7.1-pre.2` 自動化驗收 PASS，使用者同意結案） |

## 現象（T0646 程式碼追蹤）

- `src/components/EditRemoteProfileModal.tsx` 的「Pin expected fingerprint」立即寫入新指紋，但對話框 state `editRemoteFingerprint` 仍是開啟時的舊值。
- 接著按「儲存」，`src/components/ProfilePanel.tsx` `handleSaveRemote` 以對話框 state 寫回 → 新指紋被舊值覆蓋。
- 釘選本身失敗時，錯誤沒有顯示給使用者。
- 預期：釘選後對話框顯示並保存新指紋；按「儲存」不會回退；釘選失敗有錯誤提示。

## 修正方向（T0650）

- 釘選成功後同步對話框 state（或「儲存」只寫使用者實際編輯的欄位）；釘選失敗顯示錯誤。
- 回歸測試覆蓋「釘選 → 儲存」順序。按鈕英文字樣由 BUG-158 處理，避免兩單改同一字串時衝突。

## 實機驗收（T0663，2026-10-18）

- 已安裝 `0.7.1-pre.2`（FileVersion 與隔離實例 `app.getVersion()` 相符），Playwright 隔離實例。
- V1：釘選後欄位立刻變新指紋；儲存、重開對話框、reload 後仍為新值，profile 可連線；關閉的埠 → 紅字錯誤、欄位不變
- 使用者 2026-10-18 22:24 同意 CLOSED。
