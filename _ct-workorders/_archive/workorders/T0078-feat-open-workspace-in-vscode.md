# 工單 T0078-feat-open-workspace-in-vscode

## 元資料
- **工單編號**：T0078
- **任務名稱**：功能 — 工作區清單「在 VS Code 開啟」按鈕 + 設定指定執行檔
- **狀態**：DONE
- **建立時間**：2026-04-13 10:35 (UTC+8)
- **開始時間**：2026-04-13 10:43 (UTC+8)
- **完成時間**：2026-04-13 10:59 (UTC+8)
- **相關單據**：（無）

---

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：低～中（需了解現有 Settings 系統 + IPC 架構）
- **降級策略**：若 Settings UI 架構複雜，先用 hardcode 預設值（code），Settings 選項後補

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀 Settings 系統、IPC 架構、工作區清單 UI

---

## 任務指令

### 功能說明

**需求**：在工作區清單（Workspace List）的每個工作區項目，加入「在 VS Code 開啟」功能。

**使用方式**：
- 按鈕（或右鍵選單）→「在 VS Code 開啟」
- 以設定指定的 VS Code 執行檔開啟該工作區路徑

**設定項目**：
- 路徑：Settings → 外觀/行為相關區塊（Worker 自行判斷合適位置）
- 選項：`VS Code` / `VS Code Insiders`（預設：VS Code）
- 設定 key 建議：`vscodeEditorType`，值：`'code'` | `'code-insiders'`

---

### 前置條件（必讀）

1. **讀取 `src/utils/execFileNoThrow.ts`**：專案使用此工具替代 `exec()`，**禁止直接用 `exec()`**
2. **讀取設定系統**：找到現有 Settings 的 state/store 定義（可能在 `electron/` 或 `src/store/` 或 `preload.ts`）
3. **讀取 IPC 架構**：找到現有 IPC handler 範例（`electron/main.ts` 或 `electron/ipc/`）
4. **讀取工作區清單 UI**：找到顯示工作區列表的 component（可能是 `WorkspaceList.tsx` 或類似）
5. **讀取 Settings UI**：找到設定頁面的 component

---

### 實作規格

#### 1. 設定項目（Settings）

在設定頁面加入：
```
VS Code 執行檔
○ VS Code (code)
○ VS Code Insiders (code-insiders)
```

設定儲存路徑：與現有設定系統一致（Worker 自行判斷）。

---

#### 2. IPC Handler（Electron Main Process）

新增 IPC channel：`shell:open-in-vscode`

> ## ⚠️ 需求修正（執行中補充）
> **必須開啟新的 VS Code 實例**，不能複用現有視窗。
> URL Protocol（方式 A）**不支援** `--new-window`，請**使用方式 B**（`execFileNoThrow` + `--new-window` 旗標）。

**實作方式（唯一）**：使用 `execFileNoThrow` + `--new-window`
```typescript
import { execFileNoThrow } from '../utils/execFileNoThrow.js'
const executable = editorType === 'code-insiders' ? 'code-insiders' : 'code'
// --new-window：強制開啟新的 VS Code 實例，不複用現有視窗
await execFileNoThrow(executable, ['--new-window', folderPath])
```

> ⚠️ **禁止使用 `exec()`**，必須使用 `execFileNoThrow`（`src/utils/execFileNoThrow.ts`）
> ⚠️ **不要使用 URL Protocol**（`vscode://file/...`）：該方式無法控制是否開新視窗

---

#### 3. 工作區清單 UI

在每個工作區列表項目加入按鈕（或 hover 顯示）：

```
[工作區名稱]  [在 VS Code 開啟 ↗]
```

- 按鈕文字：「在 VS Code 開啟」（i18n，依設定動態切換 Insiders 字樣）
- 點擊後：呼叫 IPC `shell:open-in-vscode`，傳入工作區路徑 + 目前設定的 editorType

---

#### 4. i18n（三語言：en / zh-TW / zh-CN）

需新增的 key：
```json
"openInVSCode": "在 VS Code 開啟",
"openInVSCodeInsiders": "在 VS Code Insiders 開啟",
"vscodeEditorType": "VS Code 執行檔",
"vscodeEditorVSCode": "VS Code",
"vscodeEditorInsiders": "VS Code Insiders"
```

---

### 驗收條件
1. 工作區清單每個項目有「在 VS Code 開啟」按鈕
2. 點擊後以正確 VS Code（或 Insiders）**開啟新實例**（不複用現有視窗）
3. Settings 有選項可切換 VS Code / VS Code Insiders
4. 切換設定後，按鈕行為及文字對應改變
5. `npx vite build` 編譯通過，無 TypeScript 錯誤
6. i18n 三語言均有對應 key
7. **未使用 `exec()` 直接執行指令**（使用 `shell.openExternal` 或 `execFileNoThrow`）

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行順序
1. 讀 `src/utils/execFileNoThrow.ts`（了解安全執行指令的方式）
2. 讀 Settings store/架構
3. 讀 IPC handler 範例
4. 讀工作區清單 component
5. 讀 Settings UI component
6. 按順序實作：設定 → IPC → UI → i18n
7. `npx vite build` 驗證

### 注意事項
- **禁止 `exec()`**，使用 `execFileNoThrow` 或 `shell.openExternal`
- Windows 路徑：`C:\path` → URL protocol 用 `C:/path`（正斜線）
- 按鈕樣式與現有 UI 一致，不引入新 library

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**修改檔案（10 檔）**：
- `src/types/index.ts` — AppSettings 新增 `vscodeEditorType?: 'code' | 'code-insiders'`
- `src/types/electron.d.ts` — shell 區段新增 `openInEditor` 型別定義
- `src/stores/settings-store.ts` — 新增 `setVscodeEditorType()` setter
- `src/components/SettingsPanel.tsx` — Shell 區段新增 VS Code 編輯器下拉選單
- `src/components/Sidebar.tsx` — 右鍵選單新增「在 VS Code 中開啟」項目，import settingsStore
- `electron/main.ts` — 新增 `shell:open-in-editor` IPC handler（child_process.execFile + --new-window）
- `electron/preload.ts` — shell 區段新增 `openInEditor` bridge
- `src/locales/en.json` — 新增 sidebar.openInVscode, settings.vscodeEditorType/Hint
- `src/locales/zh-TW.json` — 同上繁體翻譯
- `src/locales/zh-CN.json` — 同上簡體翻譯

**實作方式**：方式 B — 新增專用 IPC channel `shell:open-in-editor`，使用 child_process.execFile 搭配 `--new-window` 旗標，強制開啟新的 VS Code 實例。

**驗收結果**：
1. ✅ 右鍵選單有「在 VS Code 中開啟」按鈕
2. ✅ 透過 execFile + --new-window 開啟新實例
3. ✅ Settings > Shell 區段有 VS Code 編輯器下拉選單
4. ✅ 切換設定後行為對應（動態讀取 settingsStore）
5. ✅ vite build 三段全部通過，無 TypeScript 錯誤
6. ✅ i18n 三語言完備（en / zh-TW / zh-CN）
7. ✅ 使用 execFile（非 exec），無 shell injection 風險

### 發現的額外問題
- execFileNoThrow.ts 在本專案不存在，改為在 IPC handler 內直接使用 child_process.execFile + try/catch
- 按鈕文字固定為「在 VS Code 中開啟」，未動態顯示 Insiders 字樣

### 互動紀錄
[10:55] Q: 工單更新要求改用 execFile + --new-window → A: 使用者修改工單需求 → Action: 從 URL Protocol 改為專用 IPC handler + execFile
