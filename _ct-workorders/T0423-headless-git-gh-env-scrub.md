---
schema_version: 1
schema_kind: workorder
id: T0423
title: "headless git / gh 子行程套用 BAT_* env scrub（比照 PTY / remote-tools probe 的 isHeadlessScrubbedEnvKey）"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0417
related:
  - "T0405 回報區（headless git / gh 子行程未套 `BAT_*` scrub，另案候選）"
  - "`electron/handlers/remote-tools.ts` `buildProbeEnv` / `isHeadlessScrubbedEnvKey`（`electron/remote/headless-entry.ts`）——既有範本"
  - "D134（本 session 排程表第 7 列）"
affects_files:
  - electron/handlers/git.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/remote/__tests__/headless-git.test.ts
  - electron/__tests__/git-handlers.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **範圍只在 headless 端**：本機 Electron 的 git / gh 子行程行為不變（本機 BAT 終端裡的 `BAT_*` 是本機自己的，不在本單範圍）。若共用 handler 需要 DI，比照 `remote-tools.ts` 的 `isScrubbedEnvKey` deps 注入：headless 傳 `isHeadlessScrubbedEnvKey`，Electron 端維持現行（傳 no-op 或不傳 env）。若 Worker 判斷 Electron 端也應 scrub，**不要改**，寫進回報區給塔台裁決。"
  - "🔴 依賴 T0417（同改 `git.ts`）。開工前 `git log --oneline -3` 確認 T0417 已 commit。"
  - "🔴 同工作樹有其他 Worker 平行（T0422 同時改 `main.ts` 其他區段）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL；child_process 一律 `execFile` / `spawn` + array args。"
---

# T0423 — headless git / gh 子行程 env scrub

## 背景

headless server 的 PTY（`electron/handlers/pty.ts`）與 remote-tools 偵測（`buildProbeEnv`）都以 `isHeadlessScrubbedEnvKey` 濾掉不該讓遠端子行程看到的 env（例如 headless 自己的 `BAT_REMOTE_TOKEN` 等）。T0405 搬上 headless 的 `git:*` / `github:*` / `worktree:*` / `git-scaffold:*` 子行程（`execFileSync` / `spawn`）仍繼承完整 `process.env`。

## 範圍

1. 盤點 `electron/handlers/git.ts` 內所有子行程呼叫點（git、gh、其他），列出目前 env 來源
2. headless 端改用 scrub 後的 env（DI 方式見 memory_overrides 第 1 條）；保留 git / gh 正常運作需要的 env（PATH、HOME、LANG / locale（T0398）、`GH_*` / `GIT_*` 若有）
3. 測試：headless 注入 deps 時子行程 env 不含被 scrub 的 key；Electron 端行為不變（測試鎖住）

## 驗收條件

- [ ] 回報區附呼叫點盤點表
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + `electron/handlers/remote-tools.ts` + `electron/remote/headless-entry.ts`（`isHeadlessScrubbedEnvKey`）+ `electron/handlers/git.ts`
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
