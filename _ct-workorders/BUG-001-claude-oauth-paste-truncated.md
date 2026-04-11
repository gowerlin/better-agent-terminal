# 🐛 BUG-001：應用終端內無法完成 Claude OAuth 登入（paste 被截斷）

## 基本資訊

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-001 |
| **狀態** | 📨 已提交（等塔台分類） |
| **報修人** | 使用者 |
| **報修時間** | 2026-04-11 00:25 (UTC+8) |
| **嚴重度** | 🔴 High |
| **影響範圍** | 所有需要 Claude OAuth 登入的新使用者 / 重新登入情境 |
| **重現率** | 100%（只要走 `claude /login` 流程都會卡） |
| **阻斷程度** | 阻斷新使用者首次完成 Claude Code 設定 |
| **相關專案里程碑** | Phase 1 收尾前應修掉 |

---

## 症狀描述

### 使用者操作步驟

1. 在 better-agent-terminal 開一個終端分頁
2. 執行 `claude`
3. 輸入 `/login`
4. 畫面進入 Claude CLI 的 Ink TUI 登入介面
5. 畫面顯示 `Browser didn't open? Use the url below to sign in (c to copy)` 並印出 OAuth URL
6. 使用者手動將 URL 貼到系統瀏覽器
7. 在瀏覽器完成 Anthropic 登入、拿到授權碼
8. 回到終端，在 `Paste code here if prompted >` 欄位按 `Ctrl+V` 貼授權碼
9. **預期**：Claude CLI 接收完整授權碼 → 登入成功
10. **實際**：只有尾端 6 字元左右（例：`qDE7kw`）進入輸入框，提交後登入失敗

### 附帶觀察

- 第一次輸入 `/login` 時畫面顯示 `Login interrupted`，判斷是使用者誤按 Esc，**不是 bug**
- `Browser didn't open?` 訊息連續出現 → 自動開瀏覽器也失敗（次要問題，見 §4）
- 截圖中 `Paste code here if prompted >` 行末殘留的 `qDE7kw` 明顯不是完整的 OAuth authorization code 長度

---

## 使用者側已完成的初步調查

> 以下為報修人在提交前自行追查的結果，供塔台評估時參考。塔台可自行複核。

### §1 — 主因：Paste 路徑繞過 xterm.js bracketed paste

**檔案**：`src/components/TerminalPanel.tsx`

**關鍵程式碼位置**：

| 行號 | 函式 | 問題 |
|------|------|------|
| L47-65 | `writeChunked` | 將貼上切為 2000 字元塊、30ms delay 逐段寫入 PTY，破壞 paste atomicity |
| L68-98 | `handlePasteText` | `text.length > 4000` 時走 chunked，否則直接 `window.electronAPI.pty.write(terminalId, text)` |
| L107-117 | `handlePaste`（右鍵貼上） | 讀 clipboard → 呼叫 `handlePasteText` |
| L360-393 | Ctrl+V / Ctrl+Shift+V handler | 所有分支最後都呼叫 `handlePasteText` |

**根因推論**：

所有 paste 路徑最後都直接呼叫 `window.electronAPI.pty.write(terminalId, text)`，**完全繞過 xterm.js 的 `terminal.paste()` 方法**。

xterm.js 的 `terminal.paste(data)` 方法會：
1. 檢查接收端 app 是否啟用 bracketed paste 模式（`\x1b[?2004h`）
2. 若有啟用，自動在 data 前後加上 `\x1b[200~` / `\x1b[201~` markers
3. 接收端 app 看到 markers 才會把整段當作「一次貼上」來處理

Claude CLI 的 Ink TUI 在 `/login` 畫面**有送 `\x1b[?2004h` 啟用 bracketed paste**，預期收到帶 markers 的 paste event。

但本 app 繞過了 xterm.js 的 paste 方法，直接把原始字串塞進 PTY stdin，導致：
- Ink TUI 收到的是「一瞬間的大量 keypress events」，不是「一次 paste event」
- Ink 的 key handler 會把特殊字元（`/`、`-`、`_` 等 URL-safe base64 會出現的字元）當成鍵盤指令或 slash command trigger
- 某些字元被吃掉或觸發副作用
- 最終只剩尾端殘留字元進入輸入框

### §2 — 複核驗證方向（給塔台派單時的建議）

1. **非 Claude 情境重現**：
   - 在該終端跑 `printf '\e[?2004h'; read` 啟用 bracketed paste 然後 Ctrl+V 貼 300 字元 → 若 `read` 只收到末段少量字元，即可確認繞過 bracketed paste 是根因

2. **最小修改驗證**：
   - 暫時把 `handlePasteText` 裡 `window.electronAPI.pty.write(terminalId, text)` 改為 `terminalRef.current?.paste(text)`
   - 再跑一次 `claude /login` 流程，確認 paste code 能完整傳入

### §3 — 連帶發現的 IPC 壞掉路徑（獨立於本 bug 主因）

追查過程中發現另一條**已經壞掉但目前沒人踩到**的路徑：

**檔案**：
- `electron/main.ts` L1076 — `registerHandler('claude:auth-login', ...)` 使用 `execFile('claude', ['auth', 'login'], { timeout: 60000, windowsHide: true }, ...)`
- `src/components/ClaudeAgentPanel.tsx` L1147 — 攔截 `/login` slash command 並呼叫 `window.electronAPI.claude.authLogin()`

**問題**：
1. `execFile` 沒有 TTY，互動式 OAuth 無法進行
2. `claude auth login` 子指令名稱**可能根本不存在**於 Claude CLI（正確命令應為 `/login` 互動或 `claude setup-token`）
3. `windowsHide + buffered stdout` 使用者看不到登入網址
4. UI 沒有授權碼輸入框

**目前為何沒炸**：使用者走的是「在終端分頁內直接跑 `claude` → `/login`」這條路（走 PTY），而不是 ClaudeAgentPanel 對話框的 `/login` 攔截。

**建議**：塔台評估是否併入本 bug 修掉，或另開獨立技術債工單移除這條死路徑，避免將來新使用者誤踩。

### §4 — 次要問題：`Browser didn't open?`

**現象**：Claude CLI 呼叫 Node `open` 套件自動開瀏覽器失敗，fallback 到印 URL 讓使用者手動複製。

**推測成因**：
- PTY 子行程的 env 由 `electron/pty-manager.ts` L174-193 組成
- macOS/Windows GUI 啟動的 Electron 本來就不繼承 user shell 的 PATH 補充路徑
- Node `open` 套件可能找不到某些啟動器，或被 `windowsHide` / `detached` 行為影響

**影響**：不會完全擋住登入，但放大了主因 §1 的痛感 —— 使用者被迫手動來回複製 URL + paste code，每一步都踩到 §1。

**建議**：
- 本條**先不修**，把資源集中在 §1 主因
- 修完 §1 後，使用者可以正常複製 URL + 正常 paste code，這條的痛感會降低 80%
- 若塔台評估後仍想處理，可開獨立 bug 單

---

## 排除項（非 Bug）

- ❌ `Login interrupted`：推測使用者首次誤按 Esc，非 bug
- ❌ `node-pty` fallback 到 `child_process`：從截圖的 Ink TUI 渲染正常判斷，`@lydell/node-pty` 載入成功，非本 bug 成因
- ❌ Claude CLI 本身的 bug：Claude CLI 在其他終端模擬器（iTerm2、Windows Terminal、VS Code terminal）的 `/login` 流程正常運作，問題在本 app 的 paste 處理

---

## 修復方向建議（僅供塔台參考）

### 最小修法（只修主因 §1）

**改動範圍**：
- `src/components/TerminalPanel.tsx`
  - `handlePasteText`：用 `terminalRef.current?.paste(text)` 取代 `window.electronAPI.pty.write(terminalId, text)`
  - `writeChunked`：門檻從 4000 字元拉高到 64KB，或改為只在接收端**未**啟用 bracketed paste 時才切塊
  - 保留現有 10KB 大檔案確認對話框

**預估工作量**：S（小型修改，<1 小時）

**風險**：低，但必須完整回測三個情境：
1. 貼大段 shell 指令到 bash/pwsh 正常
2. 貼文字到 vim/nano 正常
3. 貼授權碼到 `claude /login` 可完成登入

**預估影響面**：僅貼上行為，複製、輸入、PTY 主流程不動。

### 可選順手做（§3 技術債）

移除或停用 `ClaudeAgentPanel.tsx` L1147 的 `/login` 攔截 + `main.ts` L1076 的 `claude:auth-login` IPC handler。

### 先不要碰（§4 次要問題）

`Browser didn't open?` 修起來要動 PTY 輸出攔截或環境變數 probing，風險遠大於效益，建議觀察。

---

## 附帶資訊

### 給塔台派單時可直接附進 sub-session 的檔案清單

使用者已經完整 trace 過的檔案（派單時附上這份清單可省下 sub-session 探索成本）：

- `electron/pty-manager.ts`（PTY 環境變數與生命週期）
- `src/components/TerminalPanel.tsx`（**主要修改對象**，paste 相關行號已在上方列出）
- `src/components/ClaudeAgentPanel.tsx` L1140-1170（連帶的 `/login` 攔截）
- `electron/main.ts` L1065-1105（連帶的 `claude:auth-login` IPC handler）
- `electron/preload.ts` L180-195（IPC bridge，僅供參考，無需修改）

### 與現行工單的衝突檢查

- **T0004（whisper 整合）**：動 `electron/voice-handler.ts` + `package.json`，**無衝突**
- **T0005（PromptBox 語音 UI）**：動 `src/components/PromptBox.tsx` + `src/components/voice/*` + `src/hooks/useVoiceRecording.ts` + `src/styles/prompt-box.css`，**無衝突**
- 本 bug 修復只動 `src/components/TerminalPanel.tsx`（語音工單之外）

### 優先級建議

- 可以排在 T0004 / T0005 之後，但應該在 **Phase 1 收尾前**修掉
- 理由：影響新 user 首次設定體驗，但不阻斷語音功能本身開發

---

## 塔台處理區

> 以下由塔台填寫

- [ ] 已確認症狀
- [ ] 已複核根因分析
- [ ] 已決定立案 / 併入既有工單 / 暫緩
- [ ] 分類後工單編號：___________
- [ ] 處理決策日誌編號：___________
- [ ] 備註：

---

**報修完畢。請塔台評估是否立案。**
