---
schema_version: 1
schema_kind: workorder
id: T0606
title: "研究：PLAN-048 Worker 問塔台 / 塔台答覆通道 — 現況盤點、介面契約草案、實作切分（D155）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T04:36:18+0800"
started_at: "2026-10-18T04:36:55+0800"
updated_at: "2026-10-18T04:45:34+0800"
completed_at: "2026-10-18T04:45:34+0800"
depends_on: []
related:
  - "PLAN-048（BMad-Guide D036 需求摘要）；D155（本單的設計前提，使用者 2026-10-18 選定）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」「helper 唯讀查詢 channel（T0582）」「BAT MCP shim（T0584）」「blocked 狀態偵測（T0590）」「Worker 啟動確認（T0600）」「Worker 分頁回收（PLAN-041）」小節與對應 docs/agent-guide/*.md"
  - "CT v5.5.0 現行做法：yolo Worker 把問題寫進工單（`T#### 提問`）→ notify 塔台 → 原地等；塔台寫回答覆（control-tower `references/yolo-mode.md` § Worker 向塔台提問，本機 `~/.claude/skills/control-tower/`，只讀）"
affects_files:
  - _ct-workorders/T0606-research-worker-ask-tower-contract.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品程式碼、測試、CLAUDE.md、docs、package.json**；唯一可寫入並 commit 的檔案是本工單（`git commit --only <本檔>`）。原型或實驗檔一律放 repo 外暫存目錄，結束後刪除，只把關鍵片段貼進回報區。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；需要 BAT 時用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt（不耗額度）。不得修改 `~/.claude/skills/**` / `~/.codex/skills/**`（只讀）。"
  - "🔴 外部查證（claude / codex 的 MCP tool 逾時等）以官方文件或 CLI 二進位字串為準，附 URL + 取用日期或二進位版本；查不到寫「未證實」。"
  - "🔴 D155 的四項前提是使用者決定，契約草案必須依它寫；認為某項不可行時，在「待塔台 / 使用者決定」列出理由與替代案，不得自行改掉。"
---

# T0606 — 研究：Worker 問塔台 / 塔台答覆通道

## 背景

BMad-Guide（D036）要求 yolo Worker 能以結構化通道問塔台、等答覆，取代目前「寫工單檔 → notify → 讀檔等待」的做法（見 PLAN-048）。本單只做研究與契約草案，實作另開單。

## 設計前提（D155，使用者 2026-10-18 選定，不得更改）

1. **先研究再實作**：本單產出介面契約草案，塔台 / 使用者審過後才開實作單，並轉交 CT（CT-T019）。
2. **答覆走 helper CLI**：塔台以 `bat-terminal.mjs --answer <問題 id> …`（名稱可提案）回答；待答問題以 **唯讀** MCP tool 讀取。BAT MCP 維持全唯讀以外的寫入一律走 helper（比照 `--close-worker`）。Worker 端「提問」本身是寫入，請評估它走 MCP tool（例 `bat_ask_tower`）是否違反「MCP 唯讀」原則，以及改走 helper（例 `bat-notify.mjs --ask`）的取捨，給推薦。
3. **只存記憶體**：BAT 重開 / Terminal Server recovery 後待答問題消失，Worker 收到明確的「已遺失」結果，CT 改走工單檔往返；問答內容不寫入磁碟（日誌也不記內容）。
4. **`blocked` 新增原因 `tower`**：Worker 等塔台答覆時 `state: blocked`、`blockedReason: tower`；擴充 T0590 契約。注意此狀態由 BAT 自己知道（不靠 claude hook），評估 codex 分頁（`blockedDetection: none`）是否也能回報。

等待方式（塔台預設，可提案修正）：Worker 端單次最多等 45 s（同 `terminal:wait`），未答回「pending」由 Worker 再呼叫；須落在 claude / codex 的 MCP tool 逾時之內（codex 目前注入 `tool_timeout_sec=60`）。

## 調查範圍

### R1 現況盤點（指出唯一實作位置與要擴充的點）
- 範圍權杖與角色：`HELPER_CHANNEL_ROLES`、`authorizeHelperInvoke`、`authorizeHelperQueryTarget`（`electron/remote/helper-capability.ts`）；worker → 塔台現有 notify / `pty:write` / keypress 路徑。
- 查詢 channel 與 shim：`electron/terminal-query-handlers.ts`、`scripts/bat-mcp.mjs`（tool 清單、逾時、錯誤格式）；`terminal:wait` 的上限與並行限制。
- blocked：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）的優先序、清除規則、PTY 結束 / restart / recovery 的清理。
- 本機與 headless 共用的接線方式（新 channel 要怎麼同時進兩邊）。

### R2 外部查證
- claude CLI（內嵌 2.1.300 / 系統 2.1.302）MCP tool 呼叫的逾時與長時間 tool 的行為（`MCP_TOOL_TIMEOUT` 等）；codex 的 `tool_timeout_sec` 預設與上限。決定單次等待上限是否 45 s 可行。

### R3 介面契約草案（比照 T0585 / T0600「介面契約」寫法：參數、回傳、exit code、日誌、版本判定）
- Worker 提問：入口（MCP 或 helper，依前提 2 推薦）、參數（問題、選項、可否自由回答）、回傳狀態（`answered` / `pending` / `lost` / `cancelled` / 其他）、問題 id、再等待的方式。
- 塔台讀取：唯讀 MCP tool（或擴充 `bat_get_state` / `bat_list_terminals`）列出自己 Worker 的待答問題。
- 塔台答覆：helper 參數、exit code（沿用 `0` / `3` NOT_FOUND / `4` NOT_OWNER / `1` 等慣例）、重複答覆與已過期的處理。
- 塔台如何得知有新問題：沿用 Worker → 塔台 notify（預填 / yolo `--submit`）或其他，給推薦。
- `blocked` / `tower`：進入、清除（答覆、取消、Worker 輸入、PTY 結束）、與其他 reason 的優先序；`terminal:wait` 是否需新 `until`。
- 生命週期與限制：每個 Worker 同時待答數、問題 / 答案長度、整體過期時間、Worker / 塔台分頁結束時的處理、遠端 headless 行為。
- 安全：權限列（worker 只能問綁定的塔台、塔台只能答自己派出的 Worker）、遮罩（`redactTerminalSecrets`）、日誌只記 id / 長度 / 結果。
- 舊 BAT 判定：CT 怎麼知道 BAT 不支援（MCP tool 不存在、helper `Unknown option`），降級到工單檔往返。

### R4 實作切分與驗證計畫
- 建議切成幾張實作單（可並行與否、`affects_files` 粗估）、需要的 unit / e2e 測試、CLAUDE.md 與 docs 要新增的小節。
- 列出要轉交 CT（CT-T019）的契約項目，以及 CT 端要改的流程（`yolo-mode.md` § Worker 向塔台提問、斷點 D 對 `tower` 的處理）。

## 驗收

- 回報區依 R1–R4 回答，每項結論標「程式碼位置」/「官方文件」/「二進位字串」/「推論」。
- 契約草案是可以直接貼進實作工單的完整版本。
- 「待塔台 / 使用者決定」列出所有需要再決定的點，每點附推薦。
- 只 commit 本工單檔。

---

## 回報區

### 完成狀態

**DONE**：R1–R4 完成，契約草案見「介面契約草案」（可直接貼進實作工單），待決 12 點見「待塔台 / 使用者決定」，每點附推薦。依 D155 四項前提撰寫，沒有更改任何一項；前提 2 的 Worker 提問入口推薦 **helper**（理由見 R3-1），等待答覆走**唯讀** MCP tool，另有 helper 備援。

落點檢查：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable
- C-2：工單沒有 `branch` 欄位；目前在 `main`
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；本單沒有需要問塔台的題目（沒有 `tower_question`）

證據標記：〔碼〕= 程式碼位置、〔文〕= 官方文件、〔二〕= 二進位字串、〔推〕= 推論。

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；沒有向塔台或使用者提問）。

### 調查結論

#### R1 現況盤點

**R1-1 權杖與角色**〔碼〕`electron/remote/helper-capability.ts`
- 角色只有兩種：`tower`（PTY 沒有 `BAT_TOWER_TERMINAL_ID`，所有沒被派工的本機分頁都是 tower 權杖）/ `worker`（`towerId` 綁定派它的塔台）。`HelperCapability = { terminalId, towerId?, role }`。
- 權限表唯一實作 `HELPER_CHANNEL_ROLES`（L386–416），本機與 headless 共用（`LOCAL_HELPER_CHANNEL_ROLES` 是同一個物件，T0579）。表中沒有的 channel 一律 `channel-not-allowed`。
- 每個 channel 的目標綁定在 `authorizeHelperInvoke`（L527–626）的 `switch`：`terminal:close-worker` 要求 `opts.towerId === capability.terminalId`（L585–593）；`terminal:notify` / `terminal:keypress` 要求 `opts.targetId === capability.towerId`（L612–617）；`pty:write` 限綁定塔台且只收可列印字元（`HELPER_PTY_WRITE_FORBIDDEN`，L618–622）；查詢類一律放行、由 handler 以 `authorizeHelperQueryTarget` 判斷範圍（L601–608）。
- 範圍判斷 `authorizeHelperQueryTarget`（L468–481）：自己一律可；tower → 加上 `isWorkerOf` 為真的 Worker；worker → 加上綁定塔台，且只限 `metadata`。
- 「誰是誰的 Worker」：`HelperCapabilityRegistry.isWorkerOf(childId, towerId)`（L292–299，看 live worker 權杖）；分頁結束後由 `ExitedPtyRecord.towerTerminalId` 判斷（`terminal-query-handlers.ts` `scope()`，L291–297）。
- **要擴充的點**：`HELPER_CHANNEL_ROLES` 加 5 列；`authorizeHelperInvoke` 加對應 `case`（綁定規則見契約）；`HELPER_QUERY_CHANNELS` 不必改（它只列 terminal 查詢）。
- worker → 塔台現有路徑〔碼〕：`scripts/bat-notify.mjs` 依序 invoke `terminal:notify`（toast + 分頁徽章，`electron/handlers/terminal.ts:127`）→ `pty:write`（預填，控制字元換成空白）→ `--submit` 時 `terminal:keypress`（Enter 經 renderer / xterm，`electron/handlers/terminal.ts:168`）。塔台 → Worker 目前**沒有**任何寫入 channel。

**R1-2 查詢 channel 與 shim**〔碼〕
- `electron/terminal-query-handlers.ts` `registerTerminalQueryHandlers`：5 個 channel，回 `{ ok: true, … }` 或 `{ ok: false, code, message? }`，code = `INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `TOO_MANY_WAITS`。呼叫者一律是 `ctx.helper`（權杖），不接受參數宣告。
- `terminal:wait`：`TERMINAL_WAIT_MAX_MS` = 45 000（預設也是上限）、每 250 ms 看一次（`TERMINAL_WAIT_POLL_MS`）、每呼叫者同時 8 個（`TERMINAL_WAIT_MAX_PER_CALLER`）；`dispose()` 會以 `changed: false` 結束所有開著的 wait。
- 稽核：每次呼叫一行 `[helper-query] channel=… caller=… target=… → ok|<code>` + bat-scripts.log `helper-query` 事件，不記輸出。
- 狀態唯一計算點 `stateOf`（L299–333）：優先序 exited > blocked > working / idle；`source` = `output` / `hook`；每個回傳都帶 `blockedDetection`、`agentStarted`。`terminal:list` 的每列也帶 `state` / `blockedReason` / `blockedDetection` / `agentStarted`（L445–456）。
- `scripts/bat-mcp.mjs`：`TOOLS` 陣列（L91–176）每個 tool 對應一個 channel；invoke 逾時一般 3 s（`INVOKE_TIMEOUT_MS`）、`bat_wait` 55 s（`WAIT_INVOKE_TIMEOUT_MS`）、worktree 15 s；annotation 全部 `READ_ONLY`（`readOnlyHint: true`，`bat_wait` 另標 `idempotentHint: false`）；錯誤一律 `isError: true` + `structuredContent: { code, message? }`；舊 BAT（`No handler for channel` / `Forbidden: channel-not-allowed`）→ `UNSUPPORTED` 並記住不再重送（`classifyInvokeError`，L440–447）。shim 忽略所有 notification（含 `notifications/cancelled`，L371–372）。
- server 說明文字 `instructions`（L315）寫明「Read-only queries」：新增 tool 時要同步改。

**R1-3 blocked**〔碼〕`electron/terminal-blocked-state.ts`
- `TerminalBlockedTracker`：`states`（每 PTY 至多一個 `BlockedState { reason, since, event }`）、`detection`（`hook` / `none`，跨 PTY 生命週期，上限 512）、`started`（T0600）。`BlockedReason = 'permission' | 'question' | 'elicitation'`。
- 清除點（`electron/pty-manager.ts`）：PTY 結束 `clearActivity`（L735，exit / kill，restart 先 kill）；使用者輸入 `noteUserInput`（L978–982，只來自本機視窗 / headless client 的 `pty:write`，helper 寫入與終端自動回應不算，`electron/handlers/pty.ts:109`）；Terminal Server recovery `clearAll`（L1572）；`dispose`（L1670）。
- 狀態只由 hook 回報進入（`report()`），`none` 分頁永遠不會 `blocked`。tracker 只認得一個 reason 欄位，沒有「多個來源同時 blocked」的概念。
- **要擴充的點**：`tower` 不應塞進 hook tracker（它不是 hook、不該被使用者輸入或 `Stop` 清除），建議由新的問答 store 提供「這個 PTY 有沒有 blocking 的待答問題」，在 `stateOf` 合成（見契約 C-6）。`BlockedReason` 型別加 `'tower'`，`source` 加 `'question'`。

**R1-4 本機與 headless 共用的接線方式**〔碼〕
- 樣板是 T0582 / T0585 / T0590：模組本身不 import electron，對外只露一個 `register…Handlers(deps)`；Electron 在 `electron/main.ts` L2348–2387 呼叫（`registerHandler`、`getPtyManager`、`isWorkerOf` 由 `localHelperCapabilities` 提供、`logger`、`mirrorToBatScripts`）；headless 在 `electron/remote/headless-entry.ts` `createHeadlessTerminalQueryModule`（L579–621）同一函式內呼叫，並在回傳的 dispose 收尾。
- PTY 結束通知：兩邊都有 `onPtyExit`（`main.ts:895`、`headless-entry.ts:363`），目前用來撤銷權杖；新 store 的「Worker / 塔台分頁結束 → 取消問題」掛在同一處最直接（或由 PtyManager 提供 listener，二選一，實作單決定；前者不必動 PtyManager）。
- Terminal Server recovery 只發生在 Electron（`handleServerDeath`），需要一個額外 hook（例 PtyManager `onRecovery` 或在 `notifySurvivingPtys([])` 旁邊呼叫），headless 沒有這條路徑。
- 新 channel 名稱要是字串字面值（`proxied-channels-binding.test.ts` 掃描 channel 名，`terminal-blocked-state.ts:313` 註解）。

**R1-5 日誌現況（影響內容不落地）**〔碼〕
- `scripts/bat-notify.mjs:56`、`scripts/bat-terminal.mjs:57` 啟動時把**完整 argv** 寫進 bat-scripts.log（`logEvent(…, 'invoke', { argv })`）。⇒ 問題 / 答案內容**不能放在命令列參數**，否則違反 D155「內容不落地」；草案改由 stdin 傳入。命令列也會出現在程序列表與 agent 的工具呼叫紀錄。

#### R2 外部查證

| 項目 | 結論 | 證據 |
|---|---|---|
| claude `MCP_TOOL_TIMEOUT` 預設 | 100 000 000 ms（約 28 h）；stdio server 沒有每請求計時器；per-server `timeout` 可覆寫 | 〔文〕https://code.claude.com/docs/en/env-vars（取用 2026-10-18）；〔二〕內嵌 2.1.300 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`：`…a.MCP_TOOL_TIMEOUT??xr;return Math.min(Math.max(n,1000),Mu)`，同一範圍 `xr=1e8`、`Mu=2147483647`；系統 2.1.302（`~/.local/bin/claude.exe`）同結構 `MCP_TOOL_TIMEOUT??Fr`，`Fr=1e8` 存在（minify 名稱多處重用，2.1.302 的對應屬〔推〕） |
| claude MCP 閒置逾時 | stdio 1 800 000 ms（30 min）沒有回應也沒有 progress 才中止；網路 server 300 000 ms | 〔文〕同上 `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`；〔二〕兩版皆 `…=300000,…=1800000`，`r==="stdio"?Hr:$r` |
| claude MCP 自動轉背景 | 呼叫超過 120 000 ms 會移到背景 task（`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`，`0` 關閉） | 〔文〕同上；〔二〕兩版皆 `var te=120000,F=1000` + `tengu_mcp_auto_background",!0)?te` |
| claude Bash 工具 | 前景指令預設 120 000 ms、上限 600 000 ms | 〔文〕同上 `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` |
| codex `tool_timeout_sec` | 預設 60 s；文件沒有寫上限；BAT 已注入 `tool_timeout_sec=60`（`BAT_MCP_CODEX_TOOL_TIMEOUT_SEC`，`electron/bat-mcp-launch.ts:54`） | 〔文〕https://learn.chatgpt.com/docs/config-file/config-reference（原 developers.openai.com/codex/config-reference 308 轉址，取用 2026-10-18）：「Override the default 60s per-tool timeout for an MCP server」；內嵌 codex 0.160.0 / 系統 0.163.0 二進位只有欄位名，數值屬 Rust 常數，二進位查不到 |
| codex shell 長指令 | `exec_command` 以 `yield_time_ms` 先回傳、之後用 `write_stdin` 輪詢（背景輪詢上限 `background_terminal_max_timeout` 預設 300 000 ms）；「45 s helper 指令在 codex 內的實際行為」**未證實** | 〔文〕同上；〔二〕codex.exe 有 `yield_time_ms`、`write_stdin` 字串 |

**結論**：單次等待上限 45 s 可行。claude MCP 45 s 遠低於 28 h 總逾時、30 min 閒置、120 s 自動轉背景；codex MCP 45 s + shim 餘裕 < 60 s（與 `bat_wait` 相同的 55 s invoke 逾時）。claude 用 Bash 跑 helper 等 45 s 也在預設 120 s 內；codex 用 shell 跑 helper 長等待未證實，所以**等待以 MCP 為主、helper 為備援**（codex Worker 優先 MCP）。不建議把單次上限調高到 60 s 以上（codex 會先逾時）。

#### R3 / R4 摘要
- 契約：5 個新 channel（`question:ask` / `question:cancel` / `question:answer` 寫入、`question:list` / `question:wait` 唯讀）、2 個唯讀 MCP tool（`bat_list_questions` / `bat_wait_question`）、helper `bat-notify.mjs --ask | --wait-answer | --cancel-question`、`bat-terminal.mjs --answer`；`blocked` / `tower` 由問答 store 合成；問題 id 帶 BAT 程序的 boot id，BAT 重開後回 `lost`。
- 切分：3 張實作單（A 主行程 store + channel + 狀態；B helper + MCP；C e2e + docs 收尾），A 先、B 可在契約鎖定後與 A 並行。詳見下兩節。

### 介面契約草案

> 本節為 PLAN-048 實作工單的「介面契約」（CT-T019 依此撰寫，不得單方更改）。名稱皆為提案，審核時可改名，但改名須兩邊同時改。

#### C-1 概念與資料

- **問題（question）**：由 Worker 分頁提出、送給它綁定的塔台（Worker 權杖的 `towerId`），只存在 BAT 主行程（本機 = Electron main；遠端 = headless bat-server）記憶體。**不寫入任何檔案**（含 `helper-capabilities.json`、window registry、settings）。
- **問題 id**：`q-<boot>-<rand>`，`<boot>` = 該 BAT 程序啟動時產生的 8 碼 hex（`randomBytes(4)`），`<rand>` = 16 碼 hex（`randomBytes(8)`）。格式 regex `^q-[0-9a-f]{8}-[0-9a-f]{16}$`。
  - `<boot>` 與目前程序不同 ⇒ 該問題屬於已結束的 BAT 程序 ⇒ 回 **`lost`**（D155：BAT 重開後待答問題消失，Worker 收到明確的「已遺失」）。
  - `<boot>` 相同但查不到 ⇒ `NOT_FOUND`（打錯、或已結束且超過保留期）。
- **狀態**：`pending` → `answered` / `cancelled` / `expired`；另有只出現在回傳的 `lost`。結束後的問題保留 `QUESTION_ENDED_RETENTION_MS` = 10 min、每 host 最多 `QUESTION_ENDED_MAX` = 64 筆（同 exited 紀錄），讓晚到的查詢得到正確狀態。
- **欄位**（store 內部）：`id`、`workerId`、`towerId`、`workorder`（Worker PTY 的 `PtyInstance.workorder`，沒有就省略）、`question`、`options[]`、`allowFreeText`、`detail?`、`blocking`、`createdAt`、`expiresAt`、`lastPolledAt`、`status`、`endReason?`、`answer?: { choice?, text }`、`answeredAt?`。

#### C-2 限制（常數，無注入點以外的設定；不加 Settings 開關）

| 常數 | 值 | 說明 |
|---|---|---|
| `QUESTION_TEXT_MAX_CHARS` | 4 000 | `question` |
| `QUESTION_DETAIL_MAX_CHARS` | 8 000 | `detail`（建議 / 影響範圍等，CT 自由使用） |
| `QUESTION_OPTIONS_MAX` / `QUESTION_OPTION_MAX_CHARS` | 10 / 500 | `options` |
| `ANSWER_TEXT_MAX_CHARS` | 8 000 | `answer.text` |
| `QUESTION_STDIN_MAX_BYTES` | 65 536 | helper 從 stdin 讀的上限 |
| `QUESTION_MAX_PENDING_PER_WORKER` | 8 | 超過 → `TOO_MANY_QUESTIONS` |
| `QUESTION_MAX_PENDING_PER_TOWER` | 64 | 同上 |
| `QUESTION_DEFAULT_EXPIRES_MS` / `QUESTION_MAX_EXPIRES_MS` | 1 800 000 / 7 200 000 | 30 / 120 min，與 CT `worker_question_timeout` 預設 / 上限一致 |
| `QUESTION_POLL_LEASE_MS` | 120 000 | `blocking` 問題超過這麼久沒有 `question:ask` / `question:wait` → `expired`（`endReason: not-polled`） |
| `QUESTION_WAIT_MAX_MS` | 45 000 | 同 `TERMINAL_WAIT_MAX_MS` |
| `QUESTION_WAIT_MAX_PER_CALLER` | 8 | 與 `terminal:wait` 各自計數 |

文字規則：`\r\n` → `\n`；`\n`、`\t` 以外的 C0 / DEL / C1 控制字元 → `INVALID_ARGS`；收件時以 `redactTerminalSecrets`（`src/lib/terminal-output-redaction.ts`，含 `knownSecrets` = RemoteServer token）遮罩後才存，store 內永遠沒有未遮罩的內容；回傳 `masked`（遮罩數）。

#### C-3 channel 與權限列（`HELPER_CHANNEL_ROLES` 新增）

| channel | 角色 | `authorizeHelperInvoke` 綁定 | handler 範圍 |
|---|---|---|---|
| `question:ask` | `worker` | 沒有目標參數；`args[0]` 必須是物件 | 目標固定為呼叫者 `towerId`；塔台 PTY 不在執行 → `NOT_FOUND` |
| `question:cancel` | `worker` | `args[0]` 必須是物件 | 只能取消自己（`workerId === caller.terminalId`）的問題，否則 `NOT_OWNER` |
| `question:answer` | `tower` | `opts.towerId === capability.terminalId`，否則 `tower-not-bound`（比照 `terminal:close-worker`） | 只能答 `towerId === caller.terminalId` 的問題，否則 `NOT_OWNER` |
| `question:list` | `tower`, `worker` | 唯讀，放行 | worker：自己提出的；tower：送給自己的（`terminalId` 參數須是自己或 `isWorkerOf` 為真的 Worker，否則 `NOT_OWNER`） |
| `question:wait` | `tower`, `worker` | 唯讀，放行 | 同 `question:list` 的範圍規則，以問題的 `workerId` / `towerId` 判斷 |

- server-token client（`ctx.helper` 不存在）：`question:list` / `question:wait` 不限範圍（供日後 UI）；寫入的三個 channel 一律 `INVALID_ARGS`（需要權杖，身分不接受參數宣告），比照 `terminal:report-hook`。
- 回傳一律 `{ ok: true, … }` / `{ ok: false, code, message? }`；code = `INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `TOO_MANY_QUESTIONS` / `TOO_MANY_WAITS` / `CLOSED`。
- 舊 BAT 對新 channel 回 `Forbidden: channel-not-allowed` 或 `No handler for channel`（helper 與 shim 都當 `UNSUPPORTED`）。

**`question:ask`** `{ question, options?, allowFreeText?, detail?, blocking?, expiresInMs? }`
- `question` 必填、非空；`options` 字串陣列（可省略 = 沒有選項）；`allowFreeText` 預設 `true`；沒有 `options` 時 `allowFreeText` 必須為 `true`；`blocking` 預設 `true`；`expiresInMs` 1–7 200 000，預設 1 800 000。
- 回 `{ ok: true, questionId, status: 'pending', towerTerminalId, createdAt, expiresAt, masked }`。
- 建立即視為一次 poll（`lastPolledAt = createdAt`）。

**`question:cancel`** `{ questionId }` → `{ ok: true, questionId, status }`（`pending` → `cancelled`、`endReason: worker`；已結束的回現狀，不是錯誤）。

**`question:answer`** `{ towerId, questionId, choice?, text? }`
- `choice`：1-based 整數，須 ≤ `options.length`；問題有 `options` 且 `allowFreeText: false` 時必填。
- `text`：問題沒有 `options` 或 `allowFreeText: true` 時可帶自由回答；有 `choice` 時 `text` 可當理由。`choice` 與 `text` 至少一個。
- 第一個答覆生效：已 `answered` / `cancelled` / `expired` → `{ ok: false, code: 'CLOSED', status, endReason? }`。
- 成功 → `{ ok: true, questionId, status: 'answered', answeredAt, masked }`；`<boot>` 不符 → `{ ok: false, code: 'NOT_FOUND', status: 'lost' }`。

**`question:list`** `{ terminalId?, status?: 'pending' | 'all' }`（預設 `pending`）
- 回 `{ ok: true, questions: [ { questionId, workerTerminalId, towerTerminalId, workorder?, question, options, allowFreeText, detail?, blocking, status, endReason?, createdAt, expiresAt, answer?, answeredAt? } ] }`，依 `createdAt` 排序。

**`question:wait`** `{ questionId, timeoutMs? }`（預設 = 上限 45 000）
- 長輪詢直到 `status !== 'pending'` 或逾時；每次呼叫（含立即返回）更新 `lastPolledAt`（只有提問的 Worker 呼叫才算 poll；塔台呼叫不延長租約）。
- 回 `{ ok: true, questionId, changed, status, endReason?, answer?, answeredAt?, waitedMs }`；`status: 'lost'`（`<boot>` 不符）也是 `ok: true`，`changed: true`。
- `changed: false` + `status: 'pending'` = 逾時，不是錯誤，再呼叫一次。
- handlers `dispose()`（server 停止 / app 結束）以 `changed: false` 結束所有 wait（比照 `terminal:wait`）。

#### C-4 結束原因（`endReason`）

| 事件 | 結果 |
|---|---|
| 塔台答覆 | `answered` |
| Worker `question:cancel` | `cancelled` / `worker` |
| Worker PTY 結束（exit / kill，含 `pty:restart`） | 該 Worker 所有 pending → `cancelled` / `worker-exited` |
| 塔台 PTY 結束（含 `pty:restart`） | 送給它的所有 pending → `cancelled` / `tower-exited` |
| Terminal Server recovery（Electron） | 全部 pending → `cancelled` / `recovery` |
| 超過 `expiresAt` | `expired` / `timeout` |
| `blocking` 問題超過 `QUESTION_POLL_LEASE_MS` 沒有 poll | `expired` / `not-polled` |
| BAT（Electron）重開 / headless server 重啟 | store 消失；舊 id 一律回 `lost` |
| 使用者在 Worker 分頁輸入 | **不影響**（見待決 3） |

#### C-5 helper CLI

共通：問題與答案內容**只從 stdin 讀**（UTF-8，上限 64 KiB），不得出現在 argv（bat-scripts.log 會記 argv，R1-5）；helper 日誌只記 id、長度、選項數、結果。輸出第一行固定 `[bat-notify] …` / `[bat-terminal] …` 慣例照舊，結果行以兩個空白開頭（比照 `--wait-started`）。

**Worker 提問**：
```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] [--expires-min <1-120>] "T#### 提問" < question.json
```
- stdin JSON：`{ "question": "…", "options": ["…", "…"], "allowFreeText": true, "detail": "…", "blocking": true }`（欄位同 `question:ask`）。
- 流程：`question:ask` 成功 → 照現有 notify 流程（`terminal:notify` → `pty:write` 預填 → `--submit` 時 `terminal:keypress`）送出位置參數訊息（CT 照舊用 `T#### 提問`，BAT 不解析）。
- notify 任一步失敗 → helper 自動 `question:cancel`（不留下塔台不知道的問題）→ exit 1。
- stdout：`  question: <questionId>`、`  expires: <ISO>`、`  notified: yes`。
- exit：`0` 已提問且已通知 / `3` NOT_FOUND（塔台分頁不在）/ `10` TOO_MANY_QUESTIONS / `1` 其他（用法、stdin 不是合法 JSON 或超過上限、連線失敗、`UNSUPPORTED`、notify 失敗）。stderr 一行 `ask: <CODE>`。
- `--submit` 規則不變：只在 `CT_MODE=yolo` 使用（CT 規則）。
- 舊 helper：`Unknown option '--ask'` exit 1，**沒有**建立問題、**沒有**通知。

**Worker 等答覆（備援；主路徑是 MCP `bat_wait_question`）**：
```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --wait-answer <questionId> [--timeout-ms <0-45000>]
```
- stdout 最後一行是一行 JSON：`{"questionId":"…","status":"answered","changed":true,"answer":{"choice":1,"text":"…"},"answeredAt":…}`（欄位同 `question:wait`）。
- exit：`0` 有明確狀態（含 `pending` 逾時、`lost`）/ `3` NOT_FOUND / `4` NOT_OWNER / `1` 其他（含連線失敗：BAT 正在重開時，CT 應稍後重試，重開完成後會得到 `lost`）。

**Worker 取消**：`bat-notify.mjs --cancel-question <questionId>` → exit `0` / `3` / `4` / `1`。

**塔台答覆**：
```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --answer <questionId> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt
```
- stdin = 答覆文字（UTF-8，可空，但 `--choice` 與文字至少一個）；`--notify-id` 必填（傳為 `towerId`，比照 `--close-worker`）。
- stdout：`  answered: <questionId>`；`CLOSED` 時另印 `  status: <answered|cancelled|expired> [<endReason>]`。
- exit：`0` 已答 / `3` NOT_FOUND（含 `lost`，stderr `answer: LOST`）/ `4` NOT_OWNER / `9` CLOSED（已答、已取消、已過期）/ `1` 其他（用法、`INVALID_ARGS`、連線失敗、`UNSUPPORTED`）。stderr 一行 `answer: <CODE>`。
- 舊 helper：`Unknown option '--answer'` exit 1。
- BAT 不通知 Worker、不對 Worker 分頁寫入任何東西（PLAN-048 約束：不經 `pty:write`、不模擬按鍵）；Worker 自己在 `question:wait` 收到。

#### C-6 唯讀 MCP tool（`scripts/bat-mcp.mjs` `TOOLS` 新增，annotation 仍 `READ_ONLY`）

| tool | channel | 參數 | 用途 |
|---|---|---|---|
| `bat_list_questions` | `question:list` | `terminalId?`、`status?: pending\|all` | 塔台列出自己 Worker 的待答問題（含全文）；Worker 查自己的 |
| `bat_wait_question` | `question:wait` | `questionId`（必填）、`timeoutMs?`（0–45 000） | Worker 等答覆；`idempotentHint: false`，invoke 逾時 55 s（同 `bat_wait`） |

- BAT MCP 維持全部唯讀：寫入（ask / cancel / answer）沒有 MCP tool。`instructions` 文字補「and tower questions」。
- `summarize`：`bat_list_questions` → `N pending questions: <id> (T####, <前 60 字>)`；`bat_wait_question` → `status=<s> after <ms> ms`（answered 時附答覆全文）。

#### C-7 `blocked` / `tower`（擴充 T0590 契約）

- `BlockedReason` 增加 `tower`：Worker 有至少一個 `blocking: true` 的 `pending` 問題時，`terminal:get-state` / `terminal:list` / `terminal:wait` 對該 Worker 回 `state: blocked`、`blockedReason: tower`、`blockedSince` = 最早那個 blocking pending 問題的 `createdAt`、`source: 'question'`。
- 優先序：`exited` > `blocked`（hook 的 `permission` / `question` / `elicitation`）> `blocked`（`tower`）> `working` / `idle`。hook reason 優先，因為它要使用者處理、塔台答不了。
- 與 `blockedDetection` 無關：`tower` 由 BAT 自己的 store 判斷，**codex 分頁（`blockedDetection: none`）也會回 `blocked` / `tower`**。⇒ T0590 契約「`none` 的分頁永遠不會回 `blocked`」改為「`none` 的分頁永遠不會回 hook 的 reason（`permission` / `question` / `elicitation`）」（待決 2）。
- 清除：問題答覆、取消、過期、Worker / 塔台 PTY 結束、recovery（C-4）。**使用者在 Worker 分頁輸入不清除**（hook reason 照舊會被輸入清除）。
- 新增欄位 `pendingQuestions`（數字，該 Worker 的 pending 問題數，含非 blocking）：在 `terminal:get-state` / `terminal:wait` / `terminal:list` 每列都回（含 `0`）。舊 BAT 沒有此欄位 ⇒ 塔台的版本判定之一。
- `terminal:wait`：**不新增** `until`。`state-change`（含進入 / 離開 `blocked`）與 `idle`（`blocked` 不算 working）已涵蓋塔台需要；塔台知道有新問題主要靠 notify（C-8）。
- 日誌：`[blocked]` 不記 tower 的進出（狀態是合成的）；問題本身記 `[tower-question]`（C-9）。

#### C-8 塔台如何得知有新問題

沿用 Worker → 塔台 notify：`bat-notify.mjs --ask` 在登記問題後送出 CT 給的訊息（yolo 照常 `--submit`）。塔台收到 `T#### 提問` 後以 `bat_list_questions`（`terminalId` = 該 Worker，或省略列出全部）讀題目，再以 `--answer` 回覆。訊息格式由 CT 決定，BAT 不加問題 id（待決 11）。

#### C-9 日誌與遮罩

- `[tower-question] ask q=<id> worker=<id> tower=<id> workorder=<T####|-> len=<n> options=<n> blocking=<bool> expires=<ms> masked=<n> → ok|<code>`
- `[tower-question] answer q=<id> by=<tower> len=<n> choice=<n|-> → ok|<code>`
- `[tower-question] end q=<id> → cancelled|expired (<endReason>)`
- `[tower-question] wait q=<id> caller=<id> → <status> changed=<bool> waited=<ms>`（每次呼叫一行，比照 `[helper-query]`）
- bat-scripts.log 鏡像 `tower-question` 事件，欄位同上。**永遠不記問題、選項、detail、答案的內容，也不記權杖**。
- 範圍外（不在 BAT 控制內，寫進 docs 已知限制）：agent 自己的對話紀錄（例 claude 的 session jsonl）會含問題與答案。

#### C-10 遠端 headless

- store 在 headless 的 `createHeadlessTerminalQueryModule`（或並列的新 module）建立；同一 server 上的塔台與 Worker 互問，channel 與權限同本機。headless server 重啟 → PTY 本來就全部結束，舊 id 回 `lost`（實務上沒有 Worker 能收到）。
- 遠端 helper 一律 `"${BAT_HELPER_NODE:-node}"`；`--submit` 需要 BAT client 連著（現有限制），通知失敗時 helper 依 C-5 取消問題並 exit 1。

#### C-11 版本判定（CT 降級到工單檔往返）

| 端 | 判定 | 降級 |
|---|---|---|
| Worker 提問 | `bat-notify.mjs --ask` exit ≠ 0（`Unknown option '--ask'` = 舊 helper；`ask: UNSUPPORTED` = 新 helper、舊 host） | 走 CT v5.5.0 工單檔往返；helper 保證此時沒有留下問題 |
| Worker 等待 | `bat_wait_question` 不存在或回 `UNSUPPORTED` → 改用 `--wait-answer`；回 `lost` / `cancelled` / `expired` → 依 CT 備援（工單 `BLOCKED` + `T#### 需要協助`） | 同左 |
| 塔台讀取 | `bat_list_questions` 不存在 / `UNSUPPORTED`；或 get-state 沒有 `pendingQuestions` 欄位 | 讀工單 `### 待塔台決策` |
| 塔台答覆 | `--answer` 回 `Unknown option` / exit 1 `UNSUPPORTED` | 寫工單 `塔台答覆 Q-n` 行；此時 Worker 會在 `lost` / 逾時後讀到 Renew |

### 實作切分與驗證計畫

#### 實作單（建議 3 張）

**A — 主行程問答 store、channel、狀態**（先做；sizing M–L）
- `affects_files`（粗估）：`electron/tower-questions.ts`（新，store + `registerTowerQuestionHandlers`，不 import electron）、`electron/remote/helper-capability.ts`（5 列權限 + `authorizeHelperInvoke` case）、`electron/terminal-query-handlers.ts`（`stateOf` 合成 `tower`、`pendingQuestions`、`TerminalQueryPtyManager` 或 deps 加 `getQuestionSummary`）、`electron/terminal-blocked-state.ts`（`BlockedReason` 型別加 `tower`）、`electron/main.ts`（接線、`onPtyExit`、recovery）、`electron/pty-manager.ts`（只在需要 recovery hook 時）、`electron/remote/headless-entry.ts`（接線）、`src/lib/terminal-output-redaction.ts`（只讀用，不改）、測試 `electron/__tests__/tower-questions.test.ts`（新）、`electron/__tests__/helper-capability*.test.ts`、`electron/__tests__/terminal-query-handlers*.test.ts`、IPC binding guard 測試的 channel 清單。
- unit 測試：id 格式與 `lost`（另一個 boot）、限制與 `INVALID_ARGS`、遮罩後才存（store 內查不到原 secret）、權限列（worker 不能 answer、tower 不能 ask、答別的塔台的題 `NOT_OWNER`、`towerId` 綁定 `tower-not-bound`）、first-answer-wins / `CLOSED`、`expired`（`timeout` 與 `not-polled`，fake timers 只假造需要的 timer，遵守 CLAUDE.md「Frontend unit tests」的 fake timer 規則）、Worker / 塔台 PTY 結束取消、recovery 全取消、wait 逾時 / 答覆喚醒 / `dispose`、`TOO_MANY_WAITS`、`stateOf` 優先序（hook reason 蓋過 tower；`none` 分頁也回 tower）、日誌不含內容（斷言日誌字串不含問題文字）、headless 與本機同一 module。
- 驗收：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build`。

**B — helper 與 MCP shim**（契約鎖定後可與 A 並行，建議 worktree 隔離；sizing M）
- `affects_files`：`scripts/bat-notify.mjs`（`--ask` / `--wait-answer` / `--cancel-question`，stdin 讀取，notify 失敗時取消）、`scripts/bat-terminal.mjs`（`--answer`、exit `9`）、`scripts/bat-mcp.mjs`（2 個 tool、summarize、instructions）、`scripts/__tests__/bat-notify*.test.mjs`、`scripts/__tests__/bat-terminal*.test.mjs`、`scripts/__tests__/bat-mcp*.test.mjs`；`npm run verify:helpers`（不新增 `_bat-*.mjs` 時只需跑一次確認）。
- 測試（假 RemoteServer，比照現有 helper 測試，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp）：stdin JSON 錯誤 / 超過上限、argv 與 bat-scripts.log 不含內容、notify 失敗時有送 `question:cancel`、exit code 對照表、舊 host `UNSUPPORTED`、`--wait-answer` 一行 JSON、frame id 比對（BUG-114）、`--answer` 缺 `--notify-id` 用法錯誤、MCP `tools/list` 仍全部 `readOnlyHint: true`。

**C — e2e 與文件收尾**（A、B 都完成後；sizing S–M）
- e2e `e2e/t####-tower-question.spec.ts`：隔離實例（先 `npx vite build`），兩個分頁以 helper env 扮演塔台 / Worker（分頁內跑 node 腳本，不啟動 claude / codex、不耗額度）：ask → 塔台 `bat_list_questions`（直接以 shim 的 stdio 呼叫）→ Worker `blocked/tower` → `--answer` → Worker wait 收到答覆 → 狀態回 idle；另測 Worker 分頁關閉 → `cancelled`、BAT 重開（Terminal Server 存活）後 `lost`。
- 文件：CLAUDE.md 新增「## Worker 問塔台（PLAN-048 / T####）」小節（3–12 行：用途、契約一句話、唯一實作 `electron/tower-questions.ts`、不變式：內容只存記憶體與只走 stdin、BAT MCP 維持唯讀、`tower` 不被使用者輸入清除）；新增 `docs/agent-guide/tower-questions.md`（完整契約、限制、日誌、已知限制、驗證清單），索引 `docs/agent-guide/README.md`；同步更新 `docs/agent-guide/blocked-state.md`（`tower` reason、`none` 的新定義）、`helper-query-channels.md`（`pendingQuestions`）、`bat-mcp-shim.md`（tool 表）、`remote-tower-notify.md`（權杖範圍表）、CLAUDE.md「blocked 狀態偵測」「遠端 Tower 通知」「BAT MCP shim」節各補一行。
- 也可以把文件併入 A / B 各自的單（CLAUDE.md T0595 規則要求改功能時兩邊一起更新）；C 只留 e2e。推薦：文件跟著 A / B，C 只做 e2e 與實機驗收。

#### 實機驗收（C 之後，使用者或塔台安排，會耗額度）
- claude-cli Worker 與 codex Worker 各跑一次 yolo 提問 → 塔台代答 → Worker 繼續；確認 codex 分頁 `blocked/tower` 可見、`bat_wait_question` 在 codex 60 s 內返回。

#### 轉交 CT（CT-T019）的契約項目
1. C-5 helper：`--ask`（stdin JSON、exit 0/3/10/1、notify 失敗自動取消）、`--wait-answer`（一行 JSON、exit 0/3/4/1）、`--cancel-question`、`--answer`（stdin、exit 0/3/4/9/1、`--notify-id` 必填）。
2. C-6 MCP：`bat_list_questions`、`bat_wait_question`（單次 ≤ 45 s，`changed:false` 再呼叫）。
3. C-3 / C-4 狀態值：`pending` / `answered` / `cancelled` / `expired` / `lost` 與 `endReason` 列舉。
4. C-7：`blockedReason: tower`、`source: question`、`pendingQuestions`、優先序、`none` 定義修改。
5. C-11 版本判定與降級。
6. CT 端要改的流程：
   - `yolo-mode.md` § Worker 向塔台提問 › Worker 端：BAT 支援時改為 `--ask`（`--expires-min` = `worker_question_timeout`）→ `bat_wait_question` 迴圈（備援 `--wait-answer`）→ 答覆寫進回報區 `### 互動紀錄`（仍保留 `### 待塔台決策` 作紀錄？由 CT 決定）；`lost` / `cancelled` / `expired` / helper 失敗 → 現行工單檔往返或 BLOCKED 備援；`worker_question_timeout = 0` 時不用 BAT 通道。
   - § 塔台端：收到 `T#### 提問` → `bat_list_questions` → 代決邊界照舊 → `--answer`；同時照舊寫決策日誌與 YOLO 歷程；升級給使用者時問題仍 pending（注意 `expiresAt`）。
   - § 斷點 D：`blockedReason: tower` **不是**斷點 D（不告知使用者「在等你回答」），改為「Worker 在等塔台答覆」→ 塔台查 `bat_list_questions` 並答覆；`none` 的判斷改為只排除 hook reason。
   - `auto-session.md` § BAT MCP 唯讀 tool：補兩個 tool；ct-exec `SKILL.md` § Questions For Tower 摘要同步。

### 待塔台 / 使用者決定

1. **Worker 提問入口：helper 或 MCP**（D155 前提 2 要求評估）——**推薦 helper（`bat-notify.mjs --ask`）**。
   - MCP 寫入 tool 的問題：權限上與 helper 等價（同一個分頁權杖，worker 早已能 notify / 預填塔台），所以不是安全漏洞；但會打破「BAT MCP = 全唯讀」的不變式（D155 已列「不採用：MCP 寫入 tool」），使用者以 `mcp__bat__*` 整批允許時會一併允許寫入，annotation 與 `instructions` 也要改語意。
   - helper 的好處：與 `--close-worker` / notify 同一套 exit code 與版本判定；BAT MCP 關閉（`batMcpEnabled` off）或 session 沒載入 MCP 時仍可用；一個指令同時登記與通知，notify 失敗可自動取消。
   - helper 的成本：內容必須走 stdin（argv 會被記進 bat-scripts.log，R1-5）；Windows PowerShell 5.1 管線預設不是 UTF-8 會弄壞中文（pwsh 7 預設 UTF-8 沒問題；CT 文件要寫明用 pwsh 或 Git Bash heredoc）〔推〕。
   - 替代：MCP `bat_ask_tower`（JSON 參數沒有引號 / 編碼問題）——若使用者願意放寬「MCP 唯讀」為「MCP 只有唯讀 + 對綁定塔台提問」，可改，但需改 D155。
2. **codex（`blockedDetection: none`）也回 `blocked` / `tower`**——**推薦允許**，並把 T0590 契約「`none` 永遠不會 `blocked`」改為「`none` 永遠不會回 hook reason」。理由：`tower` 由 BAT 自己知道，codex 也能用；不改的話 codex Worker 等塔台時塔台看不到。代價：CT 斷點 D 的 `none` 規則要一起改（CT-T019）。替代：codex 不回 `blocked`，只靠 `pendingQuestions`。
3. **使用者在 Worker 分頁輸入是否清除 `tower`**——**推薦不清除、不取消問題**。理由：狀態由 store 合成，清掉會與「問題仍 pending」矛盾；claude 在工具執行中輸入只是排隊；使用者按 Esc 中止工具後 Worker 不再 poll，120 s 租約到期自動 `expired/not-polled`。替代：輸入即取消（`cancelled/user-input`），反應較快但誤觸就會丟題。
4. **通知方式**——**推薦由 `--ask` 在同一指令內送 notify（CT 提供訊息）**，BAT 主行程不主動推送。替代：`question:ask` 由主行程直接通知塔台（BAT 需知道訊息格式與 yolo 判斷，CT 失去控制權）。
5. **租約 `QUESTION_POLL_LEASE_MS` = 120 s（只對 `blocking` 問題）**——推薦。處理 agent 被中斷、當機後不再等待的情況。值越小越容易誤判（模型兩次 poll 間的思考時間）。
6. **過期時間**——推薦 `--expires-min` 由 CT 帶 `worker_question_timeout`（預設 30、上限 120 min），讓 BAT 與 CT 同時放棄。
7. **塔台分頁結束（含 ⏻ 重啟）取消送給它的問題**——推薦取消（`tower-exited`），Worker 走備援；新塔台 session 不知道這些題目。替代：保留給同 id 的新塔台（但新 session 沒有上下文）。
8. **重複答覆**——推薦第一個生效、之後 exit `9` CLOSED 並印出現狀。替代：允許覆寫（Worker 可能已依第一個答覆動作）。
9. **Worker 等待的主路徑**——推薦 MCP `bat_wait_question` 為主、helper `--wait-answer` 為備援（codex 的 shell 長指令行為未證實，R2）。替代：只做 helper（少一個 tool，但 codex 風險）。
10. **新 exit code `9`（CLOSED）與 `10`（TOO_MANY_QUESTIONS）**——推薦採用（現有 `3`–`8` 已用）。替代：併入 `1`，CT 需解析 stderr。
11. **`T#### 提問` 訊息是否附問題 id**——推薦不附（CT 斷點 A regex 不必改；塔台以 `bat_list_questions` 取 id）。
12. **實作單數與並行**——推薦 A → B（契約鎖定後可並行，worktree 隔離）→ C（e2e），文件跟著 A / B。

### 遭遇問題

- 無阻塞。
- `src/styles/settings.css` 的 M 不是本單變更，未動。
- 未建立任何原型檔（研究以閱讀程式碼與二進位字串完成），沒有暫存檔需要刪除；未啟動 BAT 實例、未對 claude / codex 送出 prompt、未修改 `~/.claude/skills/**`。
- 驗證閘門：本單為研究單，沒有建置 / 測試閘門；只 commit 本工單檔（`git commit --only`）。
- 未證實：codex 在 shell 內執行 45 s 長指令的實際行為（R2）；系統 claude 2.1.302 的 `MCP_TOOL_TIMEOUT` 預設值以同結構推論（官方文件已證實 100 000 000 ms）。

### 回報時間

2026-10-18T04:45:34+0800
