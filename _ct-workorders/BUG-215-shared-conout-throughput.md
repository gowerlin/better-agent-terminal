---
schema_version: 1
schema_kind: bug
id: BUG-215
title: "Windows Terminal Server（共用 conout Worker，`v0.8.x`）：10 個分頁同時大量輸出，完成時間比 `0.7.5-pre.2` 慢 24.4%"
status: FIXING
severity: low
reproducibility: "always（T0888 C4：N 6 次、O 6 次，兩輪順序對調結論一致）"
created_at: "2026-11-23T22:04:16+08:00"
updated_at: "2026-11-23T22:04:16+08:00"
impact:
  - terminal-server
  - windows
  - performance
links:
  discovered_in: "T0888 回報區〈發現〉F2"
  related: [T0887, T0888, T0889, PLAN-066, D309, D311, D312]
---
# BUG-215 — 共用 conout Worker：多分頁同時大量輸出的吞吐量

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（輸出完整、沒有遺漏；10 × 20,000 行約慢 1.1 s；峰值記憶體反而比 `0.7.5` 低約 90 MB） |
| 可重現 | ✅ 必定（T0888 C4） |
| **狀態** | ⏳ FIXING（T0889，D312） |
| 回報者 | 塔台（T0888 Worker 量測） |
| 影響版本 | 只有 `v0.8.x`（T0887 `a05a9c79` 起）；已發佈版本不受影響 |

## 現象（預期 vs 實際）

- **預期**：10 個分頁同時各印 20,000 行，完成時間不比 `0.7.5-pre.2` 慢超過 20%（T0888 C4 條件）。
- **實際**：完成時間中位數 N 5814.5 ms、O 4674 ms（+24.4%）；H 5488 ms（+17.4%）。各次：N 5980 / 7011 / 5787、5842 / 5768 / 5778；O 4664 / 5190 / 5417、4619 / 4666 / 4682。完成標記與最後 200 行序號全部正確。

## 證據

- `experiments/node-pty-worker/results/t0888-c4.csv`（`v0.8.x` `fd466fb3`）。
- 同機有使用者的 BAT 在跑，時間僅供參考；但 N / O 兩輪先後順序對調後 N 仍一致較慢。
- 重現：`BAT_T0888_SCENARIOS='C4'`，對 N、O 各跑一次（不要和其他測試同時跑）。

## 處置方向（T0889 查證）

- 推測：10 個 conout 都由同一個 Worker 執行緒讀取並轉送，轉送路徑（每個 chunk 的跨執行緒傳遞、複製）成為瓶頸。可能的改法：轉送路徑最佳化（批次、減少複製），或少量 Worker（每 N 個 PTY 一個）。🔴 不得用回每個 PTY 一個 Worker，也不得讓 C1 記憶體條件（10 分頁 < 45 MB、每多一個分頁 ≤ 0.5 MB）失守。
- 🔴 改 `shared-conout-worker.cjs` 會改變 holder 內容：發版前必須重跑 W6。
