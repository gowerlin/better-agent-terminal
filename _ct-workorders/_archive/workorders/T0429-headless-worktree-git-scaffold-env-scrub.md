---
schema_version: 1
schema_kind: workorder
id: T0429
title: "T0423 後續：headless worktree:*（worktree-manager.ts）與 git-scaffold:*（simple-git）子行程 BAT_* scrub；simple-git unsafe env 陷阱處理"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: "2026-10-05T05:49:15+08:00"
updated_at: "2026-10-05T05:54:29+08:00"
completed_at: "2026-10-05T05:54:29+08:00"
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

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [x] 回報區附 unsafe key 清單出處與 claude worktree 影響說明

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

**DONE** — headless `worktree:*`（worktree-manager.ts 單例）與 `git-scaffold:*`（simple-git）的 git 子行程改用「server env − `BAT_*`」；git-scaffold 另濾掉 simple-git 視為 unsafe 的 env key（未開任何 `unsafe` 旗標）。Electron 端不注入 → 行為不變（測試鎖住）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：informational，`electron/worktree-manager.ts` / `electron/git/git-ipc.ts` / `electron/remote/headless-entry.ts` 皆存在 → PASS
- C-2：無 `branch` 欄位（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴 T0422：`d800dea` 已在 `git log`（開工時 HEAD = `ffb06f8`）✅
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**實作**
- `electron/worktree-manager.ts`：新增 `setEnvProvider(provide)`（比照 `setGitBinaryResolver`）與私有 `runGit(args, options)`；原 10 處 `execFileAsync(this.gitBinary(), …)` 全改走 `runGit`。provider 每次 spawn 讀取；預設回 `undefined` ⇒ **不加 `env` key**（Electron 原行為）。
- `electron/git/git-ipc.ts`：`GitScaffoldDeps` 新增選填 `getEnv`；新增 `SIMPLE_GIT_UNSAFE_ENV_KEYS` + `stripSimpleGitUnsafeEnv()`。`makeGit` 只在 env 有值時呼叫 `.env(stripSimpleGitUnsafeEnv(env))`；未傳 / 回 `undefined` 時**完全不呼叫 `.env()`**（Electron 原行為，simple-git 的 env 檢查拿到 `{}`，spawn 繼承 `process.env`）。三個 channel 每次呼叫讀一次 env。
- `electron/handlers/git.ts`（⚠️ 不在 `affects_files`，見遭遇問題 1）：`registerGitScaffoldHandlers` 多傳 `getEnv: childEnv`（重用 T0423 的 `childEnv`，Electron 為 `undefined`）＋更新檔頭註解。
- `electron/remote/headless-entry.ts`：`createHeadlessGitModule` 內 `worktreeManager.setEnvProvider(() => buildProbeEnv(getEnv(), isHeadlessScrubbedEnvKey))`（`getEnv` = `overrides.getEnv ?? process.env`，與 `git:*` 同源）；import `buildProbeEnv`；註解更新。

**simple-git unsafe env key 清單出處**（以 `node_modules` 實際原始碼為準）
- 清單：`node_modules/@simple-git/argv-parser/dist/index.cjs:1`（minified 單行；`const y={editor:"allowUnsafeEditor",git_askpass:…,ssh_askpass:"allowUnsafeAskPass"}`，`@simple-git/argv-parser` 1.1.1）共 18 key：`editor`、`git_askpass`、`git_config_global`、`git_config_system`、`git_config_count`、`git_config`、`git_editor`、`git_exec_path`、`git_external_diff`、`git_pager`、`git_proxy_command`、`git_template_dir`、`git_sequence_editor`、`git_ssh`、`git_ssh_command`、`pager`、`prefix`、`ssh_askpass`。
- 比對方式：同檔 `function Z(e)` — key `toLowerCase().trim()` 後查 `y`（`k(s)` = `Object.hasOwn(y, s)`）；`function Q(e)` 以 `git_config_count` 讀 `GIT_CONFIG_KEY_n` 再跑 config 規則 ⇒ 濾掉 `git_config_count` 即使 `Q` 失效（git 本身沒有 COUNT 也不讀 KEY_n）。
- 觸發點：`node_modules/simple-git/dist/cjs/index.js:1192-1203`（`blockUnsafeOperationsPlugin`，`vulnerabilityCheck(args, env)`）；env 來源 `:1815-1818`（`attemptRemoteTask` 傳 `env: { ...this.env }`）；`.env()` 設定 `:4392-4398`；spawn 用 `env: this.env`（`:1887`）。simple-git 3.36.0。
- 測試以安裝中的 `@simple-git/argv-parser` `parseEnv` 逐 key 驗證「清單內每個 key 都會被擋」，並驗證 strip 後的 env 0 vulnerability（未來升級若改名/刪 key 會紅；**新增** key 不會自動偵測，見遭遇問題 3）。

**claude worktree 影響說明**
- `worktreeManager` 為 process 單例；headless 只有 claude module（`ClaudeAgentManager`，`claude-agent-manager.ts:444/449/2416/2422` 的 rehydrate / createWorktree / getWorktreeStatus / removeWorktree）會用它（headless 無 codex module）。provider 於 `createHeadlessGitModule` setup 時設定、每次 spawn 才讀 ⇒ 不論 claude / git module 註冊先後，headless 上 claude worktree session 的 git 子行程（rev-parse / worktree add / ls-files / diff / worktree remove / prune / branch -D）同樣拿到 server env − `BAT_*`。
- 只濾 `BAT_*`：`EDITOR` / `GIT_SSH_COMMAND` / `GIT_*` 等一律保留（worktree 走 plain `execFile`，無 simple-git 限制），git 行為不變。worktree 內的 Claude SDK 子行程 env 不經此路徑（由 agent manager 自行決定，不在本單範圍）。
- 前提同既有 `setGitBinaryResolver`：若未來 headless 拿掉 git module，claude worktree 會退回繼承完整 env（兩個設定一起退回）。
- Electron：`main.ts` 從未呼叫 `setEnvProvider` ⇒ 本機 claude / codex worktree 不變。

**測試**
- 新增 `electron/__tests__/git-scaffold-env.test.ts`（6 案，simple-git pass-through spy + 真 git 暫存 repo）：清單 vs 安裝中 `parseEnv` 一致；strip 後 0 vulnerability 且 PATH / HOME / GIT_DIR 保留；**陷阱實證**（未 strip 帶 `EDITOR` 的 env → simple-git 拋 `EDITOR … not permitted`）；headless：server env 帶 20 個 unsafe key 下 healthCheck / getRepoInfo / listCommits 皆 ok、env 每次讀取、`.env()` 收到的 env 無 unsafe key；Electron（無 `getEnv`）與 `getEnv → undefined` 皆不呼叫 `.env()`。
- 新增 `electron/__tests__/worktree-manager-env.test.ts`（3 案，`execFile` promisify pass-through spy + 真 git）：無 provider → create/status/remove 全部 git 子行程 options 無 `env`；有 provider → 每次 spawn 讀一次並套用；provider 回 `undefined` → 同 Electron。
- `electron/remote/__tests__/headless-git.test.ts`：harness server env 追加 `EDITOR` / `PAGER` / `GIT_SSH_COMMAND` / `GIT_ASKPASS`（既有 T0405 git-scaffold / worktree 案例因此也在該 env 下跑）；新增 wire-level 2 案：git-scaffold 3 channel 皆通、simple-git env 無 `BAT_*` 與 unsafe key 且含 PATH；worktree create/remove 的 git 子行程 env 無 `BAT_*`、保留 `EDITOR`、含 PATH。

**驗證**
- `npx vitest run` 上述 3 檔 + `git-handlers.test.ts`：PASS（9 + 29 tests）
- `npm run test:unit`：**120 files passed，1933 passed / 1 skipped** — PASS
- `npx tsc --noEmit`：**40** error（≤ 40 門檻），本單檔案 0 錯誤 — PASS
- 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides L141）；未部署 WSL（runtime smoke 未做）

**Commit**：`b968b9f` fix(headless): scrub BAT_* from worktree and git-scaffold git children (T0429)（`git commit --only` 7 個產品 / 測試檔 + 本工單；不 push）

### 遭遇問題

1. **`electron/handlers/git.ts` 不在 `affects_files` 但必改**：`registerGitScaffoldHandlers` 由 `registerGitHandlers` 呼叫，env 只能從此處往下傳。改動僅 1 行呼叫 + 檔頭註解，重用 T0423 的 `childEnv`，Electron 為 `undefined` ⇒ 無行為變化。
2. **git-scaffold 濾 unsafe key 的殘留風險（低）**：headless Git Graph 的 git 子行程看不到 `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_SYSTEM` / `GIT_CONFIG` / `GIT_EXEC_PATH` / `GIT_CONFIG_COUNT`。若 server 以這些 env 指定替代 config（例如把 `safe.directory` 放在 `GIT_CONFIG_GLOBAL` 指的檔）或非標準 git 安裝需 `GIT_EXEC_PATH`，Git Graph 會與 `git:*`（保留這些 key）行為不一致（可能報 dubious ownership）。git-scaffold 目前只跑唯讀指令（rev-parse / branch / remote / log），`EDITOR` / `PAGER` / `*ASKPASS` / `GIT_SSH*` 等移除無影響。在不開 `unsafe` 旗標的前提下這是唯一可行解。
3. **清單同步**：`SIMPLE_GIT_UNSAFE_ENV_KEYS` 為手抄 simple-git 3.36.0 / argv-parser 1.1.1 的 `y` map。升級 simple-git 若**新增** key，測試抓不到，headless Git Graph 會在 server env 帶該 key 時壞掉（錯誤訊息明確 `Use of "X" is not permitted…`）。建議升級 simple-git 時對照 `dist/index.cjs` 的 `y`。測試直接 import 間接依賴 `@simple-git/argv-parser`（未列入 `package.json`；npm hoist 改變時需調整）。

### 回報時間
2026-10-05T05:53:38+08:00
