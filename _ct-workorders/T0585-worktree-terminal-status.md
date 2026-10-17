---
schema_version: 1
schema_kind: workorder
id: T0585
title: "PLAN-047 W1-2：唯讀 `worktree:terminal-status`（ahead / behind、髒檔、實際變更、範圍外檔案、預測衝突）+ helper `--worktree-status`"
type: feature
status: DONE
started_at: "2026-10-17T22:25:33+0800"
updated_at: "2026-10-17T22:44:47+0800"
completed_at: "2026-10-17T22:44:47+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-17T22:23:52+0800"
target_version: "0.7.0-pre.2（候選）"
depends_on: [T0582, T0583]
related:
  - "T0583（`electron/ct-worktree.ts`、`PtyInstance.worktree`、已存分頁 `ctWorktree`、`withSavedWorkerOwnership.getWorktree`）、T0582（`authorizeHelperQueryTarget` 範圍判定、`terminal-query-handlers.ts`、`[helper-query]` 稽核）"
  - "T0574 回報區 R5「BAT 唯讀信號成本」（merge-tree / rev-list / diff 實測 50–85 ms）與「小型無衝突合併由塔台直接做的判準」"
  - "PLAN-047 §三之一（BAT 只提供唯讀信號）、D150 / D152；並行工單 T0584（shim 轉接本 channel）"
affects_files:
  - "electron/ct-worktree.ts（加唯讀查詢）"
  - "electron/terminal-query-handlers.ts 或新檔（註冊 channel；本機與 headless 共用）"
  - "electron/remote/helper-capability.ts（`HELPER_CHANNEL_ROLES` 加一個 channel，沿用 `authorizeHelperQueryTarget`）"
  - "electron/main.ts、electron/remote/headless-entry.ts（接線）"
  - scripts/bat-terminal.mjs
  - "electron/__tests__/**、electron/remote/__tests__/**（含 `proxied-channels-binding.test.ts` / `headless-parity.test.ts` / `helper-capability.test.ts` 清單）、e2e（擴充 `e2e/t0583-worktree-isolated-dispatch.spec.ts` 或新檔）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0585-worktree-terminal-status.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0584 同時在改 `electron/agent-runtime/agent-registry.ts`、`electron/terminal-command-handlers.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`（只動啟動命令組裝 / 注入）、scripts/ 打包相關與 `CLAUDE.md`（它新增 MCP shim 小節）。你在 main.ts / headless-entry.ts 只加 channel 接線；CLAUDE.md 只新增自己的小節。commit 前 `git diff --cached` 只能有你的檔 / hunk。"
  - "🔴 只讀：不得改分支、不得寫工作樹（`merge-tree --write-tree` 只寫物件庫，可以；不得 checkout / merge / commit）。實測一律用 temp 目錄的臨時 git repo（L155）。git 一律 `execFile` + array args + timeout 5 s，win32 帶 `-c core.longpaths=true`（沿用 `CtWorktreeService.git`）。"
---

# T0585 — 唯讀 worktree 狀態（W1-2）

## 背景

合併改由塔台派合併工單（D150），BAT 只提供唯讀信號，讓塔台決定合併順序、是否能直接 `--ff-only`（T0574 R5 五條判準）、是否要派合併工單。T0583 已讓隔離派工的 Worker 記錄 worktree（path / branch / base / mainCheckout），本單提供查詢。

## 介面契約（本單定稿；T0584 的 `bat_worktree_status` tool 依此轉接，CT 依此撰寫）

**channel** `worktree:terminal-status`，參數 `{ terminalId?: string, workorder?: string }`（兩者擇一；都沒給 = 自己）。

- `workorder`：以 `--close-worker` 相同的方式找 Worker（`findWorkerTerminals` + T0537 已存歸屬；正規化同 `--workorder`），0 個 → `NOT_FOUND`、多個 → `AMBIGUOUS`。
- 範圍：沿用 T0582 `authorizeHelperQueryTarget`（tower → 自己 + 自己的 Worker；worker → 自己）；範圍外 → `NOT_OWNER`。
- 不是隔離派出的分頁 → `{ ok:true, isolated:false }`。
- 隔離分頁 → `{ ok:true, isolated:true, path, branch, base, head, mainHead, ahead, behind, dirty, changedFiles, outOfScopeFiles, conflicts, touchesCtWorkorders, computedAt }`：
  - `head`：`ct/<T####>` 目前 SHA；`mainHead`：主 checkout 目前 `HEAD` SHA（以 `mainCheckout` 記錄為準）
  - `ahead` / `behind`：`git rev-list --left-right --count <mainHead>...<head>`
  - `dirty`：worktree 內未提交 / 未追蹤的檔案清單（最多 100 筆，另回 `dirtyCount`）；worktree 目錄已不存在 → `dirty: null` 並加 `worktreeMissing: true`
  - `changedFiles`：`git diff --name-only <mainHead>...<head>`（最多 500 筆，另回 `changedCount`）
  - `outOfScopeFiles`：`changedFiles` 中不符合工單 `affects_files` 的檔案。工單檔讀 `<mainCheckout>/_ct-workorders/<T####>-*.md` frontmatter `affects_files`（每項取路徑部分：去掉全形 / 半形括號說明與引號後的第一個 token，支援 `**` / `*` glob）；讀不到或沒有該欄位 → `null`（不是空陣列）。`_ct-workorders/**` 一律不算範圍外（另以 `touchesCtWorkorders` 表示是否改到）
  - `conflicts`：`git merge-tree --write-tree --name-only --no-messages <mainHead> <head>` exit 1 時列出衝突檔；exit 0 → `[]`；其他失敗 → `null` + `conflictsError`
- 快取：同一 `(head, mainHead, worktree 狀態)` 不重算；`dirty` 每次都重查（便宜）。單次查詢總時限 10 s，逾時回 `{ ok:false, code:'TIMEOUT' }`。
- 稽核：沿用 T0582 `[helper-query]` 格式與 `bat-scripts.log` 事件。

**helper**：`bat-terminal.mjs --worktree-status [T####] [--notify-id <id>]`

- 帶 `T####`：查該工單的 Worker（需 `--notify-id`，與 `--close-worker` 同規則）；不帶：查自己（Worker 自查）。
- stdout：一行 JSON（channel 回傳去掉 `ok`）。exit：`0` 成功（含 `isolated:false`）/ `3` NOT_FOUND / `4` NOT_OWNER / `5` AMBIGUOUS / `1` 其他（用法、連線、`UNSUPPORTED`、`TIMEOUT`）；stderr 另印 `worktree-status: <CODE>`。
- 與建立分頁參數、`--close-worker`、`--set-role`、`--worktree`、`--isolation` 互斥。

## 任務

1. `ct-worktree.ts` 加唯讀查詢函式（只讀 git；工單 `affects_files` 解析為純函式並單元測試）。
2. channel 註冊（本機與 headless 共用；重開後以已存分頁 worktree 資訊查詢，沿用 T0583 `getWorktree`）；`HELPER_CHANNEL_ROLES` 加入；清單測試更新。
3. helper `--worktree-status`：參數、互斥、`--help`、exit code、`bat-scripts.log` 事件。
4. 測試：temp repo 的單元測試（ahead / behind、乾淨 / 髒、worktree 已刪、changedFiles、outOfScope 各種 `affects_files` 寫法與缺欄位、`_ct-workorders` 例外、衝突 / 無衝突、快取、逾時）、handler 範圍（自己 / 自己的 Worker / 別人的 → `NOT_OWNER`、workorder 找不到 / 重複）、helper exit code；e2e：擴充 T0583 的 e2e，在 Worker 的 worktree commit 一個範圍內與一個範圍外的檔、主 checkout 另 commit 一個衝突 → 塔台 `--worktree-status T####` 的 JSON 正確。
5. CLAUDE.md：新增「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節：契約、欄位定義、`affects_files` 解析規則、快取 / 時限、helper 用法、已知限制、驗證清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元測試與 e2e 通過；查詢前後主 checkout 與 worktree 的 `git status`、分支、HEAD 皆未改變（測試斷言）。
3. 回報區附：實際 JSON 範例、各 git 指令實測耗時、與契約的差異（若有）、給 CT-T016（合併工單 / 直接合併判準）的注意事項。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1：工單位於 REPO_ROOT 下。C-3：前 5 項（排除萬用字元與 `_ct-workorders/`）皆存在。C-2：無 `branch` 欄位。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 結果摘要

照契約實作 `worktree:terminal-status` 與 helper `--worktree-status`。查詢只讀 git（`merge-tree --write-tree` 只寫物件庫）；本機與 headless 共用同一份 handler / service。單元測試、helper 測試、清單測試與擴充後的 T0583 e2e 全數通過。

### 變更檔案

- `electron/ct-worktree.ts`：`CtWorktreeService.status()`（快取、10 s 時限）與純函式 `parseWorkorderAffectsFiles` / `affectsFilePatterns` / `matchesAffectsPattern` / `outOfScopeFiles` / `isCtWorkordersPath` / `parsePorcelainZ`；`git()` 失敗時另附 `stdout`（merge-tree exit 1 的衝突清單在 stdout）
- `electron/worktree-status-handlers.ts`（新）：`registerWorktreeStatusHandler`，範圍沿用 `authorizeHelperQueryTarget`（`output`），以 `--close-worker` 的方式找 Worker，`[helper-query]` 稽核
- `electron/remote/helper-capability.ts`：`HELPER_CHANNEL_ROLES` 加 `worktree:terminal-status`（tower / worker），`authorizeHelperInvoke` 放行（範圍由 handler 判定）
- `electron/main.ts`：只加 import 與註冊（`withSavedWorkerOwnership` view + `capabilityOrSavedTabOwnership`，同 `--close-worker`）
- `electron/remote/headless-entry.ts`：只在 `createHeadlessTerminalQueryModule` 內加註冊（自建 `CtWorktreeService`，headless git resolver、去 `BAT_*` env）+ import
- `scripts/bat-terminal.mjs`：`--worktree-status [T####]`（參數、互斥、`--notify-id` 規則、`--help`、exit code、`worktree-status` 事件）
- 測試：`electron/__tests__/ct-worktree-status.test.ts`（新，17）、`electron/__tests__/worktree-status-handlers.test.ts`（新，11）、`electron/__tests__/bat-terminal-worktree-status.test.ts`（新，25）、`electron/remote/__tests__/helper-capability.test.ts`（白名單 13）、`proxied-channels-binding.test.ts`（REGISTRY_ONLY）、`headless-parity.test.ts`（HELPER_ONLY）
- e2e：`e2e/t0583-worktree-isolated-dispatch.spec.ts` 擴充 T0585 段
- `CLAUDE.md`：新增「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節（未改其他小節）

### 驗證

| 項目 | 結果 |
|---|---|
| `npx vite build` | PASS |
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npm run test:unit` | PASS：280 files、4941 passed、3 skipped。第一次全量跑有 1 個失敗（`path-aware-channels-coverage.test.ts`，起因是 T0584 進行中新增的 `agent:bat-mcp-launch-args`），T0584 修正後單檔重跑與全量重跑皆綠 |
| 新增單元 / helper / 清單測試 | PASS（ct-worktree-status 17、worktree-status-handlers 11、bat-terminal-worktree-status 25；既有 bat-terminal-worktree / close-worker / set-role、terminal-query-handlers、ct-worktree 一併跑過） |
| e2e `t0583-worktree-isolated-dispatch.spec.ts` | PASS（21.1 s，含 T0585 段與重開後已存分頁查詢） |
| 唯讀斷言 | 單元測試（真 git）與 e2e 都斷言：查詢前後主 checkout 與 worktree 的 `git status --porcelain --untracked-files=all`、`HEAD`、目前分支、`refs/heads` 全部不變 |

注意：vite build、typecheck、unit 與 e2e 都在含 T0584 進行中變更的工作樹上執行（`main.ts` / `headless-entry.ts` / `CLAUDE.md` 等並行修改中）。commit 只包含本單的檔案與 hunk（`git apply --cached` 挑出本單 hunk）。「HEAD + 本單」這個組合本身沒有另外 build；本單的 hunk 不依賴 T0584 的程式碼。

### 實際 JSON 範例（e2e，塔台 `--worktree-status T0583 --notify-id <tower>`）

```json
{"terminalId":"4b7462e6178657ee65fe575ef3a9e399","isolated":true,"workorder":"T0583","path":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-aqMhuV\\.bat-worktrees\\repo\\T0583","branch":"ct/T0583","base":"27509e4071ab31d93f6537a602d1f7b0043df137","mainCheckout":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-aqMhuV\\repo","head":"e8a3d244f9aafb23178e1525548856c766bedc71","mainHead":"b1610a211126109fcd56ded9ff5e66ac8ceaaa47","ahead":1,"behind":1,"dirty":["scratch.txt"],"dirtyCount":1,"changedFiles":["out.txt","pkg/in.txt","pkg/x.txt"],"changedCount":3,"outOfScopeFiles":["out.txt"],"outOfScopeCount":1,"workorderFile":"_ct-workorders/T0583-e2e.md","touchesCtWorkorders":false,"conflicts":["pkg/x.txt"],"computedAt":1792247935086,"cached":false}
```

重開 BAT 後由已存分頁找到（T0584，沒有工單檔 → `outOfScopeFiles: null`）：

```json
{"terminalId":"3e13df14c3e584d1525333011a94a662","isolated":true,"workorder":"T0584","path":"…\\.bat-worktrees\\repo\\T0584","branch":"ct/T0584","base":"b1610a2…","mainCheckout":"…\\repo","head":"b1610a2…","mainHead":"b1610a2…","ahead":0,"behind":0,"dirty":[],"dirtyCount":0,"changedFiles":[],"changedCount":0,"outOfScopeFiles":null,"touchesCtWorkorders":false,"conflicts":[],"computedAt":1792247943658,"cached":false}
```

非隔離分頁：`{"terminalId":"…","isolated":false}`。

### 各 git 指令實測耗時

環境：Windows、git 2.56.0.windows.2；本 repo 在 temp 目錄的 clone（2618 個追蹤檔、2142 commits；Worker 3 commits、main 2 commits、1 個重疊）。每個指令跑 7 次取中位數：

| 指令 | 中位數 | min–max |
|---|---|---|
| `rev-parse --verify refs/heads/ct/<T>^{commit}` | 35 ms | 34–36 |
| `rev-parse --verify HEAD^{commit}` | 35 ms | 35–46 |
| `--no-optional-locks status --porcelain=v1 -z`（worktree） | 87 ms | 79–89 |
| `rev-list --left-right --count <main>...<head>` | 36 ms | 33–38 |
| `diff --name-only --no-renames -z <main>...<head>` | 37 ms | 36–38 |
| `merge-tree --write-tree --name-only --no-messages -z` | 37 ms | 31–38 |

六個指令依序執行：沒有快取時約 270 ms，快取命中時約 160 ms（兩次 rev-parse + status）。e2e 中 helper 一次呼叫含 node 啟動約 220 ms（小 repo）。

### 與契約的差異 / 擴充

1. **`affects_files` 的 `、` 列舉**：契約寫的是「第一個 token」，但這種寫法下 `electron/main.ts、electron/remote/headless-entry.ts（接線）` 只會取到 `main.ts`，`headless-entry.ts` 會被誤判為範圍外（本工單的 `affects_files` 自己就這樣寫）。因此改成：token 內以 `、` / `，` / `,` / `；` / `;` 列出的多個路徑**全部**算範圍內；分隔符兩側的空白先收掉，所以 `…（說明）、e2e（說明）` 也會取到 `e2e`。沒有萬用字元的路徑視為「該檔或它底下的檔案」（例：`e2e` 涵蓋 `e2e/**`）。
2. **`affects_files:` 沒有值**（YAML null）、`~` → `null`；`[]` → 所有變更（`_ct-workorders/**` 除外）都算範圍外。
3. **新增錯誤碼 `GIT_FAILED`**：`ct/<T####>` 分支或主 checkout 已不在。helper exit 1，與 `TIMEOUT` 同類。
4. **新增欄位**（只增不改）：`workorder`、`mainCheckout`、`dirtyCount`、`changedCount`、`outOfScopeCount`、`workorderFile`、`cached`、`terminalId`，以及視情況出現的 `dirtyError` / `conflictsError` / `worktreeMissing`。`computedAt` 為 epoch ms（數字，與 T0582 的時間欄位一致）。
5. **`changedFiles` 帶 `--no-renames`**：改名時新、舊路徑都會列出，所以搬離範圍的刪除也會被算進範圍外。
6. **不跑 merge-tree 的情況**：`ahead == 0` 或 `behind == 0`（可以 fast-forward）時直接回 `conflicts: []`。
7. **只查執行中的分頁**：分頁結束後找不到（`NOT_FOUND`），因為 PtyManager 的結束紀錄沒有 worktree 資訊。
8. **helper 規則**：`--notify-id` 只在 helper 端檢查，不送到 BAT；不帶 `T####` 時又給 `--notify-id` 算用法錯誤。

### 給 CT-T016（合併工單 / 直接合併判準）的注意事項

- **可以直接 `git merge --ff-only ct/T####`**：`behind == 0`，`dirty` 為空，而且 `conflicts == []`（此時一定是空陣列）。
- `dirty` 非空時，Worker 還有沒提交的變更，合併拿不到這些內容，先讓 Worker commit。`worktreeMissing: true` 時無法判斷有沒有髒檔。
- `behind > 0` 且 `conflicts == []`：merge-tree 預測可以乾淨合併，但要 merge commit 或 rebase，不能 ff。`conflicts` 非空或 `null`（例如沒有共同祖先、git < 2.38）就派合併工單。
- `outOfScopeFiles` 非空時，Worker 改了工單 `affects_files` 以外的檔案，先確認再合併。`null` 表示工單讀不到或沒有該欄位，**不代表**範圍內。
- `touchesCtWorkorders: true` 表示分支改到 `_ct-workorders/**`（例如 Worker 寫了回報區）。合併時要留意和塔台在主 checkout 的改動有沒有衝突（衝突會出現在 `conflicts` 裡）。
- `head` / `mainHead` 每次都是當下的值；`cached` 只表示 ahead / behind / changedFiles / conflicts 沿用了先前的計算結果（同一組 head / mainHead）。合併前想再確認，再查一次就好（約 0.2–0.3 s）。
- 帶 `T####` 查詢要搭配 `--notify-id "$BAT_TERMINAL_ID"`。exit 3 / 4 / 5 的語意和 `--close-worker` 相同；exit 1 時看 stderr 的 `worktree-status: <CODE>`（`UNSUPPORTED` 代表 BAT 太舊）。

### 已知限制

- headless 的範圍只依權杖判定，沒有已存分頁補判；server 重啟後找不到 Worker。
- `affects_files` 解析只涵蓋常見的 YAML 寫法，不是完整的 YAML parser。工單檔以主 checkout 工作樹中的內容為準，未提交的修改也算。
- e2e 的 helper 以 server token 連線（沿用 T0583 e2e 的寫法），範圍判定（自己 / 自己的 Worker / 別人的 `NOT_OWNER`）由單元測試涵蓋。

### Commit

- `77c93c64` feat(T0585): read-only worktree:terminal-status + bat-terminal --worktree-status（15 檔）。`main.ts` / `headless-entry.ts` 與 T0584 並行修改：先以 `git apply --cached --unidiff-zero` 挑 hunk，發現相鄰的 T0584 兩行被帶入、插入位置也偏移，改由 HEAD 版本依 anchor 組出 blob，再 `git update-index --cacheinfo` 寫入 index；commit 內容 = HEAD + 本單，T0584 的變更仍留在工作樹（`git diff` 不含本單內容）。未 push。

## 塔台結案（2026-10-17T22:54:20+0800）

**DONE**（source / test 層；實機隨下一版）。塔台複驗同 T0584（@ `46b904f1`，「HEAD + T0585」單獨未 build 的缺口由此補上）。commit `77c93c64` 塔台核對未夾帶 T0584 程式碼。

塔台裁決：
- 差異 1–8：**全部接受**（`、` 列舉全部算範圍內、YAML null / `[]` 語意、`GIT_FAILED`、新增欄位、`--no-renames`、可 ff 時不跑 merge-tree、只查執行中分頁、helper `--notify-id` 規則）。
- 「只查執行中分頁」記為已知限制；合併工單若需要已結束 Worker 的狀態，CT 端直接用 git 查 `ct/T####`。
- 「給 CT-T016 的注意事項」原文轉入 CT-T016。
