---
schema_version: 1
schema_kind: workorder
id: T0582
title: "PLAN-047 M1-1：helper 唯讀查詢 channel（whoami / list / get-state / read-output / wait）+ shell 範圍 + 輸出遮罩，本機與 headless 共用"
type: feature
status: DONE
started_at: "2026-10-17T21:54:38+08:00"
updated_at: "2026-10-17T22:21:21+08:00"
completed_at: "2026-10-17T22:19:08+08:00"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-17T21:52:34+0800"
target_version: "0.7.0-pre.2（候選，與 T0583 / T0584 / T0585 同批再定）"
depends_on: []
related:
  - "PLAN-047（§一.3 Tool 對照、研究結論 R4）、T0574 回報區 R4「建議新增的唯讀 channel」表與 Q3 / Q5 建議答案"
  - "D149 / D152；T0575 / T0579（`HELPER_CHANNEL_ROLES` 本機與 headless 共用）、T0566（`plainTextFromOutput`）、T0565（`getTerminalRole` / `isYoloTerminal`）、T0536（`isWorkerOf`）"
  - "並行工單 T0583（W1-1）：同樣會改 `electron/remote/helper-capability.ts` 與 `CLAUDE.md`"
affects_files:
  - electron/remote/helper-capability.ts
  - "electron/terminal-query-handlers.ts（新，名稱可自訂；本機與 headless 共用的 handler 註冊）"
  - "electron/pty-manager.ts（必要的唯讀 accessor）"
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "src/lib/（遮罩等純函式，可新檔）"
  - "electron/__tests__/**、electron/remote/__tests__/**（新增 / 修改，含 `proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0582-mcp-readonly-query-channels.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0583 同時在改 `electron/remote/helper-capability.ts`（它只動 `create-*` 參數驗證 / `customEnv` 相關）與 `CLAUDE.md`（它新增 worktree 小節）。你只動 `HELPER_CHANNEL_ROLES` 與新增的範圍判定函式；CLAUDE.md 只新增你自己的小節。commit 前 `git diff -- <檔>` 確認只含你的 hunk；若檔案已有對方未 commit 的變更，用 `git add -p` 只 stage 自己的 hunk 再 commit，不得夾帶。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 一律隔離實例（需先 `npx vite build`），teardown 以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData。"
  - "🔴 本單只做唯讀查詢。不做 MCP shim（T0584）、不做 blocked 偵測 / `terminal:report-hook`（M1b）、不做 `worktree:terminal-status`（T0585）；權杖值不得出現在日誌、回報、測試快照。"
---

# T0582 — helper 唯讀查詢 channel（M1-1）

## 背景

PLAN-047 路線 [A]（D149）：MCP 建在 A1 / A2 的範圍權杖上，傳輸用 stdio shim 連既有 RemoteServer（T0584）。shim 只是轉接，能力本身是 RemoteServer 上的 helper channel。T0574 R4 建議新增一組唯讀 channel；本單實作其中不依賴 blocked 偵測與 worktree 的五個，本機與 headless 共用同一份 handler 與角色表（比照 T0579）。

## 介面契約（本單定稿，T0584 shim 與 CT 依此撰寫；實作若需調整，回報區寫明差異與理由）

所有 channel 只接受 helper 權杖（`batcap.`）連線呼叫，handler 以**呼叫者權杖綁定的 terminal id** 為身分，不接受參數宣告身分。server token（全權）連線照現行規則可呼叫（測試 / 舊相容），範圍不受限。

**範圍（scope）判定**——唯一實作一個函式，五個 channel 共用：

| 呼叫者 | 可查詢的目標 |
|---|---|
| 任何權杖 | 自己 |
| tower 權杖 | 自己 + `isWorkerOf(目標, 自己)` 成立的 Worker |
| tower 權杖且 `getTerminalRole(自己) === 'tower'`（已 `--set-role tower`） | 上一列 + `terminal:list` 可列出**同工作區**的其他分頁（只列 metadata，不給輸出） |
| worker 權杖 | 自己 + 綁定的塔台（`whoami` / `list` / `get-state` 可；`read-output` / `wait` 只能自己） |

- 「tower 權杖但未宣告」= 提案的 `shell` 角色（Q3）：本機一般分頁沒有 towerId 會拿到 tower 權杖，但讀取範圍只有自己與自己派出的 Worker。
- 範圍外 → `{ ok:false, code:'NOT_OWNER' }`；目標不存在 → `NOT_FOUND`；參數不合 → `INVALID_ARGS`。（錯誤碼與 `--close-worker` 一致）

**channel**（`registerHandler`，回傳一律 `{ ok:true, ... }` / `{ ok:false, code, message? }`）：

| channel | 參數 | 回傳重點 |
|---|---|---|
| `terminal:whoami` | 無 | `terminalId`、`workspaceId`、`role`（`tower` / `worker` / `shell`，依上表）、`towerTerminalId?`、`workorder?`、`yolo`（`isYoloTerminal`）、`towerMode?`、`agent?`（agentPreset）、`cwd?` |
| `terminal:list` | `{ scope?: 'mine' \| 'workspace' }`（預設 `mine` = 自己 + 自己的 Worker / 綁定塔台；`workspace` 需已宣告塔台） | 陣列：`id`、`role`、`workorder?`、`towerTerminalId?`、`title?`（本機取 window registry 已存標題；headless 無）、`state`（同 get-state 的 `state`）、`alive` |
| `terminal:get-state` | `{ terminalId?: string }`（預設自己） | `state`：`working`（最近 `IDLE_MS` 內有輸出）/ `idle` / `exited`；`lastOutputAt`、`idleMs`、`exitCode?`；`source: 'output'`。`blocked` 列為保留值（M1b），本單不產生 |
| `terminal:read-output` | `{ terminalId?, cursor?: string, maxLines?: number }` | 去 ANSI 文字（沿用 `plainTextFromOutput`，T0566），`lines`、`nextCursor`（之後再讀只拿新行；舊 cursor 已被 buffer 捲掉時回 `truncated: true` 與目前可得的起點）、`masked: number`（遮罩次數）。`maxLines` 預設 200、上限 1000 |
| `terminal:wait` | `{ terminalId?, until: 'state-change' \| 'exit' \| 'idle', fromState?, timeoutMs? }` | server 端長輪詢，`timeoutMs` 預設 / 上限 **45000**（helper invoke 逾時需同步放寬，見任務 4）；回 `{ ok:true, changed: boolean, state, ... }`，逾時 `changed:false`（不是錯誤） |

- `IDLE_MS`：沿用既有「安靜」常數語意（close-worker 的 5 s），不新增可設定值；回報區寫明採用的常數。
- **遮罩**（Q5，唯一實作一個純函式，`read-output` 必經）：`batcap.` 權杖、server token 樣式、`sk-` / `ghp_` / `github_pat_` / `AKIA` 類 token、`Authorization:` / `Bearer ` 之後的值、PEM 區塊（`-----BEGIN … PRIVATE KEY-----` 到 END）→ 以 `[REDACTED:<kind>]` 取代。只遮罩、不拒絕。
- **稽核**：每次呼叫主行程記一行 `[helper-query] channel=… caller=<id> target=<id> → ok|<code>`（不記輸出內容），並以既有 `mirrorToBatScripts` 寫一筆 `bat-scripts.log` 事件（headless 寫 server 的 `Logs/bat-scripts.log`，比照現有 helper 事件）。

## 任務

1. 角色表：在 `HELPER_CHANNEL_ROLES` 加五個 channel（tower / worker 皆可呼叫，範圍由 handler 判定）；範圍判定函式放在 `helper-capability.ts` 或新檔，本機 `RemoteServer` 與 headless 共用。
2. handler：新模組註冊五個 channel，`main.ts` 與 `headless-entry.ts` 各自接線（資料來源：`PtyManager` 的 instances / `getLastOutputAt` / replay buffer / exit 記錄、`getTerminalRole`、`isYoloTerminal`、`PtyInstance.workorder` / `customEnv.BAT_TOWER_TERMINAL_ID`；本機標題取 window registry cache）。缺的唯讀 accessor 補在 `PtyManager`。
3. 已結束的 PTY：`get-state` 能回 `exited`（保留最近結束的少量紀錄即可，上限與保留時間自訂並寫進 CLAUDE.md）；超出即 `NOT_FOUND`。
4. `terminal:wait` 的長輪詢不得卡住其他 invoke；RemoteServer / helper 端若有固定 invoke 逾時，確認 45 s 的 wait 能完成（必要時讓 server 端對此 channel 的回應不受一般逾時限制，回報區說明做法）。
5. 測試：範圍判定每一列（含 shell = 未宣告塔台、別人的 Worker → `NOT_OWNER`、worker 讀塔台輸出 → `NOT_OWNER`）、遮罩每一種樣式、cursor 增量與 truncated、wait 三種 until 與逾時、exited；真 RemoteServer + 範圍權杖的整合測試；headless 真 node-pty 對等測試（比照 `headless-set-role-e2e.test.ts`）；`proxied-channels-binding.test.ts` / `headless-parity.test.ts` 清單更新。
6. CLAUDE.md：新增「helper 唯讀查詢 channel（PLAN-047 M1 / T0582）」小節：契約表、範圍表、遮罩規則、常數、日誌、已知限制、驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元 / 整合 / headless 測試通過。
3. e2e（隔離實例，比照 `e2e/t0575-local-scoped-token.spec.ts`，在分頁內以分頁 env 執行一支呼叫 RemoteServer 的小腳本）：塔台分頁派一個 Worker（自訂 CLI 跑 node 腳本，不耗 token）→ 塔台 `whoami` / `list` / `get-state` / `read-output`（看得到 Worker 輸出、權杖樣式被遮罩）/ `wait until=exit` 成功；Worker 讀塔台輸出 → `NOT_OWNER`；未宣告塔台的一般分頁 `list scope=workspace` → `NOT_OWNER`。
4. 回報區附：實際採用的常數、與契約的差異（若有）、T0584 shim 需要知道的事項。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要（2026-10-17，Worker）

五個唯讀 channel（`terminal:whoami` / `list` / `get-state` / `read-output` / `wait`）已實作，本機與 headless 共用同一個 handler 模組與角色表；範圍判定、遮罩各一個唯一實作。全部驗收閘門通過（含隔離實例 e2e）。

### Landing Zone Check

- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：`affects_files` 可測項目都在（新檔的上層目錄存在）→ PASS（資訊）
- C-2：工單沒有 `branch` 欄位 → 不適用；目前分支 `main`
- 觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結論：PASS

### 變更檔案

新檔：
- `electron/terminal-query-handlers.ts`：`registerTerminalQueryHandlers`（五個 channel）、`readOutput`、`screenLines`、`savedTabsFromRegistry`、常數
- `src/lib/terminal-output-redaction.ts`：`redactTerminalSecrets`（遮罩純函式）
- 測試：`electron/__tests__/terminal-query-handlers.test.ts`、`electron/remote/__tests__/headless-terminal-query-e2e.test.ts`、`src/lib/__tests__/terminal-output-redaction.test.ts`、`e2e/t0582-helper-query.spec.ts`

修改：
- `electron/remote/helper-capability.ts`：`HELPER_CHANNEL_ROLES` 加五個 channel（tower / worker）、`HELPER_QUERY_CHANNELS`、`helperQueryRole`、`authorizeHelperQueryTarget`（範圍判定唯一實作）、`authorizeHelperInvoke` 對五個 channel 放行
- `electron/pty-manager.ts`：結束紀錄（`recordExit`，exit / kill 時記）與唯讀 accessor `listTerminalIds` / `getTerminalInfo` / `getExitedPty` / `listExitedPtyIds`
- `electron/remote/handler-registry.ts`：`HandlerContext.helper`（呼叫者權杖綁定）、`invokeHandler` 第五參數
- `electron/remote/remote-server.ts`：helper 路徑把 capability 交給 `invokeHandler`（1 行）
- `electron/main.ts`：在 `registerProxiedHandlers` 註冊、quit 時 `dispose`
- `electron/remote/headless-entry.ts`：`createHeadlessTerminalQueryModule`，放進 `createHeadlessHandlerModules`，server 傳 `knownSecrets`
- `electron/remote/__tests__/proxied-channels-binding.test.ts`（REGISTRY_ONLY）、`headless-parity.test.ts`（HELPER_ONLY）、`helper-capability.test.ts`（白名單 7 → 12）
- `CLAUDE.md`：新增「helper 唯讀查詢 channel（PLAN-047 M1 / T0582）」小節（放在「遠端 Tower 通知」與「多 remote profile」之間；未改其他小節）

### 驗證

| 閘門 | 結果 |
|---|---|
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npm run test:unit` | PASS：277 files、4890 passed、3 skipped |
| 新單元 / 整合測試 | `terminal-query-handlers.test.ts` 36 passed（含真 RemoteServer + 範圍權杖）；`terminal-output-redaction.test.ts` 9 passed |
| headless 對等（真 headless + 真 node-pty） | `headless-terminal-query-e2e.test.ts` 5 passed |
| e2e（隔離實例） | `npx playwright test e2e/t0582-helper-query.spec.ts` 1 passed（約 11 s）：塔台宣告 + 派 Worker（自訂 CLI 跑 node 腳本，不耗 token）→ 塔台 whoami / list mine + workspace / get-state / read-output（看得到 Worker 輸出，`batcap.` 樣式被遮罩）/ wait until=exit（Worker shell 結束 → `changed:true` `exited` `exitCode:0`）；Worker 讀塔台輸出 → `NOT_OWNER`；未宣告塔台的一般分頁 `list scope=workspace` → `NOT_OWNER`；debug log 有 `[helper-query]`、不含輸出與權杖。teardown：隔離 Terminal Server 已停、runtime userData 已刪 |

註：驗證時工作樹同時含 T0583 尚未 commit 的變更（同一個 repo 並行），以上結果是合併狀態下的結果。未碰使用者的 BAT（port 9876），e2e 用隔離實例的動態 port。

### 實際採用的常數

| 常數 | 值 | 說明 |
|---|---|---|
| `TERMINAL_QUERY_IDLE_MS` | 5000 | = `CLOSE_WORKER_IDLE_MS`（未新增可設定值） |
| `READ_OUTPUT_DEFAULT_LINES` / `READ_OUTPUT_MAX_LINES` | 200 / 1000 | 超過 1000 夾到 1000；非正整數 → `INVALID_ARGS` |
| `READ_OUTPUT_PARTIAL_LINE_MAX_CHARS` | 4096 | 仍在輸出中的最後一行在此長度內會留給下次整行再讀 |
| `TERMINAL_WAIT_MAX_MS` | 45000 | `timeoutMs` 預設與上限（超過夾到 45 s） |
| `TERMINAL_WAIT_POLL_MS` | 250 | wait 的 server 端輪詢間隔 |
| `TERMINAL_WAIT_MAX_PER_CALLER` | 8 | 同一呼叫者同時開著的 wait |
| `EXITED_PTY_RECORD_MAX` / `EXITED_PTY_RECORD_TTL_MS` | 32 / 10 分鐘 | 結束紀錄的筆數與保留時間 |
| `EXITED_PTY_TAIL_MAX_CHARS` | 32 KiB | 結束時保留的最後輸出 |

### 與契約的差異（新增，不改既有語意）

1. **`read-output` 多兩個欄位**：`skippedLines`（因 `maxLines` 從前面丟掉的行數）、`partialLine`（最後一行仍在輸出中，下次會整行再回傳一次）。理由：`nextCursor` 停在最後一個 raw `\n` 之後，讓被讀取切開的權杖下次整個遮罩（否則下次讀到的是沒有前綴的權杖後半段，遮罩不到）。`truncated` 只表示 cursor 的輸出已不在 buffer（捲掉，或 PTY 重啟後 cursor 超過結尾）。
2. **`wait` 多一個錯誤碼 `TOO_MANY_WAITS`**（同一呼叫者最多 8 個同時等待），以及回傳 `waitedMs`。`changed` = 條件成立（條件在呼叫當下已成立也是 `true`），逾時 `false`。`until=idle` 在 `idle` 或 `exited` 都成立。
3. **server token 呼叫者**：不受範圍限制（契約如此），但沒有「自己」，所以必須帶 `terminalId`（`whoami` 也接受 `{ terminalId }`），否則 `INVALID_ARGS`。helper 呼叫 `whoami` 時參數一律忽略。
4. **錯誤可帶 `message`**（例如 `scope=workspace needs a declared tower (--set-role tower)`），`code` 不變。
5. **`list` 會列出最近結束的分頁**（`alive:false`），範圍規則相同。`list scope=workspace` 只多列 metadata，不開放這些分頁的 get-state / read-output / wait（照範圍表「只列 metadata」）。
6. **遮罩多兩類**：`secret-env`（`*_TOKEN=` / `*_SECRET=` / `*_PASSWORD=` / `*_API_KEY=` 等的值）、PEM 只有 END 時從文字開頭遮到 END（讀取從金鑰中間開始）。「server token 樣式」= host 傳入的 server token 字面比對 + 43 字元混大小寫數字的 base64url（舊版 32 hex token 只靠字面比對，未用通用樣式，以免誤遮 MD5 / uuid 類字串）。
7. **affects_files 以外的檔**：`electron/remote/handler-registry.ts`（`HandlerContext.helper`）、`electron/remote/remote-server.ts`（1 行，把 capability 交給 handler）。任務 4 已點名 RemoteServer；handler 要以權杖為身分只能從這裡拿到。另改 `electron/remote/__tests__/helper-capability.test.ts`（白名單數量測試）。

### 任務 4（長輪詢與逾時）的做法

RemoteServer 對每個 frame 各自 `await` handler（`ws.on('message', async …)`），沒有 server 端 invoke 逾時，所以 45 s 的 wait 不會擋同一連線的其他 invoke（整合測試「a pending wait does not hold up other invokes」驗證）。不需要改 RemoteServer 的逾時。helper 端：目前沒有既有 helper 腳本呼叫這五個 channel（`bat-terminal.mjs` 的 3 s 逾時與它們無關），所以未改 helper；放寬逾時是 T0584 shim 的事（見下）。quit / server stop 時 `dispose()` 讓等待中的 wait 回 `changed:false`。

### T0584 shim 需要知道的事

- 連 `wss://127.0.0.1:$BAT_REMOTE_PORT`，`auth` 帶 `BAT_REMOTE_TOKEN`（分頁的 `batcap.` 權杖），之後 `invoke` frame；回應以 frame `id` 比對（BUG-114 規則）。本機 helper 連線**不收廣播**。
- 呼叫者身分 = 權杖，參數不能改；`terminalId` 省略 = 自己。
- invoke 逾時要大於 `wait` 的 `timeoutMs`（建議 ≥ 50 s）；其他 channel 都是同步回應。
- RemoteServer 每 30 s 對 helper 連線送 WebSocket ping，上一輪沒回 pong 就斷線（T0451）：長連線的 shim 必須回 pong（`ws` 套件會自動回；`bat-*.mjs` 的 `MinimalWS` 是短連線設計，沿用前要確認）。每個權杖同時連線數有上限（`HELPER_MAX_CONNECTIONS_PER_CAPABILITY`），被拒絕次數過多會被節流（T0451）。
- 範圍外 → `NOT_OWNER`；目標不存在 → `NOT_FOUND`（檢查順序：參數 → 存在 → 範圍）。
- `read-output` 增量讀取：保存 `nextCursor`，`partialLine:true` 時最後一行下次會再出現一次；`truncated:true` 表示中間有輸出已看不到。內容是 replay buffer 的去 ANSI 文字，TUI（claude CLI 的 alt screen）重繪會產生很多行，建議搭配 `maxLines`。
- 狀態只有 `working` / `idle` / `exited`；`blocked` 保留給 M1b。

### 已知限制

- T0108 replay 註冊的 PTY（BAT 重開、Terminal Server 存活）沒有 `customEnv` / role / workorder：worker 身分仍以還原的權杖判斷，但 `whoami` / `list` 缺 `towerTerminalId` / `workorder`（本機 `list` 的 `towerTerminalId` 取已存分頁）；這類 Worker 結束後沒有可比對的塔台紀錄 → 塔台查詢回 `NOT_OWNER`。
- `lastOutputAt` 只計本行程看到的輸出（replay 不算），重開後未再輸出的分頁是 `idle` / `lastOutputAt:null`。
- headless 沒有標題，也沒有 client 端的工作區資料（`workspaceId` 只有建立時帶的）。
- 遮罩是樣式比對，非窮舉。

### Commit

- `6b2ac19e` feat(T0582): helper read-only query channels（17 files，+2318 / −7），只含本單的檔案與 hunk；T0583 的變更未夾帶。未 push。
- 並行處理：T0583 同時改 `pty-manager.ts` / `main.ts` / `headless-entry.ts` / `helper-capability.ts` / `CLAUDE.md`，且會把自己的檔案 stage 進共用 index。本單先以暫存 index（HEAD + 只有本單的修改）建 commit，並在該 tree 的獨立 worktree 跑 `tsc`：`typecheck` = 0、`typecheck:electron` = 0；`update-ref` 以 compare-and-swap 推進時 HEAD 已被 T0583 的 `28d85b18`（只改 T0583 工單）推進而被拒，未覆寫任何東西。之後 T0583 全部已 commit、工作樹只剩本單變更，改以 `git commit --only <本單檔案>` 提交；`6b2ac19e` 與先前驗證的 tree 只差 T0583 的工單檔。
- `src/styles/settings.css` 的 M 不是本單變更，未動。
- commit 時 tower-hook 對本工單第 167 行發出 sensitive content WARN（不阻擋）：該行是遮罩規則的名稱清單（`*_TOKEN=` 等字樣），不含任何權杖值，屬誤報。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。
