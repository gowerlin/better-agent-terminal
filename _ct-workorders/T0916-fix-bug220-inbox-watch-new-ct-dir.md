---
schema_version: 1
schema_kind: workorder
id: T0916
title: "修 BUG-220：待辦分頁在 `_ct-workorders/` 之後才建立時自動讀到（不必按 ↻）"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
started_at: "2026-11-25T12:22:28+08:00"
updated_at: "2026-11-25T12:32:42+08:00"
completed_at: "2026-11-25T12:32:42+08:00"
session_ids:
  - "aef3af33-8ba1-4a10-aeb1-35895b2a55a0"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-220；D337；PLAN-068 W4（待辦分頁）；T0915 回報區〈建議開 BUG〉第 1 點"
affects_files:
  - _ct-workorders/T0916-fix-bug220-inbox-watch-new-ct-dir.md
  - electron/handlers/fs.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/stores/ct-dir-watch.ts
  - src/stores/__tests__/
  - electron/__tests__/
  - src/components/
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0916（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0916`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支：只在 `ct/T0916` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證再修：確認根因（T0915 推定：`fs:watch` 對不存在的目錄回 `false`、`acquireDirWatch` 不重試），找出 `acquireDirWatch` 的所有 consumer（待辦分頁、指揮塔總覽、工單列表等）。修法由你依證據選，條件：目錄之後被建立時，所有 consumer 都能在數秒內自動重讀；目錄本來就存在時行為、事件次數與目前完全相同；目錄被刪除再建立也要能恢復；不得改成輪詢整個專案樹或高頻輪詢（若必須輪詢，間隔 ≥ 2 s、只 stat 該目錄、目錄出現後停止）；遠端（proxied `fs:watch`、headless）行為同樣成立或與修正前一致（說明）。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0915 M-C1–M-C4 的 PASS 項、指揮塔總覽（T0701）的自動更新、T0905/T0906 的待辦分頁測試，逐案說明改動後仍成立。"
  - "🔴 驗證：新增單元測試（目錄不存在 → 建立 → consumer 收到變更；目錄存在的既有路徑不變）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報）。e2e 可選：若既有 `e2e/t0913-tower-inbox-integration.spec.ts` 容易加一段「沒有 `_ct-workorders/` 的工作區 → 之後建立」，就加並跑 1 次（隔離實例，需先 `npx vite build`）。不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md` 相關節補一行行為說明；CLAUDE.md 只在有新不變式時加一句。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0916): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）：不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題問塔台。"
---

# T0916 — 修 BUG-220：待辦分頁自動讀到新建的 `_ct-workorders/`

見 [BUG-220](BUG-220-inbox-tab-misses-new-ct-workorders-dir.md)。

## 驗收

- [x] 根因查證（附 `檔案:行`）
- [x] 目錄之後才建立 → 待辦分頁與其他 consumer 自動更新；目錄本來存在 → 行為不變（單元測試；實機待 BUG-220 驗收）
- [x] 單元測試、vite build、兩個 typecheck、`test:unit` 第一次即綠
- [x] 〈相關通過案例〉逐案判定
- [x] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：修法需要動 `electron/preload.ts` 與 `src/types/electron.d.ts`（不在 affects_files），可以嗎？
- **提問時間**：2026-11-25T12:26:08+0800
- **背景**：根因已確認：`fs:watch`（`electron/handlers/fs.ts`）對不存在的目錄 `fsSync.watch` 丟例外 → 回 `false`、不留任何 watcher；`acquireDirWatch` 不重試。另實測（Windows、Node）：被遞迴監看的目錄被刪除時 watcher 不發 `error`，而是無限噴 `rename`（debounce 永遠不結束 → 不會送 `fs:changed`），重建後舊 watcher 也看不到新檔。
- **我的修法**：`fs:watch` 加選用第二參數 `{ recreate: true }`：目錄不存在 → 改監看最近的已存在祖先（非遞迴、事件驅動、不輪詢），目錄出現就換成原本的遞迴 watcher 並送一次 `fs:changed`；目錄被刪除 / 被換掉（dev+ino 改變）→ 送一次 `fs:changed` 後回到等待。只有 `acquireDirWatch`（待辦分頁、指揮塔）帶這個選項；其他 `fs.watch` 呼叫者（檔案樹、Markdown 預覽、`.git`、`_bmad-output`）逐字不變。舊 bat-server 忽略第二參數 → 與修正前一致。
- **選項**：
  - A：允許改 `electron/preload.ts`（`fs.watch` 多一個選用參數，只在有給時才送）與 `src/types/electron.d.ts`（型別），共約 6 行。
  - B：不動 preload，改成 `fs:watch` 對所有呼叫者預設 recreate（影響檔案樹、`.git`、`_bmad-output` 等不存在目錄時的回傳值與 watcher 數）。
  - 其他
- **建議**：A。理由：改動只是讓選項穿過 IPC 橋，不改任何既有呼叫的送出內容；B 會改變其他 consumer 的行為，回歸面較大。
- **影響**：選 B 需改寫已完成的 fs.ts 選項判斷並重估其他 consumer。
- **是否阻擋後續**：是（決定 IPC 介面後才寫測試與文件）。
- **通道**：BAT（`q-dee2b97e-01b6495f5dc0a51a`，12:26:34 送出，`answered` choice 1，等待 11 s）。塔台答覆全文記在 `### 互動紀錄`。

### 完成狀態

- **狀態**：FIXED（實作與單元／型別／建置驗證完成，等實機驗收：新專案第一次開契約 2 塔台不按 ↻）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal` → PASS；C-1 工單在 `$CT_HOME/_ct-workorders/` → PASS；C-3 `affects_files` 皆存在 → PASS；C-2 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0916`；`BAT_WORKSPACE_ID` 有設定（僅記錄）。開工 `git merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`（符合工單）。
- **branch**：`ct/T0916`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；分支實際起點 = `4f7484bc`，即 `v0.8.x` merge-base）
- **validated_sha**：`d81fdc4c9cf302a4bbcd2157093d5cbe1437ab38`
- **head_sha**：`d81fdc4c9cf302a4bbcd2157093d5cbe1437ab38`
- **產品 commit**：`d81fdc4c` `fix(T0916): watch a _ct-workorders/ created (or re-created) later (BUG-220)`（worktree，未 push）
- **session_id**：aef3af33-8ba1-4a10-aeb1-35895b2a55a0

### 根因查證

1. `electron/handlers/fs.ts:68-85`（修正前）`fs:watch`：`fsSync.watch(_dirPath, { recursive: true })` 對不存在的目錄丟例外 → `catch { return false }`，什麼都不留。
2. `src/stores/ct-dir-watch.ts:20`（修正前）`acquireDirWatch` 只在第一個使用者時呼叫一次 `fs.watch`，結果被丟掉、不重試；之後 `_ct-workorders/` 被建立，沒有 watcher 會送 `fs:changed`，所以 `InboxDataSource`（`src/components/inbox/InboxDataSource.tsx:131`、`:171`）與 `ControlTowerPanel`（`src/components/ControlTowerPanel.tsx:726`）都不會重讀，直到按 ↻（`fs:reset-watch`）。T0915 推定成立。
3. 另行實測（本機 Windows、Node v26.13.1，scratchpad 腳本）：被遞迴監看的目錄**被刪除**時，watcher 不發 `error`，而是無限噴 `rename`（約 2 秒 30 萬次，filename 為該目錄自己的 `\\?\` 絕對路徑）；修正前的 500 ms debounce 因此永遠不結束、一次 `fs:changed` 都不會送；目錄重建後舊 watcher 也看不到新檔（`b.md` 沒有事件）。所以「刪除再建立」必須另外處理，只重試 `fs:watch` 不夠。

`acquireDirWatch` 的 consumer（全部）：`InboxDataSource`、`InboxStateSource`（`InboxDataSource.tsx`）、`ControlTowerPanel`（指揮塔：總覽、工單、Bugs、Backlog…都由同一個 `reloadAll` 重讀）。

### 修法

- `electron/handlers/fs.ts`：`fs:watch` 多一個選用參數 `FsWatchOptions` `{ recreate: true }`。
  - 目錄存在 → 原本的遞迴 watcher（同一段程式、同一個 500 ms debounce）。
  - 目錄不存在 → `armPending`：對**最近的已存在、path guard 允許的上層目錄**做非遞迴 `fs.watch`（事件驅動、不輪詢；事件以 100 ms 合併成一次 `statSync` 該目錄）。目錄出現 → 關掉上層 watcher、換成遞迴 watcher、經 debounce 送一次 `fs:changed`（涵蓋 watcher 建立前就寫入的檔）。中間層級後來才出現 → 監看點往下移。上層目錄被刪 / `error` → 往上重找；找不到允許的上層 → 回 `false`（與修正前相同）。
  - 目錄被刪除或被換掉 → 遞迴 watcher 收到事件時（最多每 100 ms 一次）比對 dev+ino；不見或改變 → 關掉舊 watcher（也停掉 Windows 的 `rename` 洪流）、立即送一次 `fs:changed`（consumer 重讀、看到目錄不在）、回到等待；watcher 的 `error` 同樣處理。
  - `fs:reset-watch`（↻）保留 `recreate`：目錄不存在時回到等待（`true`）；不是 `recreate` 的 watch 行為逐字不變。
  - `fs:unwatch` / disposer 關掉等待中的上層 watcher 與計時器。
  - 沒帶選項 → 與修正前相同（不存在的目錄回 `false`）。同一路徑先有一般 watch、後有 `recreate` 加入 → 升級成 `recreate`。
- `electron/preload.ts`、`src/types/electron.d.ts`（塔台 Q-1 選 A 允許）：`fs.watch(dirPath, options?)`；**只有給了 options 才多送參數**，其他呼叫者送出的 IPC 參數逐字不變。
- `src/stores/ct-dir-watch.ts`：`acquireDirWatch` 以 `{ recreate: true }` 呼叫 `fs.watch`；計數與 `fs.unwatch` 不變。
- 遠端：proxied `fs:watch` 的路徑轉換是 `first-string`（`electron/remote/path-aware-channels.ts:40`、`:248-250`）：只換第一個參數、其餘原樣；`invokeHandler`（`electron/remote/handler-registry.ts:50`）以 `...args` 交給 handler；headless 用同一個 `registerFsHandlers` → 行為相同（新增的 headless 線路測試驗證）。上層目錄經 headless `SyncedWorkspaceRoots` 檢查，工作區根目錄有同步就允許。**舊 bat-server**（T0916 之前）的 handler 是 `(_ctx, _dirPath)`，多出的參數被忽略、不出錯：不存在的目錄照舊回 `false`、不監看 → 與修正前相同（仍要按 ↻）。`fs:changed` 回程照舊由 `translateRemoteEventArgs` 轉回 client 形式。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| 新增單元測試 `electron/__tests__/fs-watch-recreate.test.ts` | PASS 12/12（真實檔案系統、Windows） | 不存在 → 建立 → `fs:changed`，之後寫檔也收到；沒帶選項仍 `false`、不送；中間層級後出現；**目錄存在時帶 / 不帶選項事件次數相同（1、2）**；刪除 → `fs:changed` → 重建 → `fs:changed` → 新目錄寫檔再收到；等待中 `unwatch` 後不再送；刪除後 `unwatch` 不留 watcher（重建不送）；↻ 保持等待；上層不在 guard 內 → `false`；一般 watch 被 `recreate` 升級；headless 線路：不帶選項 `false`、帶選項後建立目錄 → client 收到 `fs:changed [ct]` |
| 新增 `src/stores/__tests__/ct-dir-watch.test.ts` | PASS 3/3 | `fs.watch(CT, { recreate: true })`、`fs.unwatch(CT)` 單一參數、每視窗一次、舊橋 reject 被吞掉 |
| 更新 `src/components/__tests__/inbox-panel.test.tsx:446` | PASS | T0906 斷言 `fs.watch` 精確參數，改為 `(CT, { recreate: true })`（契約變更，非回歸） |
| `npx vite build` | exit 0 | 於 `d81fdc4c` |
| `npm run typecheck` | 0 | 於 `d81fdc4c` |
| `npm run typecheck:electron` | 0 | 於 `d81fdc4c` |
| `npm run test:unit`（第一次完整執行） | **綠**：Test Files 493 passed / 3 skipped（496）；Tests 8965 passed / 42 skipped（9007）；68.43 s | 於 `d81fdc4c`，12:30:01 開始 |
| e2e（選用） | 未加 | `e2e/t0913-tower-inbox-integration.spec.ts` 在啟動前就建立 `_ct-workorders/`，後續版本矩陣、清單、回答整段都依賴它（`setState` 寫 `_tower-state.md` 後按 ↻）；加「沒有目錄 → 之後建立」要重排開頭的 seed 流程，不算「容易加一段」，依工單略過。實機確認留給 BUG-220 驗收（新專案開契約 2 塔台、不按 ↻）。 |

### 相關通過案例判定

| 案例 | 改動後是否仍成立 | 理由 |
|---|---|---|
| T0915 M-C1-1 `bat-contract: 2`、`hooks: ok (injected, set 2)` | 成立 | `--set-role` / hooks 路徑未改 |
| T0915 M-C1-2 縮圖沒有 `CT↑`／`BAT↑`／`🪝✕` | 成立 | 縮圖判定未改；只改目錄監看 |
| T0915 M-C2-a 半句不送出、📨「你在輸入」 | 成立 | notify-hold / draft 未改 |
| T0915 M-C3-1、M-C3-3 回合訊息卡 | 成立 | tower-cards 未改；卡片 store 不依賴 `fs:watch` |
| T0915 M-C3-2 重列行加亮（M-C4 補驗） | 成立 | 同上；`_tower-state.md` 存在時的重讀事件次數不變（測試「existing directory: the same fs:changed events」） |
| T0915 M-C4-1～M-C4-6 待辦清單與回答 | 成立 | 目錄已存在時 `recreate` watcher 送的 `fs:changed` 與修正前相同；回答路徑未改。差別只在目錄被刪 / 重建時多送一次 `fs:changed`（重讀），不影響清單內容 |
| T0701 指揮塔總覽自動更新 | 成立 | `ControlTowerPanel` 仍經 `acquireDirWatch` → `fs:changed === ctDir` → `reloadAll`；目錄存在時事件相同；`_bmad-output`、`.git` 的 `fs.watch` 不帶選項 → 逐字不變；↻（`fs:reset-watch`）對存在的目錄行為相同 |
| T0906 待辦分頁測試（`inbox-panel.test.tsx` 25 項） | 成立 | 全過；唯一修改是 `fs.watch` 參數斷言（契約改變，見上表） |
| T0908 `inbox-w5.test.tsx`、T0905 / T0909 卡片相關測試 | 成立 | 全套 `test:unit` 綠 |

### 變更檔案

- `electron/handlers/fs.ts`（修法本體）
- `electron/preload.ts`、`src/types/electron.d.ts`（Q-1 A：選項穿過 IPC 橋；已加進 `affects_files`）
- `src/stores/ct-dir-watch.ts`
- `electron/__tests__/fs-watch-recreate.test.ts`（新）、`src/stores/__tests__/ct-dir-watch.test.ts`（新）、`src/components/__tests__/inbox-panel.test.tsx`
- `docs/agent-guide/tower-inbox.md`（〈遠端與 detached〉加一行行為說明、〈已知限制〉刪除線舊限制、〈驗證清單〉加測試）
- `CLAUDE.md`（「右側欄「待辦」分頁」節既有的 `acquireDirWatch` 規則後補一句新不變式：只有它帶 `{ recreate: true }`，其他 `fs.watch` 呼叫者不帶）

### 遭遇問題

- 無阻擋。Windows 刪除受監看目錄時的 `rename` 洪流是既有問題（修正前會讓該 watcher 永久空轉、不送 `fs:changed`）；本單只對 `recreate` 的 watch 處理，其他呼叫者（檔案樹、Markdown 預覽、`.git`、`_bmad-output`）照舊。

### 後續建議（交塔台）

1. BUG-220 實機驗收：新專案（沒有 `_ct-workorders/`）→ 加工作區 → 開契約 2 塔台 `/control-tower` → 不按 ↻，待辦分頁應在數秒內變「契約 v2 ✓」；另試刪除 `_ct-workorders/` 再讓塔台重建。遠端視窗需搭配新版 bat-server。
2. （可選）其他 `fs.watch` 呼叫者在 Windows 上遇到目錄被刪除時同樣會空轉（既有）；要不要也套用 dev+ino 檢查，另案評估。
3. `docs/agent-guide/ct-tower-overview.md:125` 提到 `acquireDirWatch` 但不在本單範圍，未改；如需一致可順手補一句。

### 互動紀錄

- [12:22] 開工：落點檢查 PASS、merge-base 符合；worktree 沒有 `node_modules` → `npm ci`（exit 0）。
- [12:26] Q-1: 修法需改 `electron/preload.ts`、`src/types/electron.d.ts`（不在 affects_files）→ A（塔台）: 「A：允許改 `electron/preload.ts` 與 `src/types/electron.d.ts`，請自己把這兩個檔加進本工單 frontmatter `affects_files`。條件：1. 只有 `acquireDirWatch` 帶 `{ recreate: true }`；其他呼叫者（檔案樹、`.git`、`_bmad-output`）送出的內容與行為完全不變。2. 遠端也要說明清楚：proxied `fs:watch` 與 headless 要收得到第二個參數，並且行為一致。舊的 bat-server 收到多出的參數要能忽略，退回修正前的行為（不出錯），在回報區寫明。3. 等待目錄出現時要用事件驅動，例如監看上層目錄。如果必須輪詢，照工單規定：間隔至少 2 秒、只 stat 那個目錄、出現後就停。目錄被刪除後要清掉 watcher，不得洩漏。」→ Action: 兩檔加進 `affects_files`；preload 只在有 options 時才多送參數；遠端行為寫在〈修法〉並以 headless 線路測試驗證；等待用上層目錄 watch（無輪詢）；刪除時關閉舊 watcher、`unwatch` 不留 watcher（測試驗證）。
- [12:31] 驗證完成（`d81fdc4c`）；塔台補充檢查（驗證前、commit 前、回報前）皆無新段落。
