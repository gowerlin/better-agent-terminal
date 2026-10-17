---
schema_version: 1
schema_kind: workorder
id: T0589
title: "PLAN-047 Q3：Worker 分頁關閉後仍可查 `worktree:terminal-status`（已結束分頁紀錄 + git 依位置規則找回）"
type: feature
status: PENDING
started_at: null
updated_at: "2026-10-18T00:31:47+0800"
completed_at: null
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T00:31:47+0800"
target_version: "0.7.0-pre.4（候選）"
depends_on: []
related:
  - "T0585（`worktree:terminal-status`、`CtWorktreeService.status`、`electron/worktree-status-handlers.ts`）、T0582（已結束 PTY 紀錄 `recordExit` / `getExitedPty`、`authorizeHelperQueryTarget`）、T0583（`ctWorktreeLocation` / `parseCtWorktreeRecord` / `git worktree list --porcelain`）"
  - "BMad-Guide 回覆 `_reply-2026-10-18-ct-v530-runtime.md` §4 觀察 1：以 `--worktree keep` 關閉的分頁，`bat_list_terminals` 仍列為 `exited`，`--worktree-status` 卻回 `NOT_FOUND`；CT 合併流程只能自己用 git 重算"
  - "PLAN-047 §五 Q3；並行工單 T0590（M1b blocked，隔離派工，在 `.bat-worktrees` 工作）"
affects_files:
  - "electron/worktree-status-handlers.ts"
  - "electron/ct-worktree.ts（只加找回函式；`status()` 的欄位計算不變）"
  - "electron/pty-manager.ts（只在已結束紀錄加 `worktree`；不碰其他邏輯）"
  - "electron/main.ts、electron/remote/headless-entry.ts（若接線需要 deps）"
  - scripts/bat-terminal.mjs
  - "scripts/bat-mcp.mjs（只在摘要文字需要時）"
  - "electron/__tests__/**、e2e/t0583-worktree-isolated-dispatch.spec.ts"
  - "CLAUDE.md（只改「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節）"
  - _ct-workorders/T0589-worktree-status-after-tab-closed.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0590 以 `--isolation worktree` 在 `<repo 上層>/.bat-worktrees/better-agent-terminal/T0590` 工作（它改 `electron/pty-manager.ts`、`electron/terminal-query-handlers.ts`、`electron/bat-mcp-launch.ts`、`CLAUDE.md` 等，合併時由塔台處理衝突）。你只在主 checkout 工作，不碰 `.bat-worktrees/` 底下任何東西；`CLAUDE.md` 只改 T0585 小節；`pty-manager.ts` 只動已結束紀錄。"
  - "🔴 只讀：查詢不得改分支、不得寫工作樹（同 T0585）。實測一律用 temp 目錄的臨時 git repo（L155），不得在本 repo 建 worktree / 分支。"
---

# T0589 — 分頁關閉後仍可查 worktree 狀態（PLAN-047 Q3）

## 背景

CT 的合併流程（CT-T016 / `merge-workorder.md`）是：`--worktree-status` → `--close-worker --worktree keep` → 合併。但 T0585 只查**執行中**的分頁，Worker 分頁一關，`--worktree-status T####` 就回 `NOT_FOUND`（exit 3），塔台只能自己用 git 重算。BMad-Guide 的 runtime 驗收與本專案 T0588 都碰到這個情況；而且合併常在分頁關閉 10 分鐘以後才做，`--worktree remove` 之後分支也還在、仍需要比對。

## 介面契約（本單定稿；CT 之後依此更新 `merge-workorder.md`）

channel `worktree:terminal-status` 參數不變（`{ terminalId?, workorder? }`）。回傳在既有欄位外**新增** `source`：

| `source` | 意義 |
|---|---|
| `live` | 執行中的分頁（T0585 原行為，回傳欄位不變） |
| `exited` | T0582 已結束分頁紀錄（10 分鐘 / 32 筆內）；另回 `exited: true`、`exitedAt` |
| `git` | 沒有分頁紀錄，依 T0583 位置規則從 git 找回；`terminalId: null` |

**找法**（依序，第一個命中即用）：

1. 執行中的分頁（T0585 不變，含 T0537 已存分頁）。
2. 已結束分頁紀錄：T0582 `recordExit` 的紀錄**加記** `worktree`（`PtyInstance.worktree` 的同一份資料：path / branch / base / mainCheckout / workorder）。`terminalId` 參數 = 已結束的 id、或 `workorder` 比對已結束紀錄的工單號（正規化同 `--workorder`；多筆取最近結束者，並以 `AMBIGUOUS` 處理「同工單、不同塔台」的情況由你判斷，寫進回報）。範圍檢查沿用 `authorizeHelperQueryTarget`（已結束的 Worker 以紀錄的 `towerTerminalId` 判斷，T0582 已支援）。
3. git 找回（**只限 `workorder` 參數、呼叫者為 tower 權杖**；worker 權杖與 server token 不走這一步）：
   - 主 checkout = 呼叫者自己 PTY 的 cwd 的 `git rev-parse --show-toplevel`（呼叫者 PTY 已結束 → 跳過這一步）。
   - 位置 = `ctWorktreeLocation(主 checkout, T####)`；`git worktree list --porcelain` 有該位置且分支 `refs/heads/ct/<T####>` → 正常計算（`parseCtWorktreeRecord` 規則）。
   - worktree 沒有登記（已 `--worktree remove`）但分支 `ct/<T####>` 存在 → 照算 ahead / behind / changedFiles / outOfScopeFiles / conflicts，`dirty: null`、`worktreeMissing: true`、`path` 為位置規則算出的路徑。
   - 分支也不在 → `NOT_FOUND`。
   - 理由（寫進 CLAUDE.md）：資訊全部來自呼叫者自己 cwd 所在 repo 的 git，塔台本來就能自己跑 git；不放寬任何分頁的 metadata / 輸出範圍。
4. 都沒有 → `NOT_FOUND`（同 T0585）。

**helper / MCP**：`bat-terminal.mjs --worktree-status` 的參數、exit code、stdout 一行 JSON 都不變（新欄位自然出現在 JSON）；`--help` 與 `bat-scripts.log` `worktree-status` 事件加記 `source`。`bat_worktree_status`（`scripts/bat-mcp.mjs`）只在摘要文字裡帶出 `source`（若需要）。舊 CT 不認得 `source` 也不受影響。

**稽核**：`[helper-query]` 行加 `source=`，不記檔名（同 T0585）。

## 任務

1. `pty-manager.ts`：已結束紀錄加 `worktree`（restart / 同 id 重建時以執行中為準，行為同 T0582）。
2. `worktree-status-handlers.ts` / `ct-worktree.ts`：上述找法 2、3；`status()` 支援「worktree 未登記、只有分支」的計算（不得改變 T0585 既有欄位的語意）。本機與 headless 共用。
3. helper `--help`、`bat-scripts.log` 事件、`[helper-query]` 稽核加 `source`。
4. 測試：
   - 單元：已結束紀錄帶 worktree（kill / exit / restart 覆蓋 / TTL）；handler 三種 `source`、`terminalId` 指已結束的 id、`workorder` 命中已結束紀錄、git 找回（真 git temp repo：worktree 在 / 已 remove 只剩分支 / 分支也不在 → `NOT_FOUND`）、worker 權杖與 server token 不走 git 找回、別的塔台的已結束 Worker → `NOT_OWNER`、查詢前後 git 狀態不變
   - helper：`source` 出現在 JSON 與事件
   - e2e：擴充 `e2e/t0583-worktree-isolated-dispatch.spec.ts`：`--close-worker --worktree keep` 等分頁關閉後 → `--worktree-status T####` exit 0 且 `source: "exited"`；`--worktree remove` 後（分支保留）→ exit 0、`source` 為 `exited` 或 `git`、`worktreeMissing: true`
5. `CLAUDE.md`「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節：補 T0589 找法、`source`、git 找回的範圍理由；「已知限制」第一項改寫；「給合併判準（CT-T016）」補一句「分頁關閉後仍可查」。不改其他小節。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元測試與 e2e 通過。
3. 回報區附：三種 `source` 的實際 JSON 範例、與契約的差異（若有）、給 CT 的更新建議（`merge-workorder.md`「關閉後 exit 3 → 改用 git 重算」那段可以怎麼改）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
