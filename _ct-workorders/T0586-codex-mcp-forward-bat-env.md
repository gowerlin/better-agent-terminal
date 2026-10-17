---
schema_version: 1
schema_kind: workorder
id: T0586
title: "BUG-148：codex 分頁的 BAT MCP 讀不到分頁 env（CONNECT_FAILED）— 讓 codex 把 shim 需要的 `BAT_*` 傳給 stdio MCP server"
type: bugfix
status: DONE
started_at: "2026-10-17T23:51:38+0800"
updated_at: "2026-10-18T00:00:58+0800"
completed_at: "2026-10-18T00:00:58+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: S
created_at: "2026-10-17T23:50:21+0800"
target_version: "0.7.0-pre.3（候選）"
depends_on: [T0584]
related:
  - "BUG-148（現象、實機錯誤原文、注入日誌）"
  - "T0584 回報區與 CLAUDE.md「BAT MCP shim（PLAN-047 M1 / T0584）」：codex 注入參數、TOML 引號規則、三種 shell 的 quoting、`codex mcp get bat --json` 驗證方式"
  - "CLAUDE.md「Logging」的 helper userData 解析（T0481：`BAT_USER_DATA` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` / `BAT_RUNTIME`）"
affects_files:
  - electron/bat-mcp-launch.ts
  - "scripts/bat-mcp.mjs（只在需要改錯誤訊息 / 診斷時）"
  - "electron/__tests__/bat-mcp-launch.test.ts、scripts/__tests__/bat-mcp.test.mjs、e2e/t0584-bat-mcp-shim.spec.ts（必要時）"
  - "CLAUDE.md（只改「BAT MCP shim」小節的 codex 注入說明與已知限制）"
  - _ct-workorders/T0586-codex-mcp-forward-bat-env.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 權杖**值**絕不寫進任何設定檔、命令列、日誌。只允許以**變數名稱**轉送（例：codex 的 env 名稱白名單）；`mcp_servers.bat.env = { BAT_REMOTE_TOKEN = \"<值>\" }` 這類帶值寫法一律禁止。"
  - "🔴 不執行任何會送 prompt / 耗 token 的 claude / codex 指令（`codex exec`、互動式 codex 送訊息都不行）。可用 `codex mcp get` / `codex mcp list` 等不連模型的指令；需要隔離時用暫存 `CODEX_HOME`，不碰使用者的 `~/.codex`。e2e 用隔離實例（需先 `npx vite build`），不碰使用者的 BAT（9876）。"
---

# T0586 — codex 分頁的 BAT MCP 讀不到分頁 env（BUG-148）

## 背景

`v0.7.0-pre.2` 實機驗收：Claude CLI 分頁的 `mcp__bat__*` 正常；**Codex CLI 分頁（OpenAI Codex `v0.163.0`，Windows）兩個 tool 都回 `CONNECT_FAILED: not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)`**。BAT 日誌顯示注入成功，codex 也啟動了 `bat-mcp.mjs`，只是 shim 的 process env 沒有分頁的 `BAT_*`。詳見 BUG-148。

塔台推測：codex 啟動 stdio MCP server 時只傳預設白名單的 env（claude 則傳完整 env）。T0584 對 codex 只驗了 `codex mcp get bat --json` 的解析。

## 任務

1. **確認原因**：查 codex（以本機實際安裝版 `v0.163.0` 為準，也看 T0584 用的 0.162.1 是否相同）對 stdio MCP server 的 env 規則：預設會傳哪些變數、有沒有「只列名稱」的轉送設定（例如 `mcp_servers.<name>.env_vars`，以 codex 實際支援的 key 為準）。用不耗 token 的方式佐證（`codex mcp get bat --json` 看解析結果、codex 原始碼或官方文件），在回報區寫明依據。
2. **修正注入**（`electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs` 的 codex 分支，本機與 headless 共用）：讓 codex 把 shim 需要的變數**以名稱**傳給 MCP server。變數清單從 `scripts/bat-mcp.mjs` 與它 import 的 `_bat-*.mjs` 實際讀取的 env 推得（至少 `BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`；憑證路徑與日誌目錄相關的 `BAT_USER_DATA` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` / `BAT_RUNTIME`；以及 Windows 上 shim 解析 userData fallback 所需、但 codex 預設白名單沒有的系統變數，例如 `APPDATA`，以實測為準）。沿用 T0584 的 TOML 與 shell quoting 規則，pwsh / bash / cmd 三種 shell 都要正確。
3. **若 codex 沒有任何「只列名稱」的轉送方式**：不要改成帶值寫法；停下來回報 BLOCKED，列出可行選項與取捨（例：shim 以其他方式取得權杖的設計），由塔台決定。
4. **測試**：單元測試涵蓋新參數（三種 shell 的字串、不含任何權杖值）、關閉 / 自訂參數已含 `mcp_servers.bat` 時不注入的既有行為不變。盡量加一個不耗 token 的整合驗證，證明 codex 實際啟動 shim 時 env 有傳到（例：以隔離 `CODEX_HOME` + 能讓 codex 只啟動 MCP server 而不呼叫模型的方式；若 codex 沒有這種模式，寫明並以 `codex mcp get bat --json` 的解析結果 + 單元測試涵蓋，實機留給塔台隨下一版驗收）。
5. **CLAUDE.md**：更新「BAT MCP shim」小節的 codex 注入說明（新增的參數、原因），並把「codex 實際連線未驗」相關描述改成本單實測結果。

## 驗收

- `npm run test:unit` 全綠（基線 4992 passed / 284 files / 3 skipped，加上本單新增）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- 回報區寫明：原因的依據、轉送的變數清單與理由、三種 shell 的實際注入字串（不含權杖值）、整合驗證做了什麼 / 沒做什麼
- 實機（塔台隨下一版做）：新開 Codex CLI 分頁 → `bat_whoami` 回 `role: shell`、`agent: codex-cli`

## 不在範圍

- claude 分頁的注入（正常，不動）
- M1b / M2 / M3、新的 tool
- Claude Agent SDK 面板

## 回報區

### 結果：✅ FIXED（等塔台隨下一版實機驗收）

### Landing check：PASS

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`electron/bat-mcp-launch.ts` 等皆存在 → PASS（informational）
- C-2：無 `branch` 欄位；目前 `main`
- 無 `CT_HOME`（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）

### 1. 原因（已確認）與依據

codex 啟動 stdio MCP server 時**只傳預設白名單的 env**，分頁的 `BAT_*` 不在白名單內；claude 則把完整 env 交給 MCP server。

依據（全部不耗 token，隔離 `CODEX_HOME`，未碰 `~/.codex`）：

1. **codex 二進位**（`C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`，`codex-cli 0.163.0`）內的 Windows 預設清單字串：`PATH PATHEXT SHELL COMSPEC SYSTEMROOT WINDIR SYSTEMDRIVE USERNAME USERDOMAIN USERPROFILE HOMEDRIVE HOMEPATH PROGRAMFILES PROGRAMFILES(X86) PROGRAMW6432 PROGRAMDATA LOCALAPPDATA APPDATA TEMP TMP TMPDIR POWERSHELL PWSH`；stdio transport 的設定鍵有 `command / args / env / env_vars / cwd`，錯誤字串 `unsupported env_vars source \`…\`; expected \`local\` or \`remote\``。
2. **實測（codex app-server + 假 stdio MCP server 記錄自己收到的 env）**：`codex -c mcp_servers.bat.command=… -c mcp_servers.bat.args=[…] app-server` → `initialize` → `mcpServerStatus/list`（會啟動 MCP server 並取 tools/list，不呼叫模型）。父行程 env 有 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `XDG_CONFIG_HOME`，假 server 收到的只有 21 個鍵：`APPDATA COMSPEC HOMEDRIVE HOMEPATH LOCALAPPDATA PATH PATHEXT PROGRAMDATA PROGRAMFILES PROGRAMFILES(X86) PROGRAMW6432 SHELL SYSTEMDRIVE SYSTEMROOT TEMP TMP TMPDIR USERDOMAIN USERNAME USERPROFILE WINDIR`，**沒有任何 `BAT_*`**。
3. **用真 shim 重現 BUG-148 原文**：同樣方式（`thread/start { ephemeral: true }`，不開 turn → `mcpServer/tool/call bat_whoami`）跑 `scripts/bat-mcp.mjs`：不帶 `env_vars` → `CONNECT_FAILED: not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)`，與實機錯誤逐字相同。
4. **「只列名稱」的轉送方式存在**：`mcp_servers.<name>.env_vars = ["NAME", …]`（也接受 `{ name, source = "local" | "remote" }`）。`codex mcp get bat --json` 解析為 `"env": null, "env_vars": [...]`；codex 0.160.0（repo 內嵌，`node_modules/@openai/codex-win32-x64`）與 0.163.0（使用者安裝版）實測行為相同：列出且有設的名稱轉送、沒設的名稱直接略過（不報錯）。T0584 用的 0.162.1 本機已無此版本，未實測（介於兩者之間，推定相同）。
5. Unix 的預設清單在 Windows 二進位內看不到（`cfg(windows)` 編譯），未實測；依上游原始碼印象為 `HOME / LOGNAME / PATH / SHELL / USER / LANG / LC_ALL / TERM / TMPDIR / TZ` 等，不含 `XDG_CONFIG_HOME` — 此點為**推論**，故清單仍列 `XDG_CONFIG_HOME`（沒設則略過，無副作用）。

### 2. 修正

`electron/bat-mcp-launch.ts`（本機與 headless 共用的 `buildBatMcpLaunchArgs` codex 分支）：

- 抽出 `codexMcpOverrides(server)`，在 `args` 之後、`tool_timeout_sec` 之前加 `mcp_servers.bat.env_vars=[…]`（TOML literal string 名稱）。
- 新常數 `BAT_MCP_CODEX_ENV_VARS`（只有名稱，值由 codex 從分頁 env 取）：

| 名稱 | 理由 |
|---|---|
| `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` | shim 連線端點與範圍權杖（`bat-mcp.mjs`） |
| `BAT_TERMINAL_ID` | shim 的 `bat-scripts.log` `start` 事件 |
| `BAT_USER_DATA` | `_bat-cert.mjs` / `_bat-logger.mjs` 的 userData（T0481，本機 PTY 注入） |
| `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` | headless PTY 的憑證路徑 / 日誌目錄 override |
| `BAT_RUNTIME` | 舊推測路徑的 runtime 後綴 |
| `APPDATA` | Windows userData fallback（已在 codex Windows 預設內，列出無害） |
| `XDG_CONFIG_HOME` | Linux userData fallback（codex Unix 預設推定不含） |

  = `scripts/bat-mcp.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs` 讀取的全部 `process.env.*`（新測試以 source scan 守住）。`HOME`（`os.homedir()`）在 codex 預設內，不需列。`_bat-logger.mjs` 的 `ENV_WHITELIST`（`BAT_SESSION` 等）只供 `snapshotBatEnv()`，shim 未呼叫，不列。
- 🔴 未使用帶值寫法（`mcp_servers.bat.env = { … }`）；權杖值不出現在命令列、設定、日誌。
- 既有行為不變：Settings 關閉 / 自訂參數已含 `mcp_servers.bat` / RemoteServer 未監聽 / 無 shim / 其他 agent → 不注入（既有測試照過）；claude 分支未動。

### 3. 三種 shell 的實際注入字串（shim 路徑以 repo `scripts/` 為例；不含權杖值）

- pwsh：`-c 'mcp_servers.bat.command=''node''' -c 'mcp_servers.bat.args=[''D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal\scripts\bat-mcp.mjs'']' -c 'mcp_servers.bat.env_vars=[''BAT_REMOTE_PORT'', ''BAT_REMOTE_TOKEN'', ''BAT_TERMINAL_ID'', ''BAT_USER_DATA'', ''BAT_SERVER_CERT_PATH'', ''BAT_HELPER_LOG_DIR'', ''BAT_RUNTIME'', ''APPDATA'', ''XDG_CONFIG_HOME'']' -c mcp_servers.bat.tool_timeout_sec=60`
- posix：`-c 'mcp_servers.bat.command='\''node'\''' -c 'mcp_servers.bat.args=['\''D:\…\scripts\bat-mcp.mjs'\'']' -c 'mcp_servers.bat.env_vars=['\''BAT_REMOTE_PORT'\'', '\''BAT_REMOTE_TOKEN'\'', '\''BAT_TERMINAL_ID'\'', '\''BAT_USER_DATA'\'', '\''BAT_SERVER_CERT_PATH'\'', '\''BAT_HELPER_LOG_DIR'\'', '\''BAT_RUNTIME'\'', '\''APPDATA'\'', '\''XDG_CONFIG_HOME'\'']' -c mcp_servers.bat.tool_timeout_sec=60`
- cmd：`-c "mcp_servers.bat.command='node'" -c "mcp_servers.bat.args=['D:\…\scripts\bat-mcp.mjs']" -c "mcp_servers.bat.env_vars=['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_USER_DATA', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_LOG_DIR', 'BAT_RUNTIME', 'APPDATA', 'XDG_CONFIG_HOME']" -c mcp_servers.bat.tool_timeout_sec=60`

三種字串各自寫成 `.ps1`（`pwsh -NoProfile -File`）/ `.sh`（Git Bash）/ `.cmd`（`cmd /d /c`）執行 `codex <字串> mcp get bat --json`（PATH 上的 codex 0.163.0、隔離 `CODEX_HOME`）：三者解析結果完全相同 — `command: "node"`、`args: [<shim 路徑>]`、`env: null`、`env_vars: [9 個名稱]`、`tool_timeout_sec: 60`。

### 4. 整合驗證：做了什麼 / 沒做什麼

做了（皆不耗 token、不連使用者 BAT 9876）：

- **新單元整合測試** `electron/__tests__/bat-mcp-codex-env.test.ts`：內嵌 codex（0.160.0）`app-server` + 隔離 `CODEX_HOME` + 假 stdio MCP server（以 `codexMcpOverrides` 的實際值）：不帶 `env_vars` → 0 個 `BAT_*`（BUG-148 機制）；帶了 → `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（只記長度）/ `BAT_TERMINAL_ID` / `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 到達、沒設的 `BAT_SERVER_CERT_PATH` / `BAT_RUNTIME` 略過、未列的 `BAT_WORKSPACE_ID` 不到；Windows 另驗 `APPDATA`。內嵌 codex 不在時 skip。另有 source scan（清單涵蓋 shim 讀的全部 env）與三種 shell 不含權杖值 / 不含 `env` 表的測試。
- **真 shim 手動實測**（scratchpad 腳本，codex 0.163.0）：`thread/start { ephemeral: true }` → `mcpServer/tool/call bat_whoami`，`BAT_REMOTE_PORT=1`、假權杖：不帶 `env_vars` → `CONNECT_FAILED: not running inside a BAT terminal …`（重現）；帶了 → `CONNECT_FAILED: connect ECONNREFUSED 127.0.0.1:1`（shim 已讀到 port / token），`bat-scripts.log` 寫進轉送的 `BAT_HELPER_LOG_DIR`（`hasEndpoint: true`）。
- e2e `e2e/t0584-bat-mcp-shim.spec.ts` 斷言改為含 `env_vars`、不含 `batcap.`；隔離實例跑過 1 passed。

沒做：

- codex 分頁內**實際連上 BAT** 回 whoami（需要真 BAT + 真 codex 分頁）→ 留給塔台隨下一版實機驗收（`bat_whoami` 應回 `role: shell`、`agent: codex-cli`）。
- npm 的 `codex.cmd` shim、Linux / macOS 的 codex、headless 遠端 codex 分頁未實測（注入字串同一份實作）。
- 附帶影響說明：手動重現「不帶 `env_vars`」那一次，shim 沒拿到 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`，依 `APPDATA` fallback 在使用者真實的 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log` 追加了 2 筆 `bat-mcp` 事件（`start` / `tool-call CONNECT_FAILED`，無權杖）。

### 5. 驗收閘門

| 閘門 | 結果 |
|---|---|
| `npm run test:unit` | ✅ PASS — 285 files、4997 passed / 3 skipped（基線 284 / 4992；+1 檔 +5 測試） |
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npx vite build` | ✅ 成功 |
| e2e `t0584-bat-mcp-shim.spec.ts` | ✅ 1 passed（隔離實例） |
| 實機（Codex CLI 分頁 `bat_whoami`） | ⏳ 塔台隨下一版 |

### 變更檔案

- `electron/bat-mcp-launch.ts`：`BAT_MCP_CODEX_ENV_VARS`、`codexMcpOverrides`、codex 分支加 `env_vars`
- `electron/__tests__/bat-mcp-codex-env.test.ts`（新）
- `electron/__tests__/bat-mcp-launch.test.ts`：codex 三種 shell 期望字串、派工組裝 regex
- `e2e/t0584-bat-mcp-shim.spec.ts`：codex pwsh 期望字串 + 不含 `batcap.`
- `CLAUDE.md`：「BAT MCP shim」小節 codex 注入說明、`env_vars` 原因與清單、app-server 驗證方式、已知限制、驗證清單
- `scripts/bat-mcp.mjs`：未改

### Commit

- `8c7bd4c4` fix: forward the shim's env to codex stdio MCP server (T0586, BUG-148)（產品 + 測試 + CLAUDE.md，`git commit --only`）
- 工單本身另一個 commit；未 push。`src/styles/settings.css` 的 M 不是本單變更，未動。

### 偏離 / 後續

- 無範圍偏離。BUG-148 狀態留給塔台更新（本單 affects_files 不含 BUG 單）。
- 建議：塔台實機驗收時，若遠端 headless 也有 codex 分頁，順便驗一次（`BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` 路徑）。
