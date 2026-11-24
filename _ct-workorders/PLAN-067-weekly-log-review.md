---
schema_version: 1
schema_kind: plan
id: PLAN-067
title: "每週日誌清查：每週檢查一次 BAT 日誌、程序記憶體與測試穩定度，找出問題並提出改善計畫；塔台開工時超過一週沒清查就提示"
status: IN_PROGRESS
priority: medium
created_at: "2026-11-25T01:11:21+08:00"
updated_at: "2026-11-25T01:11:21+08:00"
review_interval_days: 7
last_review_at: "2026-11-25T00:37:30+08:00"
last_review_workorder: T0892
links:
  source: "使用者 2026-11-25 第一百三十 session `*plan`；D323"
  related: [T0892, BUG-216, BUG-217, BUG-218]
---

# PLAN-067 — 每週日誌清查

## 元資料

- **標題**：每週日誌清查（日誌、記憶體、測試穩定度 → 問題與改善計畫）
- **狀態**：IN_PROGRESS（常態運作的計畫；沒有完成日，停用時改 DROPPED）
- **優先級**：🟡 Medium
- **類型**：維運
- **建立時間**：2026-11-25 01:11 (UTC+8)

## 動機

T0892（2026-11-25）第一次檢查 `v0.8.0-pre.1` 的日誌，就找到 BUG-216（大型剪貼簿圖片卡住主行程）、BUG-217（指揮塔總覽日誌重複且含原文）兩個既有問題，以及 CT 端的 frontmatter 問題（HANDOVER，CT T0549）。這些問題平常不會有人看到。使用者要求定時檢查：每週一次，檢查 log，發現問題並提出改善計畫。

## 運作方式

### 觸發（塔台開工時）

- 塔台每次開工讀本檔 frontmatter `last_review_at`；距今 **≥ `review_interval_days`（7）天**，就在開工面板加一行提示：
  `⏰ 日誌清查已 N 天未做（上次 <日期>，<工單>）—— 要開這週的清查工單嗎？`
- 只提示、不自動派工；使用者同意後才開單。使用者說略過，本 session 不再提示（不改 `last_review_at`）。
- 規則寫在 `_local-rules.md`〈每週日誌清查（PLAN-067）〉。

### 清查工單（每週一張研究型工單）

以 T0892 為範本（`_ct-workorders/T0892-research-v080-pre1-log-review.md`，`memory_overrides` 照抄後改下列幾點）：

| 項目 | 內容 |
|---|---|
| 範圍 | 上次 `last_review_at` 之後的 `%APPDATA%\BetterAgentTerminal\Logs\debug-*.log`、`bat-scripts.log`（含輪替出的 `bat-scripts-*.log`）、`Crashes\` 新 dump；BAT 程序樹記憶體唯讀取樣（主行程、renderer、GPU、Terminal Server / holder）；可選：最近一週 GitHub Actions 的失敗紀錄（`gh run list -R gowerlin/better-agent-terminal --status failure`，唯讀） |
| 判定 | 每類錯誤 / 警告給：預期（附依據）／既有問題／新問題；附次數、第一次與最後一次時間、模組 tag |
| 產出 | 回報區〈調查結論〉＋〈改善計畫〉：每個問題的建議（開 BUG / 開 PLAN / 再觀察 / 補日誌），依影響排序 |
| 唯讀 | 只寫自己的工單檔；不干擾使用者正在用的 BAT；隱私規則同 T0892（不貼權杖、env、PTY 內容、對話、家目錄、真名） |
| 派工 | 不需 worktree 隔離；`--mode yolo --no-interactive` |

### 收單後（塔台）

1. 依〈改善計畫〉開 BUG / PLAN（使用者裁示要不要修、何時修）。
2. 更新本檔 frontmatter `last_review_at`（= 清查工單 `completed_at`）、`last_review_workorder`、`updated_at`，並在下方〈清查紀錄〉加一列。

## 清查紀錄

| 日期 | 工單 | 範圍 | 結論摘要 | 後續 |
|---|---|---|---|---|
| 2026-11-25 | T0892 | `v0.8.0-pre.1` 安裝後（2026-11-24 03:35 起）的日誌與記憶體 | 沒有 `v0.8.x` 回歸；兩個既有問題 | BUG-216（T0893 / T0895）、BUG-217（T0894）、CT HANDOVER（CT T0549） |
