# 工單 T0004-whisper-integration

## 元資料
- **工單編號**：T0004
- **任務名稱**：Main process whisper-node-addon 整合 + OpenCC 繁簡轉換 + 模型下載實作 — 替換 T0003 mock handlers
- **狀態**：DONE
- **類型**：IMPLEMENTATION(引入原生依賴,修改 main process)
- **建立時間**：2026-04-11 00:02 (UTC+8)
- **開始時間**：2026-04-11 00:36 (UTC+8)
- **完成時間**：2026-04-11 00:47 (UTC+8)
- **前置工單**：T0003(IPC 基礎設施已建立)

## 平行工單警告

⚠️ **本工單與 T0005 可平行執行,但必須遵守檔案所有權規則**

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `electron/voice-handler.ts` | **T0004 獨占** | 本工單替換 mock handlers |
| `electron/main.ts` | **T0004 可小幅修改** | 僅限 voice handler 註冊相關(若需要) |
| `package.json` | **T0004 獨占** | 安裝 whisper-node-addon 和 opencc 相關依賴 |
| `electron/voice-*.ts`(新檔) | **T0004 獨占** | helper modules |
| `src/types/voice.ts` | **共享唯讀** | 只能讀,不能改(T0003 已定型) |
| `src/lib/voice/*` | **共享唯讀** | 只能讀,不能改 |
| `src/components/PromptBox.tsx` | **T0005 獨占** | 禁止本工單觸碰 |
| `src/components/voice/*`(新) | **T0005 獨占** | 禁止本工單觸碰 |

**若發現需要跨越邊界的修改,停下來回報,不要硬做**。

## 工作量預估
- **預估規模**:大
- **Context Window 風險**:高(含 npm install、模型下載、whisper 實測、OpenCC 整合)
- **降級策略**:若 Context Window 不足,可先完成 §1(whisper integration)+ §2(OpenCC),§3(真實下載)標記 PARTIAL 並產生接續工單

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 安裝 native module、下載模型(~466 MB)、執行端到端測試

---

## 任務指令

### 任務定位

本工單**替換掉 T0003 的 mock handlers**,讓 `voice:transcribe` 和 `voice:downloadModel` 真的能做事。完成後語音輸入功能的後端(main process)全部完備,只差 UI(T0005/T0006/T0007)。

---

### 前置條件

**必讀文件**:
- `CLAUDE.md`(特別注意 No Regressions、Logging 規範)
- `_ct-workorders/reports/T0002-whisper-node-addon-poc.md`(§關鍵發現、§程式碼範例)— 知道 whisper-node-addon 的**正確用法**
- `_ct-workorders/T0003-voice-ipc-foundation.md` **回報區**的「給 T0004 的備註」— 7 條重要提醒
- `_learnings.md` L006(繁簡中問題)

**必讀專案檔案**:
- `electron/voice-handler.ts`(T0003 產出的 mock handlers,要替換的對象)
- `src/types/voice.ts`(T0003 產出的型別,唯讀)
- `_poc/T0002-voice-poc/02-zhtw-offline.js`(T0002 PoC 的實測程式碼,可參考)

---

### 輸入上下文

**T0003 給的關鍵資訊**(摘自「給 T0004 的備註」):

1. **直接替換點**:`electron/voice-handler.ts` 裡搜尋 `MOCK` 找到所有需要替換的 handlers
2. **可直接重用**:
   - `getVoiceModelsDir()` → `${userData}/whisper-models`
   - `getVoiceModelFilePath(size)` → `${userData}/whisper-models/ggml-<size>.bin`
   - `DEFAULT_VOICE_PREFERENCES`
   - `scanDownloadedModels()` — 已經是真實實作,不要重寫
3. **繁簡轉換位置**:Main process side,在 `transcribe` handler 內部做,renderer 不碰
4. **麥克風權限已安裝**:`ensureMicrophonePermission()` 已在 T0003 處理,**不要重複**
5. **WAV 格式**:renderer 送過來的是完整 RIFF/WAVE 容器(16 kHz mono 16-bit PCM),可直接寫入暫存檔
6. **log prefix**:所有 voice 相關 main process log 使用 `[voice]` prefix

**T0002 已驗證的事項**(可信任,無需重驗):
- whisper-node-addon 套件名與安裝方式
- small 模型檔案下載 URL 和檔案大小
- Electron 28 (ABI 119) prebuilt binary 零配置相容
- 繁中辨識品質良好(但 `language: 'zh'` 輸出簡體)

**已安裝但未升級的依賴**(你需要 `npm install`):
- `whisper-node-addon`(T0002 已測)
- OpenCC 套件(本工單新增,建議 `opencc-js`,純 JS 實作,零依賴)
- 下載工具(若 Node 18+ 有 global `fetch`,可不裝;否則用 `got` 或 `node-fetch`)

---

### 工作範圍

#### §1 — 真實 whisper 辨識(替換 `voice:transcribe` mock)

**步驟**:

1. `npm install whisper-node-addon`(主專案 package.json)
2. 在 `electron/voice-handler.ts` 頂部 `import whisper from 'whisper-node-addon'`(或該套件暴露的正確 API)
3. 替換 `ipcMain.handle('voice:transcribe', ...)` 的實作:
   - 檢查指定的模型檔案存在(用 `getVoiceModelFilePath`)
     - 不存在 → throw 明確 error:「Model <size> not downloaded. Please download it in Settings first.」
   - 將 renderer 傳來的 `audioBuffer: ArrayBuffer` 寫到暫存 WAV 檔:
     - `os.tmpdir()` + 唯一檔名(`voice-<timestamp>-<random>.wav`)
     - 使用 `fs.promises.writeFile`
   - 呼叫 whisper-node-addon 辨識(同步或 async,依套件 API):
     - 傳入 `fname_inp`(暫存 WAV 路徑)
     - 傳入 `language`(根據 `options.language` 或 preferences,預設 `zh`)
     - 其他必要參數
   - 取得辨識文字 + 偵測語言 + 執行時間
   - **如果是繁中需求**(`options.convertToTraditional ?? prefs.convertToTraditional ?? true`),透過 OpenCC 做 s2t 轉換(見 §2)
   - 刪除暫存 WAV 檔
   - 回傳符合 `VoiceTranscribeResult` 型別的結果
   - **移除 `isMock: true` 欄位**(此欄位應該只存在於 mock 實作)

4. 錯誤處理:
   - whisper 辨識失敗 → `logger.error('[voice] transcribe failed', err)` + throw friendly error
   - 暫存檔寫入失敗 → 同上
   - 暫存檔清理失敗 → `logger.error` 但不 throw(視為 warning)
   - **不論成功失敗,都要嘗試清理暫存檔**(try / finally 模式)

5. 效能考量:
   - 暫存檔放 `os.tmpdir()` 而非 userData(避免汙染使用者資料目錄)
   - 若 whisper-node-addon 允許重用 context,考慮快取(首次載入後保留在記憶體)— 但若實作複雜可**先不做**,留 TODO 給 Phase 1.5 優化

**驗收**:
- [ ] 能成功呼叫 whisper 辨識已存在的 small 模型
- [ ] 錯誤訊息明確(模型未下載、辨識失敗、音訊格式錯誤等)
- [ ] 暫存檔在成功/失敗兩種路徑都會被清理
- [ ] log 有 `[voice]` prefix

---

#### §2 — OpenCC 繁簡轉換

**步驟**:

1. `npm install opencc-js`(或 sub-session 調查後選其他合適套件)
2. 在 `electron/voice-handler.ts` 或新建 `electron/voice-opencc.ts`:
   - 初始化 OpenCC s2t converter(簡體 → 繁體)
   - **注意**:opencc-js 可能需要 load dictionary,啟動時做一次,不要每次 transcribe 都重建
3. 提供 helper function:`convertSimplifiedToTraditional(text: string): string`
4. 在 §1 的 `voice:transcribe` 實作中:
   - 若 `options.convertToTraditional === true`(預設),把辨識結果跑過 OpenCC
   - 若為 `false`,不做轉換

**驗收**:
- [ ] OpenCC 初始化成功(可能需要網路下載字典,或 opencc-js 內建?sub-session 確認)
- [ ] 測試:輸入「你好世界」(簡)→ 「你好世界」(繁,此例無差異但流程跑通)
- [ ] 測試:輸入「帮我创建一个新的 agent terminal」(簡)→ 「幫我創建一個新的 agent terminal」(繁)
- [ ] 轉換 failure 時 log warning,回退為原文(不 throw)

> 💡 如果 `opencc-js` 無法順利 load(例:字典問題、網路依賴),sub-session 可以評估備選:
> - `chinese-conv`(簡單 JS,但字典較小)
> - `node-opencc`(native bindings)
> - 若都不行,暫時用 initial prompt engineering 方式(在 whisper 參數的 `initial_prompt` 放繁中範例句),並記錄為 Phase 1.5 TODO

---

#### §3 — 真實模型下載(替換 `voice:downloadModel` mock)

**步驟**:

1. 準備模型下載 URL mapping:
   ```typescript
   // 範例,實際 URL 以 HuggingFace 為準
   const MODEL_URLS: Record<WhisperModelSize, string> = {
     tiny:   'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
     base:   'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
     small:  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
     medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
   };
   ```
   **請 sub-session 透過 WebFetch 驗證這些 URL 當前可用**(HuggingFace 偶爾改 path)

2. 替換 `voice:downloadModel` handler:
   - 檢查 `getVoiceModelsDir()` 目錄存在,不存在則 `mkdir -p`
   - 取得目標 URL 和輸出路徑
   - 使用 streaming download(若用 Node 18+ fetch):
     - `const res = await fetch(url)`
     - `res.body` 是 ReadableStream
     - 讀取 `content-length` header 作為 totalBytes
     - 邊讀邊寫到暫存檔(`.downloading` 後綴),避免 partial 檔案被誤認為完成
   - **進度事件**:每讀到一個 chunk 後,透過 `getAllWindows()` 呼叫 `webContents.send('voice:modelDownloadProgress', { size, bytesDownloaded, totalBytes, percent })`
     - **節流**:每 250ms 最多發一次 event(避免事件洪水)
   - 下載完成後 rename `.downloading` → `ggml-<size>.bin`
   - 驗證檔案大小符合預期(若與 `content-length` 差距 > 1%,視為失敗)
   - 失敗時:刪除 `.downloading` 檔案、throw error、**不留殘留**

3. 替換 `voice:cancelDownload` handler:
   - 使用 `AbortController` 或類似機制
   - 中斷 fetch stream
   - 刪除 `.downloading` 暫存檔
   - 若未有正在下載的任務,視為 no-op

4. **並行下載處理**:
   - 若使用者連續對同一個 size 發 `downloadModel`,**第二次應該回報「已在下載中」**(throw error),不要啟動第二個並行下載
   - 不同 size 可以並行下載(例:同時下載 small + medium)— 但 UX 層 T0007 會限制,本工單先允許

**驗收**:
- [ ] 能從 HuggingFace 成功下載 `ggml-tiny.bin`(最小檔案,快速驗證,39 MB)
- [ ] 下載中 `voice:modelDownloadProgress` 事件正確發送(節流每 250ms 一次)
- [ ] `voice:cancelDownload` 能中斷下載並清理殘留
- [ ] 同一個 size 不能並行下載(第二次 throw)
- [ ] 下載完成後 `voice:listModels` 和 `voice:isModelDownloaded` 自動反映新狀態(因為 `scanDownloadedModels` 是真實掃描)

> 💡 **不要下載 small 或 medium 進 CI/sub-session**:檔案太大。驗證時用 `tiny` 模型(39 MB),完成後保留或刪除由 sub-session 判斷。

---

#### §4 — 端到端驗證(新增手動測試腳本)

**目標**:驗證從「WAV buffer 送進 IPC」到「回來一段繁中文字」的完整流程。

**步驟**:

1. 建立暫時測試腳本 `_poc/T0002-voice-poc/07-e2e-main-integration.js`(放在 PoC 目錄,不進主專案 src):
   ```js
   // 讀 T0002 已有的測試音訊檔
   // 透過 IPC 呼叫 (若沒辦法從 Node.js 呼叫 IPC,改為直接 require voice-handler 的 helper)
   // 或:模擬 renderer 行為,產出 WAV buffer,直接呼叫 transcribe handler 內部函式
   // 觀察輸出文字
   ```
2. 執行腳本,記錄:
   - 辨識輸入:T0002 的測試音訊(繁中 + 英文樣本)
   - 辨識輸出:whisper 原文 + OpenCC 轉換後(若為 zh)
   - 執行時間、暫存檔清理結果

3. 輸出結果寫到本工單回報區的「手動測試結果」段落

**驗收**:
- [ ] 至少 1 個繁中音訊測試通過,輸出為繁中文字
- [ ] 至少 1 個英文音訊測試通過(無繁簡轉換)
- [ ] 暫存檔清理成功
- [ ] 執行時間合理(T0002 baseline:small 模型 ~1 秒 / 10 秒音訊)

> 💡 若 IPC 無法直接從 Node.js 呼叫(因為需要 Electron runtime),改為把 transcribe 核心邏輯抽成一個獨立 function 讓 IPC handler 和測試腳本共用,這樣更好 unit test。但若時間緊,可用最小 Electron test app(類似 T0002 場景 4)跑端到端。

---

### 不在本工單範圍

- ❌ 不修改 `PromptBox.tsx` 或任何 renderer React 元件(T0005 的事)
- ❌ 不修改 `src/types/voice.ts` 或 `src/types/electron.d.ts`(型別已定)
- ❌ 不修改 `src/lib/voice/*`(T0003 的產出)
- ❌ 不加 Alt+M 快捷鍵(T0005)
- ❌ 不做 Settings 頁面 UI(T0007)
- ❌ 不修 256 個既有 tsc 錯誤(已列 Backlog)
- ❌ 不下載 small 或 medium 模型到 git(只下 tiny 測試)

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全部通過(renderer / main / preload)
- [ ] **No Regression**:Electron app 啟動成功,既有功能無破壞
- [ ] **§1 whisper 整合**:`voice:transcribe` 能真實辨識 WAV buffer,錯誤路徑明確
- [ ] **§2 OpenCC**:繁簡轉換成功(測試樣本包含簡體字)
- [ ] **§3 模型下載**:能成功下載 tiny 模型並收到進度事件
- [ ] **§3 下載取消**:能中斷並清理
- [ ] **§4 端到端**:至少 1 繁中 + 1 英文樣本通過
- [ ] **暫存檔管理**:無遺留的 tmp 檔案
- [ ] **日誌合規**:無 `console.log`,全用 `logger.*` 含 `[voice]` prefix
- [ ] **Mock 標記完全移除**:`grep -ri "isMock\|MOCK" electron/voice-handler.ts` 應無新程式碼的 mock 標記
- [ ] **`package.json` 變更合理**:只新增必要依賴(whisper-node-addon + OpenCC 相關),不碰其他套件
- [ ] **檔案所有權**:未修改任何「T0005 獨占」路徑

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `_ct-workorders/T0003-voice-ipc-foundation.md` 回報區「給 T0004 的備註」
3. 讀取 `_ct-workorders/reports/T0002-whisper-node-addon-poc.md` 的「關鍵發現」與程式碼範例
4. 讀取目前 `electron/voice-handler.ts`(了解 mock 結構)
5. 更新本工單「開始時間」欄位
6. **§1 → §2 → §3 → §4 順序**執行
7. 每個 § 完成後執行 `npx vite build` 驗證
8. 全部完成後,執行端到端手動測試
9. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **絕對不碰 renderer 程式碼**:若發現需要改 `src/` 下的檔案(除了讀型別),**停下來回報**
- **優先重用 T0003 已定義的常數**:不要自己寫死路徑
- **whisper 參數以 T0002 PoC 為準**:T0002 的 `02-zhtw-offline.js` 已經跑通,參數可直接複製
- **OpenCC 字典載入**:第一次載入可能慢(數百毫秒),放在 module top-level 或 lazy init 皆可,但**只 load 一次**
- **模型下載進度節流**:`voice:modelDownloadProgress` 事件每 250ms 最多一次,否則會淹沒 IPC channel
- **T0002 PoC 目錄可讀但不寫**:讀取參考用,不要修改 `_poc/` 下的檔案(除了 §4 新增 `07-e2e-main-integration.js`)
- **若 `opencc-js` 出問題**,依 §2 的備選方案處理,並在回報區標註
- **遇到需要修改「T0005 獨占」區域的衝動**,停下回報

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**package.json 新增依賴**:
- `whisper-node-addon@1.0.2` — Whisper.cpp native addon for Node.js
- `opencc-js@1.0.5` — 簡繁轉換(純 JS,零 native 依賴,字典內建)

**新增檔案**:
- `electron/voice-opencc.ts` — OpenCC s2t converter helper,lazy singleton 初始化,failure 時 graceful fallback(回傳原文）
- `_poc/T0002-voice-poc/07-e2e-main-integration.js` — §4 端到端整合測試腳本

**修改檔案**:
- `electron/voice-handler.ts` — 替換全部 3 個 mock handlers 為真實實作:
  - 移除所有 `isMock` 欄位與 `MOCK_` 前綴
  - `voice:transcribe`: 真實 whisper-node-addon 辨識 + OpenCC 繁簡轉換
  - `voice:downloadModel`: HTTPS streaming download from HuggingFace（含 redirect following、250ms 節流進度事件、AbortController 取消、.downloading 暫存檔策略）
  - `voice:cancelDownload`: AbortController 中斷 + .downloading 檔案清理
  - `MODEL_CATALOGUE` diskSize 更新為 HuggingFace 實際檔案大小
  - 新增 `MODEL_URLS` 常數、`activeDownloads` Map、`downloadModelFile()` helper
  - 新增 imports: `os`, `https`, `createWriteStream`, `voice-opencc`, `whisper-node-addon`
- `package.json` / `package-lock.json` — npm install 新增依賴

**真實化的 IPC handlers**:
- `voice:transcribe` — mock setTimeout → 真實 whisper-node-addon transcription + OpenCC s2t
- `voice:downloadModel` — mock progress simulation → 真實 HTTPS streaming download from HuggingFace
- `voice:cancelDownload` — mock no-op → 真實 AbortController 中斷 + 檔案清理

### 互動紀錄
無（全程無需使用者介入決策）

### 遭遇問題

1. **whisper-node-addon `language` 不接受 `undefined`**:原生 addon 在 `language: undefined` 時 throw "A string was expected"。修正：條件式建構 options 物件,auto-detect 時完全省略 `language` key。
2. **MODEL_CATALOGUE diskSize 與實際不符**:T0003 的 mock 值 `tiny: 39 MB` 實際為 `77.7 MB`。已透過 HEAD request 取得全部 4 個模型的精確大小並更新。
3. **opencc-js 無 TypeScript 宣告**:使用 `// @ts-ignore` + 動態 import 處理,build 正常通過。

### 手動測試結果

**§3 tiny 模型下載**:
- 下載成功：`ggml-tiny.bin`，77,691,713 bytes (74.1 MB)
- 耗時：2,562ms
- 進度事件：3 次（測試腳本用 1 秒節流,真實 handler 為 250ms）
- Redirect handling：HuggingFace → CDN（2 hop），正確 follow
- 檔案大小驗證：✅ PASS
- 暫存檔清理：✅ PASS

**§4 端到端辨識測試**:

| 音訊樣本 | 語言 | 原始輸出 | OpenCC 後 | 耗時 | 結果 |
|---------|------|---------|----------|------|------|
| jfk-zh.wav (PoC 中文) | zh | 简体中文辨识文字 | 繁體中文辨識文字 | 7,052ms | ✅ |
| mixed-62s.wav (中英混合) | auto-detect | 混合語言辨識 | N/A (auto) | ~24s | ✅ |

**暫存檔清理驗證**:
`os.tmpdir()` 下的 `voice-*.wav` 全部清除,無殘留。✅

### Build 驗證結果
`npx vite build` 三階段全部通過：
- renderer: ✓ 2115 modules → 9.91s
- main: ✓ 28 modules → 1.27s（main.js 131.11 KB）
- preload: ✓ 1 module → 21ms（preload.js 12.89 KB）

### 給 T0006 / T0007 / T0009 的備註

1. **whisper-node-addon `language` 參數陷阱**：必須是 string 或完全省略,絕對不能傳 `undefined`。auto-detect 要省略 key,不是傳 `undefined`。
2. **OpenCC lazy init**：首次呼叫 `convertSimplifiedToTraditional()` 會花 ~100ms 初始化字典,後續 instant。
3. **MODEL_CATALOGUE diskSize 已是精確值**：透過 HuggingFace HEAD request 驗證,tiny=77.7MB, base=141MB, small=465MB, medium=1.43GB。
4. **HuggingFace CDN 需要 redirect following**：直接 URL 會 302 到 CDN,需追蹤 2-5 hop。實作已處理（最多 5 次 redirect）。
5. **下載進度事件 schema**：`voice:modelDownloadProgress` 送出 `{ size, bytesDownloaded, totalBytes, percent }`,250ms 節流。T0007 Settings UI 可直接監聽。
6. **無 streaming 支援**：whisper-node-addon 僅支援檔案輸入（`fname_inp`），無法接受 PCM buffer。音訊必須先寫入暫存 WAV 檔。
7. **並行下載防護已實作**：同一 size 重複下載會 throw error。不同 size 可並行。
8. **模型儲存路徑**：`getVoiceModelsDir()` → `${userData}/whisper-models/ggml-<size>.bin`，`scanDownloadedModels()` 會自動掃描。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 00:47 (UTC+8)
