---
schema_version: 1
schema_kind: workorder
id: T0607
title: "PLAN-048 A：Worker 問塔台 — 主行程問答 store、5 個 channel 與權限、`blocked` / `tower` 與 `pendingQuestions`（本機 + headless）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M-L
created_at: "2026-10-18T04:50:47+0800"
started_at: "2026-10-18T04:51:40+0800"
updated_at: "2026-10-18T05:10:19+0800"
completed_at: "2026-10-18T05:10:19+0800"
depends_on: [T0606]
related:
  - "T0606 回報區「介面契約草案」C-1–C-11 = 本單介面契約（D156 全部採用推薦；CT-T019 依此撰寫，不得單方更改）；「實作切分」A 節 = 本單範圍"
  - "D155 / D156；並行工單 T0608（B：helper + MCP shim，worktree 隔離，只改 `scripts/**` 與 `docs/agent-guide/bat-mcp-shim.md`）"
affects_files:
  - "electron/tower-questions.ts（新：store + `registerTowerQuestionHandlers`，不 import electron）"
  - electron/remote/helper-capability.ts
  - electron/terminal-query-handlers.ts
  - electron/terminal-blocked-state.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "electron/pty-manager.ts（只在需要 recovery hook 時）"
  - "electron/__tests__/**、electron/remote/__tests__/**（含 IPC / channel binding guard 測試的清單）"
  - CLAUDE.md
  - "docs/agent-guide/tower-questions.md（新）、docs/agent-guide/README.md、docs/agent-guide/blocked-state.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/remote-tower-notify.md"
  - _ct-workorders/T0607-tower-questions-main-store.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 契約 = T0606 回報區「介面契約草案」C-1–C-11，D156 已全部採用該單「待塔台 / 使用者決定」的推薦。必須照寫；實作中發現契約不可行或需改名，停下以 `T0607 提問` 問塔台（yolo 提問流程），不得自行改契約。"
  - "🔴 內容不落地（D155）：問題 / 選項 / detail / 答案只存在主行程記憶體，**不寫入任何檔案**；`[tower-question]` 日誌與 bat-scripts.log 只記 id / 長度 / 數量 / 結果，**永遠不記內容與權杖**（測試要斷言）。工單的問答紀錄屬 CT，與 BAT 無關。"
  - "🔴 並行：T0608 在隔離 worktree 改 `scripts/bat-notify.mjs`、`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`、`scripts/__tests__/**`、`docs/agent-guide/bat-mcp-shim.md`。本單**不得**改這些檔；CLAUDE.md「BAT MCP shim」節也不改（由收尾單處理）。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；需要 BAT 時用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt。"
---

# T0607 — PLAN-048 A：主行程問答 store、channel、狀態

## 背景

PLAN-048（D155 / D156）：yolo Worker 以結構化通道問塔台、等答覆。T0606 已寫定介面契約並切成三張實作單；本單是 A（主行程），B（helper + MCP shim）由 T0608 在隔離 worktree 並行，C（e2e）待 A / B 合併後再派。

## 任務

1. 依 T0606 契約 C-1–C-4、C-7、C-9、C-10 實作（本機與 headless 共用同一 module，接線比照 T0582 / T0590：`electron/main.ts` 與 `electron/remote/headless-entry.ts` 各呼叫一次 `register…Handlers(deps)`）：
   - `electron/tower-questions.ts`：store（id 帶 boot id → `lost`、狀態、`endReason`、保留期、C-2 常數與文字規則、收件即 `redactTerminalSecrets`）與 5 個 channel handler（`question:ask` / `cancel` / `answer` / `list` / `wait`）。
   - `HELPER_CHANNEL_ROLES` 5 列 + `authorizeHelperInvoke` 綁定（`question:answer` 比照 `terminal:close-worker` 的 `towerId` 綁定）。
   - PTY 結束（Worker / 塔台，含 restart）、Terminal Server recovery、`dispose` 的取消與 wait 收尾（C-4）。
   - `stateOf` 合成 `blocked` / `tower`（優先序在 hook reason 之後，`source: 'question'`，`blockedDetection: none` 的分頁也回）；`terminal:get-state` / `list` / `wait` 每個回傳加 `pendingQuestions`；`BlockedReason` 型別加 `tower`。使用者輸入不清除 `tower`。
2. 測試：T0606「實作切分」A 節列的 unit 全部；另加真 RemoteServer + 範圍權杖的整合測試（worker 權杖 ask → tower 權杖 list / answer → worker wait 收到；權限拒絕路徑）與 headless 對等測試（比照 `headless-terminal-query-e2e.test.ts`）。fake timers 遵守 CLAUDE.md「Frontend unit tests」規則。
3. 文件（CLAUDE.md T0595 規則）：
   - CLAUDE.md 新增「## Worker 問塔台（PLAN-048 / T0607）」小節（3–12 行：用途、契約一句話與 CT-T019、唯一實作 `electron/tower-questions.ts`、🔴 不變式：內容只存記憶體且日誌不記內容、BAT MCP 維持唯讀、`tower` 不被使用者輸入清除、helper 內容只走 stdin（T0608））。「blocked 狀態偵測」「遠端 Tower 通知」兩節各補一句（`tower` reason 與 `none` 新定義；權杖範圍表新列）。
   - `docs/agent-guide/tower-questions.md`（新）：完整契約（主行程部分）、限制、日誌、已知限制（agent 自己的對話紀錄含問答內容）、驗證清單；helper / MCP 段落留一句「見 T0608，收尾單補入」。索引 `docs/agent-guide/README.md`；同步 `blocked-state.md`、`helper-query-channels.md`、`remote-tower-notify.md`。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）。
2. 回報區附：`question:ask` → `list` → `answer` → `wait` 的實際回傳 JSON 範例（內容用假資料）、`get-state` 的 `blocked` / `tower` JSON 範例、一段 `[tower-question]` 日誌範例（證明不含內容）、與契約的差異（若有，必須是已問過塔台的）、變更檔案清單。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無（沒有開 `tower_question`）。契約未明定的細節依契約精神自行決定，列在「與契約的差異 / 解讀」，請塔台確認後轉 CT-T019 / C 單。

### 完成狀態

**DONE**：C-1–C-4、C-7、C-9、C-10 主行程部分實作完成；驗收 1、2 全部滿足。

落點檢查：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` → PASS；C-3：`affects_files` 前幾項皆存在或祖先存在 → PASS；C-2：無 `branch` 欄位，目前 `main`
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

驗證閘門：
| 閘門 | 結果 |
|---|---|
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS，0 錯誤 |
| `npm run typecheck:electron` | PASS，0 錯誤 |
| `npm run test:unit` | PASS：**295 files passed、5154 tests passed、3 skipped**（第三次完整執行；第二次執行時 `ct-worktree-status.test.ts` 2 個真 git 測試 5 s 逾時（當時 vite build 與並行 T0608 同時跑），單獨重跑 21/21 通過，第三次完整執行全綠） |
| 新測試 | `electron/__tests__/tower-questions.test.ts` 31 項、`electron/remote/__tests__/headless-tower-questions-e2e.test.ts` 5 項 |

Commit：`00bdcaebbe739ced0ae30a3a9f05b269284e8799`（產品 + 測試 + 文件，`git commit --only`）；本工單另一個 commit。未 push。

### 產出摘要

**實作**
- `electron/tower-questions.ts`（新，不 import electron）：store + `registerTowerQuestionHandlers`；5 個 channel；id `q-<boot>-<rand>`（boot 每程序一次，`<boot>` 不符 → `lost`）；C-2 常數與文字規則（`\r\n` → `\n`、其他控制字元 `INVALID_ARGS`）；收件即 `redactTerminalSecrets`（`knownSecrets` = server token），store 內無未遮罩內容；狀態 `pending` / `answered` / `cancelled` / `expired`；租約、過期、保留期（10 min / 64 筆）在每次存取時計算（無計時器）；`summaryFor` / `terminalEnded` / `serverRecovered` / `dispose`。
- `electron/remote/helper-capability.ts`：`HELPER_CHANNEL_ROLES` 5 列（共 19 個 channel）；`authorizeHelperInvoke`：ask / cancel 須物件，answer `opts.towerId === capability.terminalId` 否則 `tower-not-bound`，list / wait 放行。
- `electron/terminal-blocked-state.ts`：`HookBlockedReason`（tracker 用）+ `BlockedReason = HookBlockedReason | 'tower'`。
- `electron/terminal-query-handlers.ts`：deps `getQuestionSummary`；`stateOf` 在 hook reason 之後合成 `blocked` / `tower` / `source: 'question'`（不看 `blockedDetection`）；get-state / wait / list 每個回傳帶 `pendingQuestions`（含 exited）。
- `electron/pty-manager.ts`：`PtyManagerDeps.onServerRecovery`（`handleServerDeath` 在 `blockedTracker.clearAll` 之後呼叫，例外記 warn）。
- `electron/main.ts`：`registerTowerQuestionHandlers` 接線、`onPtyExit` → `terminalEnded`、`onServerRecovery` → `serverRecovered`、`cleanupAllProcesses` dispose。
- `electron/remote/headless-entry.ts`：`createHeadlessTerminalQueryModule` 建立 store（C-10）；`createHeadlessPtyModule` 新 `onPtyExit` 選項，`createHeadlessHandlerModules` 以 `ptyExitListeners` 轉給 store；module dispose 一併收尾。

**實際回傳 JSON（假資料；由暫存測試以真 handler 產生，`now` 固定、`bootId` / rand 固定）**

`question:ask`（Worker 權杖）：
```json
{ "ok": true, "questionId": "q-3f9a1c07-8b2e4d6f0a1c3e5b", "status": "pending", "towerTerminalId": "tw", "createdAt": 1792300000000, "expiresAt": 1792301800000, "masked": 0 }
```
`terminal:get-state { terminalId: "wk" }`（塔台權杖，codex 類 `blockedDetection: none` 分頁）：
```json
{ "ok": true, "terminalId": "wk", "state": "blocked", "lastOutputAt": 1792299972000, "idleMs": 30000, "blockedReason": "tower", "blockedSince": 1792300000000, "source": "question", "blockedDetection": "none", "pendingQuestions": 1, "agentStarted": null }
```
`question:list {}`（塔台權杖）：
```json
{ "ok": true, "questions": [ { "questionId": "q-3f9a1c07-8b2e4d6f0a1c3e5b", "workerTerminalId": "wk", "towerTerminalId": "tw", "workorder": "T9001", "question": "(假資料) 要部署到 staging 還是 prod？", "options": ["staging", "prod"], "allowFreeText": true, "detail": "(假資料) 推薦 staging", "blocking": true, "status": "pending", "createdAt": 1792300000000, "expiresAt": 1792301800000 } ] }
```
`question:answer { towerId: "tw", questionId, choice: 1, text }`：
```json
{ "ok": true, "questionId": "q-3f9a1c07-8b2e4d6f0a1c3e5b", "status": "answered", "answeredAt": 1792300007000, "masked": 0 }
```
`question:wait { questionId, timeoutMs: 45000 }`（Worker 權杖）：
```json
{ "ok": true, "questionId": "q-3f9a1c07-8b2e4d6f0a1c3e5b", "changed": true, "status": "answered", "answer": { "choice": 1, "text": "(假資料) 先上 staging" }, "answeredAt": 1792300007000, "waitedMs": 0 }
```
答覆後 get-state：`{ "ok": true, "terminalId": "wk", "state": "idle", …, "source": "output", "blockedDetection": "none", "pendingQuestions": 0, "agentStarted": null }`；再答一次：`{ "ok": false, "code": "CLOSED", "status": "answered" }`；其他程序的 id wait：`{ "ok": true, "questionId": "q-00c0ffee-0123456789abcdef", "changed": true, "status": "lost", "waitedMs": 0 }`。

**`[tower-question]` 日誌範例（同一次執行；不含問題 / 選項 / detail / 答案內容與權杖）**
```
[tower-question] ask q=q-3f9a1c07-8b2e4d6f0a1c3e5b worker=wk tower=tw workorder=T9001 len=27 options=2 blocking=true expires=1800000 masked=0 → ok
[tower-question] list caller=tw target=- status=pending → ok count=1
[tower-question] answer q=q-3f9a1c07-8b2e4d6f0a1c3e5b by=tw len=16 choice=1 → ok
[tower-question] wait q=q-3f9a1c07-8b2e4d6f0a1c3e5b caller=wk → answered changed=true waited=0
[tower-question] answer q=q-3f9a1c07-8b2e4d6f0a1c3e5b by=tw len=0 choice=2 → CLOSED
[tower-question] wait q=q-00c0ffee-0123456789abcdef caller=wk → lost changed=true waited=0
```
bat-scripts.log 鏡像 `tower-question` 事件，例 `{ "action": "ask", "q": "q-3f9a…", "worker": "wk", "tower": "tw", "workorder": "T9001", "len": 27, "options": 2, "blocking": true, "expires": 1800000, "masked": 0, "result": "ok" }`。測試「logs (C-9)」斷言日誌與 mirror 不含問題 / 選項 / detail / 答案文字、server token、`batcap.`。

**與契約的差異 / 解讀**（沒有改契約；以下為契約未明定處的處理，請塔台確認並轉 CT-T019；1 會影響 T0608 `--cancel-question` 的 exit code）
1. `question:cancel` 遇其他程序的 id（`lost`）→ `{ ok: true, questionId, status: 'lost' }`（依 C-3「已結束的回現狀，不是錯誤」；`answer` 照契約回 `NOT_FOUND` + `status: 'lost'`）。⇒ helper `--cancel-question` 對 `lost` 應為 exit 0。
2. `answered` 不帶 `endReason`（`endReason` 只用於 cancelled / expired，與 C-9 `end` 行一致）；只有 `choice` 的答覆存成 `{ choice, text: '' }`。
3. C-9 只列 ask / answer / end / wait；另加 `cancel`（`cancel q=… by=… → ok status=<s>|<code>`）與 `list`（`list caller=… target=… status=… → ok count=<n>|<code>`）兩種行，同樣不記內容。
4. 租約：Worker 的 wait 開著的期間視為持續 poll（不會 `not-polled`），wait 結束時再更新一次 `lastPolledAt`（契約為「每次呼叫更新」，此為更寬鬆的同義實作）。
5. 塔台 `question:list { terminalId }`：除 `authorizeHelperQueryTarget`（自己 / `isWorkerOf`，已結束者以結束紀錄）外，store 裡曾問過該塔台的 Worker 也算在範圍內（Worker 結束紀錄過期後仍可查自己收到的問題）。Worker 帶 `terminalId` = 綁定的塔台時允許，結果仍只有自己的。
6. 角色錯誤的直接呼叫（未經 `authorizeHelperInvoke`，只在測試或 server token 時）handler 回 `INVALID_ARGS`；answer 的 `towerId` 不是呼叫者 → `NOT_OWNER`。經 RemoteServer 一律先被擋為 `Forbidden: role-not-allowed` / `tower-not-bound`。
7. 過期與保留期在存取時計算（無計時器），所以 `end … expired` 的日誌時間是被看到的時間；狀態本身在被查到時一定正確。

**變更檔案**（commit `00bdcaeb`）
- 新：`electron/tower-questions.ts`、`electron/__tests__/tower-questions.test.ts`、`electron/remote/__tests__/headless-tower-questions-e2e.test.ts`、`docs/agent-guide/tower-questions.md`
- 改：`electron/remote/helper-capability.ts`、`electron/terminal-query-handlers.ts`、`electron/terminal-blocked-state.ts`、`electron/pty-manager.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、`CLAUDE.md`（新節「Worker 問塔台（PLAN-048 / T0607）」+「blocked 狀態偵測」「遠端 Tower 通知」各補一句）、`docs/agent-guide/README.md`、`docs/agent-guide/blocked-state.md`、`docs/agent-guide/helper-query-channels.md`、`docs/agent-guide/remote-tower-notify.md`
- 既有測試清單 / 期望值：`electron/remote/__tests__/helper-capability.test.ts`（19 channel）、`electron/__tests__/terminal-blocked-state.test.ts`（19、`pendingQuestions: 0`）、`electron/__tests__/terminal-query-handlers.test.ts`（list 列 `pendingQuestions`）、`electron/remote/__tests__/proxied-channels-binding.test.ts`（REGISTRY_ONLY 5 列）、`electron/remote/__tests__/headless-parity.test.ts`（HELPER_ONLY 5 列）
- 未動：`scripts/**`、`docs/agent-guide/bat-mcp-shim.md`、CLAUDE.md「BAT MCP shim」節（T0608 / 收尾單範圍）；`src/styles/settings.css`、`_ct-workorders/T0608-*.md` 的 M 不是本單變更。

**測試涵蓋**（T0606 A 節 unit 全部 + 整合 / headless）：id 格式與 `lost`、限制與 `INVALID_ARGS`、遮罩後才存、權限列（worker 不能 answer、tower 不能 ask、他塔 `NOT_OWNER`、`tower-not-bound`）、first-answer-wins / `CLOSED`、`expired`（`timeout` / `not-polled`，手動時鐘經 deps 注入、不用 vitest fake timers）、Worker / 塔台 PTY 結束（exit / kill / restart）、recovery、wait 逾時 / 喚醒 / `dispose` / `TOO_MANY_WAITS`、`stateOf` 優先序（hook 蓋過 tower、`none` 也回 tower、使用者輸入不清除）、日誌不含內容；真 RemoteServer + 範圍權杖（Worker ask → 塔台 list / answer → Worker wait 收到；拒絕路徑）；headless 真 node-pty 對等測試。

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；未向塔台或使用者提問）。

### 遭遇問題

- 以 Python 文字模式改檔在 Windows 寫出 CRLF，導致 3 個讀 `main.ts` 原始碼的 source guard 測試失敗（`helper-capability-persist` / `remote-connect-plan` / `detached-workspace-persistence`）；已把所有變更檔轉回 LF（`.gitattributes` `eol=lf`），重跑通過。
- 第二次完整 `test:unit` 時 `ct-worktree-status.test.ts` 2 個真 git 測試 5 s 逾時（與 vite build、並行 T0608 同時執行的負載）；單獨重跑 21/21、第三次完整執行全綠。本單未改該檔。
- 未啟動 BAT 實例、未碰 port 9876、未對 claude / codex 送出任何 prompt；未 push、未建 tag、未改版號。
- 待後續：T0608 合併後，收尾單（C）補 `tower-questions.md` 的 helper / MCP 段落與 CLAUDE.md「BAT MCP shim」節；e2e 走完整流程。

### 回報時間

2026-10-18T05:09:17+0800
