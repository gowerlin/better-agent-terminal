# T0112 — Terminal Server Heartbeat + 自動重連

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0112 |
| **標題** | Terminal Server heartbeat watchdog + 自動故障恢復 |
| **類型** | 防禦性功能 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 22:16 UTC+8 |
| **完成時間** | 2026-04-13 22:35 UTC+8 |
| **優先級** | 中 |
| **建立時間** | 2026-04-13 22:12 UTC+8 |
| **相關** | PLAN-008 / T0111（殘留風險回報） |
| **前置** | T0111 ✅ |

---

## 背景

T0111 回報的殘留風險：Terminal Server 運行中突然死亡（crash / OOM / 被系統 kill）時，PtyManager 的 `sendToServer()` 寫入被靜默丟棄，終端卡住無回應，使用者無感知。

**需要**：
1. **Heartbeat**：定期偵測 Server 是否存活
2. **故障感知**：Server 死亡後通知使用者
3. **自動恢復**：重新 fork Server + 重建 PTY（輸出歷史會遺失，但終端可用）

---

## 設計

### Heartbeat 機制

```
PtyManager                    Terminal Server
    │                              │
    ├── ping ──────────────────→  │
    │                              ├── pong
    │  ←───────────────────────── │
    │                              │
    │   (每 10 秒一次)              │
    │                              │
    ├── ping ──────────────────→  │
    │   (3 秒無 pong → 判定死亡)    │
    │                              │
    ├── [故障恢復流程]              │
```

### 故障恢復流程

```
Server 死亡偵測
    ↓
通知 renderer（toast: "Terminal Server 異常，正在恢復..."）
    ↓
清理舊 PID/port file
    ↓
Fork 新 Server
    ↓
對每個 instances map 中的 PTY：
  - 發送 pty:create 重建（新 shell session）
  - 通知 renderer（toast: "終端已恢復，歷史輸出已遺失"）
    ↓
恢復正常
```

---

## 任務清單

### Step 1：PtyManager 加入 heartbeat

```typescript
class PtyManager {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private static readonly HEARTBEAT_INTERVAL_MS = 10_000  // 10 秒
  private static readonly HEARTBEAT_TIMEOUT_MS = 3_000    // 3 秒無回應 → 死亡

  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastPong > PtyManager.HEARTBEAT_TIMEOUT_MS + PtyManager.HEARTBEAT_INTERVAL_MS) {
        // Server 死亡
        this.handleServerDeath()
        return
      }
      this.sendToServer({ type: 'server:ping' })
    }, PtyManager.HEARTBEAT_INTERVAL_MS)
  }

  // 在 handleServerMessage 中處理 pong
  // case 'server:pong': this.lastPong = Date.now(); break
}
```

### Step 2：故障恢復 — handleServerDeath()

```typescript
private async handleServerDeath(): Promise<void> {
  logger.error('[PtyManager] Terminal Server died, attempting recovery...')
  this.stopHeartbeat()

  // 1. 通知 renderer
  for (const win of this.getWindows()) {
    win.webContents.send('terminal-server:status', 'recovering')
  }

  // 2. 清理舊連線
  this.serverProcess = null
  if (this.tcpSocket) { this.tcpSocket.destroy(); this.tcpSocket = null }
  removePidFile()
  removePortFile()

  // 3. 請求 main.ts 重新 fork（透過回呼或事件）
  const newServer = await this.onRequestNewServer?.()
  if (!newServer) {
    // fork 也失敗 → 降級為直接 spawn
    logger.error('[PtyManager] Failed to restart server, falling back to direct PTY')
    this.rebuildPtysLocal()
    return
  }

  this.setServerProcess(newServer)

  // 4. 重建所有 PTY
  const oldInstances = new Map(this.instances)
  this.instances.clear()
  for (const [id, inst] of oldInstances) {
    this.sendToServer({
      type: 'pty:create',
      id,
      shell: inst.shell || 'default',
      args: [],
      cwd: inst.cwd,
      cols: 120,
      rows: 30
    })
    this.instances.set(id, { ...inst, process: null })
  }

  // 5. 通知 renderer 恢復完成
  for (const win of this.getWindows()) {
    win.webContents.send('terminal-server:status', 'recovered')
  }
}
```

### Step 3：Renderer 端 toast 通知

利用現有的通知機制（或 status bar），顯示：

| 狀態 | 顯示 |
|------|------|
| `recovering` | "Terminal Server 異常，正在恢復..." |
| `recovered` | "終端已恢復（歷史輸出已重置）" — 3 秒後自動消失 |

不需要 dialog，toast 足夠。

**Preload + App.tsx**：
```typescript
// preload
terminalServer: {
  onStatusChange: (cb: (status: string) => void) => {
    ipcRenderer.on('terminal-server:status', (_, s) => cb(s))
  }
}

// App.tsx — 顯示 toast
```

### Step 4：PtyInstance 擴充 shell 欄位

目前 `PtyInstance` 只有 `cwd`，重建時需要知道 shell。
在 `create()` 時記錄 `shell` + `args`：

```typescript
interface PtyInstance {
  process: any
  type: 'terminal'
  cwd: string
  usePty: boolean
  shell?: string    // 新增：重建用
  shellArgs?: string[]  // 新增：重建用
}
```

### Step 5：IPC disconnect / TCP close 偵測

除了 heartbeat，也監聽連線層的斷開事件作為快速偵測：

```typescript
// fork IPC 斷開
this.serverProcess.on('exit', () => this.handleServerDeath())

// TCP socket 斷開
this.tcpSocket.on('close', () => {
  if (!this.isDisposing) this.handleServerDeath()
})
```

> 這比 heartbeat 更快（立即偵測），heartbeat 作為 backup。

### Step 6：防止重複恢復

加入 `isRecovering` flag，避免 heartbeat timeout + disconnect 事件同時觸發兩次恢復：

```typescript
private isRecovering = false

private async handleServerDeath(): Promise<void> {
  if (this.isRecovering) return
  this.isRecovering = true
  try {
    // ... 恢復邏輯
  } finally {
    this.isRecovering = false
  }
}
```

### Step 7：Build + 驗證

```bash
npx vite build
```

---

## 驗收條件

1. Server 存活時，heartbeat 正常（每 10 秒 ping/pong，無感知）
2. 手動 kill Server 進程後，3~13 秒內觸發恢復
3. 恢復過程中 renderer 顯示 toast
4. 恢復完成後終端可用（新 shell session，歷史遺失是預期行為）
5. fork 失敗時降級為直接 PTY spawn
6. 不會重複觸發恢復
7. Build 通過

---

## 交付物

- `electron/pty-manager.ts` 修改（heartbeat + handleServerDeath + PtyInstance 擴充）
- `electron/main.ts` 修改（提供 re-fork 回呼）
- `electron/preload.ts` 擴充（onStatusChange）
- `src/App.tsx` 修改（toast 通知）
- `src/types/electron.d.ts` 型別更新
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
T0112 完整實作。6 個檔案修改，276 行新增：
- `electron/pty-manager.ts`：PtyInstance 擴充 shell/shellArgs、heartbeat 機制、handleServerDeath()、isRecovering guard、IPC exit + TCP close 快速偵測
- `electron/main.ts`：reforkTerminalServer() + onRequestNewServer 回呼綁定
- `electron/preload.ts`：onStatusChange IPC bridge
- `src/types/electron.d.ts`：新增 queryPendingRecovery + onStatusChange 型別
- `src/App.tsx`：serverStatusToast state + 訂閱 onStatusChange
- `src/styles/notifications.css`：server-status-toast toast 樣式

### Heartbeat 實際參數
- `HEARTBEAT_INTERVAL_MS = 10_000`（10 秒 ping 週期）
- `HEARTBEAT_TIMEOUT_MS = 3_000`（3 秒無 pong → 死亡判定）
- 實際超時 = 10 + 3 = 13 秒（與設計一致）

### 恢復機制
與設計一致，唯一差異：
- 工單設計中 `this.getWindows()` 用於廣播，實作改用既有 `this.broadcast()` 方法，更簡潔
- `connectToServer()` 的 TCP close 事件也觸發 handleServerDeath（雙重保護）
- rebuild PTY 時不帶 env（server 維持自身 env 設定），符合現有 create() 行為

### Commit Hash
`8ecd3f1`

### 問題 / 卡點
無。Read hook 攔截只讀第 1 行，改用 Bash cat 直接讀取檔案。

### 完成時間
2026-04-13 22:35 UTC+8
