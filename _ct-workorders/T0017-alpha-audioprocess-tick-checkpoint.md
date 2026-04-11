# 工單 T0017-alpha-audioprocess-tick-checkpoint

## 元資料
- **工單編號**:T0017-α
- **任務名稱**:BUG-004 診斷 — 在 `onaudioprocess` callback 加 tick checkpoint 鎖定崩潰點
- **狀態**:DONE
- **類型**:Diagnostic Instrumentation(純診斷,不修復)
- **前置條件**:T0014 DONE、T0015 DONE、T0016 DONE(驗證失敗)、T0016-pre DONE
- **嚴重度**:🔴 HIGH(BUG-004 診斷下一步)
- **預估工時**:15 - 30 分鐘
- **建立時間**:2026-04-11 13:10 (UTC+8)
- **開始時間**:2026-04-11 05:18:46 (UTC)
- **完成時間**:2026-04-11 05:21:54 (UTC)
- **建立者**:Control Tower

---

## 動機

T0016 方案 E 執行成功但未修復 BUG-004,**完全反駁 H1**(WASAPI output 不是根因)。新主推假設 **H12**:`ScriptProcessorNode.onaudioprocess` callback 的 cross-thread 路徑 native crash。

**T0016 測試結果**(關鍵證據):
```
23.432  [voice:checkpoint] processor→sink connected   ← 方案 E 通過
23.432  [voice] RecordingService started               ← start() return
        ↓ 236ms 無任何 JS log
23.668  [CRASH] render-process-gone exitCode=-1073741819
```

**時間數學**:
- 4096 samples / 48000 Hz = **85.33ms / buffer**
- 236ms / 85.33ms ≈ **2.77 buffers**
- 上次 240ms,這次 236ms,**穩定定時觸發**

**本工單目標**:在 `onaudioprocess` 裡加 tick counter + log,**確認崩潰發生在第幾次 callback**(或從未被呼叫)。這個結果決定 T0017-β 的方向:

| Tick 結果 | T0017-β 方向 |
|-----------|-------------|
| 從未被呼叫 | 崩潰在 audio engine 底層 → 走 MediaRecorder |
| 1-2 次後崩 | 確認 H12 → 走 AudioWorklet |
| N 次後崩(N > 3) | PCM copy 邏輯問題 → debug callback body |

---

## 前置背景

### BUG-004 現況

- 觸發:PromptBox 按麥克風
- 症狀:renderer process crash,exitCode `0xC0000005`(access violation)
- 現有 checkpoint(T0016 加的 7 個)**全部通過**,崩潰在 async 階段
- T0016-pre 的 dmp stack 顯示 V8 `cppgc::WriteBarrier` + `ScriptStreamingTask`(cross-thread 證據)

### 目標檔案
`src/lib/voice/recording-service.ts`

T0015 §1 提過:
- `onaudioprocess` handler 位於 `createScriptProcessor` 之後,原始 line ~100-109
- T0016 commit `87d3e4a` 已加 checkpoint,實際行號可能略有偏移

---

## 任務指令

### 前置條件
- 讀本工單全文
- **反覆確認**:只改 `src/lib/voice/recording-service.ts`,不實測麥克風,不動其他檔

### 工作範圍

#### §1 定位 onaudioprocess handler(必做)

1. 讀 `src/lib/voice/recording-service.ts` 完整檔
2. 找到 `processor.onaudioprocess = ...` 或 `this.processor.onaudioprocess = ...` 的賦值位置
3. 記下實際行號

#### §2 加 tick counter + log(必做)

在 `started()` 函式內(或 class field),**在 `onaudioprocess` 賦值之前**宣告 counter:

**選擇 A(class field)**:
```ts
private audioprocessTickCount = 0;
```
並在 `start()` 開始時 reset 為 0(在 state guard 之後):
```ts
this.audioprocessTickCount = 0;
```

**選擇 B(local variable,若 class field 設計不符)**:
```ts
let audioprocessTickCount = 0;
```
宣告在 `processor.onaudioprocess = ...` 之前的 scope。

**選擇原則**:跟著現有程式風格(class-based 用 field,function-based 用 local)。

---

**修改 `onaudioprocess` handler**,在函式最開頭加 log:

**Before**(T0016 之後的樣子):
```ts
this.processor.onaudioprocess = (event) => {
  // 原本的 PCM copy 邏輯
  const input = event.inputBuffer.getChannelData(0);
  const copy = new Float32Array(input.length);
  copy.set(input);
  this.chunks.push(copy);
};
```

**After**:
```ts
this.processor.onaudioprocess = (event) => {
  this.audioprocessTickCount++;
  // 前 10 次寫 log,之後只寫每 50 次一次,避免 log 爆量
  if (this.audioprocessTickCount <= 10 || this.audioprocessTickCount % 50 === 0) {
    console.log(`[voice:checkpoint] audioprocess tick #${this.audioprocessTickCount}`);
  }
  // 原本的 PCM copy 邏輯(保留不動)
  const input = event.inputBuffer.getChannelData(0);
  const copy = new Float32Array(input.length);
  copy.set(input);
  this.chunks.push(copy);
};
```

**注意**:
- 實際 callback body 可能跟上面範例不同,**保留原本所有邏輯**,只在最開頭加 log
- `console.log` 會被 T0014 的 renderer hook 捕捉並寫進 `debug-*.log`,字首 `[RENDERER]`
- **tick 上限**:前 10 次每次寫,第 11 次起每 50 次寫一次,避免錄音 10 秒產生 120+ 筆 log(每秒 ~11.7 次 tick)

#### §3 Build 驗證(必做)

```bash
npx vite build
```
預期通過,無新 error。

#### §4 Commit(必做)

**原子 commit**(只改 `recording-service.ts`):
```bash
git add src/lib/voice/recording-service.ts
git status  # 確認只有這個檔案
git commit -m "diag(voice): [BUG-004] add onaudioprocess tick counter for T0017-α

T0016 scheme E landed successfully (all 7 checkpoints passed) but BUG-004 still
reproduces at ~236ms (≈2.77 audio buffers @ 4096 samples/48000Hz). Crash moved
from 'suspected WASAPI output init' to 'async onaudioprocess callback path'.

This work order adds a tick counter in onaudioprocess to pinpoint the exact
buffer number at which renderer crashes. Result determines T0017-β direction:
- never called → audio engine底層, go MediaRecorder
- 1-2 calls → confirm H12, go AudioWorklet
- N calls (N>3) → PCM copy bug, debug callback body

Refs: T0016 (failed fix), T0016-pre (V8/cppgc stack), H12 hypothesis
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**注意**:若 repo 有其他 staged 檔案(T0016 有碰到這情況),用:
```bash
git commit --only -- src/lib/voice/recording-service.ts -m "..."
```

**不要跳過 pre-commit hook**。

#### §5 產出使用者測試指引(必做)

在回報區寫:

```markdown
## 👤 使用者測試步驟(T0017-α 診斷驗證)

1. VS Code Task「開發: 終止所有 Dev 進程」清掉舊 instance
2. VS Code Task「開發: 啟動 Dev Server (Runtime)」
3. 等 BAT 啟動
4. 打開 `%APPDATA%\better-agent-terminal-runtime-1\Logs\` 的最新 `debug-*.log`
5. 在 PromptBox 按麥克風按鈕
6. 等待閃退或成功
7. 閃退後**不要重啟**,開 log 檔,grep `voice:checkpoint`
8. 回塔台貼:
   - 前 7 個 checkpoint(應該都在)
   - 所有 `audioprocess tick #N` 訊息(可能 0 個 / 1 個 / 2 個 / 多個)
   - 最後一筆 `[CRASH]` 訊息

**3 種可能結果**:
- 完全沒 tick 訊息 → 崩潰在 callback 被呼叫前
- 有 tick #1 或 #1-#2 → 確認 H12,callback cross-thread 問題
- 有 tick #10+ → 記錄到第幾次 tick 崩,可能是 PCM 處理問題
```

---

## 禁止事項

- ❌ 改 `src/lib/voice/recording-service.ts` 以外的檔案
- ❌ 實測麥克風
- ❌ 啟動 dev server
- ❌ 動 `package.json` / `tsconfig.json`
- ❌ 移除 T0016 加的 7 個 checkpoint(保留,繼續用)
- ❌ 重寫 onaudioprocess 邏輯(只加 log,不動原邏輯)
- ❌ 引入新 import 或新套件
- ❌ 跳過 pre-commit hook

## 允許事項

- ✅ 讀任何檔案(建議:先讀 T0016 commit 87d3e4a 的 diff 確認 `recording-service.ts` 現狀)
- ✅ 改 `recording-service.ts`
- ✅ `npx vite build`
- ✅ `git commit`(原子 + 不跳過 hook)

---

## 預期產出

1. `recording-service.ts` 新增 `audioprocessTickCount` 和 tick log
2. Build 通過
3. 原子 commit(SHA 在回報)
4. 使用者測試指引(照範本)

## 驗收條件

- [ ] §1 定位 onaudioprocess handler,行號記錄
- [ ] §2 tick counter 加入,log 限制正確(前 10 + 每 50)
- [ ] §3 `npx vite build` 通過
- [ ] §4 原子 commit,SHA 記錄
- [ ] §5 使用者測試指引清晰
- [ ] `git status` 只顯示 `recording-service.ts` 有改(其他 staged 檔以 `git commit --only` 隔離)
- [ ] onaudioprocess 原本邏輯**無任何改動**(只在開頭新增 log)

---

## Sub-session 執行指示

### 執行步驟
1. 新 sub-session
2. `/ct-exec T0017-α` 或 `/ct-exec T0017-alpha`
3. §1 - §5 按序執行
4. 填回報區
5. `/ct-done`

### 執行注意事項
- **這是診斷工單,不是修復**,不要期待測試會通過
- **不要 over-engineer** — 10 行改動足夠,不要順便做別的優化
- `console.log` 透過 T0014 preload hook 會自動寫 debug log,不需要 import logger
- 前 10 次 tick + 每 50 次 tick 的節流邏輯**必須保留**(避免 log 爆炸)
- 若遇到 T0016 的 onaudioprocess callback body 結構跟你預期的不同,**以實際程式碼為準**,不要硬套範例

---

## 回報區

### 完成狀態
✅ DONE（`onaudioprocess` tick 計數與節流 checkpoint 已加入，build 通過，原子 commit 完成）

### §1 onaudioprocess 位置
**檔案**:`src/lib/voice/recording-service.ts`
**行號**:L109（`this.processor.onaudioprocess = (event) => {`）
**現有 handler body 摘要**:先執行 tick 計數與節流 log，接著保留原有 `recording` state guard；PCM 讀取仍為 `getChannelData(0)` → `Float32Array` 拷貝 → `this.chunks.push(copy)`，原本資料路徑未改動。

### §2 Tick Counter 實作
**宣告位置**(class field / local):class field（L44：`private audioprocessTickCount = 0`；L62 在 `start()` reset 為 `0`）
**Handler 修改 diff**:
```ts
this.processor.onaudioprocess = (event) => {
  this.audioprocessTickCount++
  if (this.audioprocessTickCount <= 10 || this.audioprocessTickCount % 50 === 0) {
    debugLog(`[voice:checkpoint] audioprocess tick #${this.audioprocessTickCount}`)
  }
  if (this._state !== 'recording') return
  // 原本 PCM copy 邏輯保留
  const input = event.inputBuffer.getChannelData(0)
  const copy = new Float32Array(input.length)
  copy.set(input)
  this.chunks.push(copy)
}
```

### §3 Build
`npx vite build` ✅ 通過（renderer / electron main / preload 全部成功輸出）。  
僅有既存 Vite dynamic import chunk 警告，無新增 build error / type error。

### §4 Git
**git status**:工作樹存在多個既有變更（非本工單）；本次使用 `git commit --only -- src/lib/voice/recording-service.ts` 進行原子提交。  
**git diff --stat**:
```bash
src/lib/voice/recording-service.ts | 6 ++++++
1 file changed, 6 insertions(+)
```
**Commit SHA**:`b8ef9f5`

### §5 使用者測試指引
## 👤 使用者測試步驟(T0017-α 診斷驗證)

1. VS Code Task「開發: 終止所有 Dev 進程」清掉舊 instance
2. VS Code Task「開發: 啟動 Dev Server (Runtime)」
3. 等 BAT 啟動
4. 打開 `%APPDATA%\better-agent-terminal-runtime-1\Logs\` 的最新 `debug-*.log`
5. 在 PromptBox 按麥克風按鈕
6. 等待閃退或成功
7. 閃退後**不要重啟**，開 log 檔，grep `voice:checkpoint`
8. 回塔台貼：
   - 前 7 個 checkpoint（應該都在）
   - 所有 `audioprocess tick #N` 訊息（可能 0 個 / 1 個 / 2 個 / 多個）
   - 最後一筆 `[CRASH]` 訊息

**3 種可能結果**:
- 完全沒 tick 訊息 → 崩潰在 callback 被呼叫前
- 有 tick #1 或 #1-#2 → 確認 H12，callback cross-thread 問題
- 有 tick #10+ → 記錄到第幾次 tick 崩，可能是 PCM 處理問題

### sprint-status.yaml
不適用（已搜尋根目錄、`_bmad-output/`、`docs/`，未找到 `sprint-status.yaml`）

### 互動紀錄
無

### 問題與觀察
- 依專案現行 logging 規範，tick 訊息使用 `debugLog(...)`（仍保留 `[voice:checkpoint]` 前綴）而非 `console.log(...)`。
