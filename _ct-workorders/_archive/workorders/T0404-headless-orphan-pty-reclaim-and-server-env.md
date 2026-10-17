---
schema_version: 1
schema_kind: workorder
id: T0404
title: "PLAN-036 遠端終端收尾 B：headless 孤兒 PTY 回收（無 client 閒置上限 + 每台 PTY 上限）+ BUG-103 auth metadata serverEnv 偵測 WSL"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T02:35:05+08:00"
started_at: "2026-10-05T02:36:33+08:00"
updated_at: "2026-10-05T02:45:51+08:00"
completed_at: "2026-10-05T02:45:51+08:00"
target_version: next
depends_on:
  - T0401
  - T0403
related:
  - "PLAN-036「P1 候選（T0390 回報）」第 2 點；D130 波次 ④（與 T0402 平行）"
  - "BUG-103（`remote-server.ts:154` `serverEnv: 'native'` 寫死）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **回收只在 headless server 啟用**：本機 Electron（Terminal Server / direct 模式）行為不得改變——本機 PTY 生命週期由視窗管理。"
  - "🔴 T0402 平行中：不得碰 `electron/handlers/claude.ts`、`src/`。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0404 — headless 孤兒 PTY 回收 + BUG-103（PLAN-036 遠端終端收尾 B）

## 元資料
- **工單編號**：T0404
- **任務名稱**：孤兒 PTY 回收 + serverEnv
- **狀態**：DONE
- **建立時間**：2026-10-05 02:35 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

- T0390 起 headless 的 PTY 在 client 斷線時**刻意不 kill**（BAT 重開能接回，T0403 再加回放）。代價是：使用者關掉遠端終端以外的情況（例如換電腦、BAT 當掉、永不再連）會讓 PTY 永久留在遠端，數量無上限
- BUG-103：`electron/remote/remote-server.ts:150` `buildAuthMetadata()` 寫死 `serverEnv: 'native'`；WSL 上的 server 回 native，且缺 `wslDistro` / `serverHome`（`AuthServerEnv` 型別已定義 `'wsl'`）
- `RemoteServer` 有 `clients` Map（:169）與 connection / close 事件（:303 / :387）

## 範圍

### A. 孤兒 PTY 回收（headless only）
- `RemoteServer` 提供已認證 client 數變化的事件或 getter（例如 `onClientCountChange` / `getClientCount()`）
- headless 端：**沒有任何已認證 client 連線**持續超過閒置上限 ⇒ kill 所有 PTY。預設 **24 小時**，可由 headless settings / 啟動參數 / env 覆寫（Worker 選一種並說明）；有 client 重新連上即取消計時
- **每台 server PTY 上限**預設 **64**：超過時 `pty:create` 拒絕並回明確錯誤（不 kill 既有 PTY）
- 回收與拒絕都要寫 log（journal 可見）

### B. BUG-103
- WSL 偵測：`WSL_DISTRO_NAME` env 或 `/proc/version` 含 `microsoft`（大小寫不拘）⇒ `serverEnv: 'wsl'`、`wslDistro`；`serverHome = os.homedir()`
- 偵測失敗一律退回 `'native'`，不得讓 auth 失敗
- 確認 client 端（`remote-client.ts` / renderer）收到 `'wsl'` 時沒有走到未預期分支（只讀現有使用點，必要時補測試）

### C. smoke
- S1 evidence 顯示 `env=` 值；對 WSL 目標若不是 `wsl` 則標 WARN（不 FAIL，避免舊 server 誤判）

## 驗收條件

- [ ] unit：閒置計時（以 fake timers）——無 client 達上限 ⇒ kill all；期間重連 ⇒ 取消；有 client 時不計時
- [ ] unit：PTY 上限——第 65 個 `pty:create` 回明確錯誤，既有 64 個不受影響；kill 後可再建
- [ ] unit：本機 Electron 路徑不啟用回收（PtyManager 預設無上限、無計時）
- [ ] unit：serverEnv 偵測（`WSL_DISTRO_NAME` / `/proc/version` / 都沒有 / 讀取失敗）
- [ ] headless harness：auth-result metadata 在模擬 WSL env 下為 `wsl` + `wslDistro`
- [ ] `npm run test:unit` 全綠（基線 1258，T0402 合入後會變）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed

## 不在範圍
- 單一 PTY 的閒置回收（只做「整台沒有 client」）
- 任何 UI

## Sub-session 執行指示
1. 讀本工單 + BUG-103 + `electron/remote/remote-server.ts`、`headless-entry.ts`、`pty-manager.ts`（create / kill / instances）+ `src/types` 中的 `AuthServerEnv` / `AuthResultMetadata` 使用點
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
**DONE** — 範圍 A / B / C 全數落地；驗收 6 項全 PASS（見下）。未部署 WSL、未 restart `bat-server.service`（依 memory_overrides，交塔台部署 + smoke）。

### 落點檢查（Landing Zone）
- **PASS**：C-0 `repo`=`better-agent-terminal` == `basename(REPO_ROOT)`=`better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在（informational）；C-2 無 `branch` 欄位（當前 `main`）
- `BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（證據，不比對）；`CT_MODE=on`、`CT_INTERACTIVE=0`

### 產出摘要

**A. 孤兒 PTY 回收（headless only）**
- `electron/remote/remote-server.ts`：`RemoteServer.getClientCount()` + `onClientCountChange(listener)`（回 unsubscribe）。只計**已認證** client；auth 成功 / `close` / `error` / heartbeat 清理 / `stop()` 後，計數**有變才**通知（listener 例外只 warn）
- `electron/pty-manager.ts`：
  - `PtyManagerDeps.maxInstances?`（undefined / 0 = 無上限 → **Electron 不傳，行為不變**）；新 id 超過上限時 `create()` 拋 `PtyLimitError`（`code: 'PTY_LIMIT_REACHED'`，訊息 `PTY limit reached: this server already runs 64 terminals (max 64). Close a terminal and try again.`），並 `logger.warn` `[PtyManager] pty:create REFUSED id=… — PTY limit reached (64/64)`。既有 PTY 不動；同 id 重送 create 仍 idempotent；kill 後釋出名額
  - `killAll(): number`（新方法，回傳 kill 數）
  - 錯誤傳遞：handler 拋出 → `invokeHandler` → `invoke-error` frame，client 端 invoke 以該訊息 reject（**未改 `PtyCreateResult` 型別**，因 `src/` 禁碰）
- `electron/remote/headless-entry.ts`：
  - `createHeadlessPtyModule({ maxPtys, onManager })`（`registerHeadlessPtyHandlers` 保留為預設實例，parity 測試不變）；`createHeadlessHandlerModules` 加 `pty` 選項
  - `HeadlessOrphanPtyReclaimer`：client 數 0 ⇒ 武裝計時（已武裝不重設）、>0 ⇒ 取消；到期 `killAll()` 並 log `[headless] no authenticated client for 24h — reclaimed N orphan PTY(s)`；`dispose()` 為終態（之後 `update` 無效）；timer `unref`
  - `createHeadlessServer`：server 啟動即依當下 client 數武裝（無 client 啟動也會計時）；`stop()` 先取消訂閱 + dispose；啟動時 log 生效值 `[headless] orphan PTY reclaim: after 24h without a client; PTY limit: 64`（journal 可見：bat-server 的 logger 是 `console`）
- **覆寫方式（選 env，並保留程式選項）**：`resolveHeadlessPtyLimits()` 優先序 **`HeadlessServerOptions` > env > 預設**
  - `BAT_SERVER_PTY_IDLE_HOURS`：小時，可小數，`0` = 不回收；預設 `24`
  - `BAT_SERVER_MAX_PTYS`：非負整數，`0` = 無上限；預設 `64`
  - 無效值 → warn + 用預設；閒置上限超過 setTimeout 上限（2^31-1 ms ≈ 24.8 天）→ clamp + warn（避免 Node 立即觸發）
  - 理由：沿用既有 `BAT_SERVER_PORT` / `BAT_SERVER_DATA_DIR` 慣例；systemd 可用 `systemctl --user edit bat-server` 加 `Environment=` drop-in，不需改 `bat-server.mjs` / wizard unit 產生器（皆不在 affects_files）；`BAT_*` 已被 T0390 從遠端 shell env 過濾，不外洩

**B. BUG-103**
- `remote-server.ts`：`detectServerEnv(probe?)`（純函式，`platform` / `env` / `readProcVersion` 可注入）：僅 Linux；`WSL_DISTRO_NAME`（trim 後非空）⇒ `{ serverEnv: 'wsl', wslDistro }`；否則 `/proc/version` 符合 `/microsoft/i` ⇒ `{ serverEnv: 'wsl' }`（無 distro）；其他 / 任何例外 ⇒ `'native'`，**不影響 auth**
- `buildAuthMetadata(envInfo)`（export）：`wsl` 時附 `wslDistro`（有才附）+ `serverHome = os.homedir()`（包 try）；**`native` 保持 T0404 前的欄位形狀**。理由：SSH wizard `write-profile.ts:63` 以 `ctx.serverMetadata?.serverHome` 優先於 ssh 探得的 home，native server 若開始送 `serverHome` 會改變 SSH 路徑行為
- 每次 auth 現場偵測（不快取，auth 頻率低）；`RemoteServerOptions.detectServerEnv` / `HeadlessServerOptions.detectServerEnv` 供測試注入
- **Client 端使用點（唯讀確認）**：`remote-client.ts` `applyAuthResult` 只存 metadata，translator 依 **profile** 建立，不看 `serverEnv`；renderer 只有 wizard `wsl/done.ts`（顯示 platform/arch/node）、`wsl/write-profile.ts`（SSH 分支讀 `serverHome`）、`ssh/verify-auth.ts`（自填 `'ssh'`）；`src/types/electron.d.ts` / `wizard-runner.ts` 型別已含 `'wsl'`。**無任何依 `serverEnv` 分支的產品程式碼** ⇒ 收到 `'wsl'` 不會走到未預期分支，未補 client 測試

**C. smoke**
- `scripts/smoke-remote-headless.mjs`：`resolveWslTarget()` 回 `expectedServerEnv: 'wsl'`；S1 evidence 已含 `env=`；WSL 目標 `serverEnv !== 'wsl'` ⇒ **S1 = `WARN`**（evidence：`env=native but target is wsl (server older than T0404 / BUG-103?)`），後續 S2-S9 照跑
- `summarize()` 新增 `warned`；**WARN 不使 run 失敗**（`ok = PASS+WARN == total && 無殘留`）；RESULT 行 `8/9 PASS, 1 WARN`
- ⚠️ 部署前舊 server 跑 smoke 會出現 S1 WARN（預期）；部署 T0404 後應回 `env=wsl`。若 `bat-server.service` 環境無 `WSL_DISTRO_NAME`，會靠 `/proc/version` 判 wsl 但**無 `wslDistro`**

**變更檔案**
- `electron/remote/remote-server.ts`、`electron/remote/headless-entry.ts`、`electron/pty-manager.ts`
- `electron/remote/__tests__/helpers/headless-harness.ts`（`HeadlessClient.authResult`）
- `scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`
- 新增：`electron/__tests__/pty-manager-limits.test.ts`（6）、`electron/remote/__tests__/headless-orphan-pty.test.ts`（14）、`electron/remote/__tests__/server-env-detect.test.ts`（11）；smoke 測試 +2

**驗收**
| 項目 | 結果 | 證據 |
|------|------|------|
| unit：閒置計時（fake timers） | ✅ PASS | `headless-orphan-pty.test.ts`：24h 無 client ⇒ kill all + log；23h 重連 ⇒ 取消、再離開從 0 起算；有 client 不計時；重複 0 不重設；`idleMs 0` 停用；dispose 後 `update(0)` 不再武裝。另以 harness + 真 node-pty 驗 `ptyIdleReclaimMs: 400` 回收（同 id 再建為 `created: true`）與 client 在線不回收 |
| unit：PTY 上限 | ✅ PASS | `pty-manager-limits.test.ts`：第 65 個拋 `PtyLimitError`（`max 64`），64 個 fake PTY `kill` 0 次且皆 alive；同 id idempotent；kill 後可再建；`killAll` 回 3；harness `maxPtys: 2` 第 3 個 `invoke-error` `/PTY limit reached.*max 2/` |
| unit：本機 Electron 不啟用 | ✅ PASS | 無 `maxInstances` 建 80 個、fake timers 推進 7 天，0 kill、無 REFUSED log |
| unit：serverEnv 偵測 | ✅ PASS | `server-env-detect.test.ts`：`WSL_DISTRO_NAME` / `/proc/version`（`microsoft-standard-WSL2`、`Microsoft`）/ 都沒有 / 讀取拋例外 / 非 Linux |
| headless harness：WSL metadata | ✅ PASS | 注入模擬 WSL probe ⇒ auth-result `{ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04', serverHome }`（第二個 client 亦同）；probe 失敗仍 auth 成功、`native` |
| `npm run test:unit` | ✅ PASS | **93 files / 1309 tests 全綠**（基線 1258；T0402 已於執行中 commit `85916f8`，加上本單 +33） |
| `npx tsc --noEmit` | ✅ PASS | 40 errors（≤ 40；本單檔案 0 筆，皆為既有 `src/utils/__tests__/...` 等） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npm run test:e2e` | ✅ PASS | 6 passed / 8 skipped / **0 failed** |
| WSL 部署 / smoke | ⏸ 未執行 | 依 memory_overrides 由塔台部署並跑 smoke |

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. 首輪 harness 測試「client 在線不回收」誤見 `reclaimed` log：前一測試 dispose 時 client 端先關、server 端 `close` 事件晚到，`stop()` 內 `reclaimer.dispose()` 之後 `remoteServer.stop()` 清空 clients 又通知 0，重新武裝已 dispose 的計時器並漏到下一測試。已修：`dispose()` 改為終態（`update` 無效）+ `stop()` 先 unsubscribe；並補單元測試覆蓋此序列。正式環境影響僅為 stop 後殘留一個 unref timer，修正後無
2. 平行 T0402 在執行中改了 `electron/handlers/claude.ts` 並已 commit（`85916f8`），本單未碰 `electron/handlers/claude.ts` / `src/`；commit 用 `--only` 精準帶檔
3. 以 Bash heredoc 跑多段 python 編輯時一次 quoting 失敗（未寫入任何檔），改由 scratchpad 腳本執行

### 後續建議（給塔台）
- **UI（不在範圍）**：renderer `WorkspaceView.tsx` 的 `pty.create(...)` 是 fire-and-forget，遠端達上限時 reject 會成 unhandled rejection、使用者只看到空白終端。建議另開單：捕捉 `PTY limit reached` 並 toast（可沿用 `PtyCreateResult` 擴 `error` 欄位或 renderer 端 catch）
- smoke 文件（`docs/` 的 smoke 說明）尚未提 S1 `WARN` 語意與 `BAT_SERVER_PTY_IDLE_HOURS` / `BAT_SERVER_MAX_PTYS`；不在 affects_files，建議塔台部署後隨手補
- 部署後若 S1 為 `env=wsl` 但無 `wslDistro`，代表 systemd unit 未帶 `WSL_DISTRO_NAME`；如需 distro 名可於 wizard 產生的 unit 加 `Environment=WSL_DISTRO_NAME=<distro>`（另案）
- BUG-103 可轉 VERIFY（待 WSL smoke 確認 `env=wsl`）

### 回報時間
2026-10-05T02:44:55+08:00
