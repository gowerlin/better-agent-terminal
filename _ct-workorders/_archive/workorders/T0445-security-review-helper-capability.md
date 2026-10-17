---
schema_version: 1
schema_kind: workorder
id: T0445
title: "安全 review：T0432 每 PTY 範圍權杖（helper-capability.ts / remote-server.ts auth 與 invoke 路徑 / pty-manager exit hook / headless-entry 接線）——對抗式審查，只出 findings"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T06:22:20+08:00"
started_at: "2026-10-05T06:23:06+08:00"
updated_at: "2026-10-05T06:32:19+08:00"
completed_at: "2026-10-05T06:32:19+08:00"
target_version: next
depends_on: []
related:
  - "T0432（`aec20c0`）回報區全文，尤其「殘餘風險」3；T0420 §2 安全分析（🟡 要求 review）"
  - "T0433（平行：權杖注入 PTY env + helper 出貨）"
  - "D134 追加（塔台 06:22 依授權直接決定）"
affects_files:
  - _ct-workorders/T0445-security-review-helper-capability.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **review 單不改產品程式碼**，只寫本工單回報區。可在 scratchpad 寫 PoC 測試驗證疑點，但不得留在 repo。"
  - "🔴 審查對象以 `git show aec20c0` 為準（+ 相關既有程式）。T0433 平行改 `headless-entry.ts` / `pty-manager.ts` / bundle 腳本：若讀到工作樹未提交改動，在 finding 註明「工作樹版本」。"
  - "🔴 只回報**有具體觸發情境**的 finding（輸入 / 狀態 → 越權結果），每條標嚴重度（critical / high / medium / low）與 CONFIRMED（有 PoC 或確定的程式碼路徑）/ PLAUSIBLE。不列風格建議。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；只 commit 本工單；不 push。"
---

# T0445 — 安全 review：每 PTY 範圍權杖

## 審查重點

1. **認證**：權杖 / server token 比對（`safeTokenEqual`、digest 查表）、暴力破解節流是否涵蓋權杖路徑、client ↔ helper 角色轉換（T0432 註明兩條防禦分支無測試）、rotate 寬限期
2. **授權**：`authorizeHelperInvoke` 白名單與 target 綁定能否繞過——args 形狀異常（陣列 / 物件 / 原型污染 / 非字串 id）、`customEnv` 夾帶、`create-agent-command` 的 `cwd` / `agent` / `prompt` / `agentCustomArgs` 能否被用來執行任意指令到他人 PTY 或越出 PTY 擁有者權限
3. **TOCTOU**：T0432 殘餘風險 3-1（id 不存在檢查與 `ptyManager.create` 之間的 await）
4. **撤銷**：PTY exit / kill / restart / stale exit / server stop 的撤銷完整性；每 frame 重查
5. **資訊外洩**：log、auth-result metadata、錯誤訊息是否含權杖 / server token / 路徑
6. **廣播隔離**：helper 是否可能收到 `pty:output` 等其他 PTY 資料；`countBroadcastReceivers` 正確性
7. **DoS**：helper 連線數 / frame 頻率有無上限；大量 helper 連線是否影響 T0404 回收或 client

## 回報要求

- findings 表：`# / 嚴重度 / 判定 / 觸發情境 / 結果 / 位置（檔案:行）/ 建議修法`
- 結論：可否進入 T0433 / T0434 的實機階段（PASS / PASS with fixes / BLOCK）
- `### 拆單建議摘要`（若有需修的 finding）：表格欄位 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`

## Sub-session 執行指示
1. 讀本工單 + T0432 / T0420 回報區 + `git show aec20c0`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 審查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（review 單：只出 findings，未改產品程式碼）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 not applicable（`affects_files` 僅本工單）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 審查對象：`git show aec20c0`（T0432）+ 相關既有程式（`remote-server.ts` message handler / auth 節流、`handler-registry.ts`、`terminal-command-handlers.ts`、`handlers/terminal.ts`、`handlers/pty.ts`、`pty-manager.ts` restart / create、`scripts/bat-server.mjs`、`scripts/bat-notify.mjs` / `bat-terminal.mjs`）。開審時工作樹已有 T0433 未提交改動（`pty-manager.ts` `helperEnv` hook、`headless-entry.ts` `buildHeadlessHelperEnv`），finding #4 據此標「工作樹版本」
- **PoC**：全在 scratchpad（`<scratchpad>/t0445/*.poc.test.ts` + 獨立 vitest config，`root` 指 repo、`include` 只含 scratchpad），真 wss + 真 node-pty（T0388 harness）。**repo 內未留任何檔案**；未用 `git stash` / `reset` / `checkout --` / `restore`
  - `capability.poc.test.ts`：6/6 PASS（#2）
  - `nullframe.poc.test.ts`：1/1 PASS（#3）
  - `revoked-escalation.poc.test.ts`：`pipelined` PASS ×4（含 3 次重跑）、`ignore-close-delayed-2s` PASS；`delayed-200ms`（`ws` client 會自動回 close frame）未觸發 —— 見 #1
  - Node 語意示範：`node -e`（EventEmitter async listener 拋錯、無 `unhandledRejection` handler）→ 行程 `exit=1`（Node v24.21.0）

### Findings

| # | 嚴重度 | 判定 | 觸發情境 | 結果 | 位置（檔案:行，`aec20c0`） | 建議修法 |
|---|---|---|---|---|---|---|
| 1 | **critical** | CONFIRMED（PoC） | helper 連線的權杖被撤銷（其 PTY exit / kill —— worker 本來就短命；持權杖者也可自己 `setsid` 一個子行程後 `exit` 讓 PTY 結束）後，送 `ping` 觸發撤銷分支，**緊接著**（同一批 pipelined，或不回 close frame 的 client 在 `ws` closeTimeout 30 s 內任意時間）再送 `invoke` | 撤銷分支只做 `dropHelper(ws)` + `ws.close()`，但 message 閉包內 `authenticated` 仍為 `true`；下一個 frame `helpers.has(ws)` 為 false → **掉進一般 client 的無限制 invoke 路徑**（`invokeHandler(frame.channel, …, this.clients.get(ws)?.connectionId)` 容忍 client 不存在）。PoC：撤銷前 `pty:create` = `Forbidden: channel-not-allowed`；撤銷後同連線 `pty:create` **實際建立了 PTY**（BAT client 再 create 同 id 得 `created:false`；回應因 socket 已 CLOSING 被 `sendFrame` 吞掉，攻擊者看不到但副作用成立）。⇒ 任何 helper 權杖（含外洩的）等價 server token：`pty:create` / `terminal:create-with-command` / `fs:*` / `claude:*` / `settings:*` 全開。遠端外洩情境的穩定打法：持續成對送 `[ping, invoke 惡意]`，存活時只是被拒，PTY 一結束下一對就生效 | `remote-server.ts:532-561`（`authenticated` 判斷後直接走 client 路徑）、`:771-781`（`handleHelperFrame` 撤銷分支） | client 路徑改**預設拒絕**：`authenticated` 之後須 `this.clients.has(ws)` 才可 invoke，否則回錯並 `ws.terminate()`；撤銷分支改 `ws.terminate()`（不留 CLOSING 窗口）並把 socket 標 dead；補負向測試「撤銷後 pipelined / 延遲 frame 不得到達 `invokeHandler`」 |
| 2 | **high** | CONFIRMED（PoC + Node 語意） | 任何 helper（T0433 後 = 每個 headless PTY 內的程序，或外洩權杖持有者）送 `{type:'invoke', channel:'constructor'}`（或 `__proto__` / `toString` / `hasOwnProperty` / `valueOf`） | `HELPER_CHANNEL_ROLES[channel]` 取到 `Object.prototype` 上的成員（truthy）→ `roles.includes` 不是函式 → `TypeError`；`authorizeHelperInvoke` 呼叫不在 try 內 → async `message` listener 的 promise reject → **unhandled rejection**。`scripts/bat-server.mjs` 沒有 `process.on('unhandledRejection')`、launcher 無旗標，Node 24 預設 throw ⇒ **整個 headless server 行程結束，所有 PTY / agent 一起死**（PoC：真 server 上該 frame 無回應且產生 unhandled rejection） | `helper-capability.ts:170-172`；`remote-server.ts:793`（try 之外）；`scripts/bat-server.mjs`（無 handler） | 查表改 `Object.hasOwn(HELPER_CHANNEL_ROLES, channel)` 或 `Map` / null-prototype，並先 `typeof channel === 'string'`；`handleHelperFrame` 整段包 try（拒絕 = invoke-error）；補 `constructor` / `__proto__` 負向測試 |
| 3 | **high** | CONFIRMED（PoC）—— **既有問題，非 T0432 引入**，但在本次審查的 auth 路徑上 | **未認證**連線送文字 frame `null` | `JSON.parse('null')` = `null` → `frame.type` TypeError → unhandled rejection → 同 #2，headless 行程結束。無需任何 token；可達面 = 能連到 port 者（預設 localhost：同機任何 uid、經 SSH tunnel 的對端；`tailscale` / `all` bind 則網路可達）。Electron 主程序有 `unhandledRejection` handler（只 log），不受影響 | `remote-server.ts:488-495`；`scripts/bat-server.mjs` | parse 後驗 `frame` 為非 null 物件（否則 close）；整個 message handler 包 try；`bat-server.mjs` 加 `unhandledRejection` / `uncaughtException` 記錄 handler（縱深防禦，避免單一 frame 打掉全部 PTY） |
| 4 | medium | CONFIRMED（程式碼路徑；**工作樹版本** T0433） | client 對 worker PTY 執行 `pty:restart`（UI 重啟分頁） | `PtyManager.restart` 以 `create({ id, cwd, type, shell })` 重建，**丟掉 `customEnv`**；T0433 的 `helperEnv(id, customEnv)` → `buildHeadlessHelperEnv` 因無 `BAT_TOWER_TERMINAL_ID` 而簽發 **tower** 權杖 ⇒ 重啟後的 worker 升為 tower（可 `create-agent-command`）、失去對原 tower 的 notify | `pty-manager.ts:975`（`restart`，工作樹）；`headless-entry.ts:239-242`（工作樹） | restart 時保留原 PTY 的 `customEnv`（至少 `BAT_TOWER_TERMINAL_ID`），或簽發處沿用舊 capability 的 role / towerId；T0433 補「restart 後角色不變」測試 |
| 5 | medium | CONFIRMED（程式碼路徑）—— 既有節流機制，T0432 擴大觸發面 | 5 次失敗 auth（10 分鐘窗口）來自 `127.0.0.1`：例如 helper 拿已撤銷 / 過期權杖重試（worker PTY 結束後仍存活的背景 bat-notify），或同機任何其他 uid 故意送錯 token | 失敗的權杖 auth 一律 `recordAuthFailure` → loopback 被 ban 10 分鐘；BAT client 經 SSH tunnel（`-L <port>:localhost:<remote>`）到達 server 時來源也是 loopback ⇒ **使用者 BAT 被擋在外（`Too many failed attempts`）**，所有 helper 也一併失效，且可每 10 分鐘重複 | `remote-server.ts:516-527`、`:102-128`；`ssh-tunnel.ts:91` | loopback 不做 IP ban（或 helper 權杖失敗與 server token 失敗分開計數、權杖失敗不計 ban）；權杖撤銷後的 auth 回 `Capability revoked` 而非記失敗 |
| 6 | medium | CONFIRMED（程式碼路徑；設計層） | worker 權杖（或其外洩）呼叫 `pty:write [towerId, "\x03\x03<任意指令>\r"]` | 白名單只綁 target、不限內容：可送 Ctrl-C 結束 tower 的 claude、再打任意 shell 指令並 `\r` 執行 ⇒ worker 權杖 = **在 tower PTY 內任意執行**，與 A'「外洩影響限於單一 PTY」不符（bat-notify 實際只需 pre-fill 文字，送出走 `terminal:keypress` Enter） | `helper-capability.ts:205-206` | helper 的 `pty:write` 限制 `data`：拒 C0 控制字元（含 `\r` / `\x03` / ESC），只允許可列印文字（`\n` / `\t` 依 bat-notify 多行需求另議）；送出一律走 keypress。塔台裁決是否接受為設計 |
| 7 | medium | CONFIRMED（程式碼路徑；T0432 殘餘風險 3-2 已記錄，列出供裁決） | tower 權杖（T0433 後 = 每個沒有 `BAT_TOWER_TERMINAL_ID` 的 headless PTY）重複呼叫 `create-agent-command`，`agent` / `prompt` / `cwd` / `workspaceId` 任意 | 外洩的 tower 權杖 = 以使用者身分開任意 agent / prompt（含 custom CLI agent）= 任意執行；且**無數量 / 頻率上限** → 打滿 `HEADLESS_MAX_PTYS_DEFAULT = 64` 後 BAT 自己的 `pty:create` 被 `PtyLimitError` 拒絕（使用者開不了終端），每個 PTY 還各啟一個 agent（API 成本） | `helper-capability.ts:175-198`；`terminal-command-handlers.ts:239-286`；`headless-entry.ts:70` | 每個 tower 權杖的存活子 PTY 上限（例如 ≤ 8）+ 建立頻率限制；保留 PTY 配額給 client（helper 建立不得吃滿最後 N 格）；`agent` 是否限 builtin 由塔台裁決 |
| 8 | low | CONFIRMED（程式碼路徑） | 持任一權杖者在同一 IP 交錯：4 次猜 server token 失敗 → 1 次權杖 auth 成功（清零）→ 重複 | helper auth 成功即 `authFailures.delete(clientIp)` ⇒ server token 暴力破解節流被繞過、猜測速率不受限。server token 為 128-bit 以上隨機值，實務上不可行（縱深防禦） | `remote-server.ts:514` | 只有 server token 成功才清除失敗計數；helper 成功不動計數 |
| 9 | low | CONFIRMED（程式碼路徑） | helper 反覆送被拒的 invoke，`channel` 帶換行或超長字串（`maxPayload` 32 MiB）；或大量開 helper 連線 | 拒絕 log 原樣寫入攻擊者控制的 `frame.channel`：可偽造 log 行（如假 `Client authenticated`）、每 frame 最多 ~32 MiB、無頻率上限 → 灌爆 log 磁碟；helper 連線數無上限、heartbeat 不 ping helper（半開連線永不清除） | `remote-server.ts:796`、`:742-752`、heartbeat（`:607-612`） | log 前 `channel` 限長（如 64）+ 跳脫控制字元，非字串直接拒；每權杖連線數上限、helper 拒絕次數節流；heartbeat 一併 ping / terminate helper |

**已審查、無具體越權情境（不列 finding）**

- **TOCTOU（T0432 殘餘 3-1）**：`isTerminalAlive` 檢查與 `ptyManager.create` 之間隔 `await buildAgentPromptCommand`。要利用須讓**別人**在窗口內以同 id 建 PTY；bat-terminal 的 id 為 `randomBytes(16)`（`bat-terminal.mjs:354`）、helper 收不到廣播（看不到 `created-externally`），無法預測他人 id。同一 tower 自己併發兩次同 id 只會把指令打進自己剛建的 PTY，不越權。⇒ 維持 T0432 判斷，不另開單（#1 修完後亦無 client 路徑可借道）
- **權杖比對**：`safeTokenEqual` 先比長度再 `timingSafeEqual`；registry 以 SHA-256 digest 查表後再 `timingSafeEqual`，攻擊者無法控制 digest，查表時序不洩漏權杖；rotate 寬限期舊 token 亦走 `safeTokenEqual`
- **args 形狀**：非陣列 / 類陣列物件 / 字串 args → `authorizeHelperInvoke` 以 `args[0]` 等值比對 target，偽造 `{0: towerId, length: 2}` 可過授權但 `invokeHandler` spread 非 iterable 會 TypeError 並被 try 接住；`customEnv` 的 `__proto__` 鍵（`JSON.parse` 產生 own property）不在白名單 → 拒；`shell` 非空任何型別皆拒
- **角色轉換**：helper socket 再以 server token auth → `dropHelper` 後成為 client（本來就持有 token）；client socket 以權杖 auth → `acceptHelper` 拒絕 → 走失敗分支關閉連線（不降級、不保留廣播）。無越權
- **撤銷完整性**：`exit`（`:419` / `:436`）、`kill`（兩分支）、`killAll`（經 `kill`）、restart 內的 kill 皆呼叫 `notifyPtyExit`；stale exit 不撤銷新權杖；server `stop()` → `clear()` + 關閉 helper 連線；每 frame 重查 `lookup`。缺口僅 #1（撤銷後連線的處置）與 #4（restart 重新簽發的角色）
- **廣播隔離 / 計數**：`broadcastListener` 只迭代 `clients`；`countBroadcastReceivers` 只數 `clients` 並排除呼叫者；helper 不計入 `getClientCount()`（T0404 回收）。#1 升格後的 socket 也不在 `clients`，不會收到廣播（但已可主動 invoke `pty:get-buffer` 讀任何 PTY，屬 #1 範圍）
- **資訊外洩**：啟動 log 已不印 token 前綴；helper 相關 log 只含 role / terminal / channel / reason；權杖不出現在 `mirrorToBatScripts`（bat-terminal 送的 `customEnv` 不含權杖）。auth-result 回 `buildAuthMetadata`（platform / arch / node / bundleVersion / WSL home），helper 本在該主機內，無機密
- **T0433 工作樹其他部分**：`helperEnv` 於 spawn 失敗時 `notifyPtyExit` 撤銷、idempotent re-create 不重簽、`BAT_*` 繼承 env 仍被 scrub，未見額外越權

### 結論

**BLOCK**（對 T0433 / T0434 的實機階段）

- **#1（critical）** 讓 A' 的範圍限制整個失效：任何權杖在其 PTY 結束後即可升格為完整 client。目前 `aec20c0` 生產路徑尚未簽發權杖（`issue()` 只在 T0433 工作樹被呼叫），故**現在無實際曝險**；但 T0433 一合入、實機開始簽發，即可利用。
- **#2（high）** 同樣在 T0433 後成為「任一 PTY 內程序一個 frame 打掉整個 headless server」。
- **#3（high）** 為既有問題、**現在已可利用**（未認證、單一 frame），與 #2 同一修法家族，建議一併修。
- #1 + #2（+ #3）修正並補負向測試後 → 可視為 **PASS with fixes**，再進 T0433 / T0434 實機。#4 應在 T0433 內一併處理（同檔、同機制）。#5–#9 不阻擋實機驗證，可排後續。

### 拆單建議摘要

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|---|---|---|---|---|
| 1 | RemoteServer 連線狀態預設拒絕：撤銷後 helper 不得落入 client invoke（`clients.has` 閘門 + `terminate`）+ `authorizeHelperInvoke` 原型鍵防護與 try 包覆 + 未認證 `null` frame / message handler 例外防護 + `bat-server.mjs` 程序級 handler（#1 / #2 / #3） | PLAN-036 | T0432（`aec20c0`） | S | 🔴 阻擋 T0433 / T0434 實機 |
| 2 | T0433 內處理：`pty:restart` 保留 `customEnv` / 原 capability 角色，補「restart 後角色不變」測試（#4） | PLAN-036 | T0433 | XS | 🟡 併入 T0433 |
| 3 | auth 節流與 helper 分流：loopback 不 ban 或權杖失敗分開計數、helper 成功不清 server token 失敗數、撤銷權杖回 `Capability revoked`（#5 / #8） | PLAN-036 | 拆單 1 | S | 🟡 |
| 4 | helper 能力收斂（設計裁決）：`pty:write` 內容過濾（拒控制字元）、tower 子 PTY 數量 / 頻率上限與 client 配額保留（#6 / #7） | PLAN-036 | 拆單 1；塔台裁決 | M | 🟡 需裁決 |
| 5 | helper 連線衛生：拒絕 log 的 `channel` 限長跳脫、每權杖連線數上限、heartbeat 涵蓋 helper（#9） | PLAN-036 | 拆單 1 | XS | 🟢 |

### 回報時間

2026-10-05T06:30:56+08:00
