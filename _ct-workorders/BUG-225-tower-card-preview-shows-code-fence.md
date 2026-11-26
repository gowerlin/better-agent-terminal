---
schema_version: 1
schema_kind: bug
id: BUG-225
title: "待辦分頁「💬 塔台訊息」卡片收合時的摘要取第一個非空行，訊息以 Markdown 程式碼區塊開頭時只顯示「```」"
status: CLOSED
closed_at: "2026-11-26T21:18:59+08:00"
closed_reason: "交付版 `v0.8.0-pre.5`（Pre-Release `45820932628`）使用者實機驗收 A-4 完成（D378）"
severity: low
reproducibility: "always（塔台回合最後一則訊息第一個非空行是程式碼圍欄時）"
created_at: "2026-11-26T20:08:02+08:00"
updated_at: "2026-11-26T21:18:59+08:00"
fixed_at: "2026-11-26T20:26:41+08:00"
impact:
  - inbox
links:
  discovered_in: "T0928 觀察（`ct620-accept/results-rerun/` S5 `00b-inbox-startup.png`，本機）"
  related: [T0909, T0905, PLAN-068, T0931]
---
# BUG-225 — 💬 卡片摘要只顯示「```」

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響收合時的一行摘要；展開後全文正常） |
| 可重現 | 必定：訊息第一個非空行是 ```` ``` ```` / ```` ```bash ```` 等圍欄 |
| **狀態** | 🚫 CLOSED（交付版 `v0.8.0-pre.5` 使用者實機驗收 A-4，D378；修正 T0931 `bfc83d1b`，合併 T0932） |
| 回報者 | T0928 Worker 觀察；使用者 2026-11-26 指示開單修 |
| 影響版本 | 自 T0909（PLAN-068 W6）起 |

## 現象（預期 vs 實際）

- 預期：收合的卡片摘要顯示訊息中有意義的第一句。
- 實際：塔台訊息以程式碼區塊開頭時，摘要只有「```」（或「```bash」）。

## 根因（塔台讀碼，待 Worker 確認）

`towerCardPreview`（`src/lib/tower-card-view.ts` 約第 53 行）取第一個非空行、截到 120 字，沒有略過 Markdown 結構行（程式碼圍欄、分隔線、表格分隔列）。

## 處置

T0931 修正（`bfc83d1b`）：`towerCardPreview` 追蹤程式碼區塊，略過圍欄、分隔線、表格分隔列，標題去 `#`；區塊外沒字才取區塊內第一行；全是結構行回原第一行。T0932 合併進 `main`（D373）。

驗收：安裝 `0.8.0-pre.5` 後，讓契約 v2 塔台送一則以 ```` ```bash ```` 開頭的訊息，看待辦分頁「💬 塔台訊息」收合摘要顯示的是區塊外的第一句。
