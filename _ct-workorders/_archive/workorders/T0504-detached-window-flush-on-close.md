---
schema_version: 1
schema_kind: workorder
id: T0504
title: "detached 視窗關閉前 flush-save：rename / sdkSessionId 等非增刪變更不再因 30 秒 autosave 間隔遺失"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:01:28+08:00"
started_at: "2026-10-14T00:27:21+08:00"
updated_at: "2026-10-14T00:38:11+08:00"
completed_at: "2026-10-14T00:38:11+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0491"
  - "T0496"
  - "T0498"
related:
  - "T0491 回報區「偏差 / 殘餘風險」：detached 視窗的非增刪變更（rename、sdkSessionId 等）靠 30 秒 autosave / quit flush；detached 視窗直接關閉時最後 30 秒內的這類變更可能遺失"
  - "T0491 設計：`saveDetachedWorkspaceTerminals`、`DetachedTerminalOwners`、closed → `whenIdle` → `workspace:reattached` → `workspace:adopt-detached`（save 佇列內）"
affects_files:
  - "electron/main.ts"
  - "electron/window-registry.ts"
  - "src/stores/workspace-store.ts"
  - "src/App.tsx"
  - "electron/__tests__/"
  - "src/stores/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不得破壞 T0491 的順序保證：detached 最後一次 save 必須在 `whenIdle()` → `workspace:reattached` 之前進入 registry 佇列；flush 失敗或逾時不得阻擋視窗關閉（設上限並記 log）"
  - "🔴 排在 T0498 之後：兩者都可能改 `electron/preload.ts` / `src/types/electron.d.ts`"
  - "🔴 不得回到「detached store 覆寫父 entry」：flush 仍走 `saveDetachedWorkspaceTerminals`"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0（T0496 後）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0504 — detached 視窗關閉前 flush

## 實作

- detached 視窗關閉時（使用者關窗 / reattach），在視窗銷毀前觸發一次 save（例如 main 端 `close` 事件 `preventDefault` → 要求 renderer flush → 收到 ack 或逾時後再關閉；或 renderer `beforeunload` 同步送出——擇一並說明可靠性）
- 確認 quit 路徑（既有 flush-save 含 detached）不重複、不死鎖
- 測試：單元（順序：flush save 先於 reattached；逾時仍關閉）；e2e（isolated）：detached 視窗內 rename 終端 → 立即關閉 → 父視窗 / registry entry 顯示新名稱；重啟後仍正確

## 驗收條件

- [x] 單元 + e2e；既有 `detached-terminal-persistence` / `detached-workspace` / `smoke` 回歸
- [x] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [x] 回報區：設計選擇、逾時值、CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0491 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果：DONE

- **Landing check：PASS** — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單位於 REPO_ROOT 下；C-3 `electron/main.ts` 等皆存在；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 起訖：`started_at` 2026-10-14T00:27:21+08:00；本區於 2026-10-14T00:36:30+08:00 填寫。

### 設計選擇：main 端攔截 `close` + renderer ack（不採 `beforeunload`）

- detached 視窗 `close` 事件 → `preventDefault()` → 對**該視窗**送 `workspace:flush-save` → renderer 既有 `onFlushSave`（`stopAutoSave` + `await workspaceStore.save()`，save 走 `workspace:save` → `saveDetachedWorkspaceTerminals`）完成後回 `workspace:flush-save-done` → main 收到**該 sender** 的 ack（或逾時 / renderer 已毀）後 `destroy()` → `closed` → 既有 `whenIdle()` → `workspace:reattached` → 父視窗 `workspace:adopt-detached`。
- 可靠性：renderer 在 `workspace:save` 的 invoke **resolve 之後**才 ack，所以 ack 到達時該 save 已寫入 registry；`closed`（以及其後的 `whenIdle` / reattached）必在 ack 之後 → T0491 的順序保證不變且更強。`beforeunload` 方案的 IPC 與 `closed` 走不同管道、沒有先後保證，且 async invoke 在 unload 中可能送不出，故不採用。
- flush 仍走 `saveDetachedWorkspaceTerminals`（renderer 送的是既有的 `workspace:save`，main 端 detached 分流不變），未回到「detached 覆寫父 entry」。
- **逾時值**：`DETACHED_CLOSE_FLUSH_TIMEOUT_MS = 1500`（detached 關窗）；quit 路徑維持原本 2 s（`QUIT_FLUSH_TIMEOUT_MS = 2000`）。逾時、flush reject / throw、renderer 中途被毀 → 一律照樣 `destroy()`，並以 `logger.warn('[detached] <ws>: flush-save before close <timeout|error|gone> after <ms>ms, closing anyway')` 記錄；成功記 `logger.log(... done in <ms>ms)`。關窗中再按一次 X 不會重複 flush。
- 新模組 `electron/renderer-flush.ts`：`requestRendererFlush(wc, ipc, timeoutMs)`（只認**自己 sender** 的 ack、結束時移除 listener、永不 reject，回 `'done' | 'timeout' | 'gone'`）與 `flushBeforeClose(win, { flush, skip, onResult })`。

### quit 路徑（不重複、不死鎖）

- detached 視窗的 flush-before-close 以 `skip: () => isAppQuitting` 跳過：quit 時 `before-quit` 已對所有視窗（含 detached）flush 過，之後 `app.quit()` 關窗不會再 flush 一次、也不會 `preventDefault` 擋住退出。
- quit flush 改用 `requestRendererFlush`，**順帶修正既有問題**：原本每個視窗各掛一個 `ipcMain.once('workspace:flush-save-done')`，第一個回 ack 的視窗會同時觸發所有 listener，其餘視窗的 save 實際上沒被等到；現在每個 renderer 各等自己的 ack（各 2 s 上限、並行），log 會列出逾時 / 已毀的數量。
- 最後一個主視窗非 quit 關閉時，原本 `dw.close()` 後立刻 `detachedWindows.clear()` / `detachedWindowRecords.clear()`；`workspace:reattach` 也是先 `close()` 再刪 map。flush 期間 map 若已刪，detached 送來的 `workspace:save` 會被當成未知 sender 丟棄 → 改為：live 視窗只 `close()`，由它自己的 `closed` 刪除；已毀的才立即刪。關窗被 flush 延後最多 1.5 s，`window-all-closed` 相應延後，不會卡住。

### renderer：`workspaceStore.save()` 在已有排隊 save 時回傳該 promise

- 原本 `if (this._savePending) return`（回 `undefined`）→ flush 時若剛好已有一筆排隊中的 save，`await workspaceStore.save()` 立即結束、ack 先送出，而帶最新 rename 的那筆 save 尚未送出。改為 `return this._savePromise`（同一筆排隊 save，不多送）。quit 路徑同樣受益。

### 檔案

- `electron/renderer-flush.ts`（新）
- `electron/main.ts`：import；quit flush 改 `requestRendererFlush`；detach 時 `flushBeforeClose(detachedWin, …)`（在 `loadFile` / `on('closed')` 之前安裝）；`workspace:reattach` 與最後主視窗 `closed` 不再提前刪除 live detached 視窗的 map
- `src/stores/workspace-store.ts`：`save()` 排隊時回傳 promise
- 測試：`electron/__tests__/renderer-flush.test.ts`（新，10）、`src/stores/__tests__/workspace-store.flushSave.test.ts`（新，1）、`electron/__tests__/detached-workspace-persistence.test.ts`（+1 source guard）、`electron/__tests__/detached-window-profile-binding.test.ts`（T0446 source guard 的 `clear()` 斷言改為新的逐窗清除寫法，意圖「每條 teardown 都清 record」不變）、`e2e/detached-flush-on-close.spec.ts`（新）
- `src/App.tsx`、`electron/window-registry.ts`、`electron/preload.ts`、`src/types/electron.d.ts` **未改**（既有 `onFlushSave` 與 save 佇列即可）

`git diff --stat`（tracked）：

```
 .../detached-window-profile-binding.test.ts        |  4 +-
 .../detached-workspace-persistence.test.ts         | 19 ++++++++
 electron/main.ts                                   | 50 ++++++++++++++--------
 src/stores/workspace-store.ts                      |  5 ++-
 4 files changed, 57 insertions(+), 21 deletions(-)
```

新檔：`electron/renderer-flush.ts` 103 行、`electron/__tests__/renderer-flush.test.ts` 279 行、`src/stores/__tests__/workspace-store.flushSave.test.ts` 64 行、`e2e/detached-flush-on-close.spec.ts` 136 行。

### 測試內容

- `renderer-flush.test.ts`：只認自己 sender 的 ack（兩視窗同時 flush，A 的 ack 不放行 B → B 逾時）；逾時與遲到 ack；已毀 / 中途毀 / send throw → `'gone'`；listener 皆移除；`flushBeforeClose`：關窗被擋到 flush resolve、重複 close 只 flush 一次、逾時 / reject / throw（含 onResult throw）仍關閉、`skip` 時直接關不 flush、flush 中被毀不重複 destroy；**真實 registry 檔上的順序**：events = `['save', 'flush:done', 'closed', 'reattached']`，reattached 時 entry 已是新名稱、新 `WindowRegistry` 從磁碟讀回仍是新名稱（重啟）；renderer 不 ack → 1500 ms 後 `['flush:timeout', 'closed', 'reattached']` 照常關閉。
- `workspace-store.flushSave.test.ts`：in-flight + 排隊中時再呼叫 `save()` 回傳 Promise，且在帶 rename 的排隊 save 送出並完成前不 resolve；只送一筆。
- e2e `detached-flush-on-close.spec.ts`（isolated runtime）：seed Alpha + Beta → detach Beta → detached 視窗以 UI（雙擊 `.main-panel-title`、輸入、Enter）rename → 關窗前父 entry 仍為舊名（log 佐證 gap 存在）→ `BrowserWindow.close()`（等同標題列 X）→ 父 entry 為新名稱、父視窗 Beta 顯示新名稱且無舊名 → quit（保留 userData）以同 runtime 重啟 → entry 與畫面仍為新名稱。
- **對照組**：暫時把 `skip` 改為恆 `true`（= 無 flush）重 build 跑同一 e2e → 失敗 `Expected "T0504 renamed in detached" / Received "T0504 old name"`（證明 e2e 有鑑別力）；已改回並重新 build 後才跑下列驗收。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 203 files / 3386 passed / 1 skipped（連跑兩次皆全綠）。首輪曾見 `electron/remote/__tests__/helper-connection-hygiene.test.ts`「a half-open helper frees its slot under the connection cap」失敗一次：單獨重跑與其後兩輪全套皆通過，屬 T0451 既有計時敏感測試，與本單檔案無關 |
| `npx vite build` | PASS |
| `npm run typecheck` | PASS — 0 errors |
| `npm run typecheck:electron` | PASS — 0 errors |
| e2e `detached-flush-on-close` + `detached-terminal-persistence` + `detached-workspace` + `smoke` | PASS（4 passed） |
| e2e 回歸 `navigation-guard` + `bug119-userdata-unification` | PASS（3 passed） |
| e2e 回歸 `plan039-multi-remote`（quit / 視窗關閉路徑） | PASS（4 passed） |

e2e 皆以 isolated `--runtime=e2e-…` 執行，結束時 fixture 已刪除 userData（log：`runtime userData removed: true`）；未以預設實例啟動 source build。

### 偏差 / 殘餘風險

- 新增 `electron/renderer-flush.ts`（不在 `affects_files` 清單；為了可單元測試把 flush / 關窗邏輯抽出，main.ts 只做接線）。
- 修改 `electron/__tests__/detached-window-profile-binding.test.ts`（T0446 source guard）：它斷言舊的同步 `clear()` 寫法；本單刻意改掉該寫法（否則 flush-save 會被丟棄），斷言隨之更新。
- quit flush 的「第一個 ack 放行全部」屬既有缺陷，順帶修正（工單要求確認 quit 路徑不重複、不死鎖）。
- 逾時（renderer 卡住 > 1.5 s）時仍可能遺失最後的非增刪變更，與 T0491 前相同；有 warn log 可查。
- 使用者在 quit 確認對話框開著時關掉 detached 視窗：`isAppQuitting` 已為 true → 不 flush（與主視窗 `close` 的既有判斷一致）；若接著取消 quit，該視窗最後 ≤ 30 s 的 rename 仍可能遺失。極少見，未處理。
- detached 視窗 flush 期間（≤ 1.5 s）對同 workspace 再按 detach 會 focus 正在關閉的視窗，而不是新開（`detachedWindows` 在 `closed` 前仍保留它）。
- 跟 T0491 一樣，renderer 端 `onFlushSave` 的 callback 若 throw 不會 ack（preload 未改），由逾時兜底。

### CLAUDE.md 建議文字（由 T0493 套用）

接在 T0491 建議的「Detached workspace 視窗的持久化」一節末尾：

> - **關窗前 flush（T0504）**：detached 視窗的 `close` 由 main 攔下（`flushBeforeClose`，`electron/renderer-flush.ts`），送 `workspace:flush-save` 給該視窗，等**該視窗自己的** `workspace:flush-save-done`（`requestRendererFlush`，最多 `DETACHED_CLOSE_FLUSH_TIMEOUT_MS` = 1.5 s）後 `destroy()`；逾時 / 失敗照樣關閉並 `logger.warn`。rename / sdkSessionId 等非增刪變更因此不再依賴 30 秒 autosave。app quitting 時跳過（`before-quit` 已對全部視窗含 detached flush，每個 renderer 各等自己的 ack，各 2 s）。🔴 live 的 detached 視窗在自己的 `closed` 之前不得從 `detachedWindows` / `detachedWindowRecords` 移除（否則它的 flush-save 會被當成未知 sender 丟棄）；`workspace:reattach` 與最後一個主視窗關閉都只 `close()`。renderer 的 `workspaceStore.save()` 在已有排隊 save 時回傳該 promise，flush ack 一定在最新狀態送出之後。驗證：`electron/__tests__/renderer-flush.test.ts`、`src/stores/__tests__/workspace-store.flushSave.test.ts`、e2e `e2e/detached-flush-on-close.spec.ts`。

### Commit

`git commit --only` 本單檔案（工單、`electron/renderer-flush.ts`、`electron/main.ts`、`src/stores/workspace-store.ts`、四個測試檔、e2e spec）；未 push、未觸發 workflow。hash 見 git log（`fix: T0504 …`）。
