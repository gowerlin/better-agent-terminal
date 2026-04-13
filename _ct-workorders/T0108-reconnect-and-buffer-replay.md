# T0108 — 重連邏輯 + TCP Fallback + Buffer 重播

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0108 |
| **標題** | PLAN-008 Phase 4：BAT 重啟後重連 Terminal Server + 重播輸出 |
| **類型** | 功能開發 |
| **狀態** | ✅ DONE |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 20:01 UTC+8 |
| **相關** | PLAN-008 / T0106 / T0107 |
| **前置** | T0107 ✅ DONE |
| **後續** | T0110（復原提示 UI） |

---

## 背景

T0106+T0107 讓 PTY 跑在獨立 Terminal Server 中，但目前 BAT 重啟後**無法重連**到存活的 Server：
- `child_process.fork` 的 IPC channel 在父進程退出時斷開
- BAT 重啟後是全新進程，無法使用原本的 fork IPC
- 需要第二通道（TCP localhost）讓 BAT 重連到已存活的 Server

**完成後的 milestone**：BAT 關閉 → 重新開啟 → 自動偵測到存活的 Server → 重連 → 終端輸出恢復。

---

## 架構設計

```
首次啟動：
  main.ts → fork() → Terminal Server
  通訊方式：fork IPC（process.send / process.on('message')）

BAT 關閉後重啟：
  main.ts → readPidFile() → isServerRunning(pid) → YES
         → TCP connect localhost:PORT
  通訊方式：TCP JSON-line protocol

Terminal Server 同時支援兩種通道：
  1. fork IPC（初次啟動時自動建立）
  2. TCP server（隨時監聽，供重連使用）
```

---

## 任務清單

### Step 1：Terminal Server 加入 TCP 監聽

修改 `electron/terminal-server/server.ts`：

```typescript
import * as net from 'net'

class TerminalServer {
  private tcpServer: net.Server | null = null
  private tcpClients: Set<net.Socket> = new Set()
  private port: number = 0  // 動態分配

  startTcpServer(): void {
    this.tcpServer = net.createServer((socket) => {
      this.tcpClients.add(socket)
      this.resetIdleTimer()  // 有新連線，重置 idle

      let buffer = ''
      socket.on('data', (chunk) => {
        buffer += chunk.toString()
        // JSON-line protocol：每行一個 JSON 訊息
        const lines = buffer.split('\n')
        buffer = lines.pop()!  // 保留未完成的行
        for (const line of lines) {
          if (line.trim()) {
            const msg = JSON.parse(line) as ServerRequest
            this.handleMessage(msg, 'tcp', socket)
          }
        }
      })

      socket.on('close', () => {
        this.tcpClients.delete(socket)
        if (this.tcpClients.size === 0 && !process.connected) {
          this.startIdleTimer()  // 所有連線斷開，開始倒計時
        }
      })
    })

    this.tcpServer.listen(0, '127.0.0.1', () => {
      this.port = (this.tcpServer!.address() as net.AddressInfo).port
      // 把 port 寫入 port file（供重連偵測）
      writePortFile(this.port)
    })
  }

  // 修改 sendResponse：根據來源選擇 fork IPC 或 TCP socket
  private sendResponse(msg: ServerResponse, via: 'ipc' | 'tcp', socket?: net.Socket): void
}
```

**Port file**：`userData/bat-pty-server.port`（PID file 旁邊）

### Step 2：protocol.ts 擴充

新增 port file 管理函數到 `pid-manager.ts`（或新增 `port-manager.ts`）：

```typescript
writePortFile(port: number, userDataPath?: string): void
readPortFile(userDataPath?: string): number | null
removePortFile(userDataPath?: string): void
```

### Step 3：Terminal Server 進程入口更新

修改 `electron/terminal-server.ts`：

```typescript
const server = new TerminalServer()
server.startTcpServer()  // 新增：啟動 TCP 監聽
writePidFile(process.pid)
// port file 由 startTcpServer 內部寫入
```

### Step 4：PtyManager 加入 TCP 重連能力

修改 `electron/pty-manager.ts`：

```typescript
class PtyManager {
  private tcpSocket: net.Socket | null = null

  // TCP 連線（重連模式）
  connectToServer(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      socket.connect(port, '127.0.0.1', () => {
        this.tcpSocket = socket
        this.setupTcpListener()
        resolve(true)
      })
      socket.on('error', () => resolve(false))
      socket.setTimeout(3000, () => { socket.destroy(); resolve(false) })
    })
  }

  private setupTcpListener(): void {
    let buffer = ''
    this.tcpSocket!.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop()!
      for (const line of lines) {
        if (line.trim()) {
          this.handleServerMessage(JSON.parse(line))
        }
      }
    })
  }

  // 修改 sendToServer：根據可用通道選擇
  private sendToServer(msg: ServerRequest): boolean {
    if (this.serverProcess?.connected) {
      this.serverProcess.send(msg)
      return true
    }
    if (this.tcpSocket && !this.tcpSocket.destroyed) {
      this.tcpSocket.write(JSON.stringify(msg) + '\n')
      return true
    }
    return false  // 無可用通道 → fallback
  }

  // 統一：useServer 判斷改為兩通道
  private get useServer(): boolean {
    return (this.serverProcess?.connected === true) ||
           (this.tcpSocket !== null && !this.tcpSocket.destroyed)
  }
}
```

### Step 5：main.ts 啟動偵測 + 重連

修改 `electron/main.ts` 的 `startTerminalServer()`：

```typescript
async function startTerminalServer(): Promise<ChildProcess | null> {
  // 1. 檢查是否已有 server 執行中
  if (isServerRunning()) {
    const port = readPortFile()
    if (port) {
      // 嘗試 TCP 重連
      const connected = await ptyManager.connectToServer(port)
      if (connected) {
        logger.log(`Reconnected to existing Terminal Server on port ${port}`)
        // 重播 buffer（見 Step 6）
        await replayBuffers()
        return null  // 不需要 fork 新的
      }
    }
    // PID 存在但連不上 → 殭屍進程，清理後 fork 新的
    logger.warn('Stale Terminal Server detected, starting fresh')
    removePidFile()
    removePortFile()
  }

  // 2. Fork 新的 server
  const server = fork(...)
  return server
}
```

### Step 6：Buffer 重播

重連成功後，向 Server 請求每個 PTY 的 ring buffer，重播到 renderer：

```typescript
async function replayBuffers(): Promise<void> {
  // 1. 向 Server 請求 PTY 列表
  ptyManager.sendToServer({ type: 'pty:list' })

  // 2. 收到列表後，對每個 PTY 請求 buffer
  // ptyManager.sendToServer({ type: 'pty:getBuffer', id })

  // 3. 收到 buffer 後，透過 webContents.send('pty:data') 發給 renderer
  // xterm.js 會渲染這些歷史輸出
}
```

> ⚠️ 重播時需要讓 renderer 知道這是「歷史重播」而非「即時輸出」。
> 可以先用同一個 `pty:data` channel 送出，xterm.js 會正常渲染。
> 若未來需要區分，可加 flag。

### Step 7：handleMessage 統一化

Server 端的 `handleMessage` 需要知道回應要送到哪（fork IPC 或 TCP socket）。
修改為攜帶 `via` 參數：

```typescript
handleMessage(msg: ServerRequest, via: 'ipc' | 'tcp', socket?: net.Socket): void {
  // ... 處理邏輯 ...
  // 回應時使用對應通道
  this.sendResponse(response, via, socket)
}

// pty:data 需要廣播到所有連線的 client（fork IPC + 所有 TCP clients）
private broadcastData(msg: ServerResponse): void {
  if (process.connected) process.send(msg)
  for (const client of this.tcpClients) {
    client.write(JSON.stringify(msg) + '\n')
  }
}
```

### Step 8：清理邏輯

- Server shutdown 時：關閉 TCP server + 移除 port file + 移除 PID file
- BAT 正常關閉時：不 kill server、不斷 TCP（讓 idle timeout 處理）
- BAT 異常退出：TCP 自動斷開 → server 偵測到所有連線消失 → 開始 idle timer

### Step 9：Build 驗證

```bash
npx vite build
```

---

## 不在範圍

- ❌ 孤兒回收 TTL 清理（T0109）
- ❌ Settings UI 設定項（T0109）
- ❌ ASAR unpack（T0109）
- ❌ 復原提示 UI dialog（T0110）
- ❌ Workspace/terminal metadata 復原（T0110，需配合 window-registry 的 restore 邏輯）

---

## 驗收條件

1. Terminal Server 同時監聽 fork IPC 和 TCP localhost
2. Port file 正確寫入/讀取/清理
3. BAT 重啟後偵測到存活的 Server → TCP 重連成功
4. 重連後 `pty:list` 返回存活的 PTY 列表
5. `pty:getBuffer` 返回 ring buffer 內容
6. Buffer 內容發送到 renderer（xterm.js 渲染歷史輸出）
7. 重連後 write / resize / kill 正常運作
8. Server 殭屍偵測（PID 存在但連不上 → 清理 + 重新 fork）
9. Build 通過

---

## 交付物

- `electron/terminal-server/server.ts` 修改（TCP 監聽 + 雙通道回應）
- `electron/terminal-server.ts` 修改（啟動 TCP）
- `electron/terminal-server/pid-manager.ts` 擴充（port file）
- `electron/pty-manager.ts` 修改（TCP 重連 + 雙通道發送）
- `electron/main.ts` 修改（啟動偵測 + 重連流程）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
完整實作 PLAN-008 Phase 4 重連邏輯。Terminal Server 現在同時監聽 fork IPC 和 TCP localhost 兩個通道。BAT 重啟後會先偵測存活的 Server，透過 TCP 重連並觸發 buffer 重播，讓終端歷史輸出恢復到 renderer。殭屍進程偵測（PID 存在但 TCP 連不上）會自動清理後重新 fork。Build 驗證通過。

### TCP 協議實際實作
**JSON-line protocol**（與設計一致）：每條訊息為一個 JSON 物件 + `\n` 換行符。
- Server 端：`net.createServer()` 監聽隨機 port，`127.0.0.1` 限本機；port 寫入 `bat-pty-server.port` 檔案
- Client 端（PtyManager）：`net.Socket` 連線，buffer + split('\n') 逐行解析
- Port file 位置：`userData/bat-pty-server.port`（與 PID file 並排）

### 重播機制
**異步 fire-and-forget 設計**（與設計一致，略有簡化）：
1. `startTerminalServer()` 呼叫 `ptyManager.connectToServer(port)` — Promise-based，3 秒 timeout
2. 連線成功後送出 `{ type: 'pty:list' }`
3. `handleServerMessage` 收到 `pty:list` → `handleReplayList()` → 為每個 PTY 送 `pty:getBuffer`，並將 PTY 實例加入 `instances` map（確保後續 write/resize/kill 正常運作）
4. `handleServerMessage` 收到 `pty:buffer` → `handleReplayBuffer()` → `broadcast('pty:output', id, data)` → xterm.js 渲染

設計差異：`replayBuffers()` 未獨立為 main.ts 函數，而是合併進 `PtyManager` 的 listener 鏈（更簡潔，避免在 main.ts 暴露過多細節）。

### Commit Hash
`c65fb6e`

### 問題 / 卡點
一個時序問題：原本 `ptyManager` 在 `createWindow()` 中初始化，但 `startTerminalServer()` 在此之前呼叫，導致 TCP 重連時 `ptyManager` 為 null。解法：在 `app.whenReady()` 裡把 `ptyManager` 建立移到 `await startTerminalServer()` 之前，`createWindow()` 保留 null guard 作為防禦性後備。

### 完成時間
2026-04-13 20:18
