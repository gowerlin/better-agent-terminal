---
schema_version: 1
schema_kind: workorder
id: T0641
title: "PLAN-050 A：claude-cli 分頁啟動時注入 `--name`（命名函式、注入點、使用者參數與舊版 claude 降級）——R1 Worker 名稱含工作區與 T####"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T16:18:31+0800"
started_at: "2026-10-18T16:20:23+0800"
updated_at: "2026-10-18T16:43:45+0800"
completed_at: "2026-10-18T16:43:45+0800"
depends_on: [T0640]
related:
  - "D167（使用者決定：R2 (a)+(b)、不加 Settings 開關）；T0640 回報區（Q1 實測、Q2 注入點、介面契約草案 C-1 / C-2 / C-3、實作切分 A、風險 1–3）"
  - "T0584（`buildBatMcpLaunchArgs` 唯一組裝點、`bat-mcp-launch.test.ts` source guard）；T0590 / T0600（`recordBlockedDetection` 的記錄模式）；T0621（`createCodexOscVersionCheck` 版本檢查範本）；T0523（派工落點工作區）；T0639（helper 派工 `agentPreset`）"
  - "後續：T0642（B，R3 查詢欄位 / sessionId / 持久化）、T0644（D，「以塔台開啟」）都用本單的命名函式；T0643（C，`scope: 'towers'`）"
affects_files:
  - "src/lib/claude-session-name.ts（新，`claudeSessionName`，main / renderer 共用）"
  - electron/bat-mcp-launch.ts
  - "electron/terminal-command-handlers.ts（helper 派工傳名稱所需資料）"
  - "src/lib/bat-mcp-launch.ts、src/components/WorkspaceView.tsx（renderer 傳工作區名稱 / 分頁 id）"
  - "electron/main.ts、electron/remote/headless-entry.ts、electron/dispatch-workspace.ts（工作區名稱 dep / host 記錄名稱，只在需要時）"
  - "electron/claude-session-name-record.ts 或同等位置（新，記錄每個分頁實際注入的名稱；本單只記錄、不對外查詢）"
  - "electron/claude-version-check.ts 或同等位置（新，system runtime 版本檢查）"
  - "src/types/index.ts、electron/preload.ts（只在 IPC 參數型別需要時）"
  - "src/**/__tests__/**、electron/__tests__/**、electron/remote/__tests__/**"
  - "e2e/t0641-claude-session-name.spec.ts（新）"
  - "docs/agent-guide/claude-session-name.md（新）、docs/agent-guide/README.md（索引一行）、docs/agent-guide/bat-mcp-shim.md（注入點一句）、CLAUDE.md（新增一節 3–12 行）"
  - _ct-workorders/T0641-claude-session-name-injection.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 名稱格式（D167 / T0640 C-1，唯一實作 `src/lib/claude-session-name.ts` `claudeSessionName(input)`，不 import electron / DOM）：Worker（helper 派工帶 workorder）`<ws> · Worker · <T####>`；塔台（供 T0644 使用，本單只實作函式與測試）`<ws> · Tower`；其他 claude-cli 分頁 `<ws> · <短 ID>`（terminal id 去 `-` 取前 6 碼小寫）。`<ws>` = 工作區 `alias ?? name`，清理：移除 C0 / C1 控制字元、連續空白壓成一個、trim、去掉開頭 `/`、工作區部分 ≤ 60 字元；整個名稱 ≤ 200 字元，從 `<ws>` 截斷；清理後空字串用 `BAT`。"
  - "🔴 注入（C-2）：只對 `claude-cli` / `claude-cli-worktree`，入口是 `buildBatMcpLaunchArgs`（與 `mcp` / `hooks` 並列的獨立一段、各自 reason），**不受 `batMcpEnabled` 影響**、**不加 Settings 開關**（D167）。用 `--name=<quoted>`（`=` 形式，`quoteArgForShell`）。所有 claude 啟動路徑仍經 `withBatMcpLaunchArgs` / `createAgentPromptCommandBuilder`（`bat-mcp-launch.test.ts` source guard 不得放寬）。"
  - "🔴 降級（C-3，不注入、記原因）：非 claude-cli（codex / gemini / 自訂 CLI / raw command / Claude Agent SDK 面板）；自訂參數含 `--name` / `-n` / 合併短旗標含 `n`（`user-args`，使用者的名稱生效）；**system runtime 版本 `< 2.1.76` 或讀不到版本 → 絕不注入**（`claude-too-old` / `version-unknown`；注入會讓 claude exit 1）。版本檢查比照 `createCodexOscVersionCheck`：`execFile` + 5 s timeout、依路徑 + mtime 快取；embedded runtime 不檢查。"
  - "🔴 本單只「記錄」每個分頁實際注入的名稱（以 terminal id 為鍵、與 PTY 分開，比照 `recordBlockedDetection`），**不新增任何查詢欄位**（`whoami` / `list` / `get-state` 的欄位由 T0642 做）。不碰 `scripts/bat-hook.mjs`、`electron/terminal-blocked-state.ts` 的 hook 契約（T0642）。"
  - "🔴 編碼風險（T0640 風險 1）：`·`（U+00B7）與中文工作區名稱經 PTY 打字送進 pwsh / cmd / bash 是否保持原樣 —— e2e 必驗三種 shell（Windows 上 cmd 至少驗 code page 950 的情況）；任一失敗 → 名稱分隔字元改用 ASCII ` - `（並以 ASCII 化或省略非 ASCII 工作區名稱的規則處理），在回報區說明實測結果與最後採用的規則。"
  - "🔴 不改既有契約的語意：helper 參數 / exit code / stdout、`terminal:*` 回傳、`blockedDetection` / `agentStarted` 行為不變。BUG-059 / T0639 的 update guard 行為不變。"
  - "🔴 非隔離工單，本單期間沒有其他 Worker。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。不 push。"
---

# T0641 — claude-cli 分頁注入 `--name`（PLAN-050 A）

## 背景

CT 以跨 session 訊息找 BAT 塔台時，ListAgents 只顯示「目錄名＋兩字元」，分不出塔台與 Worker（PLAN-050）。T0640 實測 `claude --name` 可讓 ListAgents 顯示指定名稱；使用者決定 R2 採 (a)+(b)（D167）。本單是 A：命名函式＋所有 claude-cli 啟動路徑的注入＋降級，Worker 名稱滿足 R1。

## 要做的事

1. **命名函式** `claudeSessionName(input)`（`src/lib/claude-session-name.ts`）：依 memory_overrides 的格式與清理規則；單元測試涵蓋三種角色、清理、截斷（`T####` / `Tower` 一定保留）、空字串、帶前綴工單（`CT-T021` 等，依 `WORKORDER_ID_PATTERN`）。
2. **注入**：`buildBatMcpLaunchArgs` 加名稱段落；`BatMcpLaunchRequest` 多帶算好的名稱（或算名稱所需的資料，擇一並說明）；`BatMcpLaunchResult` 多 `name` / `nameReason`。renderer（`WorkspaceView` → `withBatMcpLaunchArgs`）傳工作區名稱與分頁 id；helper 派工（`createAgentPromptCommandBuilder`）以派工落點工作區（T0523）與 workorder 算 Worker 名稱。headless（沒有工作區名稱）怎麼處理，擇一並說明。
3. **降級**：使用者參數偵測、system runtime 版本檢查（新模組）、非 claude-cli 不注入；日誌比照 `[bat-mcp]` 一行記 `name=yes|no (<原因>)`，不記其他敏感資料。
4. **記錄**：每個分頁實際注入的名稱（含「沒注入與原因」），供 T0642 查詢。
5. **文件**：新增 `docs/agent-guide/claude-session-name.md`（格式、注入點、降級、版本門檻、編碼實測、已知限制、驗證清單）；`docs/agent-guide/README.md` 索引一行；CLAUDE.md 新增一節「Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）」（3–12 行，依 CLAUDE.md 撰寫規則）。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files；基線 5303 / 304）
- `npx vite build` 成功
- e2e `e2e/t0641-claude-session-name.spec.ts`（隔離實例、不耗 token；自訂 CLI 或 node 腳本印出 `process.argv` 代替 claude）：UI 開 claude-cli 分頁 → 指令含 `--name=<ws> · <短 ID>`；helper 派工 → `<ws> · Worker · T####`；自訂參數已含 `--name` → 不注入；pwsh / cmd / bash 三種 shell 下 `·` 與中文工作區名稱到達程式時不變（或依結果改用 ASCII 規則）
- 實機（選做，若時間允許且不耗 token）：在本機用內嵌 claude 啟動一個帶 BAT 注入名稱的分頁，從自己的 session 以 ListAgents 觀察顯示名稱，結束後確認沒有殘留 session

## 驗收

- claude-cli 分頁與 helper 派出的 claude Worker 啟動指令帶正確名稱；codex / raw command / Agent SDK 面板不受影響
- 使用者參數 `--name` 優先；system runtime 舊版或讀不到版本時不注入
- 驗證全部通過；回報區附：名稱實例、降級原因表、編碼實測結果、測試清單、commit

---

## 回報區

### 結果摘要

**DONE**。claude-cli 分頁（UI 開的 / 還原 / ⏻ 重啟）與 helper 派出的 claude Worker 啟動指令帶 `--name=<名稱>`；codex / raw command / Agent SDK 面板不受影響；使用者 `--name` 優先；system runtime 舊版或讀不到版本時不注入。驗證全過（typecheck 0 / 0、unit 5334 passed / 307 files、vite build、e2e 1 passed），另做了選做的實機 ListAgents 檢查。產品 commit `b6acce0a`。

### 名稱實例

| 情況 | 名稱 |
|---|---|
| helper 派工 Worker（落點工作區 `better-agent-terminal`） | `better-agent-terminal · Worker · T0641` |
| 帶前綴工單（headless，沒有工作區名稱） | `BAT · Worker · CT-T021` |
| UI 開的 claude-cli 分頁（e2e，工作區 `測試工作區 Bob's`、分頁 id `e2e-t0641-claude`） | `測試工作區 Bob's · e2et06` |
| Tower（給 T0644，本單只有函式與測試） | `better-agent-terminal · Tower` |
| pwsh 實際打進去的字詞 | `'--name=測試工作區 Bob''s · Worker · T0641'` |

### 實作與選擇（工單要求「擇一並說明」的部分）

- **命名函式** `src/lib/claude-session-name.ts`：`claudeSessionName(input)`（三種角色）、`cleanSessionWorkspaceName`、`claudeSessionShortId`、`normalizeClaudeSessionName`（main 端再清理 IPC 收到的名稱）。`WORKORDER_ID_PATTERN` 在本檔放一份複本：`src/types/control-tower.ts` 那份會把 js-yaml 帶進 main bundle；兩者一致由單元測試斷言。
- **`BatMcpLaunchRequest` 帶「算好的名稱」**（`sessionName`），不傳算名稱的資料：renderer 才知道工作區名稱與分頁 id（launch args 在 PTY 建立前就問），T0644 還要傳 Tower 角色；main 只做清理與 200 上限。另多 `claudeNameSupport`（版本檢查結果）。`BatMcpLaunchResult`（claude）多 `name` / `nameReason`。
- **注入**：`buildBatMcpLaunchArgs` 裡與 `mcp` / `hooks` 並列的獨立一段，`--name=` 放在 BAT 參數最後、自訂參數之前；`batMcpEnabled` 關閉、endpoint 沒在監聽、找不到 helper 時都照樣注入（D167）。`createBatMcpLaunchArgs` / `main.ts` / headless 那幾行 source guard 原樣保留。
- **版本檢查** `electron/claude-version-check.ts` `createClaudeNameSupportCheck`：runtime 在啟動決策時以 `resolveClaudeRuntime(getRuntimeSettingsSnapshot())` 再解析一次；embedded / fallback-to-embedded 不檢查；system 用 `execFile <path> --version`、5 s timeout、依路徑 + mtime 快取，門檻 `2.1.76`。`buildBatMcpLaunchArgs` 維持同步，所以非同步的檢查放在兩個呼叫端：`agent:bat-mcp-launch-args` handler 改成 async（`withClaudeNameSupport`），派工 builder 用新的 `claudeNameSupport` dep。只有可能注入時才問（`needsClaudeNameSupport`）。
- **headless**：遠端視窗的 UI 分頁由 renderer 送名稱，與本機相同。headless 的 helper 派工沒有工作區名稱，**選擇仍注入** `BAT · Worker · T####`：R1 要的 `T####` 還在；不注入的話 ListAgents 只會顯示目錄名，更差。
- **記錄** `electron/claude-session-name-record.ts`：`claudeSessionNameRecords`（每個行程一份，以 terminal id 為鍵、與 PTY 分開），值 `{ name | null, reason?, at }`，codex / 其他 agent 記 `not-claude-cli`；上限 512 筆。不新增查詢欄位，沒碰 hook 契約。
- **IPC**：`agent:bat-mcp-launch-args` 加第 5 個參數 `sessionName`（preload / `src/types/electron.d.ts`）。舊 server 會忽略它（不注入）；舊 renderer 不送 → `no-name`。

### 降級原因表

| 原因（記錄的 `reason` / `nameReason`） | 觸發條件 |
|---|---|
| `not-claude-cli` | codex / gemini / 自訂 CLI（只在記錄裡）。raw command 與 Agent SDK 面板不經過啟動決策，所以沒有紀錄 |
| `user-args` | 自訂參數符合 `(^\|\s)(--name(\s\|=\|$)\|-[A-Za-z]*n)`：`--name x`、`--name=x`、`-n x`、`-cn x`、`-nfoo` |
| `no-name` | 沒送名稱（舊 renderer）、名稱清理後是空的、Worker 工單編號不合法 |
| `claude-too-old` | system runtime 的 claude `< 2.1.76`（絕不注入） |
| `version-unknown` | system 讀不到版本、runtime 解析失敗、host 沒接版本檢查（絕不注入） |

日誌：`[bat-mcp] … ; hooks=…; name=yes | name=no (<reason>)`；system 檢查時另有 `[claude-version] path=… version=… (cached|probed) → name=…`。

### 編碼實測（風險 1）

e2e 第 4 段把 BAT 為各 shell family 實際組出的 `--name=` 字詞打進該 shell，前面接一支寫出 argv 的 node 腳本。名稱 `測試工作區 Bob's · Worker · T0641`（含 U+00B7、中文、撇號）：

| shell | 打進去的字詞 | node 收到 | 結果 |
|---|---|---|---|
| pwsh 7 | `'--name=測試工作區 Bob''s · Worker · T0641'` | `--name=測試工作區 Bob's · Worker · T0641` | ✅ 不變 |
| cmd（`chcp` 實測 **950**） | `"--name=測試工作區 Bob's · Worker · T0641"` | 同上 | ✅ 不變 |
| Git Bash `--login -i` | `'--name=測試工作區 Bob'\''s · Worker · T0641'` | 同上 | ✅ 不變 |

⇒ **維持 ` · `（U+00B7）與中文工作區名稱，不改用 ASCII 規則。**

### 驗證證據

- source / docs：新增 `docs/agent-guide/claude-session-name.md`、README 索引一行、`bat-mcp-shim.md` 注入一句、CLAUDE.md 新節（6 行）→ PASS
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0 → PASS
- `npm run test:unit`：**307 files / 5334 passed / 3 skipped**（基線 304 / 5303）→ PASS
  - 新增 `src/lib/__tests__/claude-session-name.test.ts`（8）、`electron/__tests__/claude-version-check.test.ts`（6）、`electron/__tests__/claude-session-name-launch.test.ts`（17）
  - 既有測試更新：`bat-mcp-launch.test.ts`、`blocked-hooks-launch.test.ts`（toEqual 加 `nameReason: 'no-name'`、日誌加 `; name=no (no-name)`、handler 改 await、renderer source guard 允許 `, sessionName`）、`agent-prompt-command.test.ts`（`Required<deps>` 補 `claudeNameSupport`）。斷言的語意都沒放寬，只加上新欄位。
- `npx vite build` → PASS
- e2e `npx playwright test e2e/t0641-claude-session-name.spec.ts` → **1 passed（12.2 s）**：還原的 claude-cli 分頁出現 `… '--name=測試工作區 Bob''s · e2et06'; hooks=yes; name=yes`；派出的 Worker 出現 `… '--name=測試工作區 Bob''s · Worker · T0641'; hooks=yes; name=yes`；使用者 `--name mine` → 沒有 `--name=`、`name=no (user-args)`；codex 沒有名稱；三種 shell 的結果見上表。claude 一律用工作區自訂參數 `--version` 啟動（印版本後結束），不開 TUI、不耗 token。
- 實機（選做）→ PASS：在 scratchpad 用 node-pty 經 pwsh 啟動內嵌 claude 2.1.300，帶同一個字詞、不送 prompt。`~/.claude/sessions/32268.json` 的 `name` = `測試工作區 Bob's · Worker · T0641`（`nameSource: user`）；本 session 的 ListAgents 列出 `測試工作區 Bob's · Worker · T0641 [877161] · interactive · idle`。結束後登錄檔已移除，ListAgents 恢復成原本 2 個 peer，沒有產生 transcript，模型呼叫 0 次。

### 異動檔案與 commit

- 產品 commit：`b6acce0a` feat(T0641)（22 檔：新增 8、修改 14，即 `affects_files` 範圍內的檔案）。用 `git commit --only`；`src/styles/settings.css` 的 M 沒動。沒有 push。
- `src/types/electron.d.ts`：preload API 型別，屬 `affects_files`「`src/types/…`（只在 IPC 參數型別需要時）」，因 `batMcpLaunchArgs` 多一個參數而修改。`electron/dispatch-workspace.ts` 不必改（`landing.workspaceName` 本來就有）。

### 偏離 / 補充規則

1. **`"` 換成 `'`**（清理規則，工單沒有列）：cmd 的雙引號引數裡沒辦法跳脫 `"`，`quoteArgForShell` 的 `\"` 會讓 cmd 結束引號狀態，後面的 `&` 會被當成指令分隔。工作區名稱可能就是資料夾名，所以補上這條。已寫進 docs 與測試。
2. `alias || name`（而不是 `alias ?? name`）：空字串的 alias 當作沒有，與 `dispatch-workspace.ts` 的 `nonEmpty(alias) ?? nonEmpty(name)` 一致。
3. 控制字元照工單「移除」，所以 tab / 換行是直接刪掉，不會換成空白。

### 已知限制

- CT 面板的「執行工單 / 補結案」按鈕走 raw command（`claude "/ct-exec T####"`），不經過啟動決策，所以沒有名稱（BAT MCP / hooks 本來也沒有）；R1 只涵蓋 helper 派工。
- headless 派工的名稱是 `BAT · Worker · T####`。
- 名稱只在啟動時決定；之後工作區改名或使用者 `/rename`，BAT 的紀錄都不會更新。紀錄只存在記憶體，BAT 重開就沒了（持久化屬 T0642 C-8）。
- system 模式下 router 本身每次啟動都會 probe 一次（既有行為），本單的檢查第一次多一次 `execFile`，之後命中快取。

### 遭遇問題

- 選做實機檢查的 harness 前兩次沒跑起來：一次是 Git Bash 的 `$(pwd)` 傳成 `/d/...`，一次是 heredoc 吃掉反斜線。改用 `pwd -W`、用 Write 寫檔後就正常了（L129），與產品無關。
- 收尾 self-check（v5.7.1）：(a) 沒有 `#### Q-n`，不適用；(b) 沒有殘留的範本佔位文字；(c) `### 互動紀錄` 只有一個。

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；沒有需要問塔台的範圍內問題）。

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：`src/lib/claude-session-name.ts`（祖先 `src/lib` 存在）、`electron/bat-mcp-launch.ts`、`electron/terminal-command-handlers.ts`、`src/lib/bat-mcp-launch.ts`、`electron/main.ts` 都在 → PASS
- C-2：工單沒有 `branch` 欄位，目前分支 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定
