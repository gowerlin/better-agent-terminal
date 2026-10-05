---
schema_version: 1
schema_kind: workorder
id: T0464
title: "PLAN-039 工單 3：連線生命週期接線——視窗 / detached closed → release + 15 s 寬限期（到期重算）、開窗保護 60 s、quit 全量 await（上限 2 s）、上限拒絕 'limit' reason + 對話框 i18n、同 target warn log"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: "2026-10-05T12:03:30+08:00"
updated_at: "2026-10-05T12:03:30+08:00"
completed_at: null
target_version: next
depends_on:
  - T0463
related:
  - "T0459 研究回報區「生命週期」1-6 與拆單第 3 列；使用者 Q1（最後視窗關閉 + 寬限期）/ Q2（上限 8 拒絕）/ Q3（同 target 允許 + warn）"
  - "D135"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connection-registry.ts
  - electron/remote/remote-connect-plan.ts
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
  - "🔴 規格見 T0459「生命週期」：寬限期到期須在該 profile mutex 內**重算** live 視窗數才 disconnect；縮到 tray 的視窗算 live；quit 以 `Promise.allSettled` 等 ssh 子行程退出（上限 2 s）；不新增自動重連（T0443 決策）。"
  - "🔴 上限拒絕：第 9 個 profile 回 `'limit'` reason，renderer 顯示 i18n 對話框 / 提示（三語），不擠掉既有連線。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push。"
---

# T0464 — 生命週期接線（PLAN-039 工單 3）

## 驗收條件

- [ ] 單元 / 整合：關最後視窗 → 寬限期內重開 reuse、到期斷線；tray 視窗不觸發 release；quit await；第 9 個拒絕 + 提示；同 target warn
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 / T0462 / T0463 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

### 塔台補充（第五十六 session，派發前）

- **T0463（`8604daa`）已先做了部分接線，本單在其上補完，不要重做**：視窗 / detached `closed` 已呼叫 `noteRemoteWindowClosed()` → registry 15 s 寬限 + 到期重算；connect 後無 live 視窗會排 60 s 首窗保護；`cleanupAllProcesses` 目前 `void remoteConnections.disconnectAll()`。T0463 刻意**不**採「關窗立即 release」（會打斷 `loadProfileSnapshotDetailed` 連上後、建窗前的空窗），維持此設計。
- **本單剩餘範圍**（T0463 回報區「遭遇問題」第 2 點）：
  1. quit 全量 await（`runCleanupOnce` 目前同步；上限 2 s，`Promise.allSettled`）
  2. `'limit'` 專屬 reason（目前 `remote-unreachable` + 錯誤文字 / `remote:connect` `errorCode: 'remote-limit'`）+ 三語對話框 / 提示；reason 型別若需擴充，同步 `remote-connect-plan.ts` / `preload.ts` / `src/lib/remote-not-connected.ts` / `src/types/electron.d.ts`（已加入 `affects_files`）
  3. 同 target warn log（`connected` outcome 已帶 `sameTargetProfileIds`，未接）
  4. 寬限期 / tray（縮到 tray 的視窗算 live）的 main 層測試
- `npx tsc --noEmit` 只涵蓋 `src/`。改 `electron/**` 時比照 T0463，在 scratchpad 以 extends `tsconfig.node.json` 的 tsconfig 補檢 electron 型別，回報「本單觸及檔案 0 個新錯誤」（不留檔於 repo）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — 在 T0463 接線之上補完生命週期：quit 全量 await（≤ 2 s，`Promise.allSettled`）、`'limit'` 專屬 reason + 三語對話框 / 提示、同 target warn log、寬限期 / tray / 首窗保護 / quit / 上限的 main 層測試。另修一個 registry 弱點：無關視窗關閉會把首窗保護 60 s 降級成 15 s idle 寬限。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/main.ts` 等皆存在（informational）；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

**驗收條件**
- [x] 單元 / 整合：關最後視窗 → 寬限期內重開 reuse、到期斷線；tray 視窗不觸發 release；quit await；第 9 個拒絕 + 提示；同 target warn（`remote-connection-lifecycle.test.ts` + 源碼 guard）
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` = 36（≤ 36）

### 產出摘要

**1. quit 全量 await（剩餘範圍 1）— `electron/main.ts`**
- `cleanupAllProcesses()` 改 `async`：先同時啟動 `closeAllSshWizardTunnels()` 與 `remoteConnections.disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)`，同步拆解（remoteServer / claude / codex / pty）照舊執行，最後 `await settleWithin([wizardTunnelsClosed, remoteClientsClosed], DISCONNECT_ALL_TIMEOUT_MS)`（`Promise.allSettled` + 上限 2 s，永不 reject），log `[quit] ssh subprocesses exited / still running after 2000ms`
- `runCleanupOnce()` 改回傳同一個 memoized promise（`_cleanupPromise` 取代 `_cleanupDone` 旗標）
- `before-quit`：`await runCleanupOnce()` 之後才 `_quitConfirmed = true; app.quit()`
- `window-all-closed`：force-exit 2 s 倒數改在 cleanup settle 之後才開始（`void cleanup.finally(() => setTimeout(() => process.exit(0), 2000))`），避免 force exit 截斷 ssh 等待；最壞 4 s（ssh 卡死時）
- `will-quit` 的 belt-and-braces `void closeAllSshWizardTunnels()` 不變

**2. `'limit'` 專屬 reason + 三語對話框 / 提示（剩餘範圍 2）**
- `electron/remote/remote-profile-error.ts`：`RemoteProfileFailureReason` 加 `'limit'`、`RemoteProfileFailure.limit?`；新增 `getRemoteProfileLimitStrings(lang)`（en / zh-TW / zh-CN，沿用 quit dialog / `getExecutableConfirmStrings` 的 main 端 i18n 模式）；`describeRemoteProfileFailure(failure, { lang, idleGraceMs })` 的 `limit` 分支走本地化字串（placeholder `{{label}}` / `{{limit}}` / `{{seconds}}`，以 function replacer 填值）；其他 reason 維持英文（不擴大範圍）
- `src/locales/{en,zh-TW,zh-CN}.json`：新增頂層 `remoteProfileLimit.{title,message,detail,notice}`，與 main 端字串由測試逐字比對
- `main.ts`：`loadProfileSnapshotDetailed` 的 `limit` outcome → `reason: 'limit'` + `limit: outcome.cap`；`showRemoteProfileFailureDialog` 以 `readPersistedSettingsSync()?.language` + `IDLE_GRACE_MS` 產生對話框；`restoreFromSnapshot` 傳遞 `limit`；`openProfileWindows` 回 `error: 'remote-limit'`（其他失敗仍 `'remote-unreachable'`）；`remote:connect` 的 `limit` 回傳加 `limit: outcome.cap`
- renderer：`src/lib/remote-not-connected.ts` 新增 `REMOTE_LIMIT_ERROR_CODE = 'remote-limit'` 與 `remoteConnectFailureNotice(result)`（limit → `remoteProfileLimit.notice`，其餘 → `app.remoteConnectionFailed`）；`src/App.tsx` initProfile：launch 視窗改用 notice、主視窗 fallback 時遇 `remote-limit` 也顯示 notice（其他錯誤維持原本靜默 fallback）
- `electron/preload.ts` / `src/types/electron.d.ts`：`remote.connect` 失敗型別加 `limit?: number`
- `RemoteNotConnectedReason`（視窗狀態 reason）**未**擴充：registry 不保存被拒的 profile，被拒視窗狀態本來就是 `no-client`，加 `'limit'` 無資料來源

**3. 同 target warn log（剩餘範圍 3）**
- `remote-connect-plan.ts`：新增 `describeSameTargetWarning(profileId, target, sameTargetProfileIds)`（無同 target → `null`；不記 token）
- `main.ts`：`warnSameTargetProfiles()` 接在 `loadProfileSnapshotDetailed` 與 `remote:connect` 兩處 `case 'connected':` → `logger.warn`

**4. 寬限期 / tray main 層測試（剩餘範圍 4）+ registry 補強**
- `remote-connection-registry.ts`：
  - 新增 `collectProfileWindows()`（`getWindowsForProfile` 邏輯抽出，main 改呼叫它；只排除 destroyed，縮到 tray 的 hidden 視窗算 live）
  - 新增 `settleWithin(promises, timeoutMs)`（`disconnectAll` 改用它）
  - 新增 `noteAnyWindowClosed()`（main `noteRemoteWindowClosed` 改呼叫它，只有 idle 排程才 log）
  - **修正**：`noteWindowClosed` 遇 pending `first-window` 時不降級為 15 s idle（原行為：P 剛由 `loadProfileSnapshotDetailed` 連上、視窗尚未建出時，任何無關視窗關閉都會把 60 s 首窗保護縮成 15 s）
- 新檔 `electron/remote/__tests__/remote-connection-lifecycle.test.ts`（17 tests，fake timers + main 模型：windowMap / registry entries / detached / `collectProfileWindows` / registry）：關最後視窗 14 999 ms 不斷、15 000 ms 斷且 Q 不受影響；寬限內重開 → `reuse` + 取消；到期重算（無 connect 的新視窗仍保留）；tray hide 不觸發 release（另一視窗關閉 → `kept`）；detached 視窗算 live；首窗保護不被無關關窗縮短 / 首窗準時出現保留；第 9 個 `limit` 不建 client、既有 8 個未 disconnect、zh-TW 對話框內容、釋放後名額回收；同 target 偵測 + warn 文字不含 token；quit `disconnectAll` 等慢 client、吞 throw、hang 時 2 s 截止；`settleWithin` 三案例
- 源碼 guard（`electron/__tests__/remote-connect-plan.test.ts` 新 describe「T0464 source guard」）：兩處 `connected` 接 warn；limit reason / dialog lang / `restoreFromSnapshot` limit / `openProfileWindows` `remote-limit`；cleanup 無 `void disconnectAll`、`await settleWithin(...)`、`runCleanupOnce` memoized、`before-quit` 先 await 再 `_quitConfirmed`、`window-all-closed` force exit 在 cleanup 後；`win.on('close')` 只 hide 不 `windowMap.delete` / 不 `noteRemoteWindowClosed`、`countLiveWindows` 走 `getWindowsForProfile`
- 既有 guard 遷移（行為不變，位置移動）：`detached-window-profile-binding.test.ts`（`getWindowsForProfile` → `collectProfileWindows` 參數）、`remote-connect-plan.test.ts` 3 條（`async function cleanupAllProcesses` + `disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)`、`noteAnyWindowClosed`、`remote-limit` 帶 `limit: outcome.cap`）
- `remote-profile-error.test.ts` +4（limit 對話框、語言、placeholder 樣 label、三語與 locale 逐字一致）；`src/__tests__/remote-not-connected.test.ts` +6（notice 映射、三語 `{{limit}}`、App.tsx 接線 guard）

**驗證**
| lane | 結果 | 證據 |
|------|------|------|
| 單檔 | ✅ PASS | `electron/remote/__tests__/` + `remote-connect-plan.test.ts`：37 files / 709 passed |
| `npm run test:unit` | ✅ PASS | 168 files passed；2861 passed / 1 skipped |
| `npx tsc --noEmit` | ✅ PASS | 36 errors（= 門檻 36；只涵蓋 `src/`） |
| electron 型別（補充） | ✅ | scratchpad tsconfig（extends `tsconfig.node.json`、`typeRoots` 指向 repo `node_modules/@types`，未留檔於 repo）：總數 76，與本單新增測試檔前相同；本單觸及檔案 0 個新錯誤（`main.ts` 殘留皆為 T0463 已記錄的既有類別：`Handler` 簽章、`app.dock`、`fs.promises`、`ShortcutDetails`） |
| build / runtime / 實機 | — | 依工單只跑上兩項（L141）；WSL + SSH 實機同開、quit 實測 ssh 子行程退出屬工單 5 |

**Commit**：見下方「遭遇問題」後的 commit 紀錄；未 push。

### 遭遇問題

- **範圍延伸（1 檔）**：`electron/remote/remote-profile-error.ts`（及其測試）不在 `affects_files`，但 `RemoteProfileFailureReason` / 對話框文字定義在此，`'limit'` 專屬 reason + 對話框 i18n 必須改它。
- **registry 行為修正（範圍內）**：首窗保護被無關關窗降級（見產出 4）。T0462 既有 33 條 registry 測試全綠，未改舊測試。
- **對話框 i18n 只做 limit**：main 端其他 remote 失敗對話框（unreachable / trust / protocol）仍為英文，屬既有狀態，未擴大範圍；如需全面三語化可另開單。
- **window-all-closed force exit 最壞由 2 s 變 4 s**：ssh 子行程卡死時（cleanup 2 s 上限 + 原 2 s 倒數）；正常情況 ssh 先退出，差異可忽略。
- 未使用 stash / reset / checkout / restore；寫檔維持 LF（git 的 CRLF warning 為 autocrlf 提示）；開工時工作樹 clean，無他人改動。

### 回報時間

2026-10-05T12:13:13+08:00（Worker 時間戳取自 `date`）
