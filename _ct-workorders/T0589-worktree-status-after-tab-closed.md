---
schema_version: 1
schema_kind: workorder
id: T0589
title: "PLAN-047 Q3：Worker 分頁關閉後仍可查 `worktree:terminal-status`（已結束分頁紀錄 + git 依位置規則找回）"
type: feature
status: DONE
started_at: "2026-10-18T00:34:00+0800"
updated_at: "2026-10-18T00:48:14+0800"
completed_at: "2026-10-18T00:48:14+0800"
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

DONE — 驗收 1–3 全數通過。

### 產出摘要

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-2 無 `branch` 欄位（HEAD = `main`）；C-3 informational（`affects_files` 皆存在）。`CT_HOME` 未設（主 checkout 工作，非隔離）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

**commit**：`c3b2a9d5` feat(worktree-status): answer after the Worker tab closed（產品 + 測試 + CLAUDE.md，`git commit --only`；`src/styles/settings.css`、`_ct-workorders/T0590-*.md` 的 M 不是本單變更，未納入）。

**變更**

| 檔案 | 內容 |
|---|---|
| `electron/pty-manager.ts` | `ExitedPtyRecord.worktree?`；`recordExit` 複製 `instance.worktree`，`getExitedPty` 回複本。restart / 同 id 重建沿用 T0582「執行中為準」（紀錄被隱藏）。其他邏輯未動 |
| `electron/ct-worktree.ts` | `status(raw, { unregistered })`（未登記 → 不讀該目錄，`dirty: null` + `worktreeMissing`；T0585 既有欄位語意不變）；新增 `findFromGit` / `statusFromGit`（位置規則找回，查詢 + 計算共用 10 s 逾時，`withStatusTimeout` 抽出共用）；型別 `CtWorktreeGitStatusResult` / `CtWorktreeFindResult` / `CtWorktreeStatusOptions` |
| `electron/worktree-status-handlers.ts` | 找法 live → exited → git；回傳 `source`（`exited` 另帶 `exited` / `exitedAt`，`git` 的 `terminalId: null`）；稽核 `→ ok source=… isolated=…`；新 deps `getExitedView` / `getTerminalCwd` / `statusFromGit`（皆選填，未接線 = T0585 行為） |
| `electron/main.ts`、`electron/remote/headless-entry.ts` | 接線三個新 deps（本機與 headless 同一模組） |
| `scripts/bat-terminal.mjs` | `--help` 說明 `source`；`worktree-status` 事件加 `source`（舊 BAT → `null`）；`NOT_FOUND` 訊息改寫。參數 / exit code / stdout 格式不變 |
| `scripts/bat-mcp.mjs` | `bat_worktree_status` 摘要註明 `(tab closed)` / `(no tab; from git)`；tool description 補一句 |
| `CLAUDE.md` | 只改「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節：契約句、新增「分頁關閉後（T0589）」條（找法、`source`、git 範圍理由）、回傳、helper、稽核、已知限制第一項改寫、合併判準補「分頁關閉後仍可查」、驗證清單 |
| 測試 | `worktree-status-handlers.test.ts`（+9 案例；舊兩案例補 `source`）、`ct-worktree-status.test.ts`（+4 真 git）、新檔 `worktree-status-after-close.test.ts`（真 PtyManager + 真 git，3 案例）、`bat-terminal-worktree-status.test.ts`（+1，`--help`）、`bat-mcp.test.mjs`（+1）、e2e `t0583-worktree-isolated-dispatch.spec.ts`（T0589 段） |

**驗收證據**

| 閘門 | 結果 |
|---|---|
| `npx vite build` | PASS |
| `npm run typecheck` | 0 errors |
| `npm run typecheck:electron` | 0 errors |
| `npm run test:unit` | PASS — 286 files / 5015 passed / 3 skipped |
| e2e `npx playwright test e2e/t0583-worktree-isolated-dispatch.spec.ts` | PASS（1 passed, 27.9 s；含 `--worktree remove` 後 `source: "exited"` + `worktreeMissing: true`、`--close-worker T0586 --worktree keep` 分頁關閉後 exit 0 `source: "exited"`、`[helper-query] … ok source=exited` 日誌、helper 事件 `source`） |

實測一律在 temp 目錄的臨時 git repo（fixture 斷言 toplevel），未在本 repo 建 worktree / 分支。

**三種 `source` 的實際 JSON**（helper stdout，`ok` 已去掉；路徑為 temp 目錄）

`live`（e2e，BAT 重開後由已存分頁找到 T0584）：
```json
{"terminalId":"40a5b56428a2c4e9cbbc2aac364680f0","source":"live","isolated":true,"workorder":"T0584","path":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-JKg06D\\.bat-worktrees\\repo\\T0584","branch":"ct/T0584","base":"01dc2a3c2439c0f56ab4005de36e8702d27f479e","mainCheckout":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-JKg06D\\repo","head":"01dc2a3c2439c0f56ab4005de36e8702d27f479e","mainHead":"01dc2a3c2439c0f56ab4005de36e8702d27f479e","ahead":0,"behind":0,"dirty":[],"dirtyCount":0,"changedFiles":[],"changedCount":0,"outOfScopeFiles":null,"touchesCtWorkorders":false,"conflicts":[],"computedAt":1792255530389,"cached":false}
```

`exited`（e2e，T0583 `--close-worker --worktree remove` 分頁關閉、worktree 已刪、分支保留）：
```json
{"terminalId":"aaa6bdd6a82dac03302225d3e982d7a3","source":"exited","exited":true,"exitedAt":1792255518192,"isolated":true,"workorder":"T0583","path":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-JKg06D\\.bat-worktrees\\repo\\T0583","branch":"ct/T0583","base":"6956242334c9a49450840c098a8fe2dfa76ce372","mainCheckout":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0583-JKg06D\\repo","head":"fca28f4dd8ed4b6144ccb4497aa3566f14adc455","mainHead":"01dc2a3c2439c0f56ab4005de36e8702d27f479e","ahead":1,"behind":1,"dirty":null,"dirtyCount":null,"worktreeMissing":true,"changedFiles":["out.txt","pkg/in.txt","pkg/x.txt"],"changedCount":3,"outOfScopeFiles":["out.txt"],"outOfScopeCount":1,"workorderFile":"_ct-workorders/T0583-e2e.md","touchesCtWorkorders":false,"conflicts":["pkg/x.txt"],"computedAt":1792255514322,"cached":true}
```
（`--worktree keep` 的 T0586：同樣 `source: "exited"`，`dirty: []`、無 `worktreeMissing`，見 e2e 日誌。）

`git`（handler + 真 `CtWorktreeService`，tower 權杖、無分頁紀錄、worktree 已 `git worktree remove`；e2e 的 helper 以 server token 連線拿不到 `git`，故以 esbuild 打包的暫存腳本在 temp repo 產生）：
```json
{"terminalId":null,"source":"git","isolated":true,"workorder":"T0589","path":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0589-example-83Pvoq\\.bat-worktrees\\repo\\T0589","branch":"ct/T0589","base":"acdf9ddd6d8229a40c5913ba64e593702cd54822","mainCheckout":"C:\\Users\\Gower\\AppData\\Local\\Temp\\bat-t0589-example-83Pvoq\\repo","head":"cc796479fddda9ee8199c0174a00b1388c69a0c1","mainHead":"acdf9ddd6d8229a40c5913ba64e593702cd54822","ahead":1,"behind":0,"dirty":null,"dirtyCount":null,"worktreeMissing":true,"changedFiles":["src/x.ts","stray.md"],"changedCount":2,"outOfScopeFiles":["stray.md"],"outOfScopeCount":1,"workorderFile":"_ct-workorders/T0589-x.md","touchesCtWorkorders":false,"conflicts":[],"computedAt":1792255566040,"cached":false}
```
稽核行：`[helper-query] channel=worktree:terminal-status caller=tower-1 target=workorder=T0589 → ok source=git isolated=true ahead=1 behind=0 dirty=n/a changed=2 outOfScope=1 conflicts=0 cached=false ms=226`

**與契約的差異 / 本單的判斷**

1. **同工單、不同塔台**（契約交由 Worker 判斷）：已結束紀錄先依範圍過濾，tower 權杖只會看到自己的 → 多筆取 `exitedAt` 最近者；只有 server token 會同時看到不同塔台的紀錄 → `AMBIGUOUS`（帶 `terminalIds`）。同塔台多筆（Renew 重派）不算 AMBIGUOUS。
2. **有紀錄但不在範圍內 → `NOT_OWNER`，不往 git 走**：執行中分頁本來就是 `NOT_OWNER`（T0585 不變），已結束紀錄比照辦理（「第一個命中即用」）。契約未明寫，寫進 CLAUDE.md。
3. **位置上有目錄但不是該分支的登記 worktree**：視同未登記（不讀該目錄的 `dirty`，`worktreeMissing: true`），避免讀到別的東西。契約只寫「未登記但分支存在」。
4. **git 找回的 cwd**：用 `PtyInstance.cwd`（PTY 建立時的 cwd），不是 shell 目前所在目錄（BAT 不追蹤 `cd`）。塔台若在別的 repo 開分頁就找不到，記入 CLAUDE.md 已知限制。
5. **`--worktree archive` 後**：分支改名為 `ct-archive/<T####>`，已結束紀錄查詢回 `GIT_FAILED`（T0585 既有語意：分支不在），`git` 來源回 `NOT_FOUND`。未特別處理，記入已知限制。
6. **`exited` 的 helper `NOT_FOUND` 訊息**改為「執行中或 10 分鐘內關閉的分頁都沒有，且本塔台 repo 沒有 `ct/<T####>` 分支」（exit code 不變）。
7. BAT 重開後 T0108 replay 的 Worker（無 `PtyInstance.worktree`，T0537 已存分頁在關閉時一併移除）關閉後沒有 `exited` 的 worktree，只能經 `git`。

**給 CT 的更新建議（`merge-workorder.md`「關閉後 exit 3 → 改用 git 重算」那段）**

- 改成：「`--close-worker --worktree keep|remove` 之後仍以 `--worktree-status T#### --notify-id "$BAT_TERMINAL_ID"` 取狀態（BAT ≥ 本單版本）。回傳 `source`：`live` / `exited`（分頁 10 分鐘內關閉）/ `git`（更久以前，依位置規則從塔台自己的 repo 找回）。三者欄位相同，合併判準不變。」
- `worktreeMissing: true`（`dirty: null`）：worktree 已被 `--worktree remove` 移除；BAT 的 remove 遇未提交變更不刪，所以視為乾淨，照 `behind` / `conflicts` 判斷 `--ff-only` 或派合併工單。
- 仍保留 git 重算作為 fallback 的條件：exit 1 且 stderr `worktree-status: UNSUPPORTED`（舊 BAT），或 exit 3 `NOT_FOUND`（分支已 archive / 刪除，或塔台分頁不在主 checkout）。
- 建議 CT 在日誌記下 `source`，方便判斷是哪條路徑回答的。
- 塔台必須用**自己分頁的範圍權杖**（分頁內的 `BAT_REMOTE_TOKEN`，一般情況就是）呼叫，才拿得到 `git` 來源；以 server token 執行的 helper 只有 `live` / `exited`。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- Bash 工具對 heredoc 內容的反斜線 / 引號會做處理：第一次修改 handler 的腳本直接被拒（未寫入任何檔案）；e2e 修改腳本把 `\n` 轉成真的換行（5 處），隨即用 Edit 工具修正並檢查其他檔案的 diff 沒有同樣問題。之後含反斜線的內容一律用 Write / Edit（L129）。
- `ct-worktree-status.test.ts` 的 `ok()` 型別未涵蓋新的 `NOT_FOUND` 聯集 → `typecheck:electron` 報 3 個錯，已放寬參數型別，重跑 = 0。
- 無阻塞。並行的 T0590 修改了 `_ct-workorders/T0590-*.md`（主 checkout），本單未觸碰；`pty-manager.ts` 只動已結束紀錄三處，合併時與 T0590 的衝突由塔台處理。

### 回報時間

2026-10-18T00:47:24+0800
