---
schema_version: 1
schema_kind: workorder
id: T0416
title: "BUG-105：proxied channel 路徑轉換全面盤點——claude:* / github:* / git-scaffold:* / worktree:* 等補 path-aware schema，加守門測試要求每個 proxied channel 都有明確路徑分類"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: M
created_at: "2026-10-05T04:37:14+08:00"
started_at: "2026-10-05T04:38:22+08:00"
updated_at: "2026-10-05T04:47:53+08:00"
completed_at: "2026-10-05T04:47:53+08:00"
target_version: next
depends_on:
  - T0405
related:
  - "BUG-105；T0405 回報區「遭遇問題」2；BUG-065 / T0301（path-aware schema 由來）"
  - "T0393（WSL 工作區資料夾預設 / `/mnt/c` 提示）；T0397 E4"
  - "T0406（排在本單之後：也要改 `path-aware-channels.ts` 加 `workspace:sync-roots`）"
affects_files:
  - electron/remote/path-aware-channels.ts
  - electron/remote/path-translator.ts
  - electron/remote/remote-client.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況再改**：第一步要以程式碼證據回答「WSL / SSH 遠端視窗的工作區資料夾實際存的是 client 形式（`\\\\wsl.localhost\\…` / `C:\\…`）還是 server 形式（`/home/…`）」，以及各面板送出 cwd 的來源。若結論是遠端視窗一律存 server 形式、實際不會壞，回報區寫明證據並把本單降為「只加守門測試 + 補 schema 以防未來」，仍可 DONE。"
  - "🔴 **回傳值轉換要逐一判斷**：例如 `claude:get-cli-path` 回的是要打進**遠端終端**的 server 路徑，**不可**轉成 client 形式；`worktree:create` 回的 worktree 路徑是否要轉，依呼叫端用途決定。每個決定寫進回報區表格。"
  - "🔴 本機（非遠端）視窗行為不得改變：translator 只在遠端連線時套用（沿用既有機制）。"
  - "🔴 不得部署到 WSL（轉換在 client / main 端，不需重新部署 server）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0416 — proxied channel 路徑轉換盤點（BUG-105）

## 元資料
- **工單編號**：T0416
- **任務名稱**：path-aware 覆蓋補齊 + 守門
- **狀態**：DONE
- **建立時間**：2026-10-05 04:37 (UTC+8)
- **intervention_type**：context-dependent（需要時可問使用者一次：例如實機上工作區資料夾長什麼樣）

## 背景

`electron/remote/path-aware-channels.ts` 的 `PATH_AWARE_CHANNELS` / schema（BUG-065 / T0301）只涵蓋 `fs:*`、`git:*`（7 個）、`pty:create` / `pty:restart`、`image:read-as-data-url`；`PATH_RETURNING_CHANNELS` 有 `fs:readdir` / `fs:search` / `git:getRoot` / `pty:get-cwd`。PLAN-036 之後上線 headless 的 `claude:*`（T0401，例如 `claude:start-session` 的 cwd）、`github:*` / `git-scaffold:*` / `worktree:*`（T0405）都沒有登錄 ⇒ 遠端視窗的 client 形式路徑會原樣送到 Linux server。WSL 實機 smoke 11/11 都直接用 server 路徑，所以測不到這個問題。

## 範圍

1. **現況確認**（見 memory_overrides 第 1 條）：WSL / SSH 遠端視窗的 workspace folder 形式、各面板（Claude、Git、GitHub、Git Graph、worktree）送出路徑的來源
2. **盤點表**：`PROXIED_CHANNELS` 每個 channel → 參數中的路徑位置（第幾個參數 / 物件欄位）、回傳值是否含路徑、決定（轉 / 不轉 / 理由）
3. **補 schema**：必要時新增 schema 型別（例如「第 N 個字串」、「物件的指定欄位」），沿用 `PathTranslator`；`PATH_RETURNING_CHANNELS` 依盤點表補（含 `claude:get-cli-path` 不轉的明確標註）
4. **守門測試**：每個 `PROXIED_CHANNELS` channel 必須出現在「path-aware（含 schema）」或「明確無路徑（附理由）」其中一張表，新增 channel 未分類即 CI 紅；`workspace:sync-roots` 等 T0406 會新增的 channel 由 T0406 自行分類
5. **轉換測試**：以 WSL translator（`\\wsl.localhost\Ubuntu-24.04\home\x` ↔ `/home/x`，以及 `C:\Users\x` ↔ `/mnt/c/Users/x`）對新登錄的每個 channel 斷言轉換結果；本機視窗不轉

## 驗收條件

- [ ] 回報區附現況結論（含程式碼證據）與盤點表
- [ ] 守門測試與轉換測試綠
- [ ] `npm run test:unit` 全綠（基線 1675）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附使用者實機步驟（WSL 遠端視窗：用 `\\wsl.localhost\…` 與 `C:\…` 兩種工作區各開 Claude 面板與 Git Graph）

## Sub-session 執行指示
1. 讀本工單 + BUG-105 + `electron/remote/path-aware-channels.ts` / `path-translator.ts` / `remote-client.ts`（轉換套用點）+ `electron/remote/protocol.ts` + T0393 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T04:38:22+08:00，Worker，`CT_MODE=on`、`CT_INTERACTIVE=1`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 informational（`path-aware-channels.ts` / `path-translator.ts` / `remote-client.ts` / 兩個 `__tests__/` 皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 自動化閘門全綠；實機（WSL UI）交使用者，步驟見下

### 現況結論

**bug 確實存在，非「只加守門」降級情境。** 證據：

1. **WSL / SSH 遠端視窗的工作區資料夾存的是 client 形式**：`src/App.tsx:699-703` `handleAddWorkspace` → `window.electronAPI.dialog.selectFolder()`（`electron/main.ts` 的 `dialog:select-folder` 是**本機** `dialog.showOpenDialog`，不代理；T0393 只把 WSL 視窗的 `defaultPath` 設為 `\\wsl.localhost\<distro>\home\<user>`）→ 回傳值原樣 `workspaceStore.addWorkspace(name, folderPath)`。T0393 的 `/mnt/c` 提示（`isWslWindowsDrivePath`）也是以 client 形式判斷。`workspace:save` / `workspace:load` 屬 `ALWAYS_LOCAL_CHANNELS`（`electron/remote/headless-channel-status.ts:31`），存在本機 window registry，不會被轉換。⇒ WSL 視窗 `folderPath` = `\\wsl.localhost\Ubuntu-24.04\home\…` 或 `C:\…`；SSH 視窗同為本機對話框 → `C:\Users\<u>\…`（`SshPathTranslator` 只對應 home）
2. **各面板送出路徑的來源都是這個 client 形式 `folderPath`**：Claude / Codex 面板 `cwd` prop → `claude:start-session` options.cwd、`claude:list-sessions` / `claude:scan-skills`（`ClaudeAgentPanel.tsx:1008-1015,1083,1340`）；Git Graph `GitGraphPanel.tsx:59` `healthCheck(workspaceFolderPath)` / `listCommits(workspaceFolderPath)`；GitHub 面板 `github:*`(cwd)；claude-cli worktree `WorkspaceView.tsx:700` `worktree.create(terminalId, cwd)`；`pty.createWithCommand({ cwd })`（`App.tsx:826/846`、`WorkspaceView.tsx:637/658`）
3. **轉換套用點**：`electron/main.ts:2381` `bindProxiedHandlersToIpc` —— 只有「遠端 profile 視窗 + 該 profile 正連線」才走 `remoteClient.invoke`，`remote-client.ts:501/512` 以 `translateInvokeArgs` / `normalizePathsInResult` 轉換；本機視窗走 `invokeHandler`，完全不經 translator（本單沒動這段，本機行為不變）
4. 修正前 `PATH_AWARE_CHANNELS` 未含上述 channel ⇒ `translateInvokeArgs` 第一行 `if (!PATH_AWARE_CHANNELS.has(channel)) return args` 原樣送出 client 路徑到 Linux server

### 盤點表

`PROXIED_CHANNELS` 共 108 個，全部分類（`PATH_ARG_SCHEMA` 34 + `PATH_FREE_CHANNELS` 74）（SoT：`electron/remote/path-aware-channels.ts` 的 `PATH_ARG_SCHEMA` / `PATH_FREE_CHANNELS` / `PATH_RETURNING_CHANNELS` / `SERVER_PATH_RESULT_CHANNELS`，每筆附理由）。

**A. 請求含 client 路徑 → 轉（`PATH_ARG_SCHEMA`）**

| channel | 路徑位置 | schema | 備註 |
|---|---|---|---|
| `fs:*`（7）、`git:*`（7）、`image:read-as-data-url`、`pty:create`、`pty:restart` | 既有（BUG-065 / T0301） | 既有 | 未變 |
| `claude:start-session` 🆕 | args[1].`cwd`、args[1].`worktreePath` | `object-fields` | 其餘欄位（prompt / model / branch…）不動 |
| `claude:resume-session` 🆕 | args[2] cwd、args[6] worktreePath | `arg-indices [2,6]` | sessionId / sdkSessionId / model / branch 不動 |
| `claude:list-sessions` 🆕 | args[0] cwd | `first-string` | agentPreset 不動 |
| `claude:scan-skills` 🆕 | args[0] cwd | `first-string` | |
| `worktree:create` 🆕 | args[1] cwd | `arg-indices [1]` | args[0] 是 sessionId |
| `worktree:rehydrate` 🆕 | args[1] cwd、args[2] worktreePath | `arg-indices [1,2]` | branchName 不動 |
| `github:pr-list` / `issue-list` / `pr-view` / `issue-view` / `pr-comment` / `issue-comment` 🆕 | args[0] cwd | `first-string` | comment body（可能含 `C:\…` 字樣）**不轉** |
| `git-scaffold:healthCheck` / `getRepoInfo` / `listCommits` 🆕 | args[0] cwd | `first-string` | listCommits options 不動 |
| `terminal:create-with-command` / `terminal:create-agent-command` 🆕 | args[0].`cwd` | `object-fields` | command / prompt / customEnv 不動 |

**B. 回傳值**

| channel | 回傳路徑 | 決定 | 理由 |
|---|---|---|---|
| `fs:readdir` / `fs:search` / `git:getRoot` / `pty:get-cwd` | 有 | 轉回 client（既有） | — |
| `git-scaffold:healthCheck` / `getRepoInfo` 🆕 | `gitRoot` | **轉回 client** | Git Graph 面板顯示 / log 用，與 `git:getRoot` 一致 |
| `claude:get-cli-path` | CLI 路徑 | **不轉** | 要打進**遠端終端**執行 |
| `claude:detectRuntime` / `github:check-cli` | server 上 claude / gh 位置 | 不轉 | 遠端設定頁顯示的是遠端主機的位置；其 `customPath` 參數來自代理到遠端的 settings，本來就是 server 路徑（參數也不轉） |
| `settings:get-shell-path` | shell 路徑 | 不轉 | shell 在遠端 spawn |
| `settings:get-logging-info` / `remote-tools:detect` | server 目錄 | 不轉 | 僅顯示 |
| `claude:get-session-meta` | `cwd` | 不轉 | renderer 不讀 `meta.cwd` |
| `claude:get-worktree-status` | `worktreePath` | 不轉 | 只讀 `diff`；與 `claude:worktree-info` event 同形 |
| `worktree:create` | `worktreePath` / `gitRoot` | **不轉** | `worktreePath` 寫入 terminal 的 `worktreePath` 欄位，與 `claude:worktree-info` event（server 形式）共用同一欄位；Claude / Codex 面板會把 `worktreeInfo.worktreePath` / `gitRoot` 嵌進送給**遠端 agent** 的 prompt（`ClaudeAgentPanel.tsx:3367`），必須維持 server 形式。之後只回流到 `pty:create` / `worktree:rehydrate` / `claude:start-session` / `git:*`，其 `toServer` 對 server 路徑是 no-op（`winToWsl('/home/x')` → 原值，測試已鎖） |
| `worktree:status` | `worktreePath` | 不轉 | renderer 未使用；與 `worktree:create` 同形 |

**C. 明確無路徑（`PATH_FREE_CHANNELS`，各附理由）**：`pty:write/resize/kill/get-cwd/get-buffer`、39 個 `claude:*`（sessionId / enum / 文字 / data: URL 圖片；`claude:archive-messages` 等 3 個為 ALWAYS_LOCAL）、`worktree:remove/status/merge`、`workspace:save/load`（ALWAYS_LOCAL）、`settings:*`（5）、`github:check-cli`、`snippet:*`（10）、`profile:*`（6）、`terminal:notify/keypress`、`remote-tools:detect`

### 產出摘要

- `electron/remote/path-aware-channels.ts`
  - `PathArgSchema` 新增 `{ kind: 'arg-indices', indices }` 與 `{ kind: 'object-fields', index, fields }`；`translateInvokeArgs` 先處理 object schema，既有字串 schema 與「未列 schema 預設 first-string」行為不變
  - `PATH_ARG_SCHEMA` 改為 export，補 17 個 channel（17 → 34）；`PATH_AWARE_CHANNELS` 改為由 `PATH_ARG_SCHEMA` key 推導（仍是可變 `Set`，既有 `tests/path-aware-channels.test.ts` 的 back-compat 測試仍可 add/delete）
  - 新增 `PATH_FREE_CHANNELS`（Map，channel → 理由）、`SERVER_PATH_RESULT_CHANNELS`（Map，含 `claude:get-cli-path` 不轉的明確標註）
  - `PATH_RETURNING_CHANNELS` 補 `git-scaffold:healthCheck` / `getRepoInfo`；`normalizePathsInResult` 改寫其 `gitRoot`
- 新增 `electron/remote/__tests__/path-aware-channels-coverage.test.ts`（150 tests）
  - 守門：每個 `PROXIED_CHANNELS` 恰在 `PATH_ARG_SCHEMA` 或 `PATH_FREE_CHANNELS` 其一；四張表不得有非 proxied 的殘留；理由非空；回傳「轉 / 不轉」兩表互斥；`claude:get-cli-path` 必在不轉表且結果原樣
  - 轉換：每個 schema channel 必有 fixture，以 `WslPathTranslator('Ubuntu-24.04')` 斷言 `\\wsl.localhost\Ubuntu-24.04\home\x` → `/home/x`、`C:\Users\x` → `/mnt/c/Users/x`；server 形式輸入原樣（idempotent）；`IdentityTranslator`（本機）不變；非路徑參數（sessionId / model / comment body / prompt / customEnv）不動
  - 回傳：`gitRoot` `/home/x/repo` → `\\wsl.localhost\Ubuntu-24.04\home\x\repo`、`/mnt/c/Users/x` → `C:\Users\x`、`null` 保留；每個 `PATH_RETURNING` channel 真的會改寫；每個 `SERVER_PATH_RESULT` channel 原樣（`toBe` 同一物件）
- `remote-client.ts` / `path-translator.ts` **未改**（套用點與 translator 沿用既有機制）

| 證據道 | 結果 | 內容 |
|---|---|---|
| 新測試 | PASS | 150 / 150 |
| 負向驗證 | 紅燈正確 | 暫時刪除 `claude:start-session` 的 schema 列 → 5 個失敗（含守門 `expected [ 'claude:start-session' ] to deeply equal []`）；以 scratchpad 備份覆回、`cmp` 確認一致後重跑 150 綠 |
| `npm run test:unit` | PASS | **109 files / 1825 passed / 1 skipped**（基線 1675；+150 為本單新測試） |
| `npx tsc --noEmit` | PASS | **40**（≤ 40） |
| `tsc -p tsconfig.node.json` | 本單 0 新增 | 該設定的既有 `downlevelIteration` 類錯誤，新測試改用 `Array.from` 避開，grep `path-aware-channels` 0 筆 |
| legacy node:test | PASS | `tests/path-aware-channels.test.ts` 9/9、`tests/remote-client-middleware.test.ts`、`tests/path-translator.contract.test.ts`（`npx tsx --test`，不在 vitest 範圍） |
| `npx vite build` | PASS | exit 0 |
| `npm run test:e2e` | PASS | 6 passed / 8 skipped / **0 failed** |
| WSL 部署 | 不需要 | 轉換在 client（main）端；依工單未部署 |
| 實機 UI | 交使用者 | 見下 |

### 使用者實機步驟

> 前提：用本 working tree 的 BAT（`npm run dev` 或打包）；WSL headless 不需重新部署。

1. 開 WSL profile（Ubuntu-24.04）視窗 → 新增工作區，選 `\\wsl.localhost\Ubuntu-24.04\home\gower\<某 git repo>`
2. 在該工作區開 **Claude 面板** → 送「`pwd` 並列出目前目錄」：應回 `/home/gower/<repo>`（修正前會是 server 上不存在的 `\\wsl.localhost\…` 而失敗或跑到別的目錄）；`/` 指令清單的 project skills 應出現該 repo `.claude/commands` 的項目；Resume 清單應列出該目錄的歷史 session
3. 同工作區開 **Git Graph**：應載入 commits，debug log `[git-graph] loaded N commits from \\wsl.localhost\Ubuntu-24.04\home\gower\<repo>`（gitRoot 已轉回 client 形式）
4. （若有 GitHub remote）開 GitHub 面板：PR / Issue 清單可載入
5. 開 **claude-cli worktree** 分頁：worktree 建立成功，終端 `pwd` 在 `/home/gower/<repo>/.worktrees/…`（或專案設定的 worktree 位置）
6. 再新增一個 `C:\…` 的 git repo 工作區（會出現 T0393 的 `/mnt/c` 提示，按確定）→ 重複步驟 2、3：`pwd` 應為 `/mnt/c/…`，Git Graph 載入且 log 中 gitRoot 為 `C:\…`
7. 本機 profile 視窗：Claude 面板 / Git Graph 行為不變

### 互動紀錄

無（`CT_INTERACTIVE=1` 但現況可由程式碼證據確定，未提問）

### Renew 歷程
無

### 遭遇問題

1. **Events 未納入本單**：`PROXIED_EVENTS` 的路徑轉換只有 `fs:changed`（`translateRemoteEventArgs`），且無守門。`claude:worktree-info` 刻意維持 server 形式（見盤點表 B 的 `worktree:create`），但其他 event 沒有逐一分類。建議後續小單：比照本單為 `PROXIED_EVENTS` 加分類守門
2. **自由文字中的路徑不轉**：prompt / comment body 中出現的本機路徑（例如拖檔到 Claude 對話框插入的 `C:\…`）不在 schema 範圍，遠端 agent 會看到 client 形式。屬 UX 議題，需另案評估（例如拖檔時依視窗 translator 轉寫）
3. **既有測試名稱過時**（`affects_files` 外，未改）：`tests/path-aware-channels.test.ts` 的「non-PATH_AWARE_CHANNELS channel returns args unchanged」以 `claude:start-session` 為例；本單後該 channel 已 path-aware，但測試傳的是 `['/client/proj']`（args[1] 不存在）所以仍綠。建議日後換成 path-free channel（例如 `claude:set-model`）
4. **既有行為記錄**（未改）：`git:diff-files` 為 `all-strings`，commitHash 也會經 `toServer`（對 hash 字串是 no-op，無害）；Docker translator 下 server 形式的 worktree 路徑回流 `toServer` 時，若 container 路徑恰好以某個 host mount 路徑開頭才會被誤轉（實務上不會）
5. T0406 新增 `workspace:sync-roots` 到 `PROXIED_CHANNELS` 時，本單守門會要求其分類（工單已註明由 T0406 自行處理）

**變更檔案**：`electron/remote/path-aware-channels.ts`（修改）、`electron/remote/__tests__/path-aware-channels-coverage.test.ts`（新增）、本工單。沒用 stash / reset / checkout / restore；沒部署 WSL；沒 push。

**Commit**：單一 commit（`git commit --only`），hash 見 `git log`（回報區在 commit 前寫入，不自我引用）

### 回報時間
2026-10-05T04:47:36+08:00
