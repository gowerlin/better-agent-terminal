---
schema_version: 1
schema_kind: workorder
id: T0429
title: "T0423 後續：headless worktree:*（worktree-manager.ts）與 git-scaffold:*（simple-git）子行程 BAT_* scrub；simple-git unsafe env 陷阱處理"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: null
updated_at: "2026-10-05T05:47:15+08:00"
completed_at: null
target_version: next
depends_on:
  - T0422
related:
  - "T0423 回報區「遭遇問題」1 / 2；commit `22bc3d0`（git / gh 16 個呼叫點已 scrub）"
  - "D134 追加（使用者 05:46 斷點 C 裁決）"
affects_files:
  - electron/worktree-manager.ts
  - electron/git/git-ipc.ts
  - electron/remote/headless-entry.ts
  - electron/__tests__/
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **範圍只在 headless 端**：Electron 本機行為不變（比照 T0423：未注入時不改 env）。"
  - "🔴 **worktree**：`electron/worktree-manager.ts` 為單例，同時被 headless claude module（`ClaudeAgentManager` worktree）使用。比照既有 `setGitBinaryResolver` 加 env provider（例如 `setEnvProvider`），只在 headless 設定；回報區說明對 claude worktree 路徑的影響。"
  - "🔴 **git-scaffold / simple-git 陷阱**（T0423 實查）：simple-git 3.36.0 的 `blockUnsafeOperationsPlugin` 會檢查 `.env()` 傳入的 env，含 `EDITOR` / `PAGER` / `GIT_ASKPASS` / `SSH_ASKPASS` / `GIT_SSH_COMMAND` / `GIT_EDITOR` / `GIT_PAGER` / `GIT_CONFIG*` / `PREFIX` 等即拋錯 → Git Graph 全掛。**不得**以開啟 `unsafe` 旗標繞過。做法：headless env 除 `BAT_*` 外，再濾掉 simple-git 視為 unsafe 的 key（清單以 node_modules 內實際原始碼為準，回報區附出處 `檔案:行`），並以測試鎖住「帶 `EDITOR` / `PAGER` 的 server env 下 Git Graph channel 仍可運作」。若判斷風險過高，只做 worktree 部分，git-scaffold 寫回報區交塔台，狀態 PARTIAL。"
  - "🔴 依賴 T0422（同改 `headless-entry.ts`）。開工前 `git log --oneline -5` 確認。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0429 — headless worktree / git-scaffold env scrub

## 背景

T0423 讓 headless `git:*` / `github:*` 的 16 個 git / gh 子行程改用 scrub 後 env（server env − `isHeadlessScrubbedEnvKey`）。剩兩處仍繼承完整 `process.env`：
- `worktree:*` → `electron/worktree-manager.ts` 內 `execFile` git
- `git-scaffold:*` → `electron/git/git-ipc.ts`（simple-git）

## 範圍

1. worktree-manager env provider + headless 設定
2. git-scaffold：headless 傳 scrub + unsafe-key 過濾後的 env（見 memory_overrides 第 3 條）
3. 測試：headless 子行程 env 無 `BAT_*`；Electron 未注入時不變；simple-git 在含 unsafe key 的 server env 下仍可執行（以真 git 跑一個 healthCheck / listCommits 於暫存 repo）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附 unsafe key 清單出處與 claude worktree 影響說明

## Sub-session 執行指示
1. 讀本工單 + T0423 回報區 + `electron/handlers/git.ts`（T0423 做法）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（或 PARTIAL，見 memory_overrides 第 3 條）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
