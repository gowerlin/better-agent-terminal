# 工單 T0049-voice-input-architecture-analysis

## 元資料
- **工單編號**：T0049
- **任務名稱**：語音輸入架構分析 — 設計共用觸發介面（擴展到所有終端類型）
- **狀態**：DONE
- **建立時間**：2026-04-12 17:16 (UTC+8)
- **開始時間**：2026-04-12 17:19 (UTC+8)
- **完成時間**：2026-04-12 17:24 (UTC+8)

## ⚠️ 本工單為研究類 — 不做程式碼修改（GP005）

產出為架構分析報告，塔台根據報告決定 T0050/T0051 的實作策略。

## 工作量預估
- **預估規模**：中（需理解現有語音模組 + 三種終端的輸入機制）
- **Context Window 風險**：中（可能需讀取多個元件）
- **降級策略**：若程式碼量太大，優先分析 PromptBox 和 voice 相關檔案，Chat Box 次之

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要深入理解多個元件的架構關係

## 任務指令

### 背景

目前語音輸入（Whisper 辨識）只在非 Claude CLI Agent 的 PromptBox 中可用。需求是擴展到所有終端類型：

| 終端類型 | 現有輸入區 | 目標：語音觸發方式 | 辨識結果去向 |
|---------|-----------|------------------|-------------|
| 一般終端（bash/zsh 等） | shell prompt | 工具列 🎤 按鈕 or 快捷鍵 → popover | terminal stdin |
| 非 Claude CLI Agent | PromptBox | PromptBox 內 🎤（✅ 已有） | PromptBox textarea |
| Claude Agent V1/V2 | Chat Box | Chat Box 旁 🎤（新增） | Chat Box textarea |

**設計原則**：語音辨識模組共用，只是觸發入口和結果注入目標不同。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 調查步驟

#### Step 1：現有語音模組盤點
1. 找到語音相關的所有檔案：
   - Grep `whisper`、`voice`、`speech`、`microphone`、`recording`
   - 找到核心模組：錄音、辨識、popover UI
2. 繪製現有語音流程圖：
   - 使用者點 🎤 → 開始錄音 → 停止錄音 → 送 Whisper 辨識 → 取得文字 → 填入輸入區
3. 確認哪些邏輯是 PromptBox 綁定的，哪些可以獨立抽出

#### Step 2：PromptBox 元件分析
1. 找到 PromptBox 元件（搜尋 `PromptBox`、`promptbox`）
2. 分析：
   - PromptBox 與語音按鈕的耦合程度
   - 語音 popover 是 PromptBox 子元件還是獨立元件？
   - 辨識結果如何注入 textarea？（callback? ref? state?）
3. 確認 PromptBox 何時顯示/隱藏（條件判斷邏輯）

#### Step 3：Chat Box 元件分析
1. 找到 Claude Agent V1/V2 的 Chat Box 元件
   - 搜尋 `ChatBox`、`ChatInput`、`MessageInput`、`claude-agent`
2. 分析：
   - 輸入框的 ref 結構
   - 現有按鈕（送出按鈕等）的 layout
   - 加 🎤 按鈕的最佳插入點

#### Step 4：一般終端語音注入可行性
1. 確認一般終端（非 agent）的元件結構
   - 搜尋 `TerminalPanel`、terminal toolbar
2. 分析如何將文字寫入 terminal stdin：
   - `terminal.paste(text)`？
   - `pty.write(text)`？
   - 確認 IPC 路徑
3. 確認工具列按鈕的最佳放置位置

#### Step 5：共用介面設計
基於 Step 1-4，設計：
1. **共用 hook 或 service**：如 `useVoiceInput(onResult: (text: string) => void)`
2. **觸發入口抽象**：不同場景（按鈕/快捷鍵）統一觸發同一個錄音流程
3. **結果注入抽象**：不同場景（stdin/textarea）的注入邏輯
4. **Popover 可重用性**：語音 popover 是否需要從 PromptBox 提取為獨立元件

### 預期產出

調查報告（寫入回報區），包含：

1. **現有架構圖**：語音模組的檔案和依賴關係
2. **耦合分析**：哪些邏輯綁在 PromptBox，哪些可抽出
3. **Chat Box 結構**：加 🎤 的插入點和技術方案
4. **一般終端注入方案**：stdin 寫入的技術路徑
5. **共用介面設計建議**：hook/service 的 API 草案
6. **工作量預估**：T0050 和 T0051 各自的難度和預估改動範圍
7. **風險評估**：可能踩到的坑

### 驗收條件
- [ ] 語音相關檔案全部盤點
- [ ] PromptBox 與語音的耦合度已分析
- [ ] Chat Box 結構已分析，🎤 插入點已確認
- [ ] 一般終端 stdin 注入方案已確認
- [ ] 共用介面設計建議已提出
- [ ] T0050/T0051 工作量已預估
- [ ] **沒有修改任何程式碼**（GP005）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 現有架構圖

**語音模組檔案樹（完整盤點）：**

```
Renderer Process (src/)
├── types/
│   ├── voice.ts              — 核心 types: WhisperModelSize, VoicePreferences, VoiceTranscribeResult
│   └── voice-ipc.ts          — IPC channels 常數 (VOICE_IPC_CHANNELS)
├── lib/voice/
│   ├── index.ts              — 只 re-export RecordingService + encodeWav
│   ├── recording-service.ts  — 低層錄音：getUserMedia → AudioWorklet → WAV buffer
│   ├── wav-encoder.ts        — PCM Float32 chunks → 16kHz 16-bit mono WAV (Whisper格式)
│   └── recording-worklet-processor.ts — AudioWorklet processor (audio thread)
├── hooks/
│   └── useVoiceRecording.ts  — React hook: 錄音狀態機 + transcribe IPC 呼叫
└── components/
    ├── PromptBox.tsx          — 唯一使用 voice hook 的 UI 元件
    └── voice/
        ├── MicButton.tsx         — 🎤 按鈕 UI（無狀態，pure display）
        ├── VoicePreviewPopover.tsx — 辨識結果預覽/編輯 popover
        └── VoiceSettingsSection.tsx — Settings 頁面的語音設定區塊

Main Process (electron/)
├── voice-handler.ts          — Whisper IPC handlers（transcribe, download, list models...）
├── voice-opencc.ts           — OpenCC 繁體轉換
├── main.ts                   — 註冊 IPC channels
└── preload.ts                — 暴露 window.electronAPI.voice.*
```

**依賴關係：**
```
PromptBox.tsx
  └── useVoiceRecording (hook)
        ├── RecordingService (lib) → AudioWorklet PCM capture
        │     └── wav-encoder → WAV buffer
        └── window.electronAPI.voice.transcribe(wavBuffer) → IPC → voice-handler.ts
  ├── MicButton (display only)
  └── VoicePreviewPopover (display + confirm/cancel callbacks)
```

**語音完整流程：**
```
使用者點 🎤 / Alt+M
  → useVoiceRecording.toggle()
  → RecordingService.start() [getUserMedia → AudioWorklet]
  → 使用者再次點 🎤 / Alt+M
  → RecordingService.stop() → WAV buffer
  → window.electronAPI.voice.transcribe(wavBuffer, 16000)
  → IPC → electron/voice-handler.ts → whisper-node
  → onTranscribed(text, meta) callback
  → VoicePreviewPopover 顯示結果
  → 使用者按 Enter / 確認按鈕
  → onConfirm(finalText) → setText(prev + finalText)（PromptBox 的 textarea）
```

### 耦合分析

**耦合程度：極低（可直接複用）**

| 模組 | 與 PromptBox 耦合 | 可獨立複用 |
|------|-----------------|------------|
| `useVoiceRecording` hook | ❌ 零耦合，只需傳入 `onTranscribed` callback | ✅ 完全獨立 |
| `MicButton` | ❌ 零耦合，只接受 state/onClick props | ✅ 完全獨立 |
| `VoicePreviewPopover` | ⚠️ 輕微耦合（keydown 監聽說明中提到 PromptBox，實際程式碼無 import 依賴） | ✅ 完全獨立，onConfirm/onCancel 是純 callback |
| `RecordingService` | ❌ 零耦合，無 React 依賴 | ✅ 完全獨立 |

**PromptBox 中語音相關的綁定邏輯（需在新元件中仿製）：**
```tsx
// 1. hook 初始化
const voice = useVoiceRecording({ onTranscribed: (_text, result) => {
  setVoiceTranscriptionMeta({ ... })
  setVoicePreviewState('result')
}})

// 2. transcribing 狀態同步
useEffect(() => {
  if (voice.state === 'transcribing' && voicePreviewState === 'hidden')
    setVoicePreviewState('transcribing')
}, [voice.state, voicePreviewState])

// 3. error 狀態同步
useEffect(() => {
  if (voice.error && voicePreviewState !== 'hidden')
    setVoicePreviewState('error')
}, [voice.error, voicePreviewState])

// 4. Alt+M 快捷鍵（PromptBox 限定，isActive 控制）
useEffect(() => { ... window.addEventListener('keydown', handler) }, [isActive, voice.toggle])

// 5. 結果注入（PromptBox 特有）
onConfirm={(finalText) => {
  setText((prev) => prev ? prev + ' ' + finalText : finalText)
  setVoicePreviewState('hidden')
  voice.reset()
  textareaRef.current?.focus()
}}
```

**共用邏輯** = 步驟 1、2、3（可提取為共用 hook）
**場景特有邏輯** = 步驟 4（Alt+M 範圍）、步驟 5（注入目標不同）

### Chat Box 結構

**ClaudeAgentPanel 輸入區架構（~line 3140-3290）：**
```
<div class="claude-input-area">
  <div class="claude-slash-menu" />    ← 指令補全選單（條件顯示）
  <div class="claude-star-menu" />     ← star 指令選單（條件顯示）
  <textarea
    ref={textareaRef}                  ← 主輸入框
    className="claude-input"
    defaultValue=""
    onInput={handleInputChange}
    ...
  />
  <div class="claude-attachments" />   ← 附件預覽（條件顯示）
  <div class="claude-input-footer">
    <div class="claude-input-controls">   ← 左側：permission mode, model, effort
    <div class="claude-input-actions">    ← 右側：fork 🍴, attach 📎, send ▶/stop ■
  </div>
</div>
```

**🎤 按鈕最佳插入點：`claude-input-actions` 右側群組中，在 attach 📎 和 send ▶ 之間**

```tsx
// 在 <span onClick={handleSelectAttachments}> 和 <button onClick={handleSend}> 之間插入：
<MicButton
  state={voice.state}
  onClick={voice.toggle}
  disabled={voice.state === 'disabled'}
  disabledTooltip={voice.error || '請先在 Settings 下載語音模型'}
/>
```

**ClaudeAgentPanel 的文字注入方法（已有完善的 helper）：**
```ts
// setInputValue 是 ClaudeAgentPanel 內部 helper，同步更新 ref + textarea DOM
const setInputValue = useCallback((val: string) => {
  inputValueRef.current = val
  if (textareaRef.current) {
    textareaRef.current.value = val
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
  }
}, [])

// Voice onConfirm 只需：
const onVoiceConfirm = (text: string) => {
  const cur = inputValueRef.current
  setInputValue(cur ? cur + ' ' + text : text)
  textareaRef.current?.focus()
}
```

**VoicePreviewPopover 放置點：** 在 `claude-input-area` 的頂部或 `<textarea>` 上方（類似 PromptBox 的 popover 浮層位置），可用 `position: absolute` + `bottom: 100%` 策略。

### 一般終端注入方案

**一般終端 = `agentPreset === 'none'`（純 bash/zsh/etc.）**

**現有 stdin 寫入方式（兩種，都可用）：**

1. `window.electronAPI.pty.write(terminalId, text)` — 直接寫入 PTY stdin
   - ⚠️ 不附加 Enter（`\r`），讓使用者自己確認送出
   - ✅ 這是語音注入的正確方式
   
2. `terminalRef.current?.paste(text)` — 透過 xterm.js paste API
   - 使用 xterm 的 paste 機制，也寫入 PTY stdin
   - 適合長文字（已有大型貼上確認邏輯）
   - **推薦使用 `pty.write` 而非 paste**（語音結果通常短，無需大型貼上確認）

**UI 放置位置：MainPanel header 的 `main-panel-actions` 區域**

```tsx
// MainPanel.tsx 的 main-panel-actions 目前有：
// ActivityIndicator | 💬（isAgent && !isClaudeCode）| ↺（redraw）| ⏻（restart）| ×（close）

// 為一般終端加 🎤（!isAgent && !isClaudeCode）：
{!isAgent && !isClaudeCode && (
  <MicButton
    state={voiceState}
    onClick={voiceToggle}
    disabled={voiceState === 'disabled'}
  />
)}
```

**VoicePreviewPopover 放置點：** 在 `main-panel-content`（TerminalPanel）上方，absolute 定位固定於 header 下方。

**完整 stdin 注入流程：**
```
使用者點 header 🎤
  → voice 錄音 → 辨識
  → VoicePreviewPopover 顯示結果
  → 使用者按 Enter 確認
  → window.electronAPI.pty.write(terminalId, finalText)
  （不加 \r，讓使用者自行決定送出時機）
```

### 共用介面設計建議

**現有 `useVoiceRecording` hook 已是最佳共用介面，無需另建 service。**

```ts
// src/hooks/useVoiceRecording.ts（現有，無需修改）
const voice = useVoiceRecording({
  onTranscribed: (text, result) => { /* 各場景自行處理 */ }
})
// voice.state: 'idle' | 'recording' | 'transcribing' | 'disabled'
// voice.toggle()    — 開始/停止錄音
// voice.reset()     — 清除 error/transcription
// voice.error       — 錯誤訊息
// voice.lastTranscription — 最後結果
```

**建議提取的共用邏輯：`useVoicePopover` hook（可選，減少重複代碼）**

```ts
// src/hooks/useVoicePopover.ts（建議新增，~30 行）
interface UseVoicePopoverOptions {
  onConfirm: (text: string) => void
}

function useVoicePopover({ onConfirm }: UseVoicePopoverOptions) {
  const [popoverState, setPopoverState] = useState<VoicePreviewState>('hidden')
  const [transcriptionMeta, setTranscriptionMeta] = useState<{ detectedLanguage?: string; inferenceTimeMs?: number }>({})

  const voice = useVoiceRecording({
    onTranscribed: (_text, result) => {
      setTranscriptionMeta({ detectedLanguage: result?.detectedLanguage, inferenceTimeMs: result?.inferenceTimeMs })
      setPopoverState('result')
    },
  })

  // state syncs
  useEffect(() => {
    if (voice.state === 'transcribing' && popoverState === 'hidden') setPopoverState('transcribing')
  }, [voice.state, popoverState])

  useEffect(() => {
    if (voice.error && popoverState !== 'hidden') setPopoverState('error')
  }, [voice.error, popoverState])

  const handleConfirm = (finalText: string) => {
    onConfirm(finalText)
    setPopoverState('hidden')
    setTranscriptionMeta({})
    voice.reset()
  }

  const handleCancel = () => {
    setPopoverState('hidden')
    setTranscriptionMeta({})
    voice.reset()
  }

  return { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel }
}
```

使用方式（各場景只需 3-5 行接入）：
```tsx
// 一般終端 (MainPanel)
const { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel } = useVoicePopover({
  onConfirm: (text) => window.electronAPI.pty.write(terminalId, text),
})

// Claude Agent Chat Box (ClaudeAgentPanel)
const { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel } = useVoicePopover({
  onConfirm: (text) => setInputValue(inputValueRef.current ? inputValueRef.current + ' ' + text : text),
})
```

### 工作量預估

**T0050 — 一般終端（bash/zsh）加語音**

| 項目 | 估算 |
|------|------|
| 修改檔案 | `MainPanel.tsx`（+hook、+MicButton、+VoicePreviewPopover）+ `useVoicePopover.ts`（新建） |
| 新增 LOC | ~80-120 LOC（主要在 MainPanel） |
| CSS | ~20 行（調整 main-panel-header 的 MicButton 尺寸/位置） |
| 難度 | **低**（架構清晰，PromptBox 有現成範本可仿）|
| 預估時間 | 1-2 小時 |
| 測試重點 | 一般終端開語音 → 辨識 → 確認 → 文字出現在 terminal 輸入行（不自動送出） |

**T0051 — Claude Agent V1/V2 Chat Box 加語音**

| 項目 | 估算 |
|------|------|
| 修改檔案 | `ClaudeAgentPanel.tsx`（3635 行，需謹慎修改）|
| 新增 LOC | ~80-100 LOC（hook 初始化 + MicButton + VoicePreviewPopover + CSS class）|
| CSS | ~15 行（調整 claude-input-actions 中的 MicButton 樣式）|
| 難度 | **中**（ClaudeAgentPanel 巨大且複雜，需找到正確插入點）|
| 預估時間 | 2-3 小時 |
| 測試重點 | Claude Agent 輸入框開語音 → 辨識 → 確認 → 文字填入 textarea（不自動送出）|

**若先建 `useVoicePopover` hook（T0050 的前置工作）：**
- 可讓 T0050、T0051 都更簡潔
- 額外 ~30 行 + 測試（低風險）
- 建議在 T0050 中一起完成

### 風險評估

1. **ClaudeAgentPanel 體積風險（高）**
   - 3635 行單一元件，已有大量 state 和 effect
   - 風險：插入 voice hook 時 effect 依賴項遺漏導致閉包問題
   - 緩解：在固定位置（接近 textareaRef 宣告處）插入，嚴格仿照 PromptBox 的模式

2. **VoicePreviewPopover 定位問題（中）**
   - 目前 Popover 是 PromptBox 內的 relative 子元件，float 位置依 PromptBox layout
   - 在 MainPanel header 下方或 ClaudeAgentPanel 輸入框旁，需要 CSS absolute 重新定位
   - 緩解：可接受 Popover 暫時用 fixed 定位（確保不被裁切）

3. **Alt+M 快捷鍵範圍問題（低）**
   - 目前 Alt+M 只在 PromptBox 的 `isActive` 時生效
   - 新場景是否需要 Alt+M？需要產品決策
   - 建議：一般終端和 Chat Box 暫時不加 Alt+M，只做按鈕點擊觸發

4. **useVoiceRecording 多實例問題（低）**
   - 若同時有 PromptBox + MainPanel 都掛載 voice hook，兩者各自獨立（不共享 RecordingService）
   - 在 PromptBox 顯示時（非 Claude 且 showPromptBox=true），MainPanel 的 voice 按鈕是否需要隱藏？
   - 建議：T0050 中，PromptBox 顯示時隱藏 MainPanel 的 🎤（`{!isAgent && !isClaudeCode && !showPromptBox && ...}`）

5. **一般終端 isAgent 判斷（低）**
   - 目前 `!isAgent` = 一般終端（包含 agentPreset='none'）
   - 確認：一般終端的 toolbar 🎤 按鈕邏輯：`!isAgent && !isClaudeCode`
   - 邊界情況：agentPreset 為非 'none' 但非 integrated 的 agent → 有 PromptBox，不需要 MainPanel 🎤

### 遭遇問題
無

### 回報時間
2026-04-12 17:24 (UTC+8)
