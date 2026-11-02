---
schema_version: 1
schema_kind: bug
id: BUG-198
title: "上一回合的 `stop` hook 回報晚於下一回合的 `user-prompt-submit` 到達時，新回合被提早結束（Worker 分頁 `↻` 提早變回 `✓`）"
status: CLOSED
severity: low
reproducibility: rare
created_at: "2026-11-02T19:51:41+0800"
updated_at: "2026-11-02T23:01:45+0800"
closed_at: "2026-11-02T23:01:45+0800"
closed_reason: verified
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
| **狀態** | 🚫 CLOSED（T0791 `20bc7a88`；交付版 `v0.7.3-pre.9` 安裝版實測 T0792） |
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
- 2026-11-02 22:05 → FIXED（T0791，commit `20bc7a88`）：
  - 查證：修正前單元測試直接餵 tracker 重現（回合 1 prompt t1 → 回合 2 prompt t3 先到 → 回合 1 `stop` t2 晚到 → 回合被結束），4 個情境失敗；兩個真實 `bat-hook.mjs` 程序（`stop` 先啟動、stdin 未關而晚 ~300 ms 回報）與隔離實例 e2e 同樣重現。
  - 修正：`TerminalBlockedTracker` 記下目前回合 `user-prompt-submit` 中最晚的 `at`（`startTurn`，回合進行中收到的較晚 prompt 也更新）；`stop` 的 `at` 早於它 → 不結束回合，記 `[turn] terminal=<id> kept: hook stop happened <n>ms before the current turn (reported late)`（`endTurnByStop`）。任一方沒有 `at` 照舊結束；`blocked` 照 T0790 規則各自判斷；`at` 不進任何查詢或推送；`bat-hook.mjs` 未改。
  - 驗證：單元（`agent-turn-attention` 8 個新情境、`terminal-blocked-state` channel 與真實 hook 程序各 1）、突變（拿掉比較 → 7 失敗；不更新開始時間 → 4 失敗）、e2e `t0694-worker-resumed-badge` 新增步驟 6 實跑綠（突變版失敗）、不回歸 e2e `t0609` / `t0735` / `t0590` / `t0787` 綠、`typecheck` / `typecheck:electron` = 0、`test:unit` 6782 通過、`test:legacy` 472 通過、`vite build` 成功。
  - 未處理（方向安全）：同一回合的 `user-prompt-submit` 晚於它自己的 `stop` 到達時，回合多留到逾時備援 60 s（顯示 `↻`、不計入批次關閉），記在 docs。
- 2026-11-02 23:01 → CLOSED（`closed_reason: verified`）：T0792 以安裝版 `v0.7.3-pre.9`（`BAT_E2E_EXECUTABLE`，隔離實例＋假模型）跑 e2e `t0694` 3 次（含步驟 6）全過，每次記 1 行 `[turn] … kept: hook stop happened <n>ms before the current turn (reported late)`（13.8 / 14.4 / 3.7 ms）。spec 用 repo `scripts/` 的 hook，與安裝版逐位元相同（SHA-256 比對）。
