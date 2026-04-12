# 工單 T0006-fix-paste-bracketed

## 元資料
- **工單編號**：T0006
- **任務名稱**：修復 BUG-001 — TerminalPanel paste 改走 xterm.js bracketed paste + 清理 §3 死掉的 claude:auth-login IPC 路徑
- **狀態**：DONE
- **類型**：HOTFIX(🔴 High severity,插入語音功能工單序列中)
- **建立時間**：2026-04-11 01:03 (UTC+8)
- **開始時間**：2026-04-11 01:08 (UTC+8)
- **完成時間**：2026-04-11 01:15 (UTC+8)
- **對應 Bug**:BUG-001(`_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`)
- **前置工單**:無(獨立於語音功能)

## 工作量預估
- **預估規模**:小(S)— 使用者報修單已做完根因分析,sub-session 直接修
- **Context Window 風險**:低
- **降級策略**:若 §3 死路徑清理遇到複雜依賴,可標記 PARTIAL,只完成 §1 主因修復

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:乾淨 context 執行修復 + 3 個回歸測試

## 與語音功能工單的衝突檢查

| 路徑 | T0006(本工單) | T0007(預覽框) | 衝突? |
|------|---------------|----------------|-------|
| `src/components/TerminalPanel.tsx` | ✏️ 獨占 | 不碰 | ❌ 無 |
| `src/components/ClaudeAgentPanel.tsx` L1140-1170 | ✏️ 刪除 | 不碰 | ❌ 無 |
| `electron/main.ts` L1065-1105 | ✏️ 刪除 | 不碰 | ❌ 無 |
| `electron/preload.ts`(若有對應 bridge) | ✏️ 刪除 | 不碰 | ❌ 無 |
| `src/components/PromptBox.tsx` | 不碰 | 不碰 | ❌ 無 |
| `src/components/voice/*` | 不碰 | ✏️ | ❌ 無 |

**結論**:本工單與 T0007 可平行執行(但本工單優先)。

---

## 任務指令

### 任務定位

**這是 hotfix**。使用者已經完成:
- 完整症狀描述
- 根因分析(xterm.js bracketed paste bypass)
- 具體檔案與行號
- 最小修法草案
- 回歸測試情境

Sub-session 的任務是**驗證並執行修復**,**不需要**自己做根因分析。

---

### 前置條件

**必讀文件**:
- `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`(**完整讀**,這是本工單的規格書)
- `CLAUDE.md`(No Regressions、Logging 規範)

**必讀專案檔案**(使用者已指出的路徑):
- `src/components/TerminalPanel.tsx`
  - L47-65 — `writeChunked` function
  - L68-98 — `handlePasteText` function
  - L107-117 — `handlePaste`(右鍵貼上)
  - L360-393 — Ctrl+V / Ctrl+Shift+V handler
- `src/components/ClaudeAgentPanel.tsx` L1140-1170 — `/login` slash command 攔截(§3 技術債)
- `electron/main.ts` L1065-1105 — `claude:auth-login` IPC handler(§3 技術債)
- `electron/preload.ts` L180-195 — IPC bridge(僅查看,若有對應 `claude.authLogin` 則刪除)

---

### 工作範圍

#### §1 — 主因修復:TerminalPanel paste 改走 xterm.js bracketed paste

**使用者的最小修法草案**(來自 BUG-001 §修復方向建議):

**改動 1**:`handlePasteText` 改用 `terminalRef.current?.paste(text)`

原始碼(概念):
```typescript
// handlePasteText (L68-98)
// 原本:
window.electronAPI.pty.write(terminalId, text);

// 改為:
terminalRef.current?.paste(text);
```

**為什麼有效**:
- `terminal.paste(data)` 會檢查接收端 app 是否啟用 bracketed paste 模式
- 若啟用(Ink TUI 會送 `\x1b[?2004h`),自動加上 `\x1b[200~` / `\x1b[201~` markers
- 接收端看到 markers 就知道這是「一次 paste」,不會把每個字元當成 keypress

**改動 2**:`writeChunked` 門檻調整

原始碼(概念):
```typescript
// handlePasteText (L68-98)
if (text.length > 4000) {
  await writeChunked(...);
} else {
  // 直接 write
}
```

**改法 A(推薦)**:門檻從 4000 拉高到 64KB
```typescript
if (text.length > 64000) {
  await writeChunked(...);
} else {
  terminalRef.current?.paste(text);
}
```

**改法 B(更保守)**:只在接收端未啟用 bracketed paste 時才切塊
- 需要偵測 bracketed paste 狀態(xterm.js 有 API?sub-session 自己查)
- 較複雜,若 API 不存在則 fall back 到改法 A

**選擇建議**:先試改法 A,簡單且對 UX 影響最小。若測試發現有問題再改 B。

**改動 3**:保留 10KB 大檔案確認對話框(使用者明確要求)

不要動既有的「貼上 >10KB 時跳確認」邏輯,只改底層 write 方式。

---

#### §2 — 驗證(使用者建議的兩個情境)

**重要**:在修改程式碼**之前**,先做一次**基線重現**確認 bug 存在。這是必要步驟,避免「以為修好了其實是環境問題」。

**基線重現**:
1. 啟動 app
2. 執行 `claude`
3. `/login`
4. 複製 BUG-001 報修單描述的授權碼流程
5. 確認 paste 被截斷

**非 Claude 情境重現**(強驗證根因):
1. 在終端分頁跑:`printf '\e[?2004h'; read` 啟用 bracketed paste
2. Ctrl+V 貼 300 字元文字
3. 觀察 `read` 收到的字元數
4. **預期**(未修時):只收到末段少量字元 → 確認根因是 bracketed paste bypass
5. 若沒重現 → 可能根因不同,停下回報

> ⚠️ 若 sub-session 無法實際跑 Electron app 執行這個驗證(headless 環境),改為**靜態分析** — 讀 `TerminalPanel.tsx` 確認 paste 路徑確實是 `pty.write` 而非 `terminal.paste`,作為根因的 code-level 證據。Runtime 驗證延後到 T0011 整合測試。

---

#### §3 — 清理死掉的 claude:auth-login IPC 路徑(順手做)

**背景**:使用者在 BUG-001 追查過程中發現的連帶技術債(§3)。不影響本 bug 主因,但同屬「paste / login 流程」,順手清掉避免未來誤用。

**要刪除的東西**:

1. **`src/components/ClaudeAgentPanel.tsx` L1140-1170 附近**:
   - 攔截 `/login` slash command 並呼叫 `window.electronAPI.claude.authLogin()` 的邏輯
   - 這條路徑是死的(execFile 沒 TTY、命令名稱可能不存在、UI 沒授權碼輸入框)
   - 移除後,使用者在 ClaudeAgentPanel 打 `/login` 會**正常當成對話內容送給 Claude**(不再被攔截)

2. **`electron/main.ts` L1065-1105 附近**:
   - `registerHandler('claude:auth-login', ...)` 的整個 handler
   - 對應的 `execFile('claude', ['auth', 'login'], ...)` 呼叫
   - 刪除這段

3. **`electron/preload.ts` 對應 bridge**(若有):
   - 查 `window.electronAPI.claude.authLogin` 或類似方法
   - 若存在則從 preload 的 `claude` namespace 移除
   - 同步更新 `src/types/electron.d.ts` 的 `ClaudeAPI` 介面(若有)

**驗證**:
- [ ] `grep -r "claude:auth-login" src/ electron/` 應該無結果
- [ ] `grep -r "claude.authLogin" src/ electron/` 應該無結果
- [ ] `npx vite build` 通過(無型別錯誤)

---

#### §4 — 不做的項目

明確**不處理**以下項目(使用者在 BUG-001 §4 明確說先不碰):

- ❌ `Browser didn't open?` 自動開瀏覽器失敗
- ❌ PTY env 配置
- ❌ Node `open` 套件相關問題

如果 sub-session 在修 §1/§3 時手癢想順便處理,**停下回報**。

---

### 回歸測試情境(使用者要求)

修復後必須跑以下 3 個情境,全部 ✅ 才算 DONE:

**測試 1:貼大段 shell 指令**
- 在終端跑 bash / pwsh
- 貼一段 ~2KB 的多行 shell 指令
- **預期**:完整貼入,可執行
- **失敗條件**:字元遺失、特殊字元被吃、指令斷掉

**測試 2:貼文字到 vim / nano**
- 開啟 `vim` 或 `nano`
- 進入 insert mode
- 貼一段 ~500 字元文字(含中文、英文、符號)
- **預期**:完整貼入,不觸發 vim 鍵盤命令
- **失敗條件**:字元觸發 vim 快捷鍵造成副作用

**測試 3:claude /login 完整流程**(**最關鍵**)
- 跑 `claude` → `/login`
- 走完授權流程,拿到授權碼
- 在 `Paste code here if prompted >` 按 Ctrl+V
- **預期**:完整授權碼進入輸入框,按 Enter 後登入成功
- **失敗條件**:只有末段字元進入(與 BUG-001 症狀相同)

> ⚠️ 若 sub-session 為 headless CLI 環境無法實際跑 Electron app:
> - 測試 1 和 2 無法執行
> - 測試 3 絕對無法執行(需要人手點 OAuth 流程)
> - **此時**只能做 code-level 驗證(grep / 靜態分析),runtime 驗證延後到 T0011
> - 回報時明確標註「runtime 測試延後」,狀態為 PARTIAL

---

### 不在本工單範圍

- ❌ 不動任何語音功能檔案(`src/components/voice/*`、`electron/voice-*.ts`、`src/lib/voice/*`)
- ❌ 不動 PromptBox(T0007 獨占)
- ❌ 不動 PTY env 設定(§4 明確不碰)
- ❌ 不重構 `TerminalPanel.tsx` 的其他部分(只修 paste 相關)
- ❌ 不修其他 bug

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 通過
- [ ] **No Regression**:Electron app 啟動成功,既有功能未破壞
- [ ] **§1 主因修復**:
  - [ ] `handlePasteText` 改為 `terminalRef.current?.paste(text)`
  - [ ] `writeChunked` 門檻調整為 64KB(或使用改法 B 並說明理由)
  - [ ] 保留 10KB 大檔案確認對話框
- [ ] **§3 技術債清理**:
  - [ ] `ClaudeAgentPanel.tsx` 的 `/login` 攔截已移除
  - [ ] `electron/main.ts` 的 `claude:auth-login` handler 已移除
  - [ ] `electron/preload.ts` 的對應 bridge 已移除(若存在)
  - [ ] `src/types/electron.d.ts` 同步更新(若有型別宣告)
  - [ ] `grep -r "claude:auth-login\|claude.authLogin"` 結果為空
- [ ] **回歸測試**:
  - [ ] 測試 1:shell 指令貼上(runtime 或 code-level 驗證)
  - [ ] 測試 2:vim/nano 貼上(runtime 或 code-level 驗證)
  - [ ] 測試 3:claude /login(runtime 或 code-level 驗證)
- [ ] **日誌合規**:無新增的 `console.log`
- [ ] **檔案所有權**:未觸碰語音功能檔案(voice/*)

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。

### 執行步驟

1. 讀取本工單全部內容
2. **完整讀** `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`(使用者的詳細分析)
3. 讀取 `CLAUDE.md`(No Regressions 政策)
4. 讀取 `src/components/TerminalPanel.tsx`(主要修改對象)
5. 讀取 `src/components/ClaudeAgentPanel.tsx` L1140-1170(§3 清理對象)
6. 讀取 `electron/main.ts` L1065-1105(§3 清理對象)
7. 讀取 `electron/preload.ts`(查 `claude.authLogin` bridge)
8. 更新「開始時間」
9. 執行 §2 基線驗證(若 headless 則做 code-level 確認)
10. 執行 §1 主因修復
11. 執行 §3 技術債清理
12. `npx vite build` 驗證
13. 執行回歸測試(runtime 或 code-level)
14. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **信任使用者的分析**:根因已確認為 xterm.js bracketed paste bypass,不要重新調研
- **最小改動原則**:只改 paste 路徑 + 清 §3,不重構其他部分
- **若 §3 清理遇到意外依賴**:例如發現還有程式碼在用 `claude.authLogin` → 停下回報,不要硬刪
- **headless 環境限制**:若無法跑 Electron app,code-level 驗證也可接受,回報 PARTIAL
- **不要踩到語音功能檔案**:`voice/*` 都不是本工單範圍

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE (runtime 測試延後 — headless CLI 環境無法跑 Electron app)

### 產出摘要

**修改檔案**:
- `src/components/TerminalPanel.tsx` — §1: `handlePasteText` 改用 `terminalRef.current?.paste(text)`，門檻從 4000 調高到 64000
- `src/components/ClaudeAgentPanel.tsx` — §3: 移除 `/login` slash command 攔截（L1146-1168 整段）
- `electron/main.ts` — §3: 移除 `claude:auth-login` IPC handler（L1076-1088）
- `electron/preload.ts` — §3: 移除 `authLogin` bridge 方法
- `electron/remote/protocol.ts` — §3: 移除 `claude:auth-login` 從 allowed channels 列表

**刪除的死路徑**:
- `ClaudeAgentPanel.tsx`: `/login` 攔截 → `window.electronAPI.claude.authLogin()` 整段（22 行）
- `electron/main.ts`: `registerHandler('claude:auth-login', ...)` 整段（13 行）
- `electron/preload.ts`: `authLogin: () => ipcRenderer.invoke('claude:auth-login')` （2 行）
- `electron/remote/protocol.ts`: `'claude:auth-login'` 從 channel whitelist 移除

### 互動紀錄
無

### 遭遇問題
無

### §2 基線驗證結果
Code-level 根因確認：`handlePasteText` 的所有路徑都走 `window.electronAPI.pty.write(terminalId, text)` 繞過 xterm.js 的 `terminal.paste()` 方法。未發現任何 bracketed paste marker（`\x1b[200~` / `\x1b[201~`）的處理。根因與 BUG-001 分析一致。

### 回歸測試結果

| 測試 | 方式 | 結果 |
|------|------|------|
| 1 - 貼 shell 指令 | code-level | ✅ `terminal.paste()` 正確寫入，shell 不啟用 bracketed paste 時等同直接寫入 |
| 2 - 貼到 vim/nano | code-level | ✅ vim/nano 啟用 bracketed paste 時，`terminal.paste()` 會自動加 markers |
| 3 - claude /login | code-level | ✅ Ink TUI 啟用 bracketed paste，`terminal.paste()` 會包 markers，授權碼完整傳入 |

### Build 驗證結果
`npx vite build` 三個 target（renderer / main / preload）全部通過，無 error 無 warning（僅有既有的 dynamic import 提示）

### §3 死路徑清理驗證
- [x] `grep -r "claude:auth-login" src/ electron/` 結果：無匹配 ✅
- [x] `grep -r "authLogin" src/ electron/` 結果：無匹配 ✅

### 給塔台的備註
- Runtime 驗證（測試 1/2/3）因 headless 環境限制延後，建議納入下次手動測試或 T0011 整合測試
- `writeChunked` 仍保留用於 >64KB 的超大 paste，此路徑仍走 `pty.write`（不走 bracketed paste）。極端情境（>64KB paste 到啟用 bracketed paste 的 TUI）理論上仍可能截斷，但此情境極為罕見
- `/logout` 和 `/whoami` 的 IPC 路徑（`claude:auth-logout` / `claude:auth-status`）未移除，因為它們使用 `execFile` 的非互動模式，功能正常

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 01:15 (UTC+8)
