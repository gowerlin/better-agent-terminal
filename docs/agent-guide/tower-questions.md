# Worker 問塔台（PLAN-048 / T0607）

> CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節的完整內容。契約來源：T0606 回報區「介面契約草案」C-1–C-11（D156 全部採用推薦；CT-T019 依此撰寫，不得單方更改）。本檔目前寫主行程部分（C-1–C-4、C-7、C-9、C-10，T0607）；helper（C-5）與唯讀 MCP tool（C-6）見 T0608，收尾單補入。

- **用途**：yolo Worker 以結構化通道問塔台並等答覆，取代 CT v5.5.0「寫工單檔 → notify → 讀檔等待」（D155）。BAT 只提供通道與狀態；問題內容、何時問、怎麼記進工單都由 CT 決定。
- **唯一實作**：`electron/tower-questions.ts`（store + `registerTowerQuestionHandlers`，不 import electron），本機（`electron/main.ts` `registerProxiedHandlers`）與 headless（`createHeadlessTerminalQueryModule`，`electron/remote/headless-entry.ts`）各呼叫一次；只供 helper 經 RemoteServer 呼叫（`proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY）。狀態合成在 `terminal-query-handlers.ts` 的 `stateOf`（`getQuestionSummary` = store 的 `summaryFor`）。
- 🔴 **內容不落地（D155）**：問題、選項、`detail`、答案只存在主行程（本機 = Electron main；遠端 = headless bat-server）記憶體，**不寫入任何檔案**（含 `helper-capabilities.json`、window registry、settings）；收件時先以 `redactTerminalSecrets`（`src/lib/terminal-output-redaction.ts`，`knownSecrets` = RemoteServer token）遮罩才存，store 內沒有未遮罩的內容。`[tower-question]` 日誌與 bat-scripts.log 只記 id / 長度 / 數量 / 結果，**永遠不記內容與權杖**。工單裡的問答紀錄屬 CT，與 BAT 無關。
- 🔴 **BAT MCP 維持全唯讀**：寫入（ask / cancel / answer）只走 helper（T0608），MCP 只有 list / wait。

## 問題與 id（C-1）

- 問題由 Worker 分頁提出，目標固定是 Worker 權杖綁定的塔台（`towerId`），沒有目標參數。
- id `q-<boot>-<rand>`（regex `^q-[0-9a-f]{8}-[0-9a-f]{16}$`）：`<boot>` = 該 BAT 程序啟動時產生的 8 碼 hex（`registerTowerQuestionHandlers` 每個程序只跑一次），`<rand>` = `randomBytes(8)`。`<boot>` 與目前程序不同 → `lost`（BAT 重開 / headless server 重啟後舊問題已消失）；`<boot>` 相同但查不到 → `NOT_FOUND`（打錯，或已結束且超過保留期）。
- 狀態 `pending` → `answered` / `cancelled` / `expired`；`lost` 只出現在回傳。結束的問題保留 `QUESTION_ENDED_RETENTION_MS` = 10 min、最多 `QUESTION_ENDED_MAX` = 64 筆（超過丟最舊的），讓晚到的查詢得到正確狀態。
- `workorder` = Worker PTY 的 `PtyInstance.workorder`（沒有就省略）。

## 限制（C-2，常數，無 Settings 開關）

| 常數 | 值 | 說明 |
|---|---|---|
| `QUESTION_TEXT_MAX_CHARS` | 4 000 | `question`（必填、去空白後非空） |
| `QUESTION_DETAIL_MAX_CHARS` | 8 000 | `detail`（空字串 = 省略） |
| `QUESTION_OPTIONS_MAX` / `QUESTION_OPTION_MAX_CHARS` | 10 / 500 | `options`（每個非空） |
| `ANSWER_TEXT_MAX_CHARS` | 8 000 | `answer.text` |
| `QUESTION_MAX_PENDING_PER_WORKER` / `_PER_TOWER` | 8 / 64 | 超過 → `TOO_MANY_QUESTIONS` |
| `QUESTION_DEFAULT_EXPIRES_MS` / `QUESTION_MAX_EXPIRES_MS` | 1 800 000 / 7 200 000 | `expiresInMs` 1–7 200 000 的整數 |
| `QUESTION_POLL_LEASE_MS` | 120 000 | `blocking` 問題超過這麼久沒有提問的 Worker poll → `expired` / `not-polled` |
| `QUESTION_WAIT_MAX_MS` | 45 000 | `question:wait` `timeoutMs` 預設與上限（超過夾到 45 s） |
| `QUESTION_WAIT_MAX_PER_CALLER` | 8 | 與 `terminal:wait` 各自計數 → `TOO_MANY_WAITS` |

字數以 JS 字串長度計（UTF-16 code unit）。文字規則：`\r\n` → `\n`；`\n`、`\t` 以外的 C0 / DEL / C1 控制字元（含單獨的 `\r`、ESC）→ `INVALID_ARGS`；長度在遮罩前檢查。`masked` = 遮罩次數。

## channel 與權限（C-3）

| channel | 角色（`HELPER_CHANNEL_ROLES`） | `authorizeHelperInvoke` | handler 範圍 |
|---|---|---|---|
| `question:ask` | `worker` | `args[0]` 必須是物件（否則 `invalid-payload`） | 目標 = 呼叫者 `towerId`；塔台 PTY 不在執行 → `NOT_FOUND` |
| `question:cancel` | `worker` | 同上 | 只能取消自己的（`workerId` = 呼叫者），否則 `NOT_OWNER` |
| `question:answer` | `tower` | `opts.towerId === capability.terminalId`，否則 `tower-not-bound`（比照 `terminal:close-worker`） | 只能答送給自己的（`towerId` = 呼叫者），否則 `NOT_OWNER` |
| `question:list` | `tower`, `worker` | 放行 | worker：自己提出的（`terminalId` 只能是自己或綁定的塔台，結果一樣只有自己的）；tower：送給自己的（`terminalId` 須是自己、`isWorkerOf` 為真的 Worker（已結束者以結束紀錄判斷），或 store 裡曾問過它的 Worker，否則 `NOT_OWNER`） |
| `question:wait` | `tower`, `worker` | 放行 | worker：問題的 `workerId` = 自己；tower：問題的 `towerId` = 自己；否則 `NOT_OWNER` |

- 身分一律是權杖（`ctx.helper`），不接受參數宣告。server token client（`ctx.helper` 不存在）：list / wait 不限範圍（供日後 UI），寫入三個 channel 一律 `INVALID_ARGS`（比照 `terminal:report-hook`）。handler 對錯的角色也回 `INVALID_ARGS`（經 RemoteServer 時 `authorizeHelperInvoke` 已先擋為 `Forbidden: role-not-allowed`）。
- 回傳一律 `{ ok: true, … }` / `{ ok: false, code, message? }`；`code` = `INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `TOO_MANY_QUESTIONS` / `TOO_MANY_WAITS` / `CLOSED`。`message` 只寫欄位名或限制，不含內容。
- 舊 BAT 對新 channel 回 `Forbidden: channel-not-allowed`（helper 權杖）或 `No handler for channel`（helper 與 shim 都當 `UNSUPPORTED`，C-11）。

**`question:ask`** `{ question, options?, allowFreeText?, detail?, blocking?, expiresInMs? }`
- `options` 字串陣列（省略 / 空陣列 = 沒有選項）；`allowFreeText` 預設 `true`，沒有選項時不得為 `false`；`blocking` 預設 `true`。
- 回 `{ ok: true, questionId, status: 'pending', towerTerminalId, createdAt, expiresAt, masked }`；建立即視為一次 poll。

**`question:cancel`** `{ questionId }` → `{ ok: true, questionId, status, endReason? }`：`pending` → `cancelled` / `worker`；已結束的回現狀（不是錯誤）；`<boot>` 不符 → `{ ok: true, questionId, status: 'lost' }`（契約未明定，T0607 依「已結束的回現狀」處理，見工單回報區）。

**`question:answer`** `{ towerId, questionId, choice?, text? }`
- `choice` 1-based 整數、≤ `options.length`（沒有選項時不得帶）；問題 `allowFreeText: false` 時必填。`text` 空字串 = 沒帶；有 `choice` 時 `text` 可當理由；兩者至少一個。
- 第一個答覆生效：已結束 → `{ ok: false, code: 'CLOSED', status, endReason? }`（檢查順序：id 格式 → `lost` / `NOT_FOUND` → `NOT_OWNER` → `CLOSED` → choice / text 規則）。
- 成功 `{ ok: true, questionId, status: 'answered', answeredAt, masked }`；`<boot>` 不符 → `{ ok: false, code: 'NOT_FOUND', status: 'lost' }`。答案存成 `{ choice?, text }`（只有 `choice` 時 `text` 為 `''`）。
- BAT 不通知 Worker、不對 Worker 分頁寫入任何東西；Worker 自己在 `question:wait` 收到。

**`question:list`** `{ terminalId?, status?: 'pending' | 'all' }`（預設 `pending`）→ `{ ok: true, questions: [ { questionId, workerTerminalId, towerTerminalId, workorder?, question, options, allowFreeText, detail?, blocking, status, endReason?, createdAt, expiresAt, answer?, answeredAt? } ] }`，依 `createdAt` 排序；`all` 含保留期內已結束的。

**`question:wait`** `{ questionId, timeoutMs? }`
- 長輪詢到 `status !== 'pending'` 或逾時；答覆 / 取消 / PTY 結束立即喚醒，過期由每 250 ms 的檢查發現（`QUESTION_WAIT_POLL_MS`）。
- 回 `{ ok: true, questionId, changed, status, endReason?, answer?, answeredAt?, waitedMs }`；已結束即回 `changed: true`；`changed: false` + `status: 'pending'` = 逾時，再呼叫一次；`lost` 也是 `ok: true`、`changed: true`、`waitedMs: 0`。
- 租約：只有**提問的 Worker** 的 wait 算 poll（呼叫時更新 `lastPolledAt`，wait 開著的期間不會 `not-polled`，結束時再更新一次）；塔台的 wait 不延長租約。
- `dispose()`（server 停止 / app 結束）以 `changed: false` 結束所有 wait。

## 結束原因（C-4）

| 事件 | 結果 | 接點 |
|---|---|---|
| 塔台答覆 | `answered`（沒有 `endReason`） | `question:answer` |
| Worker `question:cancel` | `cancelled` / `worker` | handler |
| Worker PTY 結束（exit / kill，含 `pty:restart`） | 該 Worker 所有 pending → `cancelled` / `worker-exited` | `onPtyExit` → `terminalEnded`（本機 `createElectronPtyDeps`；headless `createHeadlessPtyModule` 的 `onPtyExit` → `createHeadlessHandlerModules` 轉給 query module） |
| 塔台 PTY 結束（含 `pty:restart`） | 送給它的所有 pending → `cancelled` / `tower-exited` | 同上 |
| Terminal Server recovery（Electron） | 全部 pending → `cancelled` / `recovery` | `PtyManagerDeps.onServerRecovery`（`handleServerDeath`，`blockedTracker.clearAll` 之後）→ `serverRecovered` |
| 超過 `expiresAt` | `expired` / `timeout` | 每次存取時檢查（無計時器） |
| `blocking` 問題超過租約沒有 poll | `expired` / `not-polled` | 同上 |
| BAT（Electron）重開 / headless server 重啟 | store 消失；舊 id 回 `lost` | — |
| 使用者在 Worker 分頁輸入 | **不影響**（D156 決定 3） | — |

過期與保留期在每次存取（任何 channel、`summaryFor`、wait 的檢查）時計算，所以 `[tower-question] end … expired` 的日誌時間是被看到的時間，不一定是到期的瞬間。

## 狀態：`blocked` / `tower`（C-7，擴充 T0590）

- Worker 有至少一個 `blocking: true` 的 `pending` 問題 → `terminal:get-state` / `list` / `wait` 回 `state: blocked`、`blockedReason: tower`、`blockedSince` = 最早那個的 `createdAt`、`source: 'question'`。
- 優先序 `exited` > hook 的 `blocked`（`permission` / `question` / `elicitation`）> `blocked` / `tower` > `working` / `idle`（hook reason 要使用者處理，塔台答不了）。
- 與 `blockedDetection` 無關：codex 分頁（`none`）也會回 `blocked` / `tower`。T0590「`none` 永遠不會 `blocked`」改為「`none` 永遠不會回 hook reason」。
- 清除：答覆、取消、過期、PTY 結束、recovery。使用者輸入不清除（hook reason 照舊會被輸入清除）。
- 每個 state 回傳（get-state / wait / list 每列，含 `exited`）多 `pendingQuestions`（該 Worker 的 pending 數，含非 blocking）；舊 BAT 沒有此欄位 ⇒ 版本判定之一（C-11）。
- `terminal:wait` 不新增 `until`：`state-change` 涵蓋進入 / 離開 `blocked`，`idle` 在 `blocked` 也成立。
- 型別：`BlockedReason = HookBlockedReason | 'tower'`（`electron/terminal-blocked-state.ts`；tracker 只用 `HookBlockedReason`）。`[blocked]` 日誌不記 tower 的進出。

## 日誌（C-9）

- `[tower-question] ask q=<id|-> worker=<id> tower=<id|-> workorder=<T####|-> len=<n|-> options=<n|-> blocking=<bool|-> expires=<ms|-> masked=<n|-> → ok|<code>[ (<欄位>)]`（失敗時未知欄位為 `-`；`len` 為遮罩前長度）
- `[tower-question] answer q=<id|-> by=<caller> len=<n> choice=<n|-> → ok|<code>`
- `[tower-question] cancel q=<id|-> by=<caller> → ok status=<s>|<code>`
- `[tower-question] end q=<id> → cancelled|expired (<endReason>)`
- `[tower-question] list caller=<id> target=<id|-> status=<pending|all> → ok count=<n>|<code>`
- `[tower-question] wait q=<id|-> caller=<id> → <status> changed=<bool> waited=<ms>|<code>`（每次呼叫一行）
- caller：helper = terminal id；server token = `client:<connectionId>`。bat-scripts.log 鏡像 `tower-question` 事件，欄位同上（`action` + 欄位 + `result`）。

## 遠端 headless（C-10）

- store 由 `createHeadlessTerminalQueryModule` 建立（與查詢 channel 同一個 module）；同一 server 上的塔台與 Worker 互問，channel 與權限同本機。PTY 結束由 `createHeadlessHandlerModules` 的 `ptyExitListeners` 轉給 store。headless server 重啟 → PTY 本來就全部結束，舊 id 回 `lost`。headless 沒有 Terminal Server recovery。

## helper 與 MCP（C-5 / C-6）

見 T0608（`bat-notify.mjs --ask / --wait-answer / --cancel-question`、`bat-terminal.mjs --answer`、MCP `bat_list_questions` / `bat_wait_question`），收尾單補入。🔴 問題 / 答案內容只從 stdin 傳入（bat-scripts.log 會記 argv）。

## 已知限制

- agent 自己的對話紀錄（例 claude 的 session jsonl、codex 的 session 檔）會含問題與答案，不在 BAT 控制內。
- 只存記憶體：BAT 重開、headless server 重啟、Terminal Server recovery 後問題消失（`lost` / `cancelled`），CT 改走工單檔往返（D155）。
- BAT 重開後 Terminal Server 還原的 Worker（T0108 replay）若沒有 `workorder`，問題的 `workorder` 會缺。
- 過期以存取時計算：沒有任何人查詢時，`expired` 的日誌會晚出現（狀態本身在被查到時一定正確）。

## 驗證清單

- `electron/__tests__/tower-questions.test.ts`（真 PtyManager + fake node-pty + 真權杖 registry，手動時鐘經 deps 注入、不用 vitest fake timers）：`authorizeHelperInvoke` 五列與 `tower-not-bound`；ask → list → answer → wait 全程；first answer wins / `CLOSED`；cancel；`lost` / `NOT_FOUND` / 格式錯誤；C-2 限制與文字規則、`\r\n` 正規化；`TOO_MANY_QUESTIONS`；塔台不在 → `NOT_FOUND`；收件即遮罩（known secret + `batcap.` 樣式，store 內查不到原值）；範圍（他塔 / 他 Worker `NOT_OWNER`、各角色 list、server token 只讀）；已結束 Worker 仍可 list；`timeout` / `not-polled`（非 blocking 不受租約、塔台 wait 不延長、Worker wait 維持租約）；Worker / 塔台 PTY 結束（exit / kill / restart）；recovery；保留期與上限；wait 逾時 / 喚醒 / `dispose` / `TOO_MANY_WAITS`；`stateOf`：`blocked` / `tower` JSON、`none` 也回、hook reason 優先、使用者輸入不清除、`pendingQuestions`、`terminal:wait state-change`；日誌與 mirror 不含內容與權杖；真 RemoteServer + 範圍權杖：Worker 權杖 ask → 塔台權杖 list / answer → Worker wait 收到、拒絕路徑（`role-not-allowed` / `tower-not-bound` / `NOT_OWNER` / server token 寫入）。
- `electron/remote/__tests__/headless-tower-questions-e2e.test.ts`（真 headless + 真 node-pty，driver 在 PTY 內以分頁自己的權杖執行）：Worker ask → 塔台 get-state `blocked` / `tower` → list → answer → Worker wait 收到；Worker answer → `Forbidden: role-not-allowed`；未派工的 shell list 他塔 Worker → `NOT_OWNER`；Worker shell 結束 → `cancelled` / `worker-exited`。
- 清單類守門：`helper-capability.test.ts`（19 個 channel）、`terminal-blocked-state.test.ts`（19 個、`pendingQuestions: 0`）、`terminal-query-handlers.test.ts`（list 列的 `pendingQuestions`）、`proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY。
- e2e（PLAN-048 C，A / B 合併後）：隔離實例兩個分頁扮演塔台 / Worker，經 helper 與 MCP 走完整流程、Worker 分頁關閉、BAT 重開後 `lost`。
