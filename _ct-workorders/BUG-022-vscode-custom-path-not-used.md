# BUG-022 — Settings 設定 VS Code Insiders 完整路徑後仍報「找不到執行檔」

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-022 |
| **嚴重度** | 🔴 High |
| **狀態** | 🚫 CLOSED |
| **報修時間** | 2026-04-13 11:35 (UTC+8) |
| **發現人** | 使用者（runtime 測試） |
| **相關工單** | T0079（原始實作）, T0082（修復工單） |

---

## 現象描述

- Settings 已設定 VS Code Insiders 路徑：`C:\Program Files\Microsoft VS Code Insiders\Code - Insiders.exe`
- 確認檔案存在
- 點擊「在 VS Code 中開啟」仍出現「找不到執行檔」警告

## 根因假設（優先順序）

1. **editorType 未設為 `code-insiders`**：handler 讀的是 `vscodePath` 而非 `vscodeInsidersPath`
2. **路徑未正確存入 settings**：UI 填入後未觸發儲存，store 仍為空
3. **execFile 路徑含空格處理問題**：路徑含空格但未正確傳遞（機率較低，execFile 通常能處理）
4. **IPC 傳遞問題**：customPath 參數在 preload bridge 傳遞過程中遺失
