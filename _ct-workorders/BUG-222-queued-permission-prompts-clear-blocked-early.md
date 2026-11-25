---
schema_version: 1
schema_kind: bug
id: BUG-222
title: "claude 同一回合排隊多個權限詢問（「2 of 3」）時，使用者回答第一個後 `blocked` 就被清除：縮圖 ⚠️ 消失、通知保護失效，Worker 通知的 Enter 可能替使用者回答排隊中的詢問"
status: CLOSED
severity: high
reproducibility: "observed（T0915 S2 M-C5，claude 2.1.331，同回合 3 個 Read 權限詢問）"
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T14:10:21+08:00"
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
| **狀態** | 🚫 CLOSED（測試版 `0.0.0-exp.21`（`v0.8.x` `6d7b4cd3`）以真 claude 塔台實測 PASS，T0920 R3；D338） |
| 回報者 | T0915（PLAN-068 實機驗收自動化） |
| 影響版本 | 推定 T0590 起（不是 `v0.8.x` 新增的回歸；PLAN-068 的通知保護也依賴這個狀態） |

## 現象（預期 vs 實際）

- **預期**：claude 還有權限詢問在等使用者回答（畫面「2 of 3」「3 of 3」）時，分頁維持 `blocked`（`permission`）：縮圖 ⚠️、helper 的 Worker 通知被保留（T0788）。
- **實際**：3 個 `PermissionRequest` hook 幾乎同時到達；使用者回答第一個後，BAT 以使用者輸入清除 `blocked`，claude 接著顯示「2 of 3」「3 of 3」，但 hook 不會再送 → 縮圖 ⚠️ 消失、通知保護不成立。

## 證據

- 本機驗收目錄 `results/M-C5.md`〈BAT 端備註〉、debug log 11:42:51–11:42:55、`results/M-C5/06-queued-prompt-2of3.png`、`07-after-2of3.png`（T0915）。

## 處置

- 2026-11-25 12:19 D337：開單並派 T0918（先查清楚 claude 這種情況送哪些 hook 事件，再修；不得改壞 T0590 / T0757 / T0790 / T0791 已驗收的行為）。
- 2026-11-25 12:45：FIXED（T0918 `8d36b036`）。查證：claude 2.1.331 的 `PermissionRequest` hook 沒有 `tool_use_id`，回答時不送任何 hook；能對應結束的只有該批的 `PostToolBatch`。修法（不改 hook、不加 payload）：`TerminalBlockedTracker` 記每個 `permission-request`，未結束 ≥ 2 個時使用者輸入 / 滑鼠不清除（仍算使用者輸入），由該批 `post-tool-batch`、`stop`、`user-prompt-submit`、PTY 結束、recovery 清除；只有 1 個時行為與修正前完全相同。已知限制：回答完後若有長時間工具，⚠️ 與通知保留維持到工具執行完；以 Esc / 無回饋 No 拒絕會中斷回合且無 hook，維持到下一個 prompt。`test:unit` 第一次即綠 8965、`test:legacy` 472、e2e t0787 2 passed。
- 2026-11-25 14:10：CLOSED（D338）。驗證依據：測試版 `0.0.0-exp.21`（desktop-build `45550729062`，`v0.8.x` `6d7b4cd3`）隔離實例＋真 claude 2.1.331 塔台，T0920 R3 PASS：回答第一個後 `kept: user input while 2 permission prompts are open`、⚠️ 仍在，「2 of 2」期間通知 `held … reason=permission`、Enter 沒有代答，批次結束後 1.0 s 才送；單一詢問回答後 ⚠️ 照舊立即消失（7 次）。
