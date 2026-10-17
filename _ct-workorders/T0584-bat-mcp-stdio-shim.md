---
schema_version: 1
schema_kind: workorder
id: T0584
title: "PLAN-047 M1-2：`bat-mcp.mjs` stdio shim（手寫 dual-era）+ BAT 啟動 claude / codex 時自動掛上 + 打包 / server bundle + 稽核"
type: feature
status: TODO
started_at: ""
updated_at: "2026-10-17T22:23:52+0800"
completed_at: ""
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
