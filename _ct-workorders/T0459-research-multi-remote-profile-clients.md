---
schema_version: 1
schema_kind: workorder
id: T0459
title: "研究：PLAN-039 多個 remote profile 同時連線——單一 remoteClient 槽位使用點盤點、per-profile client map 設計、生命週期 / 事件路由 / 資源上限、拆單"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:19:13+08:00"
started_at: "2026-10-05T11:20:22+08:00"
updated_at: "2026-10-05T11:27:45+08:00"
completed_at: "2026-10-05T11:27:45+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-039（待研究清單）；BUG-110 / T0443（fail-closed + `REMOTE_NOT_CONNECTED` + `remote:client-status-changed`）"
  - "T0419 / T0430 / T0442（`remote-connect-plan.ts`：`planRemoteConnect` / `settleRemoteConnect` / pin 變更 fail-closed）；T0446（detached 視窗綁 profile）"
  - "PLAN-036 K（T0431-T0434、T0447-T0451：helper 連線、broadcastHub、`countBroadcastReceivers`）"
  - "使用者 2026-10-05 06:14 裁決開 PLAN、11:19 裁決開研究單"
affects_files:
  - _ct-workorders/T0459-research-multi-remote-profile-clients.md
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: decision-requiring
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。可在 scratchpad 寫探測腳本，不得留在 repo。"
  - "🔴 不部署、不改 WSL / 遠端主機。"
  - "🔴 同工作樹可能有其他 Worker（T0460 改 `electron/main.ts` 的 `shell:open-external`）：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。只 commit 本工單；不 push。"
---

# T0459 — 研究：多 remote profile 同時連線（PLAN-039）

## 背景

`electron/main.ts` 只有一個 `remoteClient` / `remoteClientProfileId` 槽位。兩個不同 remote profile（例：WSL + SSH）同時開視窗時，後開者佔走槽位；T0443 後先開者 fail-closed 顯示「未連線」（`app.remoteNotConnectedOtherProfile`），需重開視窗才能換回。要真正並行使用多個遠端環境，需每個 profile 各自持有 client。

## 研究目標

1. **槽位使用點盤點**（附 `檔案:行`）：`remote:connect`、`loadProfileSnapshotDetailed`、`profile:update`（pin 變更）、`remote:disconnect` / `remote:client-status`、`bindProxiedHandlersToIpc`（`planProxiedInvokeRoute`）、`remoteClientTargets`、`remoteOpMutex`、`getWindowsForProfile` 與 RemoteClient 事件轉發（`PROXIED_EVENTS`）、T0443 狀態事件、detached 視窗（T0446）、path translator 取得處、system resume、其他任何讀 `remoteClient` 的地方
2. **資料結構與並行**：`Map<profileId, { client, target, mutex, status }>`；每 profile 一把 mutex 還是全域；`remote-connect-plan.ts` 純函式如何改成以 profile 為鍵
3. **生命週期**：何時建立 / 斷線（最後一個綁該 profile 的視窗關閉？閒置逾時？），重連策略，app 結束清理（SSH tunnel 子行程）
4. **事件路由**：遠端事件只送綁該 profile 的視窗；複核目前是否有「送給所有視窗」的廣播語意需修
5. **資源**：同時連線數上限、SSH tunnel 本機埠配置衝突、記憶體
6. **與 K 的關係**：本機 BAT 同時連多個 headless server 時，各 server 的 helper / 權杖各自獨立，`created-externally` / `notified` 路由到正確視窗
7. **測試策略**：parity / 守門、單元、e2e 兩個 loopback profile 同時開窗
8. **遷移風險**：哪些既有測試（T0419 / T0430 / T0442 / T0443 / T0446）以單一槽位為前提，需同步改寫
9. **拆單建議**（D 區段表格）

## 互動規則

- 允許向使用者提問（`CT_INTERACTIVE=1`），最多 3 題，選項式（例：生命週期策略、連線數上限）
- 不互動時：給推薦 + 理由

## 回報要求

- 盤點表、設計建議、風險
- `### 拆單建議摘要` 段落，第一個表格欄位必須為 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`（標題欄先用「工單 1」等占位，塔台會補 T####）

## Sub-session 執行指示
1. 讀本工單 + PLAN-039 + BUG-110 + T0443 / T0446 / T0442 回報區 + `electron/remote/remote-connect-plan.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE**（研究單，未改產品程式碼）— 單一 `remoteClient` 槽位共 **24 個使用點**已盤點（附 `檔案:行`），per-profile connection registry 設計、生命週期、事件路由、資源上限、與 K 的關係、測試策略、遷移風險皆已完成；3 個產品決策經使用者裁決（皆採推薦選項），拆成 5 張工單。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`affects_files` 僅本工單（`_ct-workorders/` 排除）→ not applicable；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=1`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **行號基準**：`electron/main.ts` 行號一律以 `HEAD`（`cda15dd`）為準——同工作樹的 T0460 Worker 正在改 `main.ts`（工作樹版本行號已位移數行）。其他檔案以工作樹為準（未被他人修改）。

### 互動紀錄

| # | 問題 | 選項 | 使用者裁決 |
|---|------|------|------|
| Q1 | 每個 profile 的 RemoteClient 何時斷線 | 最後視窗關閉 + 寬限期 / 最後視窗關閉立即斷 / 保留到 app 結束 | **最後視窗關閉 + 寬限期**（推薦） |
| Q2 | 同時連線的 remote profile 數上限 | 上限 8 超過拒絕 / 不設上限 / 上限 4 | **上限 8，超過拒絕**（推薦） |
| Q3 | 兩個不同 profile 指向同一 server（同 host:port:token，例如 `profile:duplicate`） | 允許 + warn / 拒絕第二條 / 共用同一 client | **允許，但記錄 warn**（推薦） |

（一次提問三題，2026-10-05 11:20–11:25 之間作答。）

### 調查結論

#### 1. 單一槽位使用點盤點（`electron/main.ts` @ `cda15dd`）

狀態變數：`remoteClient`（:466）、`remoteOpMutex`（:469，全域一把）、`remoteClientProfileId`（:473）、`remoteClientTargets` WeakMap（:477）、`lastPushedRemoteStatus`（:1247，已是 per-profile Map）。

| # | 位置 | 用途 | 讀 / 寫 | per-profile 改法 |
|---|------|------|--------|------------------|
| 1 | `cleanupAllProcesses` :1178-1190（:1182 `remoteClient?.disconnect()` 未 await） | app 結束清理 | 寫（清空） | 迭代 registry 全部 `disconnect()`，`Promise.allSettled` + 上限 2 s 等 ssh 子行程退出 |
| 2 | `bindRemoteClient` :1227 | 綁 workspace roots provider + T0443 status listener（閉包已帶 `profileId`） | — | 不變（已 per-profile） |
| 3 | `currentRemoteSlot` :1236 | 路由 / 狀態規則的槽位快照 | 讀 | 改 `connectionState(profileId)`：查 registry 該 profile entry |
| 4 | `pushRemoteClientStatus` :1250 | 推 `remote:client-status-changed` 給 `getWindowsForProfile` | 讀 | 每個 profileId 以自己的 entry 計算；`lastPushedRemoteStatus` 沿用 |
| 5 | `syncRemoteWorkspaceRoots` :1259（呼叫點 `workspace:save` :2083、`workspace:load` :2097） | T0406 roots 推送 | 讀 | `registry.get(windowProfileId)?.client` 已連線才推（`shouldSyncWorkspaceRoots` 第 2 參數改為 entry 的 key，恆等） |
| 6 | `loadProfileSnapshotDetailed` :1269-1350（mutex :1287、`settleSlot` :1292-1301、建 client :1309、targets :1324） | 開 profile 視窗前連線並取 snapshot（T0442） | 寫 | 改用該 profile 的 mutex / entry；**先 `planRemoteConnect` 判 reuse**（現況每次都新建 client 並擠掉同 profile 舊 client）；新增上限檢查 |
| 7 | `restoreFromSnapshot` :1483 + 啟動迴圈 `for (const pid of activeProfileIds)` :1539 | 啟動時依序還原所有 active profile | 經 #6 寫 | **現況已會觸發 PLAN-039**：重啟前同時開著 WSL + SSH → 依序連線後只剩最後一個 remote profile 持有槽位，前者一開窗就是 `other-profile`。改 registry 後自動修好；迴圈不需改 |
| 8 | `second-instance` :1666 | `--profile=` 第二實例開窗 | 經 #6 寫 | 同 #6 |
| 9 | `openProfileWindows` :3094（`app:open-new-instance` :3123） | ProfilePanel 開 profile 視窗 | 經 #6 寫 | 同 #6；另需「連上但沒建出視窗」的保護（見生命週期） |
| 10 | `clientPathTranslatorForBinding` :2255（T0437） | 附件路徑轉換用 live translator | 讀 | `registry.get(profile.id)?.client?.pathTranslator` |
| 11 | `bindProxiedHandlersToIpc` :2316-2318（`planProxiedInvokeRoute` + `remoteClient.invoke`） | proxied channel 路由（T0443 / T0446） | 讀 | 以 `senderProfileId` 取 entry → `planProxiedInvokeRoute({ ..., conn })` → `entry.client.invoke` |
| 12 | `wslFolderDefaultForSender` :2354 | WSL 資料夾對話框預設路徑（T0393） | 讀 | 共用 helper `isProfileLive(profileId)` |
| 13 | `remote:connect` :2536-2604（`settleSlot` :2542-2551、binding :2561、`current` :2574、建 client :2586、targets :2594） | renderer initProfile 連線（T0419 / T0430 / T0446） | 寫 | 以 `boundProfileId` 為鍵；**`boundProfileId === null` 改為拒絕**（現況會以 profileId null 佔走槽位；renderer 只在 `active.type === 'remote'` 時呼叫，實務不可達，但 registry 無鍵可放）；reuse 時取消該 profile 的閒置計時 |
| 14 | `remote:disconnect` :2606-2616 | 清空槽位 | 寫 | **改為 sender-scoped**（只斷 sender 綁定的 profile）；現況任何視窗都能斷掉全域槽位。preload 有暴露（`electron/preload.ts:645`），`src/` 無呼叫者 |
| 15 | `remote:client-status` :2618-2625 | 視窗狀態查詢（App 3 秒 polling、resume、SettingsPanel） | 讀 | `isProfileLive(senderProfileId)` + 該 entry 的 `connectionInfo` |
| 16 | `remote:test-connection` :2627、`remote:list-profiles` :2853 | 暫時 client（`new RemoteClient(() => [])`），不碰槽位 | — | 不變；**不計入上限** |
| 17 | `profile:update` :2889-2915（pin 變更 :2896-2912） | T0442 pin 變更 fail-closed | 寫 | 只拆**該 profile** 的 entry；`shouldDropClientOnProfileUpdate` 的 `slotProfileId` 改 `hasConnection: boolean` |
| 18 | `remote-tools:install-pending` 推送 :3134 | `getWindowsForProfile` | — | 不變 |
| 19 | `remote-tools:take-pending-install` :3146 | 「該視窗連線是否 live」 | 讀 | `isProfileLive(profileId)` |
| 20 | `getWindowsForProfile` :781（含 T0446 detached） | 事件轉發 / 狀態推送對象 | — | 不變（已 per-profile）；另供生命週期計算「該 profile 還剩幾個 live 視窗」 |
| 21 | `getSenderProfileBinding` :847（T0446） | sender → profile 綁定 | — | 不變 |
| 22 | 視窗 `close` :1040-1135（最後一個視窗 → `deactivateProfile` :1071）／`closed` :1143 | 視窗生命週期 | — | **現況完全不碰槽位**：最後一個視窗關閉後 client 仍連著，直到被別的 profile 擠掉或 app 結束。改為 release（見生命週期） |
| 23 | `workspace:detach` :3208（detached `closed` 在其後） | detached 視窗關閉 | — | 同 #22，detached 也算 live 視窗 |
| 24 | `powerMonitor.on('resume')` :1704 | 只把 `system:resume` 送所有視窗；renderer 再查 `remote:client-status` | — | 不需改；RemoteClient 各自 backoff 重連 |

`electron/` 其他檔案無模組層 `remoteClient` 引用（`grep` 確認）；`RemoteClient` 本身（`electron/remote/remote-client.ts`）已是 per-instance 狀態（tunnel、pending、translator、reconnect timer），**不需改**。

#### 2. 純函式（`electron/remote/remote-connect-plan.ts`）以單一槽位為前提者

| 函式 | 行 | 現況前提 | 改法 |
|------|----|---------|------|
| `planRemoteConnect` | :68 | `current.profileId === boundProfileId` 才 reuse | 輸入改為「該 profile 的 entry」，profileId 比對恆真可刪；`boundProfileId === null` 新增 `reject`（`errorCode: 'binding-missing'`） |
| `RemoteClientSlot` / `settleRemoteConnect` | :116 / :129 | 泛型槽位 | **原樣沿用**為「單一 entry 內的換手」規則（成功才換、失敗 dispose candidate） |
| `shouldDropClientOnProfileUpdate` | :164 | `slotProfileId` | 改 `hasConnection: boolean` |
| `RemoteSlotState` / `computeRemoteWindowStatus` | :191 / :214 | `slot.profileId !== profileId → 'other-profile'` | 輸入改 `RemoteProfileConnState \| null`（null → `no-client`）；**`'other-profile'` 不再產生** |
| `RemoteNotConnectedReason` | :200 | 含 `'other-profile'` | 移除該成員，同步移除 `src/App.tsx:727` 分支、`src/lib/remote-not-connected.ts`、`electron/preload.ts`（4 處型別）與 i18n `app.remoteNotConnectedOtherProfile`（三語 :39） |
| `planProxiedInvokeRoute` | :234 | `slot` | 改收 `conn`（呼叫端以 `senderProfileId` 查好） |
| `planRemoteStatusPushes` | :258 | 一個 `slot` 算所有 profile | 改收 `getConn(profileId)` |
| `resolveDetachedProfileBinding` / `senderBindingProfileId` / `detachedSenderRouteIdentity` | :307 / :319 / :330 | 與槽位無關 | 不變；`UNRESOLVED_DETACHED_PROFILE_ID` 在 registry 永無 entry → 恆 refuse，語意保持 |

#### 3. 事件路由複核

- **遠端事件已是 per-profile**：`RemoteClient` 建構時傳入 `() => getWindowsForProfile(profileId)`（main.ts :1309、:2586），`remote-client.ts:475-483` 只送 `this.getWindows()`；`PROXIED_EVENTS`（`electron/remote/protocol.ts:97-115`）全部走這條。**沒有需要修的「送給所有視窗」遠端廣播**；多 client 後每個 client 天然只送自己 profile 的視窗。
- T0443 狀態推送（:1250）同樣只送 `getWindowsForProfile`。
- 送所有視窗的是**本機來源**事件：`createElectronClaudeEmit(getAllWindows)`（:767、:2142）、`system:resume`（:1704）、本機 `broadcastHub`——既有行為，renderer 以 session / terminal id 過濾，PLAN-039 不需改，僅記錄。
- 唯一新風險：**同 target 雙 profile**（Q3）——兩條連線各自把同一 server 的事件送到各自視窗；若兩邊視窗都掛著同一 remote PTY id（同 `remoteProfileId` snapshot），`terminal:keypress`（`bat-notify --submit`）會被兩個 renderer 各送一次 Enter。依 Q3 裁決：允許 + `logger.warn`，列已知限制。

#### 4. 資源

- **上限 8**（Q2）：計 registry entry 數（含連線中 / 重連中；不含 #16 暫時 client）。第 9 個 profile 開窗 → 回 `remote-unreachable`（新 reason `'limit'`）走既有 `showRemoteProfileFailureDialog`，**不擠掉既有連線**。上限檢查與 entry 佔位需在同一個同步區段（JS 單執行緒，佔位後才 `await`），避免兩個 profile 同時開窗時都通過檢查。
- **SSH tunnel 本機埠**：`SshTunnel.pickFreePort`（`electron/remote/ssh-tunnel.ts:177-196`）`listen(0)` → close → `ssh -L <port>`（:112-116），有 TOCTOU；改 per-profile mutex 後兩個 SSH profile 可**並行**建 tunnel，碰撞機率上升（仍低，OS 不會立即重發同埠）。`tunnelLocalPort`（`electron/profile-manager.ts:47`，註解「schema slot only」）若兩個 profile 填同一固定埠，後者 ssh 綁埠失敗。**安全面**：`waitUntilReady` 若連到別人的 tunnel，wss 仍會因 fingerprint pin 不符被拒（fail-closed），不會連錯 server；可用性面建議 EADDRINUSE 時換埠重試一次（非固定埠）、固定埠重複時 log warn（工單 4，P3）。
- **記憶體 / 行程**：每條連線 = 1 個 wss + pending map + PathTranslator；SSH profile 多 1 個 `ssh.exe`（數 MB）。上限 8 下可忽略。
- WSL keep-alive（`syncWslKeepAlive` :1164）以 profile 清單為準，與槽位無關，不受影響。

#### 5. 與 K（PLAN-036）的關係

- helper 權杖、`helper-capability.ts` 範圍、權杖撤銷全在**各 headless server 內**，本機 BAT 連幾台 server 不影響；本機 Electron PTY 的全權 token 不變。
- `terminal:created-externally` / `terminal:notified` / `terminal:keypress` 都在 `PROXIED_EVENTS`，由持有**該 server** 連線的 client 送到**該 profile** 視窗 → 多 client 後路由正確 by construction。
- **改善**：現況 profile P 被 Q 擠掉時 P 的 client 被 disconnect → P server 的 `countBroadcastReceivers`（`electron/remote/remote-server.ts:445`，`headless-entry.ts:887`）歸零 → P 上的 Worker `bat-notify --submit` 得 `no-client`，T0404 孤兒回收也可能把 P 的 PTY 當孤兒。per-profile 後 P 持續連線，兩者皆消失。
- 同 target 雙 profile → 該 server 有 2 個 receiver → 雙 Enter（見 §3，已知限制）。

#### 6. 遷移風險：以單一槽位為前提的既有測試

| 測試檔 | 位置 | 前提 | 處置 |
|--------|------|------|------|
| `electron/__tests__/remote-connect-plan.test.ts` | :159 `settleRemoteConnect` | 泛型槽位 | 保留 |
| 同上 | :194-211 `remote:connect` source guard（`remoteClient\s*=\s*null`、`settleRemoteConnect(`） | 模組層變數名 | 改寫成 registry 版 regex |
| 同上 | :213-229 `loadProfileSnapshotDetailed` guard（`remoteClient\s*=\s*client`、`settleSlot(false)`） | 同上 | 改寫；新增「先判 reuse」斷言 |
| 同上 | :248-268 `shouldDropClientOnProfileUpdate`、:270-288 `profile:update` guard（`remoteClient = null`、`remoteOpMutex.then(`） | `slotProfileId`、全域 mutex | 改 `hasConnection`、per-profile mutex |
| 同上 | :291-322 路由矩陣、:324 `computeRemoteWindowStatus`、:346 `planRemoteStatusPushes`（Q→P 換手） | `'other-profile'`、單一 slot | 改寫為「P / Q 各自狀態獨立」矩陣；刪 `other-profile` 案例（共 6 處） |
| 同上 | :376-397 `bindProxiedHandlersToIpc` guard、:400-426 推送 wiring guard（`remoteClientProfileId = next.slot.profileId\s+pushRemoteClientStatus(...)` 等 4 個槽位變更點、`currentRemoteSlot()`） | 變數名 / 變更點 | 改寫；「ALWAYS_LOCAL 在路由前」「`invokeHandler` 只剩 `local` 出口」兩條語意**必須保留** |
| `electron/__tests__/detached-window-profile-binding.test.ts` | 路由矩陣（`other-profile` 1 處）、source guard :150-181 | slot 狀態 | 矩陣改寫；guard 多半不變 |
| `electron/remote/__tests__/headless-always-local.test.ts` | :60 字面 `remoteClient.invoke(channel, args)` | 遠端出口寫法 | 改成新出口字面，保留「ALWAYS_LOCAL 在遠端出口之前」語意 |
| `electron/remote/__tests__/remote-client-status-change.test.ts` | — | RemoteClient 層 | 不受影響 |
| `src/__tests__/remote-not-connected.test.ts` | — | 未用 `other-profile` | 不受影響（App source guard 若比對 :727 文字需同步） |
| `e2e/plan036-p0.spec.ts` | :72 `openLoopbackRemoteWindow` | 單一 remote 視窗 | 不受影響，可重用於多 profile e2e |

另：`main.ts` 是熱點檔（本單執行期間 T0460 正在改），工單 2 diff 大，**排程時避開其他動 `main.ts` 的 Worker**。

### 建議方向

**資料結構**（新模組 `electron/remote/remote-connection-registry.ts`，不 import electron，client factory 注入以便測試）：

```ts
interface RemoteProfileConnection {
  profileId: string
  client: RemoteClient | null        // null = 首次連線進行中（已佔上限名額）
  target: RemoteConnectTarget | null // 取代 remoteClientTargets WeakMap
  mutex: Promise<unknown>            // per-profile 串行化 connect / disconnect / pin 變更
  idleTimer: ReturnType<typeof setTimeout> | null
}
// Map<profileId, RemoteProfileConnection>；MAX_CONCURRENT_REMOTE_PROFILES = 8；IDLE_GRACE_MS = 15_000
```

- **mutex：每 profile 一把**（不同 profile 的握手 / SSH tunnel 可並行，不互相卡住；同 profile 的 connect / pin 變更 / release 仍串行，保住 T0184 / T0430 / T0442 的語意）。上限佔位在同步區段完成，不需全域 mutex。
- **純函式以 profile 為鍵**：見 §2 表；新增 `planConnectionAdmission({ entryCount, hasEntry, cap })`、`planIdleRelease({ liveWindowCount, hasEntry })`、`findSameTargetProfiles(entries, target)`（warn 用）。

**生命週期**（Q1）：
1. 建立：#6 / #13 以 profile 為鍵 acquire；有 live 且同 target + pin 的 entry → reuse，並取消閒置計時。
2. 釋放：registry 視窗 `closed`（:1143）與 detached `closed` 後，計算 `getWindowsForProfile(profileId).length`；為 0 → 排 `IDLE_GRACE_MS = 15 s` 計時；到期在該 profile mutex 內**再算一次**仍為 0 才 `disconnect()` + 刪 entry + 推 `no-client`。縮到 tray 的視窗仍在 `windowMap`，算 live。
3. 開窗保護：#6 連上後若沒建出任何視窗（例外中斷），entry 建立時即排 60 s「等待首個視窗」計時，首個視窗 `remote:connect` reuse 時取消。
4. 重連：沿用 RemoteClient 既有 per-client 指數 backoff + tunnel 重啟上限；**不**做跨 client 協調，**不**新增自動重連（T0443 決策不變）。被擠掉的情境消失，`other-profile` 隨之移除。
5. pin 變更：只拆該 profile entry（T0442 語意不變）。
6. app 結束：#1 迭代全部，`Promise.allSettled` 等 ssh 子行程退出（上限 2 s）。

**殘餘風險**
- 同 target 雙 profile 的雙 Enter（已知限制，Q3）。
- `getWindowsForProfile` 讀 `windowRegistry.getCachedEntries()`；閒置判斷需確認關窗流程中 `removeEntry` 與 `windowMap.delete` 的先後不會讓計數暫時誤判為 0——寬限期 + 到期重算可吸收。
- 多 client 後 `remote:client-status` 3 秒 polling 次數不變（每視窗只查自己 profile），無額外負擔。
- 實機驗收需 WSL + SSH 兩個真環境同時開，AI 無法代驗。

### 拆單建議摘要

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|----|
| 1 | 工單 1：per-profile connection registry 模組 + 純函式改以 profile 為鍵（`remote-connection-registry.ts`、`remote-connect-plan.ts`；上限 8、閒置寬限 15 s、同 target 偵測；單元測試，**不接 main.ts**） | PLAN-039 | — | M | 🟢 |
| 2 | 工單 2：`main.ts` 以 registry 取代單一槽位（§1 表 #1-#21 全部使用點；`remote:connect` 拒絕無綁定、`remote:disconnect` sender-scoped；移除 `other-profile` + renderer / preload / i18n 清理；遷移 §6 測試） | PLAN-039 | 工單 1 | L | 🔴 |
| 3 | 工單 3：生命週期接線（registry / detached `closed` → release + 寬限期、開窗保護計時、quit 全量 await、上限拒絕 `'limit'` reason + 對話框 i18n、同 target warn log） | PLAN-039 | 工單 2 | M | 🟡 |
| 4 | 工單 4：SSH tunnel 本機埠健壯性（`pickFreePort` EADDRINUSE 換埠重試一次、固定 `tunnelLocalPort` 重複時 warn） | PLAN-039 | — | S | 🟢 |
| 5 | 工單 5：e2e 兩個 isolated BAT 實例互為 server（A 開 P→A 自身、Q→B）：雙視窗皆 connected、`pty:create` 落在正確 server、關 P 寬限期後斷線且 Q 不受影響、第 9 個 profile 被拒；外加實機 WSL + SSH 同開驗收步驟（含兩邊 `bat-notify --submit`） | PLAN-039 | 工單 3 | M | 🟡 |

🚦：🟢 低風險 / 🟡 中 / 🔴 高（大範圍改熱點檔、遷移多組 guard）。

**測試策略**
- 守門（source guard）：`main.ts` 不再有模組層 `let remoteClient` / `remoteClientProfileId`；每個 `new RemoteClient(` 的 `getWindowsForProfile(<id>)` 與 registry key 同一變數；ALWAYS_LOCAL 短路仍在路由之前、`invokeHandler` 只剩 `local` 出口（沿用 T0443 / T0446 guard 語意）。
- 單元：registry（fake timers 驗寬限期 / 重算 / 取消；上限第 9 個拒絕且不擠掉既有；同時兩個 admission 不超額）；路由矩陣「P connected × Q reconnecting」各自獨立。
- 整合（vitest、in-process）：沿用 `remote-client-status-change.test.ts` 手法起**兩個** in-process headless server + registry：停 Q server → 只有 Q reconnecting，P invoke 照常。
- e2e：工單 5（兩實例優於「兩個 profile 同指一台 loopback server」——後者走的是同 target 路徑，證明不了路由正確）。

### 遭遇問題

- 同工作樹 T0460 Worker 正在改 `electron/main.ts`（`shell:open-external`）與 i18n 三語檔：本單只讀，`main.ts` 行號以 `HEAD`（`cda15dd`）快照為準（以 `git show HEAD:electron/main.ts` 取得，暫存於系統 temp 後已刪除，未留在 repo）。未使用 stash / reset / checkout / restore。
- 盤點中發現的既有小問題（皆併入工單 2，不另開 BUG）：`remote:connect` 無綁定 sender 會以 profileId null 佔走槽位（實務不可達）；`remote:disconnect` 無 sender 範圍（無 renderer 呼叫者）；`cleanupAllProcesses` 的 `disconnect()` 未 await。
- 未跑 build / test：研究單未改程式碼。

### 回報時間

2026-10-05T11:27:40+08:00（Worker 時間戳取自 `date`）
