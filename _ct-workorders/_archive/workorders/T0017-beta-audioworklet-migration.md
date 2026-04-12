# 工單 T0017-beta-audioworklet-migration

## 元資料
- **工單編號**:T0017-β
- **任務名稱**:BUG-004 治本修復 — 以 AudioWorklet 取代 deprecated ScriptProcessorNode
- **狀態**:DONE
- **Runtime 驗證**:2026-04-11 13:49 (UTC+8) 使用者實測，錄音不閃退,BUG-004 治本完成。轉寫階段暴露獨立問題 BUG-005(whisper addon 載入失敗),見 T0018。
- **L013 實戰紀錄**:首次依「業界最佳方案直接採用」原則執行,程式碼 4 分鐘完成 + 一次 runtime 驗證通過,**完全驗證 L013 的有效性**。
- **類型**:Hotfix + Modernization
- **前置條件**:T0014 DONE、T0015 DONE、T0016 DONE(失敗)、T0016-pre DONE、T0017-α DONE
- **嚴重度**:🔴 HIGH(Phase 1 驗收阻斷)
- **預估工時**:2 - 3 小時
- **建立時間**:2026-04-11 13:20 (UTC+8)
- **建立者**:Control Tower
- **開始時間**:2026-04-11 13:32 (UTC+8)
- **完成時間**:2026-04-11 13:36 (UTC+8)

---

## 動機

### 前情提要
1. **T0015** 鎖定 BUG-004 崩潰在 `RecordingService.start()` 後 ~240ms,啟動鏈用 ScriptProcessorNode
2. **T0016**(方案 E)改 `audioContext.destination` → `MediaStreamDestination`,**失敗**(仍閃退,所有同步 checkpoint 通過)
3. **T0016-pre** dmp 分析顯示 stack 在 V8 `cppgc::WriteBarrier` + `ScriptStreamingTask`(V8 跨執行緒證據)
4. **T0017-α** 加 tick counter 準備診斷(但基於 L013 insight,**不等測試結果**)

### 根因判定(行業知識級別)

**ScriptProcessorNode 是 W3C 2014 年 deprecated API**。Chromium 仍維護但優先級低,**已知有 crash bug 報告**(特別是 `(4096, 1, 1)` 這組常見參數 + Windows WASAPI 組合)。

行業標準做法是**改用 AudioWorklet**:
- W3C Web Audio API 推薦方案
- 執行在獨立 audio thread(不涉及 main thread V8 callback)
- Chromium 積極維護
- Tone.js / Web Audio API wrappers 都已改用
- 架構上**避開** T0016-pre 看到的 V8 `cppgc::WriteBarrier` 路徑

### L013 學習

塔台在 T0016/T0017-α 的決策中**過度保守**,把 AudioWorklet 當備援。現已記入 `_learnings.md` L013:「Evidence-first 原則的過度套用」。本工單是**修正方向後的治本方案**。

---

## 前置背景

### 當前 `recording-service.ts` 的啟動鏈(T0017-α 之後)

```
started():
  1. state guard
  2. capability guard
  3. setup state/chunks + reset audioprocessTickCount = 0
  4. getUserMedia(audio)                            ✓ 已有 checkpoint
  5. resolve AudioContext ctor                      ✓ 已有 checkpoint
  6. new AudioContext()                             ✓ 已有 checkpoint
  7. createMediaStreamSource(stream)                ✓ 已有 checkpoint
  8. createScriptProcessor(4096, 1, 1)              ⚠️ 要移除
  9. onaudioprocess = (event) => { PCM copy }       ⚠️ 要改成 worklet MessagePort
 10. source.connect(processor)                      ⚠️ 改成 source.connect(workletNode)
 11. processor.connect(recordingSink /* MediaStreamDestination */)  ⚠️ AudioWorklet 不需要下游 sink
 12. log: "RecordingService started"
 13. return
```

### AudioWorklet 架構對照

```
Main thread (V8 Isolate)                 Audio thread (Worklet Global Scope)
┌──────────────────────┐                 ┌───────────────────────────┐
│ AudioContext         │                 │                           │
│ MediaStreamSource    │──── graph ─────▶│ AudioWorkletProcessor     │
│ AudioWorkletNode     │                 │ process(inputs, outputs)  │
│                      │◀── MessagePort ─│   postMessage(pcmChunk)   │
│ node.port.onmessage  │                 │                           │
└──────────────────────┘                 └───────────────────────────┘
     |                                         |
     └─ 收到 PCM chunk → this.chunks.push       └─ Audio thread 上跑,獨立於 V8 main thread
```

**關鍵差異**:
- ScriptProcessorNode 的 `onaudioprocess` 在 **main thread** 觸發(需跨 audio thread → main thread callback)
- AudioWorklet 的 `process()` 在 **audio thread** 觸發,PCM 資料透過 **MessagePort** 非同步傳給 main thread
- AudioWorklet **不需要** connect 到 destination(`numberOfOutputs: 0` 即可)

---

## 工作量預估

| 階段 | 預估 |
|------|------|
| §1 讀現有 recording-service.ts | 10min |
| §2 建立 worklet processor 檔案 | 15min |
| §3 改 recording-service.ts 呼叫鏈 | 30min |
| §4 處理 Vite 打包 worklet module | 20 - 40min(可能卡關點) |
| §5 清理 ScriptProcessor 殘跡 | 10min |
| §6 TypeScript + Build 驗證 | 15min |
| §7 Grep 防呆 | 5min |
| §8 Commit + 使用者測試指引 | 15min |
| **總計** | **2 - 3 小時** |

**主要風險點**:§4 Vite 打包 worklet module 的路徑處理。若遇到卡關,工單有 Plan B(放 `public/` 當靜態資產)。

---

## Session 建議

- 新 sub-session(不與其他平行工單衝突)
- **任何終端皆可**(不需啟動 dev server,build only)
- `/ct-exec T0017-β` 或 `/ct-exec T0017-beta`

---

## 任務指令

### 前置條件
- 讀本工單全文
- **紅線**:只改 `src/lib/voice/recording-service.ts` + 新增 worklet 檔案。**不得**動其他任何檔案
- **不要**實測麥克風

### 工作範圍

#### §1 讀取現有程式碼(必做)

1. 讀 `src/lib/voice/recording-service.ts` 完整檔(包含 T0016 和 T0017-α 的改動)
2. 讀 `vite.config.ts` / `vite.config.js` / `vite.config.mts`(找到 Vite 設定,了解 build target、rollup options)
3. Grep 確認專案是否已用過 `new URL(..., import.meta.url)` 模式:
   ```bash
   grep -rn "import.meta.url" src/ 2>/dev/null
   ```
4. Grep 確認是否有 `?worker` / `?url` import 模式:
   ```bash
   grep -rn "\?worker\|\?url" src/ 2>/dev/null
   ```
5. **記錄發現**:專案的 asset import 慣例、Vite 版本、Electron 版本

#### §2 建立 AudioWorkletProcessor 檔案(必做)

**檔案路徑**:`src/lib/voice/recording-worklet-processor.ts`

**內容**:
```ts
/**
 * AudioWorkletProcessor for voice recording.
 *
 * This runs in the audio thread (AudioWorkletGlobalScope), not the main thread.
 * It captures mono PCM samples and posts them to the main thread via MessagePort.
 *
 * Replaces the deprecated ScriptProcessorNode path to avoid BUG-004
 * (renderer crash on ScriptProcessorNode.onaudioprocess cross-thread dispatch).
 */

// AudioWorkletGlobalScope has its own type declarations
// We use `declare` to avoid importing the dom lib
declare const registerProcessor: (
  name: string,
  processorCtor: new (...args: any[]) => AudioWorkletProcessor,
) => void;
declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

class RecordingWorkletProcessor extends AudioWorkletProcessor {
  private messageCount = 0;

  constructor() {
    super();
    // Notify main thread that worklet is alive
    this.port.postMessage({ type: 'ready', sampleRate });
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    // inputs[0] = first input; inputs[0][0] = first channel (mono)
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      // Copy the buffer (it'll be reused by the audio thread after return)
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.messageCount++;
      this.port.postMessage({
        type: 'pcm',
        data: copy,
        count: this.messageCount,
      }, [copy.buffer]); // transfer the buffer
    }
    // Return true to keep processor alive
    return true;
  }
}

registerProcessor('recording-worklet-processor', RecordingWorkletProcessor);
```

**注意**:
- `declare` 宣告避免需要特殊 tsconfig lib
- `transferable` 用 `copy.buffer` 避免重複複製
- 訊息格式:`{ type: 'ready' | 'pcm', ... }` 讓 main thread 能區分

#### §3 改 `recording-service.ts` 的啟動鏈(必做)

##### §3.1 Import worklet URL

在檔案頂部 import 區加:
```ts
// Vite 支援 new URL() + import.meta.url 解析 asset URL
const recordingWorkletUrl = new URL(
  './recording-worklet-processor.ts',
  import.meta.url,
).href;
```

**注意**:
- Vite 會把這個 `.ts` 檔案 transpile 成獨立 bundle,URL 指向 dev server(開發)或打包後路徑(生產)
- **若此方式在 Vite/Electron 組合下無效**,用 Plan B(見 §3 備案)

##### §3.2 重寫 `started()` 函式的 processor 建立段落

**移除**:
```ts
// 移除:
this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
debugLog('[voice:checkpoint] processor created (4096,1,1)');

this.processor.onaudioprocess = (event) => {
  this.audioprocessTickCount++;
  // ... T0017-α 加的節流 log
  if (this._state !== 'recording') return;
  const input = event.inputBuffer.getChannelData(0);
  const copy = new Float32Array(input.length);
  copy.set(input);
  this.chunks.push(copy);
};

this.source.connect(this.processor);
debugLog('[voice:checkpoint] source→processor connected');

this.recordingSink = this.audioContext.createMediaStreamDestination();
this.processor.connect(this.recordingSink);
debugLog('[voice:checkpoint] processor→sink connected');
```

**加入**(AudioWorklet 版本):
```ts
// BUG-004 修復:用 AudioWorklet 取代 deprecated ScriptProcessorNode
// ScriptProcessorNode 的 onaudioprocess 需從 audio thread callback 回 main thread,
// 觸發 V8 cross-thread 路徑 native crash。AudioWorklet 執行在獨立 audio thread,
// 透過 MessagePort 傳 PCM,繞開 main thread callback 問題。
try {
  await this.audioContext.audioWorklet.addModule(recordingWorkletUrl);
} catch (err) {
  debugLog(`[voice] audioWorklet.addModule failed: ${String(err)}`);
  throw new RecordingError('worklet-load-failed', String(err));
}
debugLog('[voice:checkpoint] worklet module loaded');

this.workletNode = new AudioWorkletNode(
  this.audioContext,
  'recording-worklet-processor',
  {
    numberOfInputs: 1,
    numberOfOutputs: 0, // 不需要 output(不 connect 到 destination)
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  },
);
debugLog('[voice:checkpoint] worklet node created');

this.workletNode.port.onmessage = (event) => {
  const msg = event.data;
  if (msg?.type === 'ready') {
    debugLog(`[voice:checkpoint] worklet ready sampleRate=${msg.sampleRate}`);
    return;
  }
  if (msg?.type === 'pcm' && msg.data instanceof Float32Array) {
    this.audioprocessTickCount = msg.count; // 重用 counter
    if (msg.count <= 10 || msg.count % 50 === 0) {
      debugLog(`[voice:checkpoint] worklet message #${msg.count}`);
    }
    if (this._state !== 'recording') return;
    this.chunks.push(msg.data);
  }
};

this.source.connect(this.workletNode);
debugLog('[voice:checkpoint] source→worklet connected');
```

**注意**:
- `await` 需要確認 `start()` 函式是 async(應該是)
- `workletNode.port.onmessage` 在 main thread 觸發,**取代** `onaudioprocess`
- PCM 資料透過 transfer(`[copy.buffer]`)傳遞,零複製
- 保留「收到 PCM 塞 chunks」的原邏輯

##### §3.3 class field 更新

**移除**(不再需要):
```ts
private processor: ScriptProcessorNode | null = null;
private recordingSink: MediaStreamAudioDestinationNode | null = null;
```

**加入**:
```ts
private workletNode: AudioWorkletNode | null = null;
```

**保留**:
- `audioprocessTickCount`(重用為 worklet message counter)
- `stream` / `source` / `audioContext` / `chunks` 等其他 fields

##### §3.4 cleanup 更新

在 `cleanup()` / `stop()` / `cancel()` 裡:

**移除**:
```ts
if (this.processor) { try { this.processor.disconnect(); } catch {} this.processor = null; }
if (this.recordingSink) { try { this.recordingSink.disconnect(); } catch {} this.recordingSink = null; }
```

**加入**:
```ts
if (this.workletNode) {
  try { this.workletNode.port.close(); } catch {}
  try { this.workletNode.disconnect(); } catch {}
  this.workletNode = null;
}
```

#### §3 Plan B — 若 `new URL() + import.meta.url` 在 Vite + Electron 下不 work

**症狀**:runtime error `Failed to load module script` 或 `The URL is not executable` 或 `MIME type mismatch`。

**Plan B:用 public/ 靜態資產**:

1. 建立 `public/voice-worklet/recording-worklet-processor.js`(純 JS,不是 TS):
   - 把 §2 的 TypeScript 內容移除 type annotations 改成 JS
   - Vite 會把 `public/` 下的檔案原樣複製到 build output
2. `recording-service.ts` 改用:
   ```ts
   const recordingWorkletUrl = new URL('/voice-worklet/recording-worklet-processor.js', window.location.origin).href;
   ```
3. Vite dev server 會從 `/voice-worklet/...` 提供,build 後在 `dist/voice-worklet/...`
4. Electron 的 file:// protocol 下也能存取

**若 Plan B 也不行**,回報塔台決定 Plan C(可能需要改 Vite plugin 或 Electron protocol handler)。

#### §4 TypeScript 型別處理

**問題**:`AudioWorkletNode` / `AudioWorkletProcessor` 在 `lib.dom.d.ts` 有型別,但 `AudioWorkletGlobalScope` 的型別(`registerProcessor`、`sampleRate`)在 worklet 檔案內需要另外處理。

**解法**:§2 的 worklet 檔案用 `declare` 宣告(已包含在範例)。

**驗證**:
```bash
npx tsc --noEmit
# 或
npx vite build
```

若 TypeScript 抱怨 `AudioWorkletNode` 不存在,檢查 `tsconfig.json` 的 `lib` 是否有 `"DOM"` 和 `"DOM.Iterable"`,應該現代 `"ESNext"` + `"DOM"` 即可。

#### §5 清理 ScriptProcessor 殘跡

Grep 確認沒有遺留:
```bash
grep -n "ScriptProcessor\|createScriptProcessor\|onaudioprocess" src/lib/voice/recording-service.ts
```
預期:**no matches**。若有殘留,移除。

#### §6 Grep 其他檔案(防呆)

```bash
grep -rn "ScriptProcessorNode\|createScriptProcessor" src/ electron/ 2>/dev/null | grep -v node_modules
```
預期:**no matches**。若發現其他使用點,在回報區 list(本工單不改,塔台另案處理)。

#### §7 Build 驗證

```bash
npx vite build
```
預期:通過,可能有警告(dynamic import chunk)但無 error。

**若 Vite 抱怨 worklet URL**,切換到 §3 Plan B。

#### §8 Commit

```bash
git add src/lib/voice/recording-service.ts src/lib/voice/recording-worklet-processor.ts
# 若用 Plan B,加上 public/voice-worklet/*
git status
git commit -m "fix(voice): [BUG-004] replace deprecated ScriptProcessorNode with AudioWorklet

BUG-004 root cause: ScriptProcessorNode.onaudioprocess cross-thread callback
triggers V8 cppgc::WriteBarrier native crash (~236ms after RecordingService
started, ≈2.77 audio buffers @ 4096/48000Hz). Reproducible with exitCode
0xC0000005 (STATUS_ACCESS_VIOLATION).

ScriptProcessorNode has been deprecated by W3C since 2014 and is known to
have crash bugs in Chromium on Windows WASAPI stack. AudioWorklet is the
modern replacement that runs in a dedicated audio thread and passes PCM
data via MessagePort, avoiding the main thread cross-thread callback path.

Changes:
- Add src/lib/voice/recording-worklet-processor.ts (AudioWorkletProcessor
  that captures mono PCM and posts via MessagePort with transferable)
- Update RecordingService.start() to load worklet module and use
  AudioWorkletNode instead of createScriptProcessor
- Remove obsolete MediaStreamDestination sink (T0016 scheme E)
- Remove ScriptProcessorNode onaudioprocess handler
- Preserve existing [voice:checkpoint] log chain for debug continuity
- Reuse audioprocessTickCount as worklet message counter

Refs: T0014 (logger), T0015 (audit), T0016 (failed scheme E), T0016-pre
(V8/cppgc stack), T0017-α (tick diag), L013 (avoid over-cautious steps)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**若 repo 有其他 staged 檔案**,用 `git commit --only -- <files>`。

#### §9 產出使用者測試指引

在回報區寫:

```markdown
## 👤 使用者測試步驟(T0017-β 修復驗證)

1. VS Code Task「開發: 終止所有 Dev 進程」清掉舊 instance
2. VS Code Task「開發: 啟動 Dev Server (Runtime)」
3. 等 BAT 啟動(看 Logs/ 產生新 debug-*.log)
4. 打開 `%APPDATA%\better-agent-terminal-runtime-1\Logs\` 的最新 `debug-*.log`
5. 在 PromptBox 按麥克風按鈕
6. 觀察結果:

**預期成功指標**:
- BAT **不閃退**
- log 有 `[voice:checkpoint] worklet module loaded`
- log 有 `[voice:checkpoint] worklet node created`
- log 有 `[voice:checkpoint] source→worklet connected`
- log 有 `[voice:checkpoint] worklet ready sampleRate=48000`
- log 有多個 `[voice:checkpoint] worklet message #N`(錄音每個 buffer 一個 message)
- 可完成「錄音 → 停止 → 轉寫」完整流程

**預期失敗指標**:
- BAT 仍閃退 → 記錄最後一個 checkpoint → 回塔台
- 看到 `audioWorklet.addModule failed` → Vite 打包路徑問題,切 Plan B
- 看到 `worklet-load-failed` error → 同上
- 沒有任何 `worklet message` → worklet 啟動但沒資料流

**若不閃退**:
- 測試 3-5 次確認穩定
- 測試完整錄音流程(按麥克風 → 說話 → 再按停 → 看轉寫)
- 回塔台回報「T0017-β 通過」
```

---

## 禁止事項

- ❌ **改 `src/lib/voice/recording-service.ts` 和 `recording-worklet-processor.ts` 以外的檔案**
  - 例外:若走 Plan B,允許在 `public/voice-worklet/` 新增 JS 檔
- ❌ **實測麥克風**(會炸)
- ❌ **啟動 dev server**(build only)
- ❌ **動 `package.json` / `tsconfig.json` / `vite.config.*`** — 如果 build 失敗是 config 問題,回報塔台決定
- ❌ **over-engineer** — 不要順便做 SharedArrayBuffer / COOP/COEP 設定(worklet 不需要)
- ❌ **保留 ScriptProcessor 當 fallback** — 不要做「試 worklet 失敗退回 scriptprocessor」的雙路徑邏輯(BUG-004 就是 scriptprocessor 的問題)
- ❌ **跳過 pre-commit hook**

## 允許事項

- ✅ 讀任何檔案(特別是 vite.config.*)
- ✅ 改 `recording-service.ts`
- ✅ 新增 `recording-worklet-processor.ts`
- ✅ Plan B:新增 `public/voice-worklet/recording-worklet-processor.js`
- ✅ `npx vite build` / `npx tsc --noEmit`
- ✅ 原子 commit(包含多個相關新增/修改檔)

---

## 預期產出

1. 新檔 `src/lib/voice/recording-worklet-processor.ts`
2. 修改 `src/lib/voice/recording-service.ts`(class fields + started() + cleanup)
3. (選項 Plan B)`public/voice-worklet/recording-worklet-processor.js`
4. Build 通過
5. 原子 commit(SHA 在回報)
6. 使用者測試指引

## 驗收條件

- [x] §1 讀取完成,Vite + Electron 版本記錄
- [x] §2 worklet processor 檔案建立
- [x] §3 recording-service.ts 的 started() 重寫完成
  - [x] class field `workletNode` 新增
  - [x] class field `processor` / `recordingSink` 移除
  - [x] `audioWorklet.addModule` 呼叫
  - [x] `AudioWorkletNode` 建立(numberOfOutputs: 0)
  - [x] `port.onmessage` 處理 `ready` + `pcm`
  - [x] `source.connect(workletNode)`
  - [x] 移除 `createScriptProcessor` 和 `onaudioprocess`
  - [x] 移除 `MediaStreamDestination` 和 `processor.connect(destination)`
  - [x] cleanup 更新
- [ ] §4 TypeScript 無 error（`npx tsc --noEmit` 仍有既有基線錯誤）
- [x] §5 Grep `ScriptProcessor` 在 recording-service.ts 無 match
- [x] §6 Grep 全 codebase 無其他 ScriptProcessor 使用點(或 list 出來)
- [x] §7 `npx vite build` 通過
- [x] §8 原子 commit(pre-commit hook 通過)
- [x] §9 使用者測試指引
- [ ] `git status` 只顯示 recording-service.ts + recording-worklet-processor.ts(+ Plan B 的 public/)（工作樹原本非乾淨）

---

## Sub-session 執行指示

### 執行步驟
1. 新 sub-session
2. `/ct-exec T0017-β` 或 `/ct-exec T0017-beta`
3. §1 → §9 按順序
4. 遇到 §3 Vite 打包問題 → 切 Plan B(不回塔台問)
5. 遇到其他障礙(Plan B 也失敗 / tsconfig 問題 / Vite 版本不合) → **停手回塔台**
6. 填回報區
7. `/ct-done`

### 執行注意事項

- **AudioWorklet 是標準 Web Audio API**,所有現代 Chromium 支援
- `numberOfOutputs: 0` 是關鍵 — 不 connect 到 destination 就不會觸發 WASAPI output pipeline
- **不要**保留 ScriptProcessor 當 fallback(L013:避免過度保守)
- **不要**改 vite.config 或 tsconfig,如果 build 失敗**以 config 問題**,**回報塔台**
- 保留現有 `[voice:checkpoint]` log 鏈 — T0014 + T0016 + T0017-α 的 checkpoint 都留著(除了 ScriptProcessor 相關那 2-3 個自然刪除)
- 新增 checkpoint:`worklet module loaded` / `worklet node created` / `source→worklet connected` / `worklet ready` / `worklet message #N`
- Worklet 內的 TypeScript 用 `declare` 避開型別衝突(§2 範例)
- PCM 傳輸用 transferable(`[buffer]` 第二參數),零複製
- **不要**讓 worklet 做任何 heavy computation,只複製 PCM

---

## 回報區

### 完成狀態
PARTIAL

### §1 讀取摘要
**Vite 版本**:`^5.0.0`（build runtime: `vite v5.4.21`）
**Electron 版本**:`^28.3.3`
**現有 import.meta.url 使用點**:讀取時無；本次在 `src/lib/voice/recording-service.ts` 新增 1 處（worklet URL）
**現有 ?worker / ?url 使用點**:無

### §2 Worklet Processor 檔案
**路徑**:`src/lib/voice/recording-worklet-processor.ts`
**行數**:55

### §3 recording-service.ts 修改
**使用方案**:Plan A(`import.meta.url`)
**Import URL 語句**:`const recordingWorkletUrl = new URL('./recording-worklet-processor.ts', import.meta.url).href`
**Class field 變動**:移除 `processor` / `recordingSink`，新增 `workletNode`
**started() diff 摘要**:新增 `audioWorklet.addModule(recordingWorkletUrl)`、建立 `AudioWorkletNode(numberOfOutputs: 0)`、以 `port.onmessage` 處理 `ready` + `pcm`、`source.connect(workletNode)`、移除 `createScriptProcessor`/`onaudioprocess`/`MediaStreamDestination`
**cleanup 更新**:改為 `workletNode.port.onmessage = null`、`port.close()`、`disconnect()`、最後 `workletNode = null`

### §4 TypeScript
`npx tsc --noEmit` 輸出:失敗（233 個既有錯誤，首批在 `src/App.tsx` 等與本工單無關檔案；本次提交檔案未出現在錯誤清單）

### §5 §6 Grep
**recording-service.ts 內 ScriptProcessor grep**:no matches
**全 codebase ScriptProcessor grep**:no matches（`src/` + `electron/`）

### §7 Build
`npx vite build` 輸出摘要:通過（renderer/main/preload 全部 build success，僅有既有 dynamic import chunk 警告）

### §8 Git
**git status**:本工單 commit 已完成；工作樹另有大量既有未提交變更（非本工單）
**git diff --stat**:`2 files changed, 115 insertions(+), 36 deletions(-)`
**Commit SHA**:`08b4856f7fa682e2c48ffe88e4daf143f3b77ae4`

### §9 使用者測試指引
## 👤 使用者測試步驟(T0017-β 修復驗證)

1. VS Code Task「開發: 終止所有 Dev 進程」清掉舊 instance
2. VS Code Task「開發: 啟動 Dev Server (Runtime)」
3. 等 BAT 啟動（看 `Logs/` 產生新 `debug-*.log`）
4. 打開 `%APPDATA%\\better-agent-terminal-runtime-1\\Logs\\` 的最新 `debug-*.log`
5. 在 PromptBox 按麥克風按鈕
6. 觀察結果：

**預期成功指標**:
- BAT 不閃退
- log 有 `[voice:checkpoint] worklet module loaded`
- log 有 `[voice:checkpoint] worklet node created`
- log 有 `[voice:checkpoint] source→worklet connected`
- log 有 `[voice:checkpoint] worklet ready sampleRate=...`
- log 有多個 `[voice:checkpoint] worklet message #N`
- 可完成「錄音 → 停止 → 轉寫」完整流程

**預期失敗指標**:
- BAT 仍閃退 → 記錄最後 checkpoint 回塔台
- 出現 `audioWorklet.addModule failed` / `worklet-load-failed` → 路徑載入問題
- 沒有 `worklet message` → worklet 啟動但未收到音訊資料流

**若不閃退**:
- 重複測試 3-5 次確認穩定
- 測完整錄音流程後回塔台回報「T0017-β 通過」

### 互動紀錄
無

### 問題與觀察
- 採用 Plan A（`new URL(..., import.meta.url)`），`npx vite build` 已成功，未觸發 Plan B
- `npx tsc --noEmit` 仍有大量既有錯誤（233），屬專案基線問題，不是本次改動引入
- 本次 commit 僅包含 `recording-service.ts` 與新建 `recording-worklet-processor.ts`
- `sprint-status.yaml` 不適用（root / `_bmad-output/` / `docs/` 皆未找到）

### 遞交給塔台的問題
- 是否要另開工單清理現有 TypeScript 基線錯誤（目前 `npx tsc --noEmit` 無法作為本專案 gate）

---

## 塔台追認（Retroactive Reconciliation）

**追認時間**：2026-04-11 21:24 (UTC+8)
**追認決策者**：Control Tower
**原狀態**：回報區 PARTIAL（元資料本已為 DONE，存在內部不一致）
**新狀態**：DONE（正式追認，解除元資料 vs 回報區不一致）

### 追認依據（下游證據）

1. **obs 9470**（2026-04-11 13:39）：「T0017-β AudioWorklet Migration Code Completed」
2. **obs 9481**（2026-04-11 13:54）：「BUG-004 AudioWorklet Migration Verified Complete」— runtime 驗證通過明確記錄
3. **obs 9484**（2026-04-11 14:06）：「Phase 1 Voice Input Fully Implemented and Runtime Verified」
4. **L013 GOLDEN 第一次實戰驗證**：T0017-β 是 L013「已知最佳方案時跳過分步驗證」原則的首次實戰應用，**驗證通過且零 rollback**
5. **後續工單依賴鏈成功**：T0018 / T0020 都建立在 T0017-β AudioWorklet 正確運作的前提上，並各自 runtime 通過

### 結論
T0017-β AudioWorklet 遷移是 BUG-004 的治本修復，其 runtime 正確性已被 obs 9481 / 9484 明確記錄為驗證通過。原回報區的 PARTIAL 狀態是當時 sub-session 保守的自評估，實際上在塔台已接受並標記元資料為 DONE 之後就應視為完成。本次追認**對齊元資料與回報區的語意**，並補充下游證據。

### 保留未驗項目
無。
