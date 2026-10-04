---
schema_version: 1
schema_kind: workorder
id: T0417
title: "BUG-106：移除 worktree:merge 殘留（channel / preload / 型別 / handler / 分類表 / 測試）"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-106
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-106；T0405 回報區「遭遇問題」1；commit `3a470eb`（改為使用者以 CLI merge）"
  - "D134（本 session 排程表第 1 列）"
affects_files:
  - electron/handlers/git.ts
  - electron/preload.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - src/types/electron.d.ts
  - electron/remote/__tests__/headless-git.test.ts
  - electron/__tests__/git-handlers.test.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **決策已定（D134，使用者 05:33）：移除，不補回實作**。不要恢復 `WorktreeManager.mergeWorktree`。"
  - "🔴 同工作樹有其他 Worker 平行（T0418 / T0419 / 研究單）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（塔台聯合複驗，L141）。測試若紅在你沒碰的檔案，記入回報區、不要修。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only` 精確指定路徑；不 push；不部署 WSL。"
---

# T0417 — 移除 worktree:merge 殘留（BUG-106）

## 背景

`3a470eb` 起 merge 改由使用者自己用 CLI 做，`WorktreeManager.mergeWorktree` 已刪除，但 `worktree:merge` channel、preload `worktree.merge`、`src/types/electron.d.ts` 型別仍在；T0405 把 handler 搬進 `electron/handlers/git.ts` 時逐字保留，呼叫即 reject `TypeError`（本機與遠端皆然）。

## 範圍

1. 全庫 grep `worktree:merge`、`mergeWorktree`、preload / 型別中 `worktree` 物件的 `merge` 成員、renderer 呼叫端（`src/**`）
2. 移除：handler 註冊、preload 暴露、型別、renderer 呼叫端（若有 UI 入口一併拿掉，i18n key 若只為此用也一併清）
3. 分類表同步：`PROXIED_CHANNELS`（`protocol.ts`）、`PATH_FREE_CHANNELS`（`path-aware-channels.ts`）、`headless-channel-status.ts` 等清單移除該 channel；parity / 全分類守門測試應自然轉綠（若測試寫死數量，更新數字並在回報區說明）
4. 相關測試中針對 merge 的案例刪除或改為斷言「channel 不存在」

## 驗收條件

- [ ] 全庫 grep `worktree:merge` / `mergeWorktree` 只剩 CHANGELOG / 工單 / BUG 文件
- [ ] `npm run test:unit` 全綠（基線 1867，數字變動需說明）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附移除清單（檔案 + 行為）

## Sub-session 執行指示
1. 讀本工單 + BUG-106
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG-106 狀態改 `FIXED`（frontmatter + 表格）並填 `links.fix_workorder: T0417`
5. `git commit --only` 實際改動檔 + 本工單 + BUG-106；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
