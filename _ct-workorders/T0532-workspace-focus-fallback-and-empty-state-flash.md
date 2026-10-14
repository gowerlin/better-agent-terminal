---
schema_version: 1
schema_kind: workorder
id: T0532
title: "BUG-134 後續：adoptDetached focus 不跨工作區（BUG-135）＋ 新工作區預設終端建立中不閃空狀態"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-135
priority: P3
sizing: S
created_at: "2026-10-15T01:32:28+0800"
started_at: "2026-10-15T01:33:28+0800"
updated_at: "2026-10-15T01:44:18+0800"
completed_at: "2026-10-15T01:44:18+0800"
target_version: "0.6.0-pre.12"
related:
  - BUG-135
  - "BUG-134 / T0531（空狀態 `terminals-empty-state`、`removeTerminal` focus 修正）"
affects_files:
  - src/stores/workspace-store.ts
  - src/components/WorkspaceView.tsx
  - src/styles/layout.css
  - src/stores/__tests__/
  - src/components/__tests__/
  - e2e/
  - _ct-workorders/T0532-workspace-focus-fallback-and-empty-state-flash.md
  - _ct-workorders/BUG-135-adopt-detached-focus-crosses-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 token：只用一般 shell 終端或自訂 CLI 跑 node 腳本。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 Detached 視窗持久化規則不得破壞（CLAUDE.md「Detached workspace 視窗的持久化」：adopt 流程、所有權釋放、save 佇列順序不變，只改 focus 選擇）。"
---

# T0532 — focus fallback 不跨工作區 ＋ 空狀態不閃

## 背景

T0531（`d41280ae`，BUG-134）修正後留下兩件事（見 T0531 回報區「偏差 / 備註」）：

1. **BUG-135**：`workspace-store.ts` 的 detached 終端取回路徑（`adoptDetached` 一帶，約 L908）focus fallback 仍是全域 `terminals[0]`，與 T0531 修掉的 `removeTerminal()` 同類
2. 全新工作區第一次啟用時，在預設終端建立完成前（非同步取 shell 路徑），會短暫顯示 T0531 新增的空狀態（含「新增終端」按鈕）。這一下若剛好點到按鈕，會多開一個終端

## 任務

1. **BUG-135**：盤點 `workspace-store.ts` 所有設定 `focusedTerminalId` 的 fallback（不只 adoptDetached），凡是會落到全域第一個終端的，改成限定在對應工作區（被移除 / 取回終端所屬工作區，或 active 工作區，依各處語意判斷並在回報區說明），沒有則 `null`（或保持原值，依語意）
2. **空狀態不閃**：工作區正在自動建立預設終端時，終端分頁不顯示空狀態（顯示不透明的空白底或既有 loading 樣式，不得回到透明，以免再透出其他工作區 —— BUG-134）。自動建立完成或失敗後，0 個終端才顯示空狀態。使用者主動關掉最後一個終端時仍立即顯示空狀態（T0531 行為不變）
3. 不改 T0531 的 CSS 隱藏規則

## 驗證

- 單元測試：各 focus fallback 不跨工作區（修正前紅、修正後綠）
- 單元 / source guard 或 e2e：預設終端建立中不渲染 `terminals-empty-state`；建立完成後不出現；關掉最後一個終端後出現
- `npm run typecheck` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- e2e 不回歸：`t0531-empty-workspace-view`、`detached-workspace`、`detached-terminal-persistence`（`--workers=1`）

## 驗收條件

- [x] focus fallback 全面不跨工作區，回報區列出改動的每個位置與語意
- [x] 新工作區首次開啟不閃空狀態，且不透出其他工作區
- [x] BUG-134 行為（關掉最後一個終端 → 空狀態）不回歸
- [x] BUG-135：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-135、T0531 回報區、BUG-134 根因
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。

**1. BUG-135 — focus fallback 盤點**（`src/stores/workspace-store.ts` 所有寫入 `focusedTerminalId` 之處）：

| 位置 | 原行為 | 處置 / 語意 |
|---|---|---|
| `replaceWorkspaceTerminals()`（`adoptDetachedWorkspaceTerminals` 內部，原 L912-914） | focus 終端在 detached 視窗被關掉 → **全域** `terminals[0]` | **改**：active 工作區的第一個終端，沒有則 `null`。focus 只對 active 工作區有意義（`WorkspaceView` 預設 focus effect 也只看 active）；被取回的工作區若是 active，結果即該工作區的第一個終端。focus 仍存在則照舊保留。adopt 流程、所有權釋放、save 佇列順序完全不動 |
| `removeWorkspace()` | 不動 focus：刪掉 active 工作區後 focus 指向已移除的終端，active 改為 `workspaces[0]` | **改**：active 工作區改變、或 focus 終端被移除 → `null`（與 `setActiveWorkspace()` 相同語意，之後由 `WorkspaceView` 預設 focus effect 選新 active 工作區的終端）；刪其他工作區時保留 focus |
| `archiveWorkspace()` | 不動 focus：封存 active 工作區後 focus 留在被封存工作區的終端 | **改**：active 工作區改變 → `null`（同 `setActiveWorkspace()`）；封存其他工作區時保留 |
| `addExternalTerminal()` | 一律 focus 新終端，落在非 active 工作區（T0523：塔台所屬工作區）時 focus 被帶離目前的工作區 | **改**：只有落在 active 工作區才搶 focus，否則保留原 focus。落在 active 工作區照舊（`t0523-dispatch-workspace` e2e 綠） |
| `applySerializedData()`（`workspace:reload` 帶資料 / `load()`） | 不動 focus：reload 後 focus 可能指向已不存在或其他工作區的終端 | **改**：只有 focus 仍是新 active 工作區的終端才保留，否則 `null` |
| `removeTerminal()` | T0531 已改為同工作區第一個 / `null` | 不動 |
| `setActiveWorkspace()` / `setActiveGroup()` | 切 active 時設 `null` | 不動（已正確） |
| `addTerminal()` | agent 終端或目前無 focus 時 focus 新終端 | 不動：呼叫端（`WorkspaceView` 本身工作區、`App.tsx` 用 `activeWorkspace`、Claude / Codex 面板的使用者操作）皆為 active 工作區，非 fallback |
| `setFocusedTerminal()` | 明確指定 | 不動 |

**2. 空狀態不閃**（`src/components/WorkspaceView.tsx`）：新增模組層 `creatingDefaultTerminals` Set + `isCreatingDefaults` state。init effect 在「啟用時 0 個終端」（將自動建立預設終端）時標記，`retryOnceWhenRemoteConnected(initTerminals…)` settle（完成或失敗，`.finally`）後清除。`awaitingDefaultTerminals = isCreatingDefaults || (isActive && !initializedWorkspaces.has(workspace.id))`，後半涵蓋 init effect 執行前的第一次 render（useEffect 在 paint 之後，原本這一幀就會畫出空狀態）。0 個終端時：`awaitingDefaultTerminals` → 不透明 placeholder `.terminals-pending-state`（`data-testid="terminals-pending-state"`，`background: var(--bg-primary)`，無按鈕）；否則 → T0531 空狀態。使用者關掉最後一個終端時工作區早已 initialized、不在建立中 → 立即顯示空狀態（T0531 行為不變）。T0531 的 CSS 隱藏規則未改。

### 修改檔案

- `src/stores/workspace-store.ts`：上表 5 處 focus 修正
- `src/components/WorkspaceView.tsx`：`creatingDefaultTerminals` / `isCreatingDefaults` / `awaitingDefaultTerminals`、placeholder、`renderTabContent` deps 加 `awaitingDefaultTerminals`
- `src/styles/layout.css`：`.terminals-pending-state`（新增，未動 T0531 規則）
- `src/stores/__tests__/workspace-store.focusFallback.test.ts`（新）：store 11 案例 + source guard 1 案例
- `src/stores/__tests__/workspace-store.adoptDetached.test.ts`：原斷言 `focusedTerminalId` = `a1`（全域第一個，正是 BUG-135 行為）改為 active 工作區 d 的 `d2`
- `src/stores/__tests__/workspace-store.removeTerminal.test.ts`：T0531 source guard 的 regex 跟上新條件 `!awaitingDefaultTerminals`
- `e2e/t0532-default-terminal-no-empty-flash.spec.ts`（新）：隔離實例，`createDefaultAgentTerminal: false`，MutationObserver 記錄切到新工作區期間掛上的空狀態 / placeholder
- `_ct-workorders/BUG-135-adopt-detached-focus-crosses-workspace.md`：FIXED、`fixed_at`、修正備註

### 驗證

| 項目 | 結果 |
|---|---|
| Landing check | PASS。C-0：`repo: better-agent-terminal` = basename `better-agent-terminal`；C-1 PASS；C-3 PASS（`src/stores/workspace-store.ts` 等存在）；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |
| store 單元測試修正前（store 暫換回 HEAD 版） | 🔴 6 failed / 6 passed：adopt fallback 2 案、removeWorkspace、archiveWorkspace、addExternalTerminal 非 active、reload（例 `expected '<other 工作區終端 id>' to be '<d2 id>'`） |
| store 單元測試修正後 | ✅ 12/12；相關 5 檔 33/33 |
| e2e 修正前（`WorkspaceView.tsx` 暫換回 HEAD 版再 build） | 🔴 FAILED：`{"empty":1,"pending":0}`，`Expected: 0 / Received: 1`（切到新工作區時空狀態被掛上） |
| e2e 修正後 `t0532-default-terminal-no-empty-flash` | ✅ PASS：`{"empty":0,"pending":1,"pendingBackgrounds":["rgb(30, 30, 30)"]}`（placeholder 不透明）、只建立 1 個終端、B 保持隱藏；關掉最後一個終端 → 空狀態立即出現 |
| `npm run typecheck` | ✅ exit 0 |
| `npx vite build` | ✅ exit 0（修正後重新 build） |
| `npm run test:unit` | ✅ 225 files / 3730 passed / 1 skipped |
| 回歸 e2e（`--workers=1`） | ✅ 9 passed：`t0532-default-terminal-no-empty-flash`、`t0531-empty-workspace-view`、`detached-workspace`、`detached-terminal-persistence`、`t0523-dispatch-workspace`、`t0530-detached-open-settings`、`detached-close-edges`、`detached-flush-on-close`（後兩檔共 3 tests） |
| `npm run typecheck:electron` | 未跑：未改 `electron/**` |

全程隔離實例（`--runtime=e2e-t0532-*`，userData 用完即刪），只有一般 shell 終端，未啟動 Claude / Codex，未碰使用者的 BAT。

### 偏差 / 備註

- 範圍：工單第 1 點字面是「會落到全域第一個終端的 fallback」，實際只有 `replaceWorkspaceTerminals` 一處。`removeWorkspace` / `archiveWorkspace` / `addExternalTerminal` / `applySerializedData` 不是取 `terminals[0]`，但同樣會讓 focus 留在 / 跳到 active 以外的工作區（或已移除的終端），屬 BUG-135 同類（snippet 貼上、Skills / Agents 面板指錯對象），依驗收「focus fallback 全面不跨工作區」一併修正（YOLO，breakpoint C 自行決定）。`addExternalTerminal` 的改動是行為變更：塔台派工落在非 active 工作區時不再搶 focus；切到該工作區時 `setActiveWorkspace` 本來就會清 focus，所以原本的搶 focus 沒有持續效果。
- remote 視窗斷線中（`retryOnceWhenRemoteConnected` 等待重連）視為「建立中」，維持 placeholder、不顯示「新增終端」按鈕；重連後建立預設終端，或第二次被拒 / 其他錯誤時才顯示空狀態。選這個語意是為了避免斷線期間按按鈕後，重連又自動建立預設終端而多開一個。
- 修正前紅的證據：以 `git show HEAD:<path> > <path>` 暫時覆蓋（修正版先備份到 scratchpad），跑完立即複製回來並確認 `git diff --stat`；`WorkspaceView` 那次另外重新 build，之後以修正版重新 build 再跑全部綠燈。未用 git stash / restore / checkout。
- 第一次套用 store 修改的 Bash 指令卡在一個多餘的 `cat >` 等 stdin（未寫入任何專案檔），已停止，並刪除它在 `/tmp/..` 建立的 0 byte 空檔，改用 Edit 套用。
- 新檔以 LF 寫入；既有檔工作副本為 CRLF（`core.autocrlf=true`，`.gitattributes` `eol=lf`），commit 時正規化，diff 只含本次變更行。

### Commit

- `8b5251a8` fix(workspace): T0532 keep focus fallback in the active workspace, no empty-state flash (BUG-135)（`--only`，未含 `src/styles/settings.css`；未 push）
