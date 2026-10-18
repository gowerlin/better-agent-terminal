---
schema_version: 1
schema_kind: bug
id: BUG-154
title: "結構化提問（`bat-notify --ask`）答覆後，仍在執行的 Worker 縮圖顯示 `✓` 並計入批次關閉"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-18T09:47:39+0800"
impact:
  - worker-thumbnail
  - worker-batch-close
links:
  discovered_in: "T0612 Step 2（`v0.7.0-pre.7` 安裝版探針，使用者目視截圖，2026-10-18 09:44）"
  related: [BUG-153, PLAN-048, T0609, T0607, T0608, T0538]
---

# BUG-154 — 結構化提問答覆後縮圖變 `✓`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（仍在執行的 Worker 被算進「關閉已回報的 Worker 分頁（N）」，有誤關風險；頁內確認框是唯一防線） |
| 可重現 | 必現（T0612 Step 2） |
| **狀態** | 📂 OPEN |

## 現象（T0612，`v0.7.0-pre.7` 安裝版）

1. Worker `bat-notify --ask --source T0612 … --submit "T0612 結構化提問（探針 Step 2）"`（訊息刻意不以 `提問` 結尾）→ 縮圖 `?`（正確）。
2. 塔台 `bat-terminal.mjs --answer <id> --choice 1`（09:44:05）→ Worker `--wait-answer` 收到 `answered`，接著停 60 秒（仍在執行，綠點）。
3. **這 60 秒內縮圖顯示 `✓`**（使用者截圖）。批次關閉「已回報」與 `✓` 同源（`findReportingWorkers`），推定 N = 1（未目視）。
4. 對照：Step 3 舊 CT `T0612 提問` 時縮圖回 `?`、N = 0；Step 4 `T0612 完成` 時 `✓`、N = 1（皆正確）。

預期：結構化問題答覆後，Worker 回到「執行中」（無標示、不計入批次關閉），直到下一次真正的回報。

## 根因（塔台推測，未讀程式碼）

- `--ask` 的通知帶 `--source T####`，renderer 的 `markWorkerReported` 不分內容記下 `workerReport`；問題 pending 時主行程 attention（`?`）蓋過它，答覆後 attention 清除，殘留的 `workerReport` 就顯示成 `✓`。
- 修正方向待 Worker 查證：`--ask` 送出的通知不記 `workerReport`（或記成提問、答覆時清除），判斷集中在 `workerAttention`（`src/lib/terminal-attention.ts`）/ `findReportingWorkers`。
