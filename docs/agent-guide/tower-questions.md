# Worker 問塔台（PLAN-048 / T0607）

> CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節的完整內容。契約來源：T0606 回報區「介面契約草案」C-1–C-11（D156 全部採用推薦；CT-T019 依此撰寫，不得單方更改）。主行程部分（C-1–C-4、C-7、C-9、C-10）為 T0607；helper（C-5）與唯讀 MCP tool（C-6）為 T0608；`--cancel-question` 對 `lost` 的處理與 e2e 為 T0611。

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

**`question:cancel`** `{ questionId }` → `{ ok: true, questionId, status, endReason? }`：`pending` → `cancelled` / `worker`；已結束的回現狀（不是錯誤）；`<boot>` 不符 → `{ ok: true, questionId, status: 'lost' }`（`lost` 視同已結束；T0611 塔台裁定以此為準，helper 依此對齊，見下「helper」節）。

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

## helper（T0608，契約 T0606 C-5）

共通：問題與答案只從 stdin 讀（UTF-8，上限 65 536 bytes；UTF-8 BOM 去掉；不是 UTF-8 → 拒絕，不轉成 U+FFFD）。stdin 是終端機（沒有重導）視為空；stdin 10 s 內沒有結束 → 錯誤（避免掛住）。理由：`bat-notify.mjs` / `bat-terminal.mjs` 啟動時把 argv 原樣寫進 `bat-scripts.log`（T0192），命令列也會出現在程序列表與 agent 的工具紀錄。Windows PowerShell 5.1 的管線預設不是 UTF-8，請用 pwsh 7 或 Git Bash heredoc。回應一律以 frame id 比對（BUG-114）。舊 host（`No handler for channel` / `Forbidden: channel-not-allowed`）→ `UNSUPPORTED`；其他 `Forbidden: …` → `FORBIDDEN`。每個非 0 結束在 stderr 印一行 `<mode>: <CODE>`（`ask` / `wait-answer` / `cancel-question` / `answer`）。

### Worker 提問 `bat-notify.mjs --ask`

```bash
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit | --no-pty-write] [--expires-min <1-120>] "T#### 提問" < question.json
```

- stdin JSON：`{ "question", "options"?, "allowFreeText"?, "detail"?, "blocking"?, "expiresInMs"? }`，只轉送這些鍵（其他鍵丟掉）；`--expires-min n` → `expiresInMs = n × 60 000`（優先於 JSON）。helper 只檢查「是物件、`question` 是非空字串」，其餘由 BAT 驗證（`INVALID_ARGS`）。
- 流程：`question:ask` → `terminal:notify`（T0613 起多帶選用欄位 `questionId`，只有 id、不含問題文字）→ `pty:write`（預填）→ `--submit` 時 `terminal:keypress`；`--no-pty-write` 時只有 `question:ask` → `terminal:notify`（T0716 列為契約，`--no-pty-write` 與 `--submit` 互斥 → `ask: USAGE`，旗標位置不影響）。任一步失敗（含逾時；`--ask` 下 `terminal:notify` 回 error 或 `false`（T0716）都算失敗，與一般 notify 只警告不同）→ `question:cancel { questionId }` → exit 1（stderr 倒數第二行 `ask: NOTIFY_STEP <notify|pty-write|keypress>`（T0716）、最後一行 `ask: NOTIFY_FAILED`；取消也失敗時印出到期時間）。
- 🔴 `--no-pty-write` 的保證（T0716，CT v5.15.0 的批次提問依賴：一批 N 題時前 N-1 題 `--ask --no-pty-write`、最後一題 `--submit`）：`terminal:notify`（`electron/handlers/terminal.ts`，本機與 headless 共用）只發 `terminal:notified`（renderer 只做 toast、縮圖 / 工作區徽章、Worker 分頁標記），**不寫任何 PTY、不切換分頁或焦點、不觸發 agent 回合**。`notified: yes` 表示 BAT 已接受通知，不表示有視窗顯示（headless 沒有 client 時也回 yes）。守門：`electron/__tests__/terminal-handlers.test.ts`（handler 不碰 PtyManager）、`scripts/__tests__/bat-notify-questions.test.mjs`（channel 恰好兩個、stdout 與 `--submit` 相同）。
- `ask: NOTIFY_STEP`（T0716，C-5 的向後相容擴充：只多一行，既有行與 exit code 不變）：`notify` / `pty-write` → Tower 沒收到預填（`pty-write` 時 toast 已顯示）；`keypress` → toast 與預填已到塔台、Enter 沒送出，預填留在塔台輸入框（逾時時 Enter 可能其實已送達），stderr 照實說明，不再說 Tower 沒收到通知。BAT 不清除預填（D190）。
- stdout（成功）：

  ```text
  ✓ Notified 5f679fbf…: T0608 提問
    question: q-0123abcd-0123456789abcdef
    expires: 2026-10-18T05:30:00.000Z
    notified: yes
  ```

- exit：`0` / `3` NOT_FOUND / `10` TOO_MANY_QUESTIONS / `1`（`USAGE`、`INVALID_INPUT`、`NOT_IN_BAT`、`CONNECT_FAILED`、`AUTH_FAILED`、`TIMEOUT`、`UNSUPPORTED`、`FORBIDDEN`、`INVALID_ARGS`、`NOTIFY_FAILED`）。
- 已知限制：`question:ask` 逾時（3 s 沒有回應）時 helper 不知道 id、無法取消；BAT 若已登記，該題由租約（blocking 120 s）或 `expiresAt` 結束。
- 徽章：結構化問題的 `?` 來自主行程的 `terminal:attention-changed`，與訊息文字無關（T0609、`e2e/t0611-tower-question.spec.ts` 以不以 `提問` 結尾的訊息驗證）。
- `--ask` 的通知不算回報（T0613 / BUG-154）：通知帶 `questionId` → 主行程 `terminal:notify` handler（`electron/handlers/terminal.ts`，本機與 headless 共用）只在符合 `QUESTION_ID_PATTERN` 時轉送到 `terminal:notified` → renderer `markWorkerReported`（`workerNotifyKind` = `ask`）移除該分頁的 `workerReport` 與 `workerQuestion`、不記新值。所以問題 pending 時是 `?`，問題結束（answered / cancelled / expired / lost）後**無標示**、不計入批次關閉，直到 Worker 下一次一般通知才是 `✓`；提問前已是 `✓` 也一樣回到無標示（提問代表 Worker 仍在工作）。修正前 renderer 只看訊息：不以 `提問` 結尾 → `workerReport`，答覆後殘留 `✓` 並被算進 N（T0612 實測）；以 `提問` 結尾 → `workerQuestion`，答覆後殘留 `?`。
  - 相容：舊 helper（不帶 `questionId`）/ 舊遠端 server bundle → 照訊息判斷（修正前的行為）；新 helper 對舊 BAT → 舊 handler 忽略多出的欄位。不帶 `--ask` 的舊 CT `T#### 提問` 不變（`workerQuestion`，`?` 維持到下一次通知）。遠端視窗：事件經 `PROXIED_EVENTS` 原樣轉送，判斷同在 renderer。

### Worker 等答覆 `--wait-answer`（備援；主路徑 MCP `bat_wait_question`）

```bash
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --wait-answer <questionId> [--timeout-ms <0-45000>]
```

- `--timeout-ms` 超過 45 000 截成 45 000（stderr 一行說明）；不帶 = 不送，BAT 預設 45 s。invoke 逾時 = 等待時間 + 5 s。
- stdout 只有一行 JSON（`question:wait` 回傳去掉 `ok`），例：`{"questionId":"q-…","changed":true,"status":"answered","answer":{"choice":1,"text":"…"},"answeredAt":…,"waitedMs":1200}`；`{"changed":false,"status":"pending",…}` = 逾時，再呼叫。
- exit：`0`（任何狀態，含 `pending`、`lost`）/ `3` NOT_FOUND / `4` NOT_OWNER / `1`（含 `TOO_MANY_WAITS`、連線失敗、`UNSUPPORTED`）。日誌只記狀態、choice 與答覆長度。

### Worker 取消 `--cancel-question <id>`

```bash
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --cancel-question <questionId>
```

- 送 `question:cancel { questionId }`。stdout `✓ Question cancelled: <id>` 或 `✓ Question already ended: <id>`，接著 `  status: <status>[ <endReason>]`。
- exit：`0`（含已結束與 `lost`）/ `3` NOT_FOUND / `4` NOT_OWNER / `1`（`USAGE`、`INVALID_ARGS`、`FORBIDDEN`、`UNSUPPORTED`、連線失敗）。
- 🔴 **exit 0 不代表本次取消成功**，看 `status:` 行：`cancelled worker` 才是取消了（同一題重複取消也是這行）；`answered` / `expired …` / `cancelled worker-exited` 等是之前就結束了；`lost` = BAT 已重開，問題已消失（stderr 空）。
- T0611 塔台裁定（契約 C-3 為準）：主行程對 `lost` 回 `{ ok: true, status: 'lost' }`，所以 helper 走「已結束」分支、exit 0。T0608 原本的 `NOT_FOUND` + `status: lost` → exit 3 / `cancel-question: LOST` 分支在真主行程下不會走到，已刪除（`--answer` 對 `lost` 仍是 exit 3 / `answer: LOST`，主行程對 answer 回 `NOT_FOUND` + `status: lost`）。

修正前後（`lost` 的 id）：

| | exit | stdout | stderr |
|---|---|---|---|
| T0608 helper 文件與測試（假 server 回 `NOT_FOUND` + `lost`） | 3 | — | `Error: Question not cancelled (LOST): …` / `cancel-question: LOST` |
| 真主行程（T0610 實測；T0611 起 helper、測試、文件一致） | 0 | `✓ Question already ended: <id>` / `  status: lost` | 空 |

### 塔台答覆 `bat-terminal.mjs --answer`

```bash
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --answer <questionId> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt
```

- 送 `question:answer { towerId: --notify-id, questionId, choice?, text? }`；stdin 去掉結尾換行，空白 = 不送 `text`（此時必須有 `--choice`，否則 `answer: USAGE`）。不能與其他模式或建立分頁的參數並用。
- stdout：`✓ Question answered: <id>` + `  answered: <id>`；`CLOSED` 時 `  status: <answered|cancelled|expired> [<endReason>]`。
- exit：`0` / `3` NOT_FOUND（`lost` → stderr `answer: LOST`）/ `4` NOT_OWNER / `9` CLOSED / `1`（`USAGE`、`INVALID_INPUT`、`INVALID_ARGS`、`FORBIDDEN`（例 `tower-not-bound`：`--notify-id` 不是自己）、`UNSUPPORTED`、連線失敗）。
- BAT 不對 Worker 分頁寫任何東西；Worker 以 `bat_wait_question` / `--wait-answer` 收到。

## 唯讀 MCP tool（T0608，契約 T0606 C-6）

| tool | channel | 參數 | invoke 逾時 |
|---|---|---|---|
| `bat_list_questions` | `question:list` | `terminalId?`、`status?: pending\|all` | 3 s |
| `bat_wait_question` | `question:wait` | `questionId`（必填）、`timeoutMs?`（≤ 45 000） | 55 s（`idempotentHint: false`） |

- 全部 `readOnlyHint: true`；寫入沒有 MCP tool。`instructions`：「Read-only queries about BAT terminals and tower questions: …」。舊 BAT → `UNSUPPORTED`（同一 shim 程序內記住，不再送）。
- 摘要：`N pending questions: <id> (T####, <前 60 字>)`（`status: all` 且有已結束者 → `N questions: <id> (T####, <status>, <前 60 字>)`）；`status=<s>[ (<endReason>)] after <ms> ms`，`answered` 另起行附 `choice: <n>` 與答覆全文，`pending` 逾時附 `(timed out; call again)`。`structuredContent` 是 channel 回傳去掉 `ok`（含全文）。
- 稽核：每次 tools/call 一行（tool / ok / code / 耗時），不記問題、答案、問題 id。完整 shim 說明見 [bat-mcp-shim.md](bat-mcp-shim.md)。

## 已知限制

- agent 自己的對話紀錄（例 claude 的 session jsonl、codex 的 session 檔）會含問題與答案，不在 BAT 控制內。
- 只存記憶體：BAT 重開、headless server 重啟、Terminal Server recovery 後問題消失（`lost` / `cancelled`），CT 改走工單檔往返（D155）。
- BAT 重開後 Terminal Server 還原的 Worker（T0108 replay）若沒有 `workorder`，問題的 `workorder` 會缺。
- 過期以存取時計算：沒有任何人查詢時，`expired` 的日誌會晚出現（狀態本身在被查到時一定正確）。

## 驗證清單

- `electron/__tests__/tower-questions.test.ts`（真 PtyManager + fake node-pty + 真權杖 registry，手動時鐘經 deps 注入、不用 vitest fake timers）：`authorizeHelperInvoke` 五列與 `tower-not-bound`；ask → list → answer → wait 全程；first answer wins / `CLOSED`；cancel；`lost` / `NOT_FOUND` / 格式錯誤；C-2 限制與文字規則、`\r\n` 正規化；`TOO_MANY_QUESTIONS`；塔台不在 → `NOT_FOUND`；收件即遮罩（known secret + `batcap.` 樣式，store 內查不到原值）；範圍（他塔 / 他 Worker `NOT_OWNER`、各角色 list、server token 只讀）；已結束 Worker 仍可 list；`timeout` / `not-polled`（非 blocking 不受租約、塔台 wait 不延長、Worker wait 維持租約）；Worker / 塔台 PTY 結束（exit / kill / restart）；recovery；保留期與上限；wait 逾時 / 喚醒 / `dispose` / `TOO_MANY_WAITS`；`stateOf`：`blocked` / `tower` JSON、`none` 也回、hook reason 優先、使用者輸入不清除、`pendingQuestions`、`terminal:wait state-change`；日誌與 mirror 不含內容與權杖；真 RemoteServer + 範圍權杖：Worker 權杖 ask → 塔台權杖 list / answer → Worker wait 收到、拒絕路徑（`role-not-allowed` / `tower-not-bound` / `NOT_OWNER` / server token 寫入）。
- `electron/remote/__tests__/headless-tower-questions-e2e.test.ts`（真 headless + 真 node-pty，driver 在 PTY 內以分頁自己的權杖執行）：Worker ask → 塔台 get-state `blocked` / `tower` → list → answer → Worker wait 收到；Worker answer → `Forbidden: role-not-allowed`；未派工的 shell list 他塔 Worker → `NOT_OWNER`；Worker shell 結束 → `cancelled` / `worker-exited`。
- 清單類守門：`helper-capability.test.ts`（19 個 channel）、`terminal-blocked-state.test.ts`（19 個、`pendingQuestions: 0`）、`terminal-query-handlers.test.ts`（list 列的 `pendingQuestions`）、`proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY。
- helper / MCP（T0608）：`scripts/__tests__/bat-notify-questions.test.mjs`、`scripts/__tests__/bat-terminal-answer.test.mjs`（假 RemoteServer `_question-mock-remote.mjs`，持續廣播 + 錯 id 的回應，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指 temp；`--cancel-question` 的 `lost` 用真主行程的回傳形狀 `{ ok: true, status: 'lost' }`，T0611）、`scripts/__tests__/bat-mcp.test.mjs`（八個 tool、全唯讀、沒有寫入 channel、摘要、instructions）。
- e2e `e2e/t0611-tower-question.spec.ts`（T0611；隔離實例，需先 `npx vite build`；塔台是 shell 分頁、Worker 是自訂 CLI，兩者都在分頁內以 node runner 用自己的權杖執行 helper 與 `bat-mcp.mjs` stdio，不啟動 claude / codex；約 35 s）：
  1. Worker `bat-notify --ask`（stdin JSON，`detail` 含 `batcap.` 樣式字串）→ 塔台 MCP `bat_list_questions` 看到題目、選項、`detail` 已遮罩（`[REDACTED:batcap]`）；`bat_get_state` Worker = `blocked` / `tower` / `source: question` / `pendingQuestions: 1`；Worker 縮圖 `.worker-badge` = `?`、`data-attention="question"`，塔台「關閉已回報的 Worker 分頁（N）」N = 0（通知訊息刻意不以 `提問` 結尾：T0613 前單靠它會是 ✓，所以 `?` 與 N = 0 只來自結構化問題）。
  2. Worker MCP `bat_wait_question` 先等（2 s 內不返回）→ 塔台 `bat-terminal --answer --choice 1`（stdin）→ Worker 收到 `answered` / choice / 全文、`waitedMs` > 1 s；Worker `bat_get_state` 不是 `blocked`、`pendingQuestions: 0`；縮圖**無標示**（沒有 `data-attention`）、N = 0（T0613 / BUG-154）；Worker 再送一般通知 `T0611 完成` → `✓`、N = 1。
  3. 第二題（`T0611 提問`）→ 塔台 `--close-worker` → `bat_list_questions status=all` = 第一題 `answered`、第二題 `cancelled` / `worker-exited`。
  4. 第二個 Worker 提問 → BAT 結束並保留 Terminal Server → 重開、選「保留」：Worker `--cancel-question` exit 0、stdout `✓ Question already ended` + `  status: lost`、stderr 空；`--wait-answer` 與 MCP `bat_wait_question` 回 `lost`；`bat_get_state` `pendingQuestions: 0`；塔台 `--answer` exit 3 `answer: LOST`；`bat_list_questions status=all` 為空。
  5. 兩次啟動的 debug 日誌與 `bat-scripts.log` 都不含問題、選項、`detail`、答案文字與假權杖；debug 日誌有 `[attention] … → blocked reason=tower pendingQuestions=1` / `→ none` 與 `[tower-question] answer q=<id>`。
- 回歸：`e2e/t0609-worker-attention-badge.spec.ts`（舊 CT `提問` 的 `?`、⚠️、✓ 與批次關閉）、`e2e/t0584-bat-mcp-shim.spec.ts`（`tools/list` 八個）。
- 實機（CT v5.7.0 × 安裝版 0.7.0-pre.8，2026-10-18）：
  - claude（T0614，ct-exec v5.7.0 yolo Worker）：題目先寫進工單並 commit，再 `bat-notify.mjs --ask --source T0614 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0614 提問"`（題目 JSON 從 stdin 檔案重導入）→ exit 0、stdout 有 `question:` id 與 `notified: yes`；等答覆用 MCP `bat_wait_question`（`timeoutMs` 45000），第 1 次呼叫即回 `answered`、`choice: 1`（`waitedMs` ≈ 13 s）；工單內沒有塔台答覆行。
  - codex（T0615，ct-exec v5.7.0 yolo Worker）：題目先寫入工單並提交（`4bdf08125d50c81811f88444cb6fa53bcbe54ff2`，含 `tower_question: open`），再於 2026-10-18 11:06（+08:00）執行 `bat-notify.mjs --ask --source T0615 --target "$BAT_TOWER_TERMINAL_ID" --submit --expires-min 30 "T0615 提問"`（題目 JSON 從系統暫存檔 stdin 重導入）→ exit 0、`question: q-4b13b4f7-2cbec99d3b312d8d`、`notified: yes`；JSON 的 `question` 以 `Q-1：` 開頭、2 個選項、`blocking: true`。`worker_question_timeout: 30` 直接取自工單 frontmatter。MCP `bat_wait_question` 第 1 次呼叫（timeout 45000 ms）即回 `answered`、`choice: 1`、`waitedMs: 3307`；工單內沒有塔台答覆行。依工單要求停留 60 秒（約 11:06:14–11:07:14 +08:00）後進行 Step 3。`codex --version` = `codex-cli 0.163.0`；BAT MCP `bat_whoami` 回報 `role=worker`、`workorder=T0615`、`yolo=true`，回應未提供 `agent` 欄位。
