---
schema_version: 1
schema_kind: workorder
id: T0417
title: "BUG-106：移除 worktree:merge 殘留（channel / preload / 型別 / handler / 分類表 / 測試）"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-106
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:39:34+08:00"
updated_at: "2026-10-05T05:40:44+08:00"
completed_at: "2026-10-05T05:40:44+08:00"
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

**DONE**

### 產出摘要

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單位於 REPO_ROOT 下 → PASS；C-3：affects_files 皆存在 → PASS（informational）；C-2：工單無 `branch` 欄位（HEAD = `main`）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

**移除清單（檔案 + 行為）**

| 檔案 | 移除內容 | 行為變化 |
|------|---------|---------|
| `electron/handlers/git.ts` | `register('worktree:merge', …)` handler（含 `(worktreeManager as any).mergeWorktree` 呼叫、eslint-disable 與「Pre-existing」註解） | 本機與 headless 不再註冊此 channel；原本呼叫必 reject `TypeError` |
| `electron/preload.ts` | `worktree.merge(sessionId, strategy)` | renderer 不再暴露此 API |
| `src/types/electron.d.ts` | `ElectronAPI.worktree.merge` 型別 | 型別層同步移除 |
| `electron/remote/protocol.ts` | `PROXIED_CHANNELS` 的 `'worktree:merge'` | remote client 不再 proxy 此 channel |
| `electron/remote/path-aware-channels.ts` | `PATH_FREE_CHANNELS` 的 `['worktree:merge', 'sessionId + strategy enum']` | 分類表與 PROXIED_CHANNELS 對齊（全分類守門測試維持綠） |
| `electron/__tests__/git-handlers.test.ts` | 註冊清單斷言移除 `'worktree:merge'`；標題 `22` → `21` | `toEqual` 完整清單斷言即等同「channel 不存在」 |
| `electron/remote/__tests__/headless-git.test.ts` | `T0405_CHANNELS` 移除 `'worktree:merge'`；標題 `22` → `21` | 陣列實際 21 項 |

- `electron/remote/headless-channel-status.ts`：`HEADLESS_UNSUPPORTED` 本就無 `worktree:merge` 條目（T0405 已上線 worktree:*，只剩註解泛稱 `worktree:*`），**無需改動**
- renderer 呼叫端（`src/**`）：除型別外無任何 `worktree.merge` 呼叫、無 UI 入口、無 i18n key → 無需清理
- 未恢復 `WorktreeManager.mergeWorktree`（遵 D134）

**驗收**
- [x] `git grep -e "worktree:merge" -e "mergeWorktree" -e "worktree\.merge"`（排除 `_ct-workorders/`）→ **0 筆**。未追蹤／ignored 區仍有命中：`dist-server/dev-deploy-headless/*.js`（gitignored 建置產物，下次 build 自然消失）與 `.kilo/worktrees/{crystal-boron,zesty-asiago}/`（他工具的舊 worktree 副本，非本庫追蹤檔），皆不在範圍、未動
- [x] `npm run test:unit`：**112 files passed；1867 passed | 1 skipped（1868）** — 與基線 1867 相同。數字不變的原因：本單只刪陣列項目與改標題，未刪除任何 `it()` 案例
- [x] `npx tsc --noEmit`：**40** 個 error（≤ 40）；其中與 merge / worktree 相關 0 筆
- 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides，塔台聯合複驗 L141）

**Commit**：`7609229`（`git commit --only` 7 個產品／測試檔 + 本工單 + BUG-106）；未 push

### 遭遇問題

1. `npm run test:unit` 輸出夾帶既有雜訊（`AttachConsole failed`（node-pty conpty agent）、`fatal: not a git repository`、`No such remote 'origin'`），為測試 fixture 的 stderr，不影響結果（全綠），非本單引入
2. 工作樹中有其他 Worker 的平行改動（`_ct-workorders/T0418`~`T0421`、`_tower-state.md`），未碰、未納入 commit

### 回報時間

2026-10-05T05:40:32+08:00
