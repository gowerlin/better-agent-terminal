# 工單 T0035-bug012-alt-buffer-scroll-ghosting

## 元資料
- **工單編號**：T0035
- **任務名稱**：BUG-012 Alt Buffer 捲動內容重影調查+修復
- **狀態**：DONE
- **建立時間**：2026-04-12 11:42 (UTC+8)
- **開始時間**：2026-04-12 11:48 (UTC+8)
- **完成時間**：2026-04-12 11:55 (UTC+8)
- **目標子專案**：（單一專案）
- **工單類型**：🔴 **Bug Investigation + Fix**

## 工作量預估
- **預估規模**：中（45-90 min）— 調查可能比修復花更多時間
- **Context Window 風險**：中（需讀多個 terminal 相關檔案）
- **降級策略**：若根本原因調查超過 60 min，先 checkpoint 回報假設，塔台決定是否拆分

## Session 建議
- **建議類型**：🆕 新 Session
- **可與 T0036 並行**：是（兩者互不干擾）

---

## Bug 描述

### 症狀
在 Claude Code TUI 介面（alt buffer 模式）內使用**滑鼠捲動**，會出現**文字內容複製到錯誤位置**（content duplication / ghosting）。

### Workaround（使用者發現）
最大化 BAT 面板 → 觸發 resize → xterm.js 強制重繪 → 殘影消失。
這確認問題是**渲染層的 dirty state**，不是資料狀態問題。

### 不受影響的操作
- 視窗最大化/resize 後殘影消失
- 正常 buffer（非 alt buffer）應用程式不受影響

### 與 BUG-008 的差異
BUG-008 是右鍵選單 overlay 在捲動後位移 → 已在 T0033-A 修復。
BUG-012 是 alt buffer 內容重影 → 不同機制，需要獨立調查。

---

## 任務指令

### 必讀檔案
1. `src/components/TerminalPanel.tsx` — 主要調查目標，重點看：
   - `onBufferChange` handler（T0033-A 加入的 alt buffer 偵測）
   - mouse scroll event 處理邏輯
   - `fitAddon` 和 `terminal.refresh()` 的呼叫點
2. `src/utils/TerminalDecorationManager.ts` — T0033-A 加入的 decoration 管理器
   - 確認 alt buffer 切換時 decoration 是否正確清理

### Step 1：Alt Buffer 進入/離開時的行為確認

追蹤 `onBufferChange` 的邏輯：
- 切換到 alt buffer 時，是否停用了 xterm.js 內建的 viewport scroll？
- xterm.js 的 `scrollOnUserInput` / `scrollback` 在 alt buffer 模式下是否應該被調整？
- `MouseEvent` handler 在 alt buffer 下是否仍在處理 `wheel` 事件？

### Step 2：Mouse Scroll 在 Alt Buffer 的雙重觸發假設

**核心假設**：在 alt buffer 模式下，滑鼠捲動事件可能同時觸發：
1. alt buffer app（Claude Code）自己的 scroll handler（正確）
2. xterm.js 的 viewport scroll（錯誤——導致 normal buffer 內容 bleed-through）

驗證方式：
```bash
# 在開發環境中，在 TerminalPanel 的 scroll handler 加 debug log
# 確認 alt buffer 模式下 scroll event 被觸發了幾次、觸發了什麼
window.electronAPI.debug.log('scroll event, isAltBuffer:', isAltBuffer)
```

### Step 3：TerminalDecorationManager 干擾檢查

確認 `TerminalDecorationManager` 在 alt buffer 切換時：
- 是否清理了所有 decoration markers？
- decoration 的 DOM element 是否在 alt buffer 模式下仍然存在並影響渲染？

### Step 4：修復方案

根據調查結果，實作以下其中一種（或組合）：

**方案 A（最可能）**：Alt buffer 模式下停用 xterm.js viewport scroll
```typescript
// 在 onBufferChange 偵測到 alt buffer 時
if (isAltBuffer) {
  terminal.options.scrollOnUserInput = false
  // 或：移除 wheel event listener
} else {
  terminal.options.scrollOnUserInput = true
}
```

**方案 B**：Alt buffer 進入/離開時強制 refresh
```typescript
if (isAltBuffer) {
  terminal.refresh(0, terminal.rows - 1)
}
```

**方案 C**：修復 decoration cleanup 問題（若 Step 3 發現問題）

### Step 5：驗證

修復後確認：
- [ ] 在 Claude Code TUI 內滑鼠捲動，不再出現內容重影
- [ ] 一般 shell（非 alt buffer）捲動行為正常，沒有 regression
- [ ] vim / less 等其他 alt buffer 應用程式捲動正常
- [ ] 使用者反映的 workaround（最大化）依然有效（不應影響）

### 預期產出
- `src/components/TerminalPanel.tsx` 修改（主要）
- 可能：`src/utils/TerminalDecorationManager.ts` 修改
- git commit：`fix(terminal): resolve alt buffer scroll content ghosting (BUG-012)`
- 更新本工單回報區

### 驗收條件
- [ ] Claude Code TUI 內滑鼠捲動無內容重影
- [ ] 正常 buffer 捲動行為無 regression
- [ ] build 通過（`npx vite build`）
- [ ] 有調查日誌記錄根本原因

### 執行注意事項
- **日誌**：使用 `window.electronAPI.debug.log()` 而非 `console.log()`
- **不要修改 T0033-A 的 decoration 架構本身**，只修復 alt buffer scroll 的問題
- 若調查超過 60 min 仍無法確認根本原因，回報目前假設，塔台決定下一步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 根本原因
當用戶在 normal buffer 中向上捲動（scrollTop > 0），然後應用程式切換到 alt buffer（如 Claude Code TUI 啟動），xterm.js 的 `.xterm-viewport` DOM 元素保留了非零的 scrollTop 值。這導致：

1. Alt buffer 的列內容在渲染時出現位置偏移（從視口頂部開始的偏移 = 原本的 scrollTop）
2. 滑鼠捲動時，瀏覽器的原生滾動行為（viewport scroll）仍然有效，使視口進一步移動
3. Normal buffer 的捲回內容（scrollback）從 alt buffer 內容"下方"透出，形成視覺上的內容重影（ghosting）

Workaround（最大化→resize）有效的原因：`fitAddon.fit()` 觸發 `terminal.resize()`，導致 xterm.js 強制重新計算整個 viewport 佈局，附帶重設了 scrollTop，殘影消失。

### 修復方案採用
**方案 A（viewport overflow lock）+ 方案 B（buffer switch refresh）組合**

在 `onBufferChange` handler 中：
- 進入 alt buffer：`viewport.style.overflowY = 'hidden'`（防止滑鼠捲動改變 scrollTop）+ `viewport.scrollTop = 0`（重設位置）
- 離開 alt buffer：`viewport.style.overflowY = ''`（還原 xterm.js 預設的 scroll 行為）
- 兩次切換後皆透過 `requestAnimationFrame(() => terminal.refresh(0, rows-1))` 強制全量重繪

修改檔案：`src/components/TerminalPanel.tsx`（+21 行，位於 `bufferChangeDisposable` handler 內）

### Git 摘要
```
cdd5553 fix(terminal): resolve alt buffer scroll content ghosting (BUG-012)
```
diff: `src/components/TerminalPanel.tsx` +21 行（在 `bufferChangeDisposable` handler）

### 遭遇問題
無。調查方向明確，代碼修改精簡，build 一次通過。

### 回報時間
2026-04-12 11:55 (UTC+8)
