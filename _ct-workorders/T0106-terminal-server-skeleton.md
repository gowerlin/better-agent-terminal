# T0106 — Terminal Server 骨架 + IPC 協議 + Ring Buffer

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0106 |
| **標題** | PLAN-008 Phase 2a：Terminal Server 獨立進程骨架 |
| **類型** | 功能開發 |
| **狀態** | 🔄 IN_PROGRESS |
| **開始時間** | 2026-04-13 19:36 UTC+8 |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 19:30 UTC+8 |
| **相關** | PLAN-008 / T0093（架構調查）/ D031（參數決策） |
| **後續** | T0107（PtyManager proxy）依賴本工單 |

---

## 背景

PLAN-008 Phase 2 的核心：建立獨立 Terminal Server 進程，管理所有 PTY 實例，使終端在 BAT 主進程關閉後存活。

本工單只做 **Server 端骨架**，不改動現有 PtyManager（那是 T0107 的範圍）。
完成後應可獨立啟動 server、透過 IPC 建立 PTY、收到輸出，但 BAT UI 還不會用它。

---

## 架構設計（基於 T0093 推薦方案 A）

```
electron/
├── main.ts                       ← 修改：啟動 server + 管理生命週期
├── terminal-server.ts            ← 新增：獨立 Node.js 進程入口
├── terminal-server/
│   ├── server.ts                 ← 新增：Server 核心（PTY 管理 + IPC handler）
│   ├── ring-buffer.ts            ← 新增：Ring Buffer（重連重播用）
│   ├── protocol.ts               ← 新增：IPC 訊息協議定義
│   └── pid-manager.ts            ← 新增：PID 檔案管理
└── pty-manager.ts                ← 本工單不改（T0107 範圍）
```

---

## 目標

1. 建立 `terminal-server.ts` 獨立進程入口
2. 定義 IPC 訊息協議（protocol.ts）
3. 實作 Server 核心功能：create / write / resize / kill PTY
4. 實作 Ring Buffer（每個 PTY 保留最近 N 行輸出）
5. 實作 PID 檔案管理（寫入/清理/偵測）
6. 在 main.ts 加入 server 啟動/停止邏輯

---

## 任務清單

### Step 1：IPC 訊息協議（protocol.ts）

定義 BAT ↔ Server 的所有訊息類型：

```typescript
// 請求（BAT → Server）
type ServerRequest =
  | { type: 'pty:create'; id: string; shell: string; args: string[]; cwd: string; cols: number; rows: number; env?: Record<string, string> }
  | { type: 'pty:write'; id: string; data: string }
  | { type: 'pty:resize'; id: string; cols: number; rows: number }
  | { type: 'pty:kill'; id: string }
  | { type: 'pty:list' }
  | { type: 'pty:getBuffer'; id: string }
  | { type: 'server:ping' }
  | { type: 'server:shutdown' }
  | { type: 'server:getConfig' }

// 回應（Server → BAT）
type ServerResponse =
  | { type: 'pty:created'; id: string; pid: number }
  | { type: 'pty:data'; id: string; data: string }
  | { type: 'pty:exit'; id: string; exitCode: number }
  | { type: 'pty:buffer'; id: string; lines: string[] }
  | { type: 'pty:list'; ptys: Array<{ id: string; pid: number; cwd: string }> }
  | { type: 'server:pong' }
  | { type: 'server:config'; scrollBufferLines: number; idleTimeoutMs: number }
  | { type: 'error'; requestType: string; message: string }
```

> 使用 `child_process.fork` 的內建 IPC（`process.send` / `process.on('message')`），自動 JSON 序列化。

### Step 2：Ring Buffer（ring-buffer.ts）

```typescript
class RingBuffer {
  constructor(maxLines: number = 1000) // D031: 預設 1000，可配置
  push(data: string): void            // 收到 PTY 輸出時加入
  getLines(): string[]                 // 重連時取回所有行
  clear(): void
  get lineCount(): number
}
```

**要點**：
- 按 `\n` 分割行
- 超過 maxLines 時丟棄最舊的行
- 記憶體友好（不保留整個 buffer string，存 string[]）

### Step 3：Server 核心（server.ts）

```typescript
// terminal-server 進程的主邏輯
class TerminalServer {
  private ptys: Map<string, { pty: IPty; buffer: RingBuffer; cwd: string }>

  handleMessage(msg: ServerRequest): void  // 分發處理
  createPty(req): void                     // spawn + 掛 buffer + 發 data 事件
  writePty(req): void
  resizePty(req): void
  killPty(req): void
  listPtys(): void
  getBuffer(req): void

  // 生命週期
  startIdleTimer(): void                   // D031: 預設 30min，可配置，含「永不」
  resetIdleTimer(): void                   // 收到任何請求時重置
  shutdown(): void                         // 清理所有 PTY + 移除 PID file
}
```

**Idle Timeout 邏輯**：
- 每次收到訊息重置 timer
- timeout 到期 → shutdown（kill 所有 PTY + 移除 PID）
- `idleTimeoutMs = 0` 表示永不自動關閉

### Step 4：PID 管理（pid-manager.ts）

```typescript
// PID 檔案路徑：userData/bat-pty-server.pid
writePidFile(pid: number): void
readPidFile(): number | null
removePidFile(): void
isServerRunning(): boolean  // 讀 PID + 嘗試 process.kill(pid, 0)
```

### Step 5：進程入口（terminal-server.ts）

```typescript
// 獨立進程入口，由 main.ts fork 啟動
import { TerminalServer } from './terminal-server/server'
import { writePidFile, removePidFile } from './terminal-server/pid-manager'

const server = new TerminalServer()
writePidFile(process.pid)

process.on('message', (msg) => server.handleMessage(msg))
process.on('SIGTERM', () => { server.shutdown(); removePidFile(); process.exit(0) })
process.on('disconnect', () => server.startIdleTimer())  // 主進程斷開時開始倒計時
```

### Step 6：main.ts 啟動/管理邏輯

在 main.ts 加入：

```typescript
import { fork } from 'child_process'
import { isServerRunning, readPidFile } from './terminal-server/pid-manager'

let serverProcess: ChildProcess | null = null

function startTerminalServer(): ChildProcess {
  // 1. 檢查是否已有 server 執行中（PID file + process.kill(pid, 0)）
  // 2. 若已存在 → 嘗試重連（T0108 範圍，本工單先 skip）
  // 3. 若不存在 → fork 啟動新 server
  const server = fork(path.join(__dirname, 'terminal-server.js'), [], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  })
  server.unref()  // 允許主進程在 server 存活時退出
  return server
}
```

**`app.whenReady()` 中呼叫 `startTerminalServer()`**。
**`before-quit` 中不 kill server**（讓它 idle timeout 自行關閉）。

### Step 7：Build 驗證

```bash
npx vite build
```

確認 TypeScript 編譯通過，terminal-server.ts 正確打包。

> ⚠️ 注意：Vite 預設不處理 Electron main process 的 fork 目標檔案。
> 可能需要調整 `electron-builder` 或 `vite.config.ts` 確保 `terminal-server.js` 被打包到正確位置。
> 若有打包問題，在回報區記錄，不要卡住。

---

## 不在範圍

- ❌ 不改 pty-manager.ts（T0107 範圍）
- ❌ 不做 TCP fallback 重連（T0108 範圍）
- ❌ 不做孤兒回收（T0109 範圍）
- ❌ 不做 Settings UI（T0109 範圍）
- ❌ 不做復原提示 UI（T0110 範圍）

---

## 驗收條件

1. `terminal-server.ts` 可被 `fork()` 啟動為獨立進程
2. 透過 IPC 發送 `pty:create` 可建立 PTY
3. PTY 輸出透過 `pty:data` 訊息送回主進程
4. `pty:write` / `pty:resize` / `pty:kill` 正常運作
5. Ring Buffer 正確保留最近 1000 行
6. PID 檔案正確寫入/讀取/清理
7. 主進程關閉後 server 進程繼續存活（`detached: true` + `unref()`）
8. Server 在 disconnect 事件後 30 分鐘自動 shutdown
9. Build 通過（或記錄打包問題但功能可用）

---

## 交付物

- `electron/terminal-server.ts`（進程入口）
- `electron/terminal-server/server.ts`（核心邏輯）
- `electron/terminal-server/ring-buffer.ts`（Ring Buffer）
- `electron/terminal-server/protocol.ts`（IPC 協議）
- `electron/terminal-server/pid-manager.ts`（PID 管理）
- `electron/main.ts` 修改（啟動邏輯）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
（完成後填寫）

### 打包/Build 備註
（Vite 打包 terminal-server.js 的處理方式）

### 與工單設計的差異
（若實作時發現需要調整設計，記錄在此）

### Commit Hash
（完成後填寫）

### 問題 / 卡點
（如有）

### 完成時間
（完成後填寫）
