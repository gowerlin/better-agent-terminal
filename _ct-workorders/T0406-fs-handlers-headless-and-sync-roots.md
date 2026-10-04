---
schema_version: 1
schema_kind: workorder
id: T0406
title: "PLAN-036 P2-I：fs:* / image:read-as-data-url 搬入共用模組並上線 headless + workspace:sync-roots（client 推送轉換後 roots，fail-closed）+ PROXIED_EVENTS 路徑分類守門"
type: impl
status: DONE
started_at: "2026-10-05T04:51:30+08:00"
updated_at: "2026-10-05T05:07:54+08:00"
completed_at: "2026-10-05T05:07:54+08:00"
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T04:50:19+08:00"
target_version: next
depends_on:
  - T0405
  - T0416
related:
  - "PLAN-036 最後一張（D130）；T0386 回報區 §1（fs 類）、§4 path sandbox（使用者裁決 Q2：client 推送 roots）、§5 安全、建議清單 I"
  - "T0416 回報區「遭遇問題」1（`PROXIED_EVENTS` 路徑分類無守門）、5（`workspace:sync-roots` 須自行分類）"
affects_files:
  - electron/handlers/fs.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/path-guard.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/remote-client.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **本機 fs 行為不得改變**：本機 path guard 白名單仍由 window registry 重建（`rebuildWorkspaceAllowlist`）；`fs:*` handler 內部邏輯逐字搬移，含所有 `isPathAllowed` 檢查。e2e 0 failed。"
  - "🔴 **headless fail-closed**：未收到 roots 前，所有 fs / image channel 一律拒絕；roots 只接受絕對 server 路徑，拒絕 `/`（整個檔案系統）與含 `..` 段者；以**每條連線**記錄 roots、取所有連線聯集，連線關閉即移除該連線的 roots。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。smoke 不得讀寫使用者既有檔案（用 `/tmp` 暫存目錄）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0406 — fs 上遠端 + workspace:sync-roots（PLAN-036 P2-I）

## 元資料
- **工單編號**：T0406
- **任務名稱**：fs / image 共用註冊 + headless 上線 + roots 同步
- **狀態**：DONE
- **建立時間**：2026-10-05 04:50 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「1. 搬移（Electron 行為不變）」並 commit，回報 PARTIAL

## 背景

- PLAN-036 最後一塊：遠端視窗的檔案樹 / 檔案預覽 / 搜尋 / 圖片預覽（`fs:*` 7 個 + `image:read-as-data-url`，`main.ts` 8 個註冊）在 headless 仍不支援
- 本機 fs handler 以 `electron/path-guard.ts` 的 `isPathAllowed` 限制在已註冊工作區內；白名單來自本機 window registry，headless 沒有 registry ⇒ 使用者裁決（T0386 Q2）：**client 推送轉換後的 workspace roots**，未推送前 fail-closed
- T0416 已把 fs 類的路徑轉換（client → server）與 `PATH_FREE_CHANNELS` / `PATH_ARG_SCHEMA` 守門建好；新 channel 必須在其中分類

## 範圍

1. **搬移**：`electron/handlers/fs.ts` 的 `registerFsHandlers(register, deps)`，逐字搬入 8 個 handler；path guard 以 deps 注入（本機 = 既有 `isPathAllowed`；headless = 依 synced roots 判斷的實例）；`fs:watch` 的事件改走 `deps.emit`；`electron/handlers/` 不得 import electron（image 若用到 `nativeImage`，改為不依賴 electron 的實作或以 deps 注入，回報說明）
2. **`workspace:sync-roots`**（新 proxied channel）：
   - client 端：遠端視窗連線完成後、以及每次該視窗 `workspace:save` 後，由 main 把該視窗的 workspace roots 經 `PathTranslator.toServer` 轉換後送出
   - server 端：驗證（見 memory_overrides）、記錄於該連線、重建聯集白名單
   - 在 T0416 的分類表登錄（請求參數是否 path-aware：roots 已在 main 端轉好，請說明採用哪種分類並避免重複轉換）
3. **headless 上線**：`createHeadlessHandlerModules` 加入；fs / image 自 `HEADLESS_UNSUPPORTED` 移除；`fs:changed` 事件經 broadcastHub 送回 client 並由既有 `translateRemoteEventArgs` 轉回 client 形式
4. **PROXIED_EVENTS 路徑分類守門**（T0416 遭遇問題 1）：每個 `PROXIED_EVENTS` 必須明確分類為「含路徑需轉回 client」或「不轉（附理由，例如 `claude:worktree-info` 維持 server 形式）」，新增 event 未分類即 CI 紅
5. **smoke**：新增 **S12**：`/tmp` 建暫存目錄與檔案 → 未同步 roots 時 `fs:readdir` 被拒 → `workspace:sync-roots([暫存目錄])` → `fs:readdir` / `fs:readFile` / `fs:stat` 成功、暫存目錄外的路徑（例如 `/etc`）仍被拒 → 清理；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0406」；`docs/remote-dev-overview.md` 補 S12

## 驗收條件

- [ ] `main.ts` 不再有 `registerHandler('fs:` / `registerHandler('image:`；`electron/handlers/fs.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding / T0416 path 分類守門綠；新增 events 分類守門
- [ ] headless harness：未同步 → 拒絕；同步後 root 內允許、root 外拒絕；`/` 與 `..` 被拒；兩條連線 roots 聯集、其一斷線後只剩另一條的 roots；`fs:watch` → 修改檔案 → client 收到 `fs:changed`
- [ ] client 端：連線後與 `workspace:save` 後送出轉換後 roots（以 WSL translator 斷言 `\\wsl.localhost\Ubuntu-24.04\home\x` → `/home/x`）；本機視窗不送
- [ ] `npm run test:unit` 全綠（基線 1825）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附「塔台部署後 smoke 預期」與使用者實機步驟（WSL 遠端視窗開檔案樹 / 預覽 / 搜尋 / 圖片）

## 不在範圍
- 自由文字（prompt / 拖檔插入）中的路徑轉換（T0416 遭遇問題 2，另案）
- BUG-106

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 §1 / §4 / §5 + T0416 回報區 + `electron/handlers/git.ts`（最新共用模組範本）+ `main.ts` fs / image 段 + `electron/path-guard.ts` + `electron/remote/path-aware-channels.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T04:51:30+08:00，Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）。範圍 1-5 全部完成，未走降級策略。

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 informational（`electron/handlers/types.ts`、`main.ts`、`path-guard.ts`、`path-aware-channels.ts`、`headless-entry.ts` 皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 自動化閘門全綠；WSL 部署 + smoke S12 依工單交塔台，實機 UI 交使用者

### 產出摘要

**1. 搬移（Electron 行為不變）**
- 新增 `electron/handlers/fs.ts` `registerFsHandlers(register, deps)`：8 個 handler（`fs:watch` / `fs:reset-watch` / `fs:unwatch` / `fs:readdir` / `fs:readFile` / `fs:stat` / `image:read-as-data-url` / `fs:search`）逐字搬移，含所有 `isPathAllowed` 檢查與拒絕回傳形狀（`[]` / `{ error: 'Path access denied' }` / `null` / `false` / throw）。差異只有三處：path guard 改由 `deps.pathGuard` 注入（**未注入 ⇒ 一律拒絕**）、`fs:changed` 改走 `deps.emit`、`fileWatchers` 改為每次註冊一份並回傳 disposer（headless `stop()` 會關 watcher）
- `image:read-as-data-url` 原本就**沒用 `nativeImage`**（純 `fs.readFile` + base64），無 Electron 依賴需替換；`fs.ts` 不 import electron（headless-electron-free guard 綠 + 新增原始碼斷言）
- `main.ts`：刪除 fs / image 段，改呼叫 `registerFsHandlers(registerHandler, { emit, pathGuard: { isPathAllowed } })`。`emit` 與原本完全相同（`BrowserWindow.getAllWindows()` 逐一 `webContents.send` + `broadcastHub.broadcast`）；guard 仍是 `electron/path-guard.ts` 模組級白名單，仍由 `syncPathGuardFromRegistry` → `rebuildWorkspaceAllowlist`（啟動 + 每次 `workspace:save`）重建。`main.ts` 已無 `registerHandler('fs:` / `registerHandler('image:`
- `electron/path-guard.ts`：抽出 `createPathAllowlist()` 工廠，模組級函式（`registerWorkspace` / `rebuildWorkspaceAllowlist` / `isPathAllowed` / …）改委派給預設實例，演算法逐字不變（legacy `tests/path-guard.test.ts` 12/12）

**2. `workspace:sync-roots`**
- **分類（T0416 表）**：`PATH_ARG_SCHEMA['workspace:sync-roots'] = 'array-of-strings'`（path-aware）。做法：main 送出 **client 形式** roots，由 `RemoteClient.invoke` 的 `translateInvokeArgs`（＝該 profile 的 `PathTranslator.toServer`，且沿用 BUG-068 的凍結 translator）做**唯一一次**轉換 ⇒ 不會重複轉換；main 端不另外呼叫 `toServer`。測試斷言 `\\wsl.localhost\Ubuntu-24.04\home\x` → `/home/x`、`C:\Users\x` → `/mnt/c/Users/x`，已是 server 形式者原樣
- **client 端**：`RemoteClient.setWorkspaceRootsProvider()` + `syncWorkspaceRoots()`；**每次 auth 成功（首次連線與每次自動重連）**後自動推送（新連線在 server 端沒有 roots）。main 以 `bindRemoteClient()` 在兩個建立點（`loadProfileSnapshotDetailed`、`remote:connect`）掛 provider（`collectWorkspaceRoots(windowRegistry.readAll(), profileId)`：該 remote profile 所有視窗的 `folderPath`，去重）；`workspace:save` 與 `workspace:load` 後以 `shouldSyncWorkspaceRoots(entry.profileId, remoteClientProfileId, connected)` 判斷，**本機視窗不送**。best effort：失敗只記 log，server 維持 fail-closed
- **server 端**：`SyncedWorkspaceRoots`（`path-guard.ts`）—— 以**每條連線**記錄 roots、白名單取聯集；只收 server 平台的絕對路徑，拒絕檔案系統根（`/`、`C:\`）、含 `..` 段、相對路徑、非字串、NUL、超長；非陣列或 > 256 筆 ⇒ 清空該連線 roots 並丟錯（fail closed）。回傳 `{ ok: true, roots: accepted, rejected: [{ root, reason }] }`
- 連線識別：`RemoteServer` 為每條已認證連線配 `connectionId`，經 `invokeHandler(..., connectionId)` 放進 `ctx.connectionId`；新增 `onClientDisconnect(listener)`（close / error / heartbeat 清除 / stop 皆觸發），headless 用它在連線關閉時移除該連線 roots
- Electron 也註冊此 channel，但回 `{ ok: false, error: '…synced roots are not used' }`：桌面 BAT 當 server 時，sandbox 仍只來自自己的 window registry，遠端 client 推的 roots **不得放寬**（本機行為不變）

**3. headless 上線**
- `createHeadlessFsModule()` 加入 `createHeadlessHandlerModules`（每台 server 一份 `SyncedWorkspaceRoots`，經 `onRoots` 交給 `createHeadlessServer` 接 disconnect）；`fs:*` 7 個 + `image:read-as-data-url` 自 `HEADLESS_UNSUPPORTED` 移除（P2 已清空）。`fs:changed` 走 `host.emit` → broadcastHub → `PROXIED_EVENTS` → client 端既有 `translateRemoteEventArgs` 轉回 client 形式（測試斷言）

**4. `PROXIED_EVENTS` 路徑分類守門**
- `path-aware-channels.ts` 新增 `PATH_EVENT_CHANNELS`（`fs:changed`，含理由）與 `PATH_FREE_EVENTS`（其餘 26 個，各附理由；`claude:worktree-info` 明確標註維持 server 形式）；`translateRemoteEventArgs` 改由 `PATH_EVENT_CHANNELS` 判斷（行為不變）
- 守門測試：每個 `PROXIED_EVENTS` 恰在其一、無殘留、理由非空、path-free event 原樣送達。**負向驗證**：暫時刪 `system:resume` 分類 → `expected [ 'system:resume' ] to deeply equal []` 紅燈；以 scratchpad 備份覆回、`cmp` 一致後 160 綠

**5. smoke S12** —— 見下節；`docs/remote-dev-overview.md` 補 S12 列、清理規則，並新增「Headless fs sandbox (`workspace:sync-roots`, T0406)」一節

**新增測試**（+42）：`electron/__tests__/fs-handlers.test.ts`（14：fail-closed 形狀、guard 允許/拒絕、watch→emit、Electron 拒收 roots、per-connection、root 驗證、main.ts 無 fs handler、fs.ts 無 electron）、`electron/remote/__tests__/headless-fs.test.ts`（7，wire level）、`electron/remote/__tests__/remote-client-sync-roots.test.ts`（5，真 `RemoteClient` + WSL translator 連 in-process headless）、`path-aware-channels-coverage.test.ts`（+10）、`smoke-remote-headless.test.mjs`（+6）

| 證據道 | 結果 | 內容 |
|---|---|---|
| headless harness | PASS | 未同步 → 8 個 channel 皆拒；`/`、`<dir>\..\..`、`<dir>/..`、相對路徑被拒且不開放；同步後 root 內允許、root 外（另一 tmp 目錄、`..` 跳出、`os.tmpdir()`）拒絕；兩條連線聯集、關閉一條後只剩另一條的 roots；`fs:watch` → 改檔 → client 收到 `fs:changed [dir]`；空推送 → 再度全拒 |
| client 端 | PASS | 連線後自動推送 `['/home/x', '/mnt/c/Users/x/proj']`；`syncWorkspaceRoots()` 重推；斷線重連後以**新 connectionId** 再推；無 provider 不推；本機視窗 gate 為 false |
| parity / electron-free / proxied-binding / T0416 path 守門 | PASS | `headless-parity`、`headless-electron-free`、`proxied-channels-binding`、`path-aware-channels-coverage`（160）皆綠 |
| `npm run test:unit` | PASS | **112 files / 1867 passed / 1 skipped**（基線 1825，+42 為本單新測試） |
| `npx tsc --noEmit` | PASS | **40**（≤ 40） |
| `tsc -p tsconfig.node.json` | 本單 0 新增 | 全專案既有 146 個（多為 `downlevelIteration`）；本單碰到的檔案中剩餘者皆為原有/搬移的同一寫法（`path-guard.ts:72` 為原 `for (const root of allowed)` 搬移），新寫的迭代一律用 `Array.from` / `forEach` |
| legacy node:test | PASS | `tests/path-guard.test.ts` 12/12、`tests/path-aware-channels.test.ts` 9/9、`tests/remote-client-middleware.test.ts` 21/21（`npx tsx --test`） |
| `npx vite build` | PASS | exit 0 |
| `npm run test:e2e` | PASS | 6 passed / 8 skipped / **0 failed**（含 `smoke.spec.ts` 啟動 Electron app） |
| WSL 部署 / S12 實機 | 交塔台 | 依 memory_overrides 未部署、未動 `bat-server.service` |
| 實機 UI | 交使用者 | 見下 |

**變更檔案**：新增 `electron/handlers/fs.ts`、`electron/__tests__/fs-handlers.test.ts`、`electron/remote/__tests__/headless-fs.test.ts`、`electron/remote/__tests__/remote-client-sync-roots.test.ts`；修改 `electron/main.ts`、`electron/path-guard.ts`、`electron/remote/{protocol,path-aware-channels,remote-client,remote-server,headless-entry,headless-channel-status,handler-registry}.ts`、`electron/remote/__tests__/path-aware-channels-coverage.test.ts`、`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`、`docs/remote-dev-overview.md`、本工單。未改 `electron/handlers/types.ts`（既有 `HostPathGuard` / `pathGuard?` 契約已足夠）、`preload.ts`、`src/types/electron.d.ts`（推送由 main 發動，renderer 不需 API）

### 塔台部署後 smoke 預期

部署本單 JS 到 WSL（`scripts/dev-deploy-headless.mjs`）並重啟 `bat-server` 後：`npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`

- 預期 **12/12 PASS**（S1 可能因 T0404 前 server 顯示 WARN，部署新版後應 PASS）
- S12 evidence 形如：`before sync: readdir [] + readFile denied; sync-roots → [/tmp/bat-smoke-fs.XXXXXX], '/' rejected (filesystem root); readdir [smoke.txt], readFile "<nonce>-s12", stat N B; /etc readdir [] + /etc/hostname denied; roots cleared; temp dir removed`
- cleanup 行應含 `pty:write(<id>-fs) → {"ok":false,"reason":"pty-not-found"}`，`no smoke PTY left`
- **未部署前**跑 smoke：S12 FAIL `No handler for channel: fs:stat — server predates T0406`（先做唯讀 `fs:stat` 探測，不建任何 PTY / 目錄），其餘 S1-S11 不受影響
- 注意：server 白名單是**所有連線聯集**，若使用者自己 BAT 的 WSL 工作區剛好是 `/tmp`，S12「同步前被拒」一步會誤判失敗（`/` 會被拒，不受影響）

### 使用者實機步驟

> 前提：塔台已部署本單 JS 到 WSL 並重啟 `bat-server`；BAT 用本 working tree（`npm run dev` 或打包）

1. 開 WSL profile（Ubuntu-24.04）視窗，工作區選 `\\wsl.localhost\Ubuntu-24.04\home\gower\<某 repo>`
2. **檔案樹**：側欄檔案樹應列出 repo 內容（修正前遠端視窗為 `No handler for channel: fs:readdir`／空樹）；展開子目錄正常
3. **預覽**：點一個文字檔（< 512 KB）→ 預覽顯示內容；點一張 png/jpg → 圖片預覽顯示
4. **搜尋**：檔案搜尋輸入檔名片段 → 有結果，點結果可開啟
5. **自動刷新**：在 WSL 終端 `touch newfile.txt` → 約 0.5 秒後檔案樹出現新檔（`fs:changed` 回到 client 形式）
6. **新增 / 移除工作區**：新增第二個 `\\wsl.localhost\…` 工作區 → 立即可瀏覽；移除後該路徑不可再讀
7. **`C:\…` 工作區**（T0393 `/mnt/c` 提示按確定）→ 檔案樹可瀏覽 `/mnt/c/...` 內容
8. **重連**：在 WSL `systemctl --user restart bat-server`（或關掉 BAT 重開）→ 重連後檔案樹仍可用（每次重新認證都會重推 roots）
9. debug log 應有 `[RemoteClient] workspace roots synced: N accepted, 0 rejected`；若出現 `server rejected workspace root …` 表示該工作區無法轉成 server 絕對路徑（例如 SSH profile 下 home 以外的 `C:\` 路徑）
10. **本機 profile 視窗**：檔案樹 / 預覽 / 搜尋 / 圖片行為不變

### 互動紀錄
無（`CT_INTERACTIVE=0`）

### Renew 歷程
無

### 遭遇問題

1. **偏差：連線完成後推送不足，另加 `workspace:load` 後推送**。工單寫「連線完成後、每次 `workspace:save` 後」。實際上 remote profile 的視窗是在 `loadProfileSnapshotDetailed` **連線成功之後**才 `applySnapshot` 寫進 window registry，連線當下推送的 roots 可能是空的；使用者若開窗後不改工作區就不會觸發 `workspace:save` ⇒ 檔案樹永遠被拒。因此 renderer 開窗讀取工作區（`workspace:load`）時也推一次（同一 gate，本機視窗不送）。另外「連線完成後」實作為「**每次 auth 成功後**」（含 RemoteClient 內部自動重連），因為新連線在 server 端沒有 roots
2. **偏差：改了 `affects_files` 外的 `electron/remote/handler-registry.ts`**：`HandlerContext` 加選填 `connectionId`、`invokeHandler` 加第 4 個選填參數。per-connection roots 必須知道請求來自哪條連線，原 ctx 只有 `windowId`；本機 IPC 路徑行為不變（`connectionId` 不設）
3. **「該視窗」→「該 profile 的所有視窗」**：全域只有一個 `remoteClient`，同一 remote profile 的多個視窗共用一條連線，若只推單一視窗的 roots 會互相覆蓋；故推送該 profile 所有視窗 `folderPath` 的聯集
4. **Electron 當 server 時不採用 synced roots**（回 `{ ok: false }`）：避免遠端 client 透過推送 roots 讀取桌面主機任意路徑（原本只能讀桌面 registry 內工作區）。若日後要讓「BAT 連 BAT」也支援 client roots，需另案設計
5. **已知限制**：server 白名單為所有連線聯集（工單要求），某一 client 推送的 roots 對同一 server 的其他已認證連線也有效（同一 token 持有者，信任邊界相同）；SSH profile 下無法由 `SshPathTranslator` 對應的 `C:\…` 工作區會被 server 以「not an absolute path」拒絕並記 log（檔案樹不可用，符合 fail-closed）
6. 本單未部署 WSL、未重啟 `bat-server.service`、未 push；沒用 stash / reset / checkout -- / restore

**Commit**：單一 commit（`git commit --only` 實際改動檔 + 本工單），hash 見 `git log`（回報區在 commit 前寫入，不自我引用）

### 回報時間
2026-10-05T05:06:47+08:00
