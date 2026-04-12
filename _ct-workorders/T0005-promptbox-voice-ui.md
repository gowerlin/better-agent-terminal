# 工單 T0005-promptbox-voice-ui

## 元資料
- **工單編號**：T0005
- **任務名稱**：PromptBox 麥克風按鈕 + Alt+M 快捷鍵 + 錄音狀態 UI + RecordingService 端到端驗證
- **狀態**：DONE
- **類型**：IMPLEMENTATION(renderer 前端元件)
- **建立時間**：2026-04-11 00:02 (UTC+8)
- **開始時間**：2026-04-11 00:17 (UTC+8)
- **完成時間**：2026-04-11 00:35 (UTC+8)
- **前置工單**：T0003(IPC 骨架 + RecordingService 已建立)

## 平行工單警告

⚠️ **本工單與 T0004 可平行執行,但必須遵守檔案所有權規則**

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `src/components/PromptBox.tsx` | **T0005 獨占** | 本工單主要修改對象 |
| `src/components/voice/*`(新檔) | **T0005 獨占** | 麥克風按鈕、狀態指示等元件 |
| `src/hooks/useVoiceRecording.ts`(若建立) | **T0005 獨占** | 錄音狀態 hook |
| `src/lib/voice/*` | **共享唯讀** | T0003 產出,禁止修改 |
| `src/types/voice.ts` | **共享唯讀** | 禁止修改 |
| `src/types/electron.d.ts` | **共享唯讀** | 禁止修改 |
| `electron/voice-handler.ts` | **T0004 獨占** | **禁止本工單觸碰** |
| `electron/preload.ts` | **共享唯讀** | 禁止修改 |
| `package.json` | **T0004 獨占** | 禁止本工單修改 |

**若發現需要跨越邊界的修改,停下來回報,不要硬做**。

## 工作量預估
- **預估規模**:中
- **Context Window 風險**:中(需讀 PromptBox 既有結構、React 狀態管理模式)
- **降級策略**:若 Context Window 不足,優先完成 §1(麥克風按鈕 + 錄音 state machine)+ §2(Alt+M),§3(RecordingService 驗證)可延後

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 執行實作、build 驗證、**實際用麥克風測試**(這是 T0005 特有的需求)

---

## 任務指令

### 任務定位

本工單在 **PromptBox 元件中**加入麥克風按鈕和 Alt+M 快捷鍵,讓使用者可以:
1. 點麥克風按鈕(或按 Alt+M)→ 開始錄音
2. 再點一次(或再按 Alt+M)→ 停止錄音
3. 送 WAV buffer 到 IPC `voice:transcribe`
4. 拿到文字 → **暫時**以簡單方式顯示(例:直接填入 textarea 或顯示簡易 alert)
5. **預覽框 popover(T0006 的工作)** 不在本工單範圍,用最簡陋的 placeholder 替代

**重要**:T0004 可能還沒完成,所以 `voice:transcribe` 回的可能是 mock 文字(「這是 mock 辨識結果...」)。本工單只需確保 UI 流程跑通,**不需等 T0004 完成**。

**本工單同時要驗證 T0003 的 `RecordingService`**(T0003 未做的延後測試)。

---

### 前置條件

**必讀文件**:
- `CLAUDE.md`(特別注意 No Regressions、Logging、React Rendering 規範)
- `_ct-workorders/T0003-voice-ipc-foundation.md` 的產出清單(了解可用的 RecordingService API 和 ElectronAPI.voice 方法)
- `_learnings.md` L003(檔案路徑可驗證)— 自己 Glob/Grep 找實際位置

**必讀專案檔案**:
- `src/components/PromptBox.tsx`(**這是主要修改對象,先完整讀一遍**)
- `src/components/MainPanel.tsx`(了解 PromptBox 的渲染脈絡、條件式顯示邏輯)
- `src/lib/voice/recording-service.ts`(T0003 產出,知道 API)
- `src/lib/voice/index.ts`(barrel export)
- `src/types/voice.ts`(型別)
- 專案的既有鍵盤快捷鍵綁定實作(Glob 搜尋 `keyboard` / `shortcut` / `keydown` 看專案如何處理)— 若找不到既有 hook,可自己寫最簡單的 `useEffect` 綁 `window.addEventListener`

---

### 輸入上下文

**使用者確認的 UX 細節**:
- **麥克風按鈕位置**:PromptBox 內,與現有的送出按鈕、圖片貼上按鈕並列(依 T0001 §E 建議在 Paste 和 Send 之間)
- **按鈕模式**:**toggle**(點一下開始、再點一次結束),**不是** push-to-talk
- **快捷鍵**:`Alt+M`,同樣是 toggle
- **錄音狀態視覺回饋**:
  - Idle:正常麥克風圖示
  - Recording:紅色 + 呼吸動畫(pulse)+ 可選波形/計時顯示
  - Transcribing:loading spinner 或 disabled 狀態
- **模型未下載時**:麥克風按鈕 disabled + tooltip 顯示「請先在 Settings 下載語音模型」
- **錯誤處理**:
  - 麥克風權限被拒 → 明確錯誤訊息(toast / alert / inline message)
  - 辨識失敗 → 同上
  - 模型未下載 → tooltip 提示 + 禁用按鈕

**PromptBox 的特殊性**(來自記憶):
- PromptBox 在 `MainPanel` 條件渲染(agent terminal 才顯示,claude-code terminal 有自己 UI)
- 具備 slash/star 命令自動完成、圖片貼上、per-terminal 命令歷史
- **不要破壞這些既有功能**

---

### 工作範圍

#### §1 — 麥克風按鈕元件 + 錄音 state machine

**步驟**:

1. **建立元件**:`src/components/voice/MicButton.tsx`(或依專案元件組織慣例調整路徑)
   - Props:
     - `state`: `'idle' | 'recording' | 'transcribing' | 'disabled'`
     - `onClick`: `() => void`
     - `disabled?: boolean` 與 tooltip 訊息
   - 視覺:
     - 依 state 切換顏色與動畫
     - 使用專案既有的 icon library(Glob 搜尋 `lucide` / `react-icons` / 專案 icon 元件)
     - 若無 icon library,使用 SVG 或 emoji 🎤 作為 fallback
   - 無障礙:
     - `aria-label="開始語音輸入"` / `aria-label="停止錄音"`
     - `title` 提示快捷鍵資訊:「語音輸入(Alt+M)」

2. **建立狀態 hook**:`src/hooks/useVoiceRecording.ts`(或依專案組織方式調整)
   ```typescript
   // 設計草稿,sub-session 可依專案 hook style 調整

   type VoiceRecordingState = 'idle' | 'recording' | 'transcribing' | 'disabled';

   interface UseVoiceRecordingResult {
     state: VoiceRecordingState;
     error: string | null;
     lastTranscription: string | null;  // 最新辨識結果
     start: () => Promise<void>;
     stop: () => Promise<void>;
     cancel: () => void;
     toggle: () => void;  // Alt+M / 按鈕共用
     reset: () => void;   // 清除 error 和 lastTranscription
   }

   function useVoiceRecording(opts?: {
     onTranscribed?: (text: string) => void;
   }): UseVoiceRecordingResult;
   ```

   **內部邏輯**:
   - 使用 T0003 的 `RecordingService`
   - `start()`:
     - 檢查 `state === 'idle'`
     - 檢查 `window.electronAPI.voice.isModelDownloaded(preferredSize)` — 若 false → error + state `disabled`
     - 呼叫 `recordingService.start()`
     - state → `recording`
   - `stop()`:
     - `recordingService.stop()` → `ArrayBuffer`
     - state → `transcribing`
     - `window.electronAPI.voice.transcribe(buffer, 16000, undefined)` — 不傳 options,使用 main process 預設
     - 成功:state → `idle`,`lastTranscription` = text,觸發 `onTranscribed` callback
     - 失敗:state → `idle`,`error` = message
   - `toggle()`:依當前 state 決定 start/stop
   - `cancel()`:`recordingService.cancel()` + reset state
   - 使用 `window.electronAPI.debug.log` 記錄關鍵事件,**不用 `console.log`**

3. **整合到 PromptBox**:
   - 在 PromptBox 元件中 `useVoiceRecording`
   - 把 `MicButton` 放到送出按鈕旁(Paste 和 Send 之間,依 T0001 §E)
   - `onTranscribed` callback:**暫時**把文字 append 到 PromptBox 的 textarea value(直接填入),留一個明顯的 TODO 註解:
     ```tsx
     // TODO(T0006): 此處應改為顯示預覽框 popover,讓使用者確認後才填入 textarea
     onTranscribed: (text) => {
       // Phase 1 暫時行為:直接填入(無預覽確認)
       setValue((prev) => prev + text);
     }
     ```

**驗收**:
- [ ] `MicButton` 元件建立,三種狀態視覺正常
- [ ] `useVoiceRecording` hook 能被呼叫,state machine 正確運作
- [ ] PromptBox 顯示麥克風按鈕,不破壞既有佈局
- [ ] 辨識結果暫時以 append 到 textarea 方式呈現(有 TODO 註解)

---

#### §2 — Alt+M 快捷鍵綁定

**步驟**:

1. 在 `useVoiceRecording` hook 或 PromptBox 元件中,加入鍵盤事件監聽:
   ```typescript
   useEffect(() => {
     const handler = (e: KeyboardEvent) => {
       if (e.altKey && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
         e.preventDefault();
         toggle();
       }
     };
     window.addEventListener('keydown', handler);
     return () => window.removeEventListener('keydown', handler);
   }, [toggle]);
   ```

2. **衝突檢查**:
   - 確保當使用者在 textarea focus 時 Alt+M 仍然生效(不被 textarea 吃掉)
   - 確保不影響既有快捷鍵(slash command、star command、Shift+Enter 送出等)
   - 若 PromptBox 未 focus(例:在其他面板)→ 理論上仍觸發,但若有多個 terminal,只應觸發當前 active terminal 的 PromptBox
     - **建議**:只在 active 的 PromptBox 實例綁定事件,用 `isActive` prop 判斷

3. **MainPanel 的 active terminal 判斷**:
   - 讀 `MainPanel.tsx` 看如何決定哪個 terminal 是 active
   - 只有 active 的 PromptBox 才註冊 Alt+M 監聽器
   - 若找不到 active 判斷邏輯,暫時全部綁定(全部 active),並在回報區註記

**驗收**:
- [ ] Alt+M 能在 textarea focus 時觸發錄音
- [ ] Alt+M 不影響既有快捷鍵
- [ ] 再按 Alt+M 會停止錄音
- [ ] 只有當前 active 的 PromptBox 會響應(若可實作)

---

#### §3 — RecordingService 端到端真實驗證(T0003 延後的測試)

**步驟**:

1. 手動測試流程:
   a. `npm run dev`(或專案啟動指令)啟動 Electron app
   b. 進到一個 agent terminal,聚焦 PromptBox
   c. 點麥克風按鈕(或按 Alt+M)
   d. **允許麥克風權限**(首次會跳提示)
   e. 說話 3~5 秒(建議說「你好,這是一個測試」)
   f. 點麥克風按鈕(或 Alt+M)停止
   g. 觀察:
      - 錄音狀態視覺是否正確切換
      - Transcribing 狀態是否顯示
      - 文字最終是否 append 到 textarea(可能是 T0004 完成後的真實結果,或 T0003 的 mock 文字)
      - 是否有錯誤

2. 測試各種情境:
   - ✅ 正常錄音流程
   - ✅ 連續兩次錄音(測 state reset)
   - ✅ 錄音中按 Alt+M(toggle stop)
   - ✅ 模型未下載時點按鈕(應該 disabled 或顯示提示)
   - ✅ 拒絕麥克風權限(應該明確錯誤訊息)
   - ✅ 極短錄音(< 0.5 秒)— 會不會出錯?
   - ✅ 切換到其他 terminal 再回來,狀態是否正確

3. 記錄測試結果到回報區「手動測試結果」

**注意**:
- T0004 若尚未完成,`voice:transcribe` 會回 mock 文字(「這是 mock 辨識結果...」)— **這是預期的**
- 重點是**錄音流程本身**跑通,辨識真實性由 T0004 負責
- 若 T0004 已經完成(在你之前跑完),則可以順便驗證真實辨識結果

**驗收**:
- [ ] 成功錄製至少 1 次音訊
- [ ] 狀態切換視覺正確
- [ ] 錯誤情境處理正確(權限拒絕、模型未下載)
- [ ] 無 console.log 遺留

---

### 不在本工單範圍

- ❌ 不修改 `electron/` 下任何檔案
- ❌ 不修改 `package.json`
- ❌ 不實作**預覽框 popover**(T0006 的事)— 用最簡陋的 append to textarea 替代
- ❌ 不做 Settings 頁面(T0007)
- ❌ 不修 256 個既有 tsc 錯誤(Backlog)
- ❌ 不碰 `src/lib/voice/*` 或 `src/types/voice.ts`
- ❌ 不新增 npm 依賴(若真的需要,**停下回報**)

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全部通過
- [ ] **No Regression**:Electron app 啟動成功,既有 terminal / git / workspace / PromptBox 功能無破壞
- [ ] **PromptBox 既有功能**:slash command autocomplete、image paste、command history 全部正常
- [ ] **§1 麥克風按鈕**:`MicButton` 元件建立,三狀態視覺切換
- [ ] **§1 useVoiceRecording hook**:state machine 正確
- [ ] **§1 暫時 UX**:辨識結果 append 到 textarea,含 `TODO(T0006)` 註解
- [ ] **§2 Alt+M**:toggle 正確,不影響既有快捷鍵
- [ ] **§3 端到端**:成功錄製至少 1 次音訊(即使 T0004 未完成,用 mock 辨識結果也算過)
- [ ] **檔案所有權**:未修改任何「T0004 獨占」或「共享唯讀」路徑
- [ ] **日誌合規**:無 `console.log`,全用 `window.electronAPI.debug.log`
- [ ] **無障礙**:aria-label 和 title 齊備

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `CLAUDE.md`(React Rendering 規範特別注意 `flushSync` 用法 — 本工單的 `state` 切換**不屬於**該規範範圍,但要了解專案慣例)
3. **完整讀** `src/components/PromptBox.tsx`(了解既有結構)
4. **完整讀** `src/components/MainPanel.tsx`(了解 active terminal 判斷)
5. Glob 搜尋專案的鍵盤快捷鍵處理模式(`keydown` / `useKeyboard` / `hotkey` 等關鍵字)
6. Glob 搜尋專案的 icon library(`lucide` / `react-icons` / `svg` components)
7. 讀 `src/lib/voice/recording-service.ts` 和 `src/types/voice.ts`(知道可用 API)
8. 更新本工單「開始時間」欄位
9. **§1 → §2 → §3 順序**執行
10. 每個 § 完成後執行 `npx vite build` 驗證
11. §3 做完整的手動錄音測試
12. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **絕對不碰 `electron/` 或 `package.json`**:若真的需要,**停下來回報**
- **優先使用專案既有的 UI 模式**:不要引入新的 icon library 或 CSS 框架
- **不要破壞 PromptBox 既有功能**:slash command、image paste、command history 等必須全部繼續正常
- **如果 RecordingService 在真實測試時出問題**(麥克風抓不到、格式錯誤等):
  - 這是 T0003 產出的 bug
  - 記錄到回報區「遭遇問題」
  - **不要** fork `src/lib/voice/` 下的檔案自己改,而是**回報後等塔台決策**(可能要開修正工單)
- **如果 T0004 已經完成**(順序取決於使用者執行順序):
  - 可以順便驗證真實辨識結果
  - 但**不要**替 T0004 做額外修改(兩個工單是獨立的)
- **Alt+M 衝突檢查**:用 browser devtools 檢查 event bubbling,確認不會被任何既有 handler 攔截

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
PARTIAL

### 產出摘要

**新增檔案**:
- `src/hooks/useVoiceRecording.ts` — 錄音狀態 hook(state machine: idle → recording → transcribing → idle)
- `src/components/voice/MicButton.tsx` — 麥克風按鈕元件(3 狀態視覺 + aria-label + tooltip)

**修改檔案**:
- `src/components/PromptBox.tsx` — 整合 useVoiceRecording + MicButton + Alt+M 快捷鍵 + 新增 isActive prop
- `src/components/MainPanel.tsx` — 傳遞 isActive prop 到 PromptBox（1 行修改）
- `src/styles/prompt-box.css` — 新增 MicButton 樣式（recording pulse 動畫、transcribing spinner、error 顯示）

**新增的 React 元件與 hooks**:
- `MicButton` — 麥克風按鈕（idle/recording/transcribing/disabled 四狀態）
- `useVoiceRecording` — 錄音 state machine hook（start/stop/cancel/toggle/reset）

### 互動紀錄
無

### 遭遇問題
- §3 手動測試無法在此 session 中執行：本 session 為 CLI 終端環境，無法啟動 Electron GUI 進行麥克風錄音測試。需要使用者在本地執行 `npm run dev` 後手動驗證。
- 檔案所有權遵守：未觸碰任何 `electron/`、`package.json`、`src/lib/voice/*`、`src/types/voice.ts`、`src/types/electron.d.ts`

### 手動測試結果

**§3 RecordingService 端到端測試**:

| 情境 | 結果 | 備註 |
|------|------|------|
| 正常錄音 3~5 秒 | ⏳ 待使用者驗證 | 無法在 CLI session 中測試 |
| 連續兩次錄音 | ⏳ 待使用者驗證 | - |
| 錄音中 Alt+M 停止 | ⏳ 待使用者驗證 | - |
| 模型未下載時按按鈕 | ⏳ 待使用者驗證 | hook 有 isModelDownloaded 檢查 → disabled + error |
| 拒絕麥克風權限 | ⏳ 待使用者驗證 | RecordingError code='permission-denied' → 明確錯誤訊息 |
| 極短錄音 <0.5s | ⏳ 待使用者驗證 | - |
| 切 terminal 後回來 | ⏳ 待使用者驗證 | isActive prop 控制 Alt+M 綁定 |

**T0004 狀態**：未確認（本 session 未查看 T0004 完成情況）

### Build 驗證結果
`npx vite build` 三階段全部通過：
- ✅ renderer build: 2125 modules → 9.21s
- ✅ main process build: 20 modules → 1.10s
- ✅ preload build: 1 module → 20ms

### PromptBox 既有功能回歸驗證
- [x] Slash command autocomplete — 程式碼未修改，邏輯完整保留
- [x] Image paste — 程式碼未修改，邏輯完整保留
- [x] Command history — 程式碼未修改，邏輯完整保留
- [x] 送出按鈕 — 程式碼未修改，位置移到 MicButton 之後
- [x] Textarea 輸入與編輯 — 程式碼未修改
- 註：以上為程式碼審查確認，非 runtime 驗證

### 給 T0006 的備註
- `useVoiceRecording` hook 的 `lastTranscription` state 保存了最新辨識結果
- 目前 `onTranscribed` callback 直接 append 到 textarea（PromptBox L53-56）
- T0006 需要：
  1. 在 `onTranscribed` 時改為觸發 popover 而非直接 append
  2. Popover 顯示 `lastTranscription`，使用者確認後才填入 textarea
  3. 可利用 `voice.reset()` 清除 `lastTranscription`
  4. MicButton 放在 Paste 和 Send 按鈕之間，popover 建議從 MicButton 位置展開

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 00:35 (UTC+8)

---

## 塔台追認（Retroactive Reconciliation）

**追認時間**：2026-04-11 21:24 (UTC+8)
**追認決策者**：Control Tower
**原狀態**：PARTIAL（程式碼完成，runtime 麥克風測試延後到 T0011 整合測試）
**新狀態**：DONE

### 追認依據（下游證據）

1. **obs 9484**（2026-04-11 14:06）：「Phase 1 Voice Input Fully Implemented and Runtime Verified」— 明確記錄 Phase 1 語音輸入功能在 runtime 環境完整實作並驗證通過
2. **T0017-β AudioWorklet 遷移**：BUG-004 AudioContext 崩潰根因治本修復，runtime 通過，間接證明 PromptBox voice UI 的麥克風路徑正常
3. **T0020 packaged build 驗證**：BUG-006 修復後 voice UI 在 packaged build 中 runtime 通過
4. **後續多輪 dogfood session**：PromptBox voice UI 已被使用者在多次 runtime session 中實際操作並通過

### 結論
T0005 的原 PARTIAL 理由（runtime 麥克風測試延後）已在 Phase 1 運行驗證階段被實質涵蓋。原回報區內容（程式碼審查確認，非 runtime 驗證）**保留不動**作為 2026-04-11 00:35 當時的歷史證據；塔台依下游證據追認為 DONE。

### 保留未驗項目
無。Phase 1 整合驗證已涵蓋所有原延後項目。
