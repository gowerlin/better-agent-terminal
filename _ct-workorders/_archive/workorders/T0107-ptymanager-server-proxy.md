# T0107 — PtyManager → Terminal Server Proxy 重構

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0107 |
| **標題** | PLAN-008 Phase 2b+3：PtyManager 代理到 Terminal Server |
| **類型** | 功能開發 / 重構 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 19:52 UTC+8 |
| **完成時間** | 2026-04-13 19:59 UTC+8 |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 19:48 UTC+8 |
| **相關** | PLAN-008 / T0106（Server 骨架） |
| **前置** | T0106 ✅ DONE（commit c1d238a） |
| **後續** | T0108（重連）/ T0109（Config + 孤兒回收） |

---

## 背景

T0106 建立了獨立 Terminal Server 進程，但 BAT 主進程仍直接使用 `node-pty` 管理 PTY。
本工單將 `PtyManager` 從「直接 spawn PTY」改為「透過 IPC 代理到 Terminal Server」。

**完成後的關鍵 milestone**：BAT 關閉再重啟 → Terminal Server 仍在 → PTY 進程存活。

---

## 現有架構（T0106 前）

```
main.ts → PtyManager.create() → pty.spawn() → 直接持有 PTY
                                    ↓
                              pty.onData → broadcastHub / webContents.send
```

**PtyManager 的 public API**（`electron/pty-manager.ts`，363 行）：
- `create(options)` — 建立 PTY（node-pty 或 fallback child_process）
- `write(id, data)` — 寫入 PTY stdin
- `resize(id, cols, rows)` — 調整 PTY 尺寸
- `kill(id)` — 終止 PTY
- `dispose()` — 終止全部 PTY
- `restart(id, cwd, shell?)` — 重啟 PTY
- `getCwd(id)` — 取得 PTY 工作目錄
- `writeToTerminal(id, data)` — 直接寫入（含 batching）
- 內建：output batching（16ms）+ ring buffer（50 行 supervisor 用）

**main.ts IPC handlers**（Line 1077-1100）：
```typescript
registerHandler('pty:create', ... => ptyManager?.create(...))
registerHandler('pty:write', ... => ptyManager?.write(...))
registerHandler('pty:resize', ... => ptyManager?.resize(...))
registerHandler('pty:kill', ... => ptyManager?.kill(...))
registerHandler('pty:restart', ... => ptyManager?.restart(...))
registerHandler('pty:get-cwd', ... => ptyManager?.getCwd(...))
```

---

## 目標架構（T0107 後）

```
main.ts → PtyManager.create() → serverProcess.send({ type: 'pty:create', ... })
                                    ↓
                              Terminal Server spawn PTY
                                    ↓
                              serverProcess.on('message', { type: 'pty:data' })
                                    ↓
                              PtyManager → broadcastHub / webContents.send
```

**PtyManager 的 public API 不變**，main.ts 的 IPC handlers 不需修改。
改動集中在 PtyManager 內部實作。

---

## 任務清單

### Step 1：PtyManager 加入 Server 連接管理

```typescript
class PtyManager {
  private serverProcess: ChildProcess | null = null

  // 注入 server 引用（由 main.ts 的 startTerminalServer() 取得）
  setServerProcess(server: ChildProcess): void

  // Server 訊息 listener
  private setupServerListener(): void {
    this.serverProcess.on('message', (msg: ServerResponse) => {
      switch (msg.type) {
        case 'pty:data':    this.handlePtyData(msg.id, msg.data); break
        case 'pty:exit':    this.handlePtyExit(msg.id, msg.exitCode); break
        case 'pty:created': this.handlePtyCreated(msg.id, msg.pid); break
        case 'error':       logger.error('Server error:', msg); break
      }
    })
  }

  // 判斷是否使用 server（server 可用 → proxy，否則 → fallback 直接 spawn）
  private get useServer(): boolean {
    return this.serverProcess !== null && this.serverProcess.connected
  }
}
```

### Step 2：改寫 create() — 代理到 Server

```typescript
create(options: CreatePtyOptions): boolean {
  if (this.useServer) {
    // Proxy 模式：發訊息給 Server
    this.serverProcess!.send({
      type: 'pty:create',
      id: options.id,
      shell: resolvedShell,
      args: resolvedArgs,
      cwd: options.cwd,
      cols: 120,
      rows: 30,
      env: envWithUtf8
    } as ServerRequest)

    // 註冊 instance（無 process 引用，由 Server 管理）
    this.instances.set(options.id, {
      process: null,  // Server 端持有 PTY
      type: 'terminal',
      cwd: options.cwd,
      usePty: true
    })
    return true
  }

  // Fallback：直接 spawn（保留現有邏輯）
  return this.createDirect(options)
}
```

> ⚠️ 現有的 shell 偵測 + env 組裝邏輯（getDefaultShell、platform 判斷等）保留在 PtyManager，不移到 Server。
> Server 收到的是已解析完的 shell/args/env。

### Step 3：改寫 write / resize / kill — 代理到 Server

```typescript
write(id: string, data: string): void {
  if (this.useServer && this.instances.has(id)) {
    this.serverProcess!.send({ type: 'pty:write', id, data })
    return
  }
  // Fallback: direct
  ...
}

resize(id: string, cols: number, rows: number): void {
  if (this.useServer && this.instances.has(id)) {
    this.serverProcess!.send({ type: 'pty:resize', id, cols, rows })
    return
  }
  // Fallback: direct
  ...
}

kill(id: string): boolean {
  if (this.useServer && this.instances.has(id)) {
    this.serverProcess!.send({ type: 'pty:kill', id })
    this.instances.delete(id)
    return true
  }
  // Fallback: direct
  ...
}
```

### Step 4：handlePtyData — Server 輸出 → 廣播到 Renderer

```typescript
private handlePtyData(id: string, data: string): void {
  // 使用現有的 output batching 邏輯（16ms 合併）
  // 和現有的 broadcastHub + webContents.send 機制
  // 與直接 spawn 模式的廣播路徑完全相同
  this.bufferAndBroadcast(id, data)
}

private handlePtyExit(id: string, exitCode: number): void {
  this.instances.delete(id)
  // 通知 renderer
  for (const win of this.getWindows()) {
    win.webContents.send('pty:exit', id, exitCode)
  }
}
```

### Step 5：改寫 dispose() — 優雅關閉

```typescript
dispose(): void {
  if (this.useServer) {
    // 通知 Server shutdown（或讓它 idle timeout 自行關閉）
    // 不 kill server——讓使用者可以重啟 BAT 後重連
    this.serverProcess = null
  }
  // Fallback instances 仍需直接 kill
  for (const [id, inst] of this.instances) {
    if (inst.process) { /* 直接 kill */ }
  }
  this.instances.clear()
}
```

### Step 6：main.ts 連接 Server 和 PtyManager

```typescript
// app.whenReady() 中
const serverProcess = startTerminalServer()
if (serverProcess) {
  ptyManager.setServerProcess(serverProcess)
}
```

### Step 7：restart / getCwd 處理

- `restart(id, cwd, shell)`：kill 舊的 → create 新的（proxy 模式下走同一路徑）
- `getCwd(id)`：從本地 `instances` map 取（Server 端不需要查詢，因為 create 時已記錄 cwd）

### Step 8：Build + 基礎驗證

```bash
npx vite build
```

確認：
- TypeScript 無錯誤
- 新增的 import（protocol types）正確

---

## 不在範圍

- ❌ TCP fallback 重連（T0108）
- ❌ 孤兒回收 + Config UI（T0109）
- ❌ 復原提示 UI（T0110）
- ❌ ASAR unpack 設定（T0109 前處理）
- ❌ 修改 renderer 端程式碼（不需要，PtyManager API 不變）

---

## 驗收條件

1. PtyManager public API 不變（main.ts IPC handlers 不修改）
2. Server 模式：create → server spawn PTY → data 回流 → renderer 收到輸出
3. Fallback 模式：server 不可用時，自動降級為直接 spawn（現有行為）
4. write / resize / kill 在 proxy 模式下正常運作
5. Build 通過
6. 如果可以進行 runtime 測試（dev serve）：開一個終端 → 打字 → 看到輸出

---

## 交付物

- `electron/pty-manager.ts` 重構（proxy + fallback 雙模式）
- `electron/main.ts` 微調（連接 server ↔ ptyManager）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
按工單設計完整實作：
- `pty-manager.ts`：新增 `setServerProcess()` / `setupServerListener()` / `handlePtyData()` / `handlePtyExit()`；改寫 `create()` / `write()` / `resize()` / `kill()` / `writeToTerminal()` / `dispose()` 支援 proxy + fallback 雙模式
- `main.ts`：`_terminalServerProcess` 全局變數儲存 fork 引用；首次建立 window 時注入 `ptyManager.setServerProcess()`
- Build 通過，無 TypeScript 錯誤

### Fallback 處理方式
條件降級：`useServer` getter 即時判斷 `serverProcess?.connected`；server 不可用時每個操作自動降級走現有直接 spawn 路徑，邏輯完全保留。

### 與工單設計的差異
- `dispose()` 未呼叫 `pty:kill` IPC（工單設計亦如此）；直接 nullify serverProcess 讓 Server idle timeout 自行關閉
- `restart()` 不需特殊處理：kill → create 已自動走 proxy 路徑
- `getCwd()` 不需 Server 查詢：create 時已記錄 cwd 到 instances map

### Commit Hash
`55d33d8`

### 問題 / 卡點
無

### 完成時間
2026-04-13 19:59 UTC+8
