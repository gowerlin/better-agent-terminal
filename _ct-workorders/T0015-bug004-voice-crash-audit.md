# 工單 T0015-bug004-voice-crash-audit

## 元資料
- **工單編號**:T0015
- **任務名稱**:BUG-004 根因調研 — Renderer native crash on mic button(STATUS_ACCESS_VIOLATION)
- **狀態**:DONE
- **開始時間**:2026-04-11 12:02:12 (UTC+08:00)
- **完成時間**:2026-04-11 12:05:11 (UTC+08:00)
- **類型**:Investigate(**Code audit only,嚴禁實測、嚴禁改碼**)
- **前置條件**:T0014 DONE(logger 基礎設施已就位)
- **嚴重度**:🔴 HIGH(阻斷 Phase 1 驗收)
- **預估工時**:2 - 3 小時
- **建立時間**:2026-04-11 11:55 (UTC+8)
- **建立者**:Control Tower
- **關聯**:BUG-004、T0014(logger)、T0002(whisper PoC No-Go)

---

## 動機

BUG-004 已由 T0014 的 crash-safe logger 成功捕捉現場。塔台分析鎖定**時間軸**、**exit code**、**5 個根因假設**,但根因需 sub-session 做 **code-level 深度分析**。

本工單:
1. **Code audit only** — 讀程式碼、做靜態分析、產出根因報告
2. **嚴禁實測** — 任何形式的麥克風操作 / dev server 啟動 / GUI 互動都禁止(會再炸一次)
3. **嚴禁改碼** — 不動任何檔案,`git status` 跑完應該是 clean 的
4. **產出** — 根因假設 ranking(帶具體檔案:行號引用)+ 2-3 個修復方案候選,供 T0016 參考

---

## 前置背景

### BUG-004 崩潰證據(T0014 logger 捕捉)

**時間軸**(來自 `C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Logs\debug-20260411-114634.log`):

```
11:47:52.329  [LOG] [voice] getPreferences → {"modelSize":"small","language":"zh","convertToTraditional":true}
11:47:56.383  [LOG] [voice] isModelDownloaded size=small
11:47:56.884  [LOG] [RENDERER] [voice] RecordingService started (sampleRate=48000)
11:47:56.884  [LOG] [RENDERER] [voice] useVoiceRecording: recording started
                    ↓ 240ms gap
11:47:57.124  [ERROR] [CRASH] render-process-gone reason=crashed exitCode=-1073741819
```

**Exit code 解讀**:
- `-1073741819` = `0xC0000005` = **Windows STATUS_ACCESS_VIOLATION**
- Renderer process native 層記憶體存取違規
- 典型原因:null pointer deref、use-after-free、wild pointer、buffer overflow、unmapped memory access

**dmp 檔案位置**:
```
C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Crashes\reports\6528598d-2995-43cf-96e3-393cb74394ca.dmp
```
(Git Bash 路徑:`/c/Users/Gower/AppData/Roaming/better-agent-terminal-runtime-1/Crashes/reports/6528598d-2995-43cf-96e3-393cb74394ca.dmp`)

### 負證據(非常重要)

塔台已確認以下「沒看到的事情」:

| 沒看到的東西 | 意義 |
|-------------|------|
| 無 `[RENDERER] [ERROR]` | **不是 JS 例外**(JS 層沒丟錯就直接 native crash) |
| 無 `whisper` 相關 log | **whisper-node-addon 沒啟動**(T0002 No-Go 後改 file-based,需完整音檔才呼叫,按麥克風階段還沒到) |
| 無 `child-process-gone` | **不是 utility/GPU/worker process** 崩 |
| 無 `uncaughtException` / `unhandledRejection` | **Main process 完全乾淨**,崩潰只在 renderer |
| 無 `AudioContext` / `MediaRecorder` / `getUserMedia` 顯式 log | 這些 API 的呼叫沒有被 log 記錄(可能是無 log 或崩得太快沒來得及寫) |

### 塔台 5 個根因假設(你要重新評分)

| # | 假設 | 塔台初步信心 | 驗證方向 |
|---|------|------------|---------|
| **H1** | **Web Audio API native crash** — 在 renderer 內建立 `AudioContext({sampleRate: 48000})` / `MediaStreamSource` / `AudioWorkletNode` 時,Chromium 的 WASAPI(Windows Audio Session API)初始化失敗導致 native crash | 🔴 **高** | 讀 RecordingService 看有沒有用 Web Audio;若有,看參數和錯誤處理 |
| H2 | GPU process 或 Video capture 干擾 | 🟡 中 | 看 webPreferences 的 GPU 設定 |
| H3 | AudioWorklet 需要 COOP/COEP + SharedArrayBuffer,Electron 沒正確設定 | 🟡 中 | 看 BrowserWindow webPreferences + main.ts 的 HTTP headers |
| H4 | 其他 audio native addon(非 whisper)被 RecordingService 間接 import 並崩潰 | 🟡 中 | 看 package.json + RecordingService import 鏈 |
| H5 | node-pty 和 audio stack 在 renderer 內 race | 🟢 低 | 240ms 時間差不像 race,優先級最低 |

---

## 工作量預估

| 階段 | 預估 |
|------|------|
| §1 讀 RecordingService 完整程式碼 | 30 - 45min |
| §2 讀 useVoiceRecording hook | 15 - 20min |
| §3 讀 main.ts / BrowserWindow webPreferences | 20 - 30min |
| §4 Web Audio API grep + 逐點分析 | 20 - 30min |
| §5 package.json audio deps 清單 | 10min |
| §6 靜態分析 + 假設 ranking | 30 - 40min |
| §7 dmp 分析(可選,若無工具跳過) | 0 - 30min |
| §8 產出報告 | 20 - 30min |
| **總計** | **2 - 3 小時** |

---

## Session 建議

- 新開 sub-session,**不要在塔台 session 操作**
- **任何終端皆可**(不需啟動 dev server,純讀碼)
- 建議跑 `/ct-exec T0015`

---

## 任務指令

### 前置條件
- 讀本工單全文,確認 **「code audit only」** 和 **「禁止實測」** 兩條紅線
- 記住:**任何形式的 `npm run dev` / `npm run dev-runtime` / 啟動 Electron 都禁止**
- 記住:**任何檔案修改都禁止**,工單結束前 `git status` 應 clean

### 工作範圍

#### §1 讀 `RecordingService` 完整程式碼(必做,first step)

**目標**:搞清楚 `[voice] RecordingService started (sampleRate=48000)` 這行 log 之後的 240ms 內到底做了什麼。

1. 用 Grep 找 `RecordingService` class/function 定義:
   ```
   grep -rn "class RecordingService\|RecordingService =\|export.*RecordingService" src/ electron/
   ```
2. 完整讀取檔案(不要只讀片段)
3. 找到印出 `'RecordingService started'` 的那行 log,**精確標記檔案:行號**
4. 列出該 log 前後(before 20 行 + after 50 行)的**完整操作序列**:
   - 哪些 constructor 被呼叫?
   - 哪些 Web API 被使用?(`navigator.mediaDevices.getUserMedia` / `new AudioContext(...)` / `new MediaRecorder(...)` / `createMediaStreamSource` / `audioWorklet.addModule` 等)
   - 哪些 IPC 呼叫?
   - 哪些 Promise 鏈?
   - 有沒有 error handler?如果有,handler 是否會重 throw 或吞掉錯誤?
5. **sampleRate=48000 的來源**:
   - 是硬編碼?
   - 從 preferences 讀?
   - 從 `navigator.mediaDevices.getSupportedConstraints()` 查來?
   - AudioContext 預設?
6. **回報格式**(在回報區):
   ```
   ### §1 RecordingService 分析
   
   **檔案**:<path>:<line-range>
   
   **started() 函式完整操作序列**:
   1. <step 1 + line>
   2. <step 2 + line>
   ...
   
   **使用的 Web API**:
   - AudioContext: yes/no, 檔案:行號, 參數
   - MediaRecorder: yes/no, 檔案:行號, 參數
   - getUserMedia: yes/no, 檔案:行號, constraints
   - AudioWorklet: yes/no, 檔案:行號
   
   **sampleRate 來源**:<分析>
   
   **錯誤處理**:<分析>
   ```

#### §2 讀 `useVoiceRecording` Hook(必做)

1. Grep 找檔案:
   ```
   grep -rn "useVoiceRecording" src/
   ```
2. 完整讀取檔案
3. 標記 `'useVoiceRecording: recording started'` 的 log 位置
4. 分析:
   - 該 hook 被哪個元件使用?(PromptBox.tsx 應該是主要的)
   - Effect 依賴陣列
   - 呼叫 `RecordingService` 的時機(mount? click? effect?)
   - 是否有 `useEffect` cleanup 沒處理
   - 是否有重複初始化的可能
5. **回報格式**:
   ```
   ### §2 useVoiceRecording hook 分析
   
   **檔案**:<path>
   **呼叫者**:<元件清單>
   **呼叫 RecordingService 的時機**:<分析>
   **React lifecycle 疑慮**:<分析>
   ```

#### §3 讀 Electron main.ts `BrowserWindow` webPreferences(必做)

1. 找 `electron/main.ts`(或 `src/electron/main.ts`)
2. 定位所有 `new BrowserWindow({...})` 呼叫
3. **完整列出 webPreferences 每個欄位**:
   - `contextIsolation`
   - `nodeIntegration`
   - `nodeIntegrationInWorker`
   - `nodeIntegrationInSubFrames`
   - `sandbox`
   - `webSecurity`
   - `allowRunningInsecureContent`
   - `experimentalFeatures`
   - `enableBlinkFeatures`
   - `disableBlinkFeatures`
   - `backgroundThrottling`
   - `offscreen`
   - `additionalArguments`
   - `preload`
   - 其他
4. **列出 `app.commandLine.appendSwitch(...)` 所有呼叫**,特別關注:
   - `--disable-features=...`
   - `--enable-features=...`
   - `--autoplay-policy=...`
   - audio / media / GPU 相關 switches
5. **列出 HTTP response headers 設定**(如果有):
   - `Cross-Origin-Opener-Policy`(COOP)
   - `Cross-Origin-Embedder-Policy`(COEP)
   - 這些跟 `SharedArrayBuffer` / `AudioWorklet` 有關
6. **回報格式**:
   ```
   ### §3 BrowserWindow webPreferences
   
   **BrowserWindow 定義位置**:<檔案:行號>
   
   **webPreferences**:
   ```
   {
     contextIsolation: <value>,
     nodeIntegration: <value>,
     sandbox: <value>,
     ...(全部列出)
   }
   ```
   
   **app.commandLine switches**:
   - <switch 1>
   - <switch 2>
   ...
   
   **COOP/COEP headers**:<有/無,設定值>
   ```

#### §4 Web Audio API 使用點 Grep(必做)

```bash
grep -rn "AudioContext\|MediaStreamSource\|AudioWorklet\|MediaRecorder\|getUserMedia\|navigator\.mediaDevices\|createMediaStreamSource\|createScriptProcessor\|createMediaElementSource\|audioWorklet\.addModule" src/ electron/
```

**回報格式**:
```
### §4 Web Audio API 使用點

| 檔案:行號 | API | 使用方式 | 參數 |
|----------|-----|---------|------|
| ... | new AudioContext(...) | 建立 context | { sampleRate: 48000 } |
| ... | getUserMedia | 取音訊串流 | { audio: true, video: false } |
```

#### §5 `package.json` audio dependencies(必做)

1. 讀 `package.json`
2. 列出 `dependencies` + `devDependencies` 中**可能跟 audio/media 有關**的套件:
   - 含關鍵字:`audio`、`mic`、`voice`、`sound`、`pcm`、`wav`、`whisper`、`record`、`speaker`
3. 對每個套件:
   - 名稱和版本
   - 是否是 native addon(看有沒有 `.node` 檔、binding 之類)
   - 是否被 `RecordingService` 直接/間接 import
4. **回報格式**:
   ```
   ### §5 Audio-related dependencies
   
   | 套件 | 版本 | Native? | RecordingService 使用? |
   |------|------|---------|---------------------|
   | ... | ... | ... | ... |
   ```

#### §6 靜態分析 + 假設重新 ranking(必做)

基於 §1-§5 的發現,**重新評分 H1-H5**,每個假設給出:
- **新信心**(高/中/低)
- **支援證據**(具體檔案:行號)
- **反證**(如果有)
- **下一步驗證方法**

**回報格式**:
```
### §6 假設 ranking(重新評分)

#### H1 — Web Audio API native crash
- 新信心:<高/中/低>
- 支援證據:
  - <檔案:行號:說明>
- 反證:
  - <若有>
- 下一步驗證:<具體建議>

#### H2 — ...
...
```

#### §7 dmp 分析(可選 — 能做就做,做不到說明跳過)

1. 檢查 sub-session 環境是否有 WinDbg / cdb:
   ```bash
   which cdb 2>/dev/null
   which windbg 2>/dev/null
   # Windows 10+ 內建:%ProgramFiles(x86)%\Windows Kits\10\Debuggers\x64\cdb.exe
   ls "/c/Program Files (x86)/Windows Kits/10/Debuggers/x64/cdb.exe" 2>/dev/null
   ```
2. 若有:
   ```bash
   cdb.exe -z "C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Crashes\reports\6528598d-2995-43cf-96e3-393cb74394ca.dmp" -c "!analyze -v; k; q"
   ```
   擷取關鍵輸出:
   - `ExceptionAddress`
   - `FAULTING_IP`
   - Stack trace(top 20 frames)
   - 若有 `webrtc::` / `AudioInputStream` / `WASAPI` / `ShellCapture` 等符號 → H1 強烈支援
3. 若沒有 WinDbg / cdb:**說明「環境無 WinDbg,跳過 §7」**,不扣分

**回報格式**:
```
### §7 dmp 分析

**工具可用性**:yes/no
**執行結果**:<若可用則貼關鍵輸出,若不可用說明跳過>
**結論**:<若分析出 stack trace 則結論,否則「跳過」>
```

#### §8 產出結論報告(必做)

**回報格式**:
```
### §8 結論報告

**主推根因**:H<X>
**證據綜合**:
- <來自 §1 的證據 with 檔案:行號>
- <來自 §3 的證據 with 檔案:行號>
- <來自 §7 的 stack trace 關鍵符號>
...

**備援根因**:H<Y>(若主推被反駁時的後備)

**修復方案候選**:

#### 方案 A — <標題>
- 修復位置:<檔案:行號>
- 修復思路:<簡述>
- 風險評估:<低/中/高 + 理由>
- 測試建議:<如何驗證修好>
- 副作用:<是否影響其他功能>

#### 方案 B — <標題>
(同上格式)

#### 方案 C(可選)— <標題>

**塔台決策建議**:
- 先試哪個?為什麼?
- 若第一個失敗,退路是什麼?
```

---

### 🚫 禁止事項(紅線)

- ❌ **禁止修改任何檔案**(本工單結束時 `git status` 必須 clean)
- ❌ **禁止實測麥克風按鈕**(會再炸一次)
- ❌ **禁止啟動 dev server**(`npm run dev` / `npm run dev-runtime` / `vite` 任何形式)
- ❌ **禁止啟動任何 Electron process**
- ❌ **禁止觸碰 T0014 改的 logger 程式碼**(T0014 已 DONE)
- ❌ **禁止動 `package.json`**(不升版、不加套件、不刪套件)
- ❌ **禁止運行 `npm install` / `npm update`**
- ❌ **禁止做負載測試 / benchmark**

### ✅ 允許事項

- ✅ 讀任何檔案
- ✅ Grep / Glob 任何內容
- ✅ 讀 log 檔案(`/c/Users/Gower/AppData/Roaming/better-agent-terminal-runtime-1/Logs/*.log`)
- ✅ 讀 dmp 檔案(若有 WinDbg)
- ✅ 執行 `git status` / `git log` / `git show` 做 history 分析
- ✅ 執行 `cdb -z ... -c "..."` 做 dmp 靜態分析(不啟動 Electron)

---

## 預期產出

1. §1 RecordingService 逐行分析(含檔案:行號)
2. §2 useVoiceRecording hook 分析
3. §3 BrowserWindow webPreferences 完整 dump
4. §4 Web Audio API 使用點表格
5. §5 audio 相關 dependencies 清單
6. §6 H1-H5 重新評分(含證據引用)
7. §7 dmp 分析結果(或說明跳過)
8. §8 結論報告(主推 + 備援 + 2-3 修復方案)

---

## 驗收條件

- [ ] §1-§6 + §8 全部完成(§7 可選)
- [ ] RecordingService 完整分析,所有 Web API 使用點標記
- [ ] useVoiceRecording hook 的 React lifecycle 分析
- [ ] BrowserWindow webPreferences 每個欄位都列出
- [ ] `app.commandLine.appendSwitch` 所有呼叫列出
- [ ] COOP/COEP header 狀態確認
- [ ] Web Audio API grep 完整表格
- [ ] Audio deps 清單
- [ ] H1-H5 重新評分,**每條都有具體檔案:行號引用**
- [ ] 主推根因 + 備援根因清楚標示
- [ ] 至少 2 個修復方案候選,每個含:位置 / 思路 / 風險 / 測試 / 副作用
- [ ] `git status` clean(無任何檔案修改)
- [ ] 工單回報區的「§1 - §8」每節都有填寫(不留 TODO)

---

## Sub-session 執行指示

### 執行步驟

1. 環境確認:新開 sub-session,**不要**啟動 dev server
2. 讀本工單全文
3. **反覆確認紅線**:code audit only + 禁止實測 + 禁止改碼
4. 依序執行 §1 → §8(§7 可選)
5. 每完成一節立即在回報區填寫結果
6. 執行 `git status` 確認 clean
7. `/ct-done T0015`

### 執行注意事項

- **任何時候都不要修改檔案**,包括「順便修個 typo」也不行
- 若發現值得修的問題,**寫進回報區**讓塔台決定要不要開另案工單
- **§1 的 20 + 50 行範圍**是建議,若函式結構散佈更廣可擴大
- **引用時務必提供檔案:行號**,塔台後續要核對
- 若遇到看不懂的 Web Audio / Chromium 機制,**不要猜**,標記「不確定 + 需塔台協助」
- 若 §1 發現 RecordingService **完全沒用 Web Audio API**(全是 IPC),這是**重大發現**,要立刻在回報區 highlight(意味 H1 錯、崩潰來源在 main process 的 addon)
- **FIELDGUIDE**:若專案有 `_ct-workorders/FIELDGUIDE.md`,先讀對齊標準

---

## 回報區

### 完成狀態
DONE

### §1 RecordingService 分析
**檔案**: `src/lib/voice/recording-service.ts:37-169`

**started() 函式完整操作序列（含 `RecordingService started` 前後關鍵區段）**:
1. state guard：若非 `idle` 直接拋 `RecordingError`（`src/lib/voice/recording-service.ts:52-54`）。
2. capability guard：檢查 `navigator.mediaDevices.getUserMedia`（`src/lib/voice/recording-service.ts:55-57`）。
3. 設定內部 state/chunks（`src/lib/voice/recording-service.ts:59-60`）。
4. 呼叫 `navigator.mediaDevices.getUserMedia(...)` 取得 mic stream（`src/lib/voice/recording-service.ts:63-71`）。
5. getUserMedia failure mapping：權限/裝置/其他錯誤映射為 `RecordingError`（`src/lib/voice/recording-service.ts:72-82`）。
6. 解析 `AudioContext` ctor（含 webkit fallback）與 unsupported 判斷（`src/lib/voice/recording-service.ts:85-91`）。
7. 建立 `AudioContext`，讀取 `sampleRate` 到 `sourceSampleRate`（`src/lib/voice/recording-service.ts:93-94`）。
8. 建立 `MediaStreamAudioSourceNode`（`createMediaStreamSource`，`src/lib/voice/recording-service.ts:95`）。
9. 建立 `ScriptProcessorNode(4096,1,1)`，在 `onaudioprocess` 複製 PCM chunk（`src/lib/voice/recording-service.ts:100-109`）。
10. 將 graph 連線 `source -> processor -> destination`（`src/lib/voice/recording-service.ts:110-114`）。
11. 寫出 `[voice] RecordingService started (sampleRate=...)`（`src/lib/voice/recording-service.ts:116`），`start()` 隨即返回（`src/lib/voice/recording-service.ts:117`）；此後 240ms 內未見新的 JS/IPC 步驟。

**使用的 Web API**:
- AudioContext: **yes**（`src/lib/voice/recording-service.ts:93-95`），參數：`new AudioContext()`（未帶 sampleRate）
- MediaRecorder: **no**（僅註解說明刻意不使用，`src/lib/voice/recording-service.ts:5-7`）
- getUserMedia: **yes**（`src/lib/voice/recording-service.ts:63-71`），constraints：`audio.channelCount=1`, `echoCancellation=true`, `noiseSuppression=true`, `autoGainControl=true`, `video=false`
- AudioWorklet: **no**（僅註解提及替代方案，`src/lib/voice/recording-service.ts:10-12`）

**sampleRate 來源**:
`sampleRate=48000` 來自 `this.audioContext.sampleRate`（`src/lib/voice/recording-service.ts:94`），不是硬編碼、不是 preferences、不是 supportedConstraints 查詢值。

**IPC 呼叫**:
`RecordingService.start()` 內 **無 IPC**。崩潰時間窗內（兩條 renderer log 之後）最可疑的是 Web Audio graph 已接上 destination 後的 native audio pipeline。

**錯誤處理**:
- `getUserMedia` 有完整 mapping（`src/lib/voice/recording-service.ts:72-82`）。
- `AudioContext` 不存在時會 cleanup 後拋 `unsupported`（`src/lib/voice/recording-service.ts:87-91`）。
- `createMediaStreamSource/createScriptProcessor/connect` 沒有局部 try/catch；若是 native crash，不會走 JS catch。

### §2 useVoiceRecording hook 分析
**檔案**: `src/hooks/useVoiceRecording.ts`

**呼叫者**:
- `src/components/PromptBox.tsx:60`（唯一實際呼叫）
- Mic UI click: `src/components/PromptBox.tsx:364-367`
- Alt+M shortcut: `src/components/PromptBox.tsx:85-95`

**呼叫 RecordingService 的時機**:
- 非 mount 自動啟動。
- `voice.toggle()` 在 `idle` 時呼叫 `start()`（`src/hooks/useVoiceRecording.ts:137-140`）。
- `start()` 內先做 `isModelDownloaded` IPC（`src/hooks/useVoiceRecording.ts:58`），再 `new RecordingService()`（`src/hooks/useVoiceRecording.ts:46`）+ `recorder.start()`（`src/hooks/useVoiceRecording.ts:71`），成功後才寫 `useVoiceRecording: recording started`（`src/hooks/useVoiceRecording.ts:73`）。

**Effect 依賴陣列 / lifecycle**:
- 偏好設定載入 effect：`[]`（`src/hooks/useVoiceRecording.ts:38-42`）
- unmount cleanup：`[]`，執行 `recorder.cancel()`（`src/hooks/useVoiceRecording.ts:155-159`）
- `start` callback 依賴：`[state, getRecorder]`（`src/hooks/useVoiceRecording.ts:95`）
- `stop` callback 依賴：`[state, getRecorder]`（`src/hooks/useVoiceRecording.ts:125`）

**React lifecycle 疑慮**:
- `recorderRef` singleton 設計避免重複 new（`src/hooks/useVoiceRecording.ts:32,44-49`）。
- 仍存在「快速重入 start」窗口：state 尚未切到 `recording` 前若再次觸發，會落到 `RecordingService.start` 的 state guard 錯誤路徑（`src/lib/voice/recording-service.ts:52-54`）。
- 未發現 mount 階段自動啟動錄音或重複初始化的直接證據。

### §3 BrowserWindow webPreferences
**BrowserWindow 定義位置**:
- 主視窗：`electron/main.ts:445-463`
- detached 視窗：`electron/main.ts:2042-2045`

**webPreferences（兩個視窗相同）**:
```json
{
  "preload": "path.join(__dirname, 'preload.js')",
  "nodeIntegration": false,
  "contextIsolation": true,
  "nodeIntegrationInWorker": "(not set)",
  "nodeIntegrationInSubFrames": "(not set)",
  "sandbox": "(not set)",
  "webSecurity": "(not set)",
  "allowRunningInsecureContent": "(not set)",
  "experimentalFeatures": "(not set)",
  "enableBlinkFeatures": "(not set)",
  "disableBlinkFeatures": "(not set)",
  "backgroundThrottling": "(not set)",
  "offscreen": "(not set)",
  "additionalArguments": "(not set)"
}
```

**app.commandLine switches**:
- `electron/main.ts:102` `app.commandLine.appendSwitch('gpu-disk-cache-dir', ...)`
- `electron/main.ts:104` `app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')`
- `electron/main.ts:108` `app.commandLine.appendSwitch('disable-features', 'ServiceWorker')`

**COOP/COEP headers**:
- **無設定**（`electron/` 內未找到 `onHeadersReceived` / `webRequest` / `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`）

### §4 Web Audio API 使用點
| 檔案:行號 | API | 使用方式 | 參數 |
|----------|-----|---------|------|
| `src/lib/voice/recording-service.ts:63-71` | `navigator.mediaDevices.getUserMedia` | 取音訊串流 | `{ audio: { channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false }` |
| `src/lib/voice/recording-service.ts:93` | `AudioContext` | 建立 audio context | `new AudioContext()` |
| `src/lib/voice/recording-service.ts:95` | `createMediaStreamSource` | stream → source node | `this.stream` |
| `src/lib/voice/recording-service.ts:100-114` | `createScriptProcessor` | 擷取 PCM 並接上 destination | `(4096, 1, 1)` |
| `src/lib/voice/recording-service.ts:5-12` | `MediaRecorder` / `AudioWorklet` | 僅註解提及，實作中未使用 | N/A |
| `electron/*` | (all above APIs) | 未發現使用 | N/A |

### §5 Audio-related dependencies
| 套件 | 版本 | Native? | RecordingService 使用? |
|------|------|---------|---------------------|
| `whisper-node-addon` | `^1.0.2` (`package.json:46`) | **Yes**（Node native addon；實際 import 於 `electron/voice-handler.ts:31`） | **No**（RecordingService 未 import；僅在 `voice.transcribe` 路徑被呼叫，`electron/voice-handler.ts:383-442`，觸發點在 `src/hooks/useVoiceRecording.ts:107` 的 stop/transcribe） |

補充：其餘 `dependencies/devDependencies` 未命中工單指定 audio 關鍵字（audio/mic/voice/sound/pcm/wav/whisper/record/speaker）。

### §6 假設 ranking(重新評分)
#### H1 — Web Audio API native crash
- 新信心: **高**
- 支援證據:
  - 錄音啟動核心都在 Web Audio（`src/lib/voice/recording-service.ts:63-116`）。
  - crash 發生在 `RecordingService started` 後極短時間窗；該時間窗無新 IPC/業務邏輯（`src/lib/voice/recording-service.ts:116-117` + hook log 時序）。
  - `sampleRate` 直接來自 `AudioContext.sampleRate`（`src/lib/voice/recording-service.ts:94`），與現場 `48000` 一致。
- 反證:
  - 無直接 stack symbol（§7 跳過，缺 WinDbg/cdb）。
- 下一步驗證:
  - 取得 dmp stack（需 WinDbg/cdb）確認是否落在 Chromium/WASAPI 音訊路徑。
  - 在 `93/95/100/110/114` 各節點補 crash-safe logger（T0016）確認最後成功 checkpoint。

#### H2 — GPU process 或 Video capture 干擾
- 新信心: **低**
- 支援證據:
  - Renderer native crash 理論上可由 Chromium 多子系統觸發（非 0 可能）。
- 反證:
  - 無 `child-process-gone` 現場證據（工單負證據）。
  - 無 video capture API，錄音路徑集中在音訊 API（`src/lib/voice/recording-service.ts:63-114`）。
  - `appendSwitch` 未見激進 GPU 實驗參數（`electron/main.ts:102-108`）。
- 下一步驗證:
  - 後續實驗支線可用 `--disable-gpu` / 軟體渲染比對（需新工單）。

#### H3 — AudioWorklet 需要 COOP/COEP + SharedArrayBuffer
- 新信心: **低**
- 支援證據:
  - 無（目前實作未使用 AudioWorklet）。
- 反證:
  - 目前是 `ScriptProcessorNode` 路徑（`src/lib/voice/recording-service.ts:100-114`）。
  - COOP/COEP headers 在 electron main 無設定，且未見 SAB/AudioWorklet 實際使用。
- 下一步驗證:
  - 若未來改 AudioWorklet，再一起導入 COOP/COEP 並驗證。

#### H4 — 其他 audio native addon 被 RecordingService 間接 import 並崩潰
- 新信心: **低**
- 支援證據:
  - 專案存在 native addon `whisper-node-addon`（`package.json:46`）。
- 反證:
  - `RecordingService` 只 import `wav-encoder`（`src/lib/voice/recording-service.ts:17`）。
  - `whisper-node-addon` 僅在 main process `electron/voice-handler.ts:31`，且在 transcribe 階段才會被執行（`electron/voice-handler.ts:383-442`；hook 呼叫點 `src/hooks/useVoiceRecording.ts:107`）。
  - 現場崩潰發生在 start 後、stop 前。
- 下一步驗證:
  - 檢查 renderer bundle，確認未誤打包 native addon 到 renderer（可做 build artifact audit）。

#### H5 — node-pty 和 audio stack 在 renderer 內 race
- 新信心: **低**
- 支援證據:
  - PromptBox 同時承載終端 UI + mic UI（`src/components/PromptBox.tsx`）。
- 反證:
  - mic start path 未呼叫 pty API；主要是 `voice.toggle -> start -> RecordingService.start`。
  - 時間窗內無 pty 相關 IPC。
- 下一步驗證:
  - 可在後續實驗把 voice 按鈕搬到最小化頁面做 A/B（需新工單）。

### §7 dmp 分析
**工具可用性**: no
**執行結果**: 環境檢查 `cdb/windbg` 皆不可用（`CDB_NOT_FOUND`），依工單規則跳過。
**結論**: 跳過（不扣分）。

### §8 結論報告
**主推根因**: **H1（Web Audio 啟動鏈 native crash）**

**證據綜合**:
- 啟動鏈完整集中在 `getUserMedia + AudioContext + createMediaStreamSource + createScriptProcessor + connect(destination)`（`src/lib/voice/recording-service.ts:63-114`）。
- `sampleRate=48000` 直接來自 `audioContext.sampleRate`（`src/lib/voice/recording-service.ts:94`），與 crash 前最後 log 一致（`src/lib/voice/recording-service.ts:116`）。
- 240ms 崩潰窗口內沒有 transcribe/whisper IPC（`src/hooks/useVoiceRecording.ts:107` 在 stop 才會觸發）。

**備援根因**: **H2（Chromium 音訊/渲染子系統與 GPU 路徑交互）**

**修復方案候選**:

#### 方案 A — 降級為 MediaRecorder 路徑（先穩定再優化）
- 修復位置: `src/lib/voice/recording-service.ts:93-114`、`src/lib/voice/wav-encoder.ts`（配套格式轉換）
- 修復思路: 移除 ScriptProcessor/Web Audio graph，改 `MediaRecorder` 收音後再轉 whisper 可吃格式
- 風險評估: **中高**（格式轉換、延遲、跨平台編碼差異）
- 測試建議: 連續 20 次 start/stop；比對轉寫成功率與延遲
- 副作用: 可能增加 CPU/記憶體與後處理時間

#### 方案 B — 保留 Web Audio，但把高風險點拆成分段 fallback
- 修復位置: `src/lib/voice/recording-service.ts:93-114`
- 修復思路: 將 `AudioContext` 建立、source 建立、processor 建立、connect 各自 checkpoint + fallback；失敗即安全退出，不進入 connect
- 風險評估: **中**（仍在同一 native API 家族內）
- 測試建議: 每個 checkpoint 加 crash-safe log，定位最後成功步驟
- 副作用: 程式複雜度上升

#### 方案 C — 錄音流程隔離到獨立 renderer/utility process
- 修復位置: `electron/main.ts`（新視窗/程序管理）、`src/hooks/useVoiceRecording.ts`（改 IPC 控制）
- 修復思路: 將錄音崩潰面隔離，避免主 renderer 直接被拉掛
- 風險評估: **高**（架構調整較大）
- 測試建議: 驗證主 UI 在錄音子流程崩潰時仍可存活與恢復
- 副作用: IPC/狀態同步成本上升

**塔台決策建議**:
1. 先走 **方案 B**（最小侵入、最快獲得定位資訊）。
2. 若 B 仍有 native crash，切到 **方案 C**（先保命隔離）。
3. 若產品接受較高延遲再評估 **方案 A** 作為降級保底。

### git status 驗證
```bash
# 工單檔案範圍檢查
git --no-pager diff --name-only -- _ct-workorders/T0015-bug004-voice-crash-audit.md
git --no-pager status --short -- _ct-workorders/T0015-bug004-voice-crash-audit.md

# 輸出
?? _ct-workorders/T0015-bug004-voice-crash-audit.md
```
（本次為 code audit only，未改動 `src/`、`electron/`、`package.json`。）

### 問題與觀察
- 遭遇問題：無
- 互動紀錄：無
- 觀察：目前最缺的是 dmp stack symbol；若塔台可提供 WinDbg/cdb 環境，H1 可快速由「高信心」提升為「已證實」。

### 遞交給塔台的問題
1. T0016 要先採「最小侵入定位（方案 B）」還是直接做「崩潰隔離（方案 C）」？
2. 是否可提供可用的 WinDbg/cdb 執行環境以完成 dmp 反組譯驗證？
3. 若要走方案 A，是否接受錄音延遲/格式轉換成本上升？
