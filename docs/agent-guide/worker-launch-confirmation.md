# Worker 啟動確認（T0600，D154）

> CLAUDE.md「Worker 啟動確認（T0600，D154）」節的完整內容。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結；改功能時兩邊一起更新。

- **用途**：helper 派工在建立 PTY 後就回 exit 0，啟動指令 500 ms 後才寫入，塔台無從得知 Worker 是否真的啟動（BUG-151：exit 0 但 claude 沒起來）。T0600 讓 claude 的 `SessionStart` hook 經既有的 `terminal:report-hook` 回報「已啟動」，`terminal:get-state` / `terminal:list` / `terminal:wait` 揭露，helper 加 opt-in 的 `--wait-started <ms>`。T0621（D158）：codex `>= 0.163.0` 的 Worker 以 codex 自己送的第一個 OSC 7501 當啟動信號（見下方「codex（OSC 7501，T0621）」）。

## 介面契約（T0600「介面契約」，CT 依此撰寫，不得單方更改）

### helper：`bat-terminal.mjs … --wait-started <ms>`

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" \
  --skill ct-exec --workorder T#### [--mode yolo] [--isolation worktree] --wait-started 30000
```

- 只用於建立分頁的模式（agent 模式 `--skill` / `--prompt`，或 raw `<command>`）；與 `--close-worker` / `--set-role` / `--worktree-status` 併用 → 用法錯誤 exit 1。**必須帶 `--notify-id`**（= 呼叫者自己的 `BAT_TERMINAL_ID`；塔台只能查詢自己派出的 Worker）→ 沒帶 = 用法錯誤 exit 1，不建立分頁。
- `<ms>`：非負整數；超過 `WAIT_STARTED_MAX_MS` = 120000 → 以 120000 計（stderr 提示）；`0` = 建立後只查一次。非整數 → 用法錯誤 exit 1。
- 行為：分頁建立成功（`✓ Terminal created: <id>` 與既有資訊行照舊）之後，以 `terminal:wait { terminalId: <新分頁>, until: 'agent-started', timeoutMs }` 等待（每次至多 45 s，總共不超過 `<ms>`），stdout **最後**多一行：

  | stdout 最後一行 | exit | stderr 診斷行 | 意義 |
  |---|---|---|---|
  | `  started: <ISO 8601 UTC，例 2026-10-18T03:30:00.250Z>` | `0` | — | claude 已執行 `SessionStart`，或 codex 已送第一個 OSC 7501（時間 = BAT 收到的時間） |
  | `  started: unknown` | `0` | `wait-started: <CODE>` | 無法判定，**不是啟動失敗**（見下表） |
  | `  started: unconfirmed` | **`8`** | `create: LAUNCH_UNCONFIRMED` | `<ms>` 內未確認啟動，或分頁先結束；**分頁不關閉** |

  `unknown` 的 `<CODE>`：`NO_SIGNAL`（`agentStarted: null`：codex 低於 0.163.0 或版本確認不到（T0621）、raw command、自訂 CLI、hooks 未注入、claude 自己的設定關閉 hooks）、`UNSUPPORTED`（BAT 太舊：不認得 `until: 'agent-started'`、沒有 `terminal:wait`、回傳沒有 `agentStarted`）、`NOT_OWNER`（`--notify-id` 不是呼叫者自己）、`NOT_FOUND`、`TOO_MANY_WAITS`、`FORBIDDEN`、`ERROR`、`TIMEOUT`（BAT 沒有回應 invoke）。分頁已建立，所以這些情況一律 exit 0、不回 1（避免塔台以為派工失敗而重派，造成同一工單兩個 Worker，同 T0580 的理由）。
- 不帶 `--wait-started`：輸出與 exit code **完全不變**（不等待、沒有 `started:` 行）。既有 exit code `0` / `1` / `3` / `4` / `5` / `6` / `7` 語意不變；`8` 只在帶 `--wait-started` 時出現。
- **CT 判斷**：exit `0` + `started: <時間>` → 已啟動；exit `0` + `started: unknown` → 照舊處理（以 Worker 回報 / 其他信號判斷）；exit `8` → 分頁在、但沒有確認啟動，看分頁輸出（`bat_read_output`）或提醒使用者，**不要重派**；exit `1` → 依既有規則（派工失敗、用法錯誤）。
- **版本判定**：helper 不認得 `--wait-started`（T0600 前的 BAT）→ 既有的未知選項規則：exit `1`、stderr `Error: Unknown option '--wait-started'`、**不建立分頁** → CT 去掉該參數重派即可（等同「BAT 太舊」）。新 helper 對上不支援的 BAT（理論上只會在 helper 與 server 版本不一致時發生）→ `started: unknown` + `wait-started: UNSUPPORTED`、exit 0。`--help` 列有 `--wait-started` 即支援。
- 日誌（`bat-scripts.log`）：`bat-terminal` 的 `parsed` 多 `waitStartedMs`；`wait-started` 事件 `{ terminalId, waitStartedMs, result: 'started' | 'timeout' | 'exited' | <unknown CODE>, waitedMs, agentStartedAt?, state? }`；未確認時 `exit` 為 `{ code: 8, reason: 'launch-unconfirmed' }`。

### 狀態欄位：`terminal:get-state` / `terminal:list` / `terminal:wait`

- 每個 state 回傳（get-state、wait、list 的每一列）多 **`agentStarted: true | false | null`**；get-state / wait 在 `true` 時另回 **`agentStartedAt`**（ms epoch）。list 只有 `agentStarted`。
  - `true`：這個 PTY 的 claude 執行過 `SessionStart` hook，或（T0621）codex 送過第一個 OSC 7501。
  - `false`：`blockedDetection: hook`（BAT 注入了 hooks），還沒收到 `SessionStart`；或（T0621）`blockedDetection: osc`，還沒收到 OSC 7501（例如卡在「Trust this folder?」）。
  - `null`：`blockedDetection: none`，這個分頁無法判定（codex 低於 0.163.0 或版本確認不到、自訂 CLI、raw command、Settings「BAT MCP」關閉、自訂參數已含 `--settings`、找不到 `bat-hook.mjs`、claude 設定關閉 hooks…）。**不得**當成啟動失敗。
- `terminal:wait` 的 `until` 多 **`'agent-started'`**：`agentStarted` 不是 `false`（`true` 或 `null`）或 `state: 'exited'` 時成立；條件已成立即回、逾時 `changed: false`（既有規則）。範圍沿用 `authorizeHelperQueryTarget`（wait = `output` 存取：自己，或 tower 權杖查自己的 Worker）。
- 既有欄位不改名、不移除；舊值不變。T0600 前的 BAT 對 `until: 'agent-started'` 回 `INVALID_ARGS`（`until`）。
- MCP shim：`bat_get_state` / `bat_wait` 說明加 `agentStarted`；`bat_wait` 的 `until` enum 加 `agent-started`；摘要文字附 `, agent started` / `, agent not started yet`（`null` 不附）。

## hook

- `BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）多 `{ hookEvent: 'SessionStart', event: 'session-start', async: true }`，**沒有 matcher**（所有 `source`：`startup` / `resume` / `clear` / `compact` / `fork`）。注入條件與既有 hooks 相同（只對 claude-cli / claude-cli-worktree，`--settings=<dataDir>/bat-mcp/claude-settings.json`）。
- `async: true`：claude 不等它（不延遲啟動）。🔴 `SessionStart` 的 stdout 會被 claude 加進對話上下文，`scripts/bat-hook.mjs` 一律不輸出任何東西（T0590 規則）。
- `bat-hook.mjs session-start`：`hook_event_name` 不是 `SessionStart` → 不送；只送 `{ event: 'session-start' }`，**不送** `source`、`model`、`transcript_path` 或任何 payload 內容。**T0642（D167 改本契約）**：`session_id` 是 UUID 時另送 `sessionId`（`{ event: 'session-start', sessionId }`，不合格就不帶），供查詢欄位 `claudeSessionId`；handler 對不合格值忽略、不回錯誤，`agentStarted` 的判斷與回應不變（見 [claude-session-name.md](claude-session-name.md)「查詢欄位 R3」）。
- `terminal:report-hook` 對 `session-start` 回 `result: 'started'`（該 PTY 第一次）/ `'unchanged'`（之後）；它**不影響 `blocked`**（`isStartReportEvent`，`HOOK_EVENT_REASON` 不含它）。被接受的回報照舊把 `blockedDetection` 設為 `hook`。

## codex（OSC 7501，T0621，D158）

- **信號**：codex `>= 0.163.0` 在 TUI 就緒後約 0.5 s 送第一個 `ESC ] 7501 ; state=…`（任何值都算）→ `agentStarted: true`、`agentStartedAt` = BAT 收到的時間；卡在啟動前畫面（未信任的 git repo「Trust this folder?」、「Hooks need review」、可能的更新提示）或 codex 起不來時完全不送 → `false`，`--wait-started` 到期 exit 8 `started: unconfirmed`（分頁不關閉）。生命週期與 claude 相同（PTY 結束 / restart / recovery 清除，結束紀錄保留 `agentStartedAt`，只記每個 PTY 第一次）；BAT 重開時由 replay 補掃恢復（`true`，時間 = 掃描時間）。偵測與轉換見 [blocked-state.md](blocked-state.md)「codex（OSC 7501）」。helper 的輸出格式與 exit code 語意不變（`runWaitStarted` 未改）。
- **版本判定（C-5）**：唯一實作 `createCodexOscVersionCheck`（`electron/codex-osc-version.ts`，本機與 headless 共用、不 import electron），接在 `createAgentPromptCommandBuilder` 的 `codexWritesOsc` dep；只在 helper 派工（`terminal:create-agent-command`）且請求帶新分頁 id 時執行，使用者手動開的分頁不跑（觀察式即可）。
  - 解析的執行檔：啟動指令的第一個字。`codex` → 本程序 PATH 上第一個含 codex 的目錄（假設分頁 shell 的 PATH 與主行程相同）；Windows 上該目錄必須有 `codex.exe`，若第一個是 npm shim（`codex.cmd` / `.ps1` / `.bat`）→ 不經 shell 無法執行 → 判定不到。絕對路徑（自訂 CLI）照原樣（Windows 須為 `.exe`）；其他字 → 判定不到。
  - `execFile(<path>, ['--version'], { timeout: 5000, windowsHide: true })`（array args、不經 shell），解析 `codex-cli X.Y.Z`（stdout 或 stderr）；`>= 0.163.0`（0.163.0 的 pre-release 不算）→ 記 `osc`（在 BAT MCP 的啟動決策記 `none` **之後**），否則不記（維持 `none` → `started: unknown`，絕不回 `unconfirmed`）。
  - 快取：以「路徑 + 檔案 mtime」為鍵，只快取成功解析的版本（失敗 / 逾時下次再試；就地升級 mtime 變了會重新探測）。
  - 日誌：`[codex-version] path=<…> version=<x.y.z|unknown> (cached|probed)`；判定不到路徑時 `[codex-version] path=- version=unknown (<原因>)`。
- **`-c check_for_update_on_startup=false`（C-6）**：helper 派工的 codex 命令一律加在 BAT MCP 的 `-c` 之後、自訂參數之前（同一組裝點 `createAgentPromptCommandBuilder`；自訂參數可能含 `resume` 子命令），避免更新提示擋住 Worker；自訂參數已含 `check_for_update_on_startup` 時不加；使用者手動開的分頁（`agent:bat-mcp-launch-args`）不加。只在該次啟動覆寫、不寫入使用者的 `config.toml`。

## 狀態的生命週期（唯一實作 `TerminalBlockedTracker`，`electron/terminal-blocked-state.ts`）

- 以 PTY 為單位、只記第一次 `SessionStart` 的時間（`getStartedAt`）；之後的 `resume` / `clear` / `compact` 不改時間（T0642：但會以新的 sessionId 取代 `claudeSessionId`）。
- 比照 `blocked`：PTY 結束（exit / kill，所以 `pty:restart` 也清 → 新 shell 回 `false`）、Terminal Server recovery（`clearAll`，重建的 shell 沒有 claude）清除。**使用者輸入不清除**（與 `blocked` 不同：輸入不代表 claude 結束）。
- PTY 結束時時間寫進結束紀錄 `ExitedPtyRecord.agentStartedAt`（`PtyManager.recordExit`），所以 `exited` 的回傳仍有 `agentStarted` / `agentStartedAt`（結束前沒收到 → `false`；`none` → `null`）。
- PtyManager 接點：`getAgentStartedAt`（執行中才有值）、`recordExit` 一行、`clearActivity` 一行；recovery 沿用 T0590 的 `clearAll`。本機與 headless 共用（headless 也用 PtyManager）。

## claude 自己的設定關閉 hooks（`claudeHooksDisabledBy`）

- 啟動決策（`buildBatMcpLaunchArgs`）注入 hooks 後，讀 claude 的 managed 設定檔（claude 2.1.300：Windows `C:\Program Files\ClaudeCode\managed-settings.json`、macOS `/Library/Application Support/ClaudeCode/managed-settings.json`、Linux `/etc/claude-code/managed-settings.json`）與使用者設定檔（`$CLAUDE_CONFIG_DIR/settings.json`，否則 `~/.claude/settings.json`；headless 用 server 使用者的 home），依優先序（managed 先）：managed 有 `allowManagedHooksOnly: true`，或第一個設了 `disableAllHooks` 的檔案為 `true` → 結果帶 `hooksDisabled`，該分頁記為 **`blockedDetection: none`**（所以 `agentStarted: null`、helper `started: unknown`）。參數照樣注入（無害；若 hooks 其實會執行，第一個回報就把它改回 `hook`）。
- 日誌：`[bat-mcp] … hooks=yes (turned off: disableAllHooks in <file>)`。BAT 寫的 `claude-settings.json` 仍不含 `disableAllHooks`（🔴 T0590 規則：不得寫 `disableAllHooks: false` 反制）。
- 這改變了 T0590 的已知限制「`disableAllHooks` 時 `blockedDetection` 仍是 `hook`」：讀得到的兩層設定檔現在回 `none`。讀不到的層級見已知限制。
- host 可覆寫 `BatMcpHost.claudeSettingsFiles()`（測試一律給 `[]`，不讀本機真實設定）。

## 方案 B：`[agent-command] launch-suspect`（只記日誌）

- `PtyManager.writeDispatchCommand` 寫入派工指令後 `LAUNCH_SUSPECT_WINDOW_MS` = 10 s 內，該 PTY 的輸出（去掉 ANSI、保留最後 `LAUNCH_SUSPECT_MAX_CHARS` = 8 KiB 以處理跨 chunk）比對 `command not found` / `is not recognized as` / `CommandNotFoundException`（`LAUNCH_SUSPECT_PATTERNS`）；第一次命中記 `[agent-command] launch-suspect terminal=<id> pattern="<label>" after=<ms>ms` 後停止。唯一實作 `LaunchSuspectWatcher`（`electron/terminal-blocked-state.ts`）。
- 不改 exit code、不進 state、不記輸出內容。只有 helper 派工（`writeDispatchCommand`）會被觀察；誤判（例如 `--prompt` 文字本身含這些字）只影響日誌。

## 日誌

- `[agent-start] terminal=<id> → started (hook session-start)`（第一次；T0642 起帶 sessionId 時尾端多 ` session=<前 8 碼>`）；`report-hook` 的 `bat-scripts.log` 鏡像 `result: 'started'`。
- `[helper-query] channel=terminal:wait … → ok until=agent-started changed=<b> state=<s> agentStarted=<v>`。
- `[agent-command] launch-suspect …`（方案 B）。

## 實機查證（T0600，2026-10-18）

- 內嵌 claude 2.1.300（Windows，`@lydell/node-pty` 互動模式啟動，`--settings=<暫存檔>` 只含 async `SessionStart` hook、`--model claude-haiku-5-5`，**不送任何 prompt**）：啟動後 1.25 s hook 執行，stdin `hook_event_name: SessionStart`、`source: startup`；不耗 token。
- 系統 claude 2.1.302：二進位含同一個 `SessionStart` input 建構（`hook_event_name:"SessionStart",source:n`）與 `Fixed an async SessionStart hook's unchanged context …` 字串（async SessionStart 受支援）；2.1.300 二進位另有 `source` 列舉 `startup` / `resume` / `clear` / `compact` / `fork`。

## 已知限制

- 有信號的只有 claude-cli（hooks）與 codex `>= 0.163.0`（OSC 7501，T0621）；較舊或版本判定不到的 codex（例如 Windows 上 PATH 第一個是 npm shim `codex.cmd`）、自訂 CLI、raw command、Claude Agent SDK 面板一律 `null` / `unknown`（之後觀察到 OSC 7501 時才變 `true`）。
- codex：版本判定以主行程的 PATH 找執行檔，分頁 shell 的 profile 若改了 PATH 而跑到另一個 codex，判定可能與實際不符（較新的 PATH 版本判為舊 → 只是 `unknown`；舊的被判為新 → 可能 exit 8，CT 依契約不重派）；OSC 7501 未公開，codex 升版時必跑 `e2e/t0621-codex-osc-state.spec.ts`；遠端 Linux / macOS codex 未實測。
- 偵測不到的 hooks 關閉：專案設定（`<cwd>/.claude/settings[.local].json`；啟動決策時沒有 cwd）、MDM / registry / server-managed policy、`--setting-sources` 等。這些情況分頁記為 `hook`、`agentStarted` 永遠 `false`，`--wait-started` 會在期限到時 exit 8（分頁在，CT 依契約不重派）。
- 時間是 BAT 收到回報的時間，不是 claude 程序啟動時間（hook 約 60 ms）；`SessionStart` 在 claude 顯示介面、MCP 連線前後執行，不代表第一個 prompt 已送出或已開始處理。
- BAT 重開、Terminal Server 存活（T0108 replay）：重開前的 `agentStarted` 只在記憶體、已遺失，存活中的 claude 不會再執行 `startup` → 回 `false`（`blockedDetection` 由分頁還原時重新記錄）。headless server 重啟同理。`--wait-started` 只在派工當下使用，不受影響。
- 第一次 `SessionStart` 之後的 `/clear` 等不更新時間；結束再啟動 claude 但 PTY 未重開（同一 shell 內再打 `claude`）也不更新（以 PTY 為單位）。

## 驗證

- `electron/__tests__/terminal-blocked-state.test.ts`（T0600 段：tracker 第一次 `started` / 之後 `unchanged`、不動 `blocked`、日誌；PtyManager 需執行中、輸入不清、kill / exit / restart 清、結束紀錄保留時間、recovery 原始碼守護；query get-state / list / wait 的 `true` / `false` / `null`、`until: 'agent-started'` 回報即返回 / 已成立 / `none` 立即 / 結束 / 逾時、worker 對塔台 `NOT_OWNER`；真 RemoteServer + 範圍權杖 + 真 `bat-hook.mjs`：SessionStart → started、exit 0 無 stdout、不送 `source` 等內容、塔台 wait 返回、舊 BAT `INVALID_ARGS` 仍 exit 0；方案 B watcher 與 PtyManager）、`electron/__tests__/blocked-hooks-launch.test.ts`（`SessionStart` async 無 matcher、`claudeHooksDisabledBy` 優先序、`defaultClaudeSettingsFiles` 各平台、關閉時注入但記 `none` 與日誌、headless 用 `homeDir`）、`electron/__tests__/bat-terminal-wait-started.test.ts`（mock RemoteServer：不帶參數不變、started / unknown（`NO_SIGNAL` / `UNSUPPORTED` ×3 / `NOT_OWNER` / `FORBIDDEN`）/ 逾時 exit 8 / 分頁先結束 exit 8、分段等待不超過 `<ms>`、上限 120000、raw command、建立失敗不等待、用法錯誤不連線、`--help`）、`scripts/__tests__/bat-hook.test.mjs`、`scripts/__tests__/bat-mcp.test.mjs`、`electron/__tests__/terminal-query-handlers.test.ts`（list 列多 `agentStarted`）、`electron/remote/__tests__/headless-blocked-state-e2e.test.ts`（真 headless + 真 node-pty：PTY 內 SessionStart → `true`、client wait 返回、codex `null`、restart → `false`、kill 後結束紀錄保留）；e2e `e2e/t0600-launch-confirmation.spec.ts`（隔離實例，自訂 CLI 模擬 claude，不耗 token：`--wait-started` → `started: unknown` exit 0 立即返回、不帶參數輸出不變、Worker 的 SessionStart hook exit 0 無 stdout → 塔台 MCP `bat_get_state` / `bat_wait until=agent-started` / `bat_list_terminals` 的 `agentStarted`、`claude-settings.json` 的 `SessionStart`、debug log 與 `bat-scripts.log`；需先 `npx vite build`）、`e2e/t0590-blocked-state.spec.ts`（hooks 鍵多 `SessionStart`）。
- T0621（codex）：`electron/__tests__/codex-osc-state.test.ts`（版本判定：PATH 解析、Windows npm shim 判定不到、自訂 CLI、`execFile` 參數與 5 s timeout、`>= 0.163.0`、路徑 + mtime 快取、失敗不快取、`[codex-version]` 日誌、只用 `execFile` 的 source guard；派工：`osc` 在 MCP 決策之後記錄、舊版 / 無分頁 id / claude 不探測、`-c check_for_update_on_startup=false` 只給派工的 codex、自訂參數已有時不加、手動分頁的 `agent:bat-mcp-launch-args` 不加；query `agentStarted` false → true、`until: 'agent-started'`）、`src/lib/__tests__/codex-terminal-state.test.ts`（版本門檻）、既有派工命令測試的期望值（`agent-prompt-command` / `dispatch-shell-family` / `bat-mcp-launch` / `workspace-agent-launch-dispatch`）；e2e `e2e/t0621-codex-osc-state.spec.ts`（真 codex TUI + 本機假 Responses API，不呼叫模型：信任資料夾 → `started: <ISO>`、未信任 git repo → exit 8 `unconfirmed`、`[codex-version] … (probed)` / `(cached)`）。
