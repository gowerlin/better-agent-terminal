---
schema_version: 1
schema_kind: workorder
id: T0584
title: "PLAN-047 M1-2：`bat-mcp.mjs` stdio shim（手寫 dual-era）+ BAT 啟動 claude / codex 時自動掛上 + 打包 / server bundle + 稽核"
type: feature
status: DONE
started_at: "2026-10-17T22:25:40+0800"
updated_at: "2026-10-17T22:52:36+0800"
completed_at: "2026-10-17T22:52:36+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-17T22:23:52+0800"
target_version: "0.7.0-pre.2（候選）"
depends_on: [T0582]
related:
  - "T0582 回報區「T0584 shim 需要知道的事」與契約（五個唯讀 channel）；T0585 的 `worktree:terminal-status` 契約（並行開發，見下）"
  - "T0574 回報區 R1（MCP 2026-07-28、Claude Code 2.1.300 / Codex 0.162.1 注入方式與逾時）、R4（原型協定實測 JSON）"
  - "D149 / D152；T0433 / T0456（helper 隨 server bundle 部署、`BAT_HELPER_NODE`）、BUG-114（frame id 比對）、T0451（helper 連線 ping / 上限）、T0377（`agent:build-launch-command` 參數去重）"
affects_files:
  - "scripts/bat-mcp.mjs（新）"
  - "scripts/_bat-*.mjs（必要時抽共用；不得改變 bat-terminal / bat-notify 行為）"
  - "package.json（`build.extraResources` filter；若需要）"
  - "scripts/build-server-bundle.mjs（`serverBundleHelperScripts`）、scripts/verify-server-bundle.js、scripts/dev-deploy-headless.mjs、scripts/verify-helper-bundle.js（若需要）"
  - electron/agent-runtime/agent-registry.ts
  - "electron/terminal-command-handlers.ts、electron/main.ts、electron/remote/headless-entry.ts（注入接線；只動啟動命令組裝相關處）"
  - "src/components/SettingsPanel.tsx（或 Advanced 設定所在檔）、src/types/index.ts、src/locales/*.json（開關，三語）"
  - "electron/__tests__/**、scripts/__tests__/**、e2e/t0584-*.spec.ts（新）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0584-bat-mcp-stdio-shim.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0585 同時在改 `scripts/bat-terminal.mjs`、`electron/remote/helper-capability.ts`、`electron/ct-worktree.ts`、`CLAUDE.md`（它新增 worktree 狀態小節）。你不動這三個程式檔；CLAUDE.md 只新增自己的小節。不要動共用 index 裡別人 stage 的內容；commit 前 `git diff --cached` 只能有你的檔 / hunk。"
  - "🔴 權杖絕不寫進任何設定檔、命令列、日誌：shim 只從自己繼承的 env 讀 `BAT_REMOTE_TOKEN`。不得用 `--strict-mcp-config`（不能蓋掉使用者自己的 MCP 設定）。"
  - "🔴 不執行任何會送 prompt / 耗 token 的 claude / codex 指令；`claude mcp list` / `get` 這類健康檢查可用，且一律用隔離 `CLAUDE_CONFIG_DIR`。e2e 用隔離實例（需先 `npx vite build`），不碰使用者的 BAT（9876）。"
  - "🔴 不做寫入類 tool（M2 / M3）、不做 blocked（M1b）；Claude Agent SDK 面板（integrated agent）不在範圍。"
---

# T0584 — `bat-mcp.mjs` stdio shim（M1-2）

## 背景

T0582 已在 RemoteServer 上提供五個唯讀 helper channel（範圍由權杖決定）。本單把它們包成 MCP tool，讓 BAT 分頁裡的 claude / codex 直接呼叫，不必解析 helper CLI 文字。傳輸用 stdio shim 連既有 WSS（D149 / T0574 Q1），不開新埠。T0574 R4 原型（約 200 行、零依賴、dual-era）已在隔離實例與內嵌 claude 2.1.300 實測可行（Claude Code 走 modern `server/discover`）。

T0582 給 shim 的重點（原文摘要）：
- 連 `wss://127.0.0.1:$BAT_REMOTE_PORT`，`auth` 帶 `BAT_REMOTE_TOKEN`，回應以 frame `id` 比對（BUG-114）；helper 連線不收廣播。
- 身分 = 權杖；`terminalId` 省略 = 自己。
- invoke 逾時須大於 `terminal:wait` 的 `timeoutMs`（上限 45 s，建議 shim 端 ≥ 50 s）；其餘 channel 同步回應。
- RemoteServer 每 30 s 對 helper 連線 ping，沒回 pong 即斷（T0451）；每權杖同時連線數有上限、過多拒絕會被節流。`bat-*.mjs` 的 `MinimalWS` 是短連線設計。
- 錯誤碼：`INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `TOO_MANY_WAITS`（檢查順序：參數 → 存在 → 範圍）。
- `read-output` 增量讀取：保存 `nextCursor`；`partialLine:true` 時最後一行下次再出現；`truncated:true` 表示中間輸出已看不到。TUI 重繪行數多，建議搭配 `maxLines`。

## 介面契約（本單定稿；CT 依此撰寫 MCP 用法）

**Tools**（全部 `readOnlyHint: true`；名稱固定；MCP server 名稱 `bat` → client 端呈現為 `mcp__bat__<tool>`）：

| tool | 對應 channel | 參數 |
|---|---|---|
| `bat_whoami` | `terminal:whoami` | 無 |
| `bat_list_terminals` | `terminal:list` | `scope?: 'mine' \| 'workspace'` |
| `bat_get_state` | `terminal:get-state` | `terminalId?` |
| `bat_read_output` | `terminal:read-output` | `terminalId?`、`cursor?`、`maxLines?` |
| `bat_wait` | `terminal:wait` | `terminalId?`、`until`、`fromState?`、`timeoutMs?` |
| `bat_worktree_status` | `worktree:terminal-status`（T0585） | `terminalId?`、`workorder?` |

- 成功：`structuredContent` = channel 回傳（去掉 `ok`），`content` 一段簡短文字摘要。
- channel 回 `{ ok:false, code }` → MCP tool 結果 `isError: true`，`structuredContent: { code, message? }`（不是 JSON-RPC error）。BAT 太舊（`No handler for channel`）→ `code: 'UNSUPPORTED'`。連線 / 認證失敗 → `code: 'CONNECT_FAILED' \| 'AUTH_FAILED'`。未知 tool → JSON-RPC `-32602`。
- 協定：同時支援 legacy `initialize`（`2025-11-25` 等）與 `2026-07-28` 的 `server/discover` + per-request `_meta`；不支援的版本回 `-32022`（R4 實測格式）。
- `bat_worktree_status` 的 channel 由 T0585 並行實作，契約：參數 `{ terminalId?: string, workorder?: string }`，回傳 `{ ok:true, isolated:false }` 或 `{ ok:true, isolated:true, path, branch, base, head, mainHead, ahead, behind, dirty, changedFiles, outOfScopeFiles, conflicts, touchesCtWorkorders }`；本單只轉接，測試以 stub 驗證轉接即可。

**注入**（Settings → Advanced 新增開關「BAT MCP（讓分頁內的 agent 查詢 BAT）」，**預設開**，三語）：
- 只對 BAT 啟動命令有組裝權的 agent 分頁：claude 系列 terminal preset（`claude-cli` / `claude-cli-worktree` / 對應的 terminal-driven id）與 codex CLI；UI 按鈕、新建 / 還原 / 重啟 Agent 終端、helper `create-agent-command` 派工都經同一個組裝點（`agentRegistry.buildLaunchCommand` 一帶，以實際程式為準）。raw command 模式不注入（命令原樣執行）。
- claude：`--mcp-config <檔案路徑>`，設定檔由 BAT 寫在 userData（例 `bat-mcp/claude.json`，內容只有 command / args，**無權杖、無 env 值**；shim 從繼承的 env 讀）。不加 `--strict-mcp-config`。
- codex：`-c mcp_servers.bat.command=… -c mcp_servers.bat.args=[…] -c mcp_servers.bat.tool_timeout_sec=60`（引號 / 跳脫以實測為準，Windows pwsh 與 bash 都要能跑）。
- node：本機 `node`（同其他 helper）；headless 用 `BAT_HELPER_NODE` 絕對路徑、shim 用 `<installRoot>/scripts/bat-mcp.mjs` 絕對路徑。
- 使用者自己的 `agentCustomArgs` 已含 `--mcp-config` 時不重複注入同名 server（記日誌）；開關關閉時完全不注入。
- 不是 BAT 環境（缺 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`）或 RemoteServer 未監聽 → 不注入。

**稽核**：shim 每次 `tools/call` 以既有 `_bat-logger` 寫 `bat-scripts.log` 一筆（`script: 'bat-mcp'`、`event: 'tool-call'`、tool、ok / code、耗時；不記參數中的輸出內容、不記權杖）；`_meta.traceparent` 有就一併記錄。

## 任務

1. `scripts/bat-mcp.mjs`：零依賴手寫（不引入 MCP SDK）；連線策略自選（每次呼叫短連線，或長連線並正確回 pong），寫明理由；invoke 逾時 `bat_wait` ≥ 50 s、其他沿用 helper 慣例；憑證 pinning 與 frame id 比對沿用 `_bat-cert.mjs` 等既有模組（`verify-helper-bundle.js` 只認靜態相對 `.mjs` import）。
2. 打包：桌面 `extraResources` 已含 `scripts/*.mjs` 時確認涵蓋；server bundle `serverBundleHelperScripts`、`verify-server-bundle.js`、`dev-deploy-headless.mjs` 同步；`npm run verify:helpers` 通過。
3. 注入：Settings 開關、組裝點、claude 設定檔寫入（userData，lazy 取路徑，不得在 import 期呼叫 `app.getPath`）、codex `-c`；headless 經 server 的 settings（沿用 headless 讀 `<dataDir>/settings.json` 的方式），預設開。
4. 測試：JSON-RPC 單元測試（legacy / modern、tools/list、每個 tool 轉接、錯誤對應、未知 tool、版本不支援、`UNSUPPORTED`）、對真 RemoteServer + 範圍權杖的整合測試（比照 T0582 整合測試）、組裝點注入測試（開 / 關、claude / codex、使用者已有 `--mcp-config`、raw command 不注入、檔案內容無權杖）、`server-bundle-helpers` 類打包測試。
5. e2e（隔離實例）：塔台分頁派 Worker（自訂 CLI 跑 node 腳本）；在塔台分頁內以分頁 env 啟動 `bat-mcp.mjs`，由測試用 client 走 stdio 呼叫 `server/discover` → `tools/list` → `bat_whoami` / `bat_list_terminals` / `bat_read_output`（看得到 Worker 輸出）/ `bat_wait until=exit`；Worker 呼叫 `bat_read_output` 讀塔台 → `isError` + `NOT_OWNER`。另以隔離 `CLAUDE_CONFIG_DIR` + 內嵌 claude `claude mcp list --mcp-config <BAT 產生的檔案>`（或等價、不送 prompt 的健康檢查）確認 ✔ Connected。
6. CLAUDE.md：新增「BAT MCP shim（PLAN-047 M1 / T0584）」小節：tool 表、注入規則與開關、設定檔位置、錯誤碼、日誌、已知限制（例：Agent SDK 面板不注入、舊 BAT 回 `UNSUPPORTED`）、驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠；`npm run verify:helpers` 通過。
2. 上述單元 / 整合 / e2e 通過；開關關閉時啟動命令與現在逐字相同。
3. 回報區附：實際注入的 claude / codex 命令片段（權杖不出現）、`claude mcp` 健康檢查輸出、連線策略理由、與契約的差異（若有）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
**DONE** — shim、注入（本機 / headless / renderer / helper 派工）、打包、Settings 開關（預設開，三語）、測試（unit / 整合 / e2e）、CLAUDE.md 小節全部完成；驗收條件 1–3 皆有證據（見下）。

### 落點檢查（Landing Zone）
**PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 前幾項（`scripts/`、`package.json`、`scripts/build-server-bundle.mjs`、`electron/agent-runtime/agent-registry.ts`）皆存在；C-2 無 `branch` 欄位（main）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。CT_MODE=yolo、CT_INTERACTIVE=0。

### 實作摘要
- **`scripts/bat-mcp.mjs`（新）**：零依賴手寫 stdio MCP server（NDJSON JSON-RPC）。dual-era：legacy `initialize` / `notifications/initialized` / `ping`；modern `2026-07-28` `server/discover` + per-request `_meta` 版本，modern 結果帶 `resultType`，`server/discover` / `tools/list` 帶 `ttlMs` + `cacheScope: 'private'`（從 claude 2.1.300 二進位讀出的 zod schema：`cacheScope: enum(["public","private"])`、tools/list 必填 `ttlMs`）。六個 tool 依契約轉接；`_bat-cert.mjs` pinning、`_bat-logger.mjs` 稽核（只有靜態相對 import，`verify:helpers` 通過）。可被測試 import（`createMcpServer` / `BatConnection` / `classifyInvokeError`），直接執行時才跑 `main()`。
- **`electron/bat-mcp-launch.ts`（新）**：注入唯一實作（不 import electron）＋ `agent:bat-mcp-launch-args` handler。`main.ts`（`batMcpHost`，userData lazy 取、`localHelperDir()` 與 PtyManager 共用）、`headless-entry.ts`（`createHeadlessBatMcpHost` / `createHeadlessBatMcpModule`、`createHeadlessTerminalModule` 的 `batMcpInstallRoot`）、`terminal-command-handlers.ts`（`createAgentPromptCommandBuilder` 新 dep `batMcpLaunchArgs`）。
- **renderer**：`src/lib/bat-mcp-launch.ts` `withBatMcpLaunchArgs`；`WorkspaceView.tsx` 的 `startClaudeCliPty` 與四處 `buildLaunchCommand`（還原 / 預設 Agent 終端 / 新增 / 重啟）。preload `agent.batMcpLaunchArgs`、`electron.d.ts`。
- **Settings**：`batMcpEnabled?: boolean`（`src/types/index.ts`）、`settingsStore.setBatMcpEnabled`、Settings → Advanced「BAT MCP（讓分頁內的 agent 查詢 BAT）」checkbox（`settings.batMcpEnabled !== false` = 預設開），en / zh-TW / zh-CN。
- **打包**：桌面 `extraResources` 的 `scripts/*.mjs` 已涵蓋（不改 package.json）；`build-server-bundle.mjs` `serverBundleHelperScripts` + `bat-mcp.mjs`；`verify-helper-bundle.js` 必要清單 + `bat-mcp.mjs`；`verify-server-bundle.js` 新增 `scripts/` 五個 helper 存在檢查；`dev-deploy-headless.mjs` 由清單 SoT 解析，不需改程式（只改其測試清單）。
- **CLAUDE.md**：新增「BAT MCP shim（PLAN-047 M1 / T0584）」小節（插在 T0582 小節之後），未改其他小節。

### 連線策略與理由
**一條共用的長連線，第一次 call 才連、閒置 5 s 關閉，並回 heartbeat pong**。
- 每個權杖同時連線上限 4（`HELPER_MAX_CONNECTIONS_PER_CAPABILITY`），且與同分頁的 `bat-terminal` / `bat-notify` 共用：每 call 一條短連線時，agent 並行 3–4 個 `bat_wait` 就會撞上限被拒（還會累計 helper denial）。共用連線以 frame id 多工（T0582 已確認 server 端 wait 不擋同連線其他 invoke）。
- 常駐不關的長連線則一直佔一個名額，且 BAT 重開（同 env、新 server）後要自己處理重連；閒置關閉讓下一次 call 自然重連。
- `bat_wait` 最長 45 s > 30 s heartbeat：shim 自己的 WebSocket client 回 pong（`bat-*.mjs` 的 `MinimalWS` 不回）。整合測試以 heartbeat 200 ms + 1.5 s wait 驗證；**反向驗證**：暫時拿掉 pong → `CONNECT_FAILED: connection closed`，已還原。
- 逾時：`bat_wait` 55 s（> 45 s），worktree_status 15 s（與 T0585 `bat-terminal --worktree-status` 一致；git 查詢），其餘 3 s（helper 慣例）。codex 注入 `tool_timeout_sec=60` > 55 s。

### 實際注入的命令片段（權杖不出現；來自 e2e 隔離實例）
- claude（pwsh；`agent:bat-mcp-launch-args('claude-cli','pwsh','--model opus')`）：
  `'--mcp-config=C:\Users\Gower\AppData\Roaming\BetterAgentTerminal-runtime-e2e-t0584-1792248378007\bat-mcp\claude.json'`
  → 完整命令 = `& '<claude.exe>' '--mcp-config=…\bat-mcp\claude.json' --model opus`
  設定檔內容：`{"mcpServers":{"bat":{"type":"stdio","command":"node","args":["D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\better-agent-terminal\\better-agent-terminal\\scripts\\bat-mcp.mjs"]}}}`（無 token、無 env）
- codex（pwsh）：`-c 'mcp_servers.bat.command=''node''' -c 'mcp_servers.bat.args=[''D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal\scripts\bat-mcp.mjs'']' -c mcp_servers.bat.tool_timeout_sec=60`
- codex（posix）：`-c 'mcp_servers.bat.command='\''node'\''' -c 'mcp_servers.bat.args=['\''D:\…\scripts\bat-mcp.mjs'\'']' -c mcp_servers.bat.tool_timeout_sec=60`
- helper 派工（單元測試 golden）：`& 'C:\BAT\claude.exe' '--mcp-config=<userData>\bat-mcp\claude.json' --dangerously-skip-permissions '/ct-exec T0584'`；codex：`codex -c … -c mcp_servers.bat.tool_timeout_sec=60 --yolo '$ct-exec T0584'`
- codex `-c` 引號實測（隔離 `CODEX_HOME`，codex-cli 0.162.1，`codex mcp get bat --json`，不連線、不送 prompt）：bash / pwsh / cmd 三種寫法都解析為 `command: "node"`、`args: ["C:\\Program Files\\X\\bat-mcp.mjs"]`、`tool_timeout_sec: 60.0`。

### `claude mcp` 健康檢查輸出（內嵌 claude 2.1.300，隔離 `CLAUDE_CONFIG_DIR`，無認證、未送 prompt）
e2e（BAT 產生的 `claude.json` 的 `mcpServers.bat` → `claude mcp add-json -s user bat` → `claude mcp list`）：
```
Checking MCP server health…

bat: node D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal\scripts\bat-mcp.mjs - ✔ Connected
```
手動另跑 `claude mcp get bat` → `Status: ✔ Connected / Type: stdio`；shim 的 `bat-scripts.log` 有 `start` / `exit (stdin closed)`。
- `claude mcp list --mcp-config=…` 不行：`mcp list` 不讀 root 的 `--mcp-config`（`No MCP servers configured`），放在子命令後則 `error: unknown option`，故以等價的 `add-json` 做檢查。
- **variadic 實測**（無認證、MCP 設定驗證先失敗，不會連 API）：`--mcp-config <bad> "hello-prompt" -p` → 兩行 `MCP config file not found`（第二行是 `hello-prompt`，prompt 被吞）；`--mcp-config=<bad> "hello-prompt" -p` → 只有一行 → 採 `=` 形式。

### 驗證證據
| 項目 | 結果 |
|---|---|
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS（0 error） |
| `npm run typecheck:electron` | PASS（0 error） |
| `npm run test:unit` | PASS — 284 files / 4992 passed / 3 skipped |
| `npm run verify:helpers` | PASS — `server bundle ships 5 helper(s) with a closed import set` |
| `scripts/__tests__/bat-mcp.test.mjs` | 24 passed（JSON-RPC 兩代、-32022、-32602 / -32601 / -32700、六 tool 轉接、錯誤對應、UNSUPPORTED、T0585 回傳摘要、稽核、真程序 stdio） |
| `electron/__tests__/bat-mcp-shim-remote.test.ts` | 5 passed（真 shim 程序 + 真 RemoteServer + 範圍權杖；含 pong 反向驗證） |
| `electron/__tests__/bat-mcp-launch.test.ts` | 18 passed（注入開 / 關、claude / codex、使用者已有 `--mcp-config`、raw command 不注入、檔案無權杖、headless host、source guards） |
| `src/lib/__tests__/bat-mcp-launch.test.ts` | 4 passed |
| `scripts/__tests__/server-bundle-helpers.test.mjs` / `dev-deploy-headless.test.mjs` | PASS（新增「缺 bat-mcp.mjs 即失敗」） |
| `electron/__tests__/agent-prompt-command.test.ts` | PASS — 開關關閉時與 T0431 前的逐字比對矩陣不變 |
| e2e `e2e/t0584-bat-mcp-shim.spec.ts` | PASS（11.8 s；兩次） |
| e2e 回歸 `t0582-helper-query` / `t0529-workspace-agent-launch` | PASS（3 passed，28 s） |

### 與契約的差異 / 偏離
1. **範圍擴充（必要）**：claude-cli 的啟動命令實際由 renderer 組裝（`WorkspaceView.startClaudeCliPty` → `claude:get-cli-path`），`agentRegistry.buildLaunchCommand` 對 claude-cli 回 `null`；且遠端視窗要用 server 的路徑。因此新增 proxied channel `agent:bat-mcp-launch-args`（`protocol.ts` / `path-aware-channels.ts` 分類：參數 path-free、結果 server 形式），並改 `WorkspaceView.tsx`、`src/lib/bat-mcp-launch.ts`、`preload.ts`、`electron.d.ts`、`settings-store.ts`（這些不在 `affects_files`）。`agent-registry.ts` 未改。
2. claude 用 **`--mcp-config=<檔案>`**（不是空格形式），理由見上（variadic）。
3. 契約外的 shim 錯誤碼：`FORBIDDEN`（其他 `Forbidden: …`）、`TIMEOUT`、`ERROR`、`INVALID_ARGS`（arguments 非物件）；`UNSUPPORTED` 另涵蓋 `Forbidden: channel-not-allowed`（舊 BAT 的 helper 權杖看到的是這個，不是 `No handler`），並在同一 shim 程序內快取，避免重複 denial 被節流。
4. `bat_read_output` 的 `content` 除摘要行外附上輸出行（只讀 `content` 的 client 才看得到輸出）；其他 tool 為一行摘要。
5. 健康檢查以 `claude mcp add-json` + `mcp list` 等價方式（`mcp list` 不吃 `--mcp-config`）。
6. 不注入的範圍另含 CT 面板「執行 / 補結工單」按鈕（`pty.createWithCommand` raw command，命令原樣執行）。
7. claude-cli 分頁實際打字啟動沒有 e2e（會啟動真的 claude TUI）；以 renderer 單元測試 + source guard（四處 `buildLaunchCommand` 與 `startClaudeCliPty` 都經 `withBatMcpLaunchArgs`）+ IPC e2e 涵蓋。

### 遭遇問題
- **誤觸一次 codex 啟動**：實測 `-c` 引號時，第一行指令誤寫成 `codex 'mcp_servers.bat.command=node'`（被當成 prompt）。確認：隔離 `CODEX_HOME`（空目錄、無 auth），codex 回 `Error: stdin is not a terminal` 立即結束 → **未送出 prompt、無 token 消耗**。
- **與 T0585 共用工作樹**：執行中途 `main.ts` / `headless-entry.ts` / 測試清單出現 T0585 的未提交修改（相鄰 hunk）；我把自己對共用檔的修改記成可在 HEAD 上重放的替換清單備用。T0585 隨後已 commit（`77c93c64`），commit 時 `git diff` 只剩本單的 hunk，以 `git commit --only <本單檔案>` 提交，未動 `src/styles/settings.css`。
- `worktree:terminal-status` 回傳的 `dirty` 是陣列（另有 `dirtyCount` / `changedCount` / `outOfScopeCount`），摘要已依 T0585 實際回傳調整並加測試。

### 已知限制 / 後續建議
- Claude Agent SDK 面板不注入（範圍外）；舊 BAT → `UNSUPPORTED`；設定變更只影響之後啟動的分頁。
- npm 安裝的 `codex.cmd` shim 在 pwsh 的引號行為未實測（本機為 `codex.exe`）；codex 實際握手需開 session（禁止範圍），只驗到設定解析。
- 建議：CT 的 MCP 用法可依 CLAUDE.md 小節的 tool 表撰寫；`bat_read_output` 建議帶 `maxLines` 與上次 `nextCursor`。

### Commit
`d1b82946` feat(T0584): bat-mcp.mjs stdio MCP shim + attach it to BAT-launched claude / codex tabs（31 檔；`git commit --only`，未含 `src/styles/settings.css`）。未 push。

### 回報時間
2026-10-17T22:50:26+0800

## 塔台結案（2026-10-17T22:54:20+0800）

**DONE**（source / test 層；實機隨下一版）。塔台複驗 @ `46b904f1`（T0582–T0585 皆已落地）：`npx vite build` 0、`npm run typecheck` 0、`npm run typecheck:electron` 0、`npm run verify:helpers` 0、`npm run test:unit` 284 檔 / 4992 passed / 3 skipped。repo 只有主 worktree、無 `ct/*` 分支。

塔台裁決：
- 偏離 1（claude-cli 啟動命令在 renderer 組裝 → 新增 proxied channel `agent:bat-mcp-launch-args`，改 `WorkspaceView.tsx` 等）：**接受**，必要範圍。
- 偏離 2–7（`--mcp-config=` 形式避開 variadic 吞 prompt、額外錯誤碼與 `UNSUPPORTED` 快取、`bat_read_output` 的 content 附輸出、健康檢查改 `add-json` + `mcp list`、CT 面板 raw command 不注入、claude-cli 打字啟動無 e2e）：**接受**。
- 連線策略（共用長連線、閒置 5 s 關、回 pong）：**接受**，理由充分（每權杖 4 連線上限與 helper 共用）。
- 誤觸 codex 啟動一次：隔離 `CODEX_HOME`、無 auth、立即結束，無 token 消耗，記錄不處理。
- 殘留：npm `codex.cmd` 在 pwsh 的引號未實測、codex 實際 MCP 握手未驗 → 列入下一版實機驗收項。
