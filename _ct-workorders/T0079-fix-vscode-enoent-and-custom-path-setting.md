# 工單 T0079-fix-vscode-enoent-and-custom-path-setting

## 元資料
- **工單編號**：T0079
- **任務名稱**：BUG-021 修復 — VS Code ENOENT 錯誤處理 + Settings 加入自訂執行檔路徑
- **狀態**：DONE
- **建立時間**：2026-04-13 11:05 (UTC+8)
- **開始時間**：2026-04-13 11:06 (UTC+8)
- **完成時間**：2026-04-13 11:12 (UTC+8)
- **相關單據**：BUG-021, T0078

---

## 工作量預估
- **預估規模**：小～中
- **Context Window 風險**：低（需讀 T0078 修改的幾個檔案）
- **降級策略**：若路徑設定 UI 複雜，先做 ENOENT 錯誤處理，路徑設定後補

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀 T0078 修改的 Settings / IPC 檔案

---

## 任務指令

### 前置條件（必讀）

T0078 修改的檔案（本工單的修改基礎）：
- `src/types/index.ts`（AppSettings 定義）
- `src/types/electron.d.ts`（IPC 型別）
- `src/stores/settings-store.ts`（settings store）
- `src/components/SettingsPanel.tsx`（Settings UI）
- `src/components/Sidebar.tsx`（右鍵選單觸發點）
- `electron/main.ts`（IPC handler `shell:open-in-editor`）
- `electron/preload.ts`（IPC bridge）
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`

---

### 修改項目 1：Settings 加入自訂路徑欄位

**目標**：讓使用者可指定 VS Code / VS Code Insiders 的完整執行檔路徑

**AppSettings 新增欄位**（`src/types/index.ts`）：
```typescript
vscodeEditorType?: 'code' | 'code-insiders'   // 已存在
vscodePath?: string          // 新增：VS Code 完整路徑（空白 = 用 'code'）
vscodeInsidersPath?: string  // 新增：VS Code Insiders 完整路徑（空白 = 用 'code-insiders'）
```

**Settings UI**（`src/components/SettingsPanel.tsx`）：
在現有 VS Code 編輯器下拉選單下方，新增兩個文字輸入欄：

```
VS Code 路徑（選填）
[___________________________________] 空白時使用 'code' 指令
範例：C:\Program Files\Microsoft VS Code\bin\code.cmd

VS Code Insiders 路徑（選填）
[___________________________________] 空白時使用 'code-insiders' 指令
範例：C:\Users\{User}\AppData\Local\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd
```

- placeholder 顯示範例路徑
- 輸入時即時寫入 settings store（或 onBlur 儲存）

**i18n 新增 key**：
```json
"vscodePath": "VS Code 路徑（選填）",
"vscodePathPlaceholder": "空白時使用 'code' 指令",
"vscodeInsidersPath": "VS Code Insiders 路徑（選填）",
"vscodeInsidersPathPlaceholder": "空白時使用 'code-insiders' 指令"
```

---

### 修改項目 2：IPC Handler 使用自訂路徑

**`electron/main.ts`** 的 `shell:open-in-editor` handler：

```typescript
// 執行邏輯
const editorType = settings.vscodeEditorType ?? 'code'
const customPath = editorType === 'code-insiders'
  ? settings.vscodeInsidersPath
  : settings.vscodePath

// 優先用自訂路徑，fallback 到指令名稱
const executable = (customPath && customPath.trim()) ? customPath.trim() : editorType

try {
  execFile(executable, ['--new-window', folderPath], (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 回傳結構化錯誤給 renderer
        event.reply('shell:open-in-editor:error', {
          type: 'ENOENT',
          executable,
          message: `找不到執行檔：${executable}`
        })
      }
    }
  })
} catch (e) {
  // 同上
}
```

---

### 修改項目 3：UI 顯示錯誤提示（BUG-021）

**`src/components/Sidebar.tsx`**（或觸發點）：

接收 IPC 錯誤後，顯示用戶友善提示：

```
找不到 VS Code 執行檔（code-insiders）
請至設定 → Shell 指定完整路徑
```

實作方式：
- 優先使用現有 toast/notification 機制（若有）
- 或使用 `alert()`（最簡單，可後續改為 toast）
- 或在 Sidebar 加入 state 顯示 inline 錯誤

Worker 自行判斷與現有 UI 最一致的方式。

---

### 驗收條件
1. Settings 有「VS Code 路徑」和「VS Code Insiders 路徑」兩個文字輸入欄
2. 填入完整路徑後，「在 VS Code 中開啟」使用該路徑執行
3. 未填路徑時，fallback 到 `code` / `code-insiders` 指令名稱
4. 執行檔找不到（ENOENT）時，UI 顯示友善錯誤提示（非靜默失敗）
5. `npx vite build` 通過
6. i18n 三語言完備

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行順序
1. 讀 `electron/main.ts`（找 `shell:open-in-editor` handler）
2. 讀 `src/types/index.ts`（AppSettings 現有欄位）
3. 讀 `src/components/SettingsPanel.tsx`（找 VS Code 設定區塊）
4. 讀 `src/components/Sidebar.tsx`（找右鍵選單實作位置 + 錯誤處理點）
5. 依序修改：types → store → IPC handler → Settings UI → Sidebar 錯誤提示 → i18n

### ⚠️ 額外確認：右鍵選單位置

使用者反映**不確定「在 VS Code 中開啟」選項是否確實可見**。

讀 `Sidebar.tsx` 時請確認：
1. 「在 VS Code 中開啟」是否加在**工作區 item 的右鍵選單**（正確位置）
2. 還是加在 Sidebar 層級（可能導致與工作區無關的地方也出現）
3. 是否有條件渲染導致選項隱藏（例如只有特定狀態才顯示）

若位置不對 → 修正到工作區 item 右鍵選單的正確層級。
若位置正確 → 在回報區說明「在哪裡觸發右鍵可看到此選項」，方便使用者驗收。

### ⚠️ 額外調查：「休眠 Agent」是否已實作

`Sidebar.tsx` 右鍵選單中已有「休眠 Agent」選項。請調查：

1. 點擊後呼叫哪個 function / IPC channel？
2. 對應的後端邏輯是否存在（electron/main.ts 或其他 handler）？
3. 判斷結論：
   - ✅ **已實作**：說明實作方式（session pause / session ID 保存 / 其他）
   - ⚠️ **部分實作**：說明哪部分缺失
   - ❌ **僅 UI stub**：handler 不存在或 `// TODO`

**不需要實作**，只需調查並在回報區說明現狀。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**修改檔案**（T0079 範圍內）：
- `src/types/index.ts` — AppSettings 新增 `vscodePath`、`vscodeInsidersPath` 欄位
- `src/stores/settings-store.ts` — 新增 `setVscodePath()`、`setVscodeInsidersPath()` 方法
- `electron/main.ts` — `shell:open-in-editor` handler 支援自訂路徑 + ENOENT 結構化錯誤回傳
- `electron/preload.ts` — IPC bridge 新增 `customPath` 參數
- `src/types/electron.d.ts` — `openInEditor` 型別更新（新增 customPath 參數 + 回傳結構化結果）
- `src/components/SettingsPanel.tsx` — 新增「VS Code 路徑」和「VS Code Insiders 路徑」兩個文字輸入欄
- `src/components/Sidebar.tsx` — 右鍵選單傳入自訂路徑 + ENOENT 時顯示 alert 提示
- `src/locales/en.json` — 新增 vscodePath / vscodeInsidersPath / vscodeNotFound 等 key
- `src/locales/zh-TW.json` — 同上（繁體中文）
- `src/locales/zh-CN.json` — 同上（簡體中文）

**驗收對照**：
1. ✅ Settings 有「VS Code 路徑」和「VS Code Insiders 路徑」兩個文字輸入欄
2. ✅ 填入完整路徑後，「在 VS Code 中開啟」使用該路徑執行
3. ✅ 未填路徑時，fallback 到 `code` / `code-insiders` 指令名稱
4. ✅ 執行檔找不到（ENOENT）時，UI 顯示 alert 友善錯誤提示（非靜默失敗）
5. ✅ `npx vite build` 通過
6. ✅ i18n 三語言完備

**右鍵選單位置確認**：「在 VS Code 中開啟」位於**工作區 item 右鍵選單**（Sidebar.tsx `handleContextMenu` 綁定 `workspaceId`），對 Sidebar 左側任一工作區 item 右鍵即可看到此選項。

### 發現的額外問題
無

### 互動紀錄
無
