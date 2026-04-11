# 工單 T0016-bug004-voice-crash-hotfix

## 元資料
- **工單編號**:T0016
- **任務名稱**:BUG-004 修復 — 方案 E(MediaStreamDestination 繞過 WASAPI output)+ checkpoint logging
- **狀態**:DONE
- **類型**:Hotfix(最小侵入修復 + 診斷增強)
- **前置條件**:T0014 DONE、T0015 DONE
- **嚴重度**:🔴 HIGH(Phase 1 驗收阻斷)
- **預估工時**:30min - 1h
- **建立時間**:2026-04-11 12:35 (UTC+8)
- **開始時間**:2026-04-11 12:20:28 (UTC+08:00)
- **完成時間**:2026-04-11 12:34:42 (UTC+08:00)
- **建立者**:Control Tower
- **關聯**:BUG-004、T0015(H1 假設)、T0016-pre(平行 dmp 分析)

---

## 動機

T0015 鎖定 BUG-004 根因假設 H1:**Web Audio 啟動鏈在 `processor.connect(audioContext.destination)` 觸發 WASAPI output 初始化時 native crash**。

塔台進階分析後提出**方案 E**:用 `createMediaStreamDestination()`(虛擬 sink)取代 `audioContext.destination`(實體喇叭),**繞過 WASAPI output 初始化**。

本工單:
1. 實作方案 E(**單行改動 + field 宣告**)
2. 在 `started()` 函式關鍵步驟後加 **checkpoint logging**
3. Build verification
4. 交付使用者手動 runtime 驗證(按麥克風)

**為什麼要 checkpoint logging?**
- 無論方案 E 修不修得好,checkpoint 都能鎖定崩潰的**精確步驟**
- 若方案 E 成功 → 驗證 H1,checkpoint 可移除或保留
- 若方案 E 失敗 → checkpoint 告訴我們**新的根因位置**,T0017 有明確起點

---

## 前置背景

### BUG-004 時間軸(T0014 logger 捕捉)

```
11:47:56.884  [RENDERER] [voice] RecordingService started (sampleRate=48000)
11:47:56.884  [RENDERER] [voice] useVoiceRecording: recording started
                          ↓ 240ms
11:47:57.124  [ERROR] [CRASH] render-process-gone reason=crashed exitCode=-1073741819
```

### T0015 鎖定的崩潰鏈(`src/lib/voice/recording-service.ts:37-169`)

```
started():
  1. state guard            line 52-54
  2. capability guard       line 55-57
  3. setup state/chunks     line 59-60
  4. getUserMedia           line 63-71    ✓
  5. error mapping          line 72-82
  6. AudioContext ctor      line 85-91    ✓
  7. new AudioContext()     line 93       ✓  ← sampleRate 從這來
  8. createMediaStreamSource line 95      ✓
  9. createScriptProcessor  line 100-109  ⚠️ DEPRECATED API
 10. source.connect(proc)   line 110      ✓
 11. proc.connect(dest)     line 114      🔥 ← **懷疑崩潰點**
 12. log: "started"         line 116      ✓
 13. return                 line 117
        ↓ 240ms(JS 無動作)
     🔥 NATIVE CRASH (0xC0000005)
```

**關鍵**:第 11 步 `processor.connect(this.audioContext.destination)` 把 audio graph 連到**實體喇叭輸出**,觸發 Chromium 的 WASAPI output pipeline 初始化。

### 方案 E 的改動思路

**原本**:
```ts
this.processor.connect(this.audioContext.destination);
```

**改成**:
```ts
// 方案 E:用虛擬 sink 繞過 WASAPI output 初始化(BUG-004)
this.recordingSink = this.audioContext.createMediaStreamDestination();
this.processor.connect(this.recordingSink);
```

**原理**:
- `ScriptProcessorNode` 必須 connect 到下游才會觸發 `onaudioprocess` 回呼
- 原本 connect 到 `audioContext.destination`(=實體喇叭輸出)
- 改成 `MediaStreamDestination`(虛擬輸出節點,不觸發 WASAPI 實體裝置初始化)
- `onaudioprocess` 仍然正常觸發,PCM chunks 照常收集

**附帶好處**:原本會把麥克風音訊送到喇叭(可能造成 feedback,雖然有 echoCancellation),方案 E 也順便解決這個潛在問題。

---

## 工作量預估

| 階段 | 預估 |
|------|------|
| §1 讀 `recording-service.ts` | 10min |
| §2 加 checkpoint logging(7-8 個點) | 10min |
| §3 實作方案 E | 5min |
| §4 TypeScript + Build 驗證 | 5 - 10min |
| §5 Grep 其他 destination 使用點 | 5min |
| §6 Commit + 回報 | 5min |
| §7 產出使用者測試指引 | 5min |
| **總計** | **30min - 1h** |

---

## Session 建議

- 新 sub-session,與 T0016-pre **分開**
- 任一終端皆可,不需啟動 dev server
- `/ct-exec T0016` 觸發

---

## 任務指令

### 前置條件
- 讀本工單全文
- **反覆確認紅線**:只改 `src/lib/voice/recording-service.ts`,不實測麥克風,不動 T0016-pre 的東西
- T0016-pre 正在平行執行,**不要**動 `_ct-workorders/reports/T0016-pre-*` 檔案

### 工作範圍

#### §1 讀取目標檔案

完整讀 `src/lib/voice/recording-service.ts`,確認:
- `started()` 函式的完整結構
- `RecordingService` class 的所有 private fields
- 現有的 `cleanup()` / `stop()` / `cancel()` 方法(方案 E 的 sink 需要在這些路徑清理)
- 現有的 import(確認 `logger` 或等效的 log 方法可用)

**注意**:T0015 報告中的行號(37-169)可能因 T0014 改動已輕微偏移,**以實際讀到的為準**,不要硬套行號。

#### §2 加 Checkpoint Logging

在 `started()` 函式內的關鍵步驟**後立即**加一行 log 呼叫。**總共 7-8 個 checkpoint**:

| # | 位置(語意) | Log 訊息 |
|---|------------|---------|
| 1 | `getUserMedia` 成功後(設定 `this.stream` 之前或之後) | `[voice:checkpoint] getUserMedia ok` |
| 2 | `AudioContext` ctor 解析後(`ContextCtor` 變數拿到之後) | `[voice:checkpoint] AudioContext ctor resolved` |
| 3 | `new AudioContext()` 完成後 | `[voice:checkpoint] AudioContext created sampleRate=${this.sourceSampleRate}` |
| 4 | `createMediaStreamSource()` 完成後 | `[voice:checkpoint] source node created` |
| 5 | `createScriptProcessor()` 完成後 | `[voice:checkpoint] processor created (4096,1,1)` |
| 6 | `source.connect(processor)` 完成後 | `[voice:checkpoint] source→processor connected` |
| 7 | `processor.connect(sink)` 完成後(**改動後的**) | `[voice:checkpoint] processor→sink connected` |

**每個 checkpoint 都用 `console.log(...)` 或現有 logger 機制**(透過 T0014 的 preload hook,這些會自動被寫入 debug-*.log 的 `[RENDERER]` 區段)。

**範例**(使用 console.log,假設沒有 import logger):
```ts
this.stream = await navigator.mediaDevices.getUserMedia(constraints);
console.log('[voice:checkpoint] getUserMedia ok');
```

或若檔案已有自定義 logger:
```ts
import { logger } from '../../utils/logger';  // 或實際路徑
// ...
logger.log('[voice:checkpoint] getUserMedia ok');
```

**選擇原則**:用檔案現有的 log 機制,不要新加 import 或依賴。若檔案完全沒 log 呼叫,用 `console.log`(T0014 的 renderer hook 會接住)。

#### §3 實作方案 E

在 `RecordingService` class 加 field:
```ts
private recordingSink: MediaStreamAudioDestinationNode | null = null;
```

修改 `processor.connect(this.audioContext.destination)` 那一行:
```ts
// BEFORE:
this.processor.connect(this.audioContext.destination);

// AFTER:
// BUG-004 修復:用 MediaStreamDestination(虛擬 sink)繞過 WASAPI output 初始化
// 原本 connect 到 audioContext.destination 會觸發實體喇叭輸出裝置初始化,
// 在某些 Windows 音訊 driver 環境下導致 renderer 崩潰(0xC0000005)。
// MediaStreamDestination 是虛擬輸出節點,ScriptProcessorNode 仍能正常運作。
this.recordingSink = this.audioContext.createMediaStreamDestination();
this.processor.connect(this.recordingSink);
```

**更新 cleanup 邏輯**:找到現有 `cleanup()` / `stop()` / `cancel()` / `dispose()` 等方法(T0015 §2 提過有 unmount cleanup),在清理 `processor` 的地方同步清理 `recordingSink`:
```ts
// 現有 cleanup 的風格,例如:
if (this.recordingSink) {
  try { this.recordingSink.disconnect(); } catch {}
  this.recordingSink = null;
}
```

**注意**:
- `MediaStreamAudioDestinationNode` 是 TypeScript `lib.dom.d.ts` 原生型別,不需要額外 import
- `createMediaStreamDestination()` 是 `AudioContext` 實例方法,標準 Web Audio API
- 所有現代瀏覽器和 Electron 都支援

#### §4 TypeScript + Build 驗證

```bash
# TypeScript 檢查
npx vite build
# 或
npx tsc --noEmit
```

預期:無錯誤,無新的 warning。

若遇到 type error(罕見),檢查 `tsconfig.json` 的 `lib` 有沒有 `"DOM"`。

**build 失敗不要硬修** — 在回報區 highlight 並回塔台。

#### §5 Grep 其他 `destination` 使用點(防呆)

```bash
# 在整個 src/ 和 electron/ grep
grep -rn "audioContext\.destination\|\.destination\b" src/ electron/ 2>/dev/null | grep -v "\.test\.\|\.spec\.\|node_modules"
```

若發現其他使用 `audioContext.destination` 的地方:
- **不要改**(本工單範圍只動 `recording-service.ts`)
- 在回報區 list 出來讓塔台評估是否另案

#### §6 Commit

**原子 commit**:
```bash
git add src/lib/voice/recording-service.ts
git status  # 確認只有這一個檔案
git commit -m "fix(voice): [BUG-004] bypass WASAPI output via MediaStreamDestination + checkpoint logging

BUG-004 symptom: renderer process crashes with 0xC0000005 (STATUS_ACCESS_VIOLATION)
when pressing mic button. Crash occurs ~240ms after RecordingService.start() returns,
no JS errors, no child-process-gone. T0015 root cause analysis (H1): processor.connect
to audioContext.destination triggers Chromium WASAPI output pipeline initialization,
which fails in some Windows audio driver environments.

Fix (Scheme E): Replace audioContext.destination with createMediaStreamDestination()
as the ScriptProcessorNode sink. This bypasses physical speaker output initialization
while still allowing onaudioprocess callbacks to fire normally.

Additionally adds 7 checkpoint logs in started() to pinpoint crash step in case
this fix is insufficient.

Refs: T0014 (crash-safe logger), T0015 (root cause audit), T0016-pre (dmp analysis)
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

> ⚠️ 注意:本專案 CLAUDE.md 有明確規則,commit 不要跳過 hooks(`--no-verify`)。若 pre-commit hook 失敗,**停手回報塔台**,不要硬推。

#### §7 產出使用者測試指引

在回報區「使用者測試指引」段寫:

```markdown
## 👤 使用者測試步驟(T0016 修復驗證)

1. 停掉目前正在跑的 dev server(若有):
   VS Code Task「開發: 終止所有 Dev 進程」或 `pwsh .vscode/scripts/kill-dev.ps1`

2. 重新啟動 dev server(runtime 變體):
   VS Code Task「開發: 啟動 Dev Server (Runtime)」或 `npm run dev-runtime`

3. 等 BAT 啟動完成(看 Logs/ 有新 `debug-*.log` 產生)

4. 打開檔案總管到 `%APPDATA%\better-agent-terminal-runtime-1\Logs\`
   把最新的 `debug-*.log` 打開,準備觀察

5. 在 BAT 的 PromptBox **按下麥克風按鈕**

6. 觀察結果:
   - ✅ **BAT 沒閃退** → 修復成功,log 應該有 7 個 `[voice:checkpoint]` 訊息
   - ❌ **BAT 仍閃退** → 找 log 的最後一個 `[voice:checkpoint]` 訊息,那一行的「下一步」就是崩潰點

7. 回塔台回報:
   - 閃退 / 不閃退
   - 若閃退,貼最後幾個 `[voice:checkpoint]` 訊息
   - 若不閃退,貼完整的 7 個 checkpoint 訊息證明修復成功
```

---

## 禁止事項

- ❌ **改 `src/lib/voice/recording-service.ts` 以外的檔案**(Grep §5 發現的另案處理)
- ❌ **實測麥克風按鈕**(會再炸一次)
- ❌ **啟動 dev server**(build only,不啟動 Electron)
- ❌ **動 `package.json` / `tsconfig.json`**(修復不需要改這些)
- ❌ **動 T0014 改的 logger 程式碼**
- ❌ **動 `_ct-workorders/reports/T0016-pre-*`**(T0016-pre 正在寫)
- ❌ **用 `--no-verify` 跳過 pre-commit hook**
- ❌ **over-engineer** — 不要順便改 AudioWorklet,不要順便優化其他地方

## 允許事項

- ✅ 讀任何檔案
- ✅ 改 `src/lib/voice/recording-service.ts`
- ✅ 跑 `npx vite build` / `npx tsc`
- ✅ Grep 整個 codebase
- ✅ 原子 commit(**不要**跳過 hook)

---

## 預期產出

1. `src/lib/voice/recording-service.ts` 修改後版本
2. git diff 摘要(在回報區)
3. build 成功確認
4. `git log` 的原子 commit
5. Grep §5 結果(其他 destination 使用點 list)
6. 使用者測試指引

---

## 驗收條件

- [ ] §1 完整讀取 recording-service.ts
- [ ] §2 加了 7 個 `[voice:checkpoint]` logger 呼叫
- [ ] §3 方案 E 實作(field 宣告 + 改 connect + 更新 cleanup)
- [ ] §4 `npx vite build` 通過
- [ ] §5 Grep 完成,結果列在回報區
- [ ] §6 原子 commit 成功(pre-commit hook 通過)
- [ ] §7 使用者測試指引清晰
- [ ] `git status` 只顯示 `src/lib/voice/recording-service.ts` 有修改
- [ ] **沒有**動其他檔案
- [ ] `MediaStreamAudioDestinationNode` 型別正確(TypeScript 不報錯)

---

## Sub-session 執行指示

### 執行步驟
1. 新 sub-session(與 T0016-pre 分開)
2. `/ct-exec T0016`
3. 依序 §1 - §7
4. 填回報區
5. `/ct-done T0016`

### 執行注意事項

- **T0016-pre 平行執行**,**不要**動 `_ct-workorders/reports/T0016-pre-dmp-analysis.txt`
- **不要 over-engineer** — 這是 hotfix,目標是最小改動修好 BUG-004
- **不要改 sampleRate 相關邏輯** — 即使你覺得應該改,也另案處理
- **不要改 ScriptProcessorNode 為 AudioWorklet** — 那是方案 D,本工單是方案 E
- 若 `createMediaStreamDestination()` 在你讀到的 AudioContext 型別上不存在(極罕見),可能是 `lib.dom.d.ts` 版本老,試 `tsc --target es2020 --lib "DOM,ES2020"`,若仍失敗回塔台
- checkpoint 用**同步 log**,不要 async/await 裡面 log(避免 event loop yield)
- 每個 checkpoint 的訊息**精確到字元**,方便後續 grep
- **FIELDGUIDE**:若專案有 `_ct-workorders/FIELDGUIDE.md`,先讀

---

## 回報區

### 完成狀態
✅ DONE（方案 E + 7 個 checkpoint + build + 原子 commit 已完成）

### §1 讀取摘要
- `src/lib/voice/recording-service.ts` 實際總行數：180 行
- `start()` 實際範圍：L52-L126
- `stop()` 實際範圍：L129-L142
- `cancel()` 實際範圍：L145-L151
- `cleanup()` 實際範圍：L153-L179（原有 processor/source/audioContext/stream 清理邏輯仍保留）

### §2 Checkpoint 加入位置
1. L84: `[voice:checkpoint] getUserMedia ok`
2. L94: `[voice:checkpoint] AudioContext ctor resolved`
3. L98: ``[voice:checkpoint] AudioContext created sampleRate=${this.sourceSampleRate}``
4. L100: `[voice:checkpoint] source node created`
5. L106: `[voice:checkpoint] processor created (4096,1,1)`
6. L117: `[voice:checkpoint] source→processor connected`
7. L123: `[voice:checkpoint] processor→sink connected`

### §3 方案 E 實作
**新增 field**: `private recordingSink: MediaStreamAudioDestinationNode | null = null`

**修改 connect 語句**:
```ts
// BEFORE
this.processor.connect(this.audioContext.destination)

// AFTER
this.recordingSink = this.audioContext.createMediaStreamDestination()
this.processor.connect(this.recordingSink)
```

**cleanup 更新**:
- L159：`if (this.recordingSink) this.recordingSink.disconnect()`
- L175：`this.recordingSink = null`

### §4 Build 驗證
`npx vite build` ✅ 通過（renderer / electron main / preload 皆成功輸出）  
備註：僅有既存 Vite dynamic import chunk 警告，無新增 type error / build error。

### §5 Grep 其他 destination 使用點
在 `src/` 與 `electron/` 執行 `audioContext\.destination|\.destination\b` 搜尋，結果為 **No matches found**。  
本次 hotfix 未發現其他需同步調整的 destination 使用點。

### §6 Git
**git status**:
```bash
?? _ct-workorders/T0016-bug004-voice-crash-hotfix.md
```

**git diff --stat**:
```bash
src/lib/voice/recording-service.ts | 19 +++++++++++++++----
1 file changed, 15 insertions(+), 4 deletions(-)
```

**Commit SHA**:
`87d3e4a`

### §7 使用者測試指引
## 👤 使用者測試步驟(T0016 修復驗證)

1. 停掉目前正在跑的 dev server（若有）：  
   VS Code Task「開發: 終止所有 Dev 進程」或 `pwsh .vscode/scripts/kill-dev.ps1`
2. 重新啟動 dev server（runtime 變體）：  
   VS Code Task「開發: 啟動 Dev Server (Runtime)」或 `npm run dev-runtime`
3. 等 BAT 啟動完成（確認 `Logs/` 產生新的 `debug-*.log`）
4. 打開 `%APPDATA%\\better-agent-terminal-runtime-1\\Logs\\` 的最新 `debug-*.log`
5. 在 BAT 的 PromptBox 按下麥克風按鈕
6. 觀察結果：  
   - ✅ 若不閃退：應可看到完整 7 個 `[voice:checkpoint]` 訊息  
   - ❌ 若仍閃退：最後一個 checkpoint 即為崩潰前最後成功步驟
7. 回塔台回報：  
   - 有無閃退  
   - 若閃退：貼最後幾個 `[voice:checkpoint]`  
   - 若不閃退：貼完整 7 個 checkpoint 佐證

### 問題與觀察
- `_ct-workorders/FIELDGUIDE.md` 不存在（已檢查）
- 倉庫存在大量與本工單無關的 staged/新增檔，本次以 `git commit --only -- src/lib/voice/recording-service.ts` 維持原子提交

### 遞交給塔台的問題
1. 若使用者驗證通過，是否在後續工單移除 7 個 checkpoint（保留最終穩定 log）？
2. 若仍閃退，是否以「最後 checkpoint 位置」直接開 T0017，並與 T0016-pre 的 dmp stack 做交叉比對？
