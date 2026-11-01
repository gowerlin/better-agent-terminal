---
schema_version: 1
schema_kind: workorder
id: T0741
title: "修 BUG-180：剛開的分頁在 initial doResize 前被切走時，不得把 0x0 容器 fit 的尺寸（9x5）送給 PTY"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T17:46:06+0800"
started_at: "2026-11-01T17:46:55+0800"
updated_at: "2026-11-01T18:03:15+0800"
completed_at: "2026-11-01T18:03:15+0800"
session_ids:
  - "d7637d84-adb6-474f-91cd-5fefad5b6ad4"
depends_on: []
related:
  - "BUG-180（T0736 回報區〈發現的問題〉1：重現、debug log 順序）"
  - "CLAUDE.md「新 PTY 的初始尺寸（T0572 / BUG-145）」節：`requestPtySizeSync`、`lastSentCols` / `lastSentRows` 去重、背景分頁不 fit；`src/lib/pty-replay.ts`"
  - "`src/components/TerminalPanel.tsx` 約 1029–1035 行（掛載時 active → 100 ms 後 initial `doResize()`，到期沒再檢查 `isActiveRef.current`；同檔 ResizeObserver debounce 有檢查）"
  - "`src/__tests__/terminal-pty-size-sync.test.tsx`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（第 433 行附近記錄『before selecting it』尺寸）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/（只在把判斷抽成純函式時；例如 resize 前的守門）"
  - "src/**/__tests__/（新增 / 擴充測試）"
  - "e2e/（新增情境或擴充既有 spec；不改既有斷言的意圖）"
  - docs/agent-guide/
  - CLAUDE.md
  - _ct-workorders/BUG-180-new-tab-switched-away-pty-resized-9x5.md
  - _ct-workorders/T0741-fix-new-tab-hidden-pty-resize-9x5.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再修：以單元測試或 debug log 確認 9x5 確實來自 initial `doResize()`（或找出真正來源）。修正規則：① initial `doResize()` 到期時分頁已不 active → 不 fit、不送 `pty.resize`；② 任何 resize 路徑在容器寬或高為 0（或 fit 結果小於合理下限）時不送 `pty.resize`，也不更新 `lastSentCols` / `lastSentRows`（否則日後同尺寸會被去重擋掉）。把判斷寫成一處（純函式或 `doResize` 內的單一守門），不要在各呼叫點複製。"
  - "🔴 行為不變（R-G003 第 3 點）：T0572 / BUG-145 的 `requestPtySizeSync`（`created: true` 與 ⏻ restart 後重送尺寸、hidden 分頁等下次 activation 送出）、active 分頁正常 resize、切回分頁時恢復正確尺寸、ResizeObserver debounce 都不變。動工前列出相關已通過案例（`src/__tests__/terminal-pty-size-sync.test.tsx`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`、`e2e/t0698` 若有、`terminal-wheel-reports` 相關），改動後逐案確認，回報區列〈相關通過案例判定〉。T0736 spec 只記錄『before selecting it』尺寸、不以 9x5 為斷言前提的話照常應綠；若它有依賴 9x5 的步驟（例如先逐一選取分頁讓尺寸恢復），保留不改，只在回報區說明修正後該步驟是否仍需要。"
  - "🔴 build 錯開（重要）：T0737 Worker 正在同一個 checkout 以 `dist/` / `dist-electron/` 跑隔離實例 e2e。🔴 在 `_ct-workorders/T0737-*.md` frontmatter `status` 變成 DONE / PARTIAL / BLOCKED / FAILED 之前，不得執行 `npx vite build`、`npm run build*`、任何 e2e，也不得刪改 `dist*`。這段期間先做查證、修正、單元測試（`npm run test:unit` 可跑）、兩個 typecheck。之後才 build 與跑 e2e；等待時用 Monitor / 間隔檢查該檔，不要忙等。"
  - "🔴 驗證：新測試涵蓋『掛載 active → 100 ms 內變 hidden → 不送 resize』、『容器 0x0 → 不送 resize、不更新去重』、『切回 → 送正確尺寸』；e2e：在 T0736 的重現方式上（連點「+」開兩個分頁）斷言前一個分頁在被選取前的 PTY 尺寸不是 9x5（維持 spawn 120x30 或先前的正常尺寸），選取後是 fit 尺寸；`e2e/t0572-new-pty-initial-size.spec.ts` 綠。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。完成後 BUG-180 改 FIXED（附 commit）。CLAUDE.md「新 PTY 的初始尺寸」節只補一句規則與唯一實作位置，細節寫 docs（遵守檔頭撰寫規則）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0741 — 修 BUG-180：剛開分頁被切走時 PTY 變 9x5

## 元資料

- **工單編號**：T0741
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T17:46:06+0800
- **預估規模**：S

## 背景

T0736（pre.8 自動驗收）發現：從「+」連續開分頁時，前一個分頁的 PTY 被 resize 成 9x5，直到切回才恢復（BUG-180）。推測 `TerminalPanel.tsx` 掛載時排的 100 ms initial `doResize()` 到期沒再檢查 active，對已隱藏的 0x0 容器 fit。使用者指示現在開單修。

## 範圍

1. 查證來源並修正（單一守門）。
2. 單元測試與 e2e。
3. BUG-180 → FIXED；CLAUDE.md 一句、docs。

## 不做

- 不改背景分頁不 fit 的既有設計、不改 T0572 的尺寸同步。
- 不處理 Terminal Server recovery 以 120x30 重建的既有已知限制。

## 驗收

- [x] 9x5 來源查證結果
- [x] 新測試與 e2e 綠；〈相關通過案例判定〉
- [x] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [x] build / e2e 在 T0737 結案後才執行（回報區記錄時間）

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `src/components/TerminalPanel.tsx` 存在（其餘為說明文字或萬用路徑）；無 `branch` 欄位（C-2 不適用）；`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- **commit**：產品 `4500984d`（`fix(terminal): do not fit or resize the PTY of a hidden tab (T0741, BUG-180)`）；工單與 BUG-180 另一個 commit（本次收尾）。未 push。
- **session_id**：d7637d84-adb6-474f-91cd-5fefad5b6ad4

#### 9x5 來源查證

- 推測成立，並補上確切的數字來源：
  1. `TerminalPanel.tsx` 掛載時 active → 100 ms 後 initial `doResize()`，到期沒有再檢查 `isActiveRef.current`（ResizeObserver debounce、`requestPtySizeSync` sink、設定變更都有檢查）。
  2. 隱藏分頁在 `.terminal-wrapper.hidden`（`display: none`，`src/styles/layout.css`）。FitAddon 0.10.0 `proposeDimensions` 以 `getComputedStyle(parent)` 取高寬；沒有被繪製的元素回傳宣告值 `100%`，`parseInt('100%')` = 100 px，扣掉 `.xterm` padding 8 px × 2 與捲軸 ≈ **9 × 5**。`fit()` 先把 xterm 自己 resize 成 9x5，`doResize` 再送給 PTY。
- 證據：e2e 在**未修正**的 build（暫時把兩個守門改成 `false &&`、重 build）三輪都記到第一個分頁 `pty:resize ["137x35","9x5"]`，選取後 `137x35`，與 BUG-180 的 T0736 紀錄相同；還原修正重 build 後三輪都沒有 9x5。

#### 修正

- `src/lib/terminal-fit-guard.ts` `canFitTerminalContainer(box)`（純函式，單一判斷）：寬或高 ≤ 0、或不是有限數字 → false。
- `src/components/TerminalPanel.tsx`：
  - `doResize` 開頭以 `containerRef.current.getBoundingClientRect()` 呼叫守門；false → 不 fit、不送 `pty.resize`、不動 `lastSentCols` / `lastSentRows`（記 `[resize] skipped (container has no size)`）。所有 resize 路徑都經 `doResize`。
  - 手動重繪 `terminal-redraw`：在 `terminal.resize(cols + 1, …)` 之前呼叫同一守門（否則隱藏分頁會停在多一欄）。
  - initial resize 計時器到期時已不 active → 不做（記 `[resize] initial doResize skipped (no longer active)`）；unmount 時清除計時器。
- 沒有加「fit 結果小於下限」的檢查：守門在 fit 之前，0x0 容器已攔下；有版面尺寸的小視窗照常 fit（不改既有行為）。

#### 變更檔案

- `src/lib/terminal-fit-guard.ts`（新）、`src/lib/__tests__/terminal-fit-guard.test.ts`（新）
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-pty-size-sync.test.tsx`（加版面尺寸 stub `getBoundingClientRect` + T0741 區塊 3 案）
- `e2e/t0741-hidden-new-tab-pty-size.spec.ts`（新）
- `CLAUDE.md`「新 PTY 的初始尺寸（T0572 / BUG-145）」節補一條（規則 + 唯一實作位置 + docs 連結）
- `docs/agent-guide/new-pty-initial-size.md`（新）、`docs/agent-guide/README.md`（索引一列）
- `_ct-workorders/BUG-180-new-tab-switched-away-pty-resized-9x5.md` → `FIXED`（`fixed_in: T0741 4500984d`，附修正與待驗收段落）

#### 驗證

| 項目 | 結果 |
|---|---|
| 新單元測試（掛載 active → 100 ms 內 hidden → 不 fit 不送；切回送 fit 尺寸；容器 0x0 → `requestPtySizeSync` / 重繪都不送、xterm 不變、去重不動、恢復後送出；寬或高單獨 0） | PASS；拿掉修正時 3 案全部失敗（突變檢查） |
| `npm run test:unit` | PASS — 358 檔、6331 passed / 3 skipped |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功（17:57 起，T0737 結案後） |
| e2e `t0741-hidden-new-tab-pty-size` | PASS（3 輪，前一個分頁選取前 `137x35`、選取後 = active 分頁的 `137x35`）；未修正 build FAIL（9x5） |
| e2e `t0572-new-pty-initial-size` | PASS（還原 137x35、新分頁 ×4 136x35、⏻ 重啟 136x35，PTY = xterm） |
| e2e `t0571-shift-right-click-copy`（active 分頁重繪） | PASS |
| e2e `v072-pre8-workspace-waiting-real-agents`（T0736） | PASS；記到 `137x35 before selecting it, 137x35 after`（修正前 9x5） |

- **build / e2e 時間**：T0737 `status: DONE`（`completed_at` 2026-11-01T17:56:31+0800），本工單 17:56:53 確認後才開始 `npx vite build` 與 e2e；之前只做查證、修正、`test:unit`、兩個 typecheck。

### 相關通過案例判定

| 案例 | 判定 |
|---|---|
| `src/__tests__/terminal-pty-size-sync.test.tsx` T0572 七案（created 重送、created:false 不重送、⏻ restart、restart→create、hidden 等下次 activation、一般 resize 去重、unmount 丟棄） | 不變：測試加了「容器有版面尺寸」的 stub（jsdom 不排版），斷言未改，全過 |
| `e2e/t0572-new-pty-initial-size.spec.ts` | 不變，PASS |
| `e2e/v072-pre8-workspace-waiting-real-agents.spec.ts` | PASS。它「逐一選取分頁讓尺寸恢復」的步驟（約 421–434 行，`>40` 欄斷言）修正後已不需要（選取前就是 137x35），依工單保留不改；該段註解仍描述修正前的 9x5，建議日後順手更新 |
| `e2e/t0571-shift-right-click-copy.spec.ts`（active 分頁 `terminal-redraw`） | 不變，PASS |
| `terminal-wheel-reports` 相關（`src/lib/__tests__/terminal-wheel-reports.test.ts` 等） | 不受影響（不經 resize 路徑），`test:unit` 全過；`e2e/t0698` 不存在 |
| `terminal-gpu-crash-redraw.test.tsx` 的 isActive effect source guard | 該 effect 未改動，PASS |

結論：沒有任何已通過案例的預期結果改變。

### 遭遇問題

1. e2e 第一版用「+」→ Terminal（shell）在未修正 build 上也通過，重現不到：`handleAddTerminal` 在 `await getShellFromSettings()` 之後才 `setFocusedTerminal`，shell 分頁以 hidden 掛載、不排 initial timer。只有先 focus 再 await 的項目（Claude CLI、以塔台開啟 Claude、Claude CLI worktree）走得到 bug。改用 T0736 的 Claude CLI → 以塔台開啟 Claude 組合（暫存 home、API / proxy 指向 `127.0.0.1:9`），以主行程 `[resize] pty:resize` 日誌量測，確認未修正 build 失敗、修正後通過。已寫進 docs。
2. 暫存 home 時 Electron 需要 `AppData\Roaming` 等已知資料夾，否則 `Failed to get 'userData' path`（比照 T0736 spec 建立）。
3. 突變檢查以暫時修改 `TerminalPanel.tsx`（`false &&`）並從暫存備份複製還原，未使用 git stash / checkout；還原後 grep 確認無殘留、重 build 再驗。

### 後續建議（給塔台）

- `_bug-tracker.md` 的 BUG-180 列仍是 OPEN：索引不在本工單 `affects_files`，請塔台同批更新（R-G003 第 4 點）。
- BUG-180 隨下一個預覽版待驗收（實機連開 Claude CLI 與以塔台開啟 Claude，切回前 TUI 不以 9 欄繪製），驗收後 CLOSED。
- 選擇性：`v072-pre8` spec 的 9x5 註解可更新（本單依指示未改）。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

2026-11-01T18:03:15+0800
