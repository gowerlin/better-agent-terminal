---
schema_version: 1
schema_kind: workorder
id: T0462
title: "PLAN-039 工單 1：per-profile connection registry 模組（remote-connection-registry.ts）+ remote-connect-plan.ts 純函式改以 profile 為鍵；上限 8、閒置寬限 15 s、同 target 偵測；只單元測試，不接 main.ts"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: "2026-10-05T11:42:43+08:00"
updated_at: "2026-10-05T11:49:50+08:00"
completed_at: "2026-10-05T11:49:50+08:00"
target_version: next
depends_on: []
related:
  - "T0459 研究（`49d71f9`）回報區「建議方向」資料結構 / 生命週期 / 測試策略與拆單第 1 列；使用者 Q1-Q3 裁決（最後視窗關閉 + 寬限期、上限 8、同 target 允許 + warn）"
  - "D135（PLAN-039 拆單，下 session 起派）"
affects_files:
  - electron/remote/remote-connection-registry.ts
  - electron/remote/remote-connect-plan.ts
  - electron/remote/__tests__/
  - electron/__tests__/remote-connect-plan.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0459 回報區「建議方向」與 §2 表（純函式以 profile 為鍵）。新模組不 import electron，client factory 注入。`MAX_CONCURRENT_REMOTE_PROFILES = 8`、`IDLE_GRACE_MS = 15_000`、開窗保護 60 s；每 profile 一把 mutex；上限佔位在同步區段完成。"
  - "🔴 **不接 `main.ts`**（工單 2 / T0463）；既有 `remote-connect-plan.ts` 函式若改簽章，保留舊匯出供 `main.ts` 繼續編譯（或新增函式不動舊的），本單結束時 `main.ts` 行為與 HEAD 相同。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0462 — connection registry 模組（PLAN-039 工單 1）

## 驗收條件

- [x] 單元：fake timers 驗寬限期 / 到期重算 / 取消；第 9 個 admission 拒絕且不擠掉既有；同時兩個 admission 不超額；同 target 偵測；per-profile mutex 串行
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區全文 + `electron/remote/remote-connect-plan.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — 新模組 `electron/remote/remote-connection-registry.ts` + `remote-connect-plan.ts` 新增以 profile 為鍵的純函式；先紅後綠；`main.ts` 未動（行為與 HEAD 相同）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/remote/`、`electron/__tests__/remote-connect-plan.test.ts` 皆存在（informational）；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**1. `electron/remote/remote-connect-plan.ts`（只新增，舊匯出一行未改，`main.ts` 照常編譯）** — 檔尾新增 T0462 區塊：
- `planProfileRemoteConnect({ request, boundProfileId, boundProfile, entry })`：`boundProfileId === null` → `reject` / `errorCode: 'binding-missing'`（`BINDING_MISSING_ERROR`）；其餘委派 `planRemoteConnect`，`entry` 為該 profile 自己的 entry（profileId 比對恆真）。型別 `RemoteProfileConnectPlan`、`RemoteProfileConnectEntry`
- `computeProfileWindowStatus(profileId, conn | null)`（null → `no-client`；**不產生 `'other-profile'`**）、`planProfileProxiedInvokeRoute({ ..., conn })`、`planProfileStatusPushes(profileIds, getConn, lastPushed)`；型別 `RemoteProfileConnState`、`RemoteProfileNotConnectedReason`（= `Exclude<..., 'other-profile'>`）、`RemoteProfileWindowStatus`、`ProfileProxiedInvokeRoute`
- `shouldDropProfileConnectionOnUpdate({ applied, previousFingerprint, nextFingerprint, hasConnection })`
- `planConnectionAdmission({ entryCount, hasEntry, cap })` → `existing` / `admit` / `reject`（`reason: 'limit'`）
- `planIdleRelease({ liveWindowCount, hasEntry })` → `none` / `keep` / `release`
- `findSameTargetProfiles(entries, target, excludeProfileId?)`（比 host + port + token，不比 fingerprint）
- `RemoteClientSlot` / `settleRemoteConnect` 原樣沿用（registry 內單一 entry 換手）

**2. `electron/remote/remote-connection-registry.ts`（新檔，不 import electron）**
- 常數：`MAX_CONCURRENT_REMOTE_PROFILES = 8`、`IDLE_GRACE_MS = 15_000`、`FIRST_WINDOW_GRACE_MS = 60_000`、`DISCONNECT_ALL_TIMEOUT_MS = 2_000`
- `RemoteConnectionRegistry<C extends RegistryClient, P>`；注入 `createClient(profileId, profile)`（client factory）、`countLiveWindows(profileId)`、`onReleased(profileId, 'idle' | 'first-window')`；`cap` / grace 可覆寫（測試用）
- `connect({ profileId, profile, request, run })`：**上限檢查 + entry 佔位在同步區段**（第一個 `await` 之前）；plan / `run`（握手）/ 換手在 per-profile mutex 內。結果 `reject` / `limit` / `reuse` / `connected`（含 `target`、`sameTargetProfileIds` 供 warn）/ `failed` / `aborted`（`disconnectAll` 期間握手完成 → dispose candidate）。只有成功才換 client；失敗 dispose candidate，從未拿到 client 的 entry 歸還名額；`run` throw 同樣清理後 rethrow
- 生命週期：`noteWindowClosed(profileId)` → `none` / `kept` / `scheduled`（排 15 s）；到期在該 profile mutex 內**再算一次** live 視窗數仍為 0 才 `disconnect()` + 刪 entry + `onReleased`；`cancelRelease`（generation 計數，計時器已觸發但 mutex 區段未跑時也能取消）；connect / reuse 後若有 live 視窗 → 取消 pending release，否則排 60 s 開窗保護（等同 T0459「entry 建立時即排」，改在握手完成後排以免握手中途觸發）；計時器 `unref`
- `runExclusive(profileId, fn)`：每 profile 一把 mutex，rejected 不斷鏈，鏈尾自動清 Map；不同 profile 不互卡
- 其他：`dropProfile`（pin 變更 / sender-scoped disconnect 用）、`disconnectAll(timeoutMs)`（quit：清計時器、`Promise.allSettled` + 上限 2 s，不排 mutex）、`get` / `has` / `size` / `profileIds` / `connectionState` / `isProfileLive` / `sameTargetProfiles` / `pendingRelease`

**3. 測試**
- `electron/remote/__tests__/remote-connection-registry.test.ts`（新，33 tests）：fake timers 驗寬限期（14 999 ms 不斷、15 000 ms 斷）/ 到期重算（期間視窗回來 → 保留）/ 取消（reuse 取消、計時器已觸發後 `cancelRelease` 仍取消、再關一窗重新起算）；開窗保護 60 s 與 reuse 取消；第 9 個 profile `limit` 且不建 client、既有 8 個皆未 disconnect；7 個握手進行中時兩個 admission 搶最後一格 → 恰一個 `limit`、size 不超過 8；失敗歸還名額；同 target 偵測；per-profile mutex 串行（順序、rejected 不斷鏈、同 profile 兩個 connect 握手併發數 = 1 且第二個 reuse）、不同 profile 握手並行；`dropProfile` / `disconnectAll`（hang 的 disconnect 受 timeout 限制）
- `electron/__tests__/remote-connect-plan.test.ts`（+134 行，12 tests）：上列純函式，含「P connected × Q reconnecting 各自獨立」路由矩陣

**驗證**
| lane | 結果 | 證據 |
|------|------|------|
| 紅燈 | ✅ | 實作前：2 files failed / 12 failed（import 不存在） |
| 單檔 | ✅ PASS | 2 files / 95 tests passed |
| `npm run test:unit` | ✅ PASS | 166 files passed；2824 passed / 1 skipped |
| `npx tsc --noEmit` | ✅ PASS | 36 errors（= 門檻 36），本單 3 檔 0 error |
| build / runtime | — | 依工單只跑上兩項（L141）；模組未接 `main.ts`，無 runtime 面 |

**Commit**：`470f81a`（只含本單 4 檔 + 本工單）；未 push。

### 遭遇問題

- 同工作樹有 T0465 Worker 進行中（`electron/remote/ssh-tunnel.ts`、`remote-client.ts`、`ssh-tunnel-local-port.test.ts`、T0465 工單）以及塔台的 `_tower-state.md` 改動：皆未觸碰、未納入本單 commit（精準 staging）。全量 `test:unit` 執行時包含其工作中檔案，結果仍全綠。
- 未使用 stash / reset / checkout / restore；寫檔維持 LF（git 的 CRLF warning 為 autocrlf 提示，工作樹檔案為 LF）。
- 給工單 2 / 3 的接線備註：`connect` 的 `run` 由呼叫端執行 `client.connect(host, port, token, label, expected)`，log / `pushRemoteClientStatus` 依 outcome 在外層做；`remote:connect` 為 0 個 live 視窗時也會排開窗保護（正常情況 sender 視窗已在 `windowMap`，會直接取消）。`settle` 成功時舊 client 以 `void` disconnect（同現行 main.ts），失敗時 await。

### 回報時間

2026-10-05T11:48:59+08:00（Worker 時間戳取自 `date`）
