# T0149 — 修復：stopTerminalServerGracefully 支援 reconnect 路徑 + tcpSocket leak + 誤報 log（BUG-034）

## 元資料
- **工單編號**：T0149
- **任務名稱**：實作 T0148 方案 C：TCP shutdown 優先 → PID-based SIGTERM fallback → Windows taskkill 兜底；補修 tcpSocket leak + 修正誤報 log
- **類型**：fix
- **狀態**：✅ DONE（T0145 情境 9.1-9.3 打包驗收通過，BUG-034 CLOSED — D044）
- **建立時間**：2026-04-17 16:04 (UTC+8)
- **開始時間**：2026-04-17 16:12 (UTC+8)
- **完成時間**：2026-04-17 16:20 (UTC+8)
- **優先級**：🟡 Medium（不阻擋 release 但 PLAN-012 第二目標失效 + 使用者已選定方案）
- **關聯 BUG**：BUG-034（🔴 OPEN → 本工單開工後 → 🔧 FIXING）
- **關聯 PLAN**：PLAN-012
- **前置工單**：T0148（研究，根因確認 + 方案 C 定案）
- **後續工單**：T0145（驗收，需擴增情境 4：Reconnect 路徑 × checkbox 勾選）
- **預估難度**：⭐⭐⭐（跨檔案 + Windows 平台特化 + pidfile/portfile 整合 + 需打包驗收）
- **預估耗時**：2-3 小時（含本機冒煙 + 打包驗收配合）

---

## 決策依據

基於 T0148 研究結論（D040/D041）採**方案 C**：使用者已於 T0148 互動明確選定（回報區 [15:54]）。

### 核心根因（T0148 已確認）
T0144 實作的 `stopTerminalServerGracefully()` 只認 `_terminalServerProcess`（fork 路徑），但 BAT 偵測到 server 已在會走 **reconnect 路徑**（只建 TCP socket，`_terminalServerProcess` 保持 `null`）→ 函式 `if (!child) return` 立刻返回，SIGTERM 從未發出。

### 方案 C（使用者選定）
嘗試順序 **A → B → C → D**：
- **A**：若 `_terminalServerProcess` 存在且 `.connected`：`child.kill('SIGTERM')` + `once('exit')`（原邏輯，保留 fork 路徑）
- **B**：否則嘗試 TCP shutdown：讀取 `readPortFile(userDataPath)` → 複用 `sendShutdownToServer(port)`（`main.ts:223-235` 已實作）
- **C**：等待 pidfile 消失（server shutdown 時會 `removePidFile`）或 timeout 1500ms
- **D**：Timeout 後：讀取 `readPidFile` → Unix 用 `process.kill(pid, 'SIGKILL')` / Windows 用 `execFileNoThrow('taskkill', ['/F', '/T', '/PID', String(pid)])`

### 選方案 C 而非 A/B 單獨的理由
- **純 PID kill**（方案 A）：Windows `child.kill` 行為不可靠，且會跳過 server 的 graceful shutdown hook（profile snapshot save 等）
- **純 TCP shutdown**（方案 B）：server 卡住時沒有 kill 兜底，會無限等待
- **方案 C**：TCP graceful 優先 + SIGTERM/taskkill 兜底，涵蓋所有故障模式

---

## 修改範圍（3 檔案）

### 1. `electron/main.ts` — 重寫 `stopTerminalServerGracefully`（主修）

**位置**：約 `main.ts:1293-1331`（以實際行號為準）

**現狀**（Before）：
```typescript
async function stopTerminalServerGracefully(): Promise<void> {
  const child = _terminalServerProcess
  if (!child) return          // ← BUG-034 根因：reconnect 路徑 child=null 直接 return
  // ...SIGTERM + once('exit') + timeout
}
```

**實作指引（偽碼骨架）** — Worker 依專案慣例落實型別與既有 helper：

```
async function stopTerminalServerGracefully():
  TIMEOUT_MS = 1500
  stopped = false
  method = 'none'

  // Step A: Fork 路徑（原邏輯，保留）
  child = _terminalServerProcess
  if child and child.connected:
    try:
      race(child.once('exit') → stopped=true, method='SIGTERM'; sleep(TIMEOUT_MS))
      child.kill('SIGTERM')
      if stopped: log `[quit] terminal server stopped (via SIGTERM)`; return
    catch e: log error

  // Step B: TCP shutdown（reconnect 路徑 + A 失敗 fallback）
  try:
    port = readPortFile(userData)
    if port:
      sendShutdownToServer(port)            // main.ts:223-235 已存在
      // Step C: 等待 pidfile 消失 or timeout
      gone = waitForPidFileRemoval(TIMEOUT_MS)
      if gone:
        stopped = true
        log `[quit] terminal server stopped (via TCP shutdown)`
        return
  catch e: log error

  // Step D: 強制 kill 兜底
  try:
    pid = readPidFile(userData)
    if pid:
      if win32:
        // ⚠️ 嚴禁 child_process.exec（shell injection 風險）
        // 使用專案 util: src/utils/execFileNoThrow.ts
        await execFileNoThrow('taskkill', ['/F', '/T', '/PID', String(pid)])
        method = 'taskkill /F /T'
      else:
        process.kill(pid, 'SIGKILL')
        method = 'SIGKILL'
      stopped = true
      log `[quit] terminal server stopped (via ${method})`
      return
  catch e: log error

  log.error `[quit] terminal server stop failed — no handle / port / pid available`


async function waitForPidFileRemoval(timeoutMs):
  start = now()
  pidPath = pidFilePath(userData)
  while now() - start < timeoutMs:
    try: fs.access(pidPath)          // 存在 → continue
    catch: return true                // ENOENT = removed
    sleep(50)
  return false
```

**平台特化注意（Windows taskkill）**：
- **禁止** `child_process.exec` / `execSync`（shell injection 風險，且本專案 hook 會擋）
- **必須** 用專案 util `src/utils/execFileNoThrow.ts`：
  ```typescript
  import { execFileNoThrow } from '../utils/execFileNoThrow.js'
  const result = await execFileNoThrow('taskkill', ['/F', '/T', '/PID', String(pid)])
  ```
- `execFileNoThrow` 用 `execFile` 而非 `exec`（無 shell 解析）、處理 Windows 相容性、回傳結構化輸出（stdout、stderr、status）

**其他 helper 複用**：
- `readPortFile` / `readPidFile` / `sendShutdownToServer` / `pidFilePath` 可能已存在於 `main.ts` 或其他 util，**先 grep 確認避免重複實作**
- `sleep()` 若未定義可用 `new Promise(r => setTimeout(r, ms))`

### 2. `electron/pty-manager.ts` — `dispose()` 補 destroy tcpSocket

**位置**：約 `pty-manager.ts:751-771`（以實際行號為準）

**現狀**：`useServer=true` 時只設 `this.serverProcess = null`，tcpSocket 保持開啟。

**修改**：
```typescript
dispose(): void {
  // ...existing...
  if (this.useServer) {
    // BUG-034 bonus fix: destroy TCP socket to release event loop
    try {
      this.tcpSocket?.destroy()
      this.tcpSocket = null
    } catch (e) { /* best-effort */ }
    this.serverProcess = null
  }
  // ...existing...
}
```

**理由**：TCP socket 預設 refed → 阻止 main 的 event loop 結束 → 高度懷疑是 crashpad-handler 主進程殘留根因（T0148 bonus finding）。

### 3. `electron/main.ts:1424` — 修正誤報 log

**現狀**：無條件印出 `[quit] terminal server stopped`（即使 early-return 什麼都沒做）

**修改**：**移除此行**。改由 `stopTerminalServerGracefully` 內部依實際狀況 log（見 Step 1 實作的 `via ${method}` log 或 `logger.error`）。

---

## 執行步驟

### 1. 修改 code
依上述 3 處修改，保守原則：
- 先 grep 確認 `readPortFile` / `readPidFile` / `sendShutdownToServer` / `execFileNoThrow` 是否已存在
- 若缺失的 helper（如 `waitForPidFileRemoval`）請就近定義，不新建 util 檔
- TypeScript 型別請依專案既有風格（Promise return、error handling）

### 2. 本機 dev serve 冒煙（先於打包）
`npm run dev` → 測試：
- 情境 A：從 dev 啟動（fork 路徑）→ 勾 checkbox → 退出 → 確認 log 印 `via SIGTERM` 或 `via TCP shutdown`
- 情境 B：啟動後 kill dev 主進程但保留 terminal-server → 重新 `npm run dev`（reconnect 路徑）→ 勾 checkbox → 退出 → 確認 log + 工作管理員無殘留

### 3. 打包驗收（使用者配合）
`npm run build:win` → 重裝 → 告知使用者進入 T0145 驗收。
**注意**：塔台若跑在 BAT 內，rebuild 會斷 session，需事先退出塔台 session 或在外部終端跑。

### 4. Commit 訊息建議
```
fix: handle reconnect path in stopTerminalServerGracefully (BUG-034)

- stopTerminalServerGracefully: try SIGTERM → TCP shutdown → pidfile wait → taskkill/SIGKILL
- pty-manager.dispose: destroy tcpSocket to release event loop (crashpad-handler leak)
- remove unconditional "[quit] terminal server stopped" log (false positive)

Root cause: T0144 only handled fork path (_terminalServerProcess != null).
BAT's reconnect path (server already running) left _terminalServerProcess = null,
causing early-return and SIGTERM never fired. See T0148 for full investigation.

Uses execFileNoThrow for taskkill (no shell, injection-safe).

Closes BUG-034 (pending T0145 packaged acceptance)
```

### 5. 回塔台
- 回報 commit SHA
- 回報本機 dev serve 冒煙結果（情境 A/B 各自通過 / 失敗）
- 若過程中發現 T0148 研究未提及的新問題，列於回報區「遭遇問題」

---

## 成功判準

- ✅ 3 檔案修改完成，`npm run build` 無 TypeScript 錯誤
- ✅ Dev serve 情境 A（fork）+ 情境 B（reconnect）都印出正確 `via <method>` log，且工作管理員無 `BetterAgentTerminal.exe` 殘留
- ✅ Commit 訊息涵蓋 3 個修復點 + 引用 T0148
- ✅ 回塔台提供 commit SHA + 冒煙結果
- ✅ Windows taskkill 使用 `execFileNoThrow`，不用 `exec` / `execSync`

## 失敗判準

- ❌ 修改後任一 Quit 路徑完全無法退出（regression，需立即 rollback）
- ❌ Log 仍印出「已停止」但實際殘留（誤報未修好）
- ❌ Reconnect 路徑仍殘留 terminal-server（核心修復未生效）
- ❌ 使用 `child_process.exec` 或未清 escape 的 shell 指令（security hook 會擋）

---

## 相關檔案
- `electron/main.ts`（主修）
- `electron/pty-manager.ts`（bonus fix）
- `src/utils/execFileNoThrow.ts`（Windows taskkill 安全呼叫 util）
- T0148 commit `98be02d`（研究工單，根因 + 方案 + 驗收矩陣）
- T0144 commit `412d52c`（原 SIGTERM fallback 實作，本 bug 源頭）
- T0147 commit `ef867a2`（BUG-033 Tray handler 修復，與本修復獨立但同一 quit flow）

---

## 回報區

### 完成狀態
🔧 FIXED（修復已完成，等待 T0145 打包驗收；本 sub-session 無法完成 dev serve 冒煙，需使用者配合）

### 產出摘要
修改 2 檔案（main.ts +108/-35、pty-manager.ts +9/-0），涵蓋 T0148 方案 C 三個修復點：

**1. `electron/main.ts` — `stopTerminalServerGracefully` 完全重寫**（L1293-1403）
- Step A (Fork 路徑)：`_terminalServerProcess.connected` → `child.kill('SIGTERM')` + `once('exit')` race with 1500ms timeout
- Step B (TCP shutdown)：`readPortFile(userDataPath)` → `sendShutdownToServer(port)`（複用既有 helper）
- Step C (pidfile wait)：新增內嵌 `waitForPidFileRemoval(1500ms)`，50ms 輪詢 `fs.access('bat-pty-server.pid')` 直到 ENOENT
- Step D (強制 kill)：`readPidFile(userDataPath)` → Unix `process.kill(pid, 'SIGKILL')` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])`（非 `exec`，安全無 shell 注入）
- 四個路徑各自 log 實際成功方式（`via SIGTERM` / `via TCP shutdown` / `via taskkill /F /T` / `via SIGKILL`），失敗則 `logger.error`

**2. `electron/pty-manager.ts:751-779` — `dispose()` 補 destroy tcpSocket**
- `useServer=true` 分支內新增 `this.tcpSocket?.destroy()` 並置 null
- 修復 T0148 bonus finding：refed TCP socket 阻止 event loop 結束 → crashpad-handler 殘留

**3. `electron/main.ts:1491-1499` — 移除誤報 log**
- 刪除 `logger.log('[quit] terminal server stopped')`（無條件印，即使 early-return 也印）
- 改由 `stopTerminalServerGracefully` 內部按實際結果 log

### 相關 Helper 確認
- ✅ `readPortFile` / `readPidFile`：已在 `electron/terminal-server/pid-manager.ts` 匯出，main.ts:81 已 import
- ✅ `sendShutdownToServer`：已定義於 main.ts:223-235
- ✅ `path` / `fs from 'fs/promises'`：已 import（L2-3）
- ⚠️ `src/utils/execFileNoThrow.ts`：**不存在**於本專案，採用專案既有 pattern（main.ts:1696、2353 已用）：動態 import + `execFile`（非 `exec`）+ Promise wrapper，達成相同安全目標（`execFile` 天生無 shell 解析，`windowsHide: true`、`timeout: 3000`）
- ⚠️ `waitForPidFileRemoval`：不新建 util 檔，就近內嵌於 `stopTerminalServerGracefully` 函式作用域

### 建置驗證
- `npx vite build` → ✅ 3 bundle（main/preload/terminal-server）全部 built 成功，無錯誤
- `npx tsc --noEmit -p tsconfig.node.json` → 僅 pre-existing 錯誤（voice-handler 缺 whisper-node-addon 型別、worktree-manager execFile promisify 型別、types/index.ts "timing" enum），**無** L1280-1410 與 pty-manager.ts 相關錯誤

### Dev serve 冒煙結果
⏸️ **未執行**（需使用者配合）— 本 sub-session 工具限制：
- Sub-session 不能背景啟動 `npm run dev`（會卡住塔台回應）
- 無法操作 Quit Dialog、無法查看工作管理員程序殘留
- 依工單步驟 3 已註明「塔台若跑在 BAT 內，rebuild 會斷 session」，驗收應由使用者執行或在 T0145 情境 8 統一驗收

### 遭遇問題
1. **`execFileNoThrow` util 缺失**：工單指定使用 `src/utils/execFileNoThrow.ts`，但檔案不存在於本專案。決策：採用專案既有 pattern（動態 `import('child_process')` + `execFile` + Promise callback），安全性等價（無 shell 解析）、不新建 util 檔符合「保守原則」。
2. **`getPidFilePath` 未匯出**：pid-manager.ts 的 `getPidFilePath` 為 module-local，不匯出。決策：於 `stopTerminalServerGracefully` 內以 `path.join(userDataPath, 'bat-pty-server.pid')` 硬編碼檔名（與 pid-manager.ts:4 `PID_FILENAME` 常數保持一致）。若未來檔名變更需同步兩處。

### 互動紀錄
無（本 sub-session 全程無使用者互動，按工單既定方案 C 實作）

### Renew 歷程
無

### Commit
- Hash: `cd460d2`（full: `cd460d283561e87d36498c4cfa0e2c14cb3e9f2f`）
- Branch: `main`（ahead of origin by 7 commits，未 push）
- 檔案：`electron/main.ts`（+108/-35）、`electron/pty-manager.ts`（+9/-0）
- Message type: `fix`（對應 BUG 修復）

### 回報時間
2026-04-17 16:20 (UTC+8)

### 給塔台的建議
- BUG-034 狀態可由 OPEN → FIXING（或 VERIFY，視塔台收到本回報的處理策略）
- T0145 需擴增**情境 8**：Reconnect 路徑 × checkbox 勾選（打包環境），預期 log 印 `via TCP shutdown`（成功路徑）或 `via taskkill /F /T`（fallback）
- **預計 4 個 log 情境矩陣**（T0145 驗收參考）：
  - 情境 8a：Dev + fork + checkbox 勾 → 預期 `via SIGTERM`
  - 情境 8b：Dev + reconnect + checkbox 勾 → 預期 `via TCP shutdown`
  - 情境 8c：Packaged + reconnect + checkbox 勾（正常）→ 預期 `via TCP shutdown`
  - 情境 8d：Packaged + TCP 卡住模擬 → 預期 `via taskkill /F /T` fallback
- 若 `BetterAgentTerminal.exe` 仍有殘留（情境 8c 驗收失敗），先確認 pty-manager dispose 是否被呼叫（Ctrl+F search `dispose()` call-site）
- T0148 bonus finding 已修（tcpSocket leak），若殘留問題仍在，下一步可檢查 `net.Socket` refcount 或 `unref()` 策略

