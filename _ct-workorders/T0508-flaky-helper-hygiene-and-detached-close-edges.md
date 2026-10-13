---
schema_version: 1
schema_kind: workorder
id: T0508
title: "收尾：helper-connection-hygiene 計時敏感測試改為確定性 + detached 關窗兩個邊界（flush 中再 detach、quit 對話框取消後的 rename 遺失）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:38:51+08:00"
started_at: "2026-10-14T00:39:42+08:00"
updated_at: "2026-10-14T00:39:42+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0504"
related:
  - "T0504 回報區「驗證」：`electron/remote/__tests__/helper-connection-hygiene.test.ts:299`「a half-open helper frees its slot under the connection cap」全套跑時偶發失敗一次，單獨重跑通過（T0451 既有、計時敏感）"
  - "T0504 回報區「偏差 / 殘餘風險」：(1) quit 確認對話框開著時關 detached 視窗 → `isAppQuitting` 已 true 不 flush，若接著取消 quit，≤ 30 s 的 rename 遺失；(2) flush 期間（≤ 1.5 s）對同 workspace 再按 detach 會 focus 正在關閉的視窗"
  - "T0504 `electron/renderer-flush.ts`（`requestRendererFlush` / `flushBeforeClose`）、`DETACHED_CLOSE_FLUSH_TIMEOUT_MS`"
affects_files:
  - "electron/remote/__tests__/helper-connection-hygiene.test.ts"
  - "electron/main.ts"
  - "electron/renderer-flush.ts"
  - "electron/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 A：先找出不穩定的根因（計時 / 事件順序 / 連線關閉偵測），以假時鐘或事件等待取代固定 sleep；不得放寬斷言或加大 timeout 了事；不得改產品常數（T0451 / PLAN-039 規則：測試不得為縮短等待改產品常數）。全套連跑 ≥ 5 次穩定"
  - "🔴 B：不得破壞 T0491 / T0504 順序保證（save → flush:done → closed → reattached）；quit 路徑不得重複 flush 或死鎖"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0508 — 不穩定測試 + detached 關窗邊界

## A. helper-connection-hygiene 測試確定化

- 重現（全套 / 單檔反覆跑）並找出根因；改為確定性等待
- 驗證：該檔連跑 20 次、全套 `npm run test:unit` 連跑 5 次皆綠

## B. detached 關窗邊界

1. quit 取消：quit 流程中關閉的 detached 視窗，若 quit 被取消（`isAppQuitting` 復原的時點），確保其最後狀態有寫入（例如 quit 確認期間不跳過 flush，或取消時補 flush——擇一說明，不得造成 quit 時重複 flush）
2. flush 中再 detach 同 workspace：等待舊視窗關閉完成後再開新視窗（或明確拒絕並提示），不得 focus 一個即將關閉的視窗
3. 測試：單元（`renderer-flush` / main 接線 source guard 或可測抽出）；可行時 e2e

## 驗收條件

- [x] A：根因說明 + 連跑證據
- [x] B：單元（+ e2e 若可行）；既有 `detached-*` / `smoke` / `plan039-multi-remote` e2e 回歸
- [x] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [x] 回報區：CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0504 / T0491 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果：DONE

- **Landing check：PASS** — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單位於 REPO_ROOT 下；C-3 `electron/main.ts`、`electron/renderer-flush.ts`、`electron/remote/__tests__/helper-connection-hygiene.test.ts` 皆存在；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 起訖：`started_at` 2026-10-14T00:39:42+08:00；本區於 2026-10-14T00:59:31+08:00 填寫。

### A. helper-connection-hygiene 計時敏感測試 → 確定性

**根因**：兩個 heartbeat 測試以真實 `heartbeatIntervalMs: 100` 跑。server 端 helper 認證時 `alive: true`，第 1 拍設 `alive = false` 並 ping，第 2 拍仍 `alive === false` 即 terminate（`remote-server.ts` heartbeat 迴圈）。不回 pong 的 helper 在認證後 **100–200 ms** 內就被斷線。「a half-open helper frees its slot under the connection cap」要先以真實 wss 連上並認證 4 條 `autoPong: false` 連線、再送第 5 條，期待 `Too many helper connections`。全套並行時（203 個檔案）TLS 握手 + auth 變慢，4 條還沒填滿，第 1 條就已被 heartbeat 斷掉，名額空出，第 5 條被接受，斷言收到 `undefined`。前一個測試（silent vs live）也有同類問題：live 的 pong 若在下一拍之前沒被讀到就會被誤斷，另外還有固定的 `sleep(400)`。

**重現**：單檔 10 個並行沒有失敗。在 scratch 複本中，每條連線認證後用 busy-loop 擋住 event loop 60 ms（模擬全套負載），就穩定失敗：`AssertionError: expected undefined to be 'Too many helper connections'`。改完後，同一個模擬即使擋 300 ms（另外在 live 連線之後也擋 300 ms）也通過。scratch 檔已刪除。

**修法（只改測試，未改產品常數、未放寬斷言、未加 timeout）**：
- heartbeat 測試改為手動驅動：`vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })`，只假造 server 的 heartbeat `setInterval`；socket、auth timeout（`setTimeout`）與其餘等待維持真實時間。測試在填滿名額之後才以 `heartbeat()`（`vi.advanceTimersByTime(100)`）逐拍推進。拍數決定結果：第 1 拍 ping、第 2 拍斷線。`afterEach` 會 `vi.useRealTimers()`。
- live 連線的「已回 pong」改成事件確認（`heartbeatAnswered`）：先等 client 收到第 n 次 ping（`ws` 在 emit `'ping'` 前已把 pong 排入佇列），再送一個應用層 `{ type: 'ping' }` frame 並等它的 `pong` 回來。server 依序讀同一條 socket，所以收到回覆時一定已經處理過那個 pong。斷言改為：第 2 拍 silent 被斷、live 留下，之後多跑 2 拍 live 仍在，且 `Helper missed a heartbeat` 只出現 1 次。原本的 `sleep(400)` 已移除。
- 🔴 `vi.waitFor` 在 fake timers 下每次輪詢都會 `advanceTimersByTime(interval)`（vitest 4.1.5 原始碼確認），會偷跑 heartbeat。因此 `waitForFrame` 改成事件驅動的 `until()`：每次收到 `'message'` / `'ping'` 時重新檢查，`'close'` 時 fail-fast，5 s 上限。全檔共用，非 fake 的測試行為不變。
- cap 測試的斷言比原本更嚴格：第 1 拍後連線數仍是 4，第 2 拍後**同步**變 0；4 條 close code 皆為 1006；之後新連線可認證。

**連跑證據**：
- 單檔 `npx vitest run electron/remote/__tests__/helper-connection-hygiene.test.ts` **連跑 20 次：20/20 PASS**（每次 22 passed）
- 全套 `npm run test:unit` **連跑 5 次**：**5/5 PASS**（每次 203 files / 3446 passed / 1 skipped，exit 0）

### B. detached 關窗邊界

**B1 quit 取消（選擇：quit 確認期間不跳過 flush）**
- 新增 `quitFlushStarted` 旗標，只在 `before-quit` 對話框**確認之後**、quit flush 迴圈之前設為 `true`，之後不會重設（確認後 quit 一定會走完）。detached 的 `flushBeforeClose` 改成 `skip: () => quitFlushStarted`，不再用 `skip: () => isAppQuitting`。對話框開著的時候（`isAppQuitting` 已是 true）關 detached 視窗會照常 flush（≤ 1.5 s）再關；使用者取消 quit 時，最新狀態已經寫入。
- **不重複 flush**：`createRendererFlusher(ipcMain)` 讓每個 renderer 同一時間只有一個 flush；flush 進行中再收到請求，回傳同一個 promise。quit flush 與 detached 關窗 flush 共用這個 `flushRenderer`：對話框開著時關掉 detached 視窗，在它還在 flush 時按下確認，quit flush 會**併入**那次 flush，不會再送一次 `workspace:flush-save`。quit flush 開始之後（`app.quit()` 關窗）detached 關窗直接跳過。
- **不死鎖**：flush 都有上限（關窗 1.5 s、quit 2 s），`requestRendererFlush` 永不 reject，`flushBeforeClose` 一定會 `destroy()`。main 視窗 `close` 的 `isAppQuitting` 判斷未改。

**B2 flush 中再 detach 同 workspace（選擇：等舊視窗關完再開新視窗）**
- `flushBeforeClose` 改為回傳 `CloseGuard { closing() }`：flush 開始後回傳一個在 `'closed'` 時 resolve 的 promise，開始前回傳 null。
- 新增 `DetachedTeardowns`（`electron/renderer-flush.ts`）。`'closed'` handler 用 `reattachPending(ws, whenIdle().then(send 'workspace:reattached'))` 記下「父視窗還沒收到 reattached」；`pending(ws, guard)` 回傳要等的 promise（視窗關閉中 → 等它的 closed；已關但 reattached 未送 → 等送出），沒有要等的就回 null。
- `workspace:detach`：快速路徑只 focus **不在關閉中**的視窗。binding 之後以 `for (let pending = detachedTeardownPending(ws); pending; …) await pending` 等待，最後一次檢查到 `detachedWindows.set()` 之間沒有任何 await，所以並行的兩次 detach 只會開一個視窗，另一次會 focus 它。等待上限約為 1.5 s flush 加上 registry whenIdle。
- 為什麼也要等 reattached：只等 `'closed'` 的話，新視窗的 `workspace:detached` 可能比舊視窗延後送出的 `workspace:reattached` 先到父視窗，父視窗會以為 workspace 已經 reattach（這個縫隙在 T0508 之前就存在，只是很窄）。
- 選「等」而不選「拒絕 + 提示」：提示需要新增三語 i18n，與批次中正在改 locale 的工單可能衝突；等待的上限只有約 1.5 s，使用者感受是 detach 稍慢一點。

### 檔案

- `electron/renderer-flush.ts`：`createRendererFlusher`、`CloseGuard`（`flushBeforeClose` 回傳值）、`DetachedTeardowns`；`FlushBeforeCloseWindow` 加 `once('closed')`（BrowserWindow 本來就有）
- `electron/main.ts`：`quitFlushStarted`、`flushRenderer`、`detachedCloseGuards`、`detachedTeardowns`、`detachedTeardownPending()`；quit flush 改用 `flushRenderer`；`workspace:detach` 快速路徑與等待迴圈；`'closed'` 改為 `reattachPending(...)`
- `electron/remote/__tests__/helper-connection-hygiene.test.ts`：A
- `electron/__tests__/renderer-flush.test.ts`：+12 測試（flusher 單飛 / 獨立 / 逾時釋放；close guard；quit 對話框中關窗 → flush、確認時併入、quit flush 後不再 flush；flush 中再 detach → 依序 `closed → reattached → 新視窗`、兩次點擊只開一窗、renderer 卡住時最多延後 1.5 s、未關閉中直接 focus、reattach 失敗也會清除）
- `electron/__tests__/detached-workspace-persistence.test.ts`：T0504 source guard 的 `skip` / `requestRendererFlush` 斷言改為新寫法；T0491 guard 的 `void windowRegistry.whenIdle()` 拿掉 `void`（意圖「reattached 在 whenIdle 之後」不變）；新增 T0508 source guard（`quitFlushStarted` 在取消分支之後、quit flush 迴圈之前設定且只賦值兩處；全檔不再直接呼叫 `requestRendererFlush(`；detach 快速路徑排除關閉中視窗；等待迴圈在 binding 之後、`set()` 之前且中間無 await；`'closed'` 走 `reattachPending`）
- `e2e/detached-close-edges.spec.ts`（新，2 個測試，isolated runtime）

`git diff --stat`（tracked，不含工單）：

```
 .../detached-workspace-persistence.test.ts         |  37 +++-
 electron/__tests__/renderer-flush.test.ts          | 235 +++++++++++++++++++++
 electron/main.ts                                   |  48 ++++-
 .../__tests__/helper-connection-hygiene.test.ts    |  98 +++++++--
 electron/renderer-flush.ts                         |  60 +++++-
 5 files changed, 450 insertions(+), 28 deletions(-)
```

新檔：`e2e/detached-close-edges.spec.ts` 201 行。

### 驗證

| 項目 | 結果 |
|---|---|
| A 單檔連跑 20 次 | PASS — 20/20 |
| `npm run test:unit` 連跑 5 次 | PASS — 5/5（203 files / 3446 passed / 1 skipped） |
| `npx vite build` | PASS |
| `npm run typecheck` | PASS — 0 errors |
| `npm run typecheck:electron` | PASS — 0 errors |
| 單元 mutation 對照 | `pending()` 改成恆回 null、flusher 去掉單飛 → 5 個 T0508 測試失敗；還原後 22/22 |
| e2e `detached-close-edges`（新） | PASS（2 passed） |
| e2e 對照組 | 暫時改回 `skip: () => isAppQuitting` 並讓 `pending()` 恆回 null，重 build：2 個都失敗（B1 `Expected "T0508 renamed in detached" / Received "T0508 old name"`；B2 `waitForEvent: Timeout 15000ms exceeded while waiting for event "window"`）。已用備份還原並重 build |
| e2e 回歸 `detached-flush-on-close` + `detached-terminal-persistence` + `detached-workspace` + `smoke` + `navigation-guard` | PASS |
| e2e 回歸 `plan039-multi-remote` | 單獨跑 2 次皆 4 passed；與新 spec 一起跑 6 passed；不含新 spec 的完整回歸集 9 passed。**含新 spec 的完整回歸集跑 2 次，M3 都失敗**：`profile:create` → `EPERM: operation not permitted, rename '…\profiles\index.json.tmp' -> '…\profiles\index.json'`（見殘餘風險） |

e2e 皆以 isolated `--runtime=e2e-…` 執行，結束時 fixture 刪除 userData（log：`runtime userData removed: true`）；未以預設實例啟動 source build。

### 偏差 / 殘餘風險

- **plan039 M3 的 `EPERM`（非本單引入，建議另開單）**：`electron/profile-manager.ts` `writeIndex()` 沒有序列化，執行順序是先 `readIndexFile(index.json)` + `copyFile(→ .bak)`，再寫 `index.json.tmp`，最後 `rename`。並行的 `profile:create`（M3 連建多個 profile）會讓某一次 rename 撞上另一次正在讀 / 複製的 `index.json`，Windows 因而回 `EPERM`；共用同一個 `.tmp` 檔名也會互相覆蓋。本單沒有碰 profile-manager，也沒有碰 plan039 走的 remote 路徑。它只在負載 / 時序剛好時出現：單獨跑與兩檔組合都綠，只有「新 spec + 完整回歸集」的組合重現 2/2。建議工單：`writeIndex` 用 mutex 序列化（必要時對 `EPERM` 做有限重試），並補並行建立的單元測試。
- 再 detach 會延後最多約 1.5 s（舊視窗 flush 上限）加上 registry whenIdle；期間 renderer 的 `detach` invoke 不會回應（UI 無提示）。
- 舊視窗 `workspace:reattached` 送出後，父視窗的 `adopt-detached` 是非同步的。若它在新 detach 註冊**之後**才到 main，會回 null（`isWorkspaceDetached`），ownership 由新視窗沿用，等新視窗關閉時再 adopt。若在之前到，就照常 release + adopt，新 detach 再 claim。兩種順序下 entry 都一致（新視窗從 entry 讀到的是最新清單），e2e B2 驗證了新視窗顯示 rename、最後關閉時父視窗 adopt 也正確。
- `renderer-flush.ts` 新增的 `DetachedTeardowns` 不完全屬於「flush」，但與 `flushBeforeClose` 同屬 detached 關窗流程，因此放在同一檔，以維持在 `affects_files` 內。
- 測試輔助 `until()` 取代全檔的 `vi.waitFor` 版 `waitForFrame`（行為等價，事件驅動）；連線數的 `vi.waitFor`（非 fake timers 測試）保留。

### CLAUDE.md 建議文字（由 T0493 套用）

接在 T0504 建議段（「關窗前 flush（T0504）」）末尾：

> - **quit 對話框與再 detach（T0508）**：detached 關窗 flush 只在 quit flush **已開始**後跳過（`quitFlushStarted`，`before-quit` 確認對話框之後才設），所以對話框開著時關窗照常 flush，取消 quit 不會遺失。quit flush 與關窗 flush 共用 `createRendererFlusher`（`electron/renderer-flush.ts`），同一 renderer 同時只有一個 flush，確認 quit 時會併入進行中的關窗 flush，不重送。`workspace:detach` 遇到同 workspace 的視窗還在關閉（flush 中，或已 `closed` 但 `workspace:reattached` 尚未送出，`DetachedTeardowns`）時，會等它結束再開新視窗，不會 focus 正在關閉的視窗；🔴 等待迴圈最後一次檢查到 `detachedWindows.set()` 之間不得有 await。驗證：`electron/__tests__/renderer-flush.test.ts`（T0508 段）、`detached-workspace-persistence.test.ts` T0508 source guard、e2e `e2e/detached-close-edges.spec.ts`。

「Frontend unit tests」節可補一句：

> - 測試若用 fake timers，不要用 `vi.waitFor` 等待 socket / IPC 事件：vitest 在 fake timers 下每次輪詢都會 `advanceTimersByTime(interval)`，會偷跑被假造的 interval（T0508，`helper-connection-hygiene.test.ts` 改用事件驅動的 `until()`）。真實 socket 的 heartbeat 測試只假造 `setInterval` / `clearInterval`，再以 `vi.advanceTimersByTime` 逐拍推進。

### Commit

`git commit --only` 本單檔案（工單、`electron/renderer-flush.ts`、`electron/main.ts`、三個測試檔、`e2e/detached-close-edges.spec.ts`）；未 push、未觸發 workflow；`_ct-workorders/T0507-*`、`tmp/` 未納入。hash 見 git log（`fix: T0508 …`）。
