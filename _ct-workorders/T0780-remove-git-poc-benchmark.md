---
schema_version: 1
schema_kind: workorder
id: T0780
title: "PLAN-029 R3：刪除沒有被引用的 `src/components/git-poc/`（T0154 benchmark）與 `vite.config.benchmark.ts`"
type: implementation
status: PENDING
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

- [ ] 無引用確認紀錄（指令與結果）
- [ ] 刪除清單
- [ ] `.gitignore` 處理結果與理由
- [ ] typecheck 0 / 0、`test:unit` 全綠、`vite build`、`verify-renderer-imports` 綠
- [ ] PLAN-029 補〈T0780 結果〉並改 DONE

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 驗證

### 遭遇問題

### 互動紀錄

### commit 狀態

### 回報時間
