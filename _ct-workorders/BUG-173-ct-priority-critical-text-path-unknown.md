---
schema_version: 1
schema_kind: bug
id: BUG-173
title: "指揮塔面板的優先級／嚴重度：frontmatter 的 critical 算 High，索引文字與 PLAN 檔補優先級時的 critical 卻是 Unknown"
status: CLOSED
severity: low
reproducibility: always（索引格子或 PLAN 檔只寫 critical、沒有 High 字樣時）
created_at: "2026-10-29T09:38:19+0800"
updated_at: "2026-10-30T13:20:37+0800"
impact:
  - control-tower-panel
links:
  discovered_in: "BMad-Guide 塔台 ADVISORY（2026-10-29，CT D408；專案A 回報指揮塔多頁顯示錯誤，CT 對照 BAT 0.7.1-pre.8 `17036a88` 原始碼）"
  related: [BUG-172, BUG-045]
---

# BUG-173 — critical 在文字路徑被判成 Unknown

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響優先級顯示與排序；CT 索引已改寫成「🔴 High（critical）」可避開） |
| 可重現 | 必定 |
| **狀態** | 🚫 CLOSED：T0709 `809eab0d`（`extractPriority` / `extractSeverity` 認 `critical` → High，含 PLAN 檔補優先級路徑；測試 27 項）；使用者以 `v0.7.1-pre.9` 實機驗收通過（2026-10-30） |
| 回報者 | BMad-Guide 塔台（CT 規範 D408 附帶建議第 2 點） |

## 現象

- 預期：`critical` 在任何讀取路徑都算 High。
- 實際：
  - frontmatter 路徑認 `critical` → High（`src/types/backlog.ts:23` `priorityFromFmEnum`、`src/types/bug-tracker.ts:62` `severityFromFmEnum`）。
  - 文字路徑只認 HIGH／MEDIUM／LOW → Unknown（`backlog.ts:71` `extractPriority`、`bug-tracker.ts:80` `extractSeverity`）。
  - 待辦的已完成／已放棄區從 PLAN 檔補優先級時走 `extractPriorityFromPlanContent`（`backlog.ts:87`），它用文字比對：PLAN frontmatter 的 `priority: critical` 會被 `Priority … : critical` 比對到，結果 Unknown，面板仍顯示 Unknown。

## 修正方向（建議，塔台決定）

- `extractPriority` / `extractSeverity` 加 `CRITICAL` → High（排在 HIGH 判斷前後皆可，結果相同）。
- 補 `src/types` 的 parser 測試：索引格子 `critical`、`🔴 Critical`、PLAN 檔 `priority: critical` 都得 High。
- 不新增 Critical 等級（`PlanPriority` / `BugSeverity` 型別不變），與 frontmatter 路徑一致。
