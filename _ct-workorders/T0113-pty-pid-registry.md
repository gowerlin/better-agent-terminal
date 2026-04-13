# T0113 — PTY PID Registry（Windows 孤兒清理）

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0113 |
| **標題** | PTY PID Registry：追蹤個別 PTY 進程，Server crash 後清理孤兒 |
| **類型** | 防禦性功能 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 22:32 |
| **優先級** | 中 |
| **建立時間** | 2026-04-13 22:32 UTC+8 |
| **相關** | PLAN-008 / T0112（heartbeat） |
| **前置** | T0112 ✅ |

---

## 背景

Terminal Server crash 後，T0112 的 heartbeat 會偵測到並 fork 新 Server + 重建 PTY。
但**舊 Server 管理的 PTY 子進程**（bash / powershell / zsh）可能仍在系統中：

| 平台 | Server 死後 PTY 行為 | 孤兒風險 |
|------|---------------------|---------|
| macOS / Linux | master fd 關閉 → SIGHUP → shell 通常退出 | 低 |
| Windows | ConPTY handle 釋放 → shell 不一定退出 | **高** |

每次 crash → recovery 都可能累積孤兒進程。目前無法定向清理。

---

## 設計

### Registry 檔案

`userData/bat-pty-registry.json`（PLAN-008 原設計）：

```json
{
  "serverPid": 12345,
  "ptys": [
    { "id": "term-001", "pid": 23456, "cwd": "/workspace/A", "createdAt": "ISO-8601" },
    { "id": "term-002", "pid": 23789, "cwd": "/workspace/B", "createdAt": "ISO-8601" }
  ],
  "updatedAt": "ISO-8601"
}
```

### 寫入時機

| 事件 | 動作 |
|------|------|
| `pty:create` 成功 | 加入 registry |
| `pty:exit` | 從 registry 移除 |
| `pty:kill` | 從 registry 移除 |
| Server shutdown | 清空 registry file |

### 讀取 + 清理時機

| 事件 | 動作 |
|------|------|
| `startTerminalServer()` 偵測到殭屍 PID | 讀 registry → kill 所有列出的 PTY PID → 清空 file |
| T0112 `handleServerDeath()` | 讀 registry → kill 舊 PTY PID → 清空 → 再重建 |

---

## 任務清單

### Step 1：Registry 模組

新增 `electron/terminal-server/pty-registry.ts`：

```typescript
interface PtyRegistryEntry {
  id: string
  pid: number
  cwd: string
  createdAt: string
}

interface PtyRegistry {
  serverPid: number
  ptys: PtyRegistryEntry[]
  updatedAt: string
}

function getRegistryPath(userDataPath?: string): string
function readRegistry(userDataPath?: string): PtyRegistry | null
function writeRegistry(registry: PtyRegistry, userDataPath?: string): void
function clearRegistry(userDataPath?: string): void

// 便利函數
function addPtyEntry(entry: PtyRegistryEntry, userDataPath?: string): void
function removePtyEntry(id: string, userDataPath?: string): void
```

### Step 2：Server 端寫入

修改 `electron/terminal-server/server.ts`：

- `createPty()`：spawn 成功後呼叫 `addPtyEntry({ id, pid: pty.pid, cwd, createdAt })`
- `killPty()`：呼叫 `removePtyEntry(id)`
- PTY `exit` 事件：呼叫 `removePtyEntry(id)`
- `shutdown()`：呼叫 `clearRegistry()`
- Server 啟動時：寫入 `serverPid`

### Step 3：Recovery 時清理

修改 `electron/pty-manager.ts` 的 `handleServerDeath()`：

```typescript
private async handleServerDeath(): Promise<void> {
  // ... 現有邏輯 ...

  // 新增：讀 registry → kill 舊 PTY 進程
  const registry = readRegistry()
  if (registry?.ptys.length) {
    for (const entry of registry.ptys) {
      try {
        process.kill(entry.pid, 'SIGTERM')
        logger.log(`[PtyManager] Killed orphan PTY pid=${entry.pid} id=${entry.id}`)
      } catch {
        // 已經死了，忽略
      }
    }
    // Windows 加強：用 execFile 殺進程樹（避免 shell injection）
    if (process.platform === 'win32') {
      const { execFile } = require('child_process')
      for (const entry of registry.ptys) {
        try {
          execFile('taskkill', ['/F', '/T', '/PID', String(entry.pid)], { stdio: 'ignore' })
        } catch { /* ignore */ }
      }
    }
  }
  clearRegistry()

  // ... 繼續 fork 新 Server + 重建 PTY ...
}
```

> ⚠️ 安全：Windows 進程清理使用 `execFile`（非 `exec`），PID 為 number 強制轉 string，無注入風險。
> 參考：本專案 `src/utils/execFileNoThrow.ts` 提供的安全模式。

### Step 4：啟動時殭屍清理

修改 `electron/main.ts` 的 `startTerminalServer()`：

```typescript
// 殭屍偵測段落加入 registry 清理
if (!isServerRunning() && readPidFile()) {
  // 舊 Server 已死，清理孤兒 PTY
  const registry = readRegistry()
  if (registry?.ptys.length) {
    for (const entry of registry.ptys) {
      try { process.kill(entry.pid, 'SIGTERM') } catch {}
      if (process.platform === 'win32') {
        try {
          require('child_process').execFileSync('taskkill', ['/F', '/T', '/PID', String(entry.pid)], { stdio: 'ignore' })
        } catch {}
      }
    }
    logger.log(`[main] Cleaned ${registry.ptys.length} orphan PTY processes`)
  }
  clearRegistry()
  removePidFile()
  removePortFile()
}
```

### Step 5：Build 驗證

```bash
npx vite build
```

---

## 驗收條件

1. `bat-pty-registry.json` 在 PTY 建立/銷毀時正確更新
2. Server 正常 shutdown 清空 registry
3. Server crash 後 recovery 能讀 registry + kill 舊 PTY
4. BAT 啟動偵測到殭屍時清理 registry 中的 PTY PID
5. Windows 上使用 `execFile('taskkill', ...)` 確保進程樹清理（安全）
6. macOS/Linux 上 `SIGTERM` 清理（通常已自動死亡，防禦性）
7. Build 通過

---

## 交付物

- `electron/terminal-server/pty-registry.ts` 新增
- `electron/terminal-server/server.ts` 修改（寫入 registry）
- `electron/pty-manager.ts` 修改（recovery 清理）
- `electron/main.ts` 修改（啟動時清理）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要

按工單設計完成所有 5 個步驟：

1. **pty-registry.ts 模組**：新增 `electron/terminal-server/pty-registry.ts`，包含 `readRegistry`、`writeRegistry`、`clearRegistry`、`addPtyEntry`、`removePtyEntry` 函數，風格與 `pid-manager.ts` 一致
2. **Server 端寫入**：修改 `server.ts`，在 `startTcpServer` 初始化 registry、`createPty` 成功後加入 entry、`onExit` 和 `killPty` 移除 entry、`shutdown` 清空 registry
3. **Recovery 清理**：修改 `pty-manager.ts` 的 `handleServerDeath()`，讀 registry → SIGTERM 所有舊 PTY → Windows 用 `execFile('taskkill')` 清理進程樹 → 清空 registry
4. **啟動殭屍清理**：修改 `main.ts` 的 `startTerminalServer()`，在偵測到殭屍 Server 時同步清理 registry 中的 PTY PID
5. **Build 驗證**：四個 bundle 全部通過（renderer 9.27s、main 1.16s、preload 21ms、terminal-server 24ms）

### Registry 實際格式

與設計一致，無差異：
```json
{
  "serverPid": 12345,
  "ptys": [
    { "id": "term-001", "pid": 23456, "cwd": "/workspace/A", "createdAt": "ISO-8601" }
  ],
  "updatedAt": "ISO-8601"
}
```

`addPtyEntry` 額外接收 `serverPid` 參數以確保 registry 的 serverPid 始終正確。

### 產出檔案

- `electron/terminal-server/pty-registry.ts` — 新增（72 行）
- `electron/terminal-server/server.ts` — 修改（import + 5 處 registry 操作）
- `electron/pty-manager.ts` — 修改（import + handleServerDeath 加入 orphan kill）
- `electron/main.ts` — 修改（import + startTerminalServer 加入 registry 清理）

### Commit Hash
（待 commit）

### 問題 / 卡點
無

### 互動紀錄
無

### 完成時間
2026-04-13 22:40
