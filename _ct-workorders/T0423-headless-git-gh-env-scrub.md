---
schema_version: 1
schema_kind: workorder
id: T0423
title: "headless git / gh 子行程套用 BAT_* env scrub（比照 PTY / remote-tools probe 的 isHeadlessScrubbedEnvKey）"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:41:39+08:00"
updated_at: "2026-10-05T05:45:14+08:00"
completed_at: "2026-10-05T05:45:14+08:00"
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
  - "🔴 依賴 T0417（同改 `git.ts`）。開工前 `git log --oneline -3` 確認 T0417 已 commit（✅ `7609229`）。"
  - "🔴 **共用檔 hunk 隔離**（塔台 05:41 補）：T0419 平行在改 `electron/main.ts`（`remote:connect` 段）。本單盡量不碰 `main.ts`；若必須改，commit 前 `git diff electron/main.ts` 確認只含本單 hunk——若混有他人未 commit 的改動，**不要 commit 該檔**，等對方 commit 後再提交，或在回報區說明交塔台處理。`git commit --only <file>` 會提交整個檔案內容。"
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

**DONE** — headless `git:*` / `github:*` 的 git / gh 子行程改用「server env − `isHeadlessScrubbedEnvKey`」；Electron 端不傳 `env`（行為不變，測試鎖住）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：informational，`electron/handlers/git.ts` 等皆存在 → PASS
- C-2：無 `branch` 欄位（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴 T0417：`7609229` 已 commit ✅

### 產出摘要

**呼叫點盤點（`electron/handlers/git.ts`，T0423 前 env 來源皆為繼承 `process.env`）**

| # | channel / 函式 | 子行程 | API | T0423 後 headless env | Electron env |
|---|---|---|---|---|---|
| 1 | `git:get-github-url` | `git remote get-url origin` | `execFileSync` | scrubbed | 繼承（不傳 `env`） |
| 2 | `git:branch` | `git rev-parse --abbrev-ref HEAD` | `execFileSync` | scrubbed | 繼承 |
| 3 | `git:log` | `git log --pretty=… -n N` | `execFileSync` | scrubbed | 繼承 |
| 4 | `git:diff` | `git diff …` | `execFileSync` | scrubbed | 繼承 |
| 5 | `git:diff-files` | `git diff --name-status …` | `execFileSync` | scrubbed | 繼承 |
| 6 | `git:getRoot` | `git rev-parse --show-toplevel` | `execFileSync` | scrubbed | 繼承 |
| 7 | `git:status` | `git status --porcelain -uall` | `execFileSync` | scrubbed | 繼承 |
| 8 | `getGithubRepoFromOrigin`（`github:pr-*` / `issue-*` 共用） | `git remote get-url origin` | `execFileSync` | scrubbed | 繼承 |
| 9 | `github:check-cli` | `gh --version` | `execFileSync` | scrubbed | 繼承 |
| 10 | `github:check-cli` → `checkGhAuth` | `gh auth status --hostname … [--active]` | `spawn`（stdio ignore） | scrubbed | 繼承 |
| 11–16 | `github:pr-list` / `issue-list` / `pr-view` / `issue-view` / `pr-comment` / `issue-comment` | `gh pr|issue list|view|comment …` | `execFileSync` | scrubbed | 繼承 |
| — | `worktree:*` | `worktreeManager`（`electron/worktree-manager.ts` 內 `execFile` git） | `execFile` | **未改**，仍繼承（見遭遇問題 1） | 繼承 |
| — | `git-scaffold:*` | `registerGitScaffoldHandlers`（`electron/git/git-ipc.ts`，simple-git spawn git） | simple-git | **未改**，仍繼承（見遭遇問題 2） | 繼承 |
| — | `resolveGh`（`gh-resolver.ts`） | 僅檔案系統探測 | — | 不適用 | — |

**實作**
- `electron/handlers/git.ts`：`GitHandlerDeps` 新增選填 `isScrubbedEnvKey`（比照 `remote-tools.ts` 的 DI）。`registerGitHandlers` 內以 `childEnv()` 每次呼叫時用 `buildProbeEnv(getEnv(), isScrubbedEnvKey)` 組 env（重用 `remote-tools.ts` 既有函式，未新增 helper），包裝 `execFileSync`；`checkGhAuth` opts 新增選填 `env`。未傳 `isScrubbedEnvKey` 時**完全不加 `env` key**（Electron 原行為）。`GH_HOST` 仍從 `getEnv()` 讀給 `ghAuthStatusArgs`。PATH / HOME / LANG 等 locale / `GH_*` / `GIT_*` 皆保留（規則只濾 `BAT_` 前綴，大小寫不敏感）。
- `electron/remote/headless-entry.ts`：`createHeadlessGitModule` 傳 `isScrubbedEnvKey: isHeadlessScrubbedEnvKey`（放在 `...overrides` 之後）；`HeadlessGitOverrides` 型別排除 `isScrubbedEnvKey`（同 `HeadlessRemoteToolsOverrides` 作法，測試無法關掉 scrub）。
- `electron/main.ts` / `electron/handlers/types.ts`：**未修改**（Electron 端不傳即維持現行，無需動 `main.ts`，避開 T0419 / T0422 平行改動）。

**測試**
- `electron/__tests__/git-handlers.test.ts` 新增 `child env (T0423 …)` 3 案：(a) 注入 scrub 時 14 個 channel 的 20 次 `execFileSync` + 1 次 `spawn` env 皆等於「host env − BAT_*（含小寫 `bat_`）− undefined」，`GH_HOST` 仍進 login check；(b) env 每次呼叫讀取、非註冊時凍結；(c) 不注入（Electron）時所有 options 無 `env` property、spawn options 恰為 `{ stdio: 'ignore', windowsHide: true }`。
- `electron/remote/__tests__/headless-git.test.ts`：harness `getEnv` 改為真實 `process.env`（去 `GH_HOST`）+ 植入 `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID` / `bat_t0423_lower`；新增 wire-level 案例：真 git `git:branch` 在 scrubbed env 下仍回 `main`，git / gh 子行程 env 皆無 `BAT_*` 且含 PATH。

**驗證**
- `npx vitest run electron/__tests__/git-handlers.test.ts electron/remote/__tests__/headless-git.test.ts`：2 files / 27 tests PASS
- `npm run test:unit`：**115 files passed，1893 passed / 1 skipped** — PASS
- `npx tsc --noEmit`：**40** error（≤ 40 門檻），本單 4 檔 0 錯誤 — PASS
- 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides L141）；未部署 WSL（runtime smoke 未做）

**Commit**：`22bc3d0` fix(headless): scrub BAT_* from git / gh child env (T0423)（`git commit --only` 4 個產品 / 測試檔 + 本工單；不 push）

### 遭遇問題

1. **`worktree:*` 未涵蓋（交塔台裁決）**：實際 spawn 在 `electron/worktree-manager.ts`（不在 `affects_files`）。可比照 `setGitBinaryResolver` 加 `setEnvProvider`，於 headless 設定；該單例同時被 headless claude module（`ClaudeAgentManager` worktree）使用，影響面需一起評估。建議另開小單。
2. **`git-scaffold:*` 未涵蓋，且有回歸陷阱**：走 simple-git 3.36.0（`electron/git/git-ipc.ts`，不在 `affects_files`）。一旦以 `.env(env)` 注入 env，simple-git 的 `blockUnsafeOperationsPlugin`（`@simple-git/argv-parser` `vulnerabilityCheck`）會檢查 env，含 `EDITOR` / `PAGER` / `GIT_ASKPASS` / `SSH_ASKPASS` / `GIT_SSH_COMMAND` / `GIT_EDITOR` / `GIT_PAGER` / `GIT_CONFIG*` / `PREFIX` 等任一 key 即拋 `Use of "X" is not permitted without enabling allowUnsafe…`。手動從 shell 啟動的 bat-server 常帶 `EDITOR` / `PAGER`，直接注入會讓 Git Graph 面板全掛。若要做需同時從 env 濾掉這些 key 或開對應 `unsafe` 旗標（後者削弱防護），建議另開單並評估。
3. Electron 端是否也應 scrub：維持不改（依 memory_overrides 第 1 條）。觀察：Electron 本機 git / gh 子行程目前會看到本機 BAT 的 `BAT_*`（例如從 BAT 終端 `npm run dev` 啟動時），屬本機自身 env，風險低，不建議改；如塔台要改，只需在 `main.ts` 的 `registerGitHandlers` 傳 `isScrubbedEnvKey`。

### 回報時間
2026-10-05T05:44:31+08:00
