# Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）

> CLAUDE.md「Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）」節的完整內容。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結；改功能時兩邊一起更新。

- **用途**：Control Tower 以跨 session 訊息找 BAT 的塔台時，claude 的 ListAgents 只顯示「目錄名＋兩字元」（例 `better-agent-terminal-93`），分不出塔台與 Worker（PLAN-050）。BAT 在啟動 claude-cli 分頁時加 `claude --name=<名稱>`，ListAgents 直接顯示該名稱（T0640 實測：內嵌 2.1.300 / 系統 2.1.302，中文、`·`、空白都原樣顯示，上限 200 字元，重複時最後一個 `--name` 生效，同名可並存、只靠 `[ref]` 區分）。
- 本單（A）只做命名、注入、降級與記錄；查詢欄位（`terminal:whoami` / `list` / `get-state` 的 `claudeSessionName` / `claudeSessionId`）是 T0642（B，見下方「查詢欄位 R3」），「以塔台開啟 Claude」入口是 T0644（D），`scope: 'towers'` 是 T0643（C）。

## 名稱格式（T0640 契約 C-1）

唯一實作 `src/lib/claude-session-name.ts` `claudeSessionName(input)`（main / headless / renderer 共用，不 import electron / DOM）。

| 角色 | 輸入 | 名稱 | 誰用 |
|---|---|---|---|
| Worker | `{ role: 'worker', workspaceName, workorder }` | `<ws> · Worker · <T####>` | helper 派工（`--skill ct-exec|ct-done --workorder`） |
| Tower | `{ role: 'tower', workspaceName }` | `<ws> · Tower` | T0644（本單只有函式與測試） |
| 其他 claude-cli 分頁 | `{ role: 'tab', workspaceName, terminalId }` | `<ws> · <短 ID>` | UI 開的 claude-cli / claude-cli-worktree 分頁、helper `--prompt` 派工 |

- `<T####>`：符合 `WORKORDER_ID_PATTERN`（`^(?:[A-Z]{2,4}-)?T\d+$`，可帶 `CT-` 等前綴；本檔一份複本，`src/types/control-tower.ts` 那份會把 js-yaml 帶進 main bundle，兩者一致由單元測試斷言）。不符合 → `null`（不注入，`no-name`）。
- `<短 ID>`：terminal id 去掉 `-`、取前 6 碼、轉小寫（`claudeSessionShortId`）。
- `<ws>`：工作區 `alias || name`（空字串的 alias 視為沒有，與 `electron/dispatch-workspace.ts` 的 `nonEmpty(alias) ?? nonEmpty(name)` 一致）。清理（`cleanSessionWorkspaceName`）：
  1. 移除 C0 / C1 控制字元（U+0000–U+001F、U+007F–U+009F；含 tab / 換行 —— 直接移除，不換成空白）
  2. `"` 換成 `'`（**T0641 補的規則**：cmd 的雙引號引數內沒有 `"` 的跳脫方式，`quoteArgForShell` 的 `\"` 會讓 cmd 結束引號狀態，之後的 `&` 等字元會被 cmd 解讀；工作區名稱可能來自資料夾名）
  3. 連續空白（含全形空白、NBSP）壓成一個空格、trim
  4. 去掉開頭的 `/`（claude 對 `/` 開頭的名稱另有處理，CHANGELOG 2.1.239），再 trim
  5. 最多 60 個字元（code point），截斷後 trimEnd
  6. 清理後是空字串 → `BAT`
- 整個名稱 ≤ 200 個 UTF-16 單位（claude 上限；以 UTF-16 計 ≥ 以 code point 計，兩種量法都不超過）。超過時**只截 `<ws>`**（不切開 surrogate pair），角色 / `T####` / 短 ID 一定保留；連 `<ws>` 1 個字元都放不下（工單編號 > 180 碼）→ `null`。
- `normalizeClaudeSessionName(value)`：經 IPC 收到的名稱（renderer 算好的）在主行程再做同一套清理、截到 200；空 / 非字串 → `null`。`claudeSessionName` 的輸出經它不變。
- 名稱是 BAT 啟動時給的值，不是即時值：使用者之後在 claude 裡 `/rename`，BAT 不知道（T0640 風險 3）。也不是分頁標題（T0553 / T0562，那個使用者可以改）；claude 會以 OSC 0 設終端標題，BAT 沒有接 xterm 的 `onTitleChange`，分頁標題不受影響。

## 注入（C-2）

- 入口：`buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts`）的獨立一段，與 `mcp` / `hooks` 並列、各有原因。只對 `claude-cli` / `claude-cli-worktree`。
- `--name=<名稱>` 用 `=` 形式（T0640 e10 實測可用），`quoteArgForShell(…, shellFamily)`；放在 BAT 參數的最後（`--mcp-config=` / `--settings=` 之後）、自訂參數之前：`<base> [--mcp-config=…] [--settings=…] --name=… <自訂參數> [<prompt>]`。
- 🔴 **不受 Settings `batMcpEnabled` 影響、不看 RemoteServer 是否監聽、不加 Settings 開關**（D167）。BAT MCP 關閉時結果為 `{ injected: true, args: '--name=…', mcp: false, hooks: false, mcpReason / hooksReason: 'turned off in Settings' }`；`blockedDetection` 仍是 `none`（hooks 沒進去），與 T0590 / T0600 相同。
- 請求 / 結果：`BatMcpLaunchRequest` 多 `sessionName?`（**呼叫端算好的名稱**，main 再清理）與 `claudeNameSupport?`（版本檢查結果，見下）；`BatMcpLaunchResult`（claude）多 `name`（注入的名稱）或 `nameReason`。codex / 其他 agent 的結果沒有這兩個欄位。
  - 選「傳算好的名稱」而非「傳資料由 main 算」：renderer 才知道工作區名稱與分頁 id（`agent:bat-mcp-launch-args` 在 PTY 建立前呼叫），T0644 還要傳 Tower 角色；main 只做清理與長度上限。
- 兩個呼叫端（`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` source guard 不變）：
  - renderer：`WorkspaceView.tsx` `startClaudeCliPty`（新建 / 還原 / 預設 Agent 終端 / ⏻ 重啟的 claude-cli 都經這裡）以 `claudeSessionName({ role: 'tab', workspaceName: sessionWorkspaceNameRef.current, terminalId })` 算名稱，經 `withBatMcpLaunchArgs(…, terminalId, sessionName)` → `agent:bat-mcp-launch-args` 第 5 個參數。工作區名稱以 ref 在啟動當下讀（`startClaudeCliPty` 的 deps 不變，避免改到還原 effect）。
  - helper 派工：`terminal:create-agent-command` 把落點工作區名稱（`landing.workspaceName`，T0523：`--notify-id` 塔台所屬工作區優先）傳給 `createAgentPromptCommandBuilder`；有 `--skill` + `--workorder` → Worker 名稱，`--prompt` → `<ws> · <短 ID>`。
- **headless**（遠端 bat-server）：
  - 遠端視窗的 UI 分頁：renderer 送名稱（含工作區名稱）→ server 的 `agent:bat-mcp-launch-args` 決定、記錄，與本機相同。
  - helper 派工：server 沒有 window registry、不知道工作區名稱 → `<ws>` = `BAT`，Worker 為 `BAT · Worker · T####`（**選擇**：仍注入。R1 要的 `T####` 在，CT 以 `T####` 就分得出 Worker；不注入則 ListAgents 退回目錄名，更差）。
- 舊版相容：T0641 前的 server 收到第 5 個參數會忽略（不注入）；T0641 的 server 收到舊 renderer（沒有第 5 個參數）→ `no-name`。

## 降級（C-3）

| 情況 | `nameReason`（記錄的 `reason`） | 說明 |
|---|---|---|
| codex / gemini / 自訂 CLI | `not-claude-cli` | 只在記錄裡（結果沒有欄位）；raw command（`terminal:create-with-command`、CT 面板「執行工單 / 補結案」按鈕的 `pty.createWithCommand`）與 Claude Agent SDK 面板根本不經過啟動決策，沒有紀錄 |
| 自訂參數已命名 | `user-args` | `userArgsSetClaudeName`：`(^\|\s)(--name(\s\|=\|$)\|-[A-Za-z]*n)` —— `--name x` / `--name=x` / `-n x` / `-cn x`（短旗標群組含 `n`）/ `-nfoo`。claude 取最後一個 `--name`，使用者的本來就會生效；BAT 不加，避免記錄一個沒生效的名稱。誤判只會往「不注入」那邊偏（例如引號內的 `-n`） |
| 呼叫端沒送名稱 / 名稱清理後是空的 / Worker 工單編號不合法 | `no-name` | |
| system runtime 的 claude `< 2.1.76` | `claude-too-old` | 🔴 **絕不注入**：舊版遇到不認得的參數 `error: unknown option` exit 1，claude 起不來 |
| system runtime 讀不到版本 / runtime 解析失敗 / host 沒接版本檢查 | `version-unknown` | 🔴 同上，絕不注入 |

- 版本檢查唯一實作 `electron/claude-version-check.ts` `createClaudeNameSupportCheck`（比照 `createCodexOscVersionCheck`，不 import electron）：
  - runtime 由 `resolveClaudeRuntime(getRuntimeSettingsSnapshot())` 在啟動決策時再解析一次（與 `claude:get-cli-path` / `resolveClaudeBaseCommand` 同一個 router）。`embedded` 與 `system-fallback-to-embedded` → 直接注入、**不檢查**（內嵌固定 2.1.300 線）。
  - `system` → `execFile(<path>, ['--version'])`（array args、無 shell、timeout `CLAUDE_VERSION_TIMEOUT_MS` = 5 s、`windowsHide`），解析 `VERSION_REGEX`（`electron/claude-resolver.ts`），與 `CLAUDE_NAME_MIN_VERSION` = `2.1.76` 比較（`compareSemver`，忽略 prerelease）。依路徑 + mtime 快取，只快取解析成功的版本；讀不到 mtime 不快取。
  - 只在「可能注入」時才問（`needsClaudeNameSupport`：claude、有名稱、自訂參數沒命名）；codex 分頁、使用者自己命名時不跑。
  - 成本：system 模式下 router 本身每次都會 probe 一次（`detectSystemClaude`，既有行為），本檢查第一次多一次 `execFile`，之後命中快取。embedded 模式（預設）不多 spawn。
- `2.1.76 <= 版本 < 2.1.239`（Windows；macOS / Linux `< 2.1.224`）：照常注入（無害），但該版 ListAgents 沒有跨 session 訊息功能。

## 記錄（供 T0642 查詢）

- `electron/claude-session-name-record.ts` `ClaudeSessionNameRecords`，每個行程一份 `claudeSessionNameRecords`（Electron main、headless 各一份）。以 terminal id 為鍵、與 `PtyInstance` 分開（比照 `blockedDetection`：啟動決策在 PTY 建立前）。
- 紀錄 `{ name: string | null, reason?: <上表>, at: ms }`；由 `createBatMcpLaunchArgs` 在請求帶 `terminalId` 時寫入（`host.recordClaudeSessionName`）。同一 id 再次啟動（⏻ 重啟、還原）覆寫。上限 `CLAUDE_SESSION_NAME_RECORD_LIMIT` = 512 筆，超過丟最舊的；PTY 結束不清除（結束紀錄仍查得到名稱，T0642）。
- T0641 本身不新增查詢欄位；查詢欄位見下節（T0642）。

## 查詢欄位 R3（T0642，T0640 契約 C-4 / C-5 / C-8）

用途：塔台由 BAT 分頁對應到 ListAgents 上的 claude session（名稱）與 sessionId。

### 欄位（給 CT-T021）

`terminal:whoami`、`terminal:list` 每一列、`terminal:get-state` 多兩個欄位（**每個回傳都有這兩個鍵**；既有欄位與值域不變；`terminal:wait` 不加）：

| 欄位 | 型別 | 來源 | `null` 的意義 |
|---|---|---|---|
| `claudeSessionName` | `string \| null` | 該分頁**最後一次啟動決策**實際注入的 `--name` 值（上節的紀錄，`name`） | 沒注入：非 claude-cli（codex / 自訂 CLI / 一般 shell）、使用者自己命名、system claude 太舊或讀不到版本、舊版 renderer 沒送名稱 |
| `claudeSessionId` | `string \| null`（UUID） | 該 PTY 的 claude 最後一次 `SessionStart` hook 回報的 `session_id` | 還沒回報、`blockedDetection: none`（沒有 hooks）、hooks 被 claude 設定關閉、BAT 重開後沒有存檔（headless、Terminal Server 沒存活）。🔴 **`null` 不代表沒有 session** |

- 結束紀錄（`exited`，10 分鐘 / 32 筆）保留最後的兩個值（`ExitedPtyRecord.claudeSessionId`；名稱紀錄本來就不隨 PTY 清除）。
- 查詢範圍沿用 `authorizeHelperQueryTarget`，本單不放寬：tower 看得到自己與自己的 Worker；worker 看得到自己與綁定塔台的 metadata（含這兩欄）。跨工作區列 tower 是 T0643（`scope: 'towers'`）。
- MCP（`bat_whoami` / `bat_list_terminals` / `bat_get_state`）的 `structuredContent` 原樣帶兩欄，tool 說明各補一句；`bat_whoami` 的文字摘要多 `session="<名稱>"`。

### sessionId 的來源（改 T0600 hook 契約，D167）

- `scripts/bat-hook.mjs session-start`：只在 `hook_event_name` 是 `SessionStart`（或沒給）時讀 stdin 的 `session_id`，符合 UUID（`SESSION_ID_PATTERN`，大小寫皆可）才帶 `sessionId`；不合格就不帶（仍送 `{ event: 'session-start' }`）。🔴 其餘 T0590 / T0600 規則不變：一律 exit 0、stdout 不輸出、失敗靜默、總時限 1.8 s；除了 `session_id` 不送任何 payload（`source` / `transcript_path` / `cwd` / `model` 都不送）。
- `terminal:report-hook { event: 'session-start', sessionId?: string }`：handler 以 `CLAUDE_SESSION_ID_PATTERN`（`electron/terminal-blocked-state.ts`）再驗一次；不合格、非字串、或出現在其他 event → **忽略、不回錯誤**，`agentStarted` 照 T0600 處理。回應格式不變（`result: 'started'` / `'unchanged'`）。
- 舊 BAT（T0600 / T0641）只讀 `event` / `toolName`，多出的 `sessionId` 被忽略，hook 照樣 exit 0；更舊的 BAT（T0600 前）整個 event 回 `INVALID_ARGS`，hook 也 exit 0。

### 生命週期（唯一實作 `TerminalBlockedTracker`，與 `agentStarted` 同）

- 每一次 `SessionStart`（`startup` / `resume` / `clear` / `compact`）都以新值取代；`agentStartedAt` 仍只記第一次（T0600 契約不變）。e2e 實測 `/clear`（`source: clear`）換 sessionId、`agentStartedAt` 不變。
- PTY 結束（exit / kill，含 ⏻ 重啟）清除（結束紀錄保留）；Terminal Server recovery 全部清除（重建的 PTY 沒有 claude）；使用者輸入不清除。
- 名稱不隨 PTY 清除：它是「最後一次啟動決策注入的名稱」，不代表 claude 此刻還在執行（claude 結束、shell 還在時照樣回傳）。

### 持久化（C-8，只有 Electron）

- 唯一實作 `ClaudeSessionPersistence`（`electron/claude-session-name-record.ts`），比照 T0576 的 `helper-capabilities.json`：`<userData>/claude-sessions.json` = `{ version: 1, sessions: [{ terminalId, name, sessionId }] }`，只存**執行中** PTY 中兩值至少一個非 `null` 的；🔴 不含權杖。原子寫入（temp + rename），內容沒變不重寫。
- main.ts：whenReady 時與 helper capabilities 同時 `load`（PtyManager 建立前，`loadClaudeSessions`）→ 項目先列為 pending；Terminal Server 的 PTY list（`onSurvivingPtys`）`settle`：仍存活的 id 還原名稱（若之後已有新的啟動決策則不覆寫）與 sessionId（`PtyManager.restoreClaudeSessionId`，已回報新的則不覆寫），其餘丟棄；沒有存活的 Terminal Server（`startTerminalServer` 的 fork 前）全部丟棄。
- 寫入時機：啟動決策（`recordClaudeSessionName`）、sessionId 改變（`PtyManagerDeps.onClaudeSessionChange`）、PTY 結束（`onPtyExit`）、Terminal Server recovery（`onServerRecovery`）。
- 不經 renderer 的 `workspace:save`、不動 window registry。headless 不持久化（bat-server 重啟後兩值都是 `null`，已知限制）。
- 還原不包含 `agentStartedAt` / `blockedDetection` / tower 角色（各自的既有限制）：BAT 重開後分頁可能是 `claudeSessionId` 有值、`blockedDetection: none`、`agentStarted: null`（e2e 實測）。

## 日誌

- T0642：`[agent-start] terminal=<id> → started (hook session-start) session=<前 8 碼>`（第一次）/ `[agent-start] terminal=<id> session=<前 8 碼> (hook session-start)`（之後換了 sessionId）/ `… session=<前 8 碼> (restored)`；`[claude-session] loaded N entries from claude-sessions.json …` / `kept restored: terminal=<id> name session=<前 8 碼> (<原因>)` / `dropped restored: …` / 寫檔失敗 warn。`bat-scripts.log` 的 `report-hook`（hook 端與主行程鏡像）多 `session: <前 8 碼>`。🔴 任何日誌都不記完整 sessionId。
- `[bat-mcp] tab|dispatch agent=claude-cli terminal=<id> → injected: <args> …; hooks=…; name=yes` / `name=no (<reason>)`（claude 行才有 `name=`）。args 會含 `--name=<名稱>`（名稱是工作區名稱 + 角色 / 工單 / 短 ID，非機敏；不記其他資料）。
- `[claude-version] path=<…> version=<x.y.z|unknown> (cached|probed) → name=yes|no (<reason>)`（只在 system runtime 檢查時）；runtime 解析失敗 `path=- version=unknown (runtime: <訊息>) → name=no (version-unknown)`。

## 編碼實測（T0640 風險 1，T0641 e2e，2026-10-18）

`e2e/t0641-claude-session-name.spec.ts` 第 4 段：取 BAT 為各 shell family 實際組出的 `--name=` 字詞，打進該 shell 的分頁，前面接一支把 argv 寫成 UTF-8 JSON 的 node 腳本（名稱 `測試工作區 Bob's · Worker · T0641`，含 U+00B7、中文、撇號）：

| shell | BAT 打進去的字詞 | node 收到的 argv | 結果 |
|---|---|---|---|
| pwsh 7（預設 shell） | `'--name=測試工作區 Bob''s · Worker · T0641'` | `--name=測試工作區 Bob's · Worker · T0641` | ✅ 不變 |
| cmd（code page **950**，本機 `chcp` 實測） | `"--name=測試工作區 Bob's · Worker · T0641"` | 同上 | ✅ 不變 |
| Git Bash（`--login -i`） | `'--name=測試工作區 Bob'\''s · Worker · T0641'` | 同上 | ✅ 不變 |

⇒ 三種 shell 都保持原樣，**維持 ` · `（U+00B7）分隔字元與中文工作區名稱**，不改 ASCII 規則。另以 node-pty 經 pwsh 啟動內嵌 claude 2.1.300（同一字詞、不送 prompt）：`~/.claude/sessions/<pid>.json` 的 `name` 與 ListAgents 都是 `測試工作區 Bob's · Worker · T0641`（`nameSource: user`），結束後無殘留、未產生 transcript、模型呼叫 0 次。

## 已知限制

- system runtime 的使用者若 claude 版本 `< 2.1.76` 或讀不到版本，所有 claude-cli 分頁都沒有名稱（ListAgents 回到目錄名）。
- CT 面板的「執行工單 / 補結案」按鈕是 raw command（`claude "/ct-exec T####"`），不經啟動決策，**沒有名稱**（也沒有 BAT MCP / hooks，既有行為）；R1 只涵蓋 helper 派工。
- headless 派工沒有工作區名稱（`BAT · Worker · T####`）。
- 名稱只在啟動時決定：工作區改名、使用者 `/rename`、自訂參數之後加 `--resume` 都不會回寫 BAT 的紀錄；`--resume` / `--continue` 時 BAT 的 `--name` 會覆寫 transcript 裡的舊名稱（T0640 Q1-3）。
- 同一工作區的同名（兩個工作區同名、或 T0644 的兩個 Tower）在 ListAgents 只靠 `[ref]` 區分。
- 名稱紀錄與 sessionId 在 Electron 由 `claude-sessions.json` 跨 BAT 重開保留（T0642）；headless 不保留。
- `claudeSessionId` 只在 BAT 注入 hooks 的 claude-cli 分頁有值；手動在 shell 打 `claude`、hooks 被關閉、system claude 不跑 hook 時都是 `null`。claude 結束後回到 shell 的分頁仍回傳最後的 sessionId（沒有注入 `SessionEnd`）。

## 驗證清單

- 單元：`src/lib/__tests__/claude-session-name.test.ts`（三種角色、帶前綴工單與 `WORKORDER_ID_PATTERN` 一致、清理、60 / 200 截斷與 surrogate pair、`BAT`、`normalizeClaudeSessionName`）；`electron/__tests__/claude-version-check.test.ts`（embedded 不 probe、`execFile` 參數 / timeout、`2.1.75` / `2.1.76` 邊界、unknown 各情況、runtime 解析失敗、快取與 mtime）；`electron/__tests__/claude-session-name-launch.test.ts`（引號、順序、不受 `batMcpEnabled` / endpoint 影響、`user-args` 正反例、各 reason、codex 無欄位、紀錄與日誌、handler 第 5 參數與只在需要時問版本、派工 Worker 名稱 / `BAT` / prompt 派工、source guard、紀錄上限）；既有 `bat-mcp-launch.test.ts` / `blocked-hooks-launch.test.ts` 已更新 `nameReason` / `name=` 日誌。
- e2e：`e2e/t0641-claude-session-name.spec.ts`（隔離實例，claude 一律帶工作區自訂參數 `--version`，不開 TUI、不耗 token；需先 `npx vite build`）：還原的 claude-cli 分頁、helper 派工的 claude Worker、使用者 `--name` / codex、pwsh / cmd / Git Bash 編碼。
- T0642：`electron/__tests__/claude-session-query.test.ts`（UUID 樣式；tracker 第一次 / `/clear` 取代 / 不改 `agentStartedAt` / 日誌只有前 8 碼 / `onSessionChange` / `restoreSessionId` / 清除；PtyManager 需執行中、結束紀錄保留、restart 清除、restore；report-hook 合格記錄、不合格與其他 event 忽略不報錯、T0600 BAT 相容；三個查詢的注入 / 未注入 / codex / exited、範圍不變、`wait` 不加欄位；存檔格式、無權杖、損毀檔、無效項目、兩個 BAT 行程間的還原 / 丟棄 / 新值優先 / 結束移除、內容沒變不重寫；main.ts / headless source guard）、`electron/__tests__/terminal-blocked-state.test.ts`（真 RemoteServer + 真 `bat-hook.mjs`：帶 UUID、exit 0 無 stdout、`bat-scripts.log` 只有前 8 碼、`/clear` 取代、非 UUID 不送、T0600 / 更舊 BAT 仍 exit 0）、`scripts/__tests__/bat-hook.test.mjs`、`scripts/__tests__/bat-mcp.test.mjs`；既有 `terminal-query-handlers` / `codex-osc-state` / `tower-questions` 的完整回傳形狀補兩欄。e2e `e2e/t0642-claude-session-query.spec.ts`（隔離實例、不耗 token：塔台 MCP `bat_whoami` / `bat_get_state` / `bat_list_terminals` 拿到名稱與 sessionId、`/clear` 換 id、`claude-sessions.json`、日誌只有前 8 碼、保留 Terminal Server 重開 BAT 後還原；需先 `npx vite build`）。
- 改名稱格式時同步：本檔、CLAUDE.md 節、`claude-session-name.test.ts`；改注入條件時同步 `bat-mcp-shim.md` 的注入節。
