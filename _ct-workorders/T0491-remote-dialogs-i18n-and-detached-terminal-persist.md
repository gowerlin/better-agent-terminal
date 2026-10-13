---
schema_version: 1
schema_kind: workorder
id: T0491
title: "remote 失敗對話框三語化（unreachable / trust / protocol）+ detached 視窗內新增 / 關閉終端持久化到父視窗 entry（BUG-113 已知限制）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:42:49+08:00"
updated_at: "2026-10-14T00:01:09+08:00"
completed_at: "2026-10-14T00:01:09+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0485"
  - "T0486"
related:
  - "T0464 回報區：對話框 i18n 只做 limit，main 端其他 remote 失敗對話框（unreachable / trust / protocol）仍為英文；`showRemoteProfileFailureDialog`（`electron/main.ts:1370`）"
  - "BUG-113：detached 視窗唯讀載入父視窗 entry、持久化只由父視窗負責；已知限制：detached 視窗內新增 / 關閉的終端不會持久化（save 為 no-op），reattach 後顯示 detach 當時的終端清單"
affects_files:
  - "electron/main.ts"
  - "electron/window-registry.ts"
  - "electron/preload.ts"
  - "src/types/electron.d.ts"
  - "src/stores/"
  - "src/components/"
  - "src/locales/"
  - "electron/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 detached 持久化不得回到 BUG-113 前「detached store 覆寫父視窗 entry」：只同步該 detached workspace 的終端增刪，由 main 合併進父視窗 entry；父視窗 30 秒 autosave 與 detached 更新的競態要處理並測試"
  - "🔴 i18n 三語（以現有 locales 為準），文案風格比照 T0464 的 limit 對話框"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0491 — remote 失敗對話框三語化（unreachable / trust / protocol）+ detached 視窗內新增 / 關閉終端持久化到父視窗 entry（BUG-113 已知限制）

## A. remote 失敗對話框三語化

- `showRemoteProfileFailureDialog` 的所有 reason（unreachable / trust / protocol / 其他）走 main 端 i18n（比照 T0464 `limit`），保留原始錯誤細節（detail）
- 單元測試：每個 reason 三語文案存在、detail 保留

## B. detached 視窗終端持久化

- detached renderer 在終端增刪時通知 main → main 只更新父視窗 entry 中對應 workspace 的終端清單（最小合併），不寫其他 workspace
- 競態：父視窗 autosave 與 detached 更新交錯時不得互相覆蓋（測試證明）
- reattach 後父視窗顯示 detached 期間的最新終端清單
- e2e（isolated runtime）：detach → 新增終端 → reattach / 關閉 → 父視窗清單正確、重啟後仍正確

## 驗收條件

- [ ] A / B 單元測試；B 的 e2e
- [ ] `npm run test:unit`、`npx vite build`、`npx tsc --noEmit -p .`（T0486 後應為 0）；CLAUDE.md 建議文字

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果：DONE

- **Landing check：PASS** — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單位於 REPO_ROOT 下；C-3 `electron/main.ts` 等皆存在；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 起訖：`started_at` 2026-10-13T23:42:49+08:00 → 完成 2026-10-14T00:00:00+08:00 後填寫本區。

### A. remote 失敗對話框三語化

- `electron/remote/remote-profile-error.ts`：新增 `getRemoteProfileFailureStrings(lang)`（en / zh-TW / zh-CN；語言判定與 `getRemoteProfileLimitStrings` 相同：`zh-tw` / `zh` / `zh-hant` → 繁中，`zh-cn` / `zh-hans` → 簡中，其餘英文），含 `unreachable` / `trust` / `protocol` 的 `title` / `message` / `detail`、原始錯誤行前綴 `error`（`Error: {{error}}` / `錯誤：{{error}}` / `错误：{{error}}`）與按鈕 `ok`。`describeRemoteProfileFailure()` 全部 reason 依 `lang` 取字串，回傳值多一個 `ok`；原始錯誤文字逐字附在 detail 尾（`\n\n<前綴><原文>`，單次 placeholder 取代，錯誤內含 `{{x}}` / `$&` 不會被展開）。英文文案與原本逐字相同。
- `electron/main.ts` `showRemoteProfileFailureDialog`：按鈕改用 `ok`（原寫死 `'OK'`，含 `limit`）。
- `src/locales/{en,zh-TW,zh-CN}.json`：新增 `remoteProfileFailure.*`（緊接 `remoteProfileLimit` 之後），與 main 端字串由單元測試比對一致（同 T0464 模式）。renderer 目前不使用這組 key。
- 測試 `electron/remote/__tests__/remote-profile-error.test.ts`：3 reason × 3 語（文案取自字串表、label / host:port 填入、detail 以「前綴 + 原始錯誤」結尾、無殘留 placeholder、`ok`）、語言選擇與英文 fallback、無 error 時不附錯誤行、三語 locale 一致性；移除舊的「其他 reason 不論語言都英文」斷言。

### B. detached 視窗終端持久化

設計（遵守 memory_overrides：不回到 detached 覆寫父 entry）：
- **main 只做最小合併**：detached 視窗的 `workspace:save` 不再是 no-op，但只取 payload 中 `workspaceId === 該 detached workspace` 的終端，替換父視窗 entry 中該 workspace 的終端清單（放在原第一個位置）；`workspaces` / `activeWorkspaceId` / `layout` / 其他 workspace 的終端一律不動（`saveDetachedWorkspaceTerminals`）。父 entry 不存在 → 回 `false`、不寫。
- **所有權**：detach 時 `DetachedTerminalOwners.claim(parentWindowId, workspaceId)`；父視窗自己的 `workspace:save`（含 30 秒 autosave、quit flush）對其擁有中的 workspace 保留 entry 內的清單、忽略父視窗手上 detach 前的舊副本（`saveWindowWorkspaces`）。
- **競態**：`WindowRegistry` 新增序列化佇列，`saveEntry` / `removeEntry` / 新的 `updateEntry`（讀改寫）/ `withEntry`（讀）/ `whenIdle` 共用同一佇列，父 save 與 detached save 的讀寫不會交錯（原本 `getEntry` 每次讀檔、`saveEntry` 讀全部再寫，兩個 writer 交錯會丟更新——測試有對照組證明）。
- **reattach**：detached 視窗 `closed` 後，main 先 `await windowRegistry.whenIdle()`（detached 最後一次 save 已同步排入佇列）才送 `workspace:reattached`；父 renderer 收到後在 **save 佇列中** 呼叫新 IPC `workspace:adopt-detached`，main 於同一佇列步驟回傳該 workspace 的持久化終端清單並釋放所有權 → 早於採用的父 save 仍受保護、晚於採用的父 save 已帶新清單，兩者不會互相覆蓋。父視窗完整 `workspace:load`（renderer reload）也會釋放已無 detached 視窗的所有權。
- **renderer**：`workspaceStore.adoptDetachedWorkspaceTerminals()` 以持久化清單替換該 workspace 終端（既有終端保留 runtime 狀態並更新 title / alias / sdkSessionId 等 metadata；被關掉的清 preview cache、焦點落回存在的終端）；新出現的 PTY 終端（非 integrated agent）呼叫 `requestPtyReplay` 讓 view 掛上後回放既有輸出。訂閱放在既有 `listenForReload()` 內（App.tsx 不必改）。
- quit flush-save 也送給 detached 視窗（其終端清單在退出前合併進父 entry）。

檔案：`electron/window-registry.ts`（佇列 + `replaceWorkspaceTerminals` / `workspaceTerminals` / `DetachedTerminalOwners` / `saveWindowWorkspaces` / `saveDetachedWorkspaceTerminals`）、`electron/main.ts`（save / load handler、`invokeDetachedWorkspacePersistence` 拆成 `saveDetachedWorkspace` / `loadDetachedWorkspace`、detach claim、closed 後 `whenIdle`、`workspace:adopt-detached`、`isWorkspaceDetached`、flush-save 含 detached）、`electron/preload.ts` + `src/types/electron.d.ts`（`workspace.adoptDetached`）、`src/stores/workspace-store.ts`（`toTerminalInstance` 抽出、`adoptDetachedWorkspaceTerminals`、`listenForReload` 加 reattached 訂閱）。

測試：
- `electron/__tests__/window-registry-detached-terminals.test.ts`（新，14）：合併規則、所有權、真實 registry 檔上的競態——detached save 後父 stale autosave 不還原；父 / detached **同時**存檔（兩種順序，讀檔人為延遲 15 ms 使交錯必然發生）結果正確；**對照組**：不經佇列的 `getEntry → saveEntry` 在同條件下會把 detached 的更新蓋掉（證明競態真實存在、測試有鑑別力）；釋放後父 save 生效；`whenIdle`；父 entry 不存在；新 `WindowRegistry` 從磁碟讀回（重啟）。
- `src/stores/__tests__/workspace-store.adoptDetached.test.ts`（新，4）：替換只限該 workspace、保留 runtime 狀態、回報新 id、null 不動；**save 佇列順序**（先要求的 save 帶舊清單先送、採用在其後、之後的 save 帶新清單）；reattached 事件觸發採用並只對新 PTY 終端 replay。
- `electron/__tests__/detached-workspace-persistence.test.ts`：source guard 更新為新接線（含「detached save 在呼叫 registry 前無 await」、closed → `whenIdle` → reattached、adopt 在同一 `withEntry` 內釋放）。
- e2e `e2e/detached-terminal-persistence.spec.ts`（新，isolated runtime）：seed Alpha(1) + Beta(2) → detach Beta → 在 detached 視窗以 UI 關掉「Beta one」、以 `+` 開新 shell → 父 entry Beta = [Beta two, 新] 且 Alpha / workspaces / activeWorkspaceId 不變 → 父視窗送出 detach 前的舊副本 save → 仍為 [Beta two, 新] → 關閉 detached 視窗 → 父視窗 Beta 顯示 2 個終端、含新終端標題、無「Beta one」→ quit（保留 userData）以同 runtime 重啟 → entry 與畫面仍正確。
- `e2e/detached-workspace.spec.ts`（T0453）：「detached save 是 no-op」段改為「只改 Beta 的終端、workspaces 與其他終端不變、payload 中別的 workspace 的終端被忽略」。
- `e2e/fixtures/electron-isolation.ts`：`launchIsolated` 加 `opts.runtimeId`（重開同一 runtime，格式驗證 `^e2e-[a-zA-Z0-9._-]+$`）、`closeIsolated` 加 `opts.keepUserData`；預設行為不變。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 190 files / 3217 passed / 1 skipped |
| `npx vite build` | PASS |
| `npx tsc --noEmit -p .` | PASS — 0 errors |
| `npm run typecheck:electron` 等價指令 | 77 errors（= T0496 記錄的 electron 基線 77）；本單改動的 `window-registry.ts` / `preload.ts` / `remote-profile-error.ts` / 新測試 0 筆；`main.ts` 的錯誤皆為既有型態（`registerHandler` 參數型別、`app.dock`、`fs.promises` 等），總數未增 |
| e2e `detached-terminal-persistence.spec.ts` + `detached-workspace.spec.ts` | PASS（2 passed） |
| e2e 回歸 `smoke` / `plan039-multi-remote` / `bug119-userdata-unification` / `navigation-guard`（registry `saveEntry` 改為串行） | PASS（8 passed, 50.9 s） |
| 對話框實機目視 | 未做（main 原生對話框；字串與接線由單元測試覆蓋） |

e2e 皆以 isolated `--runtime=e2e-…` 執行，結束時 fixture 已刪除各自 userData（log：`runtime userData removed: true`）；未以預設實例啟動 source build。

### 偏差 / 殘餘風險

- `remoteProfileFailure.*` 加進 locales 只為與 main 端同步檢查（比照 `remoteProfileLimit`），renderer 尚未使用。
- 父視窗 renderer 若在 reattach 後未呼叫 `workspace:adopt-detached`（例如 renderer 當掉），該 workspace 的終端清單持續由 entry 保留（父視窗的增刪不寫入）直到父視窗完整 reload 或 app 重啟；所有權只在記憶體，不持久化。
- detached 視窗的非增刪變更（rename、sdkSessionId 等）仍靠其 30 秒 autosave / quit flush；detached 視窗直接關閉時最後 30 秒內的這類變更可能遺失（增刪都會立即 save，不受影響）。
- `workspace:save` 對 remote client 的 `broadcastHub` `workspace:reload` 廣播維持原樣（父視窗原始 payload）；detached save 不廣播。與本單前行為一致。
- detach 當下父視窗尚未存檔的變更（≤ 30 秒）不會出現在 detached 視窗——既有行為，終端增刪本來就即時 save，影響小。

### CLAUDE.md 建議文字（由 T0493 套用）

建議在「Logging」之後或「Sub-agent / Active Tasks Tracking」之前新增一節：

> ## Detached workspace 視窗的持久化（T0453 / T0491）
>
> - detached 視窗沒有自己的 registry entry：`workspace:load` 回父視窗 entry（`loadDetachedWorkspace`），`workspace:save` 只把**該 detached workspace 的終端清單**合併進父 entry（`saveDetachedWorkspaceTerminals`，`electron/window-registry.ts`），其他欄位與其他 workspace 一律不動。🔴 不要改回「detached store 覆寫父 entry」（BUG-113 前的問題）。
> - detach 期間該 workspace 的終端清單歸 detached 視窗所有（`DetachedTerminalOwners`，記憶體）：父視窗的 save（含 30 秒 autosave、quit flush）保留 entry 內的清單。detached 視窗關閉後 main 先 `windowRegistry.whenIdle()` 再送 `workspace:reattached`，父 renderer 在 save 佇列中呼叫 `workspace:adopt-detached` 取回清單並釋放所有權；父視窗完整 `workspace:load` 也會釋放已無 detached 視窗的所有權。
> - `WindowRegistry` 的 `saveEntry` / `removeEntry` / `updateEntry` / `withEntry` / `whenIdle` 共用一個序列化佇列；同一 entry 的讀改寫請用 `updateEntry`，不要 `getEntry` → 改 → `saveEntry`（會與其他 writer 交錯而丟更新）。
> - 驗證：`electron/__tests__/window-registry-detached-terminals.test.ts`、`src/stores/__tests__/workspace-store.adoptDetached.test.ts`、e2e `e2e/detached-terminal-persistence.spec.ts`（需先 `npx vite build`）。
>
> 另於「遠端」相關段落補一句：main 端 remote profile 失敗對話框（`unreachable` / `trust` / `protocol` / `limit`）全部依設定語言三語化（`remote-profile-error.ts` `getRemoteProfileFailureStrings` / `getRemoteProfileLimitStrings`，與 `src/locales/*.json` `remoteProfileFailure.*` / `remoteProfileLimit.*` 由單元測試保持一致）；原始錯誤文字逐字附在 detail。

### Commit

見下方 commit 紀錄（`git commit --only` 本單檔案；未 push）。
