---
schema_version: 1
schema_kind: workorder
id: T0531
title: "空工作區主畫面殘留其他 / 已關閉終端畫面（BUG-134）：找根因並修正"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-134
priority: P2
sizing: M
created_at: "2026-10-15T01:16:21+0800"
started_at: null
updated_at: "2026-10-15T01:16:21+0800"
completed_at: null
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

- [ ] 根因說明（情境 a / b 是哪一種，以及為何無法操作）
- [ ] 關閉工作區全部終端後，主畫面為空狀態，切到其他工作區再切回來也一樣
- [ ] 新增終端仍正常顯示，其他工作區的終端不受影響
- [ ] BUG-134：`status: FIXED`、`fixed_at`、body 狀態列同步（PARTIAL 時保持 FIXING，寫明要補的 log）

## Sub-session 執行指示

1. 讀本工單、BUG-134（含截圖）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 分析 → 重現 → 修正 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

### 修改檔案

### 驗證

### 偏差 / 備註

### Commit
