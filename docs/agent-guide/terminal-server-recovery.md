# Terminal Server 存活判定與 recovery（T0704 / BUG-171）

> CLAUDE.md「Terminal Server 存活判定與 recovery（T0704 / BUG-171）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結；改功能時兩邊一起更新。

## 用途

Electron 主行程以 fork IPC（或 BAT 重開後以 TCP，T0108）連到 Terminal Server。主行程判定 server 死亡時走 recovery（T0112）：re-fork 一個新 server，以同 id 重建每個分頁的 shell（只重建 shell，不重跑 agent，那是 PLAN-055 的範圍）。

T0704 修正兩件事：
- **A**：heartbeat 不再因系統時鐘跳變或一次 pong 遲到，把活著的 server 判成死亡。
- **B**：recovery 時先切斷並結束舊 server，避免舊 server 把舊 PTY 的 exit 套到同 id 的新 shell。

## 必守規則

- 🔴 heartbeat 的經過時間一律用單調時鐘（`ServerWatchdogDeps.now`，預設 `performance.now()`），不得改回 `Date.now()`。NTP 校時、睡眠喚醒、手動改時間、VM 時間同步都會移動牆鐘。
- 🔴 heartbeat 只有在連續 `HEARTBEAT_MAX_MISSES`（3）個 tick 遲到，而且 server 程序或 IPC 至少一個已經不在時，才走 recovery。程序與 IPC 都還在時只記 `[heartbeat] late pong:`，永遠不 recovery。IPC `exit` 與 TCP `close` 照舊立即 recovery。
- 🔴 recovery 必須依下列順序執行，不可對調：
  1. 先把舊 server 切斷：拆掉監聽、`disconnect()`、generation +1。
  2. 結束舊 server（含程序樹）。
  3. 結束 registry 列出的 PTY 樹。
  4. 清除 registry。
  5. re-fork。
  - 舊 server 只要還活著，就會在 PTY 被殺時刪掉共用 registry 裡同 id 的項目，並送出 `pty:exit`。
- 🔴 結束舊 server 不得用 graceful stop（`server:shutdown`、Unix 的 SIGTERM）。那些路徑會刪掉 pid / port / registry 檔，而那時這些檔已經屬於新 server。
- 🔴 孤兒 PTY 清理一律先殺程序樹、再殺 shell（T0540 順序）。程序樹殺掉後不再送 SIGTERM：pid 可能已被重用。
- 新的監聽一律經 `setServerProcess` / `setupTcpListener` 掛上，並帶 generation；不要另外掛 `'message'` 監聽。

## 唯一實作位置

| 內容 | 位置 |
|---|---|
| heartbeat | `PtyManager.startHeartbeat` / `handlePong` / `serverLiveness`（`electron/pty-manager.ts`） |
| recovery | `PtyManager.handleServerDeath(reason)`、`detachServer`、`endReplacedServer` |
| 訊息分派與 generation | `handleServerMessage(msg, generation)` |
| 孤兒清理 | `killOrphanPtyProcesses`（`electron/pty-manager.ts`，export；Electron 啟動時的孤兒清理 `startTerminalServer` 也用它） |
| 程序操作（可注入） | `ServerWatchdogDeps` / `defaultServerWatchdogDeps`，經 `PtyManagerDeps.serverWatchdog` 替換（只有測試會替換） |
| re-fork | `reforkTerminalServer`（`electron/main.ts`），經 `ptyManager.onRequestNewServer` 呼叫 |
| 樹狀結束 | T0540 的 `killProcessTree`（`electron/terminal-server/process-tree.ts`）；本單不另寫一份 |

## 判死條件（A）

| 路徑 | 條件 | 結果 |
|---|---|---|
| IPC `exit`（`setServerProcess` 的 `once('exit')`） | server 程序結束 | 立即 recovery（`reason=ipc-exit`） |
| TCP `close`（`connectToServer`） | 重連通道關閉 | 立即 recovery（`reason=tcp-close`） |
| heartbeat tick（每 `HEARTBEAT_INTERVAL_MS` = 10 s） | `now() - lastPongAt > INTERVAL + HEARTBEAT_TIMEOUT_MS`（13 s）→ 這個 tick 算遲到；收到 pong 就歸零 | 未滿 3 個：只計數 |
| 同上，連續第 3 個遲到 tick 起 | 檢查 `serverLiveness()`：程序活著要同時滿足 `exitCode` / `signalCode` 未設，且 `process.kill(pid, 0)` 成功（EPERM 也算活著）；IPC 看 `connected` | 任一不在 → recovery（`reason=heartbeat`）；兩者都在 → `[heartbeat] late pong:`（第 3、6、9… 個遲到 tick 各記一次），不 recovery |

- 從最後一次 pong 算起，最快約 40 s 判死（例：t=0 收到 pong，t=20、30、40 為遲到 tick）。
- heartbeat 只在 fork IPC 模式啟動。TCP 重連模式沒有 heartbeat，只靠 TCP `close`（行為與 T0704 前相同）。

## recovery 步驟（B）

1. `isRecovering = true`，停 heartbeat，`serverGeneration++`，廣播 `terminal-server:status` `recovering`。
2. `detachServer()`：從舊 ChildProcess 移除 PtyManager 自己的 `'message'` / `'exit'` 監聽（main.ts 掛的其他監聽保留），IPC 還連著就 `disconnect()`。TCP socket `destroy()`。
3. 清除狀態（T0576 `onSurvivingPtys([])`、blocked / codex 狀態、T0607 `onServerRecovery`）。
4. 讀 registry，`endReplacedServer(oldServer, registry.serverPid)`：
   - fork IPC：ChildProcess 自己表示還在執行（Node 握著 handle，pid 不會被重用），而且 `process.kill(pid, 0)` 成功 → 結束它。
   - TCP（BAT 重開後沒有 ChildProcess）：registry 的 `serverPid`，只要該程序存在就結束它。
   - 結束方式：Windows 先 `killTree`（`taskkill /F /T`，舊 server 的 conhost 與 shell 一起結束），失敗才 `SIGKILL`（= TerminateProcess）。其他平台直接 `SIGKILL`（shell 在 master 關閉時收到 SIGHUP）。
5. `killOrphanPtyProcesses(registry.ptys 的 pid)`：每個 pid 平行處理，先 `killTree`，結果不是 `killed` 時才 `SIGTERM`。
6. `clearRegistry`，`onRequestNewServer()`（re-fork），`setServerProcess(new)`（新 generation 的監聽與新 heartbeat）。
7. 以同 id 重建 shell（120x30，env 經 `buildPtyEnv`，T0525）。recovery 期間直接 spawn 的分頁（`inst.process` 有值）保留原程序，不重建。
8. 廣播 `recovered`。

### 為什麼用 generation，不用 `awaitingCreated`

工單允許兩種做法：server generation，或讓重建的 instance 帶 `awaitingCreated`、沿用 BUG-101 的防護。選 generation，理由：
- `awaitingCreated` 只擋 `pty:exit`，而且新 server 回 `pty:created` 之後就失效。舊 server 的 exit 晚到時（BUG-171 實例：忙碌的 Worker 分頁晚了 4.5 分鐘）一樣會刪掉新 instance。
- `awaitingCreated` 擋不到舊 server 的 `pty:data`、`pty:created`、`pty:list`、`pty:buffer`、`server:pong`。舊的 pong 會讓新 heartbeat 誤以為新 server 有回應。
- generation 綁的是「哪個 server」而不是「哪個 PTY」，一個比較就涵蓋所有訊息類型與任意晚到時間。

拆監聽加 `disconnect()` 後，正常情況下舊 server 的訊息根本到不了。generation 是第二道防線（例如有人另外掛了監聽、Node 已經排進佇列的事件）；被丟棄的訊息記 `dropped message from a replaced Terminal Server`。

### recovery 期間的分頁操作

舊 server 結束要等 `taskkill` 跑完（通常不到 1 秒，上限 `TASKKILL_TIMEOUT_MS` = 3 s，舊 server 一次、孤兒一輪平行），所以「沒有任何 server 連著」的時間比 T0704 前（約 40 ms）長。這段時間內：
- `write` / `resize` 對沒有程序的 instance 不動作（T0704 前會 TypeError）。
- `kill`（關分頁）直接移除 entry，重建時不會再出現（T0704 前 TypeError，entry 留著，被重建成沒有分頁的 shell）。
- 新 id 的 `pty:create` 照舊 direct spawn，重建時保留它，不重建到新 server 上。
- 不使用 T0578 的 create hold：hold 會讓 helper 派工在 2 s 後回 `RECOVERY_PENDING`，等於改變 helper 行為。

## 日誌

| 日誌 | 意義 |
|---|---|
| `[heartbeat] late pong: none for <ms>ms (<n> late ticks), server process and IPC alive — no recovery`（warn） | server 不回 pong，但程序與 IPC 都在 |
| `[heartbeat] late pong arrived after <n> late tick(s)` | 遲到後 pong 恢復 |
| `[heartbeat] no pong for <ms>ms (<n> late ticks), server process=alive\|gone ipc=connected\|closed — server dead`（error） | heartbeat 判死 |
| `[PtyManager] Terminal Server died — attempting recovery... (reason=heartbeat\|ipc-exit\|tcp-close\|unspecified)`（error） | recovery 開始（`unspecified` 只出現在直接呼叫的測試） |
| `[PtyManager] recovery: ended the old Terminal Server pid=<pid> (tree=killed\|failed\|not-windows, signal=none\|SIGKILL\|failed (already gone?))` / `recovery: old Terminal Server process already gone` | 舊 server 的處理 |
| `[PtyManager] Killed <n> orphan PTY(s) from registry` | 孤兒清理（T0113） |
| `[PtyManager] dropped message from a replaced Terminal Server: type=<type> id=<id> generation=<g> current=<c> (dropped so far: <n>)`（warn） | 前 10 筆每筆都記，之後每 100 筆記一次 |
| `[PtyManager] recovery: PTY <id> runs directly (created during the recovery) — not rebuilt` / `kill id=<id> while no Terminal Server is connected — removed, not rebuilt` | recovery 期間的分頁操作 |
| `[terminal-server] re-forking after the Terminal Server was found dead...` / `re-forked with pid <pid>` | main.ts re-fork |

日誌不記輸出內容與權杖。

## headless 不受影響

`electron/remote/headless-entry.ts` 以 `new PtyManager({...})` 建立 direct 模式的 manager，從不呼叫 `setServerProcess` / `connectToServer`，`onRequestNewServer` 也沒有設定。所以 heartbeat 不會啟動，`handleServerDeath` 不會被呼叫，`useServer` 永遠為否，T0704 新增的 `kill` / `write` / `resize` 防護也走不到。`killAll` 走 direct 分支，行為不變。

## 已知限制 / 殘留風險

- **TCP 模式的 `serverPid`**：BAT 重開後以 TCP 連線，沒有 ChildProcess，舊 server 的 pid 取自 registry。TCP `close` 到 recovery 只有幾毫秒，但理論上這段時間 pid 可能被別的程序重用，那個程序樹會被結束。為了避免 graceful shutdown 中的舊 server 事後刪掉新 server 的檔案，接受這個風險。
- **舊 server 結束失敗**：`killTree` 與 `SIGKILL` 都失敗時（記 `signal=failed`），舊 server 仍活著但已切斷。它在 IPC 斷線 `BAT_IDLE_TIMEOUT_MS`（預設 30 分鐘）後自行 shutdown，屆時會刪掉 pid / port / registry 檔（當時屬於新 server）。目前只記日誌，沒有補救。
- **server 卡住但程序與 IPC 都在**：依規格永遠不 recovery，只記 `late pong`，分頁看起來沒有回應，直到 server 恢復。
- recovery 仍只重建 shell，agent 分頁變成空 shell（PLAN-055）。重建尺寸仍是 120x30（CLAUDE.md「新 PTY 的初始尺寸」已知限制）。

## T0703 時間線摘要（BUG-171）

- 2026-10-25 20:59:04（UTC+8）：Windows 時間服務做 NTP 校正，系統時鐘往前跳 +3.03 s。
- 20:59:50：heartbeat 記 `heartbeat timeout (13032ms since last pong)`（= 10001 ms + 3031 ms），判死，recovery：
  - 依 registry 先對 6 個 shell 送 SIGTERM，再 `taskkill /T`。外層 shell 已死，找不到樹，留下 12 個孤兒 bash。
  - re-fork 第二個 server，重建 6 個 shell。
- 舊 server 沒關、監聽沒拆。它把被殺 PTY 的 `pty:exit(id, 1)` 送回主行程；重建的 instance 沒有 `awaitingCreated`，擋不到。結果是 6 個分頁顯示新的 `$` + `[Process exited with code 1]`。
- 舊 server 也以同 id 刪掉 registry 裡新 shell 的項目。新 server 底下的 6 個 shell 已沒有分頁。
- 自 T0112（2026-04）起就有，不是新回歸。

## 驗證清單

- 單元測試 `electron/__tests__/pty-manager-heartbeat-recovery.test.ts`：
  - 牆鐘前跳 5 / 15 / 25 s 不 recovery；預設時鐘不受 `Date` 影響。
  - 遲到 2 次後 pong 恢復會歸零；連續 3 次且程序不在 → recovery（第 2 次不會）。
  - IPC 關閉（程序還在）→ recovery，並結束該程序。
  - 程序與 IPC 都在時兩分鐘也不 recovery、只記 `late pong`。
  - IPC `exit` 同步進入 `recovering`。
  - recovery 後舊 server 的 `pty:exit` / `pty:data` / `exit` 不影響同 id 的新 instance、不觸發第二次 recovery。
  - 監聽拆不掉時由 generation 擋下並記日誌。
  - Windows 呼叫順序：舊 server 樹 → 各 PTY 樹 → 失敗者才 SIGTERM → registry 已清 → re-fork。
  - 樹狀結束失敗時改用 SIGKILL；非 Windows 用 SIGKILL、不用 SIGTERM。
  - 已結束的舊 server 不送訊號；TCP 模式改用 registry 的 `serverPid`。
  - recovery 期間關分頁不重建、`write` / `resize` 不丟例外。
  - `killOrphanPtyProcesses` 的順序。
  - source guard：main.ts 啟動清理改用它；recovery 的呼叫順序。
- 既有：
  - `pty-manager-server-exit.test.ts`（BUG-101）。
  - `pty-manager-helper-env.test.ts`（T0525 重建 env）。
  - `tower-questions.test.ts` / `close-worker.test.ts` / `terminal-role-mode.test.ts` / `helper-capability-persist.test.ts` / `local-helper-capability.test.ts`（recovery 後的狀態）。
  - `codex-osc-state.test.ts` / `terminal-blocked-state.test.ts`（以 `Terminal Server died — attempting recovery` 定位的 source guard，這段日誌字串不要改）。
- e2e `e2e/t0704-heartbeat-recovery.spec.ts`（隔離實例，Windows，需先 `npx vite build`，不用任何產品測試掛勾）：
  - 主行程 `Date.now` 前跳 5 s，再跳 20 s → 不 recovery。
  - 以 `NtSuspendProcess` 暫停 server 約 50 s → 記 `late pong`、不 recovery；恢復後記 `late pong arrived after`。
  - 分頁內跑 `ping -t`，只 `taskkill /F` server → `reason=ipc-exit` recovery。檢查以下各點：
    - 舊 shell 與它的 ping 都結束。
    - 沒有以舊 server / 舊 shell 為父程序的殘留程序。
    - 分頁收不到 `pty:exit`。
    - 分頁內指令回報的 PPID 是新 shell。
