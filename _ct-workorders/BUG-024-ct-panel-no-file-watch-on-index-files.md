# 🐛 BUG-024：控制塔面板 index 檔案無 file watch，需手動重整

## 元資料
- **票號**：BUG-024
- **嚴重度**：Medium
- **狀態**：CLOSED
- **登記時間**：2026-04-13 15:55 UTC+8
- **相關工單**：T0095

---

## 問題描述

BAT 控制塔面板（工單、待辦池、臭蟲等 tab）在底層 markdown 文件被外部程式（如 sub-session）修改後，**不會自動更新顯示**，需使用者手動重整才能看到最新狀態。

---

## 影響範圍

| 檔案 | 對應 Tab | 是否有 file watch |
|------|---------|-----------------|
| `_workorder-index.md` | 工單 | ✅ 已修復（根因為事件未送達本地視窗） |
| `_backlog.md` | 待辦池 | ✅ 已修復 |
| `_bug-tracker.md` | 臭蟲 | ✅ 已修復 |
| `_decision-log.md` | 決策 | ✅ 已修復 |
| 個別 `T*.md` | 工單詳細 | ✅ 已修復（recursive watch 涵蓋） |
| 個別 `BUG-*.md` | 臭蟲詳細 | ✅ 已修復（recursive watch 涵蓋） |

---

## 預期行為

sub-session 修改上述任一檔案後，對應 tab 在 **1-2 秒內** 自動刷新顯示最新內容，無需使用者手動操作。

---

## 狀態流轉

| 時間 | 狀態 | 說明 |
|------|------|------|
| 2026-04-13 15:55 | OPEN | 塔台登記 |
| 2026-04-13 15:28 | FIXED | 根因：fs:changed 事件只透過 broadcastHub 發送（僅遠端），未透過 webContents.send 發送至本地視窗。修復：加入 BrowserWindow.getAllWindows() 廣播 |
