---
schema_version: 1
schema_kind: workorder
id: T0432
title: "PLAN-036 P3 / K 工單 2：RemoteServer 每 PTY 範圍權杖（簽發 / 撤銷 / channel 白名單 / 目標綁定）+ token 比對 timingSafeEqual + log 不印 token 前綴"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: "2026-10-05T06:09:09+08:00"
updated_at: "2026-10-05T06:21:58+08:00"
completed_at: "2026-10-05T06:21:58+08:00"
target_version: next
depends_on:
  - T0431
  - T0424
related:
  - "T0420 研究回報區「各單內容」工單 2、§2 安全分析；方案 A'（使用者裁決）"
  - "T0420「遭遇問題」範圍外 ②：`remote-server.ts:551` log 印出 token 前 8 碼（塔台併入本單）"
  - "D134 追加（K 實作）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - electron/remote/headless-entry.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **安全單**（T0420 標 🟡）：預設拒絕。權杖只能呼叫白名單 channel（T0420 定義：`terminal:create-with-command` / `create-agent-command` / `notify` / `keypress` 的子集，依角色），且只能作用於綁定的 target；**不得**呼叫 `pty:create` / `pty:write`（Tower 權杖）/ `fs:*` / `claude:*` / `git:*` / `profile:*` / `settings:*`。每條負向測試都要有。"
  - "🔴 權杖：`crypto.randomBytes(32)`，只存記憶體（不落地、不寫 log、不進 snapshot），PTY exit 即撤銷，server restart 後全部失效。server token 與權杖的比對一律 `crypto.timingSafeEqual`（長度不同先回 false）。"
  - "🔴 log：移除 / 遮蔽 `remote-server.ts` 印出 token 前綴的 log（T0420 範圍外 ②，併入本單）；新 log 只記 terminalId / role，不記權杖任何部分。"
  - "🔴 helper 連線不計入 idle reclaim / 孤兒 PTY 回收的 client 數（T0404 機制），否則遠端 helper 一直連著會讓孤兒 PTY 永不回收。"
  - "🔴 本單只提供簽發 / 驗證機制與 PTY exit hook；**不**把權杖注入 PTY env（T0433）。本機 Electron 的 RemoteServer 行為：權杖機制可共用，但本機 PTY 注入方式不變（回移 A' 不在範圍，T0420 範圍外 ③）。"
  - "🔴 依賴 T0431（handler 路由）與 T0424（同改 `pty-manager.ts` / `handlers/pty.ts`）。開工前 `git log --oneline -8` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0432 — 每 PTY 範圍權杖（K 工單 2）

## 背景

T0420 方案 A'：headless 為每個 PTY 簽發範圍權杖，讓遠端 shell 內的 helper（`bat-terminal.mjs` / `bat-notify.mjs`）只能做少數 Tower 操作，外洩影響限於單一 PTY。本單實作 server 端機制。

## 範圍

依 T0420「各單內容」工單 2：
1. `electron/remote/helper-capability.ts`（新）：`HelperCapabilityRegistry`（簽發 / 查詢 / 撤銷；`token → { terminalId, towerId?, role }`）
2. RemoteServer auth：接受權杖 → 連線標 helper 角色；invoke 時檢查 channel 白名單與 target 綁定
3. PTY exit hook 撤銷；helper 連線不計入 client 數
4. `timingSafeEqual`；log 遮蔽
5. 負向測試全套（memory_overrides 第 1 條）+ 正向：合法權杖可呼叫白名單 channel

## 驗收條件

- [ ] 回報區附白名單表（角色 × channel × target 規則）與負向測試清單
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 完成後塔台會安排安全 review（T0420 🟡）

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區全文（尤其 §2 安全分析）+ T0431 回報區 + T0404 回報區（client 計數 / 回收）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 `affects_files` 皆有既存祖先（present；`helper-capability.ts` 為新檔，`electron/remote/` 已存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 依賴確認：開工時 `git log --oneline -8` 含 `9fa2cc3`（T0431）、`49175ef`（T0424 verified）
- 驗收條件：
  - [x] 白名單表與負向測試清單（見下）
  - [x] `npx tsc --noEmit` = **39**（≤ 40；本單檔案 0 筆）
  - [~] `npm run test:unit`：**2197 passed / 1 failed / 1 skipped（137 files）**。唯一失敗 `headless-always-local.test.ts`「bindProxiedHandlersToIpc answers ALWAYS_LOCAL locally…」**非本單造成**：該測試以文字搜尋 `electron/main.ts`，而工作樹的 `main.ts` 正被並行的 T0443（BUG-110，IN_PROGRESS，未 commit）改寫、移除了 `remoteClient.invoke(channel, args)`。以同一判斷式驗證：HEAD 版 `main.ts` → `pass=true`（262 / 1085），工作樹版 → `pass=false`（262 / -1）。本單未碰 `main.ts`；本單相關 8 檔（含 parity / electron-free / headless-terminal / orphan-pty / server）129/129 綠
  - [ ] 安全 review：交塔台安排（T0420 🟡）

### 產出摘要

**1. `electron/remote/helper-capability.ts`（新，無 `electron` import）**
- `HelperCapabilityRegistry`：`issue(terminalId, { towerId? })` → `randomBytes(32).toString('base64url')`；有 `towerId` = `worker`，否則 `tower`。registry **只存 SHA-256 digest**（不存權杖本體），`verify` 以 digest 查表後再 `timingSafeEqual`；`lookup(key)`（每個 frame 重查撤銷）、`revokeTerminal(id)`、`clear()`。同一 PTY 重新簽發即撤銷舊權杖（一 PTY 一權杖）；terminal / tower id 須符合 `/^[a-zA-Z0-9._-]+$/`
- `safeTokenEqual`：長度不同先回 false，再 `crypto.timingSafeEqual`
- `authorizeHelperInvoke(capability, channel, args, { isTerminalAlive })`：純函式、預設拒絕

**白名單表（角色 × channel × target 規則）**

| channel | tower（PTY 無 notify target） | worker（PTY 帶 `BAT_TOWER_TERMINAL_ID`） | target / 參數規則 |
|---|---|---|---|
| `terminal:create-agent-command` | ✅ | ❌ `role-not-allowed` | `id` 必須是**不存在**的 PTY（`isTerminalAlive` 缺席即拒，fail closed）——因 `create-with-command` 對既存 id 會把指令打進該 PTY；`customEnv.BAT_TOWER_TERMINAL_ID` 只能是呼叫者自己（或不給）；`customEnv` key 限 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` / `MSYS_NO_PATHCONV`（= bat-terminal 實際送的），值須為字串；不得指定 `shell` |
| `terminal:notify` | ❌ `role-not-allowed` | ✅ | `targetId` === 綁定的 tower |
| `pty:write` | ❌ `role-not-allowed` | ✅ | `args[0]` === 綁定的 tower |
| `terminal:keypress` | ❌ `role-not-allowed` | ✅ | `targetId` === 綁定的 tower |
| 其他所有 channel（`pty:create` / `pty:kill` / `pty:restart` / `pty:get-buffer` / `terminal:create-with-command` / `fs:*` / `image:*` / `workspace:*` / `claude:*` / `git:*` / `worktree:*` / `github:*` / `profile:*` / `settings:*` / `remote-tools:*` …） | ❌ | ❌ | `channel-not-allowed`（handler 不會被呼叫） |

**2. `electron/remote/remote-server.ts`**
- server token 比對（含 rotate 寬限期的舊 token）改 `safeTokenEqual`（`timingSafeEqual`）
- auth：server token → client（原行為）；否則若有注入 registry 且權杖有效 → **helper 連線**（獨立的 `helpers` map）；皆否 → 原失敗路徑（計入暴力破解節流 + `Invalid token`）。未注入 registry（Electron）時權杖永不被接受 ⇒ 本機行為不變
- helper 連線：每個 frame 先 `lookup` 撤銷狀態（已撤銷 → `Capability revoked` + 關閉連線）→ `authorizeHelperInvoke` → 通過才 `invokeHandler`；拒絕回 `invoke-error` `Forbidden: <reason>`（連線保留，bat-notify 的 notify 失敗非致命）
- helper **不收廣播**（不會看到其他 PTY 的 `pty:output`）、**不計入** `getClientCount()`（T0404 回收）；新增 `countBroadcastReceivers(excludeConnectionId)`、`getHelperConnectionCount()`；heartbeat / stop 一併清理 helper
- 一個 socket 只能是 client 或 helper：server token 重新 auth 會先移出 helper；client socket 不能降為 helper
- log：移除啟動 log 的 `token=<前 8 碼>`（T0420 範圍外 ②）；新增 `Helper authenticated / disconnected / capability revoked / invoke denied` 只記 `role` / `terminal` / `channel` / `reason`

**3. `electron/pty-manager.ts`**：`PtyManagerDeps.onPtyExit?(id)`——`kill` / `killAll` / restart 內的 kill / 自行 exit 時呼叫；被取代進程的 stale exit **不**呼叫（新 PTY 的權杖不會被舊進程的晚到 exit 撤銷）；listener 例外只 warn。Electron 不傳 ⇒ 行為不變

**4. `electron/remote/headless-entry.ts`**
- `createHeadlessServer`：每個 server 一個 `HelperCapabilityRegistry`（`HeadlessServerOptions.helperCapabilities` 可注入，供測試 / T0433），傳給 RemoteServer（含 `isTerminalAlive` = PtyManager）；`stop()` 時 `clear()` ⇒ 重啟後全部失效（registry 只在記憶體）
- `createHeadlessPtyModule({ helperCapabilities })`：PTY exit / kill → `revokeTerminal`（log 只記 terminal id）
- T0431 的 `countRemoteReceivers` 改 `remoteServer.countBroadcastReceivers(ctx.connectionId)`：helper 呼叫或只是連著都不再被算成接收者（T0431 遭遇問題 ③ 一併精確化）
- **未**把權杖注入 PTY env、未改 `isHeadlessScrubbedEnvKey`（T0433 範圍）。T0433 接法：`helperCapabilities.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID })`，exit hook 已就緒

**5. 測試**（新增 3 檔）

| 檔案 | 內容 | 結果 |
|---|---|---|
| `electron/remote/__tests__/helper-capability.test.ts` | registry：32 bytes、tower / worker 綁定、偽造 / 空 / 非字串 / 長短一字元皆拒、狀態內不含權杖本體、撤銷 / 重簽撤舊 / clear、id 白名單、回傳為副本；`safeTokenEqual`；白名單恰為 4 channel；**24 個非白名單 channel × 兩角色**；tower 寫 PTY / notify / keypress 被拒；worker create 被拒；worker 對他 PTY / 自己 / 缺 target 被拒；create 對既存 id / 無 liveness / 綁他塔 / 非白名單 env / shell / 非法 id 被拒；bat-terminal 實際 payload 放行 | 48/48 |
| `electron/remote/__tests__/headless-helper-capability.test.ts` | 真 wss + 真 node-pty：正向（tower 建 worker → BAT 收 `created-externally`；worker notify / pre-fill / submit）；**18 個真實已註冊 channel** 對 tower 與 worker 皆 `Forbidden: channel-not-allowed` 且無副作用（`evil-*` 未建、tower PTY 仍在）；tower 寫 PTY 被拒；worker 對他 PTY 被拒；create 覆蓋既存 id 被拒且該 PTY 未收到指令；偽造 token / server token 加字元被拒；PTY kill 後開著的連線 `Capability revoked`、重新 auth `Invalid token`；PTY 自行 `exit` 亦撤銷；server stop 清空、重啟 server 不認舊權杖；helper 收不到廣播；BAT 離線後 helper 不算接收者 → `no-client`；**helper 連著時 T0404 孤兒回收照常觸發**；log 不含 `token=`、不含 server token / 權杖前 8 碼，含 role / terminal | 31/31 |
| `electron/__tests__/pty-manager-exit-hook.test.ts` | kill / 自行 exit / killAll 皆通知；restart 後舊進程晚到 exit 不通知；listener 拋錯不影響 kill / exit；無 hook（Electron）行為不變 | 6/6 |

**負向測試清單**（memory_overrides 第 1 條逐項對應）：`pty:create` ✅、`pty:write`（Tower 權杖）✅、`fs:*`（readdir / readFile + image / workspace）✅、`claude:*`（start-session / list-sessions）✅、`git:*`（+ worktree / github）✅、`profile:*` ✅、`settings:*`（load / get-shell-path）✅、`terminal:create-with-command` ✅、非綁定 target（pty:write / notify / keypress）✅、PTY exit 後被拒 ✅、server restart 後失效 ✅

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PARTIAL（本單 PASS） | 137 files / 2197 passed / 1 failed / 1 skipped；失敗為並行 T0443 未 commit 的 `main.ts`（見上） |
| 本單相關 8 檔 | PASS | 129/129（含 parity / electron-free 守門） |
| `npx tsc --noEmit` | PASS | 39（≤ 40；本單檔案 0） |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| WSL 部署 / 實機 | 未做 | 依工單不部署；端到端屬 T0434 |

**變更檔案**：`electron/remote/helper-capability.ts`（新）、`electron/remote/remote-server.ts`、`electron/pty-manager.ts`、`electron/remote/headless-entry.ts`、上表 3 個測試檔、本工單。`electron/handlers/pty.ts` 未改（exit hook 放在 PtyManager，kill 經由 PtyManager 已涵蓋）。

### 遭遇問題

1. **`test:unit` 1 紅非本單**：見完成狀態。待 T0443 commit 後應自然轉綠（若 T0443 刻意改了該路由，則是 T0443 需同步更新 `headless-always-local.test.ts`）
2. **測試順序陷阱（已處理）**：handler registry 是 process 全域的，同一測試檔再起第二個 headless server 會把主 harness 的 handler 改指向新 server 的 PtyManager。已把「自起 server」的 3 個測試放到檔尾，並加註解
3. **殘餘風險（記錄，供安全 review）**：
   - `create-agent-command` 的「id 不存在」檢查與 handler 內 `ptyManager.create` 之間隔著 `await buildAgentPromptCommand`；這段期間若有 client 以同 id 建 PTY，指令會被打進該 PTY。觸發需 client（持 server token）配合，權杖持有者無法單獨利用
   - tower 權杖仍可用任意 prompt 開一個帶 `agentCustomArgs`（如 `--dangerously-skip-permissions`）的 agent（T0420 §2 已記錄：持有者本身即同 uid、跑在該 PTY 內，不構成越權）；`cwd` / `agent` / `prompt` / `workspaceId` 未加限制
   - helper 的 auth-result 仍回 `buildAuthMetadata`（platform / arch / node / WSL home，無機密），與 client 相同
   - 本機 Electron 的 PTY 仍注入全權 server token（回移 A' 不在範圍，T0420 範圍外 ③）
4. **未加測試的小項**：「client socket 不能降為 helper / server token 重新 auth 移出 helper」兩條防禦性分支無專屬測試（harness 不支援同一 socket 二次 auth）

**Commit**：`git add` 新檔 + `git commit --only` 本單 8 個路徑（index 另有 T0427 Worker 已 stage 的內容，`--only` 不帶入）。未 push、未部署 WSL。hash 見 `git log`（回報區於 commit 前寫入，不自我引用）。

### 回報時間

2026-10-05T06:20:46+08:00
