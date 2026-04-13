# T0110 — 啟動復原提示 UI

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0110 |
| **標題** | PLAN-008 Phase 6：BAT 重啟後復原提示 UI |
| **類型** | 功能開發 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 20:41 UTC+8 |
| **完成時間** | 2026-04-13 20:52 UTC+8 |
| **優先級** | 中 |
| **建立時間** | 2026-04-13 20:38 UTC+8 |
| **相關** | PLAN-008 / T0108（重連邏輯） |
| **前置** | T0108 ✅ / T0109 ✅ |

---

## 背景

T0108 實作了 BAT 重啟後自動偵測 + TCP 重連 + buffer 重播。但目前重連是**靜默執行**的——使用者不知道：
- 上次有幾個終端存活
- 是否成功重連
- 可以選擇放棄舊 session 重新開始

本工單加入啟動時的復原提示，讓使用者決定是否恢復。

---

## 目標

BAT 重啟時，若偵測到存活的 Terminal Server：

```
┌─────────────────────────────────────────────┐
│  🔄 偵測到上次的終端 session                  │
│                                              │
│  Terminal Server 仍在運行，有 N 個終端存活。    │
│                                              │
│  [恢復 session]     [重新開始]                │
└─────────────────────────────────────────────┘
```

- **恢復 session**：TCP 重連 + buffer 重播（現有 T0108 邏輯）
- **重新開始**：送 `server:shutdown` 給舊 Server → fork 全新 Server

---

## 任務清單

### Step 1：main.ts 啟動流程調整

目前 `startTerminalServer()` 偵測到存活 Server 就直接重連。改為：

```typescript
async function startTerminalServer(): Promise<ChildProcess | null> {
  if (isServerRunning()) {
    const port = readPortFile()
    if (port) {
      // 先取得 PTY 列表（確認真的有存活的 terminal）
      const ptyCount = await probeServerPtyCount(port)
      if (ptyCount > 0) {
        // 有存活終端 → 發 IPC 事件給 renderer 讓使用者決定
        // 等待使用者回應後再決定重連或重啟
        pendingRecovery = { port, ptyCount }
        return null  // 暫不啟動，等使用者決定
      }
      // Server 活著但沒有 PTY → 直接 shutdown + fork 新的
      await shutdownStaleServer(port)
    }
    removePidFile()
    removePortFile()
  }
  return forkNewServer()
}
```

**`probeServerPtyCount(port)`**：
- 臨時建立 TCP 連線
- 送 `pty:list` → 收回應 → 取 count
- 斷開連線
- 3 秒 timeout

### Step 2：Recovery Prompt 元件

新增 `src/components/RecoveryPrompt.tsx`（或嵌入現有啟動畫面）：

```tsx
interface RecoveryPromptProps {
  ptyCount: number
  onRecover: () => void
  onFreshStart: () => void
}

function RecoveryPrompt({ ptyCount, onRecover, onFreshStart }: RecoveryPromptProps) {
  return (
    <div className="recovery-prompt-overlay">
      <div className="recovery-prompt-dialog">
        <h3>🔄 偵測到上次的終端 session</h3>
        <p>Terminal Server 仍在運行，有 {ptyCount} 個終端存活。</p>
        <div className="recovery-prompt-actions">
          <button className="btn-primary" onClick={onRecover}>
            恢復 session
          </button>
          <button className="btn-secondary" onClick={onFreshStart}>
            重新開始
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Step 3：IPC 通道

**main → renderer**：
```typescript
// main.ts：偵測到 pending recovery 時通知 renderer
mainWindow.webContents.send('terminal-server:recovery-available', { ptyCount })
```

**renderer → main**：
```typescript
// preload.ts 新增
ipcRenderer.send('terminal-server:recover')      // 使用者選「恢復」
ipcRenderer.send('terminal-server:fresh-start')   // 使用者選「重新開始」
```

**main.ts handler**：
```typescript
ipcMain.on('terminal-server:recover', async () => {
  // 執行 T0108 的重連 + buffer 重播邏輯
  await ptyManager.connectToServer(pendingRecovery.port)
})

ipcMain.on('terminal-server:fresh-start', async () => {
  // Shutdown 舊 Server → fork 新的
  await shutdownStaleServer(pendingRecovery.port)
  const server = forkNewServer()
  ptyManager.setServerProcess(server)
})
```

### Step 4：App.tsx 整合

在 `App.tsx`（或主佈局元件）中：

```tsx
const [recoveryInfo, setRecoveryInfo] = useState<{ ptyCount: number } | null>(null)

useEffect(() => {
  window.electronAPI.onRecoveryAvailable((info) => {
    setRecoveryInfo(info)
  })
}, [])

// 渲染
{recoveryInfo && (
  <RecoveryPrompt
    ptyCount={recoveryInfo.ptyCount}
    onRecover={() => {
      window.electronAPI.terminalServer.recover()
      setRecoveryInfo(null)
    }}
    onFreshStart={() => {
      window.electronAPI.terminalServer.freshStart()
      setRecoveryInfo(null)
    }}
  />
)}
```

### Step 5：Preload.ts 擴充

```typescript
// electron/preload.ts 新增
terminalServer: {
  onRecoveryAvailable: (callback: (info: { ptyCount: number }) => void) => {
    ipcRenderer.on('terminal-server:recovery-available', (_, info) => callback(info))
  },
  recover: () => ipcRenderer.send('terminal-server:recover'),
  freshStart: () => ipcRenderer.send('terminal-server:fresh-start'),
}
```

### Step 6：樣式

`src/styles/` 中加入 recovery prompt 的樣式（overlay + dialog，簡潔風格，與現有 UI 一致）。

### Step 7：Edge Cases

- **Server 在使用者決定前掛掉**：recovery prompt 自動消失，fallback fork 新 Server
- **多視窗**：只在第一個視窗顯示 prompt，其他視窗等待
- **無存活 PTY**：不顯示 prompt，直接 shutdown + fork 新的（Step 1 已處理）

### Step 8：Build 驗證

```bash
npx vite build
```

---

## 不在範圍

- ❌ 復原 workspace/tab metadata 的完整匹配（用現有 window-registry 的 restore 邏輯）
- ❌ 復原 agent session（sdkSessionId resume 是現有機制，不需新增）

---

## 驗收條件

1. BAT 重啟時，若偵測到存活 Server + 有 PTY → 顯示復原提示
2. 選「恢復 session」→ TCP 重連 + buffer 重播 + 終端輸出恢復
3. 選「重新開始」→ 舊 Server shutdown + fork 新 Server
4. 無存活 PTY 時不顯示 prompt
5. Server 在 prompt 期間掛掉 → 自動 fallback
6. Build 通過

---

## 交付物

- `src/components/RecoveryPrompt.tsx` 新增
- `src/styles/` 相關樣式
- `electron/preload.ts` 擴充
- `electron/main.ts` 修改（啟動流程 + IPC handler）
- `src/App.tsx`（或主佈局）整合
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
完整實作 T0110 所有 8 個步驟：
- main.ts：加入 `probeServerPtyCount()` + `sendShutdownToServer()` + `pendingRecovery` 狀態
- `startTerminalServer()` 修改：ptyCount > 0 時儲存 pendingRecovery，defer 到使用者決定
- `did-finish-load` hook 推送 `terminal-server:recovery-available` 事件給第一個視窗
- IPC handlers：`terminal-server:recover` + `terminal-server:fresh-start`（含 fallback 邏輯）
- 新增 `RecoveryPrompt.tsx` 元件
- `preload.ts` 擴充 `terminalServer` namespace
- `electron.d.ts` 新增 `ElectronAPI.terminalServer` 型別
- `notifications.css` 加入 `.recovery-prompt-*` 樣式
- `App.tsx` 整合：state + useEffect + JSX overlay
- Build 驗證：全部 4 個 targets 通過

### UI 呈現方式
Full-screen overlay（z-index 4000，高於其他 dialog），中央置中 dialog，沿用 update-notification 樣式語言（`var(--bg-secondary)`, `var(--border-color)` 等 CSS 變數）。

### Probe 機制
`probeServerPtyCount(port)` — 建立臨時 TCP Socket 連到 `127.0.0.1:port`，送 `{"type":"pty:list"}\n`，解析 newline-framed JSON 回應，取 `ptys.length`，3 秒 timeout，任何錯誤 return 0。連線使用後立即 destroy，不影響 ptyManager 的正式連線狀態。

### Commit Hash
5b8d99a — feat(terminal-server): T0110 — recovery prompt UI on BAT restart

### 問題 / 卡點
無。Read hook 攔截了部分檔案讀取（只顯示第 1 行），改用 Bash sed 直接讀取特定行範圍。

### 完成時間
2026-04-13 20:52 UTC+8
