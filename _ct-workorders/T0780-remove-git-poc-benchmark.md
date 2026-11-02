---
schema_version: 1
schema_kind: workorder
id: T0780
title: "PLAN-029 R3：刪除沒有被引用的 `src/components/git-poc/`（T0154 benchmark）與 `vite.config.benchmark.ts`"
type: implementation
status: DONE
started_at: "2026-11-02T14:10:29+0800"
updated_at: "2026-11-02T14:14:27+0800"
completed_at: "2026-11-02T14:14:27+0800"
session_ids:
  - "35a2dc0c-be2e-45f3-b111-a432346b7d59"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T14:07:33+0800"
depends_on: []
related:
  - "PLAN-029 R3（選項 C：直接刪除）；D221；T0154（git GUI benchmark，`7844e895`，2026-04-17）；T0303 / T0304（BUG-069 audit，indexBench.ts 的 misplaced require）"
  - "塔台 2026-11-02 grep 核對：`GitPocPlaceholder` 沒有被引用；benchmark 不在任何 build entry；`vite.config.benchmark.ts` 沒有任何 npm script 使用；`SvgCommitGraph` / `useVirtualizer` 已於 T0154 搬到 `src/components/git-panel/`"
affects_files:
  - "src/components/git-poc/**（刪除）"
  - vite.config.benchmark.ts
  - .gitignore
  - _ct-workorders/PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md
  - _ct-workorders/T0780-remove-git-poc-benchmark.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 刪除前先自己再確認一次沒有引用：`git grep -n \"git-poc\"`、`git grep -n \"vite.config.benchmark\"`、`git grep -n \"GitPocPlaceholder\"`（排除 `_ct-workorders/` 與被刪目錄本身）；`package.json` scripts、`tsconfig*.json`、ESLint 設定、`vite.config.ts`、`electron-builder` 設定、`.github/workflows/` 都不得引用。有任何真正的引用（不是註解）→ 停下，回報 PARTIAL，不刪。"
  - "🔴 只刪 git 追蹤的檔案：用 `git rm -r src/components/git-poc` 與 `git rm vite.config.benchmark.ts`。被 `.gitignore` 擋住的本機產物（`_bench-trace-*.json` 約 210 MB、`_bench-index-result.json`）**不得刪除**，那是使用者的本機檔案。"
  - "🔴 `.gitignore` 第 37–38 行（`src/components/git-poc/benchmark/_bench-trace-*.json`、`_bench-index-result.json`）：若那兩類本機檔案仍存在 → **保留這兩行**（否則它們會變成未追蹤檔），在回報寫明檔案仍在、使用者可自行刪除後再移除這兩行；若都不存在 → 一併刪除這兩行。"
  - "🔴 `src/components/git-panel/SvgCommitGraph.tsx`、`useVirtualizer.ts` 檔頭的「Migrated from `src/components/git-poc/...` (T0154)」註解是歷史紀錄，**保留不改**。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功、`node scripts/verify-renderer-imports.js` 綠。不跑 e2e（只刪死碼）。"
  - "🔴 PLAN-029：本單完成後在 PLAN-029 文末補〈T0780 結果〉（刪了哪些、`.gitignore` 怎麼處理），並把 frontmatter `status` 改 `DONE`、加 `completed_at`（R5 已由 T0309 完成，R3 由本單完成）。不改 `_backlog.md`（塔台收單時更新）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 自己改的檔案（含 `git rm` 的路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0780 — PLAN-029 R3：刪除 `src/components/git-poc/`

## 元資料

- **工單編號**：T0780
- **類型**：implementation（清理死碼）
- **優先級**：P3
- **建立時間**：2026-11-02T14:07:33+0800
- **預估規模**：S
- **派工順序**：先於 T0779（兩張都要 build，不並行）

## 背景

PLAN-029 的 R5（setup-wizard 獨立 chunk）已由 T0309 完成，只剩 R3：`src/components/git-poc/benchmark/indexBench.ts` 在 `src/` 下用 `require`，但沒有被 renderer entry 引用。塔台 2026-11-02 核對後發現整個 `src/components/git-poc/` 都是 T0154（2026-04-17）的 benchmark 殘留，沒有任何地方引用；`vite.config.benchmark.ts` 也沒有 script 使用。使用者決定採選項 C 直接刪除（D221）。

## 範圍

1. 再確認無引用（規則見 frontmatter）。
2. `git rm -r src/components/git-poc`、`git rm vite.config.benchmark.ts`。
3. `.gitignore` 第 37–38 行依本機檔案是否存在決定保留或刪除。
4. 驗證；PLAN-029 補結果並改 DONE。

## 不做

- 不刪被 `.gitignore` 擋住的本機產物；不改 `src/components/git-panel/` 的歷史註解；不動其他 PLAN-029 範圍外的項目（R4 等）。

## 驗收

- [x] 無引用確認紀錄（指令與結果）
- [x] 刪除清單
- [x] `.gitignore` 處理結果與理由
- [x] typecheck 0 / 0、`test:unit` 全綠、`vite build`、`verify-renderer-imports` 綠
- [x] PLAN-029 補〈T0780 結果〉並改 DONE

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

- **DONE**（驗收 5 項全過）
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-2 無 `branch` 欄位（目前 `main`）；C-3：`vite.config.benchmark.ts`、`.gitignore`、PLAN-029 皆存在（`src/components/git-poc/**` 為萬用字元，排除）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`，未設 `CT_HOME`（非 worktree）。
- **session_id**：35a2dc0c-be2e-45f3-b111-a432346b7d59

### 產出摘要

- **無引用確認**（`git grep -n <樣式> -- . ':(exclude)_ct-workorders/' ':(exclude)src/components/git-poc/'`）：
  - `git-poc`：只命中 `.gitignore:37-38`（規則）、`src/components/git-panel/SvgCommitGraph.tsx:4`、`useVirtualizer.ts:4`（「Migrated from … (T0154)」歷史註解，保留不改）、`vite.config.benchmark.ts:12`（被刪檔本身）。
  - `vite.config.benchmark`：只命中 `vite.config.benchmark.ts:4`（被刪檔自己的註解）。
  - `GitPocPlaceholder`：0 筆。
  - ⇒ `package.json` scripts、`tsconfig*.json`、ESLint、`vite.config.ts`、electron-builder 設定、`.github/workflows/` 都沒有引用。
- **刪除清單**（`git rm -r src/components/git-poc`、`git rm vite.config.benchmark.ts`，共 14 個追蹤檔、1344 行）：`GitPocPlaceholder.tsx`、`README.md`、`benchmark/BenchApp.tsx`、`CommitIndex.ts`、`SvgCommitGraph.tsx`、`fpsMeter.ts`、`index.html`、`indexBench.ts`、`main.tsx`、`synthGen.ts`、`useVirtualizer.ts`、`_bench-screenshot-100k.png`、`_bench-screenshot-500k.png`，以及 `vite.config.benchmark.ts`。
- **`.gitignore`**：未修改。本機產物 `src/components/git-poc/benchmark/_bench-trace-500k-scroll.json`（219,451,647 bytes）與 `_bench-index-result.json`（1,828 bytes）仍在、未刪 → 第 37–38 行保留（否則變成未追蹤檔）。另：第 39 行 `dist-benchmark/` 本機目錄也還在，未列在本單範圍，同樣保留。使用者自行刪除這些本機檔案後，可再移除第 37–39 行。
- **PLAN-029**：frontmatter `status: DONE`、`completed_at`，Metadata 表狀態列改 ✅ DONE，文末補〈T0780 結果〉。`_backlog.md` 未動。

### 驗證

驗證時 HEAD = `6d76c1a5`（工作樹已 `git rm`，未 commit）：

| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | exit 0 |
| `node scripts/verify-renderer-imports.js` | OK — scanned 213 files under src/ (2 allow-listed) |
| `npm run test:unit` | 第 1 次：1 失敗（`electron/__tests__/worktree-status-after-close.test.ts` 的 `live → exited → git …` 在全套平行負載下 5000 ms 逾時，該測試用真 git 與 PtyManager，與 git-poc 無關）；單檔重跑 2/2 通過（3 passed，約 3 s）；第 2 次全套：**382 檔 / 6705 passed / 10 skipped，exit 0** |

e2e 依工單不跑。

### 遭遇問題

- `test:unit` 第一次有一個 git worktree 測試在全套負載下逾時（見上表），單檔與第二次全套都通過，判定為負載下的不穩定，與本單無關。未修改該測試（範圍外）；若塔台在其他工單也看到同一測試逾時，可另開單評估調高該測試的 timeout。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### commit 狀態

- 產品 commit：`16a3a326` — `chore: T0780 remove unused git-poc benchmark and vite.config.benchmark.ts, PLAN-029 DONE`（`git commit --only`：14 個刪除路徑 + PLAN-029）。
- 工單 commit：本回報區所在 commit（只含本工單檔）。
- 未 push。

### 回報時間

- 2026-11-02T14:14:03+0800
