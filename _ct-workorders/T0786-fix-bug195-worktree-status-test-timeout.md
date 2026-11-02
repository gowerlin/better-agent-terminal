---
schema_version: 1
schema_kind: workorder
id: T0786
title: "BUG-195：`worktree-status-after-close.test.ts` 在整套 `test:unit` 下常逾時 —— 找出慢在哪裡，讓它在全套負載下穩定通過"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T16:57:24+0800"
started_at: "2026-11-02T16:58:55+0800"
updated_at: "2026-11-02T17:17:32+0800"
completed_at: "2026-11-02T17:17:32+0800"
session_ids:
  - "104f2fc1-6920-4d10-aa82-3a1129f4bb74"
depends_on: []
related:
  - "BUG-195（發生紀錄 4 次，`frequent`）；D225；T0589（這支測試的來源：Worker 分頁關閉後的 worktree 狀態查詢）；T0686（CI Test gate：`test:unit` 失敗即不發版）"
  - "`electron/__tests__/worktree-status-after-close.test.ts`（真的 git ＋ `PtyManager`，`vi.mock('electron')`）；`vite.config.ts` 的 `test` 區塊；CLAUDE.md「Frontend unit tests」節（fake timers 不要用 `vi.waitFor` 等規則）"
affects_files:
  - electron/__tests__/worktree-status-after-close.test.ts
  - "electron/__tests__/ct-worktree-status.test.ts（Q-1 塔台答覆 A 補入）"
  - "electron/__tests__/ct-worktree.test.ts（Q-1 塔台答覆 A 補入）"
  - "scripts/__tests__/dev-deploy-headless.test.mjs（Q-1 塔台答覆 A 補入）"
  - "_ct-workorders/_bug-tracker.md（memory_overrides 指定同步）"
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

- [x] 量測結果（哪一步慢、單檔 vs 整套）
- [x] 修法與理由
- [x] 修改前後的連跑結果、負載下結果
- [x] `typecheck:electron` = 0
- [x] BUG-195 FIXED、tracker 只動該列

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
- **塔台答覆 Q-1**：採 A，三檔一併處理，記在 BUG-195（經 BAT 問答通道 `q-99100c39-…` 收到，choice 1，2026-11-02 約 17:09）。條件：只動這三個測試檔、規則同本單；`affects_files` 補三檔；BUG-195 標題與內容改成涵蓋四檔；驗收改為整套 3 次 exit 0 ＋ 負載下 1 次 exit 0；修完若出現第五支以上逾時不再擴大、回報；不碰 T0785 的檔案，量測期間註明它可能造成額外負載。

### 完成狀態

- **狀態**：DONE（BUG-195 → FIXED）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 `affects_files` 前幾項都存在；不是 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN` 已設定。
- **session_id**：104f2fc1-6920-4d10-aa82-3a1129f4bb74

### 產出摘要

**量測（先量再改）**：在長測試 `live → exited → git (registered) → removed (branch only) → branch gone NOT_FOUND` 每一步之間暫時加計時（寫 JSONL 到系統暫存目錄，收尾已移除，`8de128de` 不含）。

- 單檔：約 60 個 git 程序依序執行（測試自己 24 個：makeRepo 4、worktree commit 2、snapshot 16、remove 1、branch -D 1；其餘是 `prepare` 與 handler 查詢走的 `CtWorktreeService`），每個 30–60 ms，總計 2.45–3.0 s。
- 整套：每一步都同比例變慢約 2–3 倍（例：makeRepo 153 → 905 ms、snapshot before 326 → 535–1702 ms、call git registered 489 → 644–1627 ms），**沒有單一慢步驟**；也沒有在等事件或 PtyManager spawn（fake node-pty，create ptys 1 ms）。單次查詢最長約 2.5 s，遠低於產品的 10 s 查詢上限 → 不是產品在負載下異常變慢，不需要改產品。

**修法**：
1. ① 縮短：`snapshot()` 從 4 個 git 程序改成 2 個（`status --porcelain=v2 --branch --untracked-files=all` 的 `# branch.oid` / `# branch.head` 已含 HEAD 與目前分支，加上 `for-each-ref`），比對內容不少於原本。長測試少 8 個 git 程序（約 13%），`ct-worktree-status.test.ts` 同樣處理。其餘 git 呼叫都是斷言或查詢本身需要的。
2. ② 只靠縮短不夠（整套下仍 6.8–14.4 s），所以替真 git / 真 bash 的 `describe` 設 `{ timeout: 30_000 }`，註解寫量到的最大值與 BUG-195：
   - `worktree-status-after-close.test.ts`：真 git `describe`（量到最大 14.4 s，30 s ≈ 2 倍）
   - `ct-worktree-status.test.ts`：`status (real git)`、`statusFromGit (real git)`（修改前最長 7.5 s，逾時）
   - `ct-worktree.test.ts`：`prepare (real git)`、`cleanup (real git)`（修改前最長 5.3 s，逾時）
   - `dev-deploy-headless.test.mjs`：`renderBashScript (WSL target)`（修改前最長 10.8 s，逾時；30 s 與每支腳本自己的 `execFileSync` timeout 相同）
3. 沒改產品程式碼與常數、`vite.config.ts` 全域 `testTimeout`，沒有 skip / retry。

**BUG-195**：`FIXED`，`fixed_at` / `fix_commit`（`8de128de`、`121df3e2`），標題改成涵蓋 4 檔，文末補〈T0786 結果〉。`_bug-tracker.md`：BUG-195 那一列從「⏳ 修復中」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則 `## ✅ 已修復`），FIXING 區段放回 `_（無）_` 佔位列，統計（frontmatter `breakdown` 與〈統計〉行）FIXING 1→0、FIXED 1→2，〈最後同步〉加一筆；其他列都沒動。

### 驗證

| 項目 | 結果 |
|---|---|
| 修改前：單檔 3 次 | 3/3 過（長測試 2.45–3.0 s） |
| 修改前：整套 `npm run test:unit` 3 次 | **3/3 exit 1**，本檔長測試 3 次都 `Test timed out in 5000ms`（檔案 7.2 / 8.0 / 8.7 s）；第 3 次另有 `ct-worktree-status` 逾時 1 個 |
| 只改本檔後：整套 3 次（`vitest run --reporter=verbose`，本檔暫時 60 s 量真實耗時） | 本檔 3/3 過（6.8 / 14.4 / 7.4 s），但 3 次都 exit 1：範圍外 `ct-worktree-status`、`ct-worktree`、`dev-deploy-headless` 逾時 → Q-1 |
| 4 檔都改完：整套 3 次（`vitest run --reporter=verbose`，與 `test:unit` = `vitest run` 相同） | **3/3 exit 0**（383 files / 6723 passed / 10 skipped）；本檔長測試 4.3 / 6.1 / 5.6 s，`ct-worktree-status` 最長 3.8 / 4.4 / 4.5 s，`ct-worktree` 2.0 / 3.1 / 2.5 s，`dev-deploy-headless` 1.6 / 2.3 / 4.1 s |
| 負載 1：`npm run test:unit` 同時在背景連跑 2 次 `npx vite build` | exit 0（兩次 build 都 exit 0，但 build 每次約 10 s，只蓋到測試前段）；本檔 7.2 s |
| 負載 2：兩個 `npm run test:unit` 同時跑 | **兩個都 exit 0**；本檔 10.6 / 10.4 s，`ct-worktree-status` 6.9 / 7.1 s，`dev-deploy-headless` 6.6 / 6.2 s，`ct-worktree` 6.0 / 5.0 s |
| `npm run typecheck:electron` | 0（exit 0）；`dev-deploy-headless.test.mjs` 是 `.mjs`，不在型別檢查範圍 |
| 修完後是否出現第五支以上逾時 | 沒有（4 次整套＋2 個並行，共 6 次全綠） |

註：所有整套量測期間，同一 checkout 有 T0785 Worker 並行工作，而且機器上還有其他 session，可能有額外負載（塔台 Q-1 答覆要求註明）。

### 遭遇問題

- 第一次加量測程式碼時，Python 產生的 TS 字串字面值裡的換行跳脫寫成真的換行，造成 transform 失敗，修正後重跑。只影響暫時的量測程式碼。
- 修改前的量測發現另外三支測試同樣會逾時（範圍外）→ Q-1 問塔台，答覆 A 後納入。

### 互動紀錄

- [17:08] Q-1：其他三支真 git / bash 測試在同一負載下也逾時，「整套 3 次都綠」要不要納入本單？ → A（塔台）：採 A，三檔一併處理，記在 BUG-195，附 5 個條件 → Action：補 `affects_files`、三檔照同一套規則修改、BUG-195 改成涵蓋 4 檔、驗收改成整套 3 次＋負載 1 次 exit 0（實際多跑了兩個並行的負載）。

### commit 狀態

- `8de128de` test(worktree-status)：snapshot 減 git 呼叫、真 git describe 30 s（本檔）
- `60efa2ae` chore：T0786 Q-1（工單）
- `121df3e2` test：其他 3 檔
- 收尾 commit：工單、BUG-195、`_bug-tracker.md`（`git commit --only`，見 git log）
- 沒有 push；沒碰 T0785 的檔案（`e2e/**`、`electron/remote/**`、`_ct-workorders/T0785-*`）。

### 回報時間

2026-11-02T17:17:32+0800
