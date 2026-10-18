---
schema_version: 1
schema_kind: workorder
id: T0641
title: "PLAN-050 A：claude-cli 分頁啟動時注入 `--name`（命名函式、注入點、使用者參數與舊版 claude 降級）——R1 Worker 名稱含工作區與 T####"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T16:18:31+0800"
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

（Worker 填寫）
