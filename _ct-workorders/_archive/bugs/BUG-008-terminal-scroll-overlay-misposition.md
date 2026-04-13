# 🐛 BUG-008：終端捲動造成 overlay UI 錯位（殘留框框疊在當前內容上）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-008 |
| **狀態** | 🚫 CLOSED |
| **嚴重度** | 🟡 Medium |
| **報修時間** | 2026-04-11 17:xx (UTC+8) |
| **報修人** | 使用者（dogfood 回報） |
| **影響範圍** | 終端捲動後 overlay UI（右鍵功能表、popover 等）位置錯誤 |
| **重現率** | 偶發（捲動操作後） |

---

## 現象描述

- **預期行為**：終端捲動後 overlay UI 正確消失或更新位置
- **實際行為**：overlay UI 元素（殘留框框）疊在當前終端內容上，位置錯誤

## 附帶資訊

- 附圖（本機路徑，不進 repo）：
  - `D:\Downloads\2026-04-11_162127.png`
  - `D:\Downloads\2026-04-11_162806.png`

## 根因分析

xterm.js 是 canvas-based render，捲動時觸發 scroll event，但 React 管理的 overlay（context menu / popover）是獨立 DOM layer，沒有響應 scroll event 更新或消失。

## 修復記錄

- **修復工單**：T0028（scroll dismiss overlay）
- **commit**：見 T0028 工單
- **runtime 驗收**：待驗（runtime 待使用者確認）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 17:xx | 📋 REPORTED | 使用者 dogfood 回報 |
| 2026-04-11 21:26 | ✅ FIXED | T0028 完成，scroll dismiss overlay 實作 |
