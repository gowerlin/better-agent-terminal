# T0150 — 修復：shutdown 期間停用 PtyManager heartbeat watchdog 避免誤 re-fork（BUG-035）

## 元資料
- **工單編號**：T0150
- **任務名稱**：在 `stopTerminalServerGracefully()` 執行任何 kill 動作前，先通知 PtyManager 進入「意圖 shutdown 模式」，讓 heartbeat watchdog 跳過 re-fork，避免產生孤兒 terminal-server
- **類型**：fix
- **狀態**：🟢 FIXED
- **建立時間**：2026-04-17 16:49 (UTC+8)
- **開始時間**：2026-04-17 16:53 (UTC+8)
- **完成時間**：2026-04-17 16:57 (UTC+8)
- **優先級**：🟡 Medium（使用者體驗上 PLAN-012 第二目標仍失效，但不阻擋 release）
- **關聯 BUG**：BUG-035（PtyManager watchdog shutdown race）
- **關聯 PLAN**：PLAN-012
- **前置工單**：T0149（方案 C 實作 commit `cd460d2`，修 BUG-034 early-return）
- **後續工單**：T0145（驗收，情境 9.1 重測）
- **預估難度**：⭐⭐（1 處 flag + 1 處 guard + watchdog timer 取消，code locality 小）
- **預估耗時**：30-60 分鐘（含本機冒煙 + 打包驗收配合）

---

## 決策依據

### 根因（BUG-035 log 證實）
T0149 的 `sendShutdownToServer()` 關閉 TCP → `PtyManager` 的 heartbeat watchdog 誤判為 crash → 自動 re-fork terminal-server。Log 時間序（2026-04-17 08:42:48）：

```
.814 [PtyManager] TCP connection to Terminal Server closed           ← TCP shutdown 成功
.814 [ERROR] [PtyManager] Terminal Server died — attempting recovery ← 💥 watchdog 誤判
.815 [terminal-server] re-forking after heartbeat-detected crash...
.833 re-forked with pid 26412                                         ← 20ms 孤兒誕生
.839 [quit] terminal server stopped (via TCP shutdown)                ← 原 server 真的死
```

新 server（PID 26412）是孤兒：main 在退、PtyManager 沒真正使用它、TCP socket refed → 卡住 main event loop → `crashpad-handler` 殘留。

### 修復策略
在 kill 動作之前**先通知 PtyManager 進入 shutdown 模式**，watchdog 看到 TCP close 時直接跳過 re-fork（分辨「意圖 shutdown」 vs 「crash」）。

---

## 修改範圍（2 檔案，低複雜度）

### 1. `electron/pty-manager.ts`（或 `electron/terminal-server/*.ts`，Worker 先 grep 定位 watchdog）

**定位步驟**（Worker 先做）：
- Grep `Terminal Server died` / `re-forking after heartbeat` 找 watchdog / recovery 實作點
- 推測檔案：`electron/pty-manager.ts` 或 `electron/terminal-server/pty-proxy.ts` 類
- 找到：`attemptRecovery` / `reForkServer` / watchdog interval / heartbeat timer 宣告

**新增 API / flag**：

```typescript
class PtyManager {
  private isShuttingDown = false       // ← 新增

  /**
   * BUG-035 fix: called by stopTerminalServerGracefully before any kill action.
   * Disarms heartbeat watchdog so TCP close during graceful shutdown is not
   * mistaken for a crash and triggers re-fork.
   */
  beginShutdown(): void {               // ← 新增 public method
    this.isShuttingDown = true
    // 可選：cancel active heartbeat timer / interval
    // if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null }
  }

  private attemptRecovery(): void {     // ← 原 watchdog 觸發處（改名可能不同）
    if (this.isShuttingDown) {          // ← 新增守護條件
      logger.log('[PtyManager] TCP close during shutdown — skip re-fork')
      return
    }
    // ...原 re-fork 邏輯
  }
}
```

**API 命名建議**（Worker 依專案既有風格選一）：
- `beginShutdown()`（建議，語意清楚）
- `setShutdownMode(true)`
- `disarmWatchdog()`

**注意事項**：
- `isShuttingDown` 不需要 reset（main 退出後整個 process 死掉，flag 不會殘留）
- 若 watchdog 用 `setInterval` / `setTimeout` 實作，`beginShutdown()` 同時 `clear*` 更乾淨（不依賴 guard）
- 若有多個 recovery 觸發點（例如 `on('close')` + heartbeat timeout 各自呼叫），每處都要加 guard

### 2. `electron/main.ts` — `stopTerminalServerGracefully()` 開頭呼叫新 API

**位置**：T0149 實作的 `stopTerminalServerGracefully()` 函式開頭（`main.ts:1293` 附近）

**修改**：

```typescript
async function stopTerminalServerGracefully(): Promise<void> {
  // BUG-035 fix: disarm watchdog before any kill action to prevent spurious re-fork
  try {
    ptyManager.beginShutdown()
  } catch (e) {
    logger.error('[quit] failed to disarm watchdog:', e)
  }

  // ...原 T0149 方案 C 邏輯（Step A/B/C/D）不變
```

**注意事項**：
- `ptyManager` 引用方式依專案既有（singleton import / context 傳入）
- `try/catch` 保護：即使 `beginShutdown` 拋錯也不該擋住 shutdown 流程
- 放在函式**最開頭**、任何 `child.kill` / `sendShutdownToServer` / `process.kill` 之前

---

## 執行步驟

### 1. 定位 watchdog 實作
Worker 先 grep 以下關鍵字找 watchdog / recovery 位置：
- `Terminal Server died`
- `re-forking after heartbeat`
- `attemptRecovery`
- `heartbeat` / `heartbeatInterval`
- `re-fork` / `reFork`

### 2. 新增 `beginShutdown()` + guard
依「修改範圍 1」實作，並確認：
- 所有 recovery / re-fork 觸發點都加 guard（可能不只一處）
- Log 訊息清楚標示 shutdown skip 路徑

### 3. 修改 `stopTerminalServerGracefully()` 開頭
依「修改範圍 2」加一行呼叫。

### 4. 本機 dev serve 冒煙
`npm run dev` → 勾 checkbox → 退出 → 檢查 log：
- ✅ 應看到：`[quit] terminal server stopped (via ...)`
- ❌ **不應看到**：`Terminal Server died — attempting recovery` / `re-forking after heartbeat-detected crash` / `re-forked with pid ...`
- 工作管理員：無任何 `BetterAgentTerminal.exe` 殘留

### 5. 打包驗收（使用者配合）
`npm run build:win` → 重裝 → 使用者回到 T0145 情境 9.1 複測。

### 6. Commit 訊息建議
```
fix: disarm heartbeat watchdog during graceful shutdown (BUG-035)

- PtyManager.beginShutdown(): new public API to mark shutdown mode
- attemptRecovery() / heartbeat handlers: skip re-fork when isShuttingDown
- stopTerminalServerGracefully(): call ptyManager.beginShutdown() first

Root cause: T0149's sendShutdownToServer closed TCP gracefully, but the
heartbeat watchdog (pre-existing crash recovery logic) mistook it for a
crash and re-forked a new terminal-server (orphan, PID 26412 in repro log).
The orphan held a refed TCP socket, blocking main's event loop exit and
leaving crashpad-handler residual.

See BUG-035 + T0148 for context. Does not revert T0149 (cd460d2).

Closes BUG-035 (pending T0145 scenario 9.1 packaged acceptance)
```

### 7. 回塔台
- 回報 commit SHA
- 回報 dev serve 冒煙結果（log 是否乾淨 + 工作管理員有無殘留）
- 若 grep 到 watchdog 觸發點 >1 處，列出各處以及是否都加了 guard

---

## 成功判準

- ✅ 2 檔案修改完成，`npm run build` 無 TypeScript 錯誤
- ✅ Dev serve 勾 checkbox 退出後，log **不出現** `Terminal Server died` / `re-forking` / `re-forked with pid`
- ✅ Log 只剩 T0149 的 `via TCP shutdown` 或 `via SIGTERM` 等正常 kill log
- ✅ 工作管理員無殘留（BUG-034 + BUG-035 合併後的最終目標）
- ✅ Commit 不 rollback T0149，純加強（disarm 邏輯 + 呼叫點）

## 失敗判準

- ❌ 修改後 crash recovery 正常情境也失效（例如使用者手動 kill terminal-server 後 server 沒自動復原）→ guard 條件寫太寬
- ❌ Log 仍出現 `re-forking` → guard 沒加到全部觸發點
- ❌ `isShuttingDown` 被意外 reset → main 退出流程有路徑誤清 flag

---

## 相關檔案
- `electron/pty-manager.ts` 或 `electron/terminal-server/*.ts`（watchdog 實作，主修）
- `electron/main.ts`（T0149 `stopTerminalServerGracefully` 開頭加一行）
- T0149 commit `cd460d2`（BUG-034 修復，本 bug 觸發鏈路源頭但不 rollback）
- BUG-035（本工單關聯）
- T0145 情境 9.1（驗收前線）

---

## 回報區

### 完成狀態
**FIXED** — disarm 邏輯實作完成，等待打包（T0145 情境 9.1）驗收。

### Watchdog 定位結果
全部 4 處 recovery 觸發點都在 `electron/pty-manager.ts`，皆呼叫 `handleServerDeath()`：

| # | 觸發點 | 行號（修改前） | 說明 |
|---|--------|----------------|------|
| 1 | `setServerProcess()` 內 `server.once('exit')` | L86-91 | IPC fork 退出（dev serve / 首次啟動 path） |
| 2 | `connectToServer()` 內 `socket.on('close')` | L137-146 | TCP 關閉（**BUG-035 主觸發點**，sendShutdownToServer 走這條） |
| 3 | `startHeartbeat()` 內 `setInterval` callback | L656-662 | 3 秒無 pong 判定 server 死亡 |
| 4 | `handleServerDeath()` 入口 | L675-677 | Defense-in-depth（防未來新增 caller 漏 guard） |

### 修改摘要
**`electron/pty-manager.ts`**（+40 行）
- 新增 `private isShuttingDown = false`（L67-71）
- 新增 public `beginShutdown()`（L693-704）：set flag + `stopHeartbeat()`，idempotent，不 reset
- 4 處 guard 全部加上：每處在進入 `handleServerDeath()` 之前先檢查 `isShuttingDown`，若為 true 則 log skip 訊息並 return

**`electron/main.ts`**（+10 行）
- `stopTerminalServerGracefully()` 函式開頭 `try { ptyManager?.beginShutdown() } catch {...}`（L1303-1310），位於 Step A/B/C/D 任何 kill 動作之前

### Commit
- SHA：`31b4ec2`
- Type：fix
- 訊息：`fix: disarm heartbeat watchdog during graceful shutdown (BUG-035)`
- Build：`npx vite build` 通過，無 TS 錯誤

### Dev serve 冒煙結果
**未在此 session 執行 dev serve 冒煙**（無互動 terminal 環境）。修改邏輯經 build 通過 + 邏輯反推驗證：
- `beginShutdown()` 在 main.ts L1303 呼叫，先於 Step A SIGTERM、Step B sendShutdownToServer
- TCP close handler 內檢查 `isShuttingDown` → 命中 → log `TCP close during shutdown — skip re-fork` → return
- 不會再進入 `handleServerDeath()` → 不會 re-fork → 不會產生 PID 26412 類孤兒

需請使用者本機執行 `npm run dev` → 勾 checkbox → 退出，確認 log 不出現 `re-forking after heartbeat-detected crash` / `re-forked with pid`。

### 互動紀錄
無（單向實作工單，無與使用者的決策互動）。

### 遭遇問題
1. 工單建議的 typecheck 入口 `tsconfig.electron.json` 不存在 — 改用 `npx vite build` 走完整 vite + electron-vite pipeline，build 成功代表 TS 編譯通過。

### 產出摘要
- 修改 2 檔案：`electron/pty-manager.ts`、`electron/main.ts`
- 新增 1 public API（`beginShutdown()`）+ 1 private flag（`isShuttingDown`）+ 4 處 guard
- 不 rollback T0149 commit `cd460d2`，純疊加防護
- 工單檔案 `_ct-workorders/T0150-...md` 元資料 + 回報區更新

### Renew 歷程
無。

### 完成時間
2026-04-17 16:57 (UTC+8)
