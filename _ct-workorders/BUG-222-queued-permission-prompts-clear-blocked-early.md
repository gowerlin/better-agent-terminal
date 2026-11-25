---
schema_version: 1
schema_kind: bug
id: BUG-222
title: "claude 同一回合排隊多個權限詢問（「2 of 3」）時，使用者回答第一個後 `blocked` 就被清除：縮圖 ⚠️ 消失、通知保護失效，Worker 通知的 Enter 可能替使用者回答排隊中的詢問"
status: FIXING
severity: high
reproducibility: "observed（T0915 S2 M-C5，claude 2.1.331，同回合 3 個 Read 權限詢問）"
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T12:19:45+08:00"
impact:
  - blocked-state
  - notify-hold
  - worker-attention
links:
  discovered_in: "T0915（M-C5 過程）"
  related: [BUG-196, T0590, T0788, T0915, T0918, D337]
---
# BUG-222 — 排隊的權限詢問期間 `blocked` 被提早清除

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（與 BUG-196 同類：Worker 通知的 Enter 可能替使用者作答） |
| 可重現 | 觀察到（需要 claude 在同一回合平行送出多個需要權限的工具呼叫） |
| **狀態** | ⏳ FIXING（T0918） |
| 回報者 | T0915（PLAN-068 實機驗收自動化） |
| 影響版本 | 推定 T0590 起（不是 `v0.8.x` 新增的回歸；PLAN-068 的通知保護也依賴這個狀態） |

## 現象（預期 vs 實際）

- **預期**：claude 還有權限詢問在等使用者回答（畫面「2 of 3」「3 of 3」）時，分頁維持 `blocked`（`permission`）：縮圖 ⚠️、helper 的 Worker 通知被保留（T0788）。
- **實際**：3 個 `PermissionRequest` hook 幾乎同時到達；使用者回答第一個後，BAT 以使用者輸入清除 `blocked`，claude 接著顯示「2 of 3」「3 of 3」，但 hook 不會再送 → 縮圖 ⚠️ 消失、通知保護不成立。

## 證據

- 本機驗收目錄 `results/M-C5.md`〈BAT 端備註〉、debug log 11:42:51–11:42:55、`results/M-C5/06-queued-prompt-2of3.png`、`07-after-2of3.png`（T0915）。

## 處置

- 2026-11-25 12:19 D337：開單並派 T0918（先查清楚 claude 這種情況送哪些 hook 事件，再修；不得改壞 T0590 / T0757 / T0790 / T0791 已驗收的行為）。
