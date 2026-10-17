---
schema_version: 1
schema_kind: workorder
id: T0575
title: "PLAN-047 A1：本機 PTY 改用範圍權杖（batcap.），不再注入全權 server token"
type: feature
status: DONE
started_at: "2026-10-17T19:07:59+0800"
updated_at: "2026-10-17T19:34:16+0800"
completed_at: "2026-10-17T19:34:16+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-17T19:04:59+0800"
target_version: "與 T0576（A2）同版發佈；未完成 A2 前不得發版（D149）"
depends_on: []
related:
  - "PLAN-047（研究結論、D149）"
  - "T0574 回報區 R3（呼叫者盤點、本機缺口 1–5、相容性表、遷移步驟）"
  - "PLAN-036 K / T0432 / T0447–T0450（headless 每 PTY 權杖；`helper-capability.ts`、`buildHeadlessHelperEnv`、`authorizeHelperInvoke`）"
  - "T0576（A2：權杖跨 BAT 重開持久化，接在本單之後）"
affects_files:
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/close-worker.ts
  - "electron/__tests__/**（新增 / 修改本機權杖相關測試）"
  - "electron/remote/__tests__/helper-capability.test.ts"
  - "e2e/t0575-local-scoped-token.spec.ts（新增）"
  - "CLAUDE.md（「遠端 Tower 通知（PLAN-036 K）」權杖表與「本機 Electron 的 PTY 仍注入全權 server token」一句、Logging 節的 helper env 說明）"
  - _ct-workorders/T0575-local-pty-scoped-capability-token.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。塔台與其他 Worker 正透過已安裝的 BAT 使用 helper，本單的變更只在 build 產物，不影響它們。"
  - "🔴 遠端 headless 的行為不得改變（`headless-*` 測試全綠）；`BAT_REMOTE_TOKEN` 變數名不變（helper 讀它）；RemoteServer 仍須接受全權 server token（遠端 client / QR / 行動端使用），只是**本機 PTY env 不再拿到它**。"
  - "🔴 No Regressions：本機現有每一種 helper 用法（見任務 3）在本單後都要能用，或在回報區明列「行為改變 + 理由」交塔台決定；不得默默變成 Forbidden。"
---

# T0575 — PLAN-047 A1：本機 PTY 範圍權杖

## 背景

T0574 R3 實測 / 盤點：本機 PTY env 的 `BAT_REMOTE_TOKEN` 是 RemoteServer 的全權 server token（持久化在 `server-token.json`，與 QR / 行動 client 共用），server-token client 直接 `invokeHandler(frame.channel)`（`electron/remote/remote-server.ts:742`），可呼叫**所有** `registerHandler` channel（`fs:*`、`settings:save`、`claude:*`、對任意 id 的 `pty:write` / `pty:get-buffer`），並收到所有廣播（含每個 PTY 的 `pty:output`）。任何本機分頁裡的程式都能做這些事。

範圍權杖的程式碼已在共用的 `RemoteServer`（`acceptHelper` / `handleHelperFrame` / `authorizeHelperInvoke`，`remote-server.ts:1005-1137`，只在傳入 `helperCapabilities` 選項時啟用）；headless 在 `electron/remote/headless-entry.ts:892-907` 已完整接線；本機 `electron/main.ts:438` 是 `new RemoteServer()`，沒有接。

## 塔台決策（D149）

- raw command 模式（`bat-terminal.mjs claude "/ct-exec T####"` → `terminal:create-with-command`）：**tower 角色允許**，套用與 `terminal:create-agent-command` 相同的限制（不得指定 `shell`、`customEnv` 白名單、`BAT_TOWER_TERMINAL_ID` 只能是自己、存活子 PTY 上限、建立間隔）。headless 是否同步開放：**本單不動 headless**（headless 角色表的 raw command 仍拒絕），在回報區評估是否該同步，交塔台決定。
- 每個 tower 存活子 PTY 上限：本機沿用 `HELPER_TOWER_MAX_LIVE_CHILDREN` = 8，不加 Settings。
- 升級當下仍存活的舊分頁（Terminal Server 跨版本存活）：維持全權 token 直到重開，不輪替 server token；在 CLAUDE.md 寫明。
- 本單與 T0576（A2）同版發佈；本單完成後 BAT 重開而 Terminal Server 存活的分頁 helper 會失效，這是已知、由 A2 修正，**回報區要寫出實測現象**供 A2 對照。

## 任務

1. **本機接線**（依 T0574 R3「本機需要補的」①–④）：
   - `main.ts` 建 `RemoteServer` 時傳 `helperCapabilities`（`HelperCapabilityRegistry`）、`isTerminalAlive`、`isKnownAgent`（經 `normalizeAgentAlias` / registry，與 headless 同語意）、`getPtyCapacity`。
   - `PtyManager.buildPtyEnv()`（唯一組裝點，T0525）：本機 helper env 的 `BAT_REMOTE_TOKEN` 改為簽發的 `batcap.` 權杖；有 `customEnv.BAT_TOWER_TERMINAL_ID` → worker（綁該 tower），否則 → tower。三條 spawn 分支、`pty:restart`、Terminal Server recovery 都經這裡（restart 保留角色，比照 T0448）。
   - `onPtyExit` / kill → `revokeTerminal`。
   - `WorkerCloseScheduler` 加 `isOwnedBy: isWorkerOf`（`main.ts` 接線處，比照 headless T0536）。
2. **raw command 政策**（D149）：本機 tower 角色可呼叫 `terminal:create-with-command`，限制同 create-agent-command。實作方式（角色表 per-server 設定或本機專用表）自行判斷，**headless 角色表不變**。
3. **盤點並逐一驗證本機 helper 用法**（T0574 R3 呼叫者表為起點，再 grep 一次）：`bat-terminal.mjs` agent 模式（`--skill` / `--prompt`）、raw command 模式、`--close-worker`、`--set-role`；`bat-notify.mjs`（Worker → 塔台：notify、預填 `pty:write`、`--submit` keypress；以及**非 Worker 分頁手動執行 bat-notify** 的情況）。每一種在回報區列「修正前 / 修正後」結果。
4. **巢狀 BAT**（T0574 缺口 4）：`buildPtyEnv` 在 `remoteInfo` 為 null（本機 RemoteServer 未啟動）時刪除繼承來的 `BAT_REMOTE_*`，不把外層 token 傳下去。
5. **日誌**：主行程記一行權杖簽發 / 撤銷（不記 token 本身，只記 terminalId 與角色），沿用既有 `[helper-cap]` 或同類前綴。
6. **CLAUDE.md**：更新「遠端 Tower 通知（PLAN-036 K）」節（權杖改為本機與 headless 共用、本機 raw command 規則、舊分頁相容說明；刪除「本機 Electron 的 PTY 仍注入全權 server token」），以及 Logging 節 helper env 相關描述。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（含 `headless-*`、`helper-capability`、`close-worker`、`proxied-channels-binding`、`headless-parity`）。
2. 新增單元測試：本機 env 為 `batcap.`、角色判定、restart 保留角色、exit 撤銷、`isOwnedBy`、raw command 限制、巢狀 env 清除。
3. 新增 e2e `e2e/t0575-local-scoped-token.spec.ts`（隔離實例，自訂 CLI 跑 node 腳本，不耗 token）：分頁 env token 以 `batcap.` 開頭；tower 分頁可派工（agent 與 raw command）/ `--close-worker` / `--set-role`；Worker 分頁 `bat-notify --submit` 成功；**Worker 分頁呼叫 `pty:create`（或 `fs:*` 任一）→ Forbidden**；server token 經 RemoteServer 仍可用。
4. 回報區有任務 3 的修正前 / 後表、任務 2 的 headless 評估、以及「BAT 重開 + Terminal Server 存活」的實測現象（供 T0576）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

本機 Electron 的 PTY 改用範圍權杖：`BAT_REMOTE_TOKEN` = 該 PTY 的 `batcap.` 權杖（tower，或 `customEnv.BAT_TOWER_TERMINAL_ID` 的 worker），server token 不再進入本機 PTY env；RemoteServer 仍接受 server token（遠端 client / QR / 行動端）。本機 tower 可用 raw command 模式（D149），headless 角色表不變。全部驗收閘門通過（見下）。

### 落點檢查

- C-0 PASS：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（affects_files 均存在）；C-2 不適用（無 `branch` 欄位），HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 變更檔案

| 檔案 | 內容 |
|---|---|
| `electron/remote/helper-capability.ts` | `LOCAL_HELPER_CHANNEL_ROLES`（headless 表 + tower 的 `terminal:create-with-command`）、`HELPER_CREATE_CHANNELS`、`HelperInvokeContext.channelRoles`（預設 `HELPER_CHANNEL_ROLES`）、raw command 與 create-agent-command 共用授權（新 id、非自己、無 `shell`、`customEnv` 白名單、tower 綁定、registry agent；另檢查 `command` 須為字串）、`buildLocalHelperEnv` |
| `electron/remote/remote-server.ts` | 選項 `helperChannelRoles`（預設 headless 表）；配額改套 `HELPER_CREATE_CHANNELS`（raw command 也受 8 子 PTY / 1 s 限制） |
| `electron/pty-manager.ts` | 移除 `getRemoteServerInfo`；`buildPtyEnv` 的 `BAT_REMOTE_*` 只來自 `helperEnv`；繼承來的 `BAT_REMOTE_*`（`helperEnv` 與 `customEnv` 都沒給時）刪除 |
| `electron/main.ts` | `localHelperCapabilities`；`new RemoteServer({ helperCapabilities, helperChannelRoles: LOCAL_HELPER_CHANNEL_ROLES, isTerminalAlive, isKnownAgent（normalizeAgentAlias + registry）, getPtyCapacity })`；`createElectronPtyDeps` 加 `helperEnv` = `buildLocalHelperEnv`、`onPtyExit` 撤銷並記日誌；刪除 `ptyManager.getRemoteServerInfo = …`；`WorkerCloseScheduler` 加 `isOwnedBy`；Terminal Server 兩處 fork 改用 `terminalServerInheritedEnv()`（去掉 `BAT_REMOTE_*`） |
| `electron/close-worker.ts` | `capabilityOrSavedTabOwnership`（本機 `isOwnedBy`） |
| `electron/__tests__/local-helper-capability.test.ts`（新） | 42 項：`buildLocalHelperEnv`、PtyManager 本機接線（`batcap.`、node-pty / Terminal Server、restart 保留角色、kill / exit 撤銷、冪等不重簽、recovery 重簽、巢狀 env 清除）、角色表與 raw command 限制、真 RemoteServer（raw command 通過、與 create-agent-command 共用配額、worker `pty:create` / `fs:readdir` / `settings:save` / raw command Forbidden 且 handler 未執行、server token 可用、`Capability revoked`、他行程權杖 = `Invalid token`）、`capabilityOrSavedTabOwnership` + scheduler `NOT_OWNER`、main.ts source guard |
| `electron/__tests__/pty-manager-helper-env.test.ts` | `getRemoteServerInfo` 改為 `helperEnv`；新增巢狀 `BAT_REMOTE_*` 清除（node-pty / Terminal Server，`customEnv` 保留） |
| `e2e/t0575-local-scoped-token.spec.ts`（新） | 隔離實例，所有 helper 都在分頁內以分頁 env 執行（見驗證） |
| `CLAUDE.md` | 「遠端 Tower 通知」節新增「本機 PTY（T0575）」條、角色表註明本機表、raw command 限制改寫、刪除「本機 Electron 的 PTY 仍注入全權 server token」、frame id 規則改寫適用對象；Logging 節「Helper scripts 的 userData」「PTY env 唯一組裝點」補 T0575 |

### 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| `npx vite build` | PASS | exit 0 |
| `npm run typecheck` | PASS（0） | 最終版本重跑 exit 0 |
| `npm run typecheck:electron` | PASS（0） | 最終版本重跑 exit 0 |
| `npm run test:unit` | PASS | 267 檔 / 4688 passed / 3 skipped（含 `headless-*`、`helper-capability`、`close-worker`、`proxied-channels-binding`、`headless-parity`）；最終版本重跑同結果 |
| 新 e2e `e2e/t0575-local-scoped-token.spec.ts` | PASS | 1 passed（12.2 s） |
| 既有 helper 相關 e2e 回歸 | PASS | `t0523` / `t0529` / `t0535` / `t0537` / `t0538` / `t0551` / `t0553` / `t0562` / `t0566`：9 passed（2.7 min） |
| 遠端實機 e2e（`plan039-real-remote` / `pre5-acceptance` / `t0550`） | 未跑 | 需 WSL / SSH 實機環境變數；headless 行為由 `headless-*` 單元測試覆蓋（全綠） |

e2e 內容：塔台與 Worker 的 env 權杖皆 `batcap.` 且 ≠ server token、兩者不同；塔台 `pty:create` → `Forbidden: channel-not-allowed`；agent 模式派工 exit 0；Worker `bat-notify --submit` exit 0 且塔台 PTY 出現「T0575 完成」並被 Enter 執行；Worker 的 `pty:create` / `fs:readdir` / `pty:get-buffer` → `Forbidden: channel-not-allowed`、`terminal:create-with-command` → `Forbidden: role-not-allowed`；raw command 派工 exit 0 且新分頁輸出標記；`--close-worker` exit 0、Worker 分頁關閉並離開 registry；`--set-role tower --agent claude --mode yolo` exit 0、標題 `Claude CLI · Tower`；server token 經 RemoteServer 呼叫 `pty:get-cwd` 成功；主行程日誌有 `[helper-cap] issued/revoked` 且不含任何權杖。

### 任務 3：本機 helper 用法 修正前 / 修正後

盤點：`scripts/bat-terminal.mjs:934` 依模式選 channel（agent → `terminal:create-agent-command`、raw → `terminal:create-with-command`、`:1088` close-worker、`:1146` set-role）；`scripts/bat-notify.mjs:543/582/637`（notify / pty:write / keypress）。其他 scripts 只檢查變數名（與 T0574 R3 相同，重新 grep 無新增呼叫者）。

| 用法（在哪個分頁執行） | channel | 修正前（全權 token） | 修正後（範圍權杖） | 證據 |
|---|---|---|---|---|
| 塔台分頁 `bat-terminal.mjs --skill ct-exec --workorder` / `--prompt` | `terminal:create-agent-command` | OK | OK（tower） | e2e 步驟 2；t0523 / t0529 / t0553 |
| 塔台分頁 raw command `bat-terminal.mjs claude "/ct-exec T####"` | `terminal:create-with-command` | OK | OK（D149，限制同 agent 模式） | e2e 步驟 3；單元測試 |
| 塔台分頁 `--close-worker` | `terminal:close-worker` | OK | OK | e2e 步驟 4；t0535 / t0537 / t0551 |
| 塔台分頁 `--set-role tower [--mode]` | `terminal:set-role` | OK | OK（只能設自己） | e2e 步驟 4；t0562 / t0566 |
| Worker 分頁 `bat-notify`（notify + 預填 + `--submit`） | `terminal:notify` / `pty:write` / `terminal:keypress` | OK | OK（只能對自己的塔台、預填只收可列印文字） | e2e 步驟 2；t0538 / t0553 |
| **非 Worker 分頁手動 `bat-notify --target <任意分頁>`** | `terminal:notify` / `pty:write` | OK（可通知 / 預填任意分頁） | **行為改變**：兩者 `Forbidden: role-not-allowed`，exit 1 | e2e 步驟 1 |
| **Worker 分頁再派工 / `--set-role` / `--close-worker`** | create / set-role / close-worker | OK | **行為改變**：`Forbidden: role-not-allowed`，exit 1（同 headless） | 單元測試 |
| **塔台分頁 `--set-role --terminal-id <別的分頁>`** | `terminal:set-role` | OK | **行為改變**：`Forbidden: target-not-bound`（同 headless） | 既有 `helper-capability` 測試 |
| BAT 外以 server token 執行 helper（e2e harness、手動） | 全部 | OK | OK（不變） | 既有 9 個 e2e 皆以此方式執行 |
| 升級當下仍存活的舊分頁（env 為 server token） | 全部 | OK | OK，直到分頁重開（不輪替 token） | 設計（未實測跨版本） |
| BAT 重開 + Terminal Server 存活的分頁 | 全部 | OK | **失效**：`Authentication failed: Invalid token`，exit 1（T0576 修正） | 下方實測 |

行為改變的理由：非 Worker / Worker 越權用法正是 T0574 R3 指出的風險（任意分頁可對任意分頁預填、派工、改標題）；限制與遠端 headless 已上線的規則一致。CT 的正常流程（塔台派工 / 回收 / set-role、Worker 回報）全部不受影響。若塔台需要「非 Worker 分頁手動通知」的用途，請另開單決定（建議不開放）。

### 任務 2：headless 是否同步開放 raw command（評估，交塔台決定）

- 現況：headless 仍拒絕（`HELPER_CHANNEL_ROLES` 不變，`headless-*` 測試全綠）；CLAUDE.md 規定遠端塔台只用 agent 模式。
- 開放的風險：tower 已能在自己的遠端 shell 執行任意命令，多開一個分頁執行任意命令，額外能力有限；限制（新 id、無 `shell`、`customEnv` 白名單、配額、client 名額保留）可直接沿用。
- 開放的好處：本機與遠端同一套 CT 指令，不必區分「遠端只能 agent 模式」。
- 成本：headless 改用 `LOCAL_HELPER_CHANNEL_ROLES`（一行接線），補 `headless-helper-capability` / `headless-parity` 測試與 CLAUDE.md；需確認 headless 的 `terminal:create-with-command` 路徑（`rejectShell` / `validateShell`、`pickWhitelistedEnv`）與本機一致。
- **建議**：同步開放，但另開一張小單（S），排在 T0576 之後；不急，因為 CT 遠端目前已用 agent 模式。

### BAT 重開 + Terminal Server 存活（實測，供 T0576 對照）

暫時性量測 spec（隔離實例，量完已刪除、未提交）：塔台分頁先 `--set-role` 成功 → 以「確認退出、不停止 Terminal Server」關閉 BAT（日誌 `[quit] user confirmed quit (stopTerminalServer=false)`，Terminal Server pid 存活）→ 同一 runtime 重開，Recovery 選保留 → 在存活分頁內執行 helper（`BAT_REMOTE_PORT` 改成新實例的 port，模擬實機固定 9876）：

```
bat-terminal.mjs --set-role tower → exit 1
  stderr: Error: Authentication failed: Invalid token
          set-role: AUTH_FAILED
bat-notify.mjs …                  → exit 1
  stderr: Error: Authentication failed: Invalid token
```

- 分頁 env 仍是上一個 BAT 行程簽發的 `batcap.` 權杖；新行程 registry 是空的，所以是 `Invalid token`（不是 `Capability revoked`），也不計入 server-token 封鎖（T0449）。
- **T0576 要注意的時序**（重開後實測日誌）：`11:30:43.333Z [helper-cap] issued: terminal=e2e-t0575r-tower role=tower` 早於 `11:30:43.601Z [PtyManager] replay: 1 active PTY(s) found on reconnect`。renderer 還原分頁的 `pty:create` 比 T0108 replay 清單先到，PtyManager 尚未登記該 id，就送出 `pty:create`（Terminal Server 端判斷已存在、不重建），同時替這個 id 簽了新權杖，但 env 裡沒人拿到它。A1 下這個權杖沒有作用（之後隨 PTY exit 撤銷）；**A2 若先還原持久化的 digest，這次 `issue()` 會把還原的那把撤銷**（`issue` 會先 `revokeTerminal`）。A2 需要讓這個情況不簽發（例如 replay 完成前延後、或 Terminal Server 回報「已存在」時撤回新簽的並保留還原的）。
- 修正前（全權 token 持久化）這個情境照常可用。
- 量測過程的清理：第一次量測 Playwright `app.close()` 未返回（BAT 本身已完成退出），殘留的隔離 Terminal Server（pid 45192，pid 檔與 runtime 目錄吻合、路徑為 repo `dist-electron`）已 `taskkill /T /F`，runtime userData 已刪；第二次量測 teardown 正常。未碰使用者的 BAT（9876）與其 Terminal Server。

### 偏離與說明

- `PtyManager.getRemoteServerInfo` 移除（唯一使用者是 main.ts 與測試），`BAT_REMOTE_*` 改由既有的 `helperEnv` dep 提供（headless 同一路徑），`buildPtyEnv` 仍是唯一組裝點。
- `isOwnedBy` 沒有直接用 `isWorkerOf`：那樣會讓 T0537「重開後依已存分頁回收」變成 `NOT_OWNER`（重開後的 Worker PTY 沒有 worker 權杖）。改為 `capabilityOrSavedTabOwnership`：本行程有記錄工單者須 `isWorkerOf`，歸屬來自已存分頁者沿用 T0537。t0537 e2e 回歸通過。
- 巢狀清除只刪「繼承來的」`BAT_REMOTE_*`；`customEnv` 明確給的保留，因此 headless 行為完全不變（headless 本來就 scrub 繼承的 `BAT_*`）。另在 Terminal Server fork env 去掉 `BAT_REMOTE_*`（server 會把自己的 env 墊在 PTY env 之下）；已在執行的舊 Terminal Server 不受這項修正影響。
- `src/styles/settings.css` 的 M 不是本單變更，未納入 commit。

### 後續建議

1. T0576（A2）：持久化 + replay 還原，並處理上述「`pty:create` 早於 replay」時序；本單與 T0576 必須同版發佈（D149）。
2. 另開小單：headless 同步開放 raw command（見任務 2 評估）。
3. 若需要「非 Worker 分頁手動 bat-notify」，請塔台決策（目前為 Forbidden）。

### Commit

- `2c59edee` feat(T0575): local PTYs get per-PTY batcap. capability instead of server token（產品 + 測試 + CLAUDE.md + 本回報；未 push）

## 塔台結案（2026-10-17T19:36:07+0800）

**DONE**（source / test 層；runtime 實機待與 T0576 同版發佈後驗收）。塔台複驗 @ `2a1e8a62`：`npm run typecheck` 0、`npm run typecheck:electron` 0、`npm run test:unit` 267 檔 / 4688 passed / 3 skipped。`2c59edee` 變更範圍與 affects_files 一致。

塔台裁決（D149 範圍內）：
- 「非 Worker 分頁手動 `bat-notify --target`」、「Worker 分頁再派工 / set-role / close-worker」、「`--set-role --terminal-id <別人>`」改為 Forbidden：**接受**（與 headless 一致，正是 T0574 R3 要關的越權面；CT 正常流程不受影響）。
- headless 同步開放 raw command：**記為 PLAN-047 後續小單**，排在 T0576 之後，暫不開。
- 「`pty:create` 早於 replay 時替同 id 再簽權杖」的時序：已寫入 T0576「塔台補充」為必做項。

