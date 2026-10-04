---
schema_version: 1
schema_kind: workorder
id: T0447
title: "T0445 #1/#2/#3（critical/high）：RemoteServer 連線狀態預設拒絕（撤銷後 helper 不得落入 client invoke）、helper channel 原型鍵防護、未認證 null frame / message handler 例外防護、bat-server.mjs 程序級 handler"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P0
sizing: S
created_at: "2026-10-05T06:32:48+08:00"
started_at: "2026-10-05T06:34:35+08:00"
updated_at: "2026-10-05T06:41:15+08:00"
completed_at: "2026-10-05T06:41:15+08:00"
target_version: next
depends_on: []
related:
  - "T0445 安全 review（`2161b7e`）findings #1 / #2 / #3 與拆單 1；結論 BLOCK"
  - "T0432（`aec20c0`）"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - scripts/bat-server.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0445 回報區 findings #1 / #2 / #3 的「觸發情境」與「建議修法」欄，逐條落實，並把 T0445 scratchpad PoC 的情境改寫成 repo 內負向測試（PoC 原檔在 scratchpad 不可依賴，依 findings 描述重寫）。"
  - "🔴 #1：已認證連線的 invoke **預設拒絕**——只有 `this.clients.has(ws)` 才走 client 路徑、只有 `helpers.has(ws)` 才走 helper 路徑，兩者皆非 → 回錯並 `ws.terminate()`；撤銷分支改 `terminate()`（不留 CLOSING 窗口）。測試：撤銷後 pipelined frame 與延遲 frame（client 不回 close frame）都不得到達 `invokeHandler`（以 spy 斷言零呼叫，並斷言 PTY 未被建立）。"
  - "🔴 #2：`HELPER_CHANNEL_ROLES` 查表改 `Object.hasOwn` / `Map` / null-prototype，先驗 `typeof channel === 'string'`；`handleHelperFrame` 全段 try（例外 = invoke-error）。測試 `constructor` / `__proto__` / `toString` / `hasOwnProperty` / `valueOf` / 非字串 channel。"
  - "🔴 #3：`JSON.parse` 後驗 frame 為非 null 物件、`type` 為字串，否則 close；整個 message handler 包 try。`scripts/bat-server.mjs` 加 `unhandledRejection` / `uncaughtException` 記錄 handler（只記錄、不吞掉致命錯誤的語意需說明：uncaughtException 記錄後是否結束行程，回報區說明取捨）。測試：未認證 `null` / `1` / `\"str\"` / `[]` frame 不使 server 行程結束。"
  - "🔴 Electron 本機 RemoteServer 行為：只有預設拒絕變嚴（不存在於 clients 的已認證 socket 本來就不該 invoke），其餘不變。"
  - "🔴 T0433 平行改 `headless-entry.ts` / `pty-manager.ts` / bundle 腳本；本單不碰那些檔。共用檔若被動到，以 `git diff` + `git apply --cached` 精準 stage。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0447 — RemoteServer 預設拒絕 + frame 強化（T0445 #1/#2/#3）

## 範圍

見 memory_overrides 第 2-4 條。

## 驗收條件

- [x] 三個 finding 各有負向測試，並附「修正前會失敗」的證據（例如先寫測試看到紅，再修綠；回報區記錄）
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [x] 回報區逐條對應 T0445 #1 / #2 / #3

## Sub-session 執行指示
1. 讀本工單 + T0445 回報區全文 + T0432 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫負向測試（紅）→ 修 → 綠
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 present（`affects_files` 3 檔皆存在、兩個測試目錄皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 驗收條件：
  - [x] 三個 finding 各有負向測試 + 修正前紅燈證據（見「紅 → 綠」）
  - [x] `npm run test:unit` 全綠：**147 files / 2371 passed / 1 skipped**；`npx tsc --noEmit` = **39**（≤ 39；本單檔案 0 筆）
  - [x] 回報區逐條對應 T0445 #1 / #2 / #3（下表）

### 產出摘要

**逐條對應 T0445**

| T0445 # | 修法（落點） | 負向測試 |
|---|---|---|
| **#1 critical** 撤銷後 helper 落入 client invoke | `remote-server.ts` message handler：`helpers.has(ws)` → helper 路徑之後，新增**預設拒絕閘門** `!this.clients.has(ws)` → 回 `Not authenticated` + `ws.terminate()`（client 路徑只剩「確實在 `clients` 內」才可達）；`handleHelperFrame` 撤銷分支 `ws.close()` → `ws.terminate()`（不留 CLOSING 窗口） | `headless-frame-hardening.test.ts`：①撤銷後 pipelined `[ping, invoke pty:create, invoke fs:readdir]` → `invokeHandler` spy **0 次**、close code `1006`（terminate）、`pty:get-buffer(evilId)` = null；②撤銷後 client **停止讀取**（`_socket.pause()`，不回 close frame）、400 ms 後送 `pty:create` → spy 0 次、PTY 不存在 |
| **#2 high** 原型鍵 channel → TypeError → unhandled rejection | `helper-capability.ts` `authorizeHelperInvoke`：先 `typeof channel !== 'string'` 拒、再 `Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel)`（tsconfig lib = ES2020，不能用 `Object.hasOwn`）；非陣列 args → `invalid-args`。`remote-server.ts` `handleHelperFrame`：ping / args 正規化 / 授權 / handler 全段同一個 try（例外 = `invoke-error`）；非陣列 args 不再走 `.slice`（原本 `{0:…, length:2}` 會在 try 外 TypeError） | `helper-capability.test.ts`（純函式）：`constructor` / `__proto__` / `toString` / `hasOwnProperty` / `valueOf` / `isPrototypeOf` / `__defineGetter__` × 兩角色不拋錯且 `channel-not-allowed`；number / object / array / null / undefined / boolean channel；非陣列 args。`headless-frame-hardening.test.ts`（真 wss）：上述 5 原型鍵 + number / object / array channel → `Forbidden: channel-not-allowed`、spy 0 次、連線仍開、無 unhandled rejection、server 仍回應；worker 送 `{0: towerId, length: 2}` → `Forbidden: invalid-args` |
| **#3 high** 未認證 `null` frame 打掉 headless 行程 | `remote-server.ts`：`JSON.parse` 後 `isFrameShape`（非 null、非陣列物件、`type` 為字串）否則 `ws.close()`；整個 message handler 抽成 `handleMessage`，listener 以 try 包覆（例外 → log + 移出 clients / helpers + `terminate`）。`scripts/bat-server.mjs`：`unhandledRejection` / `uncaughtException` 程序級 handler（取捨見下） | `headless-frame-hardening.test.ts`：未認證 `null` / `1` / `"str"` / `[]` / `{"type":5}` / 無 type → 連線關閉、無 unhandled rejection、server 仍回應；已認證 client 送 `null` / `[]` / `"str"` → 關閉、spy 0 次。`scripts/__tests__/bat-server-process-handlers.test.mjs`（spawn 真 `bat-server.mjs` + 假 `BAT_SERVER_ENTRY`）：rejection → 記錄且行程存活；exception → 記錄、呼叫 `server.stop()`、exit 1 |

**`bat-server.mjs` uncaughtException 取捨**：
- `unhandledRejection` → **只記錄、行程繼續**。rejection 是單一非同步操作失敗，不代表行程狀態損毀；且 RemoteServer 已把每個 frame 包在 try 內，這層是縱深防禦，目的正是「單一 frame 不得打掉所有 PTY / agent」
- `uncaughtException` → **記錄後 best-effort `server.stop()` 再 `exit(1)`**（5 s 保底 `exit(1)`，`unref`）。Node 文件明載 uncaughtException 後行程狀態未定義，吞掉繼續跑可能讓 PTY / 權杖 registry 處於不一致狀態，屬「吞掉致命錯誤」；交由 supervisor（systemd unit / launcher）重啟。已在 `stopping` 中（例如 SIGINT 收尾時）再發生 exception 不重入

**Electron 本機 RemoteServer 行為**：只有預設拒絕變嚴（已認證但不在 `clients` 的 socket 只會在 `error` 後被 drop 才出現，本來就不該 invoke）；malformed frame 改為關閉連線（BAT RemoteClient 只送物件 frame，不受影響）；其餘不變

**紅 → 綠證據**
- 紅（修正前，先寫測試）：3 files / **24 failed | 60 passed**。代表性訊息：`expected "vi.fn()" to not be called at all, but actually been called 2 times`（#1 pipelined）/ `… 1 times`（#1 延遲）；`TypeError: roles.includes is not a function`（#2 × 7 原型鍵）；helper 原型鍵 frame 與未認證 / 已認證 `null` frame 5 s 無回應（server 該 frame 產生 unhandled rejection）；bat-server `expected 1 to be undefined`（行程因 rejection 結束）與 stderr 無 `[bat-server] uncaughtException`
- **額外發現**（紅燈時暴露，已一併修）：陣列 channel `['pty:write']` 會被 `HELPER_CHANNEL_ROLES[channel]` 字串化命中白名單鍵（tower 得 `role-not-allowed` 而非 `channel-not-allowed`；worker 則通過查表，靠後段 `switch` 嚴格比對才落到 default 拒絕）。`typeof` 檢查後一律 `channel-not-allowed`
- 綠：本單 3 檔 + `headless-helper-capability` + `headless-server` = 5 files / **127 passed**；全套見下

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PASS | 147 files / 2371 passed / 1 skipped |
| `npx tsc --noEmit` | PASS | 39（≤ 39；本單檔案 0） |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| WSL 部署 / 實機 | 未做 | 依工單不部署 |

**變更檔案**：`electron/remote/remote-server.ts`、`electron/remote/helper-capability.ts`、`scripts/bat-server.mjs`、`electron/remote/__tests__/helper-capability.test.ts`、`electron/remote/__tests__/headless-frame-hardening.test.ts`（新）、`scripts/__tests__/bat-server-process-handlers.test.mjs`（新）、本工單。T0433 平行改動的 `headless-entry.ts` / `pty-manager.ts` / bundle 腳本未碰。

### 遭遇問題

1. **`AttachConsole failed` stderr 雜訊**：跑既有 `headless-helper-capability.test.ts` 時出現 6 行（Windows node-pty / conpty kill 路徑的輸出），測試全綠；新測試檔單跑為 0 行。依 L138 不可 stash 回 HEAD 對照，**未驗證是否為既有雜訊**，僅記錄
2. **測試以 `ws` 內部 `_socket.pause()` 模擬「不回 close frame」的 client**（T0445 PoC 原檔在 scratchpad，依 findings 描述重寫）；依賴 `ws` 私有欄位，`ws` 大版本升級時若失效需改成手寫 TLS + frame 的 raw client
3. **未處理（範圍外，T0445 拆單 3 / 4 / 5）**：#5 loopback ban、#6 `pty:write` 內容過濾、#7 tower 子 PTY 上限、#8 helper 成功清除失敗計數、#9 拒絕 log 的 `channel` 限長跳脫（本單 log 改為 `String(frame.channel)`，未限長）

**Commit**：`git add` 2 個新檔後 `git commit --only` 本單 7 個路徑；不 push。hash 見 `git log`（回報區於 commit 前寫入，不自我引用）。

### 回報時間

2026-10-05T06:40:33+08:00
