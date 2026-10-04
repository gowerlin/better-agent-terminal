---
schema_version: 1
schema_kind: workorder
id: T0405
title: "PLAN-036 P2-H：git / github / worktree / git-scaffold 搬入共用模組並上線 headless；github:check-cli 改用 gh auth status（不取 token）"
type: impl
status: DONE
started_at: "2026-10-05T04:18:39+08:00"
updated_at: "2026-10-05T04:34:17+08:00"
completed_at: "2026-10-05T04:34:17+08:00"
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T04:17:20+08:00"
target_version: next
depends_on:
  - T0401
  - T0404
  - T0411
related:
  - "PLAN-036 排程（D130 / D133）：PLAN-037 完成後的 T0405 → T0406"
  - "T0386 回報區 §1（A 類 git / github / worktree / git-scaffold）、§3、建議清單 H"
  - "D133 附帶：`github:check-cli` 以 `gh auth token` 判斷登入（`main.ts:2358-2359`）→ 改 `gh auth status` exit code"
  - "T0407 剩餘風險 5 / T0414：server（systemd）PATH 不含 `~/.local/bin`；本機 WSL 的 gh 在 `/usr/bin`"
affects_files:
  - electron/handlers/git.ts
  - electron/handlers/types.ts
  - electron/git/git-ipc.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/gh-resolver.ts
  - electron/worktree-manager.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - electron/git/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **本機 Git / GitHub / worktree 面板行為不得改變**：搬移逐字搬，handler 內部邏輯不重寫（`github:check-cli` 的登入判斷除外，見範圍 3）。e2e 0 failed。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。不得在 WSL 執行會改變 repo 狀態的 git 指令（commit / push / worktree add 等）——整合測試用 `mkdtemp` 的暫存 repo。"
  - "🔴 不登入 gh、不讀 gh 的 token / hosts.yml 內容。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args + timeout（既有 git-ipc / gh-resolver 慣例）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0405 — git / github / worktree 上遠端（PLAN-036 P2-H）

## 元資料
- **工單編號**：T0405
- **任務名稱**：git / github / worktree / git-scaffold 共用註冊 + headless 上線
- **狀態**：DONE
- **建立時間**：2026-10-05 04:17 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「1. 搬移（Electron 行為不變）」並 commit，headless 上線未完成時回報 PARTIAL

## 背景

- PLAN-036：遠端（WSL / SSH / Docker）視窗已有終端（P0）、Claude 面板（T0401）、工具檢查與安裝（PLAN-037）。Git / GitHub / worktree 面板在遠端仍是 `No handler for channel`
- 現況：`main.ts` 有 19 個 `registerHandler('git:|github:|worktree:|git-scaffold:` 註冊（約 :2214-2451）；`electron/git/git-ipc.ts` 已用 `registerHandler` 外置（git-scaffold）；`headless-channel-status.ts` 有 22 個這四類 channel 列為 unsupported
- 這些 handler **不使用** `isPathAllowed`（path guard 只在 fs 類，T0406），所以本單不依賴 `workspace:sync-roots`
- WSL 上 git 2.43.0、gh 2.102.0（`/usr/bin`，T0414 安裝）皆存在；未登入 gh

## 範圍

1. **搬移**：新增 `electron/handlers/git.ts` 的 `registerGitHandlers(register, deps)`（git / github / worktree；git-scaffold 若 `git-ipc.ts` 已可共用則改由它註冊到兩端，做法 Worker 決定並說明），逐字搬入；`electron/handlers/` 不得 import electron
2. **headless 上線**：`createHeadlessHandlerModules` 加入；四類 channel 自 `HEADLESS_UNSUPPORTED` 移除（若有確實無法在遠端支援的，留下並寫明原因）
3. **`github:check-cli` 安全修正（D133）**：改用 `gh auth status` 的 exit code 判斷登入（stdout / stderr 丟棄，`timeout` 必設，逾時視為未知）；確認多帳號時的語意（`--active` 是否可用、gh 最低版本），與原本「只看 active account」一致或說明差異
4. **gh / git 解析**：headless 端的 gh / git 路徑解析要能找到 `~/.local/bin` 與 `/usr/local/bin` 等常見位置（server PATH 不含 `~/.local/bin`，T0414）；沿用 `gh-resolver.ts` 的掃描慣例
5. **smoke**：新增 **S11**：在暫存目錄 `git init` 一個 repo（server 端執行，結束刪除）或改用唯讀 channel（例如對 `$HOME` 做 `git-scaffold:healthCheck` / repo 偵測），確認 headless 回合理結果、`github:check-cli` 回 `installed: true` 且未登入；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0405」。做法由 Worker 決定，但 smoke 不得在使用者既有 repo 上寫入；`docs/remote-dev-overview.md` 補 S11

## 驗收條件

- [ ] `main.ts` 不再有這四類 `registerHandler(`（grep 證據），`electron/handlers/git.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding 守門綠
- [ ] headless harness（`mkdtemp` 暫存 repo）：至少 status / log / branch 類 git channel、worktree list、`github:check-cli` 經 WS 回傳正確
- [ ] 單元測試：`github:check-cli` 不再呼叫 `auth token`（spy 斷言 args），exit 0 / 1 / 逾時三種結果
- [ ] `npm run test:unit` 全綠（基線 1641）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附「塔台部署後 smoke 預期」與使用者實機步驟（WSL 遠端視窗開 Git / GitHub 面板）

## 不在範圍
- `fs:*` / `image:*` / `workspace:sync-roots`（T0406）
- gh 登入引導

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 §1 / §3 + `electron/handlers/claude.ts`（共用模組範本，T0401）+ `main.ts` 這四類註冊段 + `electron/git/git-ipc.ts` + `electron/gh-resolver.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 範圍 1–5 全部完成；驗收條件 6 項皆有證據（實機 smoke / 使用者實機步驟依工單由塔台部署後執行，見下）。

**Landing Zone Check**：PASS
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`affects_files` 前 5 個可測項皆存在 → PASS（informational）
- C-2：無 `branch` 欄位 → 不適用（實際 `main`）
- 環境：`CT_MODE=on`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**1. 搬移（Electron 行為不變）**
- 新增 `electron/handlers/git.ts`：`registerGitHandlers(register, deps)`，19 個 `worktree:*` / `git:*` / `github:*` handler 自 `main.ts` 搬入；`git-scaffold:*`（3）仍在 `electron/git/git-ipc.ts`，改為 `registerGitScaffoldHandlers(register, deps)` 由 `registerGitHandlers` 呼叫 → 兩端同一份註冊（做法說明：git-ipc 原本已是外置模組，只把 `registerHandler` 換成注入的 `register`，不重複搬檔）。
- `main.ts`：刪除 19 個 `registerHandler(` + `registerGitScaffoldHandlers()` 呼叫，改為一行 `registerGitHandlers(registerHandler, { getGithubCliPath: () => readPersistedSettingsSync()?.githubCliPath })`；移除 `resolveGhBinary` / `worktreeManager` / `registerGitScaffoldHandlers` import 與 module-level `cachedGhResolveResult` / `cachedGhCustomPath`。
- 搬移時的非逐字改動（皆為等價或安全性要求）：
  - `execSync('git …')` 字串呼叫 5 處（`get-github-url` / `branch` / `getRoot` / `status` / `getGithubRepoFromOrigin`）→ `execFileSync(git, [...array])`，options（`encoding` / `timeout` / `stdio` / `windowsHide`）原樣保留（memory_override：child_process 一律 execFile + array args）。`git:log` / `diff` / `diff-files` 原本就是 `execFileSync('git', …)`。
  - gh resolve cache 改為 `registerGitHandlers` 內的 closure；`settings:save` 中「githubCliPath 變更即清 cache」的 4 行刪除——cache 本來就以 customPath 為 key（`cachedGhCustomPath === customPath` 才命中），清除與否結果相同。
  - `worktree:merge`：原碼呼叫 `worktreeManager.mergeWorktree`，但該方法已在 `3a470eb`（"remove mergeWorktree — let users merge via CLI"）移除，**本來就會 reject TypeError**。逐字保留行為（以 `(worktreeManager as any)` 呼叫並加註解），未修。
- `electron/handlers/` 與 `git-ipc.ts` 皆無 electron import（grep 0 筆；electron-free 守門綠）。

**2. headless 上線**
- `headless-entry.ts`：新增 `createHeadlessGitModule(overrides)`（`getGithubCliPath` 讀 `<dataDir>/settings.json`）並加入 `createHeadlessHandlerModules`；`HeadlessServerOptions.git` 為測試 seam。
- `headless-channel-status.ts`：22 個 channel 全數自 `HEADLESS_UNSUPPORTED` 移除，無保留項。

**3. `github:check-cli` 安全修正（D133）**
- 不再執行 `gh auth token`；改以 `spawn(gh, ['auth','status','--hostname',<host>,'--active'], { stdio: 'ignore', windowsHide: true })` 的 **exit code** 判斷：0 → authenticated、其他 exit code → unauthenticated、spawn error / signal / 逾時 → `unknown`（逾時 kill 子行程）。stdout / stderr 從未進入本行程。
- timeout `GH_AUTH_STATUS_TIMEOUT_MS = 10_000`（`gh auth status` 會打 API 驗 token，5 s 偏緊）。改為 async spawn：原本 `execFileSync` 會卡 Electron main thread，換成網路檢查若仍同步會凍結 UI。
- 回傳形狀不變（`installed` / `authenticated` / `path` / `source` / `attemptedPaths` / `error?`），另加 `authState: 'authenticated' | 'unauthenticated' | 'unknown'`；`unknown` 時附 `error`。renderer 型別未改（多出的欄位 renderer 忽略；UI 對 unknown 顯示為「未登入」）。
- 語意對照（多帳號 / 版本）：
  - `--active`：本機 gh 2.102.0 `gh auth status --help` 實查有 `-a, --active  Display the active account only`，且說明 exit 1 只針對「顯示的帳號」有問題 → 與原本「只看 active account」一致（原碼註解的顧慮即「非 active 帳號壞掉會讓 status exit 1」）。
  - 最低版本：`--active` 與多帳號同在 gh **2.40.0** 引入（依記憶的 gh changelog，**未實機驗證** 2.39 / 2.40）。實作以 `gh --version` 判斷：≥ 2.40.0 加 `--active`；更舊版本每 host 只有一個帳號，plain `auth status` 即等同 active；版本解析不出 → 視為新版加 `--active`。
  - host：檢查 `GH_HOST`（須符合 `/^[a-zA-Z0-9._-]+$/`）否則 `github.com`——即面板 `gh … --repo owner/repo` 實際會打的 host。差異：只登入 GHE 且未設 `GH_HOST` 的使用者，舊版 `auth token` 可能回 0（gh 預設 host 推導細節未查證），新版判為未登入；面板本身只解析 github.com remote，影響面小。
  - 新增差異：`auth status` 會連網驗 token → **離線時判為未登入**（舊版只讀本機 token，離線也回 authenticated，但離線時面板本來也載不了資料）；token 已失效時新版正確判為未登入（舊版誤判已登入）。

**4. gh / git 路徑解析**
- `gh-resolver.ts` 新增 `resolveGitBinary()`：同 gh 慣例 PATH → 常見位置（linux `/usr/bin/git`、`/usr/local/bin/git`、`~/.local/bin/git`；darwin 另加 `/opt/homebrew/bin/git`；win32 `%ProgramFiles%\Git\cmd\git.exe`）；`getHome()` 加 `os.homedir()` fallback（無 HOME 的 service 也能找到 `~/.local/bin`）。gh 的常見位置原本已含 `/usr/local/bin` / `/usr/bin` / `~/.local/bin`，未改。
- headless：`createHeadlessGitBinaryResolver()`（命中快取、未命中回 `git` 並於下次重試）注入 `getGitBinary`，套用於 `git:*`、`git-scaffold:*`（simple-git `binary` 選項；不合 simple-git 字元白名單時退回 `git`）與 `worktreeManager.setGitBinaryResolver()`（singleton，與 headless claude module 的 ClaudeAgentManager 共用）。
- Electron：不傳 `getGitBinary` → 仍是 plain `git`（行為不變）。

**5. smoke S11**（`scripts/smoke-remote-headless.mjs` + `docs/remote-dev-overview.md`）
- 先 `github:check-cli`（invoke timeout ≥ 20 s）：PASS 需 `installed: true` + boolean `authenticated`，evidence 列 `authenticated` / `authState`。舊 server → `No handler … — server predates T0405` FAIL，且**不建 PTY / repo**。
- 再開第二個 smoke PTY（`<ptyId>-git`）在 server 端 `mktemp -d /tmp/bat-smoke-git.XXXXXX` + `git init` + 一個 `--allow-empty` commit（`-c user.*`、`commit.gpgsign=false`、`--no-verify`），對該 repo 查 `git:getRoot` / `git:branch` / `git:log` / `git:status` / `git-scaffold:healthCheck`，`worktree:status(未知 session)` 應為 `null`；結束 `case "$d" in /tmp/bat-smoke-git.*) rm -rf -- "$d";; esac` 並確認刪除，kill 該 PTY；最終 cleanup 再以 existence probe 確認。不碰使用者 repo、不登入 gh、不讀 token。

**變更檔案**
- 新增：`electron/handlers/git.ts`、`electron/__tests__/git-handlers.test.ts`、`electron/remote/__tests__/headless-git.test.ts`
- 修改：`electron/main.ts`、`electron/git/git-ipc.ts`、`electron/gh-resolver.ts`、`electron/worktree-manager.ts`、`electron/remote/headless-entry.ts`、`electron/remote/headless-channel-status.ts`、`electron/__tests__/gh-resolver.test.ts`、`electron/remote/__tests__/proxied-channels-binding.test.ts`（scanner 補掃 `electron/git/` 的 `register(`，否則 `git-scaffold:*` 掃不到）、`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`、`docs/remote-dev-overview.md`
- `electron/handlers/types.ts`：未需修改

**驗證證據**（皆本機 Windows 實跑）
| 驗收條件 | 結果 | 證據 |
|---|---|---|
| main.ts 無四類 `registerHandler(`；handlers/git.ts 不 import electron | PASS | `grep -cE "registerHandler\('(git\|github\|worktree\|git-scaffold):" electron/main.ts` → 0；handlers/ + git-ipc electron import grep → 0；`'auth', 'token'` 於 electron/ 非測試碼 → 0 |
| parity / electron-free / proxied-binding 守門 | PASS | `electron/remote/__tests__` 全綠（headless-parity / headless-electron-free / proxied-channels-binding 含在 `npm run test:unit`） |
| headless harness（mkdtemp repo） | PASS | `headless-git.test.ts` 7/7：真 git 建暫存 repo → 經 WS `git:getRoot` / `branch`（main）/ `log`（2 commits）/ `status`（M + ??）/ `diff-files` / `diff`、`git-scaffold:healthCheck` / `getRepoInfo` / `listCommits`、`worktree:create → status → remove`（branch 一併刪除）、`github:check-cli`（fake gh：`installed: true, authenticated: false, authState: unauthenticated`，spawn args `['auth','status','--hostname','github.com','--active']`）、非 repo 目錄回空值 |
| 單元測試：不呼叫 `auth token`、exit 0 / 1 / 逾時 | PASS | `git-handlers.test.ts` 16/16：spy 斷言所有 spawn / execFileSync args 不含 `token` / `--show-token`；exit 0 → authenticated、exit 1 → unauthenticated、逾時 → unknown + child.kill、spawn error / signal → unknown；版本 / GH_HOST 參數；`gh-resolver.test.ts` 新增 `resolveGitBinary` 4 案 |
| `npm run test:unit` 全綠（基線 1641） | PASS | `Test Files 108 passed (108)`、`Tests 1675 passed \| 1 skipped (1676)`（輸出中的 `Error: AttachConsole failed` 為既有 Windows node-pty conpty agent 雜訊，修改前首跑即出現，非失敗） |
| `npx tsc --noEmit` ≤ 40 | PASS | 40（與本單開工前基線相同；該設定只涵蓋 `src/`）。補充：`tsc -p tsconfig.node.json`（非守門，基線本有 155 筆）過濾本單觸及檔，除 ES target 類 TS2802 外無新錯誤（`worktree-manager.ts:14` / `server-entry.ts` 為既有） |
| `npx vite build` exit 0 | PASS | exit 0 |
| `npm run test:e2e` 0 failed | PASS | `6 passed, 8 skipped`（exit 0） |
| smoke 腳本單元測試 | PASS | `smoke-remote-headless.test.mjs` 75/75（新增 S11 PASS / 舊 server / gh 缺 / git 答錯仍清理 / `checkGitAnswers` / 暫存 repo regex） |
| WSL 實機 smoke | 未執行（依工單） | 不得部署、不得 restart；由塔台部署後跑 |

**Commit**：見下方 git log（回報區寫入在 commit 之前，不自我引用 hash）；`git commit --only` 實際改動檔 + 本工單；未 push。

### 塔台部署後 smoke 預期

`npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`（部署本單 JS 後）：
- S1–S10：維持原結果（PASS）。
- **S11 PASS**，evidence 形如：`github:check-cli → installed /usr/bin/gh (path), authenticated=false authState=unauthenticated; temp repo /tmp/bat-smoke-git.XXXXXX: getRoot ok, branch master(或 main), log 1 commit <7碼>, status clean, git-scaffold isRepo; worktree:status → null; temp repo removed`。
  - gh 來源預期 `path`（`/usr/bin` 在 service PATH 內）。
  - `authState` 預期 `unauthenticated`（WSL gh 未登入）；若 WSL 無網路，`gh auth status` 仍 exit 1 → 同樣 `unauthenticated`；若 10 s 無回應則 `unknown`（S11 仍 PASS，evidence 可見）。
- cleanup：`no smoke PTY left`，evidence 多一段 `pty:write(<ptyId>-git) → {"ok":false,"reason":"pty-not-found"}`。
- **未部署前**（舊 server）跑 smoke：S11 FAIL `No handler for channel: github:check-cli — server predates T0405`，總結 10/11、exit 1——屬預期。
- 部署後可人工確認無殘留：`wsl -d Ubuntu-24.04 -- ls -d /tmp/bat-smoke-git.* 2>/dev/null`（應無輸出）。

### 使用者實機步驟

（塔台部署 + smoke 通過後）
1. 開 WSL 遠端 profile 視窗，工作區選 WSL 內的 git repo（例如 `/home/<user>/<repo>`）。
2. **Git 面板**：分支名、commit 列表（`git:log`）、變更檔（`git:status`）、點 commit 看 diff（`git:diff-files` / `git:diff`）應顯示 WSL repo 內容，不再出現 `No handler for channel`。
3. **Git Graph 面板**（git-scaffold）：應載入 commit graph。
4. **GitHub 面板**：同意後應顯示「gh 已安裝但未登入」提示（WSL gh 未登入）；不應出現 `No handler` 或「未安裝」。若要驗已登入路徑，需另在 WSL 執行 `gh auth login`（不在本單範圍）。
5. **Settings → GitHub CLI → 測試**（本機視窗）：本機行為應與以前相同（已登入 → success 訊息）。注意：現在會連網驗 token，約需 1–2 秒。
6. （選）在本機視窗的 Git / GitHub 面板確認行為未變。

### 互動紀錄
無（`CT_INTERACTIVE=0`，fire-and-forget）

### Renew 歷程
無

### 遭遇問題

1. **既有缺陷（未修，建議另案）**：`worktree:merge` 呼叫已不存在的 `WorktreeManager.mergeWorktree`（`3a470eb` 移除），兩端都會 reject TypeError；preload / `electron.d.ts` 仍暴露 `worktree.merge`。建議另開 BUG：移除 channel 與 preload API，或補實作。
2. **路徑轉換缺口（未改，超出 affects_files）**：`electron/remote/path-aware-channels.ts` 的 `PATH_AWARE_CHANNELS` 只含 `git:*` 7 個；`github:*`、`git-scaffold:*`、`worktree:create`（cwd 在第 2 參數）的路徑參數**不做 client→server 轉換**。若遠端視窗的 workspace 路徑是 client 端形式（例如 `\\wsl.localhost\…`），這些 channel 會拿到 server 不認得的路徑；若 workspace 本身就是 server 路徑（`/home/...`）則無影響。e2e E4 顯示 WSL 視窗資料夾對話框預設 `\\wsl.localhost\Ubuntu-24.04\home\gower` → **有實際風險**，建議塔台在使用者實機步驟 3/4 特別觀察，必要時開單補 path-aware 設定（`git-scaffold:*` first-string、`github:*` first-string、`worktree:create` 需新 schema）。
3. headless 的 git / gh 子行程繼承 server 的 `process.env`（與 Electron 相同、未過濾 `BAT_*`）。git / gh 不讀 `BAT_*`，暫不處理；若要與 remote-tools 一致可另案套 `isHeadlessScrubbedEnvKey`。
4. `--active` 最低版本 2.40.0 為記憶值，未以舊版 gh 實測（見範圍 3 說明）。
5. 執行中 bash heredoc 解析含 `case … in …)` 的 Python patch 失敗一次，改寫成 scratchpad 檔再執行；無產品影響。

### 回報時間
2026-10-05T04:32:52+08:00（回報區撰寫時系統時間；最終完成時間見 frontmatter `completed_at`）
