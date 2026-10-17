---
schema_version: 1
schema_kind: bug
id: BUG-152
title: "塔台以 helper 派出的 Worker 分頁會搶走鍵盤焦點，使用者正在打的字跑進 Worker 分頁"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-18T03:13:30+0800"
impact:
  - helper-dispatch
  - terminal-focus
links:
  discovered_in: "T0598 回報區「偏離 / 範圍」（BUG-151 根因分析）"
  related: [BUG-151, BUG-135, T0532, T0598, D154]
---

# BUG-152 — 派工分頁搶焦點

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（輸入誤送到 Worker 分頁；BUG-151 修正前會直接讓 Worker 起不來） |
| 可重現 | 必現：派工分頁落在使用中的工作區時 |
| **狀態** | 🔧 FIXING（T0599） |

## 現象

- 預期（D154）：helper 派出的 Worker 分頁出現在分頁清單與縮圖，鍵盤焦點留在使用者正在用的分頁（例如塔台）。
- 實際：`addExternalTerminal`（`src/stores/workspace-store.ts`，BUG-135 / T0532：落在 active 工作區時設 `focusedTerminalId`）→ TerminalPanel 的 `isActive` effect 呼叫 `terminal.focus()`，使用者正在打的字轉進 Worker 分頁。BMad-Guide 實例：焦點被搶約 3 秒（T0598 日誌 L650 / L672–673）。

## 修正方向（D154）

只對 helper 派出的分頁不搶焦點；手動開的分頁、UI 按鈕開的分頁照舊。實作：T0599。
