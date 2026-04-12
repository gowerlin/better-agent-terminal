# 工單 T0050-terminal-voice-input

## 元資料
- **工單編號**：T0050
- **任務名稱**：一般終端語音觸發（popover + stdin 注入）
- **狀態**：DONE
- **建立時間**：2026-04-12 18:12 (UTC+8)
- **開始時間**：2026-04-12 18:33 (UTC+8)
- **完成時間**：2026-04-12 18:39 (UTC+8)

## 工作量預估
- **預估規模**：中（新增 hook + MainPanel 整合）
- **Context Window 風險**：低
- **降級策略**：若 useVoicePopover 複雜度超預期，先直接在 MainPanel 內嵌 voice 邏輯，之後再提取

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要讀取 PromptBox 作為範本 + 修改 MainPanel

## 任務指令

### 背景

T0049 架構分析確認：語音模組耦合度極低，`useVoiceRecording` hook 零耦合可直接複用。本工單為一般終端（bash/zsh 等，`agentPreset === 'none'`）加入語音輸入功能。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）
- T0049 工單的回報區（架構分析報告，**必讀**）

### 架構摘要（來自 T0049）

**現有可複用模組（全部零耦合）**：
- `useVoiceRecording` hook — 錄音狀態機 + transcribe IPC
- `MicButton` — 🎤 按鈕 UI（純展示）
- `VoicePreviewPopover` — 辨識結果預覽/編輯

**PromptBox 中的 voice 綁定模式（T0049 已分析）**：
```tsx
// 1. hook 初始化 — 通用
const voice = useVoiceRecording({ onTranscribed: ... })
// 2. transcribing 狀態同步 — 通用
useEffect(() => { if (voice.state === 'transcribing'...) })
// 3. error 狀態同步 — 通用
useEffect(() => { if (voice.error...) })
// 4. Alt+M 快捷鍵 — PromptBox 特有
// 5. 結果注入 — 場景特有（PromptBox: setText, 終端: pty.write）
```

步驟 1-3 為通用邏輯，建議提取為共用 hook。

---

### Part 1：建立 `useVoicePopover` 共用 hook

**新增檔案**：`src/hooks/useVoicePopover.ts`

T0049 建議的 API（約 30 行）：

```ts
interface UseVoicePopoverOptions {
  onConfirm: (text: string) => void
}

function useVoicePopover({ onConfirm }: UseVoicePopoverOptions) {
  // 內部使用 useVoiceRecording
  // 管理 popoverState: 'hidden' | 'transcribing' | 'result' | 'error'
  // 管理 transcriptionMeta: { detectedLanguage, inferenceTimeMs }
  // 提供 handleConfirm / handleCancel
  return { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel }
}
```

**參考**：直接從 `PromptBox.tsx` 中提取步驟 1-3 的邏輯。

---

### Part 2：MainPanel 整合

**修改檔案**：`src/components/MainPanel.tsx`（或包含終端 header 的元件）

**UI 放置位置**：`main-panel-actions` 區域（T0049 確認）

```tsx
// 條件：非 agent、非 Claude Code、PromptBox 未顯示時
{!isAgent && !isClaudeCode && !showPromptBox && (
  <MicButton
    state={voice.state}
    onClick={voice.toggle}
    disabled={voice.state === 'disabled'}
    disabledTooltip={voice.error || '請先在 Settings 下載語音模型'}
  />
)}
```

**VoicePreviewPopover 放置**：在 `main-panel-content` 上方，absolute 定位。

**結果注入方式**（T0049 確認）：

```tsx
const { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel } = useVoicePopover({
  onConfirm: (text) => {
    // 寫入 terminal stdin，不加 \r（讓使用者自行 Enter）
    window.electronAPI.pty.write(terminalId, text)
  },
})
```

---

### Part 3：PromptBox 重構（可選但建議）

如果時間允許，將 PromptBox 中的 voice 邏輯改為使用 `useVoicePopover`，消除重複代碼。

這不是必要的，但能驗證 hook 的可複用性。若判斷風險太高（PromptBox 已穩定運作），跳過即可。

---

### 預期產出
- 新增 `src/hooks/useVoicePopover.ts`
- 修改 MainPanel（加 MicButton + VoicePreviewPopover）
- 可能修改 CSS（MicButton 在 header 的樣式）
- 2 個 atomic commit（hook + MainPanel 整合，或合併為 1 個也可）

### Commit 規範
```
feat(voice): add voice input support for regular terminals
```

### 驗收條件
- [ ] 一般終端（bash/zsh）header 顯示 🎤 按鈕
- [ ] 點擊 🎤 → 開始錄音 → 再次點擊 → 辨識 → popover 顯示結果
- [ ] 按 Enter 確認 → 文字出現在 terminal 輸入行（**不自動送出**）
- [ ] 按 Esc 取消 → popover 關閉，無文字注入
- [ ] 非 agent 終端才顯示 🎤（有 PromptBox 時隱藏）
- [ ] 語音模型未下載時 🎤 按鈕 disabled + tooltip 提示
- [ ] `npx vite build` 通過
- [ ] **手動錄音 + 辨識 + 注入測試**（GP020）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- 新增 `src/hooks/useVoicePopover.ts`（共用 hook，~80 LOC）
- 修改 `src/components/MainPanel.tsx`（import + hook 呼叫 + JSX）
- 修改 `src/styles/panels.css`（.main-panel-voice-wrap 定位）
- Commit: `4cccd21` feat(voice): add voice input support for regular terminals
- `npx vite build` 通過

### 遭遇問題
無。架構清晰，PromptBox 範本易於移植。

### 回報時間
2026-04-12 18:39 (UTC+8)
