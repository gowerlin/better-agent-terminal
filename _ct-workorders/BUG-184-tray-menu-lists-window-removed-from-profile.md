---
schema_version: 1
schema_kind: bug
id: BUG-184
title: "系統匣圖示選單殘留已「Remove from profile」的視窗，同名項目出現兩個"
status: OPEN
severity: low
reproducibility: unknown
created_at: "2026-11-01T22:04:49+0800"
updated_at: "2026-11-01T22:04:49+0800"
impact:
  - system-tray
  - profile-window
links:
  discovered_in: "BUG-182 實機驗收（2026-11-01，第一百零四 session，使用者回報附截圖）"
  related: [BUG-183]
---

# BUG-184 — 匣圖示選單殘留已移出 profile 的視窗

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（選單多一個項目，容易選錯；不影響終端功能） |
| 可重現 | 未確認（使用者遇到一次） |
| **狀態** | 📂 OPEN |
| 回報者 | 使用者（BUG-182 實機驗收時，`v0.7.3-pre.1` 安裝版，Windows） |

## 現象

- 系統匣圖示選單同時列出兩個 `Better Agent Terminal - WSL Ubuntu-24.04:1`，其中一個是使用者先前已從 profile 移除的視窗。
- 預期：已移出 profile 的視窗不再出現在匣選單（或該視窗已關閉）。
- 實際：仍列在選單，子選單有 Show / Remove from profile。

## 塔台初步定位（唯讀，未驗證）

- 匣選單由 `rebuildTrayMenu`（`electron/main.ts` 約 816 行）依 `windowMap` 中未 destroyed 的視窗逐一列出，標籤取 `win.getTitle()`；殘留表示那個 BrowserWindow 仍在 `windowMap`（未 destroy，或 destroy 後選單沒重建）。
- 使用者以哪個入口「從 profile 移除」（關窗對話框 / 匣選單 / 配置畫面）未確認；兩個同名標籤也無法分辨。
- 與 BUG-183 可能同源（視窗的存活狀態與 profile registry 不一致），建議同一張修正單處理。
