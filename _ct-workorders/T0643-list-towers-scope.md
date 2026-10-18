---
schema_version: 1
schema_kind: workorder
id: T0643
title: "PLAN-050 C：`terminal:list { scope: 'towers' }`——已宣告的塔台列出同一 BAT 內所有塔台分頁（R2 (a)，放寬 D149）；併入 T0644 文件草稿"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: S
created_at: "2026-10-18T17:11:36+0800"
started_at: "2026-10-18T17:12:32+08:00"
updated_at: "2026-10-18T17:26:46+08:00"
completed_at: "2026-10-18T17:26:46+08:00"
depends_on: [T0642, T0644]
related:
  - "D167（使用者同意放寬 D149，新增 `scope: 'towers'`）；T0640 回報區（Q2-3 範圍分析、介面契約草案 C-6、實作切分 C）"
  - "T0642（`claudeSessionName` / `claudeSessionId` 查詢欄位、`claude-sessions.json`）；T0641（`claudeSessionNameRecords`、命名）；T0644 回報區「文件草稿」小節（本單併入 docs / CLAUDE.md）"
  - "T0582（`terminal:list` 契約、`authorizeHelperQueryTarget`、`scope: 'workspace'` 只給已宣告塔台）；T0584（`scripts/bat-mcp.mjs`、`readOnlyHint`）；D149（範圍權杖）"
affects_files:
  - electron/terminal-query-handlers.ts
  - "electron/remote/helper-capability.ts（只在範圍判斷需要時）"
  - "scripts/bat-mcp.mjs（`bat_list_terminals` 的 `scope` enum 與說明）"
  - "scripts/bat-terminal.mjs（只在 helper 已有對應的 list 參數、需要同步值域時）"
  - "electron/main.ts、electron/remote/headless-entry.ts（只在工作區名稱 dep 需要接線時）"
  - "electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**"
  - "e2e/t0643-list-towers.spec.ts（新，或擴充 e2e/t0642）"
  - "docs/agent-guide/claude-session-name.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/bat-mcp-shim.md、docs/agent-guide/remote-tower-notify.md（範圍表一句）、CLAUDE.md（PLAN-050 節與「helper 唯讀查詢 channel」節各一句）"
  - _ct-workorders/T0643-list-towers-scope.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **C-6 契約**（T0640 草案，D167 同意）：`terminal:list { scope: 'towers' }` 只有已 `--set-role tower` 宣告的塔台可呼叫（`helperQueryRole` = `tower`；否則 `NOT_OWNER`，與 `scope: 'workspace'` 相同規則）。回傳同一個 BAT host（同一 RemoteServer / 同一個主行程）上**所有工作區**中 `role: tower` 且執行中的分頁（呼叫者自己也列出，標示即可），每列**只有** `id` / `workspaceId` / `workspaceName` / `claudeSessionName` / `state` / `alive`（`title` 若本機有可加，回報說明）。🔴 **不回** `claudeSessionId`、`cwd`、輸出、`towerMode`、`workorder`、問題內容；對這些分頁的 `get-state` / `read-output` / `wait` 範圍**不變**（仍 `NOT_OWNER`）。"
  - "🔴 不改 `scope: 'mine'` / `'workspace'` 的行為與欄位；未知 scope 照現行回 `INVALID_ARGS`。舊 BAT 對 `scope: 'towers'` 回什麼（`INVALID_ARGS`？）寫進文件，給 CT 判斷不支援用。MCP `bat_list_terminals` 的 `scope` 加 `towers`，仍 `readOnlyHint: true`（`bat-mcp.test.mjs` 斷言）。稽核日誌 `[helper-query]` 記 `scope=towers`，不記名稱以外的內容。"
  - "🔴 `workspaceName` 取 `alias || name`（與 T0641 `cleanSessionWorkspaceName` 的來源一致）；headless 沒有工作區名稱時回 `null`（已知限制）。"
  - "🔴 **文件併入**：把 T0644 回報區「文件草稿」小節併入 `docs/agent-guide/claude-session-name.md`（新節「以塔台開啟 Claude（T0644）」）與 CLAUDE.md PLAN-050 節（一行），內容照草稿、只做格式整理；另把本單的 `scope: 'towers'` 寫進同一份 docs、`helper-query-channels.md` 契約表與範圍說明、CLAUDE.md。CLAUDE.md 依「CLAUDE.md 撰寫規則」：每節 3–12 行，細節放 docs。"
  - "🔴 非隔離工單，本單期間沒有其他 Worker。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。不 push。"
---

# T0643 — `scope: 'towers'`（PLAN-050 C）

## 背景

R2 (a)（D167）：從一般分頁開的塔台在 ListAgents 上的名稱是 `<工作區> · <短 ID>`，看不出角色；CT 需要問 BAT「這台機器上有哪些塔台、各自的 session 名稱」。使用者同意放寬 D149，讓已宣告的塔台可以列出同一 BAT 內所有工作區的塔台分頁（只有識別用的 metadata）。本單也把 T0644 的文件草稿併入正式文件，作為 PLAN-050 的收尾。

## 要做的事

1. `terminal:list` 支援 `scope: 'towers'`（契約見 memory_overrides）；範圍判斷集中在既有的範圍函式，不在 handler 內散寫。
2. MCP `bat_list_terminals` 的 `scope` 加 `towers`、說明一句。
3. 測試：已宣告塔台可列、未宣告 / worker / shell → `NOT_OWNER`；跨工作區列出所有塔台、不含非塔台分頁；欄位白名單（不含 sessionId / cwd 等）；對列出的別工作區塔台做 `get-state` / `read-output` / `wait` 仍 `NOT_OWNER`；稽核日誌；headless。
4. e2e（隔離實例、不耗 token）：兩個工作區各一個宣告為塔台的分頁（可用 T0644 入口開，或 helper `--set-role tower`），A 塔台以 MCP `bat_list_terminals scope=towers` 看到兩列，且 B 塔台的 `claudeSessionName` 正確；B 塔台 `get-state` 由 A 呼叫仍 `NOT_OWNER`。
5. 文件併入（T0644 草稿）與 `scope: 'towers'` 文件；整理一份「PLAN-050 對 CT 的介面契約總表」寫在回報區（C-1–C-8 的最終版，含 T0641 / T0642 / T0644 / 本單的實際欄位、值域、降級、舊 BAT 的反應），供塔台開 CT-T021。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（基線 5371 / 310）
- `npx vite build` 成功
- e2e 新增的 spec 通過；回歸 `e2e/t0582-helper-query.spec.ts`、`e2e/t0642-claude-session-query.spec.ts`

## 驗收

- 已宣告的塔台能跨工作區列出所有塔台與其 session 名稱；其他查詢範圍不變
- T0644 文件草稿已併入；CLAUDE.md 與 docs 一致
- 回報區附「PLAN-050 介面契約總表」；驗證全部通過；commit

---

## 回報區

### 完成狀態

**DONE**：已宣告的塔台可用 `terminal:list { scope: 'towers' }`（MCP `bat_list_terminals scope=towers`）列出同一個 BAT host 所有工作區的執行中塔台與它們的 session 名稱。`mine` / `workspace` 與其他查詢的範圍不變。T0644 的文件草稿已併入 docs 與 CLAUDE.md，`scope: 'towers'` 也寫進同一批文件。驗證全部通過，已 commit。

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：`electron/terminal-query-handlers.ts` 等檔案存在 → PASS（C-0 已通過，僅供參考）
- C-2：工單沒有 `branch` 欄位，不適用；工作分支為 `main`
- 非隔離工單（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）
- 工單 `status` 原為 `TODO`（不是 `PENDING`），開工時改為 `IN_PROGRESS`

### 實作摘要

1. **範圍函式**（`electron/remote/helper-capability.ts`）：新增 `HELPER_LIST_SCOPES` = `['mine', 'workspace', 'towers']`、`authorizeHelperListScope(caller, scope, ctx)`（`mine` 任何人可用；`workspace` / `towers` 只給已宣告的塔台，否則 `NOT_OWNER`；server token 連線不受限）、`isTowersScopeMember(id, ctx)`（`getTerminalRole(id) === 'tower'`）。handler 不再自己寫 `scope === 'workspace'` 的角色判斷，`workspace` 改用同一個函式；錯誤訊息逐字不變（`scope=workspace needs a declared tower (--set-role tower)`）。
2. **handler**（`electron/terminal-query-handlers.ts`）：`terminal:list` 的 `towers` 分支只取 `pm.listTerminalIds()` 中執行中、`isTowersScopeMember` 成立的分頁。每列 `id` / `workspaceId`（不明 → `null`）/ `workspaceName`（不明 → `null`）/ `title?` / `claudeSessionName` / `state` / `alive: true` / `self`。不經過 `claudeSessionOf`，所以拿不到 sessionId。未知 scope 照舊回 `INVALID_ARGS`（`message: 'scope'`）。稽核寫 `target=scope=towers`、`ok count=<n>`。
3. **工作區名稱 dep**：`TerminalQueryDeps.getWorkspaceName?`，搭配新的 `workspaceNameFromRegistry(entries, id)`（`alias || name`，空字串的 alias 視為沒有）。main.ts 以 `windowRegistry.getCachedEntries()` 接上；headless 不接，所以 `workspaceName` 是 `null`。
4. **MCP**（`scripts/bat-mcp.mjs`）：`bat_list_terminals` 的 `scope` enum 加 `towers`，說明補一句（含「舊 BAT 回 `INVALID_ARGS`」）。`towers` 的文字摘要是 `<id> (self, workspace="…", session="…", <state>)`。仍是 `readOnlyHint: true`。`scripts/bat-terminal.mjs` 沒有 list 參數，所以沒改。
5. **`title` 欄位**：契約允許「本機有就加」，所以加了。本機取 window registry 已存的標題，headless 沒有。e2e 實測兩個塔台都是 `Terminal · Tower`（T0562 自動標題）。
6. **`self` 欄位**：工單寫「呼叫者自己也列出，標示即可」，所以每列都帶 `self: boolean`。server token 連線一律是 `false`。這個欄位不在 C-6 草案的欄位清單裡，總表 C-6 已列入。

### 變更檔案（commit `a54710aa`）

- `electron/remote/helper-capability.ts`：`HelperListScope` / `HELPER_LIST_SCOPES` / `authorizeHelperListScope` / `isTowersScopeMember`；`authorizeHelperQueryTarget` 註解
- `electron/terminal-query-handlers.ts`：`towers` 分支、`workspaceNameFromRegistry`、`getWorkspaceName` dep、`claudeSessionNameOf`；檔頭契約註解
- `electron/main.ts`：`getWorkspaceName` 接線（一行 + import）
- `scripts/bat-mcp.mjs`：enum、說明、摘要
- 測試：`electron/__tests__/terminal-list-towers.test.ts`（新，12 個）、`electron/remote/__tests__/headless-terminal-query-e2e.test.ts`（加 T0643 段）、`scripts/__tests__/bat-mcp.test.mjs`（加 1 個）
- e2e：`e2e/t0643-list-towers.spec.ts`（新）
- 文件：`docs/agent-guide/claude-session-name.md`（新節「以塔台開啟 Claude（T0644）」、新節「列出所有塔台」，另更新名稱表 / 注入 / 查詢範圍 / 已知限制 / 驗證清單）、`docs/agent-guide/helper-query-channels.md`（契約表、範圍、稽核、驗證）、`docs/agent-guide/bat-mcp-shim.md`（tool 表、T0643 一段）、`docs/agent-guide/remote-tower-notify.md`（範圍表加一列）、`CLAUDE.md`（PLAN-050 節加 T0644 / T0643 各一行；「helper 唯讀查詢 channel」節加一句）

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS | `tsc --noEmit -p .` exit 0，0 個錯誤（文件改完後的最終狀態再跑一次） |
| `npm run typecheck:electron` | PASS | exit 0，0 個錯誤 |
| `npm run test:unit` | PASS | 311 files / 5384 passed / 3 skipped（基線 5371 / 310，多 13 個：新檔 12 個 + MCP 1 個；headless 的新增斷言放在既有 it 內）；最終狀態再跑一次，結果相同 |
| `npx vite build` | PASS | exit 0 |
| e2e `e2e/t0643-list-towers.spec.ts` | PASS（5.0 s） | 隔離實例：兩個工作區（A alias `Alpha`、B）各一個塔台分頁 + A 的一般分頁。宣告前 A 列 `towers` → `NOT_OWNER`。兩邊 `--set-role tower` 後，A 的 MCP 看到兩列：A `self: true`、`workspaceName: "Alpha"`、`claudeSessionName: "Alpha · Tower"`；B `workspaceName: "T0643-B"`、`claudeSessionName: "T0643-B · Tower"`。欄位只有白名單內的。A 對 B 的 `bat_get_state` / `bat_read_output` → `NOT_OWNER`。`mine` 只有 A，`workspace` 是 A + 一般分頁。一般分頁列 `towers` → `NOT_OWNER`。debug log 有 `[helper-query] … target=scope=towers → ok count=2`，且不含名稱。第一次跑失敗是 spec 本身的問題（見「遭遇問題」） |
| 回歸 e2e `t0582-helper-query` / `t0642-claude-session-query` | PASS | 2 passed（42.2 s） |

### PLAN-050 介面契約總表（最終版，給 CT-T021）

BAT 版本：T0641–T0644 都還沒發佈，預計進 `0.7.1-pre.1`（D168）。下表的「舊 BAT」指 `0.7.0-pre.9` 以前的版本。

| # | 契約 | 最終形式（欄位 / 值域） | 降級 / null 的意義 | 舊 BAT 的反應（CT 判斷用） | 工單 |
|---|---|---|---|---|---|
| C-1 | 名稱格式 | `claudeSessionName()`（`src/lib/claude-session-name.ts`）：Worker `<ws> · Worker · <T####>`、Tower `<ws> · Tower`、其他 claude-cli 分頁 `<ws> · <短 ID>`（id 去 `-` 取前 6 碼、小寫）。`<ws>` = 工作區 `alias \|\| name`，清理後 ≤ 60 字（去控制字元、`"`→`'`、壓空白、去開頭 `/`），空字串 → `BAT`。整個名稱 ≤ 200（UTF-16），超過時只截 `<ws>`。分隔字元是 ` · `（U+00B7），中文原樣 | 工單編號不合法、名稱是空的 → 不注入（`no-name`） | 不注入 `--name`：ListAgents 顯示目錄名 + 兩字元 | T0641 |
| C-2 | 注入 | claude-cli / claude-cli-worktree 的啟動指令加 `--name=<名稱>`（`=` 形式，放在 BAT 參數最後、自訂參數之前）。不受 `batMcpEnabled` 影響，沒有 Settings 開關。helper 派工用落點工作區的名稱；headless 派工的 `<ws>` 是 `BAT` | — | 同上 | T0641 |
| C-3 | 降級（不注入，記原因） | `not-claude-cli`、`user-args`（自訂參數已有 `--name` / `-n` / 短旗標群組含 `n`）、`no-name`、`claude-too-old`（system claude `< 2.1.76`）、`version-unknown`。原因只寫在 BAT 日誌與內部紀錄，查詢欄位只有 `claudeSessionName: null` | `null` = 沒注入 | — | T0641 |
| C-4 | 查詢欄位 | `terminal:whoami`、`terminal:list`（`mine` / `workspace`）每列、`terminal:get-state` 多兩個鍵，每個回傳都有：`claudeSessionName: string \| null`（最後一次啟動決策注入的名稱）、`claudeSessionId: string(UUID) \| null`（最後一次 `SessionStart` hook 的 session_id，`/clear` 等會換新值）。結束紀錄（10 分鐘 / 32 筆）保留這兩個值。`terminal:wait` 不加 | 🔴 `claudeSessionId: null` **不代表沒有 session**（還沒回報、沒有 hooks、hooks 被關、headless 重開） | 舊 BAT 沒有這兩個**鍵**：鍵不存在當成「不支援」，不要當成 `null` | T0642 |
| C-5 | hook 回報 sessionId | `terminal:report-hook { event: 'session-start', sessionId?: UUID }`。`bat-hook.mjs` 只送 `session_id`，exit 0、stdout 不輸出；日誌只記前 8 碼。不合格的值忽略、不回錯誤 | — | T0600–T0641 的 BAT 忽略 `sessionId`，hook 照樣 exit 0；更舊的 BAT 回 `INVALID_ARGS`，hook 也 exit 0 | T0642 |
| C-6 | 跨工作區列塔台 | `terminal:list { scope: 'towers' }`（MCP `bat_list_terminals scope=towers`）。只給已宣告的塔台，其他 → `NOT_OWNER`（`message: 'scope=towers needs a declared tower (--set-role tower)'`）。回 `{ ok, scope: 'towers', terminals }`：同一 BAT host 所有工作區中執行中、已 `--set-role tower` 的分頁，呼叫者自己也列出。每列 `id` / `workspaceId: string \| null` / `workspaceName: string \| null`（`alias \|\| name`）/ `title?`（只有本機）/ `claudeSessionName: string \| null` / `state`（`working` / `idle` / `blocked`）/ `alive: true` / `self: boolean`。🔴 不回 `claudeSessionId`、`cwd`、輸出、`towerMode`、`workorder`、問題。這些分頁的 get-state / read-output / wait 仍 `NOT_OWNER` | headless 的 `workspaceName` 一律 `null`。BAT 重開後還原的 PTY 要重新 `--set-role tower` 才會被列出（角色不持久化） | `{ ok: false, code: 'INVALID_ARGS', message: 'scope' }`（MCP tool error 文字 `INVALID_ARGS: scope`）→ 判斷為不支援，退回 ListAgents 名稱 / `scope: 'mine'` | T0643 |
| C-7 | 「以塔台開啟 Claude」入口 | 縮圖列「+」選單、Claude CLI 下方。開 claude-cli 分頁並記錄 `launchRole: 'tower'`，名稱 `<ws> · Tower`，⏻ 重啟與還原沿用。標題 `Claude CLI · Tower`。🔴 只負責命名，不做 `--set-role`、不輸入指令，角色仍由 CT 宣告（宣告後標題的結果是 `unchanged`） | 同一工作區開兩個時名稱相同 | 舊 BAT 沒有這個入口 | T0644 |
| C-8 | 持久化 | 與草案不同：名稱 / sessionId 不存在 window registry，而是存在 `<userData>/claude-sessions.json`（`ClaudeSessionPersistence`，無權杖）。BAT 重開、Terminal Server 存活時，對仍存活的 PTY 還原。`launchRole` 隨 renderer 的分頁存檔（`workspaceStore.save()`）。headless 不持久化 | headless 的 bat-server 重啟後兩值都是 `null` | — | T0642 / T0644 |

CT 判斷要點：用 `claudeSessionName` 對 ListAgents 的名稱，用 `claudeSessionId` 對 session（有值時）。要找其他工作區的塔台，先自己 `--set-role tower`，再查 `scope: 'towers'`；拿到 `INVALID_ARGS` 就退回只看 ListAgents。

### 遭遇問題

- e2e 第一次執行時在等 B 工作區塔台分頁的 PTY 那一步逾時：非作用中工作區的分頁要切過去才會 spawn（e2e/t0523 已記載）。spec 改成先點 B、等它的 PTY、再切回 A，之後通過。產品程式沒改。

### 延伸 / 後續

- CT-T021：依上方總表撰寫。
- 已知限制（已寫進 docs）：headless 沒有工作區名稱；一個 BAT host 只看得到自己的塔台；BAT 重開後還原的塔台要重新 `--set-role tower`。

### Commit

- 產品：`a54710aa` feat(T0643): terminal:list scope=towers for declared towers (PLAN-050 C, D167)
- 工單：本次回報的 commit（`git commit --only _ct-workorders/T0643-list-towers-scope.md`）
- 沒有 push。`src/styles/settings.css` 的 M 沒有碰。

### 互動紀錄

無（沒有向塔台提問）。

### Renew 歷程

無。
