# T0111 — BUG：Terminal Server 未在 BAT 關閉後存活

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0111 |
| **標題** | 診斷 + 修復：Terminal Server 在 BAT 關閉後未存活，重啟無復原提示 |
| **類型** | Bug Fix / 診斷 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 21:04 UTC+8 |
| **優先級** | 🔴 High |
| **建立時間** | 2026-04-13 20:55 UTC+8 |
| **相關** | PLAN-008 / T0106~T0110 |

---

## 現象

使用者 `dev serve` 測試，BAT 正常關閉（SysTray → Quit 或 View → Reload）後：
1. ❌ 重啟無復原提示
2. ❌ 終端輸出未恢復（回到 shell 初始狀態）
3. ❌ Claude Code CLI session 遺失
4. ✅ Claude Code Agent session 有保存（這是既有機制，與 Terminal Server 無關）

**結論**：Terminal Server 進程在 BAT 關閉時被殺掉，未存活。

---

## 懷疑根因（優先度排序）

### H1（最可能）：cleanupAllProcesses() 殺掉 Terminal Server

`electron/main.ts` 的關閉流程：
```
before-quit → save profiles → cleanupAllProcesses() → app.quit()
window-all-closed → cleanupAllProcesses() → app.quit()
```

`cleanupAllProcesses()` 可能遍歷所有 child process 並 kill，包括 Terminal Server。
需確認這個函數的實作，以及是否排除了 Terminal Server。

### H2：detached + unref 在 Windows 上行為異常

`child_process.fork()` 的 `detached: true` + `unref()` 在 Windows 上的行為可能與 macOS/Linux 不同。
Windows 的進程組管理可能導致子進程隨父進程退出。

### H3：Electron 的 app.quit() 強制殺死所有子進程

Electron 可能在 `app.quit()` 時自動清理所有透過 `fork()`/`spawn()` 建立的子進程。

### H4：PID/Port file 未正確寫入

Server 啟動了但 PID/port file 沒寫或寫錯位置，重啟時偵測不到。

### H5：Server 啟動失敗（靜默）

`startTerminalServer()` 的 `existsSync` 檢查可能在 dev mode 下跳過了 Server 啟動。

---

## 任務清單

### Step 1：診斷 — 確認 Server 是否真的啟動

在 `dev serve` 環境中：
```bash
# 1. 啟動 BAT
npm run dev

# 2. 檢查是否有 terminal-server 進程
# Windows:
tasklist | findstr terminal-server
# 或搜尋 node 進程：
wmic process where "commandline like '%terminal-server%'" get processid,commandline

# 3. 檢查 PID / Port file
ls ~/AppData/Roaming/better-agent-terminal/bat-pty-server.*
cat ~/AppData/Roaming/better-agent-terminal/bat-pty-server.pid
cat ~/AppData/Roaming/better-agent-terminal/bat-pty-server.port
```

### Step 2：診斷 — 確認 Server 是否在關閉時被殺

```bash
# 1. 記下 Server PID
# 2. 關閉 BAT（SysTray → Quit）
# 3. 立刻檢查 Server 進程是否還在
tasklist | findstr <PID>
```

### Step 3：診斷 — 檢查 cleanupAllProcesses()

讀取 `electron/main.ts` 中 `cleanupAllProcesses()` 的實作：
- 是否遍歷所有 child process？
- 是否有排除 Terminal Server 的邏輯？
- Windows 上的 `taskkill /F /T /PID` 是否會連帶殺 Terminal Server？

### Step 4：修復

根據診斷結果修復。最可能的修復：

**若 H1 確認**：
```typescript
function cleanupAllProcesses() {
  // 排除 Terminal Server
  ptyManager?.dispose()  // 這裡不應 kill server
  // kill Claude Agent processes
  // kill Remote Server
  // 但不 kill Terminal Server（讓它 idle timeout 自行關閉）
}
```

**若 H2/H3 確認**：
```typescript
// Windows 上可能需要用不同方式啟動 Server
// 例如 spawn() 而非 fork()
// 或使用 Windows Service / 獨立 .exe
```

**若 H4/H5 確認**：
修正文件路徑或啟動條件。

### Step 5：加入 debug logging

在 Terminal Server 的關鍵路徑加入 logger：
```typescript
logger.log('[TerminalServer] Started, PID:', process.pid)
logger.log('[TerminalServer] TCP listening on port:', port)
logger.log('[TerminalServer] disconnect event received')
logger.log('[TerminalServer] idle timeout reached, shutting down')
```

BAT 端：
```typescript
logger.log('[main] startTerminalServer: isServerRunning =', isServerRunning())
logger.log('[main] startTerminalServer: PID file =', readPidFile())
logger.log('[main] startTerminalServer: port file =', readPortFile())
```

### Step 6：Build + 驗證

```bash
npx vite build
```

Runtime 驗證：
1. 啟動 BAT → 確認 Server PID file 和 port file 存在
2. 開終端 → 打指令
3. 關閉 BAT → 確認 Server 進程仍存活
4. 重啟 BAT → 看到復原提示
5. 選恢復 → 終端輸出恢復

---

## 驗收條件

1. 根因已確認並記錄
2. BAT 正常關閉（Quit / Reload）後 Terminal Server 進程存活
3. PID / Port file 在 BAT 關閉後仍存在
4. BAT 重啟後顯示復原提示
5. 選「恢復」後終端輸出恢復
6. Debug log 保留（方便未來排查）

---

## 回報區（Worker 填寫）

### 根因確認
**其他（工單未列出的場景）**：

Bug 實際觸發路徑是 **View → Reload / Force Reload**，不是 SysTray → Quit → 重啟。
Quit → 重啟流程**已正常運作**（T0110 機制有效）。

### 診斷過程
1. 查閱 log 檔案（`~\AppData\Roaming\better-agent-terminal\Logs\`）：
   - dev serve session（第一個 log）：Terminal Server 正常啟動（pid 37740），6 個 PTY 建立
   - 重啟 packaged app session（第二個 log）：完全無 `[terminal-server]` 日誌 → 確認是環境誤判（用戶誤啟動正式版）
2. 用戶確認：Quit → restart 流程**正常有復原提示**；**View → Reload 才是問題**
3. 追蹤 `did-finish-load` handler（main.ts:1040）：
   - 只檢查 `pendingRecovery` 變數
   - `pendingRecovery` 僅在 `startTerminalServer()` 初始啟動時設定
   - `View → Reload` 觸發時 main process 不重啟，`startTerminalServer()` 不再執行
   - 因此 `pendingRecovery` 永遠是 `null`，復原提示不會觸發
4. 確認 `ptyManager.dispose()`（proxy 模式）不 kill Terminal Server → H1 排除
5. 確認 Terminal Server 會在 Reload 後繼續存活（idle timeout 機制）

### 修復內容（共 5 個檔案）

**修復 1**：`electron/main.ts` — `did-finish-load` async probe + pull model
- `did-finish-load` handler 改為 async，`pendingRecovery` 為 null 時主動 TCP probe Terminal Server
- 加 `ipcMain.handle('terminal-server:query-pending-recovery')` — renderer 掛載後主動查詢（pull model）
- 解決 push event 在 React useEffect 註冊 listener 前送出被丟棄的 timing 問題

**修復 2**：`electron/preload.ts` + `src/App.tsx`
- preload 加 `queryPendingRecovery()` invoke
- App.tsx useEffect 掛載後呼叫 `queryPendingRecovery()` 取得 pending recovery 狀態

**修復 3**：`electron/pty-manager.ts` — 三個修正
- 加 `isIpcConnected()` method
- `create()`: 加冪等檢查 — `instances.has(id)` 時跳過 `pty:create`（防止 View→Reload 時 `initTerminals` 覆蓋已存在的 PTY，清空 ring buffer）
- `connectToServer()`: 連線前先 `destroy()` 舊 TCP socket，防止 orphaned socket 疊加導致訊息倍增

**修復 4**：`electron/main.ts` — `terminal-server:recover` handler
- IPC 仍存活時（View→Reload 場景）跳過 `connectToServer()`，直接用 IPC 送 `pty:list`
- 避免 IPC + TCP 雙通道 `broadcastToAll()` → 字元重複

**修復 5**：`electron/terminal-server/server.ts` — `createPty` 冪等
- PTY ID 已存在時跳過建立，回傳既有 `pty:created`（防禦層，主要攔截在 ptyManager）

### 修改檔案清單
- `electron/main.ts` — did-finish-load probe + query-pending-recovery handler + recover handler IPC check
- `electron/preload.ts` — queryPendingRecovery IPC binding
- `electron/pty-manager.ts` — isIpcConnected + create idempotent + connectToServer cleanup
- `electron/terminal-server/server.ts` — createPty idempotent + trace logging
- `src/App.tsx` — useEffect pull model query

### Commit Hash
（完成後填寫）

### 問題 / 卡點
無

### 已知殘留風險（回報塔台）
**Terminal Server 運行中突然死亡時，已連線的終端會卡住**：
- `sendToServer()` 寫入被丟棄（只 log warn），無自動重連到 local PTY 或新 server
- 需要 heartbeat / watchdog 機制，不在 T0111 範圍
- 建議開新工單處理：T01xx — Terminal Server heartbeat + 自動重連

### 完成時間
2026-04-13 22:09 UTC+8
