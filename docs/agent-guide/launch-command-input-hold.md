# 啟動命令寫入前的輸入：renderer 的 agent 分頁（T0951 / BUG-231）

> CLAUDE.md「BAT MCP shim（PLAN-047 M1 / T0584）」節的派工那一點指到這裡。helper 派工的同類保護（BUG-151 / T0598）見 [bat-mcp-shim.md](bat-mcp-shim.md) 的 BUG-151 段，本單沒有改它。

## 現象（BUG-231，T0947 查證時發現）

⏻ 一個 agent 分頁（或新開、還原、恢復被中斷的 agent 分頁）後，新 shell 起來到 renderer 寫入啟動命令之間約 500 ms，使用者這段時間打的字先進了新 shell 的輸入列，啟動命令接在後面，整行變成一個壞掉的命令（例 `ls'C:\Users\demo\…\claude.exe' --mcp-config=…`）。分頁在這時已經有鍵盤焦點，所以很容易發生。helper 派工有同樣的時間窗，BUG-151 已在主行程處理；renderer 寫啟動命令的路徑沒有。

## 查證：哪些路徑以這種方式寫啟動命令

T0951 前都在 `src/components/WorkspaceView.tsx`，形式一律是 `pty:create` / `pty:restart` 之後 `setTimeout(() => pty.write(id, 命令 + '\r'), 500)`，共 11 處、6 條路徑：

| 路徑 | 建立方式 | T0951 前的寫入 |
|---|---|---|
| claude-cli 分頁：新開（Claude CLI、以塔台開啟 Claude、worktree 版）、⏻、還原、恢復被中斷的分頁 | `startClaudeCliPty` → `createPtyThenLaunch`（⏻ 與恢復先 `pty:kill`） | 1 處 |
| 還原其他 terminal 型 agent 分頁（codex 等） | `createPtyThenLaunch` | 3 處（`buildLaunchCommand` 的命令／preset 命令／失敗時的 preset 命令） |
| 工作區沒有分頁時建立預設 agent 分頁（`agentAutoCommand`） | `createPtyWithReplay` | 3 處 |
| 「+」新增其他 agent 分頁（`handleAddAgent`） | `createPtyWithReplay` | 2 處 |
| 其他 agent 分頁的 ⏻（`handleRestart`） | `restartOrCreatePty` | 1 處 |
| 恢復被中斷的 codex 分頁（`resumeCodexCliTab`） | `restartOrCreatePty` | 1 處 |

不在範圍（照舊）：「未登入」導引開的登入分頁（`openClaudeLoginTerminal`，只打字不送出）、遠端工具安裝（`useRemoteToolInstall`）、ct-exec / ct-done 按鈕（`terminal:create-with-command`，主行程寫入，已有 BUG-151 的保護）、Claude Agent 面板（沒有 shell）、一般 shell 分頁（沒有啟動命令）。

## 做法：沿用 BUG-151 的主行程保留

- 🔴 保留與送出只有一份實作：`PtyManager`（`electron/pty-manager.ts`）。`holdInputForLaunch(id)` 用 BUG-151 的同一個 `dispatchInputHolds`，所以判斷哪些輸入要擋的仍是 `writeWithResult` 的同一段（終端自動回應 `isTerminalAutoReply` 不擋，其他照順序存起來，回 `{ ok: true, reason: 'held-until-dispatch' }`）。另外只記這個保留的計時器與位元組數（`launchInputHolds`）。
- 開始：renderer 在 `pty:create` 的選項帶 `holdInputUntilLaunch: true`，或 `pty:restart` 帶第 4 個參數 `{ holdInputUntilLaunch: true }`；handler（`electron/handlers/pty.ts`）在**同一個 tick**、只在真的起了新 shell（`created: true` / restart 回 `true`）時呼叫 `holdInputForLaunch`，之後才處理同一個視窗後到的 `pty:write`。旗標不傳給 `PtyManager.create` / Terminal Server。
- 結束：
  - renderer 的 `sendLaunchCommand(id, 命令)`（`src/lib/launch-command.ts`）照舊等 `LAUNCH_COMMAND_DELAY_MS` = 500 ms，改送 `pty:launch-command(id, 命令)` → `writeLaunchCommand`：先寫命令、再依序寫保留的輸入。
  - 要了保留卻決定不打命令的分支（`buildLaunchCommand` 沒有結果且沒有 preset 命令、失敗）呼叫 `releaseLaunchHold(id)` → `pty:launch-command(id, null)`：輸入照原樣寫出。
  - 保護：`LAUNCH_INPUT_HOLD_TIMEOUT_MS` = 15 s 內沒收到命令（renderer 重新載入、建立後出錯），或保留超過 `LAUNCH_INPUT_HOLD_MAX_BYTES` = 64 KiB → 輸入照原樣寫出（依序、不丟）；之後才到的命令是一般寫入。BUG-151 沒有逾時與上限，因為命令由主行程自己 500 ms 後一定寫入；renderer 路徑中間隔著 IPC 與最多 5 s 的版本檢查（codex `--no-daemon`、claude `--name`），可能永遠不送，所以要有逾時，15 s 留餘裕。
  - PTY 結束（`recordExit`，含 ⏻ 的 kill）：與 BUG-151 相同，保留的輸入沒有地方寫，丟掉，計時器清掉。
- 結果：使用者的輸入不丟、順序不變、只移到命令之後（落在 agent 啟動後的輸入框或下一個提示字元）。
- 日誌（只記筆數與位元組數，不記內容）：`[agent-command] id=<id> input before the launch command: <n> write(s), <bytes> bytes → sent after it`；逾時 / 上限另記 `[agent-command] id=<id> launch hold ended (<timeout|limit>) before the launch command` 與 `input held for the launch command (<reason>): …`。

## `pty:launch-command`

- proxied（`PROXIED_CHANNELS`，`electron/remote/protocol.ts`；`PATH_FREE_CHANNELS`）：遠端視窗的分頁 PTY 在遠端主機，保留也必須在那台主機的 `PtyManager`；本機與 headless 共用 `registerPtyHandlers`。
- 🔴 不是 helper channel：不在 `HELPER_CHANNEL_ROLES`，handler 另對 `ctx.helper` 回 `{ ok: false, reason: 'forbidden' }`。參數：`id` 非空字串、`command` 字串或 `null`，否則 `invalid-args`。
- 版本相容：T0951 前的 bat-server 忽略 `holdInputUntilLaunch` / 第 4 個參數（不保留），`pty:launch-command` 回 `No handler` → `sendLaunchCommand` 改用原本的 `pty:write`、`releaseLaunchHold` 什麼都不做：行為與 T0951 前相同。

## 行為不變

- 沒有啟動命令的一般 shell 分頁（還原、新增、⏻）不帶旗標，輸入不延後；`created: false`（PTY 還在跑）不保留、也不打命令（T0403）。
- 命令寫入之後的輸入照常直接寫入。
- helper 派工（`holdInputForDispatch` / `writeDispatchCommand`、日誌字串、`LaunchSuspectWatcher` 只看 helper 派工）不變；`electron/__tests__/dispatch-input-before-command.test.ts` 未改。
- `{ auto: true }` 的寫入、T0788 / T0904 的通知保護（`notifyHold` 在 `writeWithResult` 之前）不變；保留期間收到的 auto 寫入與 BUG-151 一樣一起保留（新 shell 在啟動命令前不會是自動續行的目標）。
- 啟動命令的內容（T0944 的 `/control-tower`、T0946 的 `MSYS2_ARG_CONV_EXCL` 前置變數）、T0947 的滑鼠追蹤重設（只寫本機 xterm、不經 `pty:write`）、PTY env、500 ms 的等待都不變。

## 已知限制

- 15 s 逾時後才到的命令仍會接在已寫出的輸入後面（與 T0951 前相同的結果，只在 renderer 異常時發生）。
- 舊 bat-server 的遠端視窗沒有保護（見版本相容）。
- 登入分頁與遠端工具安裝未納入（見上表）。

## 驗證

- `electron/__tests__/launch-input-hold.test.ts`：Terminal Server 模式的真 `PtyManager` — 打字 → 命令完整、輸入在後；沒打字 → 只有命令；自動回應不擋；`null` 釋放；15 s 逾時與 64 KiB 上限照原樣寫出；kill 結束保留且不留計時器；helper 派工的保留不受影響。handler 端到端：`pty:create` / `pty:restart` 帶與不帶旗標、本機視窗的 `pty:write`、`pty:launch-command` 拒絕 helper 與錯誤參數、旗標不傳給 Terminal Server、沒有旗標時選項原物件傳給 `createWithResult`。
- `src/lib/__tests__/launch-command.test.ts`：500 ms 後經 `pty:launch-command`、舊主機 fallback `pty:write`、`releaseLaunchHold` 不打字；`restartOrCreatePty` 有旗標才帶第 4 個參數；WorkspaceView source guard（11 處都經 `sendLaunchCommand`、6 個建立點都帶旗標、登入分頁與一般 shell 不帶）。
- 待實機：見 T0951 回報區〈待實機〉。
