# 工單 T0007-voice-preview-popover

## 元資料
- **工單編號**：T0007
- **任務名稱**：語音辨識結果預覽框 popover 元件 — 錄音完成後顯示辨識結果,使用者確認後才填入 textarea
- **狀態**：DONE
- **類型**:IMPLEMENTATION(renderer 前端元件)
- **建立時間**:2026-04-11 01:20 (UTC+8)
- **開始時間**:2026-04-11 01:18 (UTC+8)
- **完成時間**:2026-04-11 01:25 (UTC+8)
- **前置工單**:T0003(IPC 骨架)、T0004(whisper 真實化)、T0005(PromptBox UI + useVoiceRecording hook)

## 工作量預估
- **預估規模**:中
- **Context Window 風險**:中(需讀 PromptBox 既有結構、useVoiceRecording hook、元件定位 CSS)
- **降級策略**:若 Context Window 不足,優先完成 §1(元件 + 基本互動)+ §2(整合到 PromptBox),§3(鍵盤快捷鍵 + 動畫)可延後

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 執行實作 + build 驗證

## 平行工單警告

本工單與 **BUG-002 調研工單(T0008)** 理論上可平行,但 T0008 尚未派發。**本工單暫時不需要擔心衝突**。

與已完成的 T0006 無衝突(T0006 修的是 TerminalPanel paste,本工單動 PromptBox 語音 UI)。

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `src/components/voice/VoicePreviewPopover.tsx`(新) | **T0007 獨占** | 本工單主要產出 |
| `src/components/PromptBox.tsx` | **T0007 可小幅修改** | 僅改 `onTranscribed` callback + 加入 popover 元件 |
| `src/hooks/useVoiceRecording.ts` | **T0007 可小幅修改** | 若需要擴充 state(例:`showPreview`)則修改 |
| `src/styles/prompt-box.css` 或新 CSS | **T0007 可修改** | 加入 popover 樣式 |
| `electron/**` | **禁止** | 不碰 main process |
| `src/components/TerminalPanel.tsx` | **禁止** | T0006 剛改完,不動 |
| `src/lib/voice/*` | **唯讀** | T0003 產出 |
| `src/types/voice.ts` | **唯讀** | T0003 產出 |
| `src/types/electron.d.ts` | **唯讀** | T0003 產出 |

---

## 任務指令

### 任務定位

T0005 的暫時行為是**辨識結果直接 append 到 textarea**(含 `TODO(T0006)` 註解,註解寫錯編號應為 T0007)。本工單要把這個暫時行為**替換**為完整的預覽框流程:

```
使用者流程(T0007 完成後):

1. 點麥克風按鈕(或 Alt+M)→ 開始錄音
2. 再點一次 → 停止錄音 → 狀態 transcribing
3. 【新】popover 自動顯示在 MicButton 上方(或 PromptBox 上方),內部顯示 loading spinner
4. whisper 辨識完成 → popover 切換為顯示辨識結果文字
5. 使用者可選:
   - ✓ 確認 → 文字填入 textarea + popover 關閉 + reset state
   - ✗ 取消 → 文字丟棄 + popover 關閉 + reset state
   - 【bonus】直接編輯 popover 內的文字再確認(若容易實作)
6. 使用者按送出鍵送訊息
```

---

### 前置條件

**必讀文件**:
- `CLAUDE.md`(No Regressions、Logging、React Rendering 規範)
- `_ct-workorders/T0005-promptbox-voice-ui.md` **回報區的「給 T0006 的備註」**(內容其實是給本工單 T0007 的,編號誤寫)
- T0005 sub-session 提到的 4 個重點:
  1. `useVoiceRecording` hook 的 `lastTranscription` 保存最新結果
  2. `onTranscribed` callback 目前直接 append(PromptBox L53-56 附近)
  3. 可用 `voice.reset()` 清除 state
  4. MicButton 在 Paste 和 Send 之間,popover 建議從 MicButton 位置展開

**必讀專案檔案**:
- `src/components/PromptBox.tsx`(現在的整合狀態)
- `src/components/voice/MicButton.tsx`(T0005 產出,了解按鈕結構)
- `src/hooks/useVoiceRecording.ts`(T0005 產出,了解 state machine + 可用方法)
- `src/styles/prompt-box.css`(T0005 新增了 mic 相關樣式,了解 CSS 組織)
- 專案的既有 popover / tooltip / modal 模式(Glob 搜尋 `Popover` / `Tooltip` / `Portal` / `Modal`,若有既有元件優先沿用)

---

### 輸入上下文

**使用者原始 UX 決策**(T0001 §E / D002):
- 預覽框位置:PromptBox 上方浮動 popover
- 即時串流顯示(Phase 1 降級:**改為 loading → 完整結果**)
- 確認/取消按鈕
- **辨識完成後絕對不自動提交**

**Option B 降級後的 UX**(D011):
- 無即時串流(whisper-node-addon 不支援)
- CPU-only 辨識(small 模型 10 秒音訊約 1~3 秒)
- Loading 期間顯示 spinner + 「辨識中...」文字
- 完成後顯示完整結果

**T0004 的 transcribe 回傳**(真實 whisper):
```typescript
interface VoiceTranscribeResult {
  text: string;              // 已過 OpenCC 繁簡轉換
  detectedLanguage?: string; // whisper 偵測到的語言
  durationMs: number;        // 音訊長度
  inferenceTimeMs: number;   // 辨識耗時
}
```

本工單可以在 popover 顯示這些額外資訊(可選):
- 辨識耗時(給使用者回饋)
- 偵測到的語言(若與預設不同,例如預設繁中但偵測到英文)

---

### 工作範圍

#### §1 — `VoicePreviewPopover` 元件建立

**檔案**:`src/components/voice/VoicePreviewPopover.tsx`

**Props 設計草稿**:
```typescript
interface VoicePreviewPopoverProps {
  state: 'hidden' | 'transcribing' | 'result' | 'error';
  text?: string;                    // state === 'result' 時的辨識文字
  errorMessage?: string;            // state === 'error' 時的錯誤訊息
  detectedLanguage?: string;        // 偵測語言(可選顯示)
  inferenceTimeMs?: number;         // 辨識耗時(可選顯示)
  onConfirm: (finalText: string) => void;  // finalText 可能是編輯後的文字
  onCancel: () => void;
  anchorRef?: React.RefObject<HTMLElement>; // 錨定元素(MicButton)供定位使用
}
```

**內部結構**(偽程式碼):
```tsx
function VoicePreviewPopover(props) {
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    // 當 props.text 變化時,同步到 editedText
    if (props.text !== undefined) setEditedText(props.text);
  }, [props.text]);

  if (props.state === 'hidden') return null;

  return (
    <div className="voice-preview-popover" role="dialog" aria-label="語音辨識結果">
      {props.state === 'transcribing' && (
        <div className="voice-preview-loading">
          <Spinner /> {/* 用專案既有 spinner,或簡單 CSS 動畫 */}
          <span>辨識中...</span>
        </div>
      )}

      {props.state === 'result' && (
        <>
          <textarea
            className="voice-preview-text"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            autoFocus
            rows={3}
          />
          {/* 可選 metadata 顯示 */}
          {(props.detectedLanguage || props.inferenceTimeMs) && (
            <div className="voice-preview-meta">
              {props.detectedLanguage && <span>語言: {props.detectedLanguage}</span>}
              {props.inferenceTimeMs && <span>{Math.round(props.inferenceTimeMs)}ms</span>}
            </div>
          )}
          <div className="voice-preview-actions">
            <button onClick={() => props.onConfirm(editedText)} className="confirm-btn">
              ✓ 填入(Enter)
            </button>
            <button onClick={props.onCancel} className="cancel-btn">
              ✗ 取消(Esc)
            </button>
          </div>
        </>
      )}

      {props.state === 'error' && (
        <div className="voice-preview-error">
          <span>⚠️ {props.errorMessage}</span>
          <button onClick={props.onCancel}>關閉</button>
        </div>
      )}
    </div>
  );
}
```

**需求重點**:
- ✅ 可編輯的 textarea(**bonus feature**,讓使用者在送出前修正辨識錯字)
- ✅ 確認 / 取消按鈕
- ✅ 鍵盤:Enter 確認 / Esc 取消(見 §3)
- ✅ aria-label / role="dialog"
- ✅ autoFocus 在 textarea(確認模式)
- ✅ 錯誤狀態顯示

**視覺風格**:
- 浮動於 MicButton 上方(使用 `position: absolute` 或 `position: fixed` + 計算座標)
- 陰影 + 圓角 + 跟專案整體風格一致
- 寬度略寬於 MicButton(或固定寬度 300~400px)

**定位策略**:
- **方案 A**:CSS `position: absolute` + 相對 PromptBox 容器定位
  - 優點:簡單,隨 PromptBox 一起 scroll/resize
  - 缺點:若 PromptBox 有 overflow: hidden 會被裁
- **方案 B**:React Portal 到 document.body + JS 計算座標
  - 優點:不受 overflow 限制
  - 缺點:需要自己處理 scroll/resize
  - ⚠️ **注意 BUG-002**:這種座標計算**正是** BUG-002 的根因區域!若採方案 B 要**特別小心**避免踩到同樣的 bug
- **方案 C**:沿用專案既有的 popover/tooltip 元件(若有)
  - 優點:繼承已修過的 bug
  - 缺點:可能沒有既有元件

**塔台建議**:**優先方案 A**(CSS 相對定位),避開 BUG-002 相關的座標計算陷阱。若 PromptBox 的 overflow 設定不合適,可調整 PromptBox 容器而不是動座標計算。

---

#### §2 — 整合到 PromptBox:替換暫時的 append 行為

**修改 `src/components/PromptBox.tsx`**:

1. **import** `VoicePreviewPopover`
2. **新增 state**:
   ```typescript
   const [voicePreviewState, setVoicePreviewState] = useState<'hidden' | 'transcribing' | 'result' | 'error'>('hidden');
   ```
3. **修改 `onTranscribed` callback**:
   - T0005 暫時寫法(找到含 `TODO(T0006)` 註解的地方):
     ```typescript
     onTranscribed: (text) => {
       setValue((prev) => prev + text);  // 直接 append
     }
     ```
   - 替換為:
     ```typescript
     // 注意:實際不需要 onTranscribed callback 了,改用 useVoiceRecording 的 state 驅動
     // 或保留 callback 但只用來觸發 popover
     onTranscribed: (text) => {
       setVoicePreviewState('result');  // popover 已經在 transcribing 狀態,切到 result
     }
     ```
4. **監聽 `useVoiceRecording` 的 state 變化**:
   - 當 hook state 進入 `transcribing` → `setVoicePreviewState('transcribing')`
   - 當 hook state 進入 `idle` 且有 `lastTranscription` → `setVoicePreviewState('result')`
   - 當 hook `error` 不為 null → `setVoicePreviewState('error')`
5. **渲染 popover**:
   ```tsx
   <VoicePreviewPopover
     state={voicePreviewState}
     text={voiceRecording.lastTranscription ?? undefined}
     errorMessage={voiceRecording.error ?? undefined}
     onConfirm={(finalText) => {
       setValue((prev) => prev + finalText);
       setVoicePreviewState('hidden');
       voiceRecording.reset();
     }}
     onCancel={() => {
       setVoicePreviewState('hidden');
       voiceRecording.reset();
     }}
     anchorRef={micButtonRef}
   />
   ```
6. **移除 T0005 的 `TODO(T0006)` 註解**(該 TODO 已完成)

**注意**:可能需要為 `useVoiceRecording` hook 擴充 `onTranscribed` 為可選 prop(若原本是必填),或改用 hook 直接 exposed 的 state 驅動。這是 `src/hooks/useVoiceRecording.ts` 的小修改。

---

#### §3 — 鍵盤快捷鍵與動畫

**鍵盤**:
- **Enter** 在 popover 內 → 確認填入
- **Esc** 在 popover 內 → 取消
- 鍵盤事件要**只在 popover 顯示時**生效,不要影響其他場景

**實作建議**:
```typescript
useEffect(() => {
  if (voicePreviewState !== 'result') return;

  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // onConfirm(editedText) — 需要從 popover 傳到 PromptBox 或由 popover 自己處理
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // onCancel()
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [voicePreviewState]);
```

**動畫**(可選,時間不夠可跳過):
- popover 出現:fade in + slide up from MicButton(200~300ms)
- popover 消失:fade out(150ms)
- 使用 CSS `transition` 或 `@keyframes`,避免引入動畫套件

---

#### §4 — Transcribing 狀態處理:MicButton 與 popover 的同步

T0005 的 `MicButton` 已有 `transcribing` 狀態(loading spinner)。本工單要決定:

**選項 A**:MicButton 轉圈圈 + popover 也顯示 loading(雙重視覺回饋)
**選項 B**:MicButton 維持原狀(只有 idle/recording),loading 完全交給 popover
**選項 C**:MicButton 變成 disabled + popover 顯示 loading

**塔台建議**:**選項 A**(雙重回饋) — 使用者眼睛可能在 textarea 上,popover 出現 + MicButton 轉圈圈,兩邊都能傳遞 loading 狀態。

---

### 不在本工單範圍

- ❌ 不動 `electron/` 任何檔案
- ❌ 不動 `package.json`
- ❌ 不動 `src/components/TerminalPanel.tsx`(T0006 剛修完)
- ❌ 不動 `src/lib/voice/*`、`src/types/voice.ts`(T0003 產出)
- ❌ 不修 256 個既有 tsc 錯誤
- ❌ 不做 Settings 頁(T0009)
- ❌ 不處理 BUG-002(T0008)
- ❌ **不採用 Portal 方案**(除非 CSS 相對定位真的做不到,且必須特別注意避開 BUG-002 的座標計算陷阱)

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全通過
- [ ] **No Regression**:Electron app 啟動成功,既有功能無破壞
- [ ] **§1 元件建立**:`VoicePreviewPopover.tsx` 四種狀態(hidden/transcribing/result/error)視覺正常
- [ ] **§1 互動完整**:確認/取消按鈕、可編輯 textarea(bonus)
- [ ] **§2 整合完成**:PromptBox 不再直接 append,改走 popover 流程
- [ ] **§2 TODO 清除**:`TODO(T0006)` 註解已移除(該 TODO 已完成)
- [ ] **§3 鍵盤**:Enter 確認 / Esc 取消(只在 popover 顯示時生效)
- [ ] **§4 狀態同步**:MicButton 和 popover 的 loading 狀態協調一致
- [ ] **檔案所有權**:未觸碰禁止區
- [ ] **日誌合規**:無 `console.log`,用 `window.electronAPI.debug.log`
- [ ] **BUG-002 防禦**:popover 定位採 CSS 相對定位,避開 JS 座標計算
- [ ] **無障礙**:`role="dialog"`、`aria-label`、鍵盤可操作

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `CLAUDE.md`
3. **完整讀** `src/components/PromptBox.tsx`(含 T0005 的 MicButton 整合)
4. 讀取 `src/components/voice/MicButton.tsx`
5. 讀取 `src/hooks/useVoiceRecording.ts`
6. 讀取 `src/styles/prompt-box.css`(了解 T0005 新增的樣式)
7. Glob 搜尋專案的既有 popover/tooltip 元件
8. 更新「開始時間」欄位
9. **§1 → §2 → §3 → §4 順序**執行
10. 每個 § 完成後執行 `npx vite build` 驗證
11. Code-level 檢查:確認所有狀態切換路徑正確(因為 runtime 驗證要到 T0011)
12. 填寫回報區

### 執行注意事項

- **BUG-002 防禦**:絕對不要做「JS 計算 popover 座標」,使用 CSS 相對定位
- **不要破壞 T0005**:MicButton、useVoiceRecording hook 的對外 API 盡量不改;若必須改,只在 hook 內部擴充,保持既有呼叫相容
- **頭腦清楚**:T0005 的註解寫 `TODO(T0006)` 是因為原本規劃 T0006 做預覽框,後來因為 BUG-001 插隊,預覽框延後到 T0007。註解要改為 `TODO(T0007)` 或直接移除
- **headless 環境限制**:runtime 視覺驗證延後到 T0011,本工單做 code-level 驗證即可,回報可標 PARTIAL 若只做到 code-level

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新增檔案**:
- `src/components/voice/VoicePreviewPopover.tsx` — 預覽框元件,4 種狀態(hidden/transcribing/result/error),可編輯 textarea、確認/取消按鈕、鍵盤快捷鍵、metadata 顯示

**修改檔案**:
- `src/components/PromptBox.tsx` — import VoicePreviewPopover + VoicePreviewState 型別;新增 voicePreviewState/voiceTranscriptionMeta state;替換 onTranscribed 從直接 append 改為觸發 popover;新增 popover 渲染與 confirm/cancel handlers;移除 TODO(T0006) 註解
- `src/hooks/useVoiceRecording.ts` — onTranscribed callback 簽名擴充為 `(text, result?)`,傳遞 detectedLanguage + inferenceTimeMs metadata
- `src/styles/prompt-box.css` — 新增 VoicePreviewPopover 所有 CSS:popover 容器(absolute 定位)、loading 狀態、textarea、metadata、action buttons、error 狀態、fade-in 動畫

### 互動紀錄
無

### 遭遇問題
無

### 定位方案採用
方案 A（CSS 相對定位）— popover 使用 `position: absolute` + `bottom: 100%` 相對於 `.prompt-box-inner`（已有 `position: relative`）定位。完全避開 JS 座標計算,不踩 BUG-002 陷阱。

### Build 驗證結果
`npx vite build` 三階段全通過:renderer ✅ → main ✅ → preload ✅（9.05s + 1.19s + 18ms）

### 狀態切換路徑驗證(code-level)

| 使用者操作 | 預期狀態流 | 實際驗證 |
|-----------|-----------|---------|
| 點 MicButton 開始錄音 | idle → recording | ✅ voice.toggle() → start() → setState('recording') |
| 再點停止 | recording → transcribing | ✅ voice.toggle() → stop() → setState('transcribing') + popover 顯示 loading |
| whisper 完成 | transcribing → result(popover 顯示) | ✅ onTranscribed → setVoicePreviewState('result') + lastTranscription 更新 |
| 點確認 | result → hidden + textarea append | ✅ onConfirm → setText(prev + finalText) + setVoicePreviewState('hidden') + voice.reset() |
| 點取消 | result → hidden + 丟棄 | ✅ onCancel → setVoicePreviewState('hidden') + voice.reset() |
| 按 Enter | 等同確認 | ✅ window keydown capture handler → handleConfirm() (e.stopPropagation 防止 PromptBox 也觸發) |
| 按 Esc | 等同取消 | ✅ window keydown capture handler → onCancel() (e.stopPropagation 防止 PromptBox 清空 textarea) |
| 錯誤發生 | transcribing/recording → error | ✅ useEffect 監聽 voice.error + voicePreviewState !== 'hidden' → setVoicePreviewState('error') |

### 給 T0009 / T0011 的備註
- T0011 runtime 驗證時注意：popover 的 Enter 鍵使用 capture phase 攔截,若 PromptBox 有新的 keydown handler 需確認優先級
- popover 內 textarea 使用 Shift+Enter 可換行（因 Enter 被攔截為確認）
- `onTranscribed` callback 簽名已擴充為 `(text, result?)`,向後相容,第二參數為 optional
- 錯誤狀態仍會同時在 popover 和 hint 區域顯示（雙重回饋,§4 選項 A 策略）

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 01:25 (UTC+8)
