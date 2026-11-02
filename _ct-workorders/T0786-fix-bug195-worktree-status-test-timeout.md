---
schema_version: 1
schema_kind: workorder
id: T0786
title: "BUG-195：`worktree-status-after-close.test.ts` 在整套 `test:unit` 下常逾時 —— 找出慢在哪裡，讓它在全套負載下穩定通過"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T16:57:24+0800"
started_at: "2026-11-02T16:58:55+0800"
updated_at: "2026-11-02T17:08:46+0800"
tower_question: open
depends_on: []
related:
  - "BUG-195（發生紀錄 4 次，`frequent`）；D225；T0589（這支測試的來源：Worker 分頁關閉後的 worktree 狀態查詢）；T0686（CI Test gate：`test:unit` 失敗即不發版）"
  - "`electron/__tests__/worktree-status-after-close.test.ts`（真的 git ＋ `PtyManager`，`vi.mock('electron')`）；`vite.config.ts` 的 `test` 區塊；CLAUDE.md「Frontend unit tests」節（fake timers 不要用 `vi.waitFor` 等規則）"
affects_files:
  - electron/__tests__/worktree-status-after-close.test.ts
  - _ct-workorders/BUG-195-worktree-status-after-close-test-timeout-under-load.md
  - _ct-workorders/T0786-fix-bug195-worktree-status-test-timeout.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先量再改：單檔與整套各跑數次，記錄這支測試（尤其 `live → exited → git (registered) → removed (branch only) → branch gone NOT_FOUND`）每一步的耗時（例：暫時加計時、或 vitest `--reporter=verbose`），找出整套負載下哪一步變慢（git 子程序、worktree add / remove、PtyManager spawn、等待某個事件）。量測用的暫時程式碼收尾移除。"
  - "🔴 修法優先序：① 縮短不必要的工作（例：重複的 git 呼叫、可共用的 repo 準備、可並行的步驟）；② 若慢是 git / 子程序在負載下的固有成本，替這支測試（或這個 `describe`）設明確且合理的 timeout（例 `{ timeout: 20_000 }`），並在程式碼註解寫明依據（量到的最大值與 BUG-195）。🔴 不得改產品程式碼或產品常數（含 `electron/ct-worktree.ts`、`worktree-status-handlers.ts`、結束紀錄的 10 分鐘 / 32 筆）；不得改全域 `testTimeout`（`vite.config.ts`）；不得把測試標成 skip / retry 來掩蓋。若根因其實在產品程式碼（例：某個查詢在負載下真的變慢到影響使用者），停下回報 PARTIAL 並說明，不自行改產品。"
  - "🔴 驗證：修改後 `npm run test:unit` 整套連跑 3 次都綠（記錄每次這支測試的耗時）；再在有負載的情況下跑 1 次（例：同時跑 `npx vite build` 或另一個 `test:unit`，寫明怎麼造負載）也綠。修改前的失敗率也要記錄（例：修改前連跑 3 次的結果），作為對照。`npm run typecheck:electron` = 0。"
  - "🔴 BUG-195：修好後狀態改 `FIXED`、加 `fixed_at` / `fix_commit`，文末補〈T0786 結果〉（根因、修法、量測數據）；同步更新 `_bug-tracker.md`（從 Open 移到「✅ 已修復」區段，區段標題照 `_local-rules.md` 的 parser 規則；只動 BUG-195 這一列，🔴 不要用會一次換掉多個區段佔位列的全檔替換）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。同一 checkout 有 T0785 並行（改 `electron/remote/**`），不得碰它的檔案。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0786 — BUG-195：worktree-status-after-close 測試逾時

## 元資料

- **工單編號**：T0786
- **類型**：implementation（測試穩定性）
- **優先級**：P2
- **建立時間**：2026-11-02T16:57:24+0800
- **預估規模**：S

## 背景

`electron/__tests__/worktree-status-after-close.test.ts` 在整套 `test:unit` 下常超過 vitest 預設 5 s（2026-11-02 一天 4 次，其中 2 次機器沒有其他工作），單檔重跑都過。CI 的 Test gate（T0686）遇到它會擋發版。使用者決定在發 `0.7.3-pre.7` 前修掉（D225）。

## 範圍

1. 量測每一步耗時，找出負載下變慢的地方。
2. 依優先序修（先縮短、必要時才設這支測試的 timeout）。
3. 驗證：修改前後連跑對照、負載下 1 次。
4. BUG-195 → FIXED、tracker 同步。

## 不做

- 不改產品程式碼與常數、不改全域 timeout、不 skip / retry。

## 驗收

- [ ] 量測結果（哪一步慢、單檔 vs 整套）
- [ ] 修法與理由
- [ ] 修改前後的連跑結果、負載下結果
- [ ] `typecheck:electron` = 0
- [ ] BUG-195 FIXED、tracker 只動該列

---

## 回報區

> 以下由 sub-session 填寫

### 待塔台決策

#### Q-1：同一負載下其他三支真 git 測試也逾時 —— 驗收「整套連跑 3 次都綠」要不要把它們納入本單？
- **提問時間**：2026-11-02T17:08:46+0800
- **現況**：本檔已修（`8de128de`：snapshot 從 4 個 git 程序減為 2 個；真 git 的 `describe` 設 `{ timeout: 30_000 }`）。修改後 3 次整套這支都綠（6.8 / 14.4 / 7.4 s），但 3 次整套都 exit 1，失敗的是範圍外的其他測試，同樣是預設 5 s 逾時：
  - `electron/__tests__/ct-worktree-status.test.ts`（real git 的 4 個 it；第 1 次 1 個、第 2 次 4 個；修改前第 3 次也有 1 個）
  - `electron/__tests__/ct-worktree.test.ts` › `dispatch again → reused, not rebuilt; base = fork point`（第 2 次）
  - `scripts/__tests__/dev-deploy-headless.test.mjs` › `deploy + rollback round-trip through the generated script`（第 2、3 次，最長 10.8 s）
  - 原因相同：真 git／子程序在 24 核全套平行負載下每個呼叫均勻變慢（這段期間 T0785 也在同一 checkout 工作）。
- **選項**：
  - A. 擴大範圍：對這三檔做同樣處理（先減不必要的 git 呼叫，再替真 git 的 `describe` 設明確 timeout 並註明量測依據），一併記在 BUG-195，再跑整套 3 次＋負載 1 次。
  - B. 不擴大：本單只驗本檔（整套 3 次這支都綠、其他失敗列為範圍外），另開 BUG／工單處理其他三檔。
  - 其他。
- **建議**：A。同一根因、同一種修法，而且發 `0.7.3-pre.7` 前 CI Test gate 也可能被它們擋下；分開處理要多一輪派工。每檔只動測試檔，不改產品程式碼與全域 `testTimeout`。
- **影響**：A → `affects_files` 多三個測試檔，預估多 20–30 分鐘；B → 本單可以直接收尾。
- **是否阻擋後續步驟**：是（驗證步驟「整套連跑 3 次都綠」要依答覆決定判準）。

### 完成狀態

### 產出摘要

### 驗證

### 遭遇問題

### 互動紀錄

### commit 狀態

### 回報時間
