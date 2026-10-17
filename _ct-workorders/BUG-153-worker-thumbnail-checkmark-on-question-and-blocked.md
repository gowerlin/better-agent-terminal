---
schema_version: 1
schema_kind: bug
id: BUG-153
title: "Worker 分頁縮圖在 `T#### 提問`（等塔台答覆）時也顯示 `✓` 並計入批次關閉；hook `blocked`（等使用者）時沒有專屬標示"
status: FIXED
fixed_at: "2026-10-18T05:31:45+0800"
fixed_by: T0609
fix_commit: "fbf641dc"
severity: medium
reproducibility: always
created_at: "2026-10-18T04:59:06+0800"
impact:
  - worker-thumbnail
  - worker-batch-close
links:
  discovered_in: "BMad-Guide T0166（CT v5.6.0 × BAT 0.7.0-pre.6 實機驗收，2026-10-18 04:51）；BMad-Guide 塔台跨 session 提出（CT-to-BAT 需求）"
  related: [PLAN-048, T0538, T0590, T0607, T0608, BUG-150]
---

# BUG-153 — Worker 縮圖：提問與 blocked 被當成「已回報」

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（使用者誤以為 Worker 已完成；塔台分頁右鍵「關閉已回報的 Worker 分頁（N）」會把仍在等答覆的 Worker 算進 N，有誤關風險，頁內確認框是唯一防線） |
| 可重現 | 必現（yolo Worker 送 `T#### 提問` 後） |
| **狀態** | ✅ FIXED（T0609 `fbf641dc`；主行程推送 `terminal:attention-changed`，縮圖 ⚠️ / `?` / `✓`；實機待含修正的版本） |

## 現象

- Worker 以 `bat-notify --source T####` 送出 `T#### 提問`（yolo 向塔台提問、原地等答覆）後，縮圖立刻顯示 `✓`，與完成回報同一個標示。
- 塔台分頁右鍵「關閉已回報的 Worker 分頁（N）」把它算進 N。
- Worker 處於 hook 偵測的 `blocked`（等使用者：permission / question / elicitation）時，縮圖沒有專屬標示（`bat_get_state` 本身正確）。
- 預期：提問中、blocked 各有標示，且都不計入批次關閉。

## 根因（BMad-Guide 只讀查看，塔台未複核）

- `markWorkerReported`（`src/stores/workspace-store.ts:656` 附近）不分訊息內容，任何 `bat-notify --source T####` 都寫 `workerReport`。
- `TerminalThumbnail.tsx:285` 附近：有 `workerReport` 就顯示 `✓`。
- 批次關閉的「已回報」比對唯一實作 `findReportingWorkers`（T0538）。

## 對方建議（BMad-Guide，原文摘要）

| 狀況 | 資料來源 | 圖示 | 計入批次關閉 |
|---|---|---|---|
| 執行中 | — | 無 | 否 |
| blocked（等使用者） | hook `state: blocked` + `blockedReason` | ⚠️（可依 reason 細分），tooltip 原因 + 起始時間 | 否 |
| 提問（等塔台答覆） | 通知訊息以 `提問` 結尾 | `?`，tooltip「已向塔台提問 HH:MM」 | 否 |
| 已回報（完成 / BLOCKED / 需要協助等） | 現行 `markWorkerReported` | `✓` | 是 |

- 同時成立時 blocked 優先。清除：blocked 依既有規則；提問在 Worker 下一次通知時換成對應標示。
- 辨識 `提問`：短期比對訊息結尾（CT 固定格式）；長期併入 PLAN-048 的結構化資料。CT 端不需改。

## 塔台初步方向（排期：使用者 2026-10-18 同意，T0607 合入 main 後派修復單）

- PLAN-048（T0607）會在主行程提供結構化的 `blocked` / `tower` 與 `pendingQuestions`；縮圖應優先使用主行程狀態（不靠訊息字串），訊息結尾 `提問` 只作為舊 CT（工單檔往返，未用 `--ask`）的後備判斷。
- 需確認 renderer 目前是否收得到主行程的 `blocked` 狀態（可能需要新增推送事件）。
