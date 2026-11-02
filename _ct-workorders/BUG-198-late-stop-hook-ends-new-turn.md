---
schema_version: 1
schema_kind: bug
id: BUG-198
title: "上一回合的 `stop` hook 回報晚於下一回合的 `user-prompt-submit` 到達時，新回合被提早結束（Worker 分頁 `↻` 提早變回 `✓`）"
status: FIXING
severity: low
reproducibility: rare
created_at: "2026-11-02T19:51:41+0800"
updated_at: "2026-11-02T21:45:51+0800"
impact:
  - tower-worker
links:
  discovered_in: "T0790 回報區〈遭遇問題〉第 2 點"
  related: [BUG-197, T0790, T0694]
---
# BUG-198 — 晚到的 `stop` 提早結束新回合

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響 Worker 分頁的回合標示：`↻` 提早變回 `✓`，批次關閉可能把還在執行的 Worker 算進去；60 s 無輸出備援在該回合不會再開始） |
| 可重現 | 偶發，未量測（與 BUG-197 同類的 hook 回報亂序） |
| **狀態** | 🔧 FIXING |
| 回報者 | 塔台（T0790 Worker 查證時發現） |

## 現象

- 預期：Worker 回報後又開始新回合 → `↻`，等這個回合結束才回到 `✓`（T0694 / D180）。
- 實際（依程式路徑推論，T0790 查證）：上一回合的 `stop` 回報如果晚於下一回合的 `user-prompt-submit` 到達主行程，`TerminalBlockedTracker` 會把新回合結束。
- T0790 修 BUG-197 時，工單要求晚到事件的回合處理維持原樣，所以沒有處理這一項。

## 修正方向

- 用 T0790 已經送出的 hook 程序啟動時間 `at`：`stop` 的 `at` 早於目前回合開始時的 `at`，就不結束這個回合。舊 hook 沒有 `at` 時行為不變。
- 不回歸：T0694 回合信號（`agent-turn-attention` 單元、`t0609` / `t0735` e2e）、T0790 的 blocked 規則。

## 處理紀錄

- 2026-11-02 19:51 開單（OPEN，low），T0790 收單時登記；不擋 `0.7.3-pre.8`（D231）。
- 2026-11-02 21:45 → FIXING：開 T0791（P2，yolo），使用者指示開修正單並派工（D232）。
