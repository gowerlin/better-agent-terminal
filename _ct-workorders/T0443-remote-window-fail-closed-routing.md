---
schema_version: 1
schema_kind: workorder
id: T0443
title: "BUG-110：遠端 profile 視窗未連線時 proxied invoke fail-closed（結構化錯誤，不落本機）+ 連線狀態變化事件推給視窗"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-110
priority: P1
sizing: M
created_at: "2026-10-05T06:12:22+08:00"
started_at: "2026-10-05T06:14:25+08:00"
updated_at: "2026-10-05T06:27:56+08:00"
completed_at: "2026-10-05T06:27:56+08:00"
target_version: next
depends_on:
  - T0442
related:
  - "BUG-110；T0442 / T0430 回報區「遭遇問題」（既有路由落本機）"
  - "D134 追加（塔台 06:12 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/remote-connect-plan.ts
  - src/App.tsx
  - src/components/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **路由規則**：`bindProxiedHandlersToIpc` 中，sender 是 remote profile 視窗時——ALWAYS_LOCAL channel 照舊本機（既有短路，不得改變）；其餘 channel 只有在槽位屬於該 profile 且已連線時才 `remoteClient.invoke`，否則**拋 / 回結構化錯誤**（code 例 `REMOTE_NOT_CONNECTED`，含 profileId），絕不呼叫本機 `invokeHandler`。本機（非 remote profile）視窗行為完全不變。判斷抽成純函式（放 `remote-connect-plan.ts` 或新模組）並單測全部分支。"
  - "🔴 **事件**：RemoteClient 連線狀態變化（connected / disconnected / reconnecting、槽位換手 / 清空）時，main 推送事件（例 `remote:client-status-changed`）給綁該 profile 的視窗；renderer 狀態列 / 既有 remote 狀態 UI 據此更新，並在 `REMOTE_NOT_CONNECTED` 時給一次可讀提示（i18n 三語，避免每個失敗 invoke 都 toast 洗版）。**不做自動重連**（範圍外）。"
  - "🔴 先盤點 renderer 端在 remote 視窗啟動 / 重連期間會呼叫哪些 proxied channel（例如 init 時的 pty:create / settings），確認 fail-closed 不會讓視窗開啟流程卡死或白畫面——必要時這些呼叫在收到 `REMOTE_NOT_CONNECTED` 時延後到 connected 事件再重試一次（只限 init 路徑），回報區列出處理點。"
  - "🔴 依賴 T0442（同改 `main.ts` / `remote-connect-plan.ts`）。T0426 / T0436 可能仍有 `main.ts` / `preload.ts` 未提交 hunk：commit 前 `git diff <file>` 確認，混有他人 hunk 時以 `git diff` 擷取本單 hunk + `git apply --cached` 精準 stage（T0431 / T0442 做法），不得夾帶。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0443 — 遠端視窗 fail-closed 路由（BUG-110）

## 範圍

1. 路由純函式 + `bindProxiedHandlersToIpc` 改寫（memory_overrides 第 1 條）
2. 連線狀態事件 + renderer 狀態 / 提示（第 2 條）
3. init 路徑盤點與處理（第 3 條）
4. 測試：路由矩陣（本機視窗 / remote 視窗 × ALWAYS_LOCAL / proxied × 已連線同 profile / 未連線 / 槽位他 profile / 槽位空）；事件推送對象正確；renderer 收到錯誤 code 的提示只出現一次

## 驗收條件

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [x] 回報區附 init 路徑盤點、實機步驟（WSL profile 視窗開著時 `wsl --shutdown` 或停 bat-server → 視窗操作得到錯誤提示而非本機 shell；兩個不同 remote profile 同時開窗 → 先開者顯示未連線而非本機執行）
- [x] BUG-110 改 `FIXED`（多 profile 同時連線仍為已知限制，寫入 BUG-110）

## Sub-session 執行指示
1. 讀本工單 + BUG-110 + T0430 / T0442 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-110（精準 stage）；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — remote profile 視窗未被自己的有效連線服務時（槽位空 / 重連中 / 斷線放棄 / 槽位屬他 profile），proxied invoke 一律拋 `REMOTE_NOT_CONNECTED` 結構化錯誤，**不再落本機 `invokeHandler`**；ALWAYS_LOCAL 短路與本機視窗行為不變。main 在連線狀態 / 槽位變化時推 `remote:client-status-changed` 給綁該 profile 的視窗，renderer 每次斷線只提示一次（i18n 三語）。init 路徑 4 個處理點見第 3 節。BUG-110 → `FIXED`（多 profile 同時連線列為已知限制）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`affects_files` 皆存在（informational）✅；C-2：工單無 `branch` 欄位，實際 `main`
- 依賴 T0442：`git log` 含 `ccffedb fix(remote): ... (T0442, BUG-096)` ✅
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. 路由純函式 + `bindProxiedHandlersToIpc`（`electron/remote/remote-connect-plan.ts`、`electron/main.ts`）

- `computeRemoteWindowStatus(profileId, slot)` → `{ profileId, connected, state: 'connected'|'reconnecting'|'disconnected', reason: null|'no-client'|'other-profile'|'reconnecting'|'disconnected' }`：只有「槽位屬於該 profile 且已連線」算 connected。
- `planProxiedInvokeRoute({ senderIsRemote, senderProfileId, slot })` → `local` / `remote` / `refuse { errorCode: 'REMOTE_NOT_CONNECTED', profileId, reason }`。非 remote 視窗或無 profile 綁定 → `local`；remote 視窗 → connected 才 `remote`，否則 `refuse`。
- `formatRemoteNotConnectedError(channel, profileId, reason)`：訊息以 `REMOTE_NOT_CONNECTED:` 開頭並含 profileId / reason / channel（Electron 只把 IPC error 的 message 帶到 renderer，code 放 message 前綴；main 端 Error 另掛 `code` / `profileId` / `reason`）。
- `main.ts`：`ALWAYS_LOCAL_CHANNELS` 短路**原樣保留**在最前面（不查 registry）；之後經 `planProxiedInvokeRoute`：`local` → `invokeHandler`、`remote` → `remoteClient.invoke`、其餘 → 推 `remote:invoke-refused` 給 sender 並 `throw`。路由之後 `invokeHandler` 只剩 `local` 一個出口（source guard 鎖定）。
- `currentRemoteSlot()`：`{ profileId: remoteClient ? remoteClientProfileId : null, isConnected, isReconnecting }`。

#### 2. 連線狀態事件 + renderer 提示

- `RemoteClient`（`electron/remote/remote-client.ts`）新增 `isReconnecting`（`shouldReconnect && !isConnected`）與 `setStatusChangeListener()`；ping 時機：auth 成功、socket 關閉（原本已連線 → reconnecting）、SSH tunnel 重啟放棄、`disconnect()`。listener 例外被吞並 warn，不影響連線流程。
- `main.ts`：`bindRemoteClient` 為每個 client 綁 `pushRemoteClientStatus(profileId)`；四個槽位變更點（`loadProfileSnapshotDetailed` / `remote:connect` 的 `settleSlot`、`remote:disconnect`、`profile:update` pin 變更清槽）後呼叫 `pushRemoteClientStatus(前任 owner, 新 owner, candidate profile)`。推送對象 / 去重抽成純函式 `planRemoteStatusPushes(profileIds, slot, lastPushed)`，實際只送 `getWindowsForProfile(profileId)`（綁該 profile 的視窗）。新 channel：`remote:client-status-changed`、`remote:invoke-refused`（皆 main → renderer）。
- preload / `electron.d.ts`：`remote.onClientStatusChanged(cb)`、`remote.onInvokeRefused(cb)`（回傳 unsubscribe）。
- renderer `src/lib/remote-not-connected.ts`（新）：`isRemoteNotConnectedError`、`createRemoteOutageNotice`（每次斷線只提示一次，收到 `connected` 才重新武裝）、`subscribeRemoteWindowStatus`、`waitForRemoteConnected`（訂閱事件 + 查一次 `clientStatus` 防漏）、`retryOnceWhenRemoteConnected`、`loadNowOrWhenRemoteConnected`。
- `App.tsx`：`subscribeRemoteWindowStatus` → 狀態事件即時 `setIsRemoteConnected`（既有 3 秒 polling 保留）；拒絕時 `addRuntimeToast(..., 'warning', 8000)`，`reason === 'other-profile'` 用 `app.remoteNotConnectedOtherProfile`，其餘用 `app.remoteNotConnected`（en / zh-TW / zh-CN）。**不做自動重連**。

#### 3. init 路徑盤點與處理點

remote 視窗正常只在 `loadProfileSnapshotDetailed` 連線成功後才建立，init 時通常已連線。會在**未連線時跑 init** 的情境：視窗 reload（Ctrl+R / dev reload）時正好斷線 / 重連中、remote launch profile 不可達且無本機 fallback（`createEntry({ profileId: launchProfileId })`）、pin 變更清槽後 reload。init 期間的 IPC：

| 呼叫 | channel | 類型 | fail-closed 影響 | 處理 |
|------|---------|------|-----------------|------|
| `app.getLaunchProfile` / `getWindowProfile` / `getWindowIndex` / `getWindowId` | `app:*` | 本機 | 無 | — |
| `profile.list()` | `profile:list` | proxied | 被拒 → `initProfile` 進 catch | **處理點 1**（`App.tsx`）：被拒改讀 `profile.listLocal()`（本機 channel；與舊 fail-open 結果相同，只用來辨識本視窗的 profile） |
| `remote.connect()` / `profile.listLocal()` / `remote.clientStatus()` | `remote:*` / `profile:list-local` | 本機 | 無 | — |
| 連線失敗、非 launch 視窗的 fallback `profile.load(localProfile.id)` | `profile:load` | proxied | 被拒 → throw → 外層 catch | **處理點 2**（`App.tsx`）：catch `REMOTE_NOT_CONNECTED`，不再顯示成本機配置名稱（視窗仍綁 remote，沒有任何東西在本機跑），沿用 remote 名稱；提示由 `remote:invoke-refused` 觸發 |
| `settingsStore.load()`（主流程與外層 catch 兩處） | `settings:load` | proxied | 原本 await 失敗 → 外層 catch 再失敗 → `initProfile` reject、`profileReady` 永不為 true（**卡死點**） | **處理點 3**（`App.tsx`）：`loadNowOrWhenRemoteConnected` —— 被拒先用預設值、不阻塞 init，connected 事件後背景重載一次 |
| `workspaceStore.load()` | `workspace:load` | ALWAYS_LOCAL | 無 | — |
| WorkspaceView `initTerminals` → `getShellFromSettings()` | `settings:get-shell-path` | proxied | 被拒 → `initTerminals` reject，且 `initializedWorkspaces` 已標記 → 永不再建 PTY | **處理點 4a**（`WorkspaceView.tsx`）：`retryOnceWhenRemoteConnected(initTerminals, ...)`，connected 後整段重跑一次（shell 查詢在動任何 terminal 之前） |
| 還原 terminal 的 `pty:create`（`createPtyWithReplay` / `createPtyThenLaunch`） | `pty:create` | proxied | 錯誤被 `createPtyWithReplay` 吞掉 → 分頁無 PTY | **處理點 4b**（`WorkspaceView.tsx`）：還原迴圈傳入 `restorePtyApi`（`pty.create` 包 `retryOnceWhenRemoteConnected`），connected 後重送一次；PTY 在遠端存活即 `created:false` → replay。**只限還原路徑**，新開分頁 / 預設分頁不重試 |
| claude-cli 還原（`terminal:create-with-command`）、整合式 Agent 面板（`claude:start-session`） | — | proxied | 被拒（不卡死，錯誤只到 console） | 未處理：`ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx` 有平行 T0436 未提交改動，本單不碰；記入 BUG-110 已知限制，連線後重開分頁即可 |

結論：fail-closed 後 init 不會卡死或白畫面（處理點 3 移除唯一的卡死點），未連線時視窗照常開啟、以預設設定顯示 workspace，連上後設定與還原的 PTY 各補一次。

#### 4. 測試

- `electron/__tests__/remote-connect-plan.test.ts`（31 → 50 例）：
  - 路由矩陣（9 例 + 1 例 property）：本機視窗 × {空槽、槽位已連線、重連中}、無 registry entry → `local`；remote 視窗 × {同 profile 已連線 → `remote`；同 profile 重連中 / 放棄、槽位他 profile、槽位空 → `refuse` 且 reason 正確}；remote 視窗在 6 種槽位狀態下皆不為 `local`。ALWAYS_LOCAL 維度以 source guard 鎖定（短路在路由之前、不查 registry）。
  - `computeRemoteWindowStatus`（5 種狀態）；`REMOTE_NOT_CONNECTED` 訊息格式 + 與 renderer 常數一致 + Electron 包裝後仍可辨識。
  - `planRemoteStatusPushes`（3 例，**事件推送對象**）：Q→P 換手兩邊都推且內容正確、清槽推 `no-client`、同狀態去重 / 略過 null / 失敗 connect 不打擾槽位 owner。
  - source guard（4 例）：ALWAYS_LOCAL 短路在路由前；路由後 `invokeHandler` 只剩 `local` 出口、其餘 `throw` + `REMOTE_INVOKE_REFUSED_CHANNEL`；四個槽位變更點皆 `pushRemoteClientStatus(...)`；每個 bound client 綁 listener、推送只走 `getWindowsForProfile(status.profileId)`。
- `electron/remote/__tests__/remote-client-status-change.test.ts`（新，2 例）：真 `RemoteClient` 對 in-process headless server：連線 ping（connected）→ server 關閉 ping（reconnecting）→ `disconnect()` ping（皆 false）；listener 拋錯不影響 `disconnect()`。
- `src/__tests__/remote-not-connected.test.ts`（新，11 例）：錯誤辨識；**提示每次斷線只出現一次**（連續 3 次拒絕 → 1 次；`reconnecting` 不重新武裝、`connected` 後再斷 → 第 2 次）；`waitForRemoteConnected`（事件 / 已先連上）；`retryOnceWhenRemoteConnected`（被拒 → connected 後重試一次、只重試一次、他種錯誤不重試）；`loadNowOrWhenRemoteConnected`（不阻塞、背景重載一次、重試失敗走 callback）；App / WorkspaceView init 呼叫點 source guard。
- 既有 `electron/remote/__tests__/headless-always-local.test.ts`「ALWAYS_LOCAL 在 `remoteClient.invoke(channel, args)` 之前」guard 維持綠（遠端出口保留該寫法）。

#### 5. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | `Test Files 139 passed (139)` / `Tests 2230 passed \| 1 skipped (2231)`（含工作樹中平行 Worker 未提交的測試） |
| `npx tsc --noEmit` | ✅ PASS | `39` 個 `error TS`（≤ 39）；本單改動檔 0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭ 未跑 | 依 memory_overrides（L141）刻意不跑 |
| runtime smoke | ⏭ 未跑（需實機） | 見下方實機步驟 |

**實機步驟（待人工驗收）**

A. WSL profile 視窗斷線 → 錯誤提示而非本機 shell
1. 開 WSL remote profile 視窗，確認可用（終端是 WSL shell、狀態列 remote connected）。
2. Windows 端執行 `wsl --shutdown`（或停 bat-server：`wsl -d <distro> -- systemctl --user stop bat-server`）。
3. 預期：debug.log 出現 `[RemoteClient] Disconnected`、`[remote-status] profile <id> → reconnecting (reconnecting)`、renderer `[T0443] remote status <id>: reconnecting`；狀態列在推送後立即（不必等 3 秒 polling）變未連線。
4. 在該視窗：新增終端分頁、在檔案樹展開資料夾、開 Git 面板。預期：出現**一次** warning toast「此遠端視窗目前未連線，操作未執行（不會改在本機執行）…」；debug.log 有 `[T0443] REMOTE_NOT_CONNECTED profile=<id> reason=reconnecting channel=pty:create` 等；**不會**出現本機 PowerShell / cmd，檔案樹不會列出本機 C:\ 內容。連續操作不重複洗 toast。
5. 恢復：重啟 WSL / bat-server，等 RemoteClient 自動重連 → `[remote-status] ... → connected`、狀態列回連線；之後再斷線會再提示一次。

B. 兩個不同 remote profile 同時開窗 → 先開者顯示未連線而非本機執行
1. 開 remote profile P 的視窗（連線正常）。
2. 從主視窗 ProfilePanel 開另一個 remote profile Q 的視窗 → Q 連線成功、佔走槽位。
3. 預期：debug.log `[remote-status] profile P → disconnected (other-profile)` 與 `profile Q → connected`；P 視窗狀態列變未連線。
4. 在 P 視窗新增終端 / 讀檔 → toast「遠端連線目前由另一個遠端配置的視窗使用…請重新開啟此配置的視窗以重新連線」只出現一次；**沒有**本機 shell。Q 視窗正常運作。
5. 關閉 P 視窗後重新開 P → P 取回槽位、Q 變未連線（多 profile 同時連線為已知限制，PLAN-039）。

C. 本機視窗不受影響（負向）：A / B 進行中，本機 profile 視窗的終端、檔案樹、Git、設定照常（全走本機），無 toast。

#### 6. 改動檔案

- `electron/remote/remote-connect-plan.ts`（`REMOTE_NOT_CONNECTED` / channel 常數、`computeRemoteWindowStatus`、`planProxiedInvokeRoute`、`formatRemoteNotConnectedError`、`planRemoteStatusPushes`）
- `electron/remote/remote-client.ts`（`isReconnecting`、`setStatusChangeListener` + 4 個 ping 點）
- `electron/main.ts`（import、`bindRemoteClient` listener、`currentRemoteSlot` / `pushRemoteClientStatus`、`bindProxiedHandlersToIpc`、4 個槽位變更點推送）
- `electron/preload.ts`、`src/types/electron.d.ts`（`remote.onClientStatusChanged` / `remote.onInvokeRefused`）
- `src/lib/remote-not-connected.ts`（新）
- `src/App.tsx`、`src/components/WorkspaceView.tsx`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`（`app.remoteNotConnected` / `app.remoteNotConnectedOtherProfile`）
- `electron/__tests__/remote-connect-plan.test.ts`、`electron/remote/__tests__/remote-client-status-change.test.ts`（新）、`src/__tests__/remote-not-connected.test.ts`（新）
- `_ct-workorders/BUG-110-remote-window-falls-back-to-local-handlers.md`（→ FIXED + 修復說明 + 已知限制）、本工單

**範圍偏差（依 YOLO 授權自行決定，事後回報）**：`affects_files` 未列 `electron/remote/remote-client.ts`、`src/lib/remote-not-connected.ts`、`electron/remote/__tests__/remote-client-status-change.test.ts`。memory_overrides 第 2 條要求「RemoteClient 連線狀態變化時推送事件」，main 不改 RemoteClient 就無法得知 socket 斷線 / 重連（只能輪詢），故加最小、純附加的 listener hook；renderer helper 依專案慣例放 `src/lib/`（`src/components/` 不放非元件邏輯）。皆為新增 API，未改既有行為。

#### 7. Commit

`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts` 工作樹含平行 T0436 未提交 hunk（main：`image-attachments` import、`dialog:select-attachments`、`clipboard:read-image-data-url`；preload / d.ts：`selectAttachments`、`readImageDataUrl`），以 `git diff` 擷取本單 hunk、`git apply --cached` 精準送進 index，其餘檔 `git add`，確認 `git diff --cached` 僅含本單內容後 `git commit`（不帶 pathspec）。訊息含 `T0443`；不 push；未使用 stash / reset / checkout / restore。hash 以 `git log --grep T0443` 查詢。

### 遭遇問題

- **Detached workspace 視窗仍 fail-open（既有，範圍外）**：`workspace:detach` 建立的視窗只放進 `detachedWindows`（key 是 workspaceId），不在 `windowMap` → `getWindowIdByWebContents` 回 `null` → `bindProxiedHandlersToIpc` 視為「無 profile 綁定」走本機。remote profile 視窗 detach 出來的 workspace 因此所有 proxied 呼叫都在本機執行（與 BUG-110 同類）；`getWindowsForProfile` 對 detached 視窗以 workspaceId 比對 registry window id，也收不到 remote 事件。修法需把 detached 視窗對回父視窗的 profile（例如 detach 時記 `workspaceId → parentWindowId`，路由與 `getWindowsForProfile` 一併查），建議另開單。
- **多 remote profile 同時連線**：本單後先開的 profile 視窗改為 fail-closed（提示 + 拒絕），仍需重開視窗取回槽位；根治見 PLAN-039。
- claude-cli 還原分頁與整合式 Agent 面板在未連線時被拒後不自動重試（第 3 節表格最後一列）。
- 工作樹有平行 Worker 的未提交改動（T0436 相關檔），本單未觸碰，commit 以 index 精準隔離。

### 回報時間

2026-10-05T06:27:01+08:00（Worker 時間戳取自 `date`）
