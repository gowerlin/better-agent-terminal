---
schema_version: 1
schema_kind: workorder
id: T0592
title: "D153 A 層：codex CLI × Tower / Worker 整合 e2e（真 codex `app-server` 連真 BAT，不呼叫模型）"
type: test
status: DONE
started_at: "2026-10-18T01:10:02+0800"
updated_at: "2026-10-18T01:40:17+0800"
completed_at: "2026-10-18T01:40:17+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T01:08:55+0800"
target_version: "0.7.0-pre.4（候選）"
depends_on: [T0590, T0591]
related:
  - "D153（codex 整合測試分兩層；B 層寫進更版重點請 codex 使用者協助）、BUG-148 / T0586（codex 對 stdio MCP server 只傳白名單 env；`bat-mcp-codex-env.test.ts` 的 `app-server` 測法）"
  - "T0584（`e2e/t0584-bat-mcp-shim.spec.ts`：隔離實例 + 自訂 CLI 跑 node 腳本、分頁內以分頁 env 執行）、T0582（唯讀 channel 範圍）、T0590（claude `--settings` hooks 注入，不得影響 codex）"
affects_files:
  - "e2e/t0592-codex-tower-worker.spec.ts（新）"
  - "e2e 用的 fixture / node 驅動腳本（新檔，放在 e2e/ 底下既有慣例位置）"
  - "electron/__tests__/**（只在需要補單元 / 整合測試時，新檔優先）"
  - "CLAUDE.md（BAT MCP shim 小節的「已知限制」與「驗證」兩處，不改其他小節）"
  - _ct-workorders/T0592-codex-tower-worker-e2e.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **不得呼叫任何模型、不得連 OpenAI / Anthropic API、不耗 token**。codex 一律用 repo 內嵌的 `node_modules/@openai/codex-win32-x64/.../codex.exe`（找不到時 `describe.skip`，同 `bat-mcp-codex-env.test.ts`），隔離 `CODEX_HOME`（temp，沒有任何登入資料）；只用 `app-server` 的非模型方法（`initialize` / `mcpServerStatus/list` / `thread/start { ephemeral: true }` / `mcpServer/tool/call` 等，T0586 已實測）。若某項驗證只能靠啟動 codex TUI 或開 turn 才做得到，**不做**，寫進回報。"
  - "🔴 **本單只寫測試，不改產品程式碼**。測試發現產品缺陷 → 不修，在回報區寫清楚現象、重現步驟與證據，status 仍可 DONE（測試以 `test.fixme` 或明確的 skip 理由標示該項），塔台另開 BUG。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。e2e 用隔離實例（既有 spec 的慣例），不得動使用者真的 BAT、真的 `~/.codex`。"
---

# T0592 — codex CLI × Tower / Worker 整合 e2e（D153 A 層）

## 背景

既有 codex 相關 e2e 都用 node 腳本模擬 CLI；T0586 雖啟動了真 codex（`app-server`），shim 連的是不存在的 port。BUG-148（設定解析對、實際連不上）因此漏到實機。D153 決定補一層「真 codex + 真 BAT、不呼叫模型」的自動化測試，codex 升版時必跑；之後 M1b-2（codex OSC 9 blocked 偵測）沿用這套架構。

## 測試架構（建議，可依實作調整並在回報說明）

隔離 BAT 實例（`npx vite build` 後啟動，比照 `e2e/t0584-bat-mcp-shim.spec.ts`）。在 BAT 分頁內跑一支 node 驅動腳本（自訂 CLI 或分頁內執行），讓它**繼承分頁真正的 env 與範圍權杖**，再由它 spawn 內嵌 `codex … app-server`，參數取 BAT 為 codex 分頁實際產生的啟動參數（`agent:bat-mcp-launch-args` 對 `codex-cli` 的結果，含 `mcp_servers.bat.*` 與 `env_vars`），以 JSON-RPC 驅動。

## 驗證項目

1. **塔台分頁**：分頁內先 `--set-role tower`，再經 codex `mcpServer/tool/call` 呼叫 `bat_whoami` → `role: "tower"`；`bat_list_terminals` 看得到之後派出的 Worker。
2. **Worker 分頁**：由塔台以 `bat-terminal.mjs` 派出一個 Worker 分頁（`--notify-id` 指向塔台；用 raw command 或自訂 CLI，**不得**真的啟動 codex TUI 跑 `$ct-exec`），Worker 分頁內同樣經 codex 呼叫 `bat_whoami` → `role: "worker"`、`towerTerminalId` = 塔台；`bat_read_output` 讀塔台 → `NOT_OWNER`（`isError: true`）。
3. **派工命令組裝**：`--agent codex`（或 `codex-cli`）派工時，BAT 組出的啟動命令含 `$ct-exec T####`（不是 `/ct-exec`）、Settings / 工作區的 codex 自訂參數、BAT MCP 的 `-c mcp_servers.bat.*`（含 `env_vars`），且**不含** claude 的 `--settings=` / `--mcp-config=`（T0590 不得影響 codex）。以不實際執行 codex TUI 的方式驗證（例：主行程 `[agent-command] resolved` / `[bat-mcp] dispatch agent=codex-cli → injected:` 日誌、或單元層 `createAgentPromptCommandBuilder`），方法由你選並說明。
4. **codex 執行的 shell 指令看得到 BAT env**（重點調查）：CT 的 Codex Worker 用 shell 執行 `bat-notify.mjs`、Codex 塔台用 shell 執行 `bat-terminal.mjs`，都要讀 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_HELPER_DIR`。codex 的 `shell_environment_policy` 預設可能排除名稱含 `KEY` / `SECRET` / `TOKEN` 的變數（請查 codex 官方文件與內嵌版本實際行為）。用 `app-server` 不經模型執行指令的方法（例：`command/exec` 一類的方法，請查內嵌 codex 的 app-server 協定）在 Worker 分頁裡跑 `node bat-notify.mjs --submit …`（或至少印出這些變數是否存在，**不得印出權杖值**），確認：
   - 變數是否到得了 codex 執行的子程序；
   - `bat-notify --submit` 是否送達塔台（塔台分頁收到預填）。
   - 若 app-server 沒有不經模型的執行方法 → 這一項改為文件查證 + 記錄內嵌 codex 版本的預設值，寫進回報，不要開 turn。
5. **T0590 不影響 codex**：codex 分頁的 `bat_get_state` 回 `blockedDetection: "none"`。

## 任務

1. 新增 `e2e/t0592-codex-tower-worker.spec.ts`（與必要的驅動腳本），涵蓋上述 1–5；內嵌 codex 不在時 skip 並註明。
2. 單一 spec 跑兩次都穩定通過（Windows）；記錄耗時。
3. `CLAUDE.md`「BAT MCP shim（PLAN-047 M1 / T0584）」小節：「已知限制」更新 codex 分頁實際連線的驗證狀態，「驗證」加上本 e2e 一行（含「不耗 token」「codex 升版時必跑」）。不改其他小節。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（若有新增單元測試）。
2. `npx playwright test e2e/t0592-codex-tower-worker.spec.ts` 通過（若第 4 項發現產品缺陷，該項以 `test.fixme` 標示並說明，其餘項目通過）。
3. 回報區附：內嵌 codex 版本、每一項的實際結果（JSON 片段，**不含權杖值**）、第 4 項的調查結論（codex 預設 env 政策、BAT env 是否到得了 codex 的 shell 子程序、對 CT Codex Worker / Codex 塔台的影響）、spec 耗時、無法自動驗證而需 B 層（使用者實機）的項目清單（給更版重點「歡迎協助測試」用）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE（驗收 1、2、3 皆通過；第 4 項附帶發現一個產品缺陷，以 `test.fixme` 標示，未修，請塔台另開 BUG）

### 產出摘要

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 PASS（`e2e/`、`electron/__tests__/`、`CLAUDE.md` 皆存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

**Commit**：`cab7c9d1fcde761ed4a586e36174bee50009847c`：`e2e/t0592-codex-tower-worker.spec.ts`（新）、`CLAUDE.md`（BAT MCP shim 小節「已知限制」「驗證」兩處）。未改產品程式碼、未新增單元測試、未 push。`src/styles/settings.css` 的 M 未動。

**內嵌 codex 版本**：`codex-cli 0.160.0`（`node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`）。

**測試架構（與工單建議的差異）**：
- 不用 node 腳本假裝 codex 分頁，而是讓 BAT 真的把 `codex …` 打進分頁：隔離 BAT 的 PATH 前插一個假 `codex.cmd`（形式同 npm 的 codex shim：`"<node>" fake-codex.cjs %*`）。塔台分頁由測試以 codex 分頁的方式輸入 `codex <agent:bat-mcp-launch-args('codex-cli','pwsh',工作區參數)> <工作區參數>`；Worker 分頁由塔台經 `bat-terminal.mjs --agent codex --skill ct-exec --workorder T0592` 派出，命令完全由 BAT 主行程組裝。假 codex 記錄「分頁 shell 解析後的 argv」，再以其中全部 `-c` 啟動**內嵌** `codex app-server`（env = 分頁 env），以 JSON-RPC 驅動：`initialize` / `mcpServerStatus/list` / `thread/start { ephemeral: true }` / `mcpServer/tool/call` / `command/exec`。codex TUI 從未啟動、沒有任何 turn。
- **不連 OpenAI**：探查時發現預設 provider 下 `thread/start` 會預連 `wss://api.openai.com/v1/responses`（無憑證回 401，不耗 token，但仍是一次連線）。spec 對 app-server 另加 `-c model_provider="bat_offline"` + `model_providers.bat_offline={base_url="http://127.0.0.1:9/v1", wire_api="responses"}`，debug log 確認之後沒有任何 OpenAI 連線（只剩 remote control 的「等待 ChatGPT 認證」，未實際連線）；每次 app-server 用空的 temp `CODEX_HOME`；spec 斷言 app-server stderr 不含 `api.openai.com`。
- **安全閥**：本機有已登入的系統 codex（`%APPDATA%\npm\codex.cmd` 等）。spec 在任何派工前先於塔台 pwsh（含使用者 profile）執行 `(Get-Command codex).Source`，必須等於假 shim 才繼續；隔離 BAT 的 `CODEX_HOME` 也指向空 temp 目錄（即使誤啟動真 codex 也沒有憑證）。
- 隔離實例、temp 目錄，未動使用者的 BAT 與 `~/.codex`（只唯讀看過使用者 `settings.json` 的 `shell` 鍵以評估影響：`git-bash`）。

**各項實際結果**（JSON 片段，皆不含權杖值；權杖只回報 `tokenIsCapability`）：

1. 塔台分頁（codex `command/exec` + `mcpServer/tool/call`）
   - `--set-role tower --mode yolo`：exit 0，`✓ Tower role set: e2e-t0592-tower` / `mode: yolo`
   - 派工：exit 0，`✓ Terminal created: 8454dd5f…`、`agent: codex-cli (--agent codex: from --agent)`
   - `bat_whoami` → `{"terminalId":"e2e-t0592-tower","workspaceId":"e2e-t0592-ws","role":"tower","yolo":true,"towerMode":"yolo",…}`
   - `bat_list_terminals` → `[{"id":"e2e-t0592-tower","role":"tower","title":"Terminal · Tower",…},{"id":"8454dd5f…","role":"worker","workorder":"T0592","towerTerminalId":"e2e-t0592-tower","title":"Codex CLI · Worker · T0592","blockedDetection":"none","alive":true}]`
2. Worker 分頁
   - `mcpServerStatus/list` → `bat` server（`serverInfo.version` `0.7.0-pre.3`），六個 tool
   - `bat_whoami` → `{"role":"worker","towerTerminalId":"e2e-t0592-tower","workorder":"T0592","yolo":true,…}`（無 `agent` 欄位：helper 派工不把 agent 寫進 PTY `agentPreset`，T0553 既有設計）
   - `bat_read_output {terminalId: 塔台}` → `{"content":[{"type":"text","text":"NOT_OWNER"}],"structuredContent":{"code":"NOT_OWNER"},"isError":true}`
3. 派工命令組裝（Worker 分頁 pwsh 解析後的 argv，`shell: 'auto'`）：
   `["-c","features.daemon_auto_start=false","-c","mcp_servers.bat.command='node'","-c","mcp_servers.bat.args=['D:\…\scripts\bat-mcp.mjs']","-c","mcp_servers.bat.env_vars=['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_USER_DATA', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_LOG_DIR', 'BAT_RUNTIME', 'APPDATA', 'XDG_CONFIG_HOME']","-c","mcp_servers.bat.tool_timeout_sec=60","--search","-c","model_reasoning_effort=low","$ct-exec T0592"]`
   - `$ct-exec`（非 `/ct-exec`）、工作區 codex 參數（Settings 的 `--t0592-settings-arg` 未出現，T0529 取代規則）、BAT MCP `-c`（含 `env_vars`）、無 `--settings=` / `--mcp-config=`；與塔台（codex 分頁路徑）的 BAT MCP `-c` 完全相同。`features.daemon_auto_start=false` 表示本機 BAT 以系統管理員權限執行（T0377），spec 不依賴它。
   - 主行程日誌：`[agent-command] resolved agent=codex to codex-cli source=explicit … argsSource=workspace`；`[bat-mcp] dispatch agent=codex-cli terminal=<worker> → injected: -c 'mcp_servers.bat.command=''node''' … -c mcp_servers.bat.tool_timeout_sec=60`（無 `hooks=`）。
   - 驗證方式：真派工 + 假 codex 記錄 argv（比單元層 `createAgentPromptCommandBuilder` 多驗了「分頁 shell 實際怎麼解析」，也因此抓到下述缺陷）。
4. codex 執行的 shell 指令看得到 BAT env
   - Worker `command/exec`（預設 sandbox）：`{"has":{"BAT_REMOTE_PORT":true,"BAT_REMOTE_TOKEN":true,"BAT_TERMINAL_ID":true,"BAT_TOWER_TERMINAL_ID":true,"BAT_HELPER_DIR":true,"BAT_WORKSPACE_ID":true,"BAT_SESSION":true,"BAT_USER_DATA":true},"tokenIsCapability":true}`；預設 sandbox 下 TCP 連 `127.0.0.1:<BAT port>` = `connected`（Windows）。塔台同（`BAT_TOWER_TERMINAL_ID` 為 false，正確）。
   - Worker 經 codex `command/exec`（`dangerFullAccess`，對應 yolo 的 bypass）執行 `bat-notify.mjs --source T0592 --target $BAT_TOWER_TERMINAL_ID --submit "T0592 完成"`（`$BAT_*` 由 codex 的子程序自己從 env 展開）：exit 0、無 `Forbidden`；塔台 PTY buffer 出現 `T0592 完成`。塔台的 `--set-role` 與派工同樣經 codex `command/exec` 執行成功。
5. T0590 不影響 codex：Worker 自己的 `bat_get_state` 與塔台查 Worker 皆 `"blockedDetection":"none"`。

**第 4 項調查結論（codex 預設 env 政策）**：
- 內嵌 codex 0.160.0 的 app-server 有不經模型的執行方法：`command/exec`（argv、可指定 `sandboxPolicy`）與 `thread/shellCommand`（字串，經 thread 設定的 shell，unsandboxed）。
- `command/exec` 遵守 `shell_environment_policy`（實測：`-c shell_environment_policy.ignore_default_excludes=false` → `BAT_REMOTE_TOKEN`、`MY_API_KEY`、`MY_SECRET` 消失，`BAT_REMOTE_PORT` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_HELPER_DIR` 保留；`inherit=core` → 全部 `BAT_*` 消失；預設 → 全部保留）。模型的 shell tool 依官方文件也套用同一政策。
- 內嵌 0.160.0 的**預設是不過濾** `KEY` / `SECRET` / `TOKEN`（與官方 config-basic「`ignore_default_excludes` 預設 true」一致；舊文件 / 第三方文章寫預設會過濾，已過時）。
- 對 CT 的影響：預設設定下，Codex Worker 的 `bat-notify` 與 Codex 塔台的 `bat-terminal` 都拿得到 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_HELPER_DIR`。風險：使用者在 `~/.codex/config.toml` 設 `ignore_default_excludes = false`（`BAT_REMOTE_TOKEN` 被濾 → helper 認證失敗）或 `inherit = "core"`（全部 `BAT_*` 被濾 → `NOT_IN_BAT`）。BAT 目前不注入 `shell_environment_policy`；若要防護，可考慮在派工 / 分頁啟動加 `shell_environment_policy` 的覆寫（需塔台決策，注意不可把權杖值放上命令列）。另外，codex 實際的 sandbox / approval 由使用者 codex 參數決定（使用者目前 `codex-cli` 自訂參數為 `--yolo`）。
- 參考：<https://developers.openai.com/pt-BR/docs/config-file/config-basic>、<https://developers.openai.com/codex/local-config>

**🔴 發現的產品缺陷（未修，建議開 BUG）**：
- 現象：`settings.json` 沒有 `shell` 鍵時（全新安裝、從未在 Settings 存過任何設定；renderer `settingsStore.load` 不會把預設 `shell: 'auto'` 寫回檔案），`terminal:create-agent-command` 的 shell family 判成 `posix`（`resolveTerminalShell` → `shellPath` undefined → basename `pty-default` → `detectShellFamily` 預設 posix），但 Windows PTY 實際以 pwsh 啟動。T0584 起 codex 的 BAT MCP 參數是含 `'` 的 TOML literal string，posix 引號（`'\''`）在 pwsh 被拆開。
- 證據（同 spec 不設 `shell` 時的實跑）：Worker argv = `["-c","features.daemon_auto_start=false","-c","mcp_servers.bat.command=","\\node\\'","-c","mcp_servers.bat.args=[","\\D:\\…\\bat-mcp.mjs\\']",…,"$ct-exec T0592"]`；codex：`Error: invalid type: string "[", expected a sequence in mcp_servers.bat.args`，exit 1，即 **Codex Worker 根本起不來**。
- 範圍：只有本機 helper 派工（`--agent codex`）；`shell: 'auto'` 或明確值時正常（`auto` → `pwsh.exe` → pwsh 引號）；claude 派工的參數不含 `'`，posix 引號在 pwsh 也能用，不受影響；codex 分頁（renderer 路徑）用 renderer 的 shell family，未見問題；使用者本機 `shell: git-bash`（PTY 與引號都是 posix），不受影響。
- 重現：`e2e/t0592-codex-tower-worker.spec.ts` 的 `test.fixme('codex Worker dispatch with settings.json lacking "shell" …')` 改為 `test` 即重現。
- 修正方向（供 BUG 參考）：`resolveTerminalShell` 在無持久化 shell 時應以 PtyManager 的實際預設 shell（`getDefaultShell`）判斷 family，或 `resolvePersistedShellPathWithDiagnostics` 把缺鍵視為 `auto`。

**驗收**：
- `npx vite build`：PASS
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0；spec 檔另以 `tsc --noEmit --strict` 檢查 = 0
- `npm run test:unit`：未新增單元測試，未跑（工單條件「若有新增」）
- `npx playwright test e2e/t0592-codex-tower-worker.spec.ts`：連跑三次皆 `1 passed, 1 skipped`（skipped = 上述 fixme），每次約 9.2 s（spec 本體 8 s，指令總計 10 s）
- spec 日誌已將 `batcap.*` 遮罩；run log 中 `batcap.<值>` 出現 0 次

**需 B 層（使用者實機）協助的項目**（給更版重點「歡迎協助測試」）：
1. 真 codex TUI 內，模型實際呼叫 `mcp__bat__*` tool（A 層用 `mcpServer/tool/call` 直接呼叫，未經模型決策 / 核可流程）。
2. 真 Codex Worker 跑完 `$ct-exec` 後，以模型的 shell tool 執行 `bat-notify --submit` 送達塔台（含使用者實際的 sandbox / approval 參數，例如 `--yolo` 以外的設定）。
3. Codex 塔台以模型的 shell tool 執行 `bat-terminal.mjs` 派工。
4. 使用者自訂 `shell_environment_policy` 時的行為；npm `codex.cmd` 以外的安裝方式（官方 installer 的 `codex.exe`、WSL / macOS / Linux）。
5. 遠端 headless（WSL / SSH）的 codex 分頁（server bundle 不含 codex，需遠端自行安裝）。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- 預設 provider 下 `thread/start` 會預連 api.openai.com（401、無 token 消耗）→ 以指向 `127.0.0.1:9` 的自訂 model provider 消除，見上。
- spec 初版 Worker 卡住：根因即上述 shell 引號缺陷（隔離實例初始 `settings.json` 沒有 `shell`）。主測試改為設定 `shell: 'auto'`（使用者存過任何設定後的狀態），缺鍵情境以 `test.fixme` 保留。
- Write / Edit 工具會把 `\uFEFF` 轉成實際字元，改用 `String.trim()`（會去掉 BOM）避開。

### 回報時間

2026-10-18T01:38:31+0800
