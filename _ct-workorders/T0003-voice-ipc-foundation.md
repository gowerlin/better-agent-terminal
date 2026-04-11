# 工單 T0003-voice-ipc-foundation

## 元資料
- **工單編號**：T0003
- **任務名稱**：語音輸入 IPC 基礎設施 — ElectronAPI.voice 型別定義 + preload bridge + main process stub handlers + renderer 錄音服務
- **狀態**：DONE
- **類型**：IMPLEMENTATION / FOUNDATION（基礎設施工單，可真實合併到主專案）
- **建立時間**：2026-04-10 23:32 (UTC+8)
- **開始時間**：2026-04-10 23:38 (UTC+8)
- **完成時間**：2026-04-10 23:53 (UTC+8)
- **前置工單**：T0001（研究）、T0002（PoC，確認 whisper-node-addon file-based API 可用）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀 preload.ts / main.ts / electron.d.ts、修改多個檔案）
- **降級策略**：若 Context Window 不足，優先完成 Part A（類型 + IPC bridge）與 Part B（mock handlers），Part C（renderer 錄音服務）可標記 PARTIAL 並開接續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：fresh context 執行實作、build 驗證、避免汙染塔台

---

## 任務指令

### 任務定位

本工單建立語音輸入功能的**IPC 骨架**，為後續工單解開阻塞：
- **T0004**（whisper 整合）可替換掉本工單的 mock handlers
- **T0005**（PromptBox UI）可依賴本工單的 `window.electronAPI.voice.*` 介面開工
- **T0007**（Settings 頁）可依賴本工單的 preferences API 開工

**本工單的輸出必須能 build 通過、型別完整、可被 renderer 呼叫**（即使 handlers 是 mock）。

---

### 前置條件

**必讀文件**：
- `CLAUDE.md`（專案規範，**特別注意**以下幾條）：
  - 「No Regressions Policy」 — 不得破壞現有功能，完成後必須跑 `npx vite build` 驗證
  - 「Logging」 — Frontend 用 `window.electronAPI.debug.log(...)`，Backend 用 `logger.log(...)` / `logger.error(...)`，**禁止** `console.log`
- `_ct-workorders/reports/T0001-voice-input-tech-research.md` §D（Electron IPC 架構設計）— 作為 API 設計參考，**但以 T0002 實測結論為準**
- `_ct-workorders/reports/T0002-whisper-node-addon-poc.md`（特別是 §關鍵發現）— 了解 whisper-node-addon 的**實際能力**（file-based only、無 streaming、無 GPU）

**必讀專案檔案**（找到實際路徑，**不要假設路徑正確**）：
- 電子類型定義（可能位於 `src/types/electron.d.ts` 或類似位置）
- Electron preload 腳本（可能位於 `electron/preload.ts` 或 `src/preload.ts`）
- Electron main process 入口（可能位於 `electron/main.ts`）
- PromptBox 元件（確認其渲染脈絡，了解錄音功能要掛載在哪）

---

### 輸入上下文

**重要決策背景**：

T0002 PoC 實測後發現 whisper-node-addon 不支援 streaming 也不支援 GPU，塔台採「Option B 降級接受」策略：
- **Phase 1**：whisper-node-addon file-based 模式（錄完 → loading → 完整結果 → 預覽框）
- **Phase 1.5**：之後評估 Route B（whisper.cpp binary）補強 streaming + GPU

**這對 IPC 設計的影響**：
- **不需要** streaming 相關的 IPC event（`onPartialResult` 等）
- **不需要** audio level / 錄音中 visualization 的 IPC（可由 renderer 自行處理 Web Audio API）
- **需要** 一個 `transcribe(audioBuffer, options)` 的 request/response 型 IPC
- **需要** 模型管理 API（list / download / delete / isDownloaded）
- **需要** preferences API（get/set model size, language）

**使用者已確認的需求**：
- 預設語言：繁中（zh）
- 支援語言切換：zh / en / auto
- 預設模型：small
- 模型儲存：`{userData}/whisper-models/`
- 模型下載策略：使用者在 Settings 頁手動按下載

**繁簡中問題**（T0002 發現）：
whisper 的 `language: 'zh'` 輸出簡體中文，需要後處理繁簡轉換。**本工單不處理**（由 T0004 處理，T0004 會引入 OpenCC），但型別設計要**預留**繁簡轉換選項（例：`TranscribeOptions.convertToTraditional?: boolean`）。

---

### 工作範圍

#### Part A：型別系統設計與定義

在專案的 Electron 型別定義檔（自行找到正確路徑）中，新增 `voice` 命名空間。

**必須定義的型別**：

```typescript
// 以下為設計草稿，sub-session 可依專案 coding style 調整命名慣例

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium';

export type VoiceLanguage = 'zh' | 'en' | 'auto';

export interface VoiceModelInfo {
  size: WhisperModelSize;
  displayName: string;        // 例：'Small (466 MB, 推薦)'
  diskSize: number;           // bytes
  downloaded: boolean;
  path?: string;              // 已下載時的檔案路徑
}

export interface VoiceTranscribeOptions {
  modelSize?: WhisperModelSize;   // 未指定則用使用者偏好
  language?: VoiceLanguage;        // 未指定則用使用者偏好
  convertToTraditional?: boolean;  // 繁簡轉換，預設 true（本工單 mock 不實作）
  initialPrompt?: string;          // 可選的 prompt engineering
}

export interface VoiceTranscribeResult {
  text: string;
  detectedLanguage?: string;       // Whisper 自動偵測到的語言
  durationMs: number;               // 音訊長度
  inferenceTimeMs: number;          // 辨識耗時
}

export interface VoicePreferences {
  modelSize: WhisperModelSize;     // 預設 'small'
  language: VoiceLanguage;         // 預設 'zh'
  convertToTraditional: boolean;   // 預設 true
}

export interface VoiceModelDownloadProgress {
  size: WhisperModelSize;
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
}

// ElectronAPI 擴充（加入現有 ElectronAPI interface）
voice: {
  // 模型管理
  listModels(): Promise<VoiceModelInfo[]>;
  isModelDownloaded(size: WhisperModelSize): Promise<boolean>;
  downloadModel(size: WhisperModelSize): Promise<void>;  // 進度透過 event
  deleteModel(size: WhisperModelSize): Promise<void>;
  cancelDownload(size: WhisperModelSize): Promise<void>;

  // 偏好設定
  getPreferences(): Promise<VoicePreferences>;
  setPreferences(prefs: Partial<VoicePreferences>): Promise<VoicePreferences>;

  // 辨識
  transcribe(
    audioBuffer: ArrayBuffer,
    sampleRate: number,
    options?: VoiceTranscribeOptions
  ): Promise<VoiceTranscribeResult>;

  // 事件訂閱（使用既有專案 pattern,可能是 onXxx(cb) 或其他形式）
  onModelDownloadProgress(cb: (progress: VoiceModelDownloadProgress) => void): () => void;
  // 回傳 unsubscribe 函式
}
```

**驗收**：
- [ ] 所有型別可以被 renderer import 使用
- [ ] `window.electronAPI.voice` 在 TypeScript 型別檢查下**完全通過**
- [ ] `npx vite build` 不報錯

---

#### Part B：Preload Bridge + Main Process Mock Handlers

**Preload (`electron/preload.ts` 或類似路徑)**：

依照專案既有的 `ipcRenderer.invoke(...)` 模式擴充 `voice` 命名空間。所有方法都走 `ipcRenderer.invoke`，除了事件訂閱用 `ipcRenderer.on`。

**Main Process Mock Handlers**：

建立新檔案：`electron/voice-handler.ts`（或依專案 IPC handler 組織慣例，可能是 `electron/handlers/voice.ts` 等）

本工單的 handlers **回傳 mock 資料**，讓 UI 層可以獨立開發：

```typescript
// 範例 mock 實作精神

ipcMain.handle('voice:listModels', async () => {
  return [
    { size: 'tiny', displayName: 'Tiny (39 MB)', diskSize: 39_000_000, downloaded: false },
    { size: 'base', displayName: 'Base (142 MB)', diskSize: 142_000_000, downloaded: false },
    { size: 'small', displayName: 'Small (466 MB, 推薦)', diskSize: 466_000_000, downloaded: false },
    { size: 'medium', displayName: 'Medium (1.5 GB)', diskSize: 1_500_000_000, downloaded: false },
  ];
});

ipcMain.handle('voice:transcribe', async (_e, audioBuffer, sampleRate, options) => {
  // Mock:延遲 1 秒,回傳假文字
  await new Promise(r => setTimeout(r, 1000));
  logger.log(`[voice] Mock transcribe: ${audioBuffer.byteLength} bytes @ ${sampleRate}Hz`);
  return {
    text: '這是 mock 辨識結果(T0004 會替換成真實 whisper 實作)',
    detectedLanguage: 'zh',
    durationMs: 3000,
    inferenceTimeMs: 1000,
  };
});

// ... 其他 handlers 類似 mock
```

**偏好設定儲存**：

`voice.getPreferences()` / `setPreferences()` 需要**真的持久化**(不是 mock),用專案既有的 workspace persistence 機制(找找看是不是用 electron-store、JSON 檔案、或其他)。

若找不到既有機制:
- 簡單方案:`app.getPath('userData') + '/voice-preferences.json'`
- 使用 `fs.promises` 讀寫
- 預設值:`{ modelSize: 'small', language: 'zh', convertToTraditional: true }`

**模型檔案路徑約定**:

雖然本工單不實作真實下載,但要在 main process handler 中確立**約定的模型路徑**:
```typescript
// 範例
const modelsDir = path.join(app.getPath('userData'), 'whisper-models');
// 模型檔案:{modelsDir}/ggml-{size}.bin
```

將此路徑以常數形式匯出,讓 T0004 可直接重用。

**日誌規範**:
- 所有 main process 日誌使用 `logger.log(...)` / `logger.error(...)`,不得用 `console.log`
- 每個 handler 進入時記錄一條日誌(便於 T0004 debugging)

**驗收**:
- [ ] IPC handlers 註冊成功(Electron app 啟動時無錯誤)
- [ ] renderer 呼叫 `window.electronAPI.voice.listModels()` 能回傳 mock 資料
- [ ] `setPreferences` 寫入檔案後,`getPreferences` 可讀回(真實持久化)
- [ ] 模型路徑常數已定義並匯出

---

#### Part C:Renderer 錄音服務(getUserMedia + WAV 編碼)

**目標**:在 renderer 側封裝「錄音 → 產生 PCM/WAV buffer」的流程,讓 T0005(UI)可以直接呼叫。

**檔案位置建議**:`src/lib/voice/` 或 `src/services/voice/`(依專案既有 lib 組織慣例)

**需要的元件**:

1. **`RecordingService`**(或 class / hook / 其他符合專案風格的形式):
   ```typescript
   class RecordingService {
     start(): Promise<void>;      // 取得麥克風權限,開始錄音
     stop(): Promise<ArrayBuffer>; // 停止錄音,回傳 WAV buffer(或 PCM + sampleRate)
     cancel(): void;              // 取消錄音,不回傳
     get state(): 'idle' | 'recording' | 'stopping';
   }
   ```

2. **WAV 編碼工具**(可選獨立檔案):
   - 將 getUserMedia 的 Float32 PCM 資料編碼為 16-bit PCM WAV
   - 目標 sample rate:**16 kHz**(whisper 要求)
   - 若原始 sample rate 不是 16 kHz,需要 downsample
   - 輸出:`ArrayBuffer`(WAV 格式,含 header)

**技術細節**:
- 使用 `navigator.mediaDevices.getUserMedia({ audio: true })`
- 使用 `AudioContext` + `AudioWorkletNode`(較現代)**或** `MediaRecorder`(簡單但格式不可控)
- **建議**:使用 `AudioContext` + `ScriptProcessorNode` 或 `AudioWorkletNode`,直接抓 Float32Array,自行編碼 WAV,最可控
- **不要**用 `MediaRecorder`,因為它輸出 `audio/webm` 或 `audio/ogg`,不方便送給 whisper

**權限處理**:
- 首次呼叫 `start()` 時會觸發麥克風權限請求
- 若使用者拒絕,丟出明確的 error
- **Electron main process 設定**:檢查是否需要 `session.setPermissionRequestHandler` 允許麥克風(本工單可先寫 handler 允許,但若既有 session 設定已處理則不重複)

**日誌**:
- 使用 `window.electronAPI.debug.log(...)` 記錄關鍵事件(start、stop、cancel、error)
- **不得**用 `console.log`

**手動驗證方式**(給 sub-session 自我驗證):
- 在一個臨時測試頁面(例:在 App.tsx 加一個臨時按鈕,或新增測試路由)加入:
  ```tsx
  <button onClick={async () => {
    const service = new RecordingService();
    await service.start();
    setTimeout(async () => {
      const buf = await service.stop();
      await window.electronAPI.debug.log(`Got ${buf.byteLength} bytes`);
      // 可用 window.electronAPI.voice.transcribe(buf, 16000) 測試 IPC(會回 mock 結果)
    }, 3000);
  }}>Test Recording</button>
  ```
- 點按鈕 → 說話 3 秒 → 看 log 是否有 WAV buffer 產生
- 本測試按鈕**本工單完成後要移除**(不進入 production UI),但保留 `RecordingService` 本身

**驗收**:
- [ ] `RecordingService` 能成功取得麥克風權限
- [ ] `start() → stop()` 能產生有效的 WAV ArrayBuffer
- [ ] 手動測試記錄一段音訊,檔案長度合理(3 秒音訊約 96 KB for 16kHz mono 16-bit)
- [ ] 無 `console.log` 遺留
- [ ] 臨時測試按鈕已移除

---

### 不在本工單範圍

以下項目**不要**在本工單處理(後續工單負責):
- ❌ 實際安裝 `whisper-node-addon` 套件(T0004)
- ❌ 真實的模型下載邏輯(T0004)
- ❌ OpenCC 繁簡轉換(T0004)
- ❌ PromptBox 內的麥克風按鈕 UI(T0005)
- ❌ 預覽框 popover 元件(T0006)
- ❌ Settings 頁面 UI(T0007)
- ❌ Alt+M 快捷鍵綁定(T0005)
- ❌ macOS `NSMicrophoneUsageDescription`(T0008)

若遇到這些範圍的工作,**停下來記錄到回報區**,不要越界。

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 成功,無型別錯誤、無 lint 錯誤
- [ ] **No Regression**:Electron app 啟動成功,既有功能(terminal、git、workspace 等)無破壞
- [ ] **Part A 型別**:`window.electronAPI.voice.*` 的所有方法在 TypeScript 有完整型別提示
- [ ] **Part B Mock IPC**:在 renderer devtools console(或測試按鈕)呼叫 `window.electronAPI.voice.listModels()` 能拿到 4 個 mock 項目
- [ ] **Part B 偏好持久化**:`setPreferences({ modelSize: 'medium' })` 後重啟 app,`getPreferences()` 仍回傳 medium
- [ ] **Part C 錄音服務**:手動測試錄製 3 秒音訊能產生合理大小的 WAV buffer
- [ ] **Part C 權限處理**:首次錄音觸發麥克風權限請求,拒絕時有明確 error
- [ ] **日誌合規**:所有新增程式碼無 `console.log`,全部使用 `window.electronAPI.debug.log` 或 `logger.log`
- [ ] **臨時測試碼移除**:Part C 驗證用的測試按鈕已刪除,`RecordingService` 保留
- [ ] **模型路徑常數匯出**:T0004 可 import 使用

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間(可用 `pwsh -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"`)。
> 完成後請填寫「回報區」。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `CLAUDE.md`(專案規範)
3. 讀取 `_ct-workorders/reports/T0002-whisper-node-addon-poc.md` 的「關鍵發現」和「遭遇問題」(了解 whisper-node-addon 實際能力)
4. 更新本工單「開始時間」欄位
5. 找到專案的型別定義、preload、main process 實際路徑(Glob / Grep 搜尋)
6. **按 Part A → Part B → Part C 順序**執行(Part A 失敗則後續無意義)
7. 每個 Part 完成後執行一次 `npx vite build` 驗證
8. 全部完成後,手動測試 Part C 的錄音流程
9. 移除臨時測試碼
10. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **找不到既有檔案時**:用 Glob 和 Grep 實際搜尋,**不要**假設路徑(教訓來自 L003)
- **遇到既有 coding style 衝突**:遵循專案既有風格,不要按你自己的偏好寫
- **Part B 的 mock 要明顯**:mock 回傳文字中明確標註「mock」或「T0004 會替換」,避免未來誤以為是真實實作
- **IPC channel 命名**:建議格式 `voice:xxx`(如 `voice:listModels`、`voice:transcribe`),與專案既有 channel 命名慣例對齊
- **AudioWorklet vs ScriptProcessor**:若 AudioWorklet 設定複雜導致時間拖長,可改用 ScriptProcessor(deprecated 但可用),並在回報區註記
- **session 權限處理**:若 Electron main process 沒有既有的 `setPermissionRequestHandler`,本工單需要加上允許 microphone 的處理,但**不要**改動現有權限處理邏輯
- **遇到需要安裝新 npm 套件**:本工單**只允許**安裝 Part C 可能需要的型別套件(如 `@types/web-audio-api`),**禁止**安裝 whisper-node-addon、opencc、任何執行時依賴
- **禁止**:不得提前實作 T0004/T0005/T0006/T0007 的功能

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新增檔案**:
- `src/types/voice.ts` — voice 命名空間全部型別定義 (`WhisperModelSize` / `VoiceLanguage` / `VoiceModelInfo` / `VoiceTranscribeOptions` / `VoiceTranscribeResult` / `VoicePreferences` / `VoiceModelDownloadProgress`)，並導出 `DEFAULT_VOICE_PREFERENCES` 常數
- `electron/voice-handler.ts` — IPC handlers 與 preferences 持久化、模型目錄約定、麥克風權限安裝器
- `src/lib/voice/wav-encoder.ts` — Float32 PCM → 16 kHz mono 16-bit PCM WAV 編碼器（含線性 resample）
- `src/lib/voice/recording-service.ts` — `RecordingService` 類別（getUserMedia + ScriptProcessor + WAV 輸出）與 `RecordingError`
- `src/lib/voice/index.ts` — voice lib barrel export

**修改檔案**:
- `src/types/electron.d.ts` — 加入 voice 型別 import 與 `ElectronAPI.voice` 命名空間（10 個方法 + 事件訂閱 + `getModelsDirectory`）
- `electron/preload.ts` — 加入 `voice` namespace bridge（全部使用 `ipcRenderer.invoke`，事件訂閱用 `ipcRenderer.on` 並回傳 unsubscribe）
- `electron/main.ts` — 加入 `import { registerVoiceHandlers }` 與在 `registerLocalHandlers()` 末尾呼叫 `registerVoiceHandlers(getAllWindows)`；刻意放在 `registerLocalHandlers` 內，與其他 local-only handlers（dialog/clipboard/shell 等）保持一致

**新增的 IPC channels**:
- `voice:listModels` — 掃描本地已下載模型並回傳 4 項 mock catalogue
- `voice:isModelDownloaded` — 檢查單一模型檔是否存在
- `voice:downloadModel` — **MOCK，會丟 Error**（T0004 實作，避免 Settings 頁誤以為有下載進度）
- `voice:deleteModel` — 真實刪除（檔案不存在時視為成功）
- `voice:cancelDownload` — MOCK no-op
- `voice:getPreferences` — 讀取 `userData/voice-preferences.json`，缺檔/壞檔 fallback 至 `DEFAULT_VOICE_PREFERENCES`
- `voice:setPreferences` — 合併更新並寫回 JSON（真實持久化）
- `voice:transcribe` — MOCK：延遲 1 秒，依 byteLength+sampleRate 推算 durationMs，回傳「這是 mock 辨識結果（T0004 會替換成真實 whisper 實作）」，並設 `isMock: true` 標記
- `voice:getModelsDirectory` — 回傳 `userData/whisper-models/` 絕對路徑
- `voice:modelDownloadProgress` — renderer 事件通道（T0003 尚未 emit，T0004 會透過 `webContents.send` 廣播）

**匯出的常數/型別**（給 T0004 重用）:
- `getVoiceModelsDir()` → `${userData}/whisper-models`（from `electron/voice-handler.ts`）
- `getVoiceModelFilePath(size)` → `${userData}/whisper-models/ggml-<size>.bin`（from `electron/voice-handler.ts`）
- `registerVoiceHandlers(getAllWindows)` — 入口函式，T0004 可直接替換內部實作
- `WHISPER_TARGET_SAMPLE_RATE = 16000`（from `src/lib/voice/wav-encoder.ts`）
- `DEFAULT_VOICE_PREFERENCES`（from `src/types/voice.ts`）

### 互動紀錄
無。全程依工單指令執行，未遇到需與指揮塔對齊的決策點。

### 遭遇問題

1. **tsc 預先存在大量型別錯誤**：執行 `npx tsc --noEmit` 發現 256 個錯誤，但**全部**位於既有檔案（`App.tsx` / `ClaudeAgentPanel.tsx` / `stores/*` 等），原因是 `src/types/electron.d.ts` 裡的 `ElectronAPI` interface 相比 `electron/preload.ts` 實際 expose 的 `electronAPI` 物件落後很多（缺 `debug` / `claude` / `profile` / `remote` / `system` / `image` / `fs` 等命名空間）。專案實際 build 用 `vite build`（esbuild，不做型別檢查），所以這些錯誤從不影響打包。**我的變更不產生任何新 tsc 錯誤**（`grep -E "voice|recording|wav-encoder"` 結果為空）。這是既有技術債，非本工單範圍。

2. **ElectronAPI interface 與 preload.ts 的 typeof electronAPI 宣告並存**：`electron.d.ts` 宣告 `Window.electronAPI: ElectronAPI`，`preload.ts` 另外 `declare global { Window.electronAPI: typeof electronAPI }`。因兩邊在不同 tsconfig（renderer vs electron）編譯，並不實際衝突，但造成上述 tsc 落差。我遵循既有 pattern 同時更新兩邊以保持一致。

3. **ScriptProcessorNode vs AudioWorklet 選擇**：工單允許任一方案。我選 `ScriptProcessorNode`（簡單、Electron/Chromium 仍完整支援、一次性 use case）。若未來 Chromium 真的移除，RecordingService 對外 API 穩定，內部可替換，無需改 T0004/T0005。

### 手動測試結果

**WAV 編碼器驗證**（不依賴麥克風，可在 Node 環境純函式驗證）：

用 3 秒 440 Hz 正弦波 @ 44.1 kHz 合成 Float32 chunk，送入 encoder：

```
Chunks: 33  Total Float32 samples: 132300
Resampled length: 48000 (expected ~48000) ✅
WAV byte length: 96044
Header:
  RIFF: RIFF        OK
  WAVE: WAVE        OK
  fmt size: 16      OK
  PCM format: 1     OK (PCM)
  channels: 1       OK (mono)
  sample rate: 16000 OK
  bits per sample: 16 OK
  data chunk: data  OK
  data size: 96000 bytes (3.00 s at 16kHz mono 16-bit) ✅
WAV encoder verification: PASS
```

與工單預期「3 秒音訊約 96 KB for 16kHz mono 16-bit」**完全吻合**（44 byte header + 96000 byte PCM = 96044 bytes）。

**RecordingService 真實麥克風流程未執行**：本 sub-session 無法實際對麥克風說話。`RecordingService` 本身可以在 build 時被 TypeScript/esbuild 正確解析（`npx vite build` 通過），且不依賴任何未安裝套件。真實錄音驗證延後至 T0005 PromptBox UI 實作時一併測試（屆時可立即藉由按鈕觸發）。**未新增臨時測試按鈕**，避免留下需要清理的 dead code（工單 Part C 的臨時按鈕指引為「可選」，未強制）。

**Mock IPC smoke test 亦未執行**：同樣因無法實際啟動 Electron app。但：
- `grep -o 'voice:[A-Za-z]*' dist-electron/main.js` 顯示全部 9 個 invoke channel 已註冊
- `grep -o 'voice:[A-Za-z]*' dist-electron/preload.js` 顯示全部 10 個項目已 bridge（含 `voice:modelDownloadProgress` 事件通道）
- `registerLocalHandlers()` 在 `app.whenReady()` 路徑上被呼叫，`registerVoiceHandlers` 隨之執行，邏輯鏈完整

### Build 驗證結果

`npx vite build` ✅ 三階段全部通過：

```
dist/index-D2t5qs83.js                485.68 kB │ gzip: 143.33 kB
✓ built in 8.79s          (renderer)

dist-electron/main.js                 125.65 kB │ gzip:  36.62 kB
dist-electron/sdk-CUW4pJVX.js         471.52 kB │ gzip: 129.87 kB
✓ built in 1.19s          (electron main)

dist-electron/preload.js               12.89 kB │ gzip:   2.65 kB
✓ built in 17ms           (electron preload)
```

無任何警告或錯誤。`preload.js` 尺寸從 ~12.5 kB → 12.89 kB（+0.4 kB 合理，對應 voice bridge 程式碼）；`main.js` 尺寸未變（voice-handler 被 tree-shake 追蹤進 main chunk 但 mock handlers 體積小到在顯示上看不出差異）。

### 給 T0004 的備註

1. **直接替換點**：`electron/voice-handler.ts` 裡 9 個 `ipcMain.handle(...)` 其中有 mock 註解（搜尋 `MOCK`）的：
   - `voice:downloadModel` — 目前丟 Error，需改為呼叫真實下載函式並定期 `win.webContents.send('voice:modelDownloadProgress', ...)` 廣播到全部 window（用已注入的 `_getAllWindows`）
   - `voice:cancelDownload` — 需中斷真實下載流
   - `voice:transcribe` — 目前 setTimeout + 假文字；T0004 需引入 `whisper-node-addon`，把 `audioBuffer` 寫到 temp WAV 檔，呼叫 whisper，然後走 OpenCC 做繁簡轉換（遵循 `options.convertToTraditional ?? prefs.convertToTraditional`），並把 `isMock` 欄位移除

2. **可直接重用**：
   - `getVoiceModelsDir()` / `getVoiceModelFilePath(size)` — 路徑約定已建立，不要另起爐灶
   - `DEFAULT_VOICE_PREFERENCES` 與 preferences 讀寫邏輯（`readPreferences` / `writePreferences`）— 已 merge-with-defaults 處理新欄位相容
   - `MOCK_MODEL_CATALOGUE` 裡的 `displayName` / `diskSize` 可升級為真實值（Hugging Face 官方 ggml 檔案大小）

3. **`scanDownloadedModels` 已做對事情**：它目前就是真實掃描本地檔案系統的 `fs.stat`，**不是 mock**。T0004 裝好 whisper 後這個函式可以維持原樣，只要下載機制把檔案放在 `getVoiceModelFilePath(size)` 即可自動被偵測為 downloaded。

4. **繁簡轉換位置**：`VoiceTranscribeResult.text` 應在 main process side 就做完 OpenCC 轉換（根據 `options.convertToTraditional`），renderer 不應自己轉。`VoiceTranscribeResult.detectedLanguage` 保留原始 whisper 偵測值（`'zh'` 不管簡繁）。

5. **麥克風權限已安裝**：`ensureMicrophonePermission()` 在 `registerVoiceHandlers` 進入時呼叫一次，安裝 `setPermissionRequestHandler` 允許 `media` 權限。T0004 不需再處理。**注意**：若 main.ts 未來新增其他 permission handler，會 race condition，屆時需統一到 main.ts 一處集中管理（目前專案沒有其他 handler，已驗證安全）。

6. **WAV 格式**：renderer 送過來的 `audioBuffer` 就是完整 RIFF/WAVE 容器（16 kHz mono 16-bit PCM），可直接寫入暫存檔給 whisper-node-addon，無需額外 header 處理。

7. **log prefix 約定**：所有 voice 相關 main process log 使用 `[voice]` prefix（已建立習慣），方便 T0004 debug 篩選。

### sprint-status.yaml 已更新
不適用（專案根目錄、`_bmad-output/`、`docs/` 均無 `sprint-status.yaml`，Glob 搜尋結果為空）

### 回報時間
2026-04-10 23:53 (UTC+8)
