---
schema_version: 1
schema_kind: workorder
id: T0463
title: "PLAN-039 工單 2：main.ts 以 connection registry 取代單一 remoteClient 槽位（T0459 §1 表 #1-#21 全部使用點）；remote:connect 拒絕無綁定、remote:disconnect sender-scoped；移除 other-profile + renderer / preload / i18n 清理；遷移單一槽位前提的測試"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: L
created_at: "2026-10-05T11:29:43+08:00"
started_at: "2026-10-05T11:50:49+08:00"
updated_at: "2026-10-05T11:50:49+08:00"
completed_at: null
target_version: next
depends_on:
  - T0462
related:
  - "T0459 研究回報區 §1 使用點表（#1-#21）、§6 遷移測試清單、拆單第 2 列（🔴）；遭遇問題中併入本單的既有小問題（`remote:connect` 無綁定佔槽、`remote:disconnect` 無 sender 範圍、`cleanupAllProcesses` 未 await）"
  - "T0419 / T0430 / T0442 / T0443 / T0446 的 guard 測試需同步遷移"
  - "D135"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/App.tsx
  - src/lib/remote-not-connected.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **高風險單（🔴 L）**：大範圍改 `main.ts` 熱點。**本單執行期間塔台不派任何會改 `main.ts` / `preload.ts` / `electron.d.ts` 的平行工單**（避免 hunk 交錯）。先以 T0459 §1 表逐點盤點並在回報區列出每點處置，再動手。"
  - "🔴 不變式（守門必須維持綠）：ALWAYS_LOCAL 短路在路由前；`invokeHandler` 只剩 `local` 出口；remote 視窗未連線一律 `REMOTE_NOT_CONNECTED`（T0443）；pin 變更只拆該 profile（T0442）；detached 視窗依父 profile（T0446）；同 target + pin 才 reuse（T0419）。source guard 新增：無模組層 `let remoteClient` / `remoteClientProfileId`。"
  - "🔴 生命週期接線（寬限期 / 上限對話框 / quit 全量 await）屬 T0464，本單只需 registry 取代槽位且行為正確（可先用「最後視窗關閉立即 release」的最小實作，T0464 換成寬限期）。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push；不部署 WSL。"
---

# T0463 — main.ts 改用 registry（PLAN-039 工單 2）

## 驗收條件

- [ ] 回報區附 #1-#21 逐點處置表與遷移測試清單
- [ ] 整合（vitest in-process）：兩個 headless server + registry，停 Q server → 只有 Q reconnecting，P invoke 照常
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區全文 + T0462 回報區 + T0443 / T0446 / T0442 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

### 塔台補充（第五十六 session，派發前）

- T0462 已落地 `470f81a`：回報區「遭遇問題」末段有**給工單 2 / 3 的接線備註**（`run` 由呼叫端執行 `client.connect(...)`；log / `pushRemoteClientStatus` 依 outcome 在外層做；`settle` 成功時舊 client `void` disconnect）——照此接線。
- T0465 已落地 `b677e71`：`remote-client.ts` 有模組層 `fixedTunnelPortClaims`，於 `maybeCreateTunnel()` claim、`disconnect()` release。registry 經 `dropProfile` / 寬限期釋放 / `disconnectAll` 拆 client 時都必須走 `client.disconnect()`，claim 才會釋放；不要繞過 `disconnect()` 直接丟棄 client。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — `main.ts` 的單一 `remoteClient` / `remoteClientProfileId` / `remoteOpMutex` / `remoteClientTargets` 槽位全數改為 `RemoteConnectionRegistry`（T0462）；`remote:connect` 拒絕無綁定、`remote:disconnect` sender-scoped；`'other-profile'` 自 main / preload / renderer / i18n 移除；§6 單一槽位測試全數遷移；兩個 headless server 整合測試綠。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/main.ts` 等皆存在（informational）；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

**驗收條件**
- [x] 回報區附 #1-#21 逐點處置表與遷移測試清單（下方 1. / 3.）
- [x] 整合（vitest in-process）：兩個 headless server + registry，停 Q server → 只有 Q reconnecting，P invoke 照常（`remote-connection-registry-two-servers.test.ts`）
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` = 36（≤ 36）

### 產出摘要

**1. T0459 §1 使用點逐點處置（`electron/main.ts`）**

| # | 位置 | 處置 |
|---|------|------|
| — | 模組層狀態 | `let remoteClient` / `remoteOpMutex` / `remoteClientProfileId` / `remoteClientTargets` WeakMap 刪除 → `const remoteConnections = new RemoteConnectionRegistry<RemoteClient, ProfileEntry>({ createClient, countLiveWindows, onReleased })`。factory：`bindRemoteClient(new RemoteClient(() => getWindowsForProfile(profileId), profile), profileId)`（事件對象與 registry key 同一變數）；target 由 registry entry 記錄 |
| 1 | `cleanupAllProcesses` | `void remoteConnections.disconnectAll()`（全部 profile 都走 `client.disconnect()`，T0465 port claim 會釋放）；quit 時 **await** 屬 T0464（memory_override），本單維持 fire-and-forget |
| 2 | `bindRemoteClient` | 簽章 `profileId: string`；邏輯不變 |
| 3 | `currentRemoteSlot` | 刪除 → `remoteConnections.connectionState(profileId)` |
| 4 | `pushRemoteClientStatus` | `planProfileStatusPushes(profileIds, id => remoteConnections.connectionState(id), lastPushedRemoteStatus)` |
| 5 | `syncRemoteWorkspaceRoots` | `remoteConnections.get(windowProfileId)`；`shouldSyncWorkspaceRoots(windowProfileId, entry.profileId, client.isConnected)` |
| 6 | `loadProfileSnapshotDetailed` | `remoteConnections.connect({ profileId, profile, request, run })`；**先判 reuse**（同 target + pin 已連線 → 不再握手）；outcome `threw / reject / limit / aborted / failed` → `remote-unreachable`（`limit` 暫以 `reason: 'unreachable'` + 錯誤文字，專屬 `'limit'` reason + 對話框 i18n 屬 T0464）；`reuse / connected` → 取 snapshot |
| 7 | `restoreFromSnapshot` 啟動迴圈 | 經 #6；不需改（重啟前同開 WSL + SSH 不再互擠） |
| 8 | `second-instance` | 經 #6；不需改 |
| 9 | `openProfileWindows` | 經 #6；不需改；「連上沒建出視窗」由 registry 首窗保護 60 s 承接（connect 後無 live 視窗即自動排） |
| 10 | `clientPathTranslatorForBinding` | `remoteConnections.get(profile.id)?.client?.pathTranslator`（保留原語意：不要求已連線） |
| 11 | `bindProxiedHandlersToIpc` | `conn = remoteConnections.connectionState(senderProfileId)` → `planProfileProxiedInvokeRoute` → 出口 `senderClient = liveRemoteClient(senderProfileId)`；ALWAYS_LOCAL 短路仍在路由前、`invokeHandler` 只剩 `local` 出口 |
| 12 | `wslFolderDefaultForSender` | `liveRemoteClient(profileId)` |
| 13 | `remote:connect` | 以 `boundProfileId` 為鍵；`null` → registry 回 `reject`（`binding-missing`）；新增 `limit`（`errorCode: 'remote-limit'`）/ `aborted` 回傳；T0446 unresolved 拒絕保留在最前 |
| 14 | `remote:disconnect` | **sender-scoped**：`getSenderProfileBinding` → `dropProfile(profileId)` + push；無綁定 → no-op 回 `true` |
| 15 | `remote:client-status` | `liveRemoteClient(sender profile)` + 該 client 的 `connectionInfo` |
| 16 | `remote:test-connection` / `remote:list-profiles` | 不變（`new RemoteClient(() => [])` 暫時 client，不入 registry、不計上限） |
| 17 | `profile:update` | `shouldDropProfileConnectionOnUpdate({ ..., hasConnection: remoteConnections.has(profileId) })` → `dropProfile(profileId)`（per-profile mutex：同 profile 進行中的舊 pin connect 先 settle 再被拆）+ push；只拆該 profile |
| 18 | `remote-tools:install-pending` | 不變 |
| 19 | `remote-tools:take-pending-install` | `connected = !!liveRemoteClient(profileId)` |
| 20 | `getWindowsForProfile` | 不變；兼作 registry `countLiveWindows`（registry + detached 視窗；縮到 tray 的仍在 `windowMap`，算 live） |
| 21 | `getSenderProfileBinding` | 不變 |
| 22-23 | 視窗 / detached `closed` | **最小接線**：`windowMap.delete` / `detachedWindows.delete` 之後呼叫 `noteRemoteWindowClosed()`（對 registry 每個 profile 呼叫 `noteWindowClosed`，無 live 視窗即排 registry 內建 15 s 寬限、到期在 mutex 內重算）。未採「立即 release」：立即拆會打斷 `loadProfileSnapshotDetailed` 連上後、視窗建出前的空窗（見遭遇問題） |
| 24 | `powerMonitor resume` | 不變 |

新增 helper：`liveRemoteClient(profileId)`（該 profile 自己的已連線 client，否則 null）、`noteRemoteWindowClosed()`。

**2. 其他檔案**
- `electron/remote/remote-connect-plan.ts`：刪除單一槽位專用 `shouldDropClientOnProfileUpdate` / `RemoteSlotState` / `computeRemoteWindowStatus` / `ProxiedInvokeRoute` / `planProxiedInvokeRoute` / `planRemoteStatusPushes`；`RemoteNotConnectedReason` 移除 `'other-profile'`（`RemoteProfileNotConnectedReason` 改為其別名）；`planRemoteConnect` / `settleRemoteConnect` 保留（registry 使用）；註解同步
- `electron/preload.ts`：4 處 reason 型別移除 `'other-profile'`
- `src/lib/remote-not-connected.ts`：`RemoteNotConnectedReason` 移除 `'other-profile'`、註解更新
- `src/App.tsx`：refusal toast 一律 `app.remoteNotConnected`
- `src/locales/{en,zh-TW,zh-CN}.json`：刪 `app.remoteNotConnectedOtherProfile`（三語同步）
- `src/types/electron.d.ts`：`remote.disconnect` 註明只斷本視窗 profile

**3. 遷移測試清單（T0459 §6）**

| 測試 | 處置 |
|------|------|
| `remote-connect-plan.test.ts` `settleRemoteConnect` | 保留 |
| 同上 `remote:connect` guard（T0430） | 改寫：經 `remoteConnections.connect({ profileId: boundProfileId, ... })`、`run` 帶 `label` / `expectedFingerprint`、handler 內無 `new RemoteClient(`；`reject` / `limit` / `failed` 皆回 error，`connected: true` 只 2 處（reuse / connected） |
| 同上 `loadProfileSnapshotDetailed` guard（T0442） | 改寫：經 registry（含 `case 'reuse'`、無 `new RemoteClient(`）；5 種失敗 outcome 皆在 snapshot fetch 前回 `remote-unreachable` |
| 同上 `shouldDropClientOnProfileUpdate` | 刪除（T0462 `shouldDropProfileConnectionOnUpdate` 已涵蓋） |
| 同上 `profile:update` guard | 改寫：`hasConnection: remoteConnections.has(profileId)`、`dropProfile` 在 guard 後、無 `disconnectAll` |
| 同上 路由矩陣 / `computeRemoteWindowStatus` / `planRemoteStatusPushes` | 改寫為 `planProfileProxiedInvokeRoute` 矩陣（含「Q connected 時無 entry 的 P 仍拒絕 `no-client`」）、`planProfileStatusPushes`（開 Q 不推 P、drop → `no-client`、Q 失敗 P 安靜）；`other-profile` 案例 6 處全刪；`computeRemoteWindowStatus` 刪（T0462 `computeProfileWindowStatus` 已涵蓋） |
| 同上 `bindProxiedHandlersToIpc` / 推送 wiring guard（T0443） | 改寫；保留「ALWAYS_LOCAL 在路由前」「`invokeHandler` 只剩 `local` 出口」；新增 conn 以 `senderProfileId` 查、出口 `senderClient.invoke`、每個 registry 變更點（connect / disconnect / update / `onReleased`）都 push |
| 新增 guard | 無模組層 `let remoteClient` / `remoteClientProfileId` / `remoteOpMutex` / `remoteClientTargets` / `currentRemoteSlot`；所有 profile client 僅由 registry factory 建立（`getWindowsForProfile(profileId)` 與 key 同變數）；quit `disconnectAll`；視窗 / detached `closed` → `noteRemoteWindowClosed`；`remote:disconnect` sender-scoped；status / path translator / WSL folder / take-pending-install / roots sync 讀 sender 自己的 entry |
| `detached-window-profile-binding.test.ts` | 路由矩陣改為 registry entries（`'other profile'` → `'only Q connected'` 得 `no-client`）；unresolved 在「所有 profile 都連著」時仍拒絕；guard 改 `planProfileProxiedInvokeRoute(` |
| `headless-always-local.test.ts` :60 | 出口字面 `remoteClient.invoke(` → `senderClient.invoke(`，語意不變 |
| `remote-client-status-change.test.ts` / `src/__tests__/remote-not-connected.test.ts` / `remote-tool-install-queue.test.ts` | 不受影響（全綠） |
| **新增** `electron/remote/__tests__/remote-connection-registry-two-servers.test.ts` | 兩個 in-process headless server + 真 `RemoteClient` + registry：P / Q 並行連線各自一個 client；P 第二次 connect `reuse`；停 Q server → 只有 Q reconnecting、Q 路由 `refuse(reconnecting)`、P 仍 `remote` 且 `profile:load-snapshot` invoke 成功；`dropProfile('Q')` 不影響 P |

**驗證**
| lane | 結果 | 證據 |
|------|------|------|
| 單檔 | ✅ PASS | `remote-connect-plan.test.ts` 63 passed；detached / always-local / remote-tool-install 3 files 66 passed；two-servers 1 passed |
| `npm run test:unit` | ✅ PASS | 167 files passed；2826 passed / 1 skipped（輸出中的 `Error: AttachConsole failed` 為既有 node-pty 子行程噪音，非失敗） |
| `npx tsc --noEmit` | ✅ PASS | 36 errors（= 門檻 36）。注意此 gate 只涵蓋 `src/` |
| electron 型別（補充） | ✅ | scratchpad tsconfig（extends `tsconfig.node.json`，ES2022）檢查 `electron/**`：本單觸及檔案 0 個新錯誤（`main.ts` 殘留皆為既有：`Handler` 簽章、`app.dock`、`fs.promises`、`ShortcutDetails`）；`remote-connection-registry.test.ts`（T0462）有 2 個既有型別錯誤，非本單 |
| build / runtime / 實機 | — | 依工單只跑上兩項（L141）；WSL + SSH 實機同開驗收屬工單 5 |

### 遭遇問題

- **範圍延伸（1 檔）**：`electron/remote/remote-connect-plan.ts` 不在 `affects_files`，但 `'other-profile'` 定義於該檔的 `RemoteNotConnectedReason`，「移除 other-profile」必須改它；一併刪除已無呼叫者的單一槽位函式（T0462 註解即言明「stay until main.ts moves to the registry (T0463)」）。新增測試檔落在 `electron/remote/__tests__/`（在範圍內）。
- **視窗關閉採 registry 寬限期而非「立即 release」**：`noteRemoteWindowClosed()` 對 registry 內每個 profile 判斷（關閉中的視窗 registry entry 可能已先被 `removeEntry`，無法可靠得知其 profile）。若立即拆，任一不相關視窗關閉都會把 `loadProfileSnapshotDetailed` 剛連上、視窗尚未建出的 profile 拆掉（snapshot fetch 失敗 → 誤報 remote-unreachable）；registry 的 15 s 寬限 + 到期重算 + connect 後 armAfterUse 吸收此空窗。**T0464 剩餘範圍**：quit 全量 await（`runCleanupOnce` 目前同步）、`'limit'` 專屬 reason + 三語對話框 / 提示（目前 `remote-unreachable` + 錯誤文字 / `errorCode: 'remote-limit'`）、同 target warn log（`connected` outcome 已帶 `sameTargetProfileIds`，未接）、寬限期 / tray 的 main 層測試。
- `remote:connect` 的 `boundProfileId === null` 改為拒絕（`binding-missing`）；renderer 只在 `active.type === 'remote'` 時呼叫，實務不可達。
- `tsc --noEmit` gate 不涵蓋 `electron/`（`tsconfig.json` include 只有 `src`），故另以 scratchpad tsconfig 檢查 electron 型別（未留檔於 repo）。
- 未使用 stash / reset / checkout / restore；寫檔維持 LF（git 的 CRLF warning 為 autocrlf 提示）；同工作樹開工時 clean，無他人改動。

### 回報時間

2026-10-05T12:00:59+08:00（Worker 時間戳取自 `date`）
