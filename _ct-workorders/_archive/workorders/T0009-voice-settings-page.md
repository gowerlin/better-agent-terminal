# 工單 T0009-voice-settings-page

## 元資料
- **工單編號**：T0009
- **任務名稱**：Settings 頁語音輸入區塊 — 模型管理(下載/刪除/進度)+ 語言偏好(zh/en/auto)+ 預設模型選擇 + 繁簡轉換開關
- **狀態**：DONE
- **類型**：IMPLEMENTATION(renderer 前端元件)
- **建立時間**：2026-04-11 01:26 (UTC+8)
- **開始時間**：2026-04-11 01:29 (UTC+8)
- **完成時間**：2026-04-11 01:42 (UTC+8)
- **前置工單**：T0003(IPC)、T0004(真實模型下載 + 偏好持久化)

## 工作量預估
- **預估規模**：中~大
- **Context Window 風險**：中(需找現有 Settings UI、整合多個 IPC 呼叫、處理下載進度事件)
- **降級策略**：若 Context Window 不足,優先完成 §1(基本架構)+ §2(模型列表 + 偏好),§3(下載進度即時追蹤)可延後;§4(繁簡開關 + metadata 顯示)可標記 PARTIAL

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 執行實作與 build 驗證

## 檔案所有權

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| 現有 Settings 頁檔案(sub-session 自行找) | **T0009 可修改** | 新增「語音輸入」區塊 |
| `src/components/voice/VoiceSettingsSection.tsx`(新) | **T0009 獨占** | 語音設定元件 |
| `src/hooks/useVoiceModels.ts`(新,可選) | **T0009 獨占** | 模型列表與進度狀態 hook(若需要) |
| `src/styles/*` | **T0009 可擴充** | 新增 voice settings 樣式 |
| `src/components/PromptBox.tsx` | **禁止** | T0007 剛改完 |
| `src/components/voice/MicButton.tsx` | **禁止** | T0005 產出 |
| `src/components/voice/VoicePreviewPopover.tsx` | **禁止** | T0007 產出 |
| `src/hooks/useVoiceRecording.ts` | **禁止** | T0005/T0007 共同使用 |
| `electron/**` | **禁止** | 不碰 main process |
| `src/lib/voice/*` | **唯讀** | T0003 產出 |
| `src/types/voice.ts` | **唯讀** | T0003 產出 |
| `src/types/electron.d.ts` | **唯讀** | T0003 產出 |

---

## 任務指令

### 任務定位

實作 Settings 頁的「語音輸入」區塊,讓使用者可以:
1. **下載 / 刪除 / 切換** whisper 模型(tiny / base / small / medium)
2. **即時查看下載進度**(用 `voice:modelDownloadProgress` 事件)
3. **設定預設模型**(預設 small)
4. **設定預設語言**(zh / en / auto,預設 zh)
5. **切換繁簡轉換**(預設 on)
6. **(可選)查看 metadata**:模型儲存路徑、上次辨識耗時等

完成後,使用者才能**真正跑通語音功能**(T0005 的 `isModelDownloaded` 防禦啟動時需要使用者能從 Settings 下載)。

---

### 前置條件

**必讀文件**:
- `CLAUDE.md`(No Regressions、Logging、React Rendering 規範)
- `_ct-workorders/reports/T0001-voice-input-tech-research.md` §E「Settings 頁語音輸入區塊」段落(原設計參考)
- `_ct-workorders/T0003-voice-ipc-foundation.md` 回報區的「匯出的常數/型別」(知道可用 API)
- `_ct-workorders/T0004-whisper-integration.md` 回報區的「給 T0006/T0007/T0009 的備註」(特別是 MODEL_CATALOGUE 精確尺寸、HuggingFace redirect、並行下載防護等)

**必讀專案檔案**:
- `src/types/voice.ts`(型別:`WhisperModelSize`、`VoiceLanguage`、`VoiceModelInfo`、`VoicePreferences`、`VoiceModelDownloadProgress`)
- `src/types/electron.d.ts`(`ElectronAPI.voice.*` 介面)
- 現有的 Settings UI(Glob 搜尋:`Settings` / `Preferences` / `Config*`,可能在 `src/components/` 或 `src/views/` 或 `src/pages/`)
- 現有的 modal / drawer / tab panel 元件(若 Settings 是 modal 或 sidebar)

**必讀已完成的語音元件**(了解風格一致性):
- `src/components/voice/MicButton.tsx`(T0005)
- `src/components/voice/VoicePreviewPopover.tsx`(T0007)

---

### 輸入上下文

**使用者確認的需求**(來自 Q1~Q8 + §G):
- Q7 模型大小:使用者可選 tiny / base / small / medium,**預設 small**
- Q8 下載策略:**Settings 頁手動下載**(不自動),未下載前 MicButton 禁用
- Q8 語言偵測:**預設 zh**,可手動切到 en / auto
- Q2 繁中為主 + 英文:**OpenCC 繁簡轉換預設 ON**

**T0004 給的精確模型尺寸**(從 HuggingFace HEAD request 驗證):
- tiny:77.7 MB
- base:141 MB
- small:466 MB(推薦)
- medium:1.43 GB

**T0004 給的 IPC 行為細節**:
- `downloadModel(size)` 會 throw 若同一 size 已在下載中
- `cancelDownload(size)` 會中斷並清 `.downloading` 暫存檔
- `voice:modelDownloadProgress` 事件 schema:`{ size, bytesDownloaded, totalBytes, percent }`,250ms 節流
- `scanDownloadedModels()` 每次呼叫 `listModels()` 都會自動掃描 — 所以下載完成或刪除後重新呼叫即可更新狀態

**T0003 給的常數**:
- `getVoiceModelsDir()` → `{userData}/whisper-models/`
- `DEFAULT_VOICE_PREFERENCES = { modelSize: 'small', language: 'zh', convertToTraditional: true }`

---

### 工作範圍

#### §1 — 基本架構:找到現有 Settings 頁並新增「語音輸入」區塊

**步驟**:

1. **找到現有 Settings UI**(使用 Glob + Grep,**不要假設路徑**)
   - 可能位置:`src/components/Settings*`、`src/views/Settings*`、`src/pages/Settings*`、`src/components/*/Settings*`
   - 可能是 modal、drawer、side panel、分頁、或獨立路由
   - 讀取 2~3 個現有區塊作為風格參考

2. **新增「語音輸入」section**:
   - 遵循現有 Settings 的區塊樣式(卡片、標題、分隔線等)
   - 區塊標題:「🎤 語音輸入」或「Voice Input」(依專案語言慣例,本專案用繁中)
   - 內部結構(4 個子區域):
     - **A. 模型管理**
     - **B. 語言偏好**
     - **C. 繁簡轉換**
     - **D. 儲存位置**(只讀顯示)

3. **建立新元件檔**:`src/components/voice/VoiceSettingsSection.tsx`
   - 自包含的元件,接受 optional props(若 Settings 頁需要傳入)
   - 內部管理所有狀態與 IPC 呼叫
   - 可重用到其他 Settings 頁面(若將來需要)

**驗收**:
- [ ] 找到現有 Settings UI 並確認整合點
- [ ] 新 section 顯示在 Settings 頁,不破壞既有區塊
- [ ] 樣式與既有區塊一致

---

#### §2 — 模型管理 UI + 偏好設定載入/儲存

**A. 模型列表**:

- 載入時呼叫 `window.electronAPI.voice.listModels()` 取得 4 個模型的狀態
- 顯示表格(或卡片):

| 模型 | 大小 | 狀態 | 動作 |
|------|------|------|------|
| Tiny | 77.7 MB | ✅ 已下載 / ⏳ 未下載 / 🔄 下載中 40% | [刪除] / [下載] / [取消] |
| Base | 141 MB | ... | ... |
| Small(推薦) | 466 MB | ... | ... |
| Medium | 1.43 GB | ... | ... |

- **下載按鈕**:點擊 → `voice.downloadModel(size)` → 立即切到下載中狀態
- **取消按鈕**:下載中顯示 → `voice.cancelDownload(size)` → 狀態回到未下載
- **刪除按鈕**:已下載時顯示 → confirm 對話框(可用 `window.confirm` 或專案既有的 confirm 元件)→ `voice.deleteModel(size)` → 狀態更新
- 下載失敗的錯誤訊息顯示在模型列旁邊

**B. 預設模型選擇**:

- Radio group 或 dropdown(依現有 Settings 風格)
- 選項:tiny / base / small / medium
- **只有已下載的模型才能被選為預設**(未下載的 option 禁用 + tooltip 提示「請先下載」)
- 變更時呼叫 `voice.setPreferences({ modelSize: newSize })`
- 預設值從 `voice.getPreferences()` 載入

**C. 偏好持久化流程**:

- 初始載入:`useEffect` 或類似機制呼叫 `getPreferences()` 填入 state
- 變更時:debounce 或立即呼叫 `setPreferences()`(兩者皆可,依體驗選擇)
- **重要**:T0003 的 `setPreferences` 已經是真實持久化(寫 JSON 到 userData),不用自己做

**驗收**:
- [ ] 載入時正確顯示 4 個模型的下載狀態
- [ ] 下載 / 刪除 / 取消按鈕功能正常(code-level 驗證)
- [ ] 預設模型變更會寫入偏好設定
- [ ] 未下載模型不能被選為預設

---

#### §3 — 下載進度即時追蹤

**使用 `voice:modelDownloadProgress` 事件**:

- 在元件 mount 時訂閱:
  ```typescript
  useEffect(() => {
    const unsubscribe = window.electronAPI.voice.onModelDownloadProgress((progress) => {
      // progress: { size, bytesDownloaded, totalBytes, percent }
      setDownloadProgress(prev => ({ ...prev, [progress.size]: progress }));
    });
    return unsubscribe;  // 清理
  }, []);
  ```

- 顯示進度:
  - 進度條(使用現有專案的 progress bar 元件或 HTML `<progress>` 或 CSS 簡單實作)
  - 數字顯示:`40%` 或 `186 MB / 466 MB`
  - 若 T0004 送來的 `totalBytes` 為 0(極罕見),改顯示「下載中...」不顯示百分比

- 下載完成偵測:
  - 當 `percent >= 100` 時,呼叫 `voice.listModels()` 重新掃描
  - 更新模型狀態為「已下載」
  - 清除該 size 的 downloadProgress entry

- 下載失敗偵測:
  - IPC `downloadModel` 的 promise reject 時
  - 清除 downloadProgress
  - 顯示錯誤訊息(可讀的,不要技術 stack trace)

**驗收**:
- [ ] 進度條隨事件更新(code-level 驗證:確認事件 handler 連接正確、state 更新邏輯正確)
- [ ] 下載完成後模型狀態自動更新
- [ ] 下載失敗有明確錯誤訊息
- [ ] 取消下載後進度條消失

---

#### §4 — 語言偏好 + 繁簡轉換開關 + 儲存位置顯示

**B 語言偏好**:
- Radio group 或 dropdown:`zh(繁中)` / `en(English)` / `auto(自動偵測)`
- 預設 `zh`
- 變更時呼叫 `voice.setPreferences({ language: newLang })`
- **注意 T0004 陷阱**:whisper-node-addon `language: undefined` 會 throw → 但 Settings 層 `language: 'auto'` 是字串,main process 的 `voice-handler.ts` 已處理 auto 的分支,不用擔心

**C 繁簡轉換開關**:
- Checkbox 或 Toggle:「將辨識結果自動轉為繁體中文」
- 預設 ON(來自 `DEFAULT_VOICE_PREFERENCES.convertToTraditional = true`)
- 變更時呼叫 `voice.setPreferences({ convertToTraditional: newValue })`
- Tooltip:「Whisper 的 zh 語言預設輸出簡體,此選項啟用時會透過 OpenCC 轉為繁體」

**D 儲存位置顯示**(唯讀資訊):
- 呼叫 `voice.getModelsDirectory()` 取得路徑
- 顯示:「模型儲存位置:`C:\Users\...\whisper-models\`」
- 可選 bonus:[開啟資料夾] 按鈕
  - 若專案既有開資料夾 API(例:`window.electronAPI.shell.openPath`)則用之
  - 若沒有則跳過 bonus,只顯示路徑

**驗收**:
- [ ] 語言選擇正確儲存
- [ ] 繁簡開關正確儲存
- [ ] 儲存位置正確顯示
- [ ] (bonus) 開資料夾按鈕功能正常(若有實作)

---

### 不在本工單範圍

- ❌ 不動 `electron/` 任何檔案
- ❌ 不動 `package.json`
- ❌ 不動 PromptBox / MicButton / VoicePreviewPopover / useVoiceRecording
- ❌ 不修 256 個既有 tsc 錯誤
- ❌ 不處理 BUG-002(T0008)
- ❌ 不做 macOS 麥克風權限設定(T0010)
- ❌ **不改 voice-handler.ts 或新增 IPC 方法**(全部用 T0003/T0004 已暴露的 API)

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全通過
- [ ] **No Regression**:Electron app 啟動成功,既有 Settings 頁功能未破壞
- [ ] **§1 基本架構**:新 section 顯示在 Settings 頁,樣式與既有區塊一致
- [ ] **§2 模型管理**:4 個模型正確載入,下載/刪除/取消按鈕邏輯正確
- [ ] **§2 偏好持久化**:變更後重啟 app 仍保留(code-level 確認 setPreferences 呼叫正確)
- [ ] **§3 下載進度**:進度事件訂閱邏輯正確,state 更新邏輯正確
- [ ] **§4 語言偏好**:三個選項可切換
- [ ] **§4 繁簡開關**:toggle 可切換
- [ ] **§4 儲存位置**:正確顯示
- [ ] **檔案所有權**:未觸碰禁止區
- [ ] **日誌合規**:無 `console.log`,用 `window.electronAPI.debug.log`
- [ ] **錯誤處理**:所有 IPC 呼叫都有 try/catch,錯誤訊息使用者可讀
- [ ] **未下載模型**:不能被選為預設,有明確提示

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `CLAUDE.md`
3. **Glob 搜尋**現有 Settings UI(不要假設路徑,L003 教訓)
4. 讀取找到的 Settings 頁檔案 + 2~3 個既有區塊(了解風格)
5. 讀取 `src/types/voice.ts` + `src/types/electron.d.ts`(型別 + 可用 API)
6. 讀取 `src/components/voice/MicButton.tsx` + `VoicePreviewPopover.tsx`(風格一致性)
7. 更新「開始時間」欄位
8. **§1 → §2 → §3 → §4 順序**執行
9. 每個 § 完成後執行 `npx vite build` 驗證
10. Code-level 驗證狀態切換路徑(因為 runtime 驗證延後到 T0011)
11. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **找不到現有 Settings 頁時**:若專案還沒有 Settings 頁,**停下回報**,不要自己建一個新的 Settings 頁(可能需要與使用者討論 Settings 頁的路由/觸發方式)
- **下載進度 event cleanup**:mount 訂閱的 event listener 在 unmount 時**必須** unsubscribe,避免 memory leak
- **並行下載**:T0004 支援**不同 size 並行下載**,但同一 size 不可。UI 層的防護:若一個 size 已在下載,按鈕改為「取消」而非「下載」
- **尺寸單位**:顯示時用 MB / GB,不要裸露 bytes(已知 T0004 的 diskSize 是 bytes 數字)
- **確認對話框**:刪除模型前一定要 confirm,使用 `window.confirm` 或專案既有 confirm 元件
- **headless 環境**:runtime 驗證延後到 T0011,本工單做 code-level 驗證即可。狀態管理邏輯清楚就算通過
- **錯誤處理**:所有 async 函式都包 try/catch,錯誤顯示給使用者(toast / inline message / alert 都可)
- **不要安裝新 npm 依賴**:若真的需要,停下回報

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新增檔案**:
- `src/components/voice/VoiceSettingsSection.tsx` — 語音設定自包含元件（模型管理、偏好設定、下載進度、繁簡轉換、儲存位置）

**修改檔案**:
- `src/components/SettingsPanel.tsx` — import VoiceSettingsSection + 在 Environment Variables section 前新增 `<VoiceSettingsSection />`
- `src/styles/settings.css` — 新增 voice-model-list、voice-model-row、voice-progress-bar、voice-radio-group 等 CSS 樣式

### 互動紀錄
無

### 遭遇問題
無

### 找到的 Settings 頁位置
`src/components/SettingsPanel.tsx` — modal overlay（`.settings-overlay` > `.settings-panel`），使用 `settings-section` > `h3` + `settings-group` 結構。整合方式：在 Environment Variables section 前插入 `<VoiceSettingsSection />`。

### Build 驗證結果
`npx vite build` 三階段全部通過：
- renderer: ✓ 2127 modules transformed, built in 9.24s
- main: ✓ 28 modules transformed, built in 1.15s
- preload: ✓ 1 module transformed, built in 20ms

### 狀態切換路徑驗證(code-level)

| 操作 | 預期行為 | 實際驗證 |
|------|---------|---------|
| 載入 Settings 頁 | 顯示 4 個模型 + 當前偏好 | ✅ useEffect 呼叫 listModels + getPreferences + getModelsDirectory 並設定 state |
| 點下載按鈕 | 狀態切到下載中,開始收事件 | ✅ handleDownload 設定 downloadingRef + 呼叫 downloadModel，UI 根據 getModelStatus 顯示 |
| 下載進度事件 | 進度條更新 | ✅ onModelDownloadProgress 更新 downloadProgress state → 進度條 width style 綁定 percent |
| 下載完成 | 模型狀態切到已下載 | ✅ percent >= 100 時呼叫 listModels 刷新，清除 downloadProgress entry |
| 點取消下載 | 中斷 + 狀態回復 | ✅ handleCancel 呼叫 cancelDownload + 清除 downloadingRef + progress，refreshModels |
| 點刪除 | confirm → 刪除 → 狀態更新 | ✅ window.confirm → deleteModel → refreshModels + getPreferences |
| 切換預設模型 | 偏好儲存 | ✅ handleSetDefaultModel 呼叫 setPreferences({ modelSize }) → 未下載 radio disabled |
| 切換語言偏好 | 偏好儲存 | ✅ handleSetLanguage 呼叫 setPreferences({ language }) |
| 切換繁簡開關 | 偏好儲存 | ✅ handleToggleTraditional 呼叫 setPreferences({ convertToTraditional }) |

### 給 T0010 / T0011 的備註
1. **VoiceSettingsSection 是自包含元件**：所有 state 和 IPC 呼叫都在元件內部，不依賴外部 props
2. **Event cleanup 已實作**：onModelDownloadProgress 的 unsubscribe 在 unmount 時呼叫
3. **shell.openPath 已存在**：用於「開啟資料夾」按鈕，直接呼叫 `window.electronAPI.shell.openPath`
4. **debug log 使用 optional chaining**：`window.electronAPI.debug?.log?.()` 防止 debug namespace 不存在時 crash
5. **CSS 遵循既有 settings.css 風格**：使用 CSS variables（--bg-tertiary、--text-primary 等），不引入新依賴

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 01:42 (UTC+8)
