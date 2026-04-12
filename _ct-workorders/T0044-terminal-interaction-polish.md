# 工單 T0044-terminal-interaction-polish

## 元資料
- **工單編號**：T0044
- **任務名稱**：終端互動 polish — BUG-007 OSC 52 訊息汙染 + BUG-009 右鍵貼上 focus 丟失
- **狀態**：DONE
- **建立時間**：2026-04-12 15:27 (UTC+8)
- **開始時間**：2026-04-12 15:29 (UTC+8)
- **完成時間**：2026-04-12 15:37 (UTC+8)

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：若任一 bug 意外複雜，可先修另一個回報 PARTIAL

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：兩個獨立小修復，乾淨 context 效率最高

## 任務指令

### 前置條件
需載入的文件清單：
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 輸入上下文

**專案**：better-agent-terminal — 基於 Electron + React + xterm.js 的終端應用程式。

**分支**：從 `main` 建立 `T0044-terminal-interaction-polish` 分支作業。

---

### 🐛 Bug A：BUG-007 — OSC 52 調試訊息汙染終端輸出

**現象**：在終端內用滑鼠選取文字（右鍵標記）時，終端輸出以下調試訊息：
```
sent 87 chars via OSC 52 · check terminal clipboard settings if paste fails
```
數字 87 是動態的（與複製的 payload 長度相關）。

**根因方向**：某處在 OSC 52 clipboard handler 中有 `console.log` / `logger.log` / `terminal.write` 輸出調試資訊。

**修復策略**：
1. Grep 搜尋關鍵字：`OSC 52`、`sent.*chars`、`clipboard settings`、`paste fails`
2. 找到後判斷：
   - 若是 `console.log` → 直接刪除
   - 若是 `logger.log` / `logger.debug` → 保留（寫入 debug.log 是可以的），但若是 `terminal.write` 或任何寫到 PTY stdout 的 → 必須刪除
   - 若是有 debug flag gate 的 → 確認 flag 在 production build 為 false
3. 確認修復後不影響 OSC 52 clipboard 功能本身

**驗收重點**：調試訊息不再出現在終端輸出中，但 clipboard 複製功能仍正常運作。

---

### 🐛 Bug B：BUG-009 — 右鍵功能表「貼上」後 focus 未還給終端

**現象**：
- 右鍵 → 選「貼上」→ 內容成功貼上
- 但隨後鍵盤按鍵無反應（使用者誤以為程式卡頓）
- 必須再點一次左鍵才能恢復鍵盤輸入
- **對照組**：`Ctrl+V` 貼上後 focus 正常保持

**根因方向**：Context menu 彈出時 focus 轉移到 menu DOM 元素，點選「貼上」後 menu 關閉，但沒有呼叫 `terminal.focus()` 把 focus 還給 xterm.js。

**修復策略**：
1. 找到 context menu 元件（可能在 `src/components/` 下，搜尋 `ContextMenu`、`context-menu`、`onPaste`、`handlePaste` 等）
2. 在 menu item 的 click handler 或 menu 的 `onClose` callback 中，加入 focus 還原邏輯
3. **推薦做法**：
   ```ts
   // 在 paste action 完成 + menu 關閉後
   setTimeout(() => {
     // 找到當前 active terminal 並 focus
     terminalRef.current?.focus();
   }, 0);
   ```
4. 注意：不只 paste，**所有 context menu action** 執行後都應該還原 focus（一次修完）
5. 確認修復後 `Ctrl+V` 行為不受影響（回歸測試）

**參考檔案**：
- T0008 工單（`_ct-workorders/T0008-fix-context-menu-offset.md`）— 之前修過同一個 context menu 的位置問題
- T0012 工單（`_ct-workorders/T0012-terminal-panel-context-menu.md`）— Terminal panel 的 context menu Portal 修復

**驗收重點**：右鍵選任何功能表項目後，鍵盤輸入立即可用，不需額外點擊。

---

### 預期產出
- 修改的檔案（預估 1-3 個檔案）
- 每個 bug 一個 atomic commit

### 驗收條件
- [ ] BUG-007：終端內選取文字時不再顯示 OSC 52 調試訊息
- [ ] BUG-007：OSC 52 clipboard 複製功能仍正常（選取 → 可在外部貼上）
- [ ] BUG-009：右鍵 →「貼上」後可立即用鍵盤打字，不需額外點擊
- [ ] BUG-009：右鍵 → 其他功能表項目（複製、清除等）後也能正常打字
- [ ] BUG-009：`Ctrl+V` 貼上行為不受影響（回歸測試）
- [ ] `npx vite build` 通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 從 `main` 建立 `T0044-terminal-interaction-polish` 分支
4. **Bug A 先做**：Grep 找到 OSC 52 調試訊息來源 → 移除或 gate → commit
5. **Bug B 再做**：找到 context menu 元件 → 加 focus 還原邏輯 → commit
6. 執行 `npx vite build` 驗證
7. 填寫回報區
8. 更新「狀態」和「完成時間」

### Commit 規範
- Bug A：`fix(terminal): remove OSC 52 debug message from terminal output`
- Bug B：`fix(terminal): restore focus to terminal after context menu action`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改檔案：`src/components/TerminalPanel.tsx`（2 個 commit）

**Commit 1 - BUG-007**（`62e4fca`）：
- 將 regex `/^sent \d+ chars via OSC 52 .*paste fails$/u` 改為 `/sent \d+ chars via OSC 52 .*paste fails/u`
- 移除 `^` 和 `$` 錨點，使 regex 能匹配前後帶 ANSI escape code 的行
- 根因：Claude Code 輸出的通知行帶有顏色 escape code（如 `\x1b[...m`），前一次修復的 `^` 錨點使 regex 無法匹配

**Commit 2 - BUG-009**（`c78ab22`）：
- 在 `handleCopy` 加入 `setTimeout(() => terminalRef.current?.focus(), 0)`
- `handlePaste` 之前已有此修復（commit `dfc46e4`），但 `handleCopy` 遺漏
- 現在兩個 context menu action 都會在關閉 menu 後還原終端 focus

**Build**：`npx vite build` 通過，無錯誤

### 互動紀錄
無

### 遭遇問題
發現兩個 bug 在過去均有過 Copilot commit（`fd20da1`、`dfc46e4`，日期 2026-04-11）試圖修復，但均不完整：
- BUG-007：前修復加了 filter 函數但 regex 帶 `^$` 錨點，ANSI code 存在時失效
- BUG-009：前修復只修了 `handlePaste`，`handleCopy` 遺漏

### sprint-status.yaml 已更新
不適用（未找到 sprint-status.yaml）

### 回報時間
2026-04-12 15:37 (UTC+8)
