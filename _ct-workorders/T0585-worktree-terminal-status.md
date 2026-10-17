---
schema_version: 1
schema_kind: workorder
id: T0585
title: "PLAN-047 W1-2：唯讀 `worktree:terminal-status`（ahead / behind、髒檔、實際變更、範圍外檔案、預測衝突）+ helper `--worktree-status`"
type: feature
status: TODO
started_at: ""
updated_at: "2026-10-17T22:23:52+0800"
completed_at: ""
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
