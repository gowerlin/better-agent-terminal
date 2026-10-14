---
schema_version: 1
schema_kind: workorder
id: T0531
title: "空工作區主畫面殘留其他 / 已關閉終端畫面（BUG-134）：找根因並修正"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-134
priority: P2
sizing: M
created_at: "2026-10-15T01:16:21+0800"
started_at: "2026-10-15T01:17:39+0800"
updated_at: "2026-10-15T01:27:22+0800"
completed_at: "2026-10-15T01:27:22+0800"
target_version: "0.6.0-pre.11"
related:
  - BUG-134
  - "BUG-127 / T0521（切換工作區時的指揮塔 toast，同屬工作區切換顯示）"
affects_files:
  - src/components/WorkspaceView.tsx
  - src/components/MainPanel.tsx
  - src/components/TerminalPanel.tsx
  - src/components/ThumbnailBar.tsx
  - src/App.tsx
  - src/stores/workspace-store.ts
  - src/styles/
  - src/components/__tests__/
  - src/stores/__tests__/
  - e2e/
  - _ct-workorders/T0531-empty-workspace-stale-terminal-view.md
  - _ct-workorders/BUG-134-empty-workspace-shows-other-terminal.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 token：e2e 用一般 shell 終端或自訂 CLI 跑 node 腳本，不啟動真的 Claude / Codex。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 Detached 視窗持久化規則與工作區層級 Agent 規則不得破壞（CLAUDE.md 對應章節）。"
---

# T0531 — 空工作區主畫面殘留終端畫面（BUG-134）

## 背景

外部使用者回報（詳見 **BUG-134**，含截圖路徑）：把工作區「臺灣土地銀行」的終端全部關掉後，主畫面仍顯示一個 `Claude CLI` 終端的完整畫面。回報者認為那是另一個工作區（better-agent-terminal）的終端，但也可能是本工作區剛關掉的終端殘影。畫面無法操作，看起來像當機；下方縮圖列是空的；按 `+` 新增終端後就恢復正常。

使用者指示：**先從程式碼分析，找不出來再補 log**。

## 任務

1. **根因分析**（從程式碼）：工作區的終端數變成 0 時，主畫面選哪個終端來顯示？
   - 查 active / focused terminal 的選取與 fallback（例如以全域終端清單、上一個 focus id、其他工作區的終端做 fallback）
   - 查終端 DOM / xterm 實例在關閉或切換工作區時的保留與隱藏方式（例如 `display:none` / `visibility`）。關閉最後一個終端後，是否有其他工作區的終端容器變成可見，或已 dispose 的 xterm 畫面沒有卸載
   - 分辨兩種情境：(a) 顯示的是**其他工作區**的終端；(b) 顯示的是**本工作區已關閉**終端的殘影。並說明「無法操作」的原因
   - 也要涵蓋「關閉的是塔台終端」或「Agent 預設終端」這類特殊終端時的分支（回報者說可能是「預設 Agent 的啟動畫面」）
2. **重現**：寫隔離實例 e2e（需先跑 `npx vite build`）。建兩個工作區，每個各有終端；切到 A，關閉 A 的全部終端，斷言主畫面不顯示任何終端內容（或顯示空狀態），也不顯示 B 的終端。用一般 shell 終端就能重現時不用 Claude；若只有 agent 終端才會觸發，改用自訂 CLI 跑 node 腳本，不耗 token。
3. **修正**：工作區終端數為 0 時，主畫面要顯示空狀態（可沿用既有空狀態 UI；沒有的話給「新增終端」提示，三語 i18n），不得顯示其他工作區或已關閉的終端。若根因牽涉 store 的 active terminal 選取，在 store 修正並補單元測試。
4. **找不出根因**：整理出要向回報者要的 log 項目（debug log 的哪些 tag / 時間點、`bat-scripts.log` 是否相關、截圖要拍什麼），回報 PARTIAL，不要猜修。

## 驗證

- 新增單元測試 / source guard 守住「空工作區不顯示其他終端」
- e2e：修正前紅（盡量在回報區記錄修正前失敗的證據）、修正後綠
- `npm run typecheck` = 0（改 electron 時加 `npm run typecheck:electron` = 0）、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- 工作區切換相關的既有 e2e 不回歸（挑相關 spec，例如 detached / workspace 切換 / `t0523-dispatch-workspace`，不跑全套）

## 驗收條件

- [x] 根因說明（情境 a / b 是哪一種，以及為何無法操作）
- [x] 關閉工作區全部終端後，主畫面為空狀態，切到其他工作區再切回來也一樣
- [x] 新增終端仍正常顯示，其他工作區的終端不受影響
- [x] BUG-134：`status: FIXED`、`fixed_at`、body 狀態列同步（PARTIAL 時保持 FIXING，寫明要補的 log）

## Sub-session 執行指示

1. 讀本工單、BUG-134（含截圖）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 分析 → 重現 → 修正 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。根因從程式碼找到並以隔離實例 e2e 重現（修正前紅、修正後綠），不需要向回報者要 log。

**根因 = 情境 (a)，其他工作區的終端**（不是本工作區已關閉終端的殘影：關閉的終端 React 元件卸載、DOM 移除）：

1. 已造訪的工作區都保持掛載，隱藏工作區用 `.workspace-container.hidden { visibility: hidden; pointer-events: none }`（`src/styles/layout.css`）。`visibility` 可被子元素覆寫，`.workspace-tab-panel.active { visibility: visible; pointer-events: auto }` 把每個隱藏工作區的 active 分頁面板翻回可見 ⇒ 隱藏工作區的終端分頁一直在畫，只是被 active 工作區（`z-index: 1`）蓋住。e2e 實測：A active、B 隱藏時，B 的 `.main-panel` computed visibility = `visible`。
2. active 工作區 0 個終端時 `.terminals-container` 透明，底下隱藏工作區的 active 終端透出來。多個隱藏工作區時 DOM 順序最後（側欄最下面）的畫在最上層，與回報者看到 better-agent-terminal 一致；塔台 BUG-134 也記錄了使用者 pre.10 本機重現為情境 (a)。
3. **無法操作**：點擊命中上層 active 工作區那個空的 `.terminals-container`（e2e `elementFromPoint(center)` = `terminals-container in workspace-container active`），鍵盤 focus 也不在隱藏工作區的 xterm。按 `+` 後新終端（有背景）蓋過去，所以「恢復正常」。
4. 塔台 / Agent 預設終端：沒有特殊分支。`mainTerminal = focusedTerminal || agentTerminal || terminals[0]` 只在本工作區的 `terminals` 內選；透出來的是哪種終端，只取決於那個隱藏工作區當時的 active 終端（回報截圖是 `Claude CLI` 塔台分頁）。
5. 附帶缺陷（store）：`removeTerminal()` 關掉 focus 終端時 fallback 到**全域** `terminals[0]`，關掉工作區最後一個終端後 `focusedTerminalId` 指向其他工作區的終端（snippet 貼上 `handleSnippetPasteToTerminal`、Skills / Agents 面板 active session 等會指錯對象；之後按 `+` 加一般終端時 `addTerminal` 也因 focus 非空而不搶 focus）。不是畫面殘留的成因，依工單第 3 點在 store 修正並補單元測試。

**修正**：
- CSS：`.workspace-container.hidden .workspace-tab-panel.active { visibility: hidden; pointer-events: none }`，隱藏工作區內的 active 分頁不再繪製、不收點擊。
- UI：`WorkspaceView` 終端分頁在 0 個終端時渲染不透明空狀態 `.terminals-empty-state`（`data-testid="terminals-empty-state"`，`background: var(--bg-primary)`），文字 `terminal.emptyWorkspace` + 「新增終端」按鈕（`terminal.addTerminal`，呼叫既有 `handleAddTerminal`），三語 i18n。
- store：`removeTerminal` 的 focus fallback 限同工作區的第一個終端，沒有則 `null`（之後由 `WorkspaceView` 既有的「Set default focus」effect 處理）。

### 修改檔案

- `src/styles/layout.css`：隱藏工作區 active 分頁規則 + `.terminals-empty-state` 樣式
- `src/components/WorkspaceView.tsx`：終端分頁空狀態（`renderTabContent` deps 加 `handleAddTerminal`）
- `src/stores/workspace-store.ts`：`removeTerminal` focus fallback 限同工作區
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`：`terminal.emptyWorkspace`、`terminal.addTerminal`
- `src/stores/__tests__/workspace-store.removeTerminal.test.ts`（新）：store 3 案例 + source guard 2 案例（CSS 規則、空狀態）
- `e2e/t0531-empty-workspace-view.spec.ts`（新）：隔離實例，兩工作區各一個一般 shell 終端
- `_ct-workorders/BUG-134-empty-workspace-shows-other-terminal.md`：FIXED、`fixed_at`、根因段、修正備註

### 驗證

| 項目 | 結果 |
|---|---|
| Landing check | PASS。C-0：`repo: better-agent-terminal` = basename `better-agent-terminal`；C-1 PASS；C-3 PASS（`src/components/WorkspaceView.tsx` 等存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |
| e2e 修正前（CSS 規則暫時失效） | 🔴 FAILED：`expect(panelB).toBeHidden()` → `Received: visible`（A active 時隱藏工作區 B 的終端面板 computed visibility 為 visible） |
| e2e 修正前視覺探測（CSS 規則 + 空狀態都暫時失效，臨時 spec 跑完即刪） | 重現回報畫面：側欄 active = T0531-A、縮圖列空、主畫面顯示 `T0531 shell B`；hidden panels visibility=`["visible"]`；`elementFromPoint(center)` = `terminals-container in workspace-container active`（無法操作的原因）。截圖存 scratchpad `t0531-before-fix.png`（未入庫） |
| e2e 修正後 `e2e/t0531-empty-workspace-view.spec.ts` | ✅ PASS：關閉 A 最後一個終端 → 空狀態、B 隱藏（hidden panels visibility=`["hidden"]`）；切 B 再切回 A 仍為空狀態；空狀態按鈕新增終端正常顯示，B 的終端不受影響 |
| store 單元測試修正前 | 🔴 2 failed（`expected '<B 的終端 id>' to be null` 等），修正後 5/5 PASS |
| `npm run typecheck` | ✅ exit 0 |
| `npx vite build` | ✅ exit 0（修正後重新 build） |
| `npm run test:unit` | ✅ 224 files / 3718 passed / 1 skipped |
| 相關 e2e（`--workers=1`） | ✅ 5 passed：`t0531-empty-workspace-view`、`detached-workspace`、`detached-terminal-persistence`、`t0523-dispatch-workspace`、`t0530-detached-open-settings` |
| `npm run typecheck:electron` | 未跑：未改 `electron/**` |

全程用隔離實例（`--runtime=e2e-t0531-*`，userData 用完即刪），一般 shell 終端，未啟動 Claude / Codex。

### 偏差 / 備註

- e2e 第一次試跑時種子工作區沒有 `folderPath`，`toTerminalInstance` 丟棄種子終端，隔離實例依預設 agent 建了一個 Claude Agent V1 分頁；因 cwd 為空立即報錯 `Cannot start session: invalid cwd "(empty)"`，**沒有啟動 session、沒有耗 token**。已補 `folderPath` / `cwd`，之後各次執行只有 shell 終端。
- 修正前紅的證據是用「暫時讓 CSS 規則 selector 失效 / 暫時把空狀態條件改成 `false &&`」再 build 取得，之後以 Edit / sed 還原（未用 git stash / restore），還原後重新 build 並跑綠；`git diff` 確認無殘留 probe。
- `src/styles/layout.css` 工作副本原為 CRLF（index LF，`.gitattributes` `eol=lf`），commit 時正規化，diff 只含本次新增行。
- 殘留：全新工作區第一次啟用時，在預設終端建立完成前（非同步取 shell 路徑）可能短暫看到空狀態；之前同一時段是透明（可能透出其他工作區）。
- 後續建議（未改，範圍外）：`workspaceStore.adoptDetached()` 的 focus fallback 同樣是全域 `terminals[0]`（`src/stores/workspace-store.ts` 約 L908），可比照本單改為限 active 工作區。

### Commit

- `d41280ae` fix(workspace): T0531 keep hidden workspaces from showing through an empty one (BUG-134)（`--only`，未含 `src/styles/settings.css`；未 push）
