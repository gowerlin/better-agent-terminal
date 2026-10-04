---
schema_version: 1
schema_kind: workorder
id: T0438
title: "遠端視窗新增「複製遠端路徑」選單項（FileTree / Sidebar / MarkdownPreviewPanel / PathLinker），原「複製路徑」維持 client 形式"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0437
related:
  - "T0421 研究拆單第 4 列；Q2 裁決（新增選單項，保留原本 client 形式）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/FileTree.tsx
  - src/components/Sidebar.tsx
  - src/components/MarkdownPreviewPanel.tsx
  - src/components/PathLinker.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 使用 T0437 的 `remote:resolve-client-paths(paths, 'workspace-entry')`，不另寫轉換邏輯。選單項**只在遠端 profile 視窗顯示**；本機視窗 UI 不變。"
  - "🔴 同工作樹有其他 Worker 平行。i18n 檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0438 — 複製遠端路徑

## 範圍

1. 四處右鍵 / 選單（行號以 T0421 回報區為參考：`FileTree.tsx`、`Sidebar.tsx` 約 :584、`MarkdownPreviewPanel.tsx` 約 :69、`PathLinker.tsx` 約 :225）新增「複製遠端路徑」
2. i18n 三語
3. 測試：遠端視窗顯示且複製 server 形式；本機視窗不顯示

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區（Q2）+ T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
