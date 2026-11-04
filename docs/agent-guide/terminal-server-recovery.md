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
| heartbeat | `PtyManager.startHeartbeat` / `handlePong` / `serverLiveness` / `tcpServerPidNow`（`electron/pty-manager.ts`） |
| 協定 v1（hello / 權杖 / 未知請求，T0857） | client `openHelloConnection` / `HelloReader` / `negotiateProtocol`（`electron/terminal-server/protocol.ts`）；server `acceptTcpConnection` / `handleTcpLine` / `extendIdle`（`electron/terminal-server/server.ts`）；權杖檔 `writeTokenFile` / `readTokenFile` / `removeTokenFile`（`electron/terminal-server/pid-manager.ts`，只用 fs / path：它在 app-paths-bootstrap 的 import 鏈上）、產生與比對 `generateServerToken` / `tokensMatch`（`server.ts`）；主行程呼叫端 `probeServerPtyCount` / `sendShutdownToServer` / `endsUnusableServer` / `shutdownTerminalServerAndWait`（`electron/main.ts`） |
| recovery | `PtyManager.handleServerDeath(reason)`、`detachServer`、`endReplacedServer` |
| 訊息分派與 generation | `handleServerMessage(msg, generation)` |
| 孤兒清理 | `killOrphanPtyProcesses`（`electron/pty-manager.ts`，export；Electron 啟動時的孤兒清理 `startTerminalServer` 也用它） |
| 程序操作（可注入） | `ServerWatchdogDeps` / `defaultServerWatchdogDeps`，經 `PtyManagerDeps.serverWatchdog` 替換（只有測試會替換） |
| re-fork | `reforkTerminalServer`（`electron/main.ts`），經 `ptyManager.onRequestNewServer` 呼叫；fork 本身與首次啟動共用 `forkTerminalServer`（T0816：Linux 經 fd guard、只留 IPC 與 AppImage keepalive，見 [linux-pty-fd-inheritance.md](linux-pty-fd-inheritance.md)「Terminal Server 的 fork」） |
| 樹狀結束 | T0540 的 `killProcessTree`（`electron/terminal-server/process-tree.ts`）；本單不另寫一份 |

## 判死條件（A）

| 路徑 | 條件 | 結果 |
|---|---|---|
| IPC `exit`（`setServerProcess` 的 `once('exit')`） | server 程序結束 | 立即 recovery（`reason=ipc-exit`） |
| TCP `close`（`connectToServer`） | 重連通道關閉 | 立即 recovery（`reason=tcp-close`） |
| heartbeat tick（每 `HEARTBEAT_INTERVAL_MS` = 10 s） | `now() - lastPongAt > INTERVAL + HEARTBEAT_TIMEOUT_MS`（13 s）→ 這個 tick 算遲到；收到 pong 就歸零 | 未滿 3 個：只計數 |
| 同上，連續第 3 個遲到 tick 起 | 檢查 `serverLiveness()`：IPC 模式程序活著要同時滿足 `exitCode` / `signalCode` 未設，且 `process.kill(pid, 0)` 成功（EPERM 也算活著），IPC 看 `connected`；TCP 模式（T0857）程序 = pid 檔（沒有時 hello-ok 的 pid）＋ `process.kill(pid, 0)`，通道看 socket | 任一不在 → recovery（`reason=heartbeat`）；兩者都在 → `[heartbeat] late pong:`（第 3、6、9… 個遲到 tick 各記一次），不 recovery |

- 從最後一次 pong 算起，最快約 40 s 判死（例：t=0 收到 pong，t=20、30、40 為遲到 tick）。
- T0857 起 heartbeat 在 fork IPC 與 TCP 重連模式都會啟動；TCP 模式的程序以 pid 檔判斷、通道看 socket（見「協定 v1」節的〈TCP 模式的存活判斷〉）。T0857 前 TCP 模式沒有 heartbeat，只靠 TCP `close`。

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

## 協定 v1：hello、TCP 權杖、不認得的請求（PLAN-065 W1 / T0857，D285 / D286）

升級後新版主行程會常態地連到舊版 server（PLAN-065），所以 server 與主行程之間的 TCP 協定補上版本、握手與認證。協定只做相加，舊欄位的意義不變。

### 必守規則

- 🔴 TCP 連線的第一個請求必須是 `server:hello`（帶權杖）。未認證的第一個請求（含格式錯誤的 JSON、權杖錯）→ 回 `error`（`code: UNAUTHENTICATED`）並關閉 socket，同一次寫入後面的行一律不執行。未認證的連線收不到廣播（`pty:data` / `pty:exit`），也不重設 idle 倒數；`SERVER_HELLO_TIMEOUT_MS` = 10 s 內沒有完成 hello 就關閉；換行前最多 `UNAUTHENTICATED_MAX_BUFFER` = 64 KiB。
- 🔴 fork IPC 不需要權杖（parent 就是 fork 它的主行程）。
- 🔴 權杖只在 server 與主行程之間：不寫日誌（server 的 stderr、主行程 logger 都不記）、不進任何 env（server 的 fork env、`buildServerPtyEnv`、`buildPtyEnv`）、不進命令列參數。日誌只記協定版本與結果。
- 🔴 `server:hello` 與 `server:shutdown` 在每個協定版本都有效：沒有共同版本時，帶對的權杖仍可以 `server:shutdown`（之後的 D5「結束並說明」靠它）。
- 🔴 對不認得的請求一律回 `error`（`code: UNKNOWN_REQUEST`），不再不回應；之後的新版主行程靠它探測功能。
- 🔴 新增請求 / 回應只能相加；不改既有欄位的意義，不刪既有請求。改協定時同步改 `TERMINAL_SERVER_PROTOCOL_MAX` 與本節的訊息表。

### 訊息表

| 方向 | 訊息 | 何時 | 說明 |
|---|---|---|---|
| 主行程 → server | `server:hello { protocolMin, protocolMax, token }` | TCP 連線的第一個請求（fork IPC 可選、`token` 可空） | `token` = `bat-pty-server.token` 的內容 |
| server → 主行程 | `server:hello-ok { protocol, batVersion, runtime: { name: 'electron'\|'node', version }, holderDir?, pid }` | hello 成功 | `protocol` = 雙方共同的最高版本；`batVersion` = fork 它的 BAT 版號（env `BAT_TERMINAL_SERVER_BAT_VERSION`，沒有時 `''`）；`holderDir` 留給 W3（目前不送） |
| server → 主行程 | `error { requestType: 'server:hello', code: 'UNAUTHENTICATED' }` | 權杖錯 / 沒有 | 之後關閉 socket |
| server → 主行程 | `error { requestType: 'server:hello', code: 'NO_COMMON_PROTOCOL', protocolMin, protocolMax }` | 權杖對、沒有共同版本 | socket 保留，只接受 `server:shutdown` / `server:ping`，其他 → `NOT_ALLOWED` 並關閉 |
| server → 主行程 | `error { requestType, code: 'UNAUTHENTICATED' }` | 未認證的第一個請求不是 hello | 之後關閉 socket |
| server → 主行程 | `error { requestType, code: 'UNKNOWN_REQUEST' }` / `'BAD_REQUEST'` | 不認得的請求 / 不是 JSON 物件或欄位錯 | 連線保留 |
| 主行程 → server | `server:extendIdle { durationMs }` | W4（安裝程式觸發 quit 時，D7） | 本單只提供協定與 server 行為，沒有呼叫端 |
| server → 主行程 | `server:idle-extended { idleTimeoutMs, configuredIdleTimeoutMs }` / `error ALREADY_EXTENDED` / `BAD_REQUEST` | 回覆 `extendIdle` | 見下 |
| 既有（protocol 0） | `pty:create` / `pty:write` / `pty:resize` / `pty:kill` / `pty:list` / `pty:getBuffer` / `server:ping` / `server:shutdown` / `server:getConfig` 與其回應 | — | 不變；`error` 多了可選的 `code`（以及 `protocolMin` / `protocolMax`） |

協定版本：protocol 0 = T0857 前的訊息集合（沒有 hello）；本版 server 與主行程都是 1..1（`TERMINAL_SERVER_PROTOCOL_MIN` / `MAX`，`electron/terminal-server/protocol.ts`）。

### hello 的判定（client 端）

client 在第一次寫入同時送 `server:hello` 與 `server:ping`（`helloOpeningLines`）：

| 先收到 | 判定 | 時間 |
|---|---|---|
| `server:hello-ok` | protocol = 回傳值（須在自己的範圍內，否則 `incompatible`） | 一個來回 |
| `server:pong`（之前沒有 hello-ok） | **protocol 0**（T0857 前的 server：不認得 hello、不回應，只回 ping） | 一個來回 |
| `error`（hello，`UNAUTHENTICATED`） | `unauthenticated` | 一個來回 |
| `error`（hello，`NO_COMMON_PROTOCOL`） | `incompatible` | 一個來回 |
| 都沒有，`HELLO_TIMEOUT_MS` = 3 s | `timeout` | 3 s |
| socket 關閉 / 連不上 | `closed` | — |

- 逾時值 3 s 的理由：舊 server 是在 pong 時判定，不必等逾時；3 s 只涵蓋完全不回應（卡住、不是 Terminal Server）的情況，等於 T0857 前 probe（`pty:list`）與重連（TCP connect）各自的逾時，不讓啟動變慢。
- hello 期間收到、不屬於 hello 的訊息（舊 server 一連上就廣播 `pty:data`）依到達順序交給呼叫端（`HelloReader.held`），不丟。
- 唯一實作：`openHelloConnection` / `HelloReader` / `negotiateProtocol` / `shutdownLines`（`electron/terminal-server/protocol.ts`，server 與主行程共用 `negotiateProtocol`）。

### 呼叫端

| 呼叫端 | 做法 | hello 失敗時 |
|---|---|---|
| `probeServerPtyCount(port, token)`（`main.ts`，啟動與 View→Reload） | hello → `pty:list` | 回傳 `{ ok: false, reason }`（不再只回 0） |
| `startTerminalServer` | probe | `unauthenticated` / `incompatible` / `timeout` → 照 Recovery「重新開始」的路徑：`sendShutdownToServer` → `waitForTerminalServerExit`（5 s）→ 刪 pid / port / token 檔 → fork 新 server（`endsUnusableServer`、`shutdownTerminalServerAndWait`）。`closed` → 照舊（靜默重連，失敗走 stale 路徑） |
| `PtyManager.connectToServer(port, token)`（靜默重連、Recovery「保留」） | hello，成功後同一條 socket 繼續當通道並啟動 heartbeat | 回傳 `{ ok: false, reason }`；`terminal-server:recover` 對 `unauthenticated` / `incompatible` / `timeout` 先走上面的「重新開始」步驟，`closed` 照舊直接開新 server；兩者都在新 server 起來後 `releaseCreates('recovery failed…')`（T0578 不變） |
| `sendShutdownToServer(port, token)`（Recovery「重新開始」、quit Step B、`runInstallerQuitWithoutApp`） | 一次寫入 `server:hello` + `server:shutdown`，不等回覆 | 舊 server 忽略 hello、照舊 shutdown；權杖錯的 v1 server 不會 shutdown（之後的等待照舊逾時） |

W5（T0861）依 `reason` 走 D5「結束並說明」；本單沒有新的 UI。

### TCP 權杖（D8）

| 項目 | 規則 |
|---|---|
| 產生 | server 每次啟動時 `crypto.randomBytes(32)` → base64url（`generateServerToken`）；在 TCP listen 之前寫檔，所以讀到 port 檔的 client 一定讀得到權杖 |
| 存放 | `<userData>/bat-pty-server.token`（`writeTokenFile`）；POSIX 先以 0600 寫暫存檔再 rename（不會有一瞬間是其他人可讀）；Windows 靠 `%APPDATA%` 使用者資料夾的 ACL（與 `server-token.json` 相同） |
| 讀取 | 主行程每次連線前讀（`readTokenFile`），沒有檔 → 空權杖（對舊 server 無影響，v1 server 拒絕） |
| 比對 | `crypto.timingSafeEqual`（`tokensMatch`） |
| 輪替 | 權杖壽命 = server 壽命：server shutdown / SIGTERM 刪檔，下一個 server 覆寫；主行程在孤兒清理、stale 清理、re-fork、Recovery「重新開始」與「保留失敗」時，與 pid / port 檔一起刪 |
| 保護範圍 | 擋其他 OS 使用者與讀不到這個使用者 userData 的程序（T0856 Q3：之前任何本機程序都能連上 port 寫入別人的 shell）。同一使用者的程序本來就讀得到 userData，不是防護邊界 |

### 延長 idle（D7）

- `server:extendIdle { durationMs }`：下一次 idle 倒數用 `min(max(durationMs, 設定值), 24 h)`（`MAX_IDLE_EXTENSION_MS`）；只延長一次，已延長時再要求 → `ALREADY_EXTENDED`；任何 client hello 成功（重新連上）→ 恢復設定值；設定值 0（永不結束）→ 維持 0。`server:getConfig` 的 `idleTimeoutMs` 仍回設定值。
- 唯一實作：`TerminalServer.extendIdle` / `effectiveIdleTimeoutMs`（`electron/terminal-server/server.ts`）。

### TCP 模式的存活判斷（T0856 Q3）

- T0857 前：TCP 模式（BAT 重開後以 TCP 接回，`serverProcess` 為 null）**沒有啟動 heartbeat**，只靠 TCP `close`；`serverLiveness` 只看 fork 的 `serverProcess`，在 TCP 模式一律回「gone / closed」。T0856 Q3 指出若 heartbeat 在 TCP 模式跑起來，就會把活著的 server 判死。
- T0857：`connectToServer` 成功後也啟動 heartbeat；`serverLiveness` 在 TCP 模式以 pid 檔（`bat-pty-server.pid`，每次檢查時讀；沒有時用 `hello-ok` 的 pid）＋ `process.kill(pid, 0)` 判斷程序，以 socket 是否 destroyed 判斷通道。判死規則與 IPC 相同（連續 3 個遲到 tick 且程序或通道至少一個不在）；TCP `close` 照舊立即 recovery。
- 判斷唯一實作 `serverLiveness` / `tcpServerPidNow`（`electron/pty-manager.ts`）。

### 兩種版本組合

| 組合 | 預期行為 |
|---|---|
| 新主行程 × 舊 server（T0857 前；macOS / Linux 升級後保留的 server、開發模式） | hello 被忽略、ping 回 pong → protocol 0，照今天的訊息集合運作；hello 帶的權杖舊 server 不看。probe、Recovery 提示、保留 / 重新開始、quit 停 server 都與 T0857 前相同；TCP 接回後多了 heartbeat（舊 server 回 pong） |
| 舊主行程 × 新 server（降版） | 舊主行程的第一個請求（`pty:list`）→ `error` UNAUTHENTICATED ＋ 關閉 → probe 得 0 → 靜默重連（TCP connect 成功）→ `pty:list` 再被拒、TCP close → T0704 立即 recovery（結束新 server 與它的 PTY，自己 fork）。與 D8 預期相同：終端會被結束，不會「以為連上了卻建不出 shell」 |
| 新主行程 × 新 server | protocol 1 |
| 新主行程 × 未來的 server（沒有共同版本） | `incompatible` → 以權杖送 `server:shutdown` → 照「重新開始」路徑 |

### 日誌

| 日誌 | 意義 |
|---|---|
| `[PtyManager] TCP connected to Terminal Server on port <p> (protocol 1, BAT <版號>, runtime <electron\|node> <版本>[, holder <key>], pid <pid>)` | v1 接回；`holder <key>` = server 從 PTY holder 啟動（T0859，只記 key，回報的路徑不是 key 時記 `unrecognised`） |
| `[PtyManager] TCP connected to Terminal Server on port <p> (protocol 0 (no hello: a server before T0857))` | 舊 server |
| `[PtyManager] Terminal Server on port <p>: hello failed (<reason>)`（warn） | `connectToServer` 失敗 |
| `[terminal-server] existing server on port <p>: hello <reason> — ending it (Recovery fresh-start path)`（warn） | 啟動時遇到不能用的 server |
| `[terminal-server] recovery failed (hello <reason>) — ending the old server, falling back to new server`（warn） | Recovery「保留」時 hello 失敗 |
| `[terminal-server] unusable server still running after 5000 ms — starting the new one anyway`（warn） | 結束不能用的 server 逾時 |
| `[heartbeat] … server process=alive\|gone tcp=connected\|closed — server dead` / `… server process and TCP connection alive — no recovery` | TCP 模式的 heartbeat（IPC 模式的字串不變） |
| server stderr `[terminal-server] failed to write the token file — TCP clients cannot authenticate` | 權杖檔寫入失敗（不含權杖） |

### 已知限制

- 權杖錯的 v1 server（例：權杖檔被別的程序改掉）無法以 TCP 結束：「重新開始」路徑等滿 5 s 後照舊開新 server，舊 server 留到 idle timeout。
- 協定 v1 不加密：只在 `127.0.0.1`，權杖以明文 JSON 傳送（與 T0857 前的訊息相同層級）。
- `holderDir`：T0859 起從 PTY holder 啟動的 server 會帶（`runtime.name: 'node'`），見下一節；其他 server 仍是 BAT 執行檔以 node 模式執行（`runtime.name: 'electron'`、沒有 `holderDir`）。
- 跨平台：macOS / Linux 的「保留 Terminal Server → 重開 → 保留 → 接回」實機不回歸要在 `linux-acceptance` / `macos-acceptance` 手動跑一次（T0856 W1 驗收欄）；本單只有單元測試與 Windows 本機驗證。

### 驗證

- 單元 `electron/__tests__/terminal-server-protocol-v1.test.ts`（真的 `TerminalServer` 在 `127.0.0.1`、暫存 userData；假的舊 server / 不回應的 server；PtyManager 以 mock watchdog）：
  - 協商（共同版本 / 無共同版本 / 格式錯）、`HelloReader`（pong 先到 = protocol 0、保留期間的訊息）。
  - hello-ok 欄位；權杖錯 / 沒有 → `unauthenticated`；舊主行程的 `pty:list` 先到 → `error` ＋ 關閉、同一次寫入的 `server:shutdown` 不執行；格式錯 → 關閉；10 s 沒 hello → 關閉；未認證的連線收不到廣播。
  - 無共同版本 → `NO_COMMON_PROTOCOL`（含 server 範圍），之後只接受 ping / shutdown；帶權杖的 shutdown 會結束 server、權杖檔一起刪。
  - 不認得的請求（TCP 與 IPC）→ `UNKNOWN_REQUEST`、連線保留。
  - 權杖檔內容、POSIX 0600、沒有殘留暫存檔；`tokensMatch`。
  - `extendIdle`：24 h 上限、不低於設定值、只一次、`BAD_REQUEST`、設定 0、倒數用延長值、hello 成功後恢復（被拒的連線不恢復）。
  - 舊 server → protocol 0（在逾時前判定）、早到的輸出保留並進入分頁輸出；不回應 → `timeout`；沒人聽 → `closed`。
  - PtyManager TCP 模式：hello 帶權杖、日誌有協定沒有權杖；被拒 → `{ ok: false }` 且沒有通道；**3 個遲到 tick、pid 檔的程序還在 → 不 recovery**、只記 `late pong`；pid 檔的程序不在 → `reason=heartbeat`；沒有 pid 檔 → 用 hello 的 pid；pong 恢復歸零、TCP close 照舊立即 recovery。
  - 權杖不在 `process.env`、PTY env、server stderr；source guard：`forkTerminalServer` 不提權杖、server 不從 env 讀權杖、`buildPtyEnv` 不讀權杖檔、日誌行不插值權杖變數。
- 既有不回歸：`terminal-server-pty-env.test.ts`（env 清單多 `BAT_TERMINAL_SERVER_BAT_VERSION`）、`pty-manager-heartbeat-recovery.test.ts`、`recovery-create-hold.test.ts`、`installer-quit-request.test.ts`、`upgrade-interruption.test.ts`、`helper-capability-persist.test.ts` 的 source guard。

## 從 PTY holder 啟動（PLAN-065 W3 / T0859，D286）

用途：Windows 的 NSIS 升級會結束 `$INSTDIR` 底下的所有程序（`Path.StartsWith('$INSTDIR')`，沒有 PowerShell 時以映像名稱），今天的 Terminal Server（`BetterAgentTerminal.exe` 以 node 模式執行）會跟著被結束（T0856）。T0858 把 holder（官方 `node.exe` 改名 `bat-pty-holder.exe`＋打包內的 `terminal-server.js`＋node-pty＋Node 的 LICENSE）放進安裝檔、由安裝程式複製到安裝目錄外；本節是 BAT 何時、怎麼從那裡啟動 Terminal Server。升級時保留 server（quit / 安裝程式）是 W4（T0860），升級後接回與說明是 W5（T0861）。

### 必守規則

- 🔴 **只有** win32 ＋ 打包版（`app.isPackaged`）＋ NSIS 安裝（有 T0823 的標記 `resources\installer-quit-request.supported`，zip 版與 `build:dir` 沒有）＋ holder 驗證通過，才從 holder 啟動。其他情況（macOS / Linux、`npm run dev`、zip、holder 缺少或不符、任何檢查失敗）`forkTerminalServer` 的參數與行為和 T0859 前逐字相同：`fork(serverScript, [], { detached: true, stdio, env })`（`terminalServerForkOptions`），Linux 的 `runWithoutCrashpadClient` / `planTerminalServerFork`（T0816）不動。非 win32 與開發模式不讀任何 holder 檔案、不記日誌。
- 🔴 `forkTerminalServer`（`electron/main.ts`）仍是唯一啟動點（首次與 T0704 re-fork 共用）；它變成 async（holder 驗證要讀檔），兩個呼叫端 `await`。啟動時 `startTerminalServer` 在建立視窗之前，re-fork 本來就 await，所以等待期間不會有分頁 create 走 direct。
- 🔴 從 holder 啟動：執行檔 = `<holder>\bat-pty-holder.exe`、腳本 = `<holder>\terminal-server.js`、`cwd` = holder 目錄（不得沿用主行程的 cwd，否則安裝目錄刪不掉）、env 與 fork 相同但**去掉** `ELECTRON_RUN_AS_NODE`、stdio 相同（含 `ipc`）、`detached`、`windowsHide`。node-pty 從 holder 的 `node_modules` 載入（腳本所在目錄），不從安裝目錄載入 `conpty.node`。
- 🔴 用 `spawn`（stdio 帶 `ipc`）而不是 `fork`：Electron 的 `child_process.fork` 一律在子程序 env 加 `ELECTRON_RUN_AS_NODE=1`，指定別的 `execPath` 也一樣（T0859 以 Electron 45.2.1 實測）。`spawn` 帶 `ipc` 開的是同一條 IPC 通道（JSON 序列化），PtyManager 的 `setServerProcess`、quit Step A 的 IPC `server:shutdown` 照舊。
- PTY env 照舊經 `buildServerPtyEnv` / `buildPtyEnv`（server 的 `TERMINAL_SERVER_OWN_ENV_KEYS` 與 BUG-038 的 `ELECTRON_RUN_AS_NODE` 移除不變）；`BAT_USER_DATA`、`BAT_TERMINAL_SERVER_BAT_VERSION`、idle / buffer 設定照樣帶，所以 holder 版的 server 寫同一個 `<userData>` 的 pid / port / token 檔。
- 驗證失敗只記一行 `[pty-holder]` 並照舊 fork，不提示使用者、不擋啟動。

### 判斷順序（`resolvePtyHolder`，`electron/pty-holder.ts`）

| 順序 | 檢查 | 不通過 → `reason` |
|---|---|---|
| 1 | `process.platform === 'win32'` | `not-win32`（不讀檔、不記日誌） |
| 2 | `app.isPackaged` | `not-packaged`（同上） |
| 3 | `resources\installer-quit-request.supported` 存在 | `not-nsis-install`（zip / `build:dir`） |
| 4 | 安裝目錄內 `resources\pty-holder\holder-manifest.json` 可讀 | `no-packaged-manifest` |
| 5 | 它本身正確：`schema` 1、`exe` / `entry` 名稱、每個檔案項目格式（`/` 分隔、不含 `..`、64 hex）、key = `holderKey(nodeVersion, files)`、有列 exe 與 entry、沒有 `BetterAgentTerminal.exe` | `packaged-manifest-invalid` |
| 6 | manifest 的 `arch` = `process.arch` | `arch-mismatch` |
| 7 | 依範圍順序取 holder 根目錄（見下），跳過與安裝目錄互為字串前綴者（`holderRootConflictsWithInstallDir`，不分大小寫、任一方向） | 兩個根目錄都跳過 → `no-holder-root` |
| 8 | `<根目錄>\<key>` 存在；其中的 `holder-manifest.json` 與安裝目錄那份**位元組相同**；manifest 列的每個檔案都在、大小相同、**重算** SHA-256 相同；沒有 manifest 以外的檔案（例：exe 旁被放了 DLL 會被載入） | 都沒有複本 → `not-installed`；有但不符 → `holder-invalid`（日誌附前 3 個問題） |

- 預期值的來源是**安裝目錄內**的 `resources\pty-holder\holder-manifest.json`（BAT 本身就從安裝目錄執行；per-user 模式下 holder 根目錄是使用者可寫的），所以安裝目錄那份保留（約 90 MiB，見 [packaging docs](packaging-release-checks.md)「Windows PTY holder 打包」）。安裝程式只比對 manifest、不重算檔案雜湊，所以 BAT 每次啟動 server 前都重算（T0859 本機實測 22 檔、約 90 MiB，114 ms；耗時記在日誌）。
- **範圍順序**（`holderScopeOrder`）：安裝程式依 `$installMode` 決定根目錄，BAT 不讀登錄檔；安裝目錄在 `ProgramW6432` / `ProgramFiles` / `ProgramFiles(x86)` 底下 → 先 per-machine（`%ProgramFiles%\BAT-PtyHolder`），否則先 per-user（`%LOCALAPPDATA%\BAT-PtyHolder`）；第一個不通過時另一個照樣試（自訂安裝目錄）。兩份都要通過同一組檢查，順序只決定兩份相同內容時用哪一份。
- 規則與 `scripts/pty-holder.cjs`（打包 / 安裝程式端）一致：根目錄名稱、key、前綴衝突、manifest 欄位；`scripts/__tests__/pty-holder.test.mjs` 斷言兩邊對同一組輸入給出相同答案，並以打包程式組出的 holder 驗證 BAT 端接受、竄改後兩邊都拒絕。改任一邊時兩邊一起改。

### hello-ok 與日誌

- server 端（`electron/terminal-server.ts`）：不是 Electron 且腳本旁有 `holder-manifest.json` → `identity.holderDir = __dirname`，`server:hello-ok` 帶 `holderDir`、`runtime: { name: 'node', version }`（T0857 的欄位）。不經 env，所以 PTY 看不到。
- fork IPC 不送 hello（與 T0857 相同）；主行程在啟動時已記 `[pty-holder]` 那一行。TCP 接回（BAT 重開、升級後）時 `[PtyManager] TCP connected … runtime node v24.x, holder <key>, pid <pid>` 帶出 holder key（`holderKeyOfDir`：只記最後一段且必須符合 key 格式，否則 `unrecognised`，不記回報的路徑）。

| 日誌 | 意義 |
|---|---|
| `[pty-holder] Terminal Server from holder <key> (per-user\|per-machine), verified in <ms> ms` | 從 holder 啟動 |
| `[pty-holder] not used (<reason>)[ <key>] after <ms> ms[: <前 3 個問題>] — forking the Terminal Server as before` | 退回原 fork（只在 win32 打包版出現；問題只含相對路徑與範圍，不含使用者路徑、env、權杖） |

### 已知限制

- 驗證與啟動之間有時間差（TOCTOU）：驗證後、`spawn` 前被換掉的檔案不會被發現。per-user 根目錄的寫入權與 per-user 安裝目錄相同，不增加攻擊面。
- 每次啟動 server 都重算約 90 MiB 的雜湊（T0859 實測約 0.1 s，慢速磁碟或冷快取會更久）；沒有快取驗證結果。
- per-user 與 per-machine 兩個根目錄都有同一個 key 時，用的是範圍順序第一個通過的那份；另一範圍留下的目錄由 W4 / W6 處理（T0858 已列）。
- server 的 stderr 照舊是 `ignore`（與 fork 相同），holder 版的 `conpty_console_list_agent` `AttachConsole failed` 不可見（既有行為，T0858 對照）。
- 安裝程式實際執行（per-user / per-machine 複製、升級時 holder 不被結束）不在本單驗證範圍：〈待 W6 驗收〉。

### 驗證

- 單元 `electron/__tests__/pty-holder.test.ts`：根目錄、範圍順序、前綴陷阱（安裝目錄名稱加字尾）、`holderKeyOfDir`、`manifestProblems`；`resolvePtyHolder` 以記憶體檔案系統：非 win32 / 開發模式**沒有任何檔案存取**、zip（沒有標記）不看 holder、manifest 缺 / 壞 / key 不符 / arch 不符、根目錄衝突、沒有複本、manifest 複本不同 / 檔案被改（同大小）/ 多出 DLL / 少 LICENSE / 大小不同 → 退回，壞的 per-user 不擋好的 per-machine，檔案存取例外 → 退回；fork 參數：退回時 `toStrictEqual({ detached, stdio, env })` 且 env 是同一個物件，holder 時 execPath / 腳本 / cwd / 沒有 `ELECTRON_RUN_AS_NODE` / 同 stdio；source guard（`main.ts` 只在 win32 打包版查 holder、唯一的 `spawn`、兩個呼叫端 await；`terminal-server.ts` 不從 env 讀；`pty-manager.ts` 不記回報的路徑）。
- 兩邊規則一致：`scripts/__tests__/pty-holder.test.mjs`「electron/pty-holder.ts and scripts/pty-holder.cjs give the same answers」。
- e2e `e2e/t0859-pty-holder.spec.ts`（Windows、`BAT_E2E_EXECUTABLE=<release\win-unpacked\BetterAgentTerminal.exe>`，先 `npm run build:dir`；隔離 runtime，`LOCALAPPDATA` 指到暫存目錄，模擬安裝程式複製 holder 並建立標記）：server 的 `ExecutablePath` = holder 的 `bat-pty-holder.exe`、命令列跑 holder 的 `terminal-server.js`、`cmd.exe` 分頁執行命令、TCP hello 回 `runtime node` 與 `holderDir`、日誌有 `[pty-holder] Terminal Server from holder <key> (per-user)`；改一個 holder 檔後重開 → `not used (holder-invalid)`、server 回到 `BetterAgentTerminal.exe`、分頁照常。quit 時 holder 版 server 經 IPC `server:shutdown` 正常結束。

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
  - T0773 真的 claude / codex（`e2e/t0773-real-agents-recovery-resume.spec.ts`，**花 token，預設 skip**，`BAT_E2E_REAL_MODEL=1` 才跑；隔離實例，`BAT_E2E_EXECUTABLE` = 安裝版或 source build，Windows）：內嵌 claude（使用者既有登入，工作區參數 `--model claude-haiku-5-5 --strict-mcp-config`）+ 內嵌 codex（放 PATH 最前面，`CODEX_HOME` 暫存、不登入）+ 純 shell；只結束隔離實例的 server（pid 取自隔離 userData，命令列是該版的 `terminal-server.js` **且**父程序是隔離實例主行程才結束）。2026-11-02 安裝版 `0.7.3-pre.4`：toast「2 個 agent 分頁已中斷」、對話框列 claude + codex 不列 shell、⏸ ×2、不自動恢復；claude 恢復命令含 `--resume=<同一個 id>`（無 `--fork-session`，`--mcp-config=` / `--settings=` / `--name=` 仍在），問「剛才的數字」答 42；codex 命令 = 第一次啟動參數 + `resume`（無 id、無 `--last`），codex 0.166.0 接受、未登入所以先顯示登入畫面（沒看到 resume 選單本身）。自動開啟的對話框焦點仍在 xterm，第一次 Esc 被 xterm 吃掉、對話框不關（點一下對話框後 Esc 才關），見 T0773 回報 F1。2 個 Haiku 5.5 回合約 US$0.008。
