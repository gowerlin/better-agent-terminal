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
3. 清除狀態（T0576 `onSurvivingPtys([])`、blocked / codex 狀態、T0607 `onServerRecovery`）。T0766：`onSurvivingPtys([])` 之後、`blockedTracker.clearAll` **之前**呼叫 `onAgentsInterrupted(collectInterruptedAgentSources())`（見下節「被中斷的 agent 分頁」）。
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

## 被中斷的 agent 分頁（PLAN-055 B1 / T0766，D211）

recovery 以同 id 重建的是 shell，分頁裡原本的 claude / codex 已經不在。T0766 起 BAT 列出這些分頁，claude 分頁可一鍵以 `--resume=<id>` 接續原本的對話；T0767（B2）起 codex 分頁可一鍵開啟 codex 自己的 `resume` 選單（BAT 沒有 codex session id，選單預設只列這個資料夾的 session，由使用者選）。

**必守規則**

- 🔴 快照在 `blockedTracker.clearAll` 之前取（之後 `agentStarted` / claude session id 已被清掉）。`Terminal Server died — attempting recovery` 日誌字串不改；recovery 五步順序（T0704）不改。
- 🔴 不自動 resume（D211 P-1，不加 Settings 開關）；Worker resume 不附 prompt（P-2）；不通知塔台、不改 CT 契約、不加 state 欄位（P-3）；清單只存到 BAT 關閉（P-5）；BAT 重開時 Recovery 提示選「重新開始」的路徑不做（P-6）；不加 `SessionEnd` hook（P-7）。
- 🔴 resume 指令一律經既有組裝點：使用者開的 claude-cli 分頁走 renderer `startClaudeCliPty`（先 `pty.kill` 再啟動，同 ⏻；worktree 分頁不再 `worktree.create`，用快照的 cwd），其他 claude 分頁（helper 派工的 Worker、在 shell 手打的 claude）走 main `terminal:resume-interrupted-agent` → `createAgentPromptCommandBuilder` 的 `resume` 選項 → `writeDispatchCommand` 寫入重建的 shell。`--resume=<id>` 用 `=` 形式，放在 BAT 參數（`--mcp-config=` / `--settings=` / `--name=`）之後、自訂參數之前；不加 `--fork-session`。`buildBatMcpLaunchArgs` 語意不變。
- 🔴 codex（T0767，D211 P-4 a）：在 BAT 參數（BAT MCP `-c mcp_servers.bat.*`，或沒有 MCP 參數時依版本探測的 `--no-daemon`；派工另有 `-c check_for_update_on_startup=false`）之後、自訂參數之前加 `resume` 子命令，不帶 session id、不帶 prompt。🔴 **不用 `--last`**（同一個 cwd 有多個 codex 分頁會接錯）；不讀 `~/.codex/sessions` 猜 session id（P-4 c 不做）；自訂參數已含 `resume` / `fork` 子命令 → 不加（`user-args`）。使用者開的 codex-cli 分頁走 renderer `resumeCodexCliTab`（`WorkspaceView.tsx`：⏻ 的 `restartOrCreatePty`，cwd 用快照的，再照 ⏻ 的組法 `buildLaunchCommand` + `withBatMcpLaunchArgs`，然後 `codexResumeCommand`）；其他 codex 分頁（helper 派工的 Worker、在 shell 手打的 codex）走 main `terminal:resume-interrupted-agent` → builder `resume`。不另寫組裝。
- 🔴 `terminal:resume-interrupted-agent` / `terminal:dismiss-interrupted-agent` / `terminal-server:query-interrupted-agents` 只用 `ipcMain.handle`（renderer），不進 `PROXIED_CHANNELS`、不經 `registerHandler`、不是 helper channel。
- 🔴 session id 只存 main 記憶體與 `claude-sessions.json`（`interrupted` 陣列，見 claude-session-name.md），日誌只記前 8 碼。

**唯一實作**

- 快照來源：`PtyManager.collectInterruptedAgentSources`、dep `PtyManagerDeps.onAgentsInterrupted`（`electron/pty-manager.ts`）。
- 判定 / 快照 / 清單 / Worker resume：`electron/interrupted-agents.ts`（`buildInterruptedAgentSnapshot`、`InterruptedAgentsStore`、`resumeInterruptedDispatchAgent`；不 import electron）。main 單例 `interruptedAgents`（`electron/main.ts`）。
- `--resume` 參數：`claudeResumeArgs` / `userArgsSetClaudeResume`（`src/lib/claude-resume-args.ts`，main 與 renderer 共用）。
- codex `resume`（T0767）：`codexResumeArgs` / `userArgsSetCodexResume` / `codexResumeCommand`（`src/lib/codex-resume-args.ts`，main 與 renderer 共用）；可恢復的 agent 判斷 `isResumableInterruptedAgent`（main）/ `isResumableAgent`（renderer store）。
- renderer：`src/stores/interrupted-agents-store.ts`（只留本視窗的分頁、兩條 resume 路徑）、`src/components/InterruptedAgentsDialog.tsx`（`InterruptedAgentsDialog` + `InterruptedAgentsController`）、縮圖 ⏸（`TerminalThumbnail.tsx`）、recovery toast 補數量（`ServerStatusToast.tsx`）、`WorkspaceView.tsx` 的 `startClaudeCliPty(…, resume)`、`resumeCodexCliTab`（T0767）與 `registerTabResumeHandler`。

**哪些分頁會列出**（近似）：`agentPreset` 不是 `none`，或有過 `session-start` / OSC 7501（`startedAt`），或有 claude session id。純 shell 不列。使用者已自己離開 claude 的分頁也會列出（沒有 `SessionEnd`，P-7）。`launchedBy`：有工單或 `BAT_TOWER_TERMINAL_ID` → `dispatch`，否則 `tab`。agent：`agentPreset`；沒有時有 session id → `claude-cli`、detection `osc` → `codex-cli`、其他 `unknown`。

**流程**

1. recovery 時 main 建快照（`claudeSessionName` 取 `claudeSessionNameRecords`），沒有 agent 分頁只記一行；有則記進清單。同 id 第二次 recovery 若沒有 session id，沿用第一次的。
2. 每次清單變動 main 以 `terminal-server:agents-interrupted`（`{ reason: 'recovery' | 'update', agents }`）送給本 BAT 的視窗（不送 broadcastHub），並 `claudeSessionPersistence.persist()`。renderer 掛載時以 `terminal-server:query-interrupted-agents` 補拿（T0111 模式）。
3. renderer 只保留自己 store 裡有的分頁（主視窗排除已分離到 detached 視窗的工作區）。`reason: 'recovery'` 且本視窗有分頁 → 自動開對話框；縮圖顯示 ⏸（點擊開對話框）；`recovered` toast 補一行「N 個 agent 分頁已中斷」，點擊開對話框（N = 0 時 toast 與 T0766 前相同）。
4. 對話框（`ModalOverlay`、[X]、Esc = 關閉、不 resume）：依工作區分組，組內 塔台 → 一般分頁 → Worker，同時有塔台與 Worker 時提示先恢復塔台。claude 列：有 session id →「恢復」（`--resume=<id>`），沒有 →「開啟 resume 選單」（`--resume` 不帶值，claude 自己的 picker，依 cwd 篩選）；codex 列（T0767）→「開啟 resume 選單」（`codex resume`，codex 自己的選單，預設以 cwd 篩選）；unknown 列沒有恢復按鈕。每列「略過」；底部「全部恢復」（claude 與 codex，依序、塔台先；T0767 前只算 claude）與「關閉」。
5. 自訂參數已含 `--resume` / `-r` / `--continue` / `-c` / `--session-id` / `--from-pr` / `--teleport`（或短旗標群組含 `r` / `c`）→ 不加 `--resume`，照原指令啟動，對話框顯示原因。codex：自訂參數已含 `resume` / `fork` 子命令 → 不加 `resume`，同樣顯示原因。
6. 移除條件：resume（`resumed`）、略過（`dismissed`）、PTY 結束（關分頁、⏻ 重啟、resume 前的 kill；`onPtyExit` → `pty-ended`）、claude 回報新的 session id（`onClaudeSessionChange` → `session-start`）。resume 後 claude 的 `SessionStart`（source=resume）回報同一個 session id，`agentStarted` / `claudeSessionId` 自然恢復。
   codex 沒有 `session-start` hook：使用者開的 codex-cli 分頁在 ⏻ 的重建（PTY 結束 → `pty-ended`）時離開清單，Worker 在 `resumed` 時離開。codex 回到畫面後第一個 OSC 7501 讓 `agentStarted` 恢復。
7. 使用者開的分頁所在工作區在本視窗從未掛載（lazy mount）時，先切到該工作區，等它註冊 resume handler（上限 5 s，逾時回 `NO_WORKSPACE_VIEW`）。

**cwd 編碼查證（claude 2.1.316）**：session 檔在 `<設定目錄>/projects/<SN(cwd)>/<id>.jsonl`，`SN` = 非英數字元換成 `-`，超過 200 字元時截斷並接 `-<雜湊 base36>`；目錄名可被 `CLAUDE_CODE_PROJECT_DIR_NAME` 覆寫（有 `CLAUDE_CONFIG_DIR` 時），Windows 比對不分大小寫。規則不夠穩定，所以 BAT **不檢查 session 檔**、只檢查 id 格式（UUID），找不到時 claude 自己回 `No conversation found with session ID: <id>`（實測 `claude -p --resume=<不存在的 id> --name=x` → 這句、exit 1、不送 API）。`--resume=<id>` 與 `--name=` 可並用；`-n` 在 resume 時是否更新顯示名稱未實機驗證（help：「Set a display name for this session」），BAT 的 `claudeSessionName` 取自自己的紀錄，不受影響。

**codex `resume` 參數查證（內嵌 codex 0.166.0，T0767）**：`codex resume --help`：`Usage: codex resume [OPTIONS] [SESSION_ID] [PROMPT]`，不帶 SESSION_ID 時是選單（`--last` 才直接接最近一個），`--all` 才關掉 cwd 篩選；`resume` 的選項與 `codex` 本身相同（`-c`、`--no-daemon`、`-m`、`-s` …，逐項比對 `--help` 一致），另多 `--last` / `--all` / `--include-non-interactive`。放在子命令之前的選項會傳給 `resume`：`codex -c sandbox_mode=bogus resume` 與 `codex resume -c sandbox_mode=bogus` 都回 ``Error loading config.toml: unknown variant `bogus` ``；`codex --no-daemon resume --remote ws://…` 回 `--no-daemon cannot be used with --remote`（root 的 `--no-daemon` 有併入）。所以 BAT 參數照原位置（`codex` 之後）、`resume` 接在 BAT 參數之後、自訂參數之前（自訂參數在 `resume` 之後同樣有效）。

**日誌**：`[interrupted-agents] interrupted: terminal=<id> agent=<agent> launchedBy=tab|dispatch [workorder=<T####>] session=<前 8 碼>|unknown`、`recovery interrupted <n> agent tab(s); listed <m>`、`recovery interrupted no agent tab (<n> PTY(s) rebuilt as shells)`、`removed: terminal=<id> (resumed|dismissed|pty-ended|session-start)`、`resumed dispatch: … mode=session|picker|none [reason=user-args]`（codex：`session=unknown mode=picker|none`）；renderer `[interrupted-agents] resume terminal=<id> … → ok mode=… | failed <code>`；`[claude-session] <n> interrupted entr(y|ies) of the previous process not restored`。

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
- recovery 仍只重建 shell，不自動重啟 agent（D211 P-1）：T0766 起列出被中斷的 agent 分頁，claude 分頁可一鍵 `--resume`；T0767 起 codex 分頁可一鍵開 codex 的 `resume` 選單（要使用者自己選 session；同一資料夾有多個 codex session 時 BAT 無法替使用者分辨，P-4 a 的取捨）。helper 派工的 codex Worker 只有在 codex `>= 0.163.0`（有 OSC 7501）時才會被列出（沒有 `agentPreset`，靠 `startedAt` / detection `osc` 判斷）。清單是近似值：使用者已自己離開 claude 的分頁也會列出（沒有 `SessionEnd` hook，P-7）；清單與 session id 不跨 BAT 重開（P-5）；BAT 重開時 Recovery 提示選「重新開始」的分頁不列（P-6）；Worker resume 後停在中斷前的對話，不會自己繼續，也不通知塔台（P-2 / P-3，塔台可由 `bat_get_state` 的 `agentStarted` 判斷）。session 檔不預先檢查（見上節 cwd 編碼查證），id 不存在時 claude 自己報錯。重建尺寸仍是 120x30（CLAUDE.md「新 PTY 的初始尺寸」已知限制）。

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
- T0766（被中斷的 agent 分頁）：
  - 單元 `electron/__tests__/pty-manager-interrupted-agents.test.ts`：dep 在 `clearAll` 之前呼叫（呼叫當下 tracker 仍有 session id / `agentStarted`，recovery 後清掉）、Worker 帶工單與塔台、listener 丟例外照常完成、source guard（位置與日誌字串）。突變：把呼叫移到 `clearAll` 之後 → 失敗。
  - 單元 `electron/__tests__/interrupted-agents.test.ts`：快照只列 agent 分頁、純 shell 不列；清單合併 / 移除 / 事件；Worker resume（請求內容、`\r`、拒絕情況）；channel 只在 `ipcMain.handle`；builder `resume`（`--resume=<id>` 在 BAT 參數之後、自訂參數之前、沒有 prompt、沿用 `--name=`；session 未知 → `--resume`；自訂參數含 resume 類旗標 → 不加；codex 拒絕；不帶 `resume` 時指令不變）；`claude-sessions.json` 的 `interrupted` 項（recovery 後保留、離開清單後移除、重開不還原、沒有時檔案格式不變）。
  - 單元 `src/lib/__tests__/claude-resume-args.test.ts`、`src/components/__tests__/interrupted-agents-dialog.test.tsx`（分組與排序、按鈕、Esc / [X] 只關閉、全部恢復只算 claude、store 兩條 resume 路徑與未掛載工作區、toast 數量、source guard：⏻ 重啟仍不帶 `--resume`、resume 先 kill 再 `startClaudeCliPty`、不再 `worktree.create`）、`dialog-escape.test.tsx`（涵蓋清單）。
  - T0767（codex）：單元 `electron/__tests__/interrupted-agents-codex.test.ts`（builder codex `resume`：在 BAT MCP `-c` 與 update-check `-c` 之後、自訂參數之前，沒有 prompt / `--last` / session id；自訂參數含 `resume` / `fork` → 不加；BAT MCP 關 → 派工照舊不加 `--no-daemon`；Worker resume 的請求與 `picker`）、`src/lib/__tests__/codex-resume-args.test.ts`、`src/components/__tests__/interrupted-agents-codex.test.tsx`（store 分流：codex-cli 分頁 → 工作區 handler、派工 codex → main；對話框 codex 列與「全部恢復」計數；source guard：`resumeCodexCliTab` 走 `restartOrCreatePty` + `withBatMcpLaunchArgs` + `codexResumeCommand`、不含 `--last`）；`bat-mcp-launch.test.ts` / `blocked-hooks-launch.test.ts` 的 renderer 啟動計數 +1。突變 8 項（builder 改回 claude 參數 / 拒絕 codex、main 拒絕 codex、store 不認 codex / codex 分頁改走 main、忽略 `resume` 自訂參數、WorkspaceView 拿掉 codex 分支、對話框 codex 狀態）皆有測試失敗。
  - T0767 e2e `e2e/t0767-interrupted-codex-resume.spec.ts`（隔離實例，Windows，需先 `npx vite build`；BAT MCP 開 / 關各一次）：以 `csc` 編 stub `codex.exe` 放在 BAT 的 PATH 最前面（`--version` → `codex-cli 0.166.0`；其他呼叫記錄 argv、送一次 OSC 7501 `state=idle`），`CODEX_HOME` 用暫存目錄；一個 codex-cli 分頁 + 塔台 shell + helper 派工的 codex Worker（工作區 codex 參數 `--model e2e-t0767`），只 `taskkill /F` server → 兩列都可恢復；恢復後 stub argv = 第一次啟動的 argv 在自訂參數前插入 `resume`（Worker 去掉 `$ct-exec` prompt），沒有 `--last`；MCP 開時含 `-c mcp_servers.bat.*`、關時分頁含 `--no-daemon`。驗紅：`codexResumeArgs` 不加 `resume` → 2 failed。
  - e2e `e2e/t0766-interrupted-agents-recovery.spec.ts`（隔離實例，Windows，需先 `npx vite build`）：以 .NET Framework `csc` 編 stub `claude.exe`（system runtime customPath；記錄 argv、經 `bat-hook.mjs session-start` 回報假 session id），一個 claude-cli 分頁 + 一個 shell 分頁（塔台）+ 一個 helper 派工的 Worker，只 `taskkill /F` server → 對話框只列 claude 分頁與 Worker、兩個 ⏸、`claude-sessions.json` 有 `interrupted`；恢復後 stub argv 含 `--resume=<id>` 與 `--mcp-config=` / `--settings=` / 原 `--name=`（Worker 沒有 `/ct-exec`），`SessionStart` 再次回報，對話框與標示消失。
