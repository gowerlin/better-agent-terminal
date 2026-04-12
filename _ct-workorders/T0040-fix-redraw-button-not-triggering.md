# 工單 T0040-fix-redraw-button-not-triggering

## 元資料
- **工單編號**：T0040
- **任務名稱**：修復 Redraw 按鈕未觸發終端重繪
- **狀態**：DONE
- **建立時間**：2026-04-12 12:36 (UTC+8)
- **開始時間**：2026-04-12 12:45 (UTC+8)
- **完成時間**：2026-04-12 12:53 (UTC+8)
- **關聯**：UX-002 的功能缺陷，T0036 實作但驗收失敗

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：單一 bug fix，context 乾淨比較好 debug

## 任務指令

### 前置條件
需載入的文件清單：
- `src/components/MainPanel.tsx` — Redraw 按鈕的 click handler
- `src/components/TerminalPanel.tsx` — terminal-redraw event listener
- `src/components/workspace-store.ts` — 終端狀態管理

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js 終端模擬器）

**T0036 實作摘要**（來自 obs 9768-9774）：
- MainPanel 新增 Redraw 按鈕，handler 觸發 `terminal-redraw` 自訂事件
- TerminalPanel 新增 `terminal-redraw` event listener，收到事件後執行重繪
- 有加 cleanup（移除 listener）防止 memory leak

**驗收症狀**：
- 使用者點擊 Redraw 按鈕 → **完全沒有視覺變化**
- 但使用者最大化面板 → **終端正常重繪**
- 這證明 xterm 的 `fit()` / resize 流程正常，問題在 Redraw 按鈕的 event dispatch → listener → 重繪邏輯的接線

**需要調查的斷鏈點**：
1. MainPanel click handler 是否正確 dispatch 了 `terminal-redraw` 事件？
2. 事件目標是否正確（window / document / 特定 DOM 元素）？
3. TerminalPanel listener 是否綁定在相同的事件目標上？
4. Listener 內的重繪邏輯是否正確呼叫了 xterm 的 refresh / fit？
5. 如果用的是 CustomEvent，是否有 bubble 問題？

**已知有效的重繪路徑**：
- Resize / 最大化 → 觸發 ResizeObserver → `fitAddon.fit()` → 終端重繪 ✅
- Redraw 按鈕應該模擬同樣的效果

### 預期產出
- 修復後的 Redraw 按鈕能觸發可見的終端重繪
- 修改的檔案（預計 1-2 個）
- Git commit

### 驗收條件
- [ ] 點擊 Redraw 按鈕後，終端有可見的重繪效果
- [ ] 在 alt buffer 模式下（如 vim、htop），Redraw 也能正常工作
- [ ] 不影響 Restart 按鈕和確認對話框的功能
- [ ] `npx vite build` 通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 MainPanel.tsx 中 Redraw 按鈕的 click handler，追蹤事件 dispatch
4. 讀取 TerminalPanel.tsx 中 terminal-redraw listener，確認事件綁定和重繪邏輯
5. 比對事件 dispatch 和 listener 的目標（window vs document vs element）
6. 定位斷鏈原因並修復
7. 確保重繪邏輯呼叫 xterm 的有效重繪方法（如 `terminal.refresh(0, terminal.rows - 1)` 或 `fitAddon.fit()`）
8. `npx vite build` 驗證
9. Git commit
10. 填寫回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 修改檔案：`src/components/TerminalPanel.tsx`（1 file, +8 / -2 lines）
- **根因**：原 `handleRedrawEvent` 呼叫 `fitAddon.fit()` + `terminal.refresh(0, rows-1)`，但容器尺寸未變時 `fit()` 是 no-op，xterm.js v5 DOM renderer 又可能因 buffer 內容沒變而跳過 `refresh()`
- **修復**：改為先 `terminal.resize(cols+1, rows)` 強制維度變更，再 `doResize()`（內含 `fitAddon.fit()` 恢復正確尺寸 + `pty.resize` 通知後端）。重設 `lastSentCols/lastSentRows` 去重計數器，確保 PTY resize 一定觸發（SIGWINCH 讓 alt buffer 應用如 vim/htop 也重繪）
- Git commit: `cd46b27`
- `npx vite build` 通過 ✅

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 12:53 (UTC+8)
