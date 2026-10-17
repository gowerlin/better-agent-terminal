---
schema_version: 1
schema_kind: workorder
id: T0430
title: "T0419 後續：remote:connect 以 pin 重連失敗時，舊 client 未 disconnect（背景自動重連且失去參照）"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-096
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: "2026-10-05T05:50:19+08:00"
updated_at: "2026-10-05T05:53:10+08:00"
completed_at: "2026-10-05T05:53:10+08:00"
target_version: next
depends_on:
  - T0422
related:
  - "T0419 回報區「遭遇問題」未修項；commit `038c98e`（`remote-connect-plan.ts`）"
  - "D134 追加（使用者 05:46 斷點 C 裁決）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/remote-connect-plan.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據說明 `remote:connect` 的 `connect` 分支連線失敗時，舊 `remoteClient` 的實際狀態（是否仍在自動重連、`remoteClientProfileId` / `remoteClientTargets` 是否一致、其他依賴 `remoteClient` 的地方會看到什麼）。"
  - "🔴 修法須守 T0419 的不變式：`reject` 分支（未發生網路動作）**不動**現有槽位；只處理「已決定重連且連線失敗」。決定是 (a) 失敗時 disconnect 舊 client 並清空槽位，或 (b) 失敗時保留舊 client（不清空參照）——依現況結論擇一，回報區說明理由。不得讓同時存在兩個無人持有參照的 client。"
  - "🔴 依賴 T0422（同改 `electron/main.ts`）。開工前 `git log --oneline -5` 確認。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0430 — remote:connect 失敗分支舊 client 處理

## 背景

T0419 指出：`remote:connect` 實際連線失敗的既有分支只把 `remoteClient = null`，沒有 `disconnect()` 舊 client → 舊 client 可能仍在背景連線 / 自動重連且失去參照。T0419 改為重用後，正常路徑不再走到此分支，但「以 pin 重連失敗」時仍會發生。

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 修正失敗分支；若邏輯可放進 `remote-connect-plan.ts` 或新純函式則一併單測
3. 測試：連線失敗後無殘留連線中的孤兒 client；`reject` 分支不動槽位（既有測試維持綠）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附現況結論與修法理由

## Sub-session 執行指示
1. 讀本工單 + T0419 回報區 + BUG-096
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — `remote:connect` 的 `connect` 分支改為「只在成功時換槽位」：失敗（含 throw）時**保留**現有 client 與 `remoteClientProfileId`，並 `await disconnect()` 失敗的新 client（candidate）；`reject` / `reuse` 分支未動。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：三個 `affects_files` 皆存在 ✅；C-2：工單無 `branch` 欄位，實際 `main`
- 依賴 T0422：`git log --oneline -5` 含 `d800dea fix(remote): ... (T0422, ...)` ✅；開工時 `electron/main.ts` 無未提交改動
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. 現況結論（修改前程式碼證據）

槽位：模組變數 `remoteClient` / `remoteClientProfileId`（`electron/main.ts:463,470`）+ `remoteClientTargets` WeakMap（`:474`）。修改前 `remote:connect`（`main.ts:2511-2557`）在 `client.connect()` 回 `ok: false` 或 throw 時只做 `remoteClient = null; remoteClientProfileId = null`，**舊 client 與失敗的新 client 都沒 disconnect**。

**舊 client 的實際狀態**（`electron/remote/remote-client.ts`）：
- `connect()` 設 `shouldReconnect = true`（`:215`），只有 `disconnect()` 會清（`:522`）。清空槽位不影響它 ⇒ 若仍連線中，ws 保持開啟；斷線時 `close` handler 依 `shouldReconnect && wasConnected` 走 `scheduleReconnect()`（`:460-463`），指數退避**無限重連**（SSH tunnel 版另有 `TUNNEL_MAX_RESTART_FAILURES` 上限）。若當下正在重連，`reconnectTimer` 照跑。
- 事件轉送：`getWindows` 是建構時捕捉的 `() => getWindowsForProfile(profileId)`（`main.ts:1279` / `:2536`）⇒ 孤兒 client 仍把 `PROXIED_EVENTS` 推給該 profile 的視窗（`remote-client.ts:430-441`），每次重連成功還會 `syncWorkspaceRoots()`（`:399`）。
- **同時**依賴槽位的地方全部看到「沒連線」：invoke 路由 `senderProfileId === remoteClientProfileId && remoteClient?.isConnected`（`main.ts:2311`）不成立 → remote profile 視窗的 invoke **落到本機 `invokeHandler`**（事件來自遠端、指令跑本機的錯位）；`remote:client-status`（`:2572`）、`remote-tools:take-pending-install`（`:3073`）、`wslFolderDefaultForSender`（`:2345`）、`syncRemoteWorkspaceRoots`（`:1248`）都視為未連線。
- 無人能再關閉它：`remote:disconnect`（`:2560`）與 `cleanupAllProcesses`（`:1197`）都只透過 `remoteClient` 取得參照 ⇒ ws / SSH tunnel 子行程留到 app 結束。
- `remoteClientProfileId` 被清成 `null`，與「仍活著的 client」不一致；`remoteClientTargets` 是 WeakMap，key 仍被 timer / ws closure 持有，無害但已無人查詢。

**失敗的新 client 也不乾淨**：SSH tunnel profile 的 `doConnect()` 先 `ensureTunnelReady()` 起 ssh 子行程（`:270-290`）再開 wss；wss 失敗時 tunnel 不會被關。之後 tunnel 掛掉觸發 `tunnel-down` handler：`shouldReconnect && !_connected` → `scheduleReconnect()`（`:251-261`）⇒ 又一個無人持有參照、會自行重連的 client。另 `auth-failed` 路徑不主動 close ws（`:388-391`），socket 是否關閉取決於 server。⇒ 修改前最壞情況正好是工單禁止的「同時存在兩個無人持有參照的 client」。

**T0419 後仍會走到 `connect` 且可能失敗的情境**（renderer 唯一呼叫端 `src/App.tsx:542`；失敗時新視窗 3 秒後關閉、主視窗退回本機 profile）：
1. 同 profile 的 client 正在背景重連（`isConnected=false`）→ 以 pin 重連，伺服器仍不可達 → 失敗。
2. 槽位是**另一個 profile Q** 的 client（Q 視窗仍開著）→ P 視窗連線失敗。
3. profile 的 pin 已更新、舊 client 觀察到的是舊 fingerprint → 以新 pin 重連遇 `fingerprint-mismatch`。
4. 未綁 remote profile 的視窗（舊行為透傳）。

#### 2. 修法與理由 —— 選 (b)：失敗時保留舊 client，丟棄 candidate

- 理由一（副作用最小、與 T0419 不變式一致）：T0419 已定「`reject`（無網路動作）不動槽位」；本單延伸為「**失敗的請求對槽位零副作用**，只有成功才換手」。成功路徑原本就是 disconnect 舊 → 換新，語意變成原子交換。
- 理由二（情境 2）：(a) 會因 P 視窗一次失敗就拆掉 Q 視窗正在用的連線；(b) Q 不受影響。修改前 Q 連線雖活著，但槽位被清 → Q 的 invoke 已被錯送到本機，(b) 同時消除這個錯位。
- 理由三（情境 1）：舊 client 仍在自動重連且**有參照**，伺服器恢復後同 profile 其他視窗自動回復；仍可被 `remote:disconnect` / `cleanupAllProcesses` / 下次成功連線收掉。
- (a) 唯一較佳處是情境 3（pin 更新時 fail-closed）；但 pin 更新本來就不會拆既有連線（`profile:update` 不碰槽位），(b) 只是維持請求前狀態，不新增信任。列為殘留風險（見「遭遇問題」）。

實作：
- `electron/remote/remote-connect-plan.ts`：新增純函式 `settleRemoteConnect({ slot, candidate, candidateProfileId, ok })` → `{ slot, dispose }`。成功：candidate 入槽、舊 client 進 `dispose`；失敗：槽位原樣、candidate 進 `dispose`；candidate 為 `null`（建立前就 throw）時不變。保證每個 client 不是在槽位就是在 `dispose`。
- `electron/main.ts` `remote:connect`（`:2512-2568`）：handler 內 `candidate` + `settleSlot(ok, profileId)`，三個出口（`ok:false` / 成功 / catch）都經 `settleRemoteConnect`。失敗時在 `remoteOpMutex` 內 `await` candidate 的 `disconnect()`（等 ssh 子行程退出，避免下一個 connect 搶同一 tunnel port，同 BUG-067 思路）；成功時舊 client 維持原本的 fire-and-forget（改用 `.catch`，原 `try { ... } catch` 抓不到 async reject），不增加成功路徑延遲。失敗加一行 `logger.warn('[remote:connect] connect failed ... keeping current client')`。`reject` / `reuse` 分支未動；IPC 回傳形狀不變。

#### 3. 測試（`electron/__tests__/remote-connect-plan.test.ts`，14 → 21 例）

- `settleRemoteConnect`（5 例）：失敗保留舊 client 與 profileId、dispose candidate；空槽位失敗仍 dispose candidate；candidate 建立前 throw 不變；成功換手並 dispose 舊 client；空槽位成功不 dispose。以 `expectNoOrphans` 斷言「每個 client 不在槽位就在 dispose，且槽位中的不會被 dispose」。
- handler source guard（2 例，比照 T0419 `app-remote-connect-fingerprint.test.ts` 手法，因 `main.ts` import electron 無法直接測）：`remote:connect` handler 內不再出現 `remoteClient = null` / `remoteClientProfileId = null`、必經 `settleRemoteConnect(`；`reject` 分支在動槽位前 `return`。
- 既有 14 例 `planRemoteConnect`（含 reject）維持綠。

#### 4. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | `Test Files 118 passed (118)` / `Tests 1922 passed \| 1 skipped (1923)`（含工作樹中平行 Worker 未提交的測試） |
| `npx tsc --noEmit` | ✅ PASS | `40` 個 `error TS`（≤ 40）；`main.ts` / `remote-connect-plan` 0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭ 未跑 | 依 memory_overrides（L141）刻意不跑 |
| runtime smoke | ⏭ 未跑 | 需實機：遠端 server 不可達時開 remote profile 視窗，log 應見 `[remote:connect] connect failed ... keeping current client`，且不再出現無人持有的重連迴圈 / 殘留 ssh 子行程 |

#### 5. 改動檔案

- `electron/remote/remote-connect-plan.ts`（新增 `RemoteClientSlot` / `settleRemoteConnect`）
- `electron/main.ts`（import 一行 + `remote:connect` handler；`git diff electron/main.ts` 確認只含本單 hunk）
- `electron/__tests__/remote-connect-plan.test.ts`
- `_ct-workorders/T0430-remote-connect-failure-disconnect-old-client.md`

#### 6. Commit

`git commit --only` 上列 4 檔，訊息含 `T0430`；不 push。hash 以 `git log --grep T0430` 查詢。

### 遭遇問題

- **殘留風險（情境 3）**：profile 的 pin 更新後，以舊 fingerprint 驗證的既有 client 不會被拆（修改前後皆然，`profile:update` 不碰槽位）；本單 (b) 在以新 pin 重連失敗時保留它。若塔台要求 pin 變更即 fail-closed，建議另開單：`profile:update` 變更 `remoteFingerprint` 時 disconnect 綁該 profile 的 client。
- **同類未修（範圍外，記錄供塔台）**：`loadProfileSnapshotDetailed`（`main.ts:1277-1288`）連線失敗時槽位不變（正確），但失敗的新 client 同樣沒 `disconnect()` —— SSH tunnel profile 會留下 ssh 子行程，`tunnel-down` 可觸發背景重連。可直接沿用 `settleRemoteConnect` 修，建議併入後續單。
- **既有行為（範圍外）**：槽位為空或屬他 profile 時，remote profile 視窗的 invoke 會落到本機 `invokeHandler`（`main.ts:2311-2314`），非本單引入；(b) 減少觸發機會但未根治。
- 工作樹有平行 Worker 的未提交改動（`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`src/lib/pty-replay.ts` 等），本單未觸碰，commit 以 `--only` 隔離。

### 回報時間

2026-10-05T05:52:31+08:00（Worker 時間戳取自 `date`）
