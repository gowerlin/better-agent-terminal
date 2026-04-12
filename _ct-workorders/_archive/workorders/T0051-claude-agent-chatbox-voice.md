# 工單 T0051-claude-agent-chatbox-voice

## 元資料
- **工單編號**：T0051
- **任務名稱**：Claude Agent V1/V2 Chat Box 加語音輸入 🎤
- **狀態**：DONE
- **建立時間**：2026-04-12 18:45 (UTC+8)
- **開始時間**：2026-04-12 18:46 (UTC+8)
- **完成時間**：2026-04-12 18:53 (UTC+8)

## 工作量預估
- **預估規模**：中（ClaudeAgentPanel 3635 行巨型元件，需謹慎插入）
- **Context Window 風險**：中高（檔案巨大）
- **降級策略**：若 ClaudeAgentPanel 改動風險太高，回報 BLOCKED 讓塔台決策

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：ClaudeAgentPanel 巨大，需要乾淨 context 專注

## 任務指令

### 背景

T0049 架構分析 + T0050 已完成：
- `useVoicePopover` 共用 hook 已建立（`src/hooks/useVoicePopover.ts`）
- `MicButton` 和 `VoicePreviewPopover` 已驗證可獨立複用
- 一般終端的語音輸入已運作正常

本工單：在 Claude Agent V1/V2 的 Chat Box 輸入區加 🎤 按鈕。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）
- T0049 工單回報區（架構分析，**重要參考**）
- T0050 工單回報區（useVoicePopover 實作細節）

### ⚠️ 風險提醒

**ClaudeAgentPanel.tsx 約 3635 行**，是專案中最大的單一元件。修改需謹慎：
- 插入位置要精確，不要影響現有 state/effect
- hook 宣告放在其他 hook 附近（接近 textareaRef 宣告處）
- 若遇到不確定的依賴關係，寧可回報 BLOCKED

---

### 實作指引（來自 T0049 分析）

#### 1. Hook 初始化

在 ClaudeAgentPanel 元件內，接近 `textareaRef` 宣告處加入：

```tsx
import { useVoicePopover } from '../hooks/useVoicePopover'
import { MicButton } from './voice/MicButton'
import { VoicePreviewPopover } from './voice/VoicePreviewPopover'

// 在元件內部
const { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel } = useVoicePopover({
  onConfirm: (text) => {
    const cur = inputValueRef.current
    setInputValue(cur ? cur + ' ' + text : text)
    textareaRef.current?.focus()
  },
})
```

**注意**：`setInputValue` 是 ClaudeAgentPanel 內部已有的 helper（T0049 確認），同步更新 ref + textarea DOM + auto-resize。

#### 2. MicButton 插入位置

在 `claude-input-actions` 區域，**attach 📎 按鈕和 send ▶ 按鈕之間**：

```tsx
// 找到 <span onClick={handleSelectAttachments}> 和 <button onClick={handleSend}> 之間
<MicButton
  state={voice.state}
  onClick={voice.toggle}
  disabled={voice.state === 'disabled'}
  disabledTooltip={voice.error || '請先在 Settings 下載語音模型'}
/>
```

#### 3. VoicePreviewPopover 放置

在 `claude-input-area` 頂部或 textarea 上方，用 absolute 定位：

```tsx
{popoverState !== 'hidden' && (
  <div className="claude-voice-popover-wrap" style={{ position: 'relative' }}>
    <VoicePreviewPopover
      state={popoverState}
      text={voice.lastTranscription || ''}
      detectedLanguage={transcriptionMeta.detectedLanguage}
      inferenceTimeMs={transcriptionMeta.inferenceTimeMs}
      error={voice.error}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  </div>
)}
```

#### 4. CSS 樣式

可能需要微調 `claude-input-actions` 中 MicButton 的尺寸和間距，與現有 attach/send 按鈕對齊。

參考 T0050 在 MainPanel 中的樣式處理方式。

---

### 預期產出
- 修改 `src/components/ClaudeAgentPanel.tsx`（import + hook + JSX）
- 可能修改 CSS（claude-input-actions 中的 MicButton 樣式）
- 1 個 atomic commit

### Commit 規範
```
feat(voice): add voice input to Claude Agent chat box
```

### 驗收條件
- [ ] Claude Agent V1/V2 Chat Box 輸入區有 🎤 按鈕（在 📎 和 ▶ 之間）
- [ ] 點擊 🎤 → 錄音 → 辨識 → popover 顯示結果
- [ ] 按 Enter 確認 → 文字填入 Chat Box textarea（**不自動送出**）
- [ ] 按 Esc 取消 → popover 關閉
- [ ] 語音模型未下載時 🎤 disabled + tooltip
- [ ] 現有 Chat Box 功能不受影響（送出、附件、slash 指令等）
- [ ] `npx vite build` 通過
- [ ] **手動錄音 + 辨識 + 注入 Chat Box 測試**（GP020）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- 修改 `src/components/ClaudeAgentPanel.tsx`：新增 3 行 import + 8 行 hook 初始化 + 17 行 JSX（MicButton + VoicePreviewPopover）
- 修改 `src/styles/panels.css`：新增 `.claude-agent-voice-wrap` 定位 CSS + `overflow: visible` 修正
- Commit 1: `ee67bbb` — feat(voice): add voice input to Claude Agent chat box
- Commit 2: `8966729` — fix(voice): fix voice popover clipped by overflow:hidden in Claude Agent
- 手動複測通過 ✅

### 遭遇問題
`.claude-input-area` 的 `overflow: hidden` 裁切了 popover，第一版提交後發現。
修法：popover 可見時在 `claude-input-area` 加 `voice-popover-active` class，CSS 切換為 `overflow: visible`。

### 回報時間
2026-04-12 18:53 (UTC+8)
