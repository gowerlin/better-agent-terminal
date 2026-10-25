---
schema_version: 1
schema_kind: workorder
id: T0583
title: "PLAN-047 W1-1：worktree 隔離派工（`--isolation worktree`、repo 外位置、`ct/T####` 分支、`CT_HOME`）+ `--close-worker --worktree keep|remove|archive`"
type: feature
status: DONE
started_at: "2026-10-17T21:54:32+08:00"
updated_at: "2026-10-17T22:20:26+08:00"
completed_at: "2026-10-17T22:20:26+08:00"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-17T21:52:34+0800"
target_version: "0.7.0-pre.2（候選，與 T0582 / T0584 / T0585 同批再定）"
depends_on: []
related:
  - "PLAN-047（§一.6、§三之一、§三之二）、T0574 回報區 R5（實測數據、CT_HOME 方案 (a)+(c)、C-0 修正）與「CT 端需要配合的變更與介面契約要點」"
  - "D150 / D152；T0523（派工落點）、T0527（cwd 檢核）、T0535 / T0537 / T0545（`--close-worker` 與已存歸屬）、T0553（Worker 標題）、T0577（產品測試不再讀 `_ct-workorders/`）"
  - "並行工單 T0582（M1-1）：同樣會改 `electron/remote/helper-capability.ts` 與 `CLAUDE.md`"
affects_files:
  - "electron/ct-worktree.ts（新，名稱可自訂；git 操作一律 execFile + array args + timeout）"
  - electron/terminal-command-handlers.ts
  - electron/close-worker.ts
  - electron/main.ts
  - "electron/remote/headless-entry.ts（headless 對等或明確拒絕）"
  - "electron/remote/helper-capability.ts（只限 create-* 參數驗證若需放行 `isolation`；不動 `HELPER_CHANNEL_ROLES`）"
  - electron/pty-manager.ts
  - scripts/bat-terminal.mjs
  - "src/stores/workspace-store.ts、src/types/index.ts（分頁記錄 worktree 資訊，比照 T0537 欄位）"
  - "electron/__tests__/**、src/**/__tests__/**、e2e/t0583-*.spec.ts（新）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0583-worktree-isolated-dispatch.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0582 同時在改 `electron/remote/helper-capability.ts`（它只動 `HELPER_CHANNEL_ROLES` 與範圍判定）與 `CLAUDE.md`（它新增查詢 channel 小節）。你不動角色表；CLAUDE.md 只新增你自己的小節。commit 前 `git diff -- <檔>` 確認只含你的 hunk；若檔案已有對方未 commit 的變更，用 `git add -p` 只 stage 自己的 hunk，不得夾帶。"
  - "🔴 實測一律用 temp 目錄的**臨時 git repo**，不得在本 repo 或其上層建立 worktree / 分支（T0574 L155：Worker 曾誤在主 repo 建 worktree）。e2e 用隔離實例（需先 `npx vite build`），不碰使用者的 BAT（9876）與其 Terminal Server。"
  - "🔴 BAT 不執行任何依賴安裝 / setup 指令（D152：由 Worker 依專案規則自己裝）。不做合併、不做 `worktree:terminal-status`（T0585）。現有 `WorktreeManager`（Agent 面板 / `claude-cli-worktree` preset，repo 內 `.bat-worktrees`）行為不得改變。"
---

# T0583 — worktree 隔離派工（W1-1）

## 背景

PLAN-047 軌道 W（D150 / D152）：工單可選擇在獨立 worktree 執行，main 在合併工單 `--ff-only` 前不動。本單讓 BAT 在派工時建立 worktree、在回收時清理；合併由 CT 合併工單負責（CT-T016），BAT 不新增合併能力。T0574 R5 已實測位置、長路徑、成本與 CT_HOME 方案。

## 介面契約（本單定稿，CT-T015 / CT-T016 依此撰寫；實作若需調整，回報區寫明差異與理由）

**派工**：`bat-terminal.mjs … --skill ct-exec|ct-done --workorder T#### --isolation worktree`

- `--isolation` 只收 `worktree`（去空白、不分大小寫）；其他值 → 用法錯誤 exit 1。不帶 = 現行行為（不隔離，D152：預設關閉）。
- 必須搭配 `--workorder`（agent skill 模式）；raw command 模式或沒有 `--workorder` → 用法錯誤 exit 1。
- 主 checkout = 派工 cwd 的 `git rev-parse --show-toplevel`（cwd 檢核 T0527 照舊用原 cwd）。不是 git repo → 失敗。
- 位置：`<主 checkout 的上層>/.bat-worktrees/<主 checkout 目錄名>/<T####>`；分支 `ct/<T####>`；base = 派工當下主 checkout 的 `HEAD` SHA。
- 已存在且就是 `ct/<T####>` 的 worktree（Renew / 重派）→ 沿用、不重建，標 `reused`；分支在但 worktree 不在 → 在既有分支上建 worktree；路徑被其他東西佔用 → 失敗。
- Windows 長路徑：git 指令視需要帶 `-c core.longpaths=true`（T0574 實測 clone 需要；worktree add 是否需要請實測並寫明）。
- PTY cwd = worktree 內對應的相對位置（cwd 在 repo 子目錄時保留子路徑）。
- BAT 注入（由 BAT 主行程加，不經呼叫者 `customEnv`）：`CT_HOME` = 主 checkout 絕對路徑、`CT_WORKTREE` = worktree 路徑、`CT_WORKTREE_BRANCH` = `ct/<T####>`、`CT_WORKTREE_BASE` = base SHA。
- 成功 stdout 在既有 `✓ Terminal created` / `workspace:` / `agent:` 之後多印：`  worktree: <path>`、`  branch: ct/T####`、`  base: <sha>`（`reused` 時加註 `(reused)`）。
- 失敗：helper **exit 7**，stderr `create: WORKTREE_FAILED`（含原因一行，不含權杖）；**不建立分頁**。`bat-scripts.log` 事件記 `isolation` / `worktree` / `branch` / `base` / `reused`。

**回收**：`bat-terminal.mjs --close-worker T#### --notify-id … [--delay-ms n] [--worktree keep|remove|archive]`

- 不帶 = `keep`（只關分頁）。`--worktree` 只在 `--close-worker` 模式有效，其他模式帶它 → 用法錯誤。
- 清理在**分頁實際關閉時**執行（延遲 / 等安靜 / 使用者輸入取消的 T0545 / T0551 規則不變；取消則不清理）。
- `remove`：`git worktree remove`（不加 `--force`）；分支保留（合併工單需要）。worktree 有未提交變更 → 不刪、記 warn `[ct-worktree] … kept (uncommitted changes)`。
- `archive`：同 `remove`，另把分支改名 `ct-archive/<T####>`（已存在則加時間後綴）。
- 只處理本單建立的 worktree（位置規則 + 分支名 `ct/` 雙重確認）；Worker 分頁不是隔離派出的 → 忽略 `--worktree`，照常關分頁並在 stdout 註明。
- exit code 與既有 `--close-worker` 相同（清理結果只進日誌，因為清理晚於 helper 結束）。

**持久化**：worktree 資訊（path / branch / base / mainCheckout）記在 `PtyInstance` 與分頁（`TerminalInstance`，隨 `workspace:save` 存，比照 T0537 的 `towerTerminalId` / `workorder`），BAT 重開後 `--close-worker --worktree` 仍可用。

## 任務

1. `electron/ct-worktree.ts`：建立 / 沿用 / 移除 / 封存，全部 `execFile('git', [...])`、timeout（建立 30 s、查詢 5 s），工單號以 `--workorder` 既有正規化結果並再過白名單 `^[A-Za-z0-9._-]+$`。
2. `create-agent-command` / `createWithCommand`：解析 `isolation`，在 PTY 建立前建 worktree、改 cwd、注入 env；失敗回 `{ ok:false, code:'WORKTREE_FAILED', message }`；Recovery create hold（T0578 / T0580）順序不變。
3. 範圍權杖：確認 helper 權杖的 create 參數檢查放行 `isolation`（只放行這一個新欄位）；`CT_*` 由 BAT 注入，不放寬呼叫者 `customEnv` 白名單。
4. `close-worker`：`--worktree` 參數一路帶到 scheduler，關閉時執行清理；BAT 重開後以已存分頁資訊執行。
5. helper `bat-terminal.mjs`：新參數、互斥規則、`--help`、exit 7、stdout 行。
6. headless：同一份實作可用則對等支援；若遠端情境（server 上的 repo）有無法處理的差異，改回明確錯誤並寫進 CLAUDE.md 已知限制。
7. 測試：temp git repo 的單元測試（建立 / 沿用 / 分支已在 / 路徑被佔 / 非 git / 子目錄 cwd / remove 乾淨與髒 / archive / 名稱碰撞）、handler 與 helper exit code、持久化往返；e2e 隔離實例：temp repo 內派 `--isolation worktree` 的 Worker（自訂 CLI 跑 node 腳本記錄 `process.cwd()` 與 `CT_*` env，不耗 token）→ cwd 在 worktree、env 正確、分支存在 → `--close-worker --worktree remove` → 分頁關閉後 worktree 消失、分支仍在。
8. CLAUDE.md：新增「worktree 隔離派工（PLAN-047 W1 / T0583）」小節：契約、位置與命名、env、清理規則、持久化、已知限制、驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元測試與 e2e 通過；不帶 `--isolation` 的派工行為與現在完全相同（既有派工 / close-worker 測試全綠）。
3. 回報區附：長路徑實測結果、實際 stdout 範例、與契約的差異（若有）、給 CT-T015（CT_HOME / C-0 / SHA 回報）的注意事項。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果

**DONE**：契約全部實作（派工 `--isolation worktree`、回收 `--worktree keep|remove|archive`、持久化、headless 對等），驗收條件 1–3 全部通過。與契約的差異都是補充細節，列在「與契約的差異」，沒有改變 CT 端可觀察的介面（exit code、stdout 行、env 名稱）。

### 落點檢查

- C-0 **PASS**：frontmatter `repo` = `better-agent-terminal`，`basename(git rev-parse --show-toplevel)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS（工單在 REPO_ROOT 底下）；C-3 PASS（資訊性，`electron/terminal-command-handlers.ts` 等皆存在）；C-2 不適用（無 `branch` 欄位，HEAD = `main`）
- 觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 實作摘要

| 部分 | 檔案 | 內容 |
|---|---|---|
| worktree 服務 | `electron/ct-worktree.ts`（新） | `CtWorktreeService.prepare` / `cleanup`、位置 / 分支 / env 規則、`parseCtWorktreeRecord`（清理前驗位置 + `ct/` 分支）、porcelain 解析；全部 `execFile('git', [...])` + timeout（查詢 5 s、add 30 s、remove 300 s），win32 一律 `-c core.longpaths=true`；不 import electron |
| 派工 | `electron/terminal-command-handlers.ts` | `create-agent-command` 解析 `isolation`（只 skill 模式）；`createWithCommand` 在 Recovery hold **之後**、`ptyManager.create` 之前建 / 沿用 worktree，改 cwd、注入 `CT_HOME` / `CT_WORKTREE*`（呼叫者同名鍵丟棄）、PTY 記 `worktree`、報告與 `terminal:created-externally` 帶 `worktree` / `ctWorktree`；失敗回 `{ ok:false, code:'WORKTREE_FAILED', error }`；隔離派工不經 `invokeHandler`；`create-with-command` payload 帶 `isolation` 一律拒絕 |
| 回收 | `electron/close-worker.ts` | `worktree` 參數（非法 → `INVALID_ARGS`）、回應 `worktree: { mode, isolated, path?, branch? }`、close request 後每 1 s 查 `isAlive`，連續兩次不在才清理，60 s 仍在 → 保留；取消不清理；日誌 `[ct-worktree]` |
| 持久化 | `electron/pty-manager.ts`、`electron/worker-ownership.ts`、`src/types/index.ts`、`src/stores/workspace-store.ts`、`electron/preload.ts`、`src/types/electron.d.ts` | `PtyInstance.worktree`（restart / recovery / 冪等 re-create 沿用）、`getWorktree()`；分頁 `TerminalInstance.ctWorktree`（隨 `workspace:save` 存、detached adopt 沿用；與 Agent 面板 `worktreePath` 分開）；重開後 `withSavedWorkerOwnership.getWorktree` 由已存分頁取得（只收符合規則且工單號一致者） |
| 接線 | `electron/main.ts`、`electron/handlers/terminal.ts`、`electron/remote/headless-entry.ts` | 本機 `CtWorktreeService`（plain git）；headless 用 `createHeadlessGitBinaryResolver()` + 去 `BAT_*` env，同一份實作（對等支援，不是拒絕） |
| 權杖 | `electron/remote/helper-capability.ts` | `authorizeHelperInvoke` 只新放行 `isolation`（`create-agent-command`、值 `worktree`；否則 `isolation-not-allowed` / `invalid-isolation`）；`HELPER_CHANNEL_ROLES`、`HELPER_CREATE_ENV_KEYS` 未動 |
| helper | `scripts/bat-terminal.mjs` | `--isolation` / `--worktree` 解析與互斥、`--help`、exit 7 + `create: WORKTREE_FAILED`、stdout `worktree:` / `branch:` / `base:`、隔離派工 invoke 逾時 40 s、`--worktree` 的 stdout 說明、舊 BAT 警告、日誌欄位 |
| 文件 | `CLAUDE.md` | 新增「worktree 隔離派工（PLAN-047 W1 / T0583，D150 / D152）」小節（只新增，未改其他小節） |
| 測試 | `electron/__tests__/ct-worktree.test.ts`（23）、`electron/__tests__/ct-worktree-dispatch.test.ts`（24）、`electron/__tests__/bat-terminal-worktree.test.ts`（18）、`src/stores/__tests__/workspace-store.ctWorktree.test.ts`（4）、`e2e/t0583-worktree-isolated-dispatch.spec.ts` | 見驗證 |

### 與契約的差異（補充，CT 可觀察介面未變）

1. **沿用 / 既有分支時的 `base`**：契約寫「base = 派工當下主 checkout 的 HEAD」。新建分支照此；但 `reused` 或「分支在、worktree 不在」時分支不是現在才從 HEAD 開的，回報 `git merge-base HEAD ct/<T####>`（fork point；main 沒被改寫時就是原本的 base）。理由：直接報現在的 HEAD 會讓 CT 以為工單分支從一個它根本不含的 commit 開始。
2. **位置登記但目錄已刪（prunable）**：先 `git worktree prune` 再在既有分支上重建（契約未提；不處理會一直卡在「已登記」）。
3. **helper invoke 逾時**：`--isolation worktree` 時 40 s（一般仍 3 s）。理由：主行程 Recovery hold 最多 2 s + `git worktree add` 最多 30 s；3 s 逾時會造成「helper exit 1、Worker 稍後仍建立」的重派風險（同 T0580 的考量）。
4. **清理時機的定義**：「分頁實際關閉」= close request 送出後，PTY 連續兩次（間隔 1 s）不在；60 s 內沒關（沒有視窗持有、或使用者 ⏻ 重啟）→ 保留並 warn。延遲期間使用者自己按 ✕ 關掉 → 不清理（請求未執行）。清理失敗（例如 Windows 檔案鎖）不重試，保留並 warn。
5. **`archive` 名稱碰撞後綴**：`ct-archive/<T####>-YYYYMMDD-HHMMSS`（本地時間；再碰撞加 `-1`…）。
6. **互斥補充**：`--close-worker` 與 `--isolation` 互斥（`--isolation` 視為建立分頁的參數）；`--set-role` 與 `--worktree` 互斥。明確帶 `--worktree keep` 時回應也帶 `worktree: { mode: 'keep', … }`（只顯示，不清理）。
7. **主行程對非法 `isolation`**：helper 先擋（exit 1 用法錯誤）；繞過 helper 直送非法值 / prompt 模式時主行程回 `WORKTREE_FAILED`（helper 會 exit 7）。
8. **affects_files 以外的檔案**（必要接線，未改其行為）：`electron/worker-ownership.ts`（重開後由已存分頁取 worktree，任務 4）、`electron/handlers/terminal.ts`（把 `ctWorktree` 傳進共用 handler）、`electron/preload.ts`、`src/types/electron.d.ts`（`onCreatedExternally` 型別加 `ctWorktree`）。

### 長路徑實測（Windows 11，git 2.56.0.windows.2；temp repo，worktree 內最長路徑 333 字元）

| 動作 | 不帶 `core.longpaths` | 帶 `-c core.longpaths=true` |
|---|---|---|
| `git worktree add -b ct/T…` | ❌ `fatal: cannot create directory at 'aaaa…': Filename too long`；worktree 未登記，但**分支 `ct/T0001` 已建立** | ✅ |
| `git -C <wt> status --porcelain` | ⚠️ `warning: could not open directory … Filename too long`，長路徑檔顯示為 ` D`（已刪除） | ✅ 空（乾淨） |
| `git worktree remove <wt>` | ❌ `contains modified or untracked files, use --force` | ✅ rc=0 |

⇒ win32 每個 git 呼叫都帶 `-c core.longpaths=true`（`CtWorktreeService.git`，單元測試斷言）。前面那個殘留分支的情境也由「分支在、worktree 不在 → 在既有分支上建」涵蓋。實驗在 scratchpad 的 temp repo，結束已刪除。

### 實際 stdout（e2e 隔離實例）

```
✓ Terminal created: 376371b33d1872644dcb45f838d43336
  workspace: T0583 (e2e-t0583-ws) — the Tower terminal's workspace (--notify-id)
  agent: e2e-t0583-worker (--agent default: the workspace's default agent)
  worktree: <使用者資料夾>\AppData\Local\Temp\bat-t0583-r1LR5i\.bat-worktrees\repo\T0583
  branch: ct/T0583
  base: 521d99e870c8c2d603b5624a59376e2fd7cd91bb
```

Worker 端（自訂 CLI 的 node 腳本記錄）：`cwd` = `…\.bat-worktrees\repo\T0583\pkg`（派工 cwd 為 `<repo>\pkg`）、`CT_HOME` = `…\bat-t0583-r1LR5i\repo`、`CT_WORKTREE` = `…\.bat-worktrees\repo\T0583`、`CT_WORKTREE_BRANCH` = `ct/T0583`、`CT_WORKTREE_BASE` = `521d99e8…`（40 字元）。

```
Error: Failed to create terminal (WORKTREE_FAILED): cwd <使用者資料夾>\AppData\Local\Temp\bat-t0583-r1LR5i\plain is not a git repository (fatal: not a git repository (or any of the parent directories): .git)
create: WORKTREE_FAILED
```
（exit 7，沒有建立分頁）

```
✓ Worker close scheduled: 376371b33d1872644dcb45f838d43336 (in 0 ms)
  If the tab is still printing then, BAT waits until it is quiet (at most 60 s more).
  worktree: remove C:\…\.bat-worktrees\repo\T0583 once the tab is closed (branch ct/T0583 kept; result in the BAT log)
```
重開 BAT 後：`worktree: archive C:\…\.bat-worktrees\repo\T0584 once the tab is closed (branch ct/T0584 → ct-archive/T0584; result in the BAT log)`。未隔離的 Worker：`worktree: ignored (T#### was not dispatched with --isolation worktree)`。

### 給 CT-T015 / CT-T016 的注意事項

1. **`CT_HOME`** = 主 checkout 絕對路徑（git toplevel 經 `path.resolve`，Windows 為反斜線）。worktree 內也有一份 `_ct-workorders/`（base 當下的副本）；讀寫與 commit 工單一律走 `$CT_HOME/_ct-workorders/`（`git -C "$CT_HOME" commit --only …`），worktree 中勿 stage `_ct-workorders/`。
2. **C-0 在 worktree**：`basename(git rev-parse --show-toplevel)` 是 `T####`，必須改用 `basename "$CT_HOME"`，或 `basename(dirname(realpath(git rev-parse --git-common-dir)))`。
3. **SHA**：`CT_WORKTREE_BASE` 為完整 40 字元 SHA（同 stdout `base:`）；`reused` 時是 `merge-base HEAD ct/T####`（見差異 1）。`head_sha` 用 `git -C "$CT_WORKTREE" rev-parse HEAD`。
4. **exit code**：建立失敗 = **7**（stderr `create: WORKTREE_FAILED`，下一行前已印原因）；其他 exit 碼不變。`--close-worker` 的 exit 碼不變，清理結果只在 BAT 日誌（`[ct-worktree] … → removed …; branch kept` / `→ archived …` / `→ … kept (uncommitted changes)` 等）。
5. **`--worktree remove` 不會刪有未提交或未追蹤變更的 worktree**（不 `--force`）：Worker 收工前要全部 commit；ignored（`node_modules`）照刪。分支 `ct/T####` 一律保留給合併工單；`archive` 會把它改名成 `ct-archive/T####`，合併前不要用 `archive`。
6. **依賴安裝**：worktree 裡沒有 `node_modules`（D152 BAT 不裝），Worker 依專案規則自己 `npm ci`（T0574：約 16 s / 2 GB）。
7. 同一工單重派（Renew）會沿用既有 worktree 與其中的 commit；要從新的 HEAD 重來需先 `--worktree archive`（或手動處理分支）。

### 驗證

| 項目 | 結果 |
|---|---|
| `npx vite build` | PASS（最終一次在全部變更後） |
| `npm run typecheck` | **0**（中途一次因 T0582 未追蹤的 `src/lib/terminal-output-redaction.ts` 有 1 個 TS6133，非本單；最終一次 0） |
| `npm run typecheck:electron` | **0** |
| `npm run test:unit` | PASS：277 files，4890 passed / 3 skipped（最終一次）。中途一次 1 failed 為 T0582 進行中的 `HELPER_CHANNEL_ROLES` 擴充（`helper-capability.test.ts` 白名單），非本單 hunk，之後 T0582 已同步測試 |
| 新單元測試 | `ct-worktree.test.ts` 23、`ct-worktree-dispatch.test.ts` 24、`bat-terminal-worktree.test.ts` 18、`workspace-store.ctWorktree.test.ts` 4，全綠；相關既有測試（`close-worker` / `worker-ownership` / `terminal-handlers` / `bat-terminal-close-worker` / `bat-terminal-set-role`）合計 9 檔 271 項全綠 |
| e2e `t0583-worktree-isolated-dispatch.spec.ts` | PASS（16.4 s）：子目錄派工 → cwd / `CT_*` / 分支 / 主 checkout 未動；非 git → exit 7、無分頁；`--worktree remove` → 分頁關閉後 worktree 消失、分支保留（Windows 上 shell 結束後即可移除）；派 T0584 → 重開 BAT → `--worktree archive` 由已存分頁找到 → `ct-archive/T0584` |
| 回歸 e2e | `t0535-close-worker.spec.ts` + `t0537-worker-ownership-persistence.spec.ts` PASS（45.8 s） |
| 主 repo 安全 | 全程 `git worktree list` 只有主 checkout、無 `ct/*` / `ct-archive/*` 分支；測試 / e2e 的 git 夾具都先斷言 toplevel 是自己的 temp 目錄 |

### Commit

- 精準 staging：T0582 同時在改 `electron/pty-manager.ts`、`electron/remote/headless-entry.ts`、`electron/remote/helper-capability.ts`、`electron/main.ts`、`CLAUDE.md`。這 5 個檔以「HEAD + 本單變更」直接寫入 index（`git hash-object -w` + `git update-index --cacheinfo`，工作樹不動），T0582 的 hunk 全部留在工作樹未 stage；`src/styles/settings.css` 未動。
- `462522ef` feat: T0583 worktree-isolated dispatch and --close-worker --worktree（16 檔：新模組、handler、scheduler、helper、renderer、測試、e2e、本工單回報）
- `4e7da0e3` feat: T0583 wire worktree isolation into shared files（5 個共用檔中本單的 hunk）。**原因**：第一次 commit 前，寫進 index 的這 5 檔在 commit 前被重設回 HEAD（推測是並行的 T0582 操作 index；本單未執行任何 reset / restore），所以 `462522ef` 少了它們、單獨看會 typecheck 失敗。以同一腳本（內容 blob hash 與第一次相同）重建後立即 commit，commit 前斷言 index 只有這 5 檔。
- HEAD（`4e7da0e3`，不含 T0582 未 commit 的變更）另以 `git archive` 匯出到 scratchpad、junction 借用 node_modules 驗證：`typecheck` = 0、`typecheck:electron` = 0、相關 9 檔 326 項全綠；之後已刪除快照（先移除 junction）。
- 本工單收尾（狀態 DONE）另一個 commit，只含本檔。
- 不 push、不建 tag、不改版號。

### 遭遇問題

- Bash 工具的 heredoc 在內容含反引號 / 引號時兩次被誤解析（`unexpected EOF`），改用 Write 工具寫 Python 腳本到 scratchpad 再執行（L129 同類）。
- T0582 並行修改共用檔：處理方式見 Commit。

### 互動紀錄

無（`CT_INTERACTIVE=0`，未向使用者提問）。

## 塔台結案（2026-10-17T22:23:43+0800）

**DONE**（source / test 層；實機隨下一版）。塔台複驗同 T0582（@ `b39634cb`：build 0 / typecheck 0 / typecheck:electron 0 / unit 4890 passed）。commit `462522ef` / `4e7da0e3` 塔台核對未夾帶 T0582 hunk。

塔台裁決：
- 與契約差異 1–8：**全部接受**（reused 時 base = merge-base、prunable 先 prune、隔離派工 helper 逾時 40 s、清理時機定義、archive 後綴、互斥補充、主行程非法 isolation → WORKTREE_FAILED、必要接線檔）。
- 「給 CT-T015 / CT-T016 的注意事項」1–7 原文轉入 CT-T015 / CT-T016（W1 契約定稿：T0585 完成後一併發）。
