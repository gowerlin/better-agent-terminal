# BUG-021 — VS Code 開啟失敗（ENOENT）無錯誤提示

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-021 |
| **嚴重度** | 🟡 Medium |
| **狀態** | 🚫 CLOSED |
| **報修時間** | 2026-04-13 11:05 (UTC+8) |
| **發現人** | 使用者（runtime 測試） |
| **相關工單** | T0078（原始實作）, T0079（修復工單） |

---

## 現象描述

設定使用 `code-insiders` 但未安裝時，點擊「在 VS Code 中開啟」：

```
[ERROR] Failed to open D:\ForgejoGit\2026_Keenbest in code-insiders: spawn code-insiders ENOENT
Error: spawn code-insiders ENOENT
    at ChildProcess._handle.onexit (node:internal/child_process:284:19)
```

- 錯誤只出現在 log，UI 無任何提示
- 使用者不知道失敗原因

## 預期行為

- UI 顯示友善錯誤訊息：「找不到 code-insiders 執行檔，請至設定指定完整路徑」
- 或 toast notification
