# BUG-035 — PtyManager heartbeat watchdog 在 shutdown 期間誤觸發 re-fork，產生孤兒 terminal-server

## 元資料
- **BUG 編號**：BUG-035
- **標題**：T0149 的 `sendShutdownToServer()` 關閉 TCP 後，PtyManager heartbeat watchdog 把 graceful shutdown 誤判為 crash，自動 re-fork 新 terminal-server；新 server 成孤兒，持著 refed TCP socket 卡住 main event loop → `crashpad-handler` 殘留
- **狀態**：🔴 OPEN
- **嚴重度**：🟡 Medium（PLAN-012 第二目標仍無法真正達成，但 BUG-034 原始 early-return 根因已修好；workaround：工作管理員手動結束新孤兒 server）
- **建立時間**：2026-04-17 16:49 (UTC+8)
- **發現於**：T0149 commit `cd460d2` 打包驗收中，使用者實測勾選 checkbox 退出後 `terminal-server.js` (Q1.A) + `crashpad-handler` (Q1.C) 仍殘留
- **關聯 PLAN**：PLAN-012（Quit Dialog + Terminal Server CheckBox 第二目標 — 新問題層擋路）
- **關聯 BUG**：
  - BUG-034（✅ FIXED，T0149 確實修好 `stopTerminalServerGracefully` early-return）— **不退回 FIXING**
  - BUG-033（🔍 VERIFY，與本 BUG 無關）
- **性質**：**Pre-existing race**（heartbeat watchdog 來自 T0108 時期的自動 crash recovery），T0149 修了 early-return 讓 TCP shutdown 真的送出 → 才觸發 watchdog 誤判
- **可重現**：100%（reconnect 路徑 + 勾 checkbox → 必觸發）

---

## 現象描述

### Log 證據鏈（使用者 2026-04-17 08:42:48 實測）

```
08:42:48.714 [LOG] [quit] user confirmed quit (stopTerminalServer=true)
08:42:48.717 [LOG] [quit] flushed 1 renderer(s)
08:42:48.733 [LOG] [quit] saved 1 profile snapshot(s)
08:42:48.814 [LOG] [PtyManager] TCP connection to Terminal Server closed           ← T0149 Step B sendShutdownToServer 成功
08:42:48.814 [ERROR] [PtyManager] Terminal Server died — attempting recovery...    ← 💥 watchdog 誤判 crash
08:42:48.815 [LOG] [terminal-server] re-forking after heartbeat-detected crash...  ← 💥💥 自動 re-fork 觸發
08:42:48.833 [LOG] [terminal-server] re-forked with pid 26412                      ← 20ms 內新 server 誕生（孤兒）
08:42:48.833 [LOG] [PtyManager] Terminal Server connected via IPC — proxy mode active
08:42:48.835 [LOG] [PtyManager] Terminal Server recovery complete                  ← "復原完成"（實際上是孤兒）
08:42:48.836 [LOG] [RENDERER] [render] Thumbnail render ...
08:42:48.839 [LOG] [quit] terminal server stopped (via TCP shutdown)              ← T0149 方案 C log（原 server 真的死）
08:42:48.840 [LOG] [RemoteServer] Stopped
```

### 預期行為（PLAN-012 設計）
1. 使用者勾選 checkbox + 確認 Quit
2. `stopTerminalServerGracefully()` → TCP shutdown 送出 → terminal-server graceful 關閉
3. `pty-manager.dispose()` 被呼叫 → watchdog 停止 + tcpSocket destroy
4. Main event loop 無 refed handle → main 正常退出
5. 工作管理員**無任何 BetterAgentTerminal.exe 殘留**

### 實際行為
1. ✅ Dialog 正常跳出
2. ✅ 勾 checkbox + 確認 Quit
3. ✅ TCP shutdown 成功（原 server 死）
4. ❌ `PtyManager.attemptRecovery` 把 TCP close 誤判為 crash（因為還沒收到「故意 shutdown」訊號）
5. ❌ 20ms 內 re-fork 出 PID 26412 新 server（孤兒：main 正在退、PtyManager 沒人用它、但 TCP socket refed）
6. ❌ 新 server 阻止 main event loop 結束 → `crashpad-handler` 殘留 → 工作管理員仍看到 2 個 BetterAgentTerminal.exe

### 影響範圍
- **使用者體驗**：PLAN-012 第二目標實質失效（使用者看到的仍是「勾了還是沒關掉」）
- **資源**：孤兒 server + crashpad handler 永久殘留，直到手動殺
- **不阻擋 release**：BUG-034 FIXED 已是 release 條件，但建議同 release 一併修好
- **追蹤清晰**：pre-existing watchdog 邏輯 + T0149 互動新發的 race，追蹤為獨立 BUG 避免 BUG-034 scope 爆炸

### 根因
PtyManager（`electron/pty-manager.ts` 或 `electron/terminal-server/` 下）有 **heartbeat watchdog** 邏輯，偵測到 TCP 斷線 / heartbeat timeout → 自動 `re-fork` terminal-server。
- 這在 server 意外崩潰時是正確行為（crash recovery）
- 但 T0149 新增的 `sendShutdownToServer()` graceful shutdown 路徑也會觸發 TCP close → watchdog 無法分辨「意圖 shutdown」 vs 「意外 crash」 → 誤觸發 re-fork

---

## 修復方向

### 建議方案（需 T0150 Worker 驗證 code 結構）

在 `stopTerminalServerGracefully()` 開頭、任何 kill 動作之前，**通知 PtyManager 進入「意圖 shutdown 模式」**，讓 watchdog 知道 TCP 斷線是預期的，跳過 re-fork。

**偽碼（Worker 依實際 API 實作）**：
```
async function stopTerminalServerGracefully():
  // BUG-035 fix: disarm heartbeat watchdog before kill
  ptyManager.beginShutdown()           // 或 setShutdownMode(true) / disarmWatchdog()

  // ...Step A/B/C/D 原邏輯
```

PtyManager 端：
```
class PtyManager:
  private isShuttingDown = false

  beginShutdown():
    this.isShuttingDown = true
    // 可選：cancel active heartbeat timer / interval

  private attemptRecovery():    // 原 watchdog 觸發處
    if this.isShuttingDown: return   // ← 新增守護條件
    // ...原 re-fork 邏輯
```

### 驗收指標
- Log 不再出現 `Terminal Server died — attempting recovery` 與 `re-forking`
- 只剩 `[quit] terminal server stopped (via TCP shutdown)` + `[RemoteServer] Stopped`
- 工作管理員**無任何 BetterAgentTerminal.exe 殘留**

---

## 使用者測試資訊
- **BAT 版本**：打包版（`npm run build:win` 含 T0149 commit `cd460d2`）
- **Quit 路徑**：勾 checkbox + Quit
- **Log 時間**：2026-04-17 08:42:48（UTC，= 台北 16:42:48 UTC+8）
- **殘留進程**：Q1.A (`terminal-server.js`) + Q1.C (`crashpad-handler`) — 注意 terminal-server 是**新 PID 26412**，原 server 已死
- **觀察**：Q2.A 幾秒內即時看到消失 → 立刻又冒出來（即 re-fork 行為）
- **Log 目錄**：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`

---

## 塔台行動
1. ✅ 建立 BUG-035（本檔）
2. ⏸ 派 T0150 修復工單（無需研究，根因明確）
3. ⏸ T0150 commit → 再 rebuild + 重新進入 T0145 情境 9 驗收
4. ⏸ 通過後 BUG-035 CLOSED + PLAN-012 DONE

---

## 相關單據
- BUG-034（✅ FIXED）：T0149 修的 early-return — **保持 FIXED 不退回**（log `via TCP shutdown` 為證）
- BUG-033（🔍 VERIFY）：T0147 修的 Tray handler bypass — 與本 BUG 無關
- PLAN-012（🔄 IN_PROGRESS）：第二目標完成度受阻
- T0148（✅ DONE）：BUG-034 研究 commit `98be02d`
- T0149（✅ FIXED）：BUG-034 修復 commit `cd460d2`
- T0150（📋 READY）：BUG-035 修復工單（本 BUG 建立同時派發）
