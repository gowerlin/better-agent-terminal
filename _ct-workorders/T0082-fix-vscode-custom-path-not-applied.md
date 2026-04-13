# 工單 T0082-fix-vscode-custom-path-not-applied

## 元資料
- **工單編號**：T0082
- **任務名稱**：BUG-022 修復 — VS Code 自訂路徑未生效
- **狀態**：DONE
- **建立時間**：2026-04-13 11:35 (UTC+8)
- **開始時間**：2026-04-13 11:44 (UTC+8)
- **完成時間**：2026-04-13 11:49 (UTC+8)
- **相關單據**：BUG-022, T0079

---

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：無

## Session 建議
- **建議類型**：🆕 新 Session

---

## 任務指令

### 問題描述

使用者在 Settings 設定：
- VS Code Insiders 路徑：`C:\Program Files\Microsoft VS Code Insiders\Code - Insiders.exe`
- 檔案確認存在
- 但「在 VS Code 中開啟」仍報「找不到執行檔」

### 前置條件（必讀）

T0079 修改的檔案：
- `electron/main.ts`（`shell:open-in-editor` handler — 重點）
- `electron/preload.ts`（IPC bridge — 確認 customPath 傳遞）
- `src/stores/settings-store.ts`（確認 vscodeInsidersPath 存/讀邏輯）
- `src/components/SettingsPanel.tsx`（確認路徑欄位的 onChange 儲存邏輯）
- `src/components/Sidebar.tsx`（確認傳給 IPC 的參數）

### 診斷步驟（依優先順序）

**步驟 1：確認 editorType 對應邏輯**（`Sidebar.tsx` + `electron/main.ts`）

Handler 邏輯應為：
```
editorType === 'code-insiders' → 讀 vscodeInsidersPath
editorType === 'code'          → 讀 vscodePath
```
確認 Sidebar 傳給 IPC 的 `editorType` 值是否正確（使用者選 Insiders 時應傳 `'code-insiders'`）

**步驟 2：確認 settings 存讀正確**（`SettingsPanel.tsx` + `settings-store.ts`）

- 路徑輸入欄的 `onChange` / `onBlur` 是否有呼叫 `setVscodeInsidersPath()`？
- `settings-store` 的 getter 是否正確回傳 `vscodeInsidersPath`？
- 設定是否有持久化（重啟後仍存在）？

**步驟 3：確認 IPC 傳遞**（`preload.ts` + `main.ts`）

- `openInEditor(editorType, folderPath, customPath)` 的 customPath 參數是否完整傳到 main process？
- main process handler 接收到的 customPath 是否為完整路徑字串？

**步驟 4：確認 execFile 呼叫方式**（`main.ts`）

路徑含空格時，`execFile` 應直接接受：
```typescript
// 正確：execFile 不經 shell，空格不需跳脫
execFile('C:\\Program Files\\Microsoft VS Code Insiders\\Code - Insiders.exe', ['--new-window', folderPath])
```
若錯誤地包了引號或用 exec → 修正為 execFile + 直接路徑

---

### 修復方向

根據診斷結果修復，常見修法：
- 若 editorType 傳錯 → 修 Sidebar 傳遞邏輯
- 若 settings 未儲存 → 補 onChange handler
- 若 customPath 傳遞遺失 → 修 preload bridge 參數
- 若 execFile 路徑問題 → 改用正確方式傳遞路徑

### 驗收條件
1. Settings 填入 `C:\Program Files\Microsoft VS Code Insiders\Code - Insiders.exe`
2. 點擊「在 VS Code 中開啟」→ **成功以新視窗開啟**，無錯誤訊息
3. `npx vite build` 通過

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 根因確認
步驟 4 — `execFile` 呼叫方式。
使用者從 Windows 檔案總管複製路徑時，路徑含空白字元會被自動加上雙引號（如 `"C:\Program Files\...\Code - Insiders.exe"`），`execFile` 將引號視為檔名的一部分，導致 ENOENT。

錯誤日誌確認：
```
spawn "C:\Program Files\Microsoft VS Code Insiders\Code - Insiders.exe" ENOENT
```

### 修復內容
雙層防呆：
1. **`electron/main.ts`** handler：`customPath` 在使用前 strip 前後引號（`replace(/^["']+|["']+$/g, '')`），確保傳給 `execFile` 的路徑不含引號
2. **`src/components/SettingsPanel.tsx`**：兩個 VS Code 路徑輸入欄位加 `onBlur` 清理引號，使用者貼上後離開欄位即自動移除引號

### 產出摘要
- 修改：`electron/main.ts`（handler 引號防呆）
- 修改：`src/components/SettingsPanel.tsx`（兩個 input 的 onBlur 引號清理）
- `npx vite build` 通過

### 遭遇問題
無

### 互動紀錄
[11:45] Q: 使用者提供完整錯誤日誌 → A: 確認 executable 包含雙引號 → Action: 判定根因為引號未清理
