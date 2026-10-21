---
schema_version: 1
schema_kind: workorder
id: T0648
title: "探針：codex 共用 app-server daemon 下，BAT 分頁的 `BAT_TERMINAL_ID` / 權杖 / BAT MCP 會不會取到別的分頁的值（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-051
priority: P2
sizing: S
created_at: "2026-10-18T18:23:28+0800"
started_at: "2026-10-18T18:25:02+0800"
updated_at: "2026-10-18T18:36:14+0800"
completed_at: "2026-10-18T18:36:14+0800"
depends_on: [T0647]
related:
  - "D169（使用者決定開本探針）；T0647 回報區「遭遇問題」第三點（第三方 issue https://github.com/cosscom/shipyard/issues/8：codex 0.160.1 / 0.163.0 Linux 上，共用 daemon 由第一個 session 啟動，之後各 session 的 hook 繼承第一個 session 的環境變數）"
  - "BAT 現況：`electron/agent-runtime/agent-registry.ts` `CODEX_DISABLE_DAEMON_ARGS`（只在 `this.elevated` 時注入 `-c features.daemon_auto_start=false`，T0377 / BUG-085）；BAT MCP 對 codex 用 `-c mcp_servers.bat.*` + `env_vars` 白名單（`electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs`，CLAUDE.md「BAT MCP shim」節）；範圍權杖 `electron/remote/helper-capability.ts`（CLAUDE.md「遠端 Tower 通知」節）"
affects_files:
  - _ct-workorders/T0648-probe-codex-daemon-env-inheritance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 探針單、**唯讀**：不改任何產品檔、不改其他工單 / PLAN / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。實驗腳本與擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 **不得停止、重啟或改設定別人正在用的 codex daemon**：開工先記錄目前是否已有 codex app-server daemon 在跑（程序清單 / `codex app-server daemon version` 之類不改狀態的方式）。已有 daemon → 不得 stop / restart，只能在自己另開、隔離的 `CODEX_HOME`（temp 目錄）下實驗；確認不到隔離方式就只做原始碼分析，不做實機。自己啟動的 daemon / session 用完要結束，回報寫明已無殘留程序。"
  - "🔴 不得修改 `~/.codex/`、`~/.claude/`、`%APPDATA%\\BetterAgentTerminal\\settings.json`；可以讀。實驗用的 codex 設定一律放 temp `CODEX_HOME`。若隔離 `CODEX_HOME` 需要登入憑證才能啟動 session，不得複製使用者的 auth 檔；改用不呼叫模型的路徑（例如 shell 工具前的階段、`codex exec` 的 sandbox 測試指令、或原始碼分析），並在回報說明限制。"
  - "🔴 實驗用的環境變數一律是**假值**（例如 `PROBE_TAB=A` / `PROBE_TAB=B`、假的 `BAT_TERMINAL_ID=probe-a`）；不得讀出、印出或寫入任何真實 `BAT_REMOTE_TOKEN`（回報只寫「已設定」）、API key、帳號。不得用真實權杖呼叫 helper 對其他分頁寫入。"
  - "🔴 呼叫模型時用最便宜的模型、最短的 prompt，回報記次數（目標 ≤ 6 次）；能用原始碼或不呼叫模型的方式回答就不要呼叫。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；範圍內猜錯會返工的實驗設計問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
  - "🔴 非隔離工單。另一張工單 T0646（網站 `/remote/`）同時進行，只改 `site/**`，不碰。"
---

# T0648 — 探針：codex 共用 daemon 的環境變數繼承

## 背景

T0647 發現第三方回報：codex 的共用 app-server daemon 由第一個 session 啟動，之後各 session 的 **hook** 都繼承第一個 session 的環境變數。BAT 靠每個分頁 PTY 的環境變數區分分頁（`BAT_TERMINAL_ID`、範圍權杖 `BAT_REMOTE_TOKEN`、Worker 的 `BAT_TOWER_TERMINAL_ID`），codex 分頁裡由 codex 執行的 shell 命令（例如 Worker 呼叫 `bat-notify.mjs` / `bat-terminal.mjs`）與 BAT MCP shim（codex 以 `env_vars` 白名單轉送）都讀這些值。如果 shell 命令或 MCP server 是由 daemon 而不是由分頁的 codex 程序啟動，而 daemon 的環境來自別的分頁，就可能出現：Worker 通知送到別的塔台、權杖被拒（`Forbidden`）、`bat_whoami` 回報別的分頁。

BAT 只在自己以系統管理員權限執行時才注入 `-c features.daemon_auto_start=false`（`agent-registry.ts`），所以非系統管理員的 BAT 使用者，codex 分頁預設跑在共用 daemon 上。

## 要回答的問題

1. **codex 的機制**（以 openai/codex 原始碼為主，標 commit / tag 與查證日期；codex `0.163.0` 為準）：共用 daemon 模式下，下列各由哪個程序 spawn、環境變數從哪來：(a) shell 工具執行的命令、(b) MCP server（含 `env_vars` 白名單轉送的值取自哪個程序的環境）、(c) hook。前端 TUI 有沒有把自己的環境傳給 daemon（例如 thread 啟動參數帶 env）。
2. **實機確認**（在隔離 `CODEX_HOME` 下，可行才做）：兩個 session 依序以不同的假環境變數啟動，第二個 session 執行 shell 命令 / MCP server 時讀到的是自己的值還是第一個的。做不到就寫明原因，只以原始碼回答。
3. **對 BAT 的影響**：依 1、2 判斷 BAT 的 codex 塔台 / Worker 在非系統管理員情境下哪些路徑會讀錯（helper 呼叫、BAT MCP、BAT 注入的其他 env 例如 `BAT_HELPER_DIR`、`CT_MODE`、`BAT_TOWER_TERMINAL_ID`）、後果（通知錯投、`Forbidden`、`whoami` 錯誤）與範圍權杖能否擋住錯投（權杖綁定分頁，但用的是別的分頁的權杖時會怎樣）。標明實測 / 原始碼 / 推論。
4. **建議**：不需處理 / 文件註明 / BAT 端修正（例如一律注入 `features.daemon_auto_start=false` 或 `--no-daemon`，及其對 codex 舊版、`codex queue`、使用者自訂參數的影響）；若推薦修正，給 BUG 單草稿（標題、嚴重度、現象、重現步驟）與實作切分（S / M）。

## 交付

回報區依 1–4 作答，每個結論附證據（原始碼連結 + 行號、指令輸出、實驗步驟與結果）。

---

## 回報區

### 結論摘要

- **codex 機制（原始碼，`rust-v0.163.0` = commit `83086188ae0614bd882818ff1aa23f3194962012`，查證 2026-10-18）**：共用 daemon 模式下，shell 工具的命令、MCP server、hook 都由 **daemon 程序**啟動，環境取自 daemon 自己的 `std::env`；daemon 由**第一個**自動啟動它的 codex 程序 spawn，完整繼承那個程序的環境（只改 `CODEX_HOME` / CA 路徑等少數鍵）。TUI 不把自己的環境傳給 daemon（`initialize` / `thread/start` 都沒有 env 欄位）。第三方 issue 說的現象在原始碼上成立，而且 shell 命令與 MCP server 也一樣，不只 hook。
- **但 BAT 目前幾乎不會走到 daemon**：codex 0.163.0 只要命令列帶了 `features.*` 以外的 `-c` 覆寫，就**自己排除 daemon、改用 embedded**（不連既有 daemon，也不自動啟動）。BAT MCP 對 codex 注入 `-c mcp_servers.bat.*`（Settings 預設開），helper 派工的 codex Worker 一律多帶 `-c check_for_update_on_startup=false`，所以這兩類分頁都是 embedded，shell 命令與 BAT MCP shim 讀到的是**自己分頁**的 env。Codex SDK 面板用的 `codex exec` 完全沒有 daemon 路徑。
- **剩下的風險面（推論，未實測）**：非系統管理員 + **手動開**的 codex 分頁（含 codex 塔台）+ BAT MCP **沒注入**（Settings 關閉、RemoteServer 沒在 listen、找不到 `bat-mcp.mjs`）+ 自訂參數沒有非 features 的 `-c`。這時 codex 會接上共用 daemon，分頁內 codex 執行的 `bat-notify.mjs` / `bat-terminal.mjs` 讀到的是 daemon 的 env（啟動 daemon 的那個分頁，或 BAT 以外的終端）。
- **範圍權杖擋不住錯投**：daemon env 裡的 `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` 是同一個分頁 X 的一整組，彼此一致，helper 就以 X 的身分通過授權，Worker 通知會**成功送到 X 的塔台**。只有角色不符（例如 X 是 Worker、當前分頁要派工）或 X 已關閉（權杖已撤銷）時才會看到 `Forbidden` / `Capability revoked`。
- **BAT 現有的 `features.daemon_auto_start=false` 不夠**：它只關掉「自動啟動」，daemon 已經在跑時照樣會連上去（這個 feature 在 codex 允許清單內，不觸發排除）。只有 `--no-daemon` 或非 features 的 `-c` 會讓 codex 完全不用 daemon。BAT 以系統管理員執行時不受影響：codex 0.163.0 偵測到提升權限的 token 會自己設 `no_daemon`。
- **建議**：不需要緊急修正。現在先在文件寫明這條不變式（BAT 的 codex 分頁靠非 features 的 `-c` 維持 embedded）並加 source guard。之後可選做一張 S–M 的 BAT 修正，把剩下的「BAT MCP 沒注入」情境補上 `--no-daemon`（要先確認 codex 版本支援）。BUG 草稿在 § 4。要不要修由使用者決定。
- 模型呼叫：**0 次**（全部以原始碼和不呼叫模型的指令回答）。

### 1. codex 的機制（原始碼）

連結前綴 `https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/`（下稱 `@`）。本機 `codex --version` = `codex-cli 0.163.0`。

**TUI 何時用 daemon**

| 項目 | 證據 |
|---|---|
| Windows 提升權限 → codex 自己設 `cli.no_daemon = true` | `@tui/src/startup_orchestration.rs#L26-L37` |
| 排除條件 `exclusion()`：`--no-daemon`、`--oss`、workload identity、`CODEX_EXEC_SERVER_URL`、`--profile`，或 `config_exclusion()` | `@tui/src/daemon_startup.rs#L65-L92` |
| `config_exclusion()`：`-c` 覆寫只要有一個不是 `features.<允許清單>`（布林）/ `suppress_unstable_features_warning` / `tui.fullscreen_transcript` → 排除，原因字串 `command-line configuration overrides (-c, --enable, --disable, or --search)`；另有自訂 loader、`--strict-config`、`--dangerously-bypass-hook-trust` | `@tui/src/daemon_startup.rs#L94-L129` |
| 允許清單含 `daemon_auto_start` | `@tui/src/daemon_startup.rs#L131-L140` |
| 沒被排除才 probe 預設 socket（`<CODEX_HOME>/app-server-control/app-server-control.sock`），**不看** `daemon_auto_start`；有 daemon 就成為 `LocalDaemon` | `@tui/src/startup_orchestration.rs#L189-L196`、`#L311-L323`；`@tui/src/lib.rs#L523-L543`、`#L1028-L1057` |
| 自動啟動條件 `DaemonAutoStart && !agents_overview && !no_daemon && !remote` 且未排除 | `@tui/src/startup_orchestration.rs#L508-L511`、`#L546-L577` |
| 被排除時 TUI 顯示啟動警告 `Running without the shared background server: … requires embedded mode.` | `@tui/src/startup_orchestration.rs#L599-L610`；`@tui/src/app/startup.rs#L867-L870` |
| `codex exec` 沒有任何 daemon 路徑（`exec/src` grep `daemon` 0 筆） | grep 結果 |

**daemon 程序的環境**

- `Command::new(&codex_bin)` 只 `env_remove(HANDOFF_ENV)`，沒有 `env_clear` → 完整繼承啟動者（第一個自動啟動的 codex 程序，或手動 `codex app-server daemon start`）的環境：`@app-server-daemon/src/backend/pid_start.rs#L98-L114`、`#L149-L151`。
- `set_working_directory` 只補寫 `CODEX_HOME`、CA / AWS 路徑類鍵，並把 cwd 改成 state 目錄：`@app-server-daemon/src/background_command.rs#L9-L90`。
- daemon 是 detached 的，啟動它的分頁關閉後仍在跑，環境不會更新。

**TUI 有沒有把自己的 env 傳給 daemon**：沒有。

- `InitializeParams` 只有 `client_info` / `capabilities`：`@app-server-protocol/src/protocol/v1.rs#L29-L70`。
- `ThreadStartParams` 有 `cwd`、`config`、`environments`（`TurnEnvironmentParams` = `environment_id` + `cwd` + roots，是執行環境的 id，不是 env 變數）等，沒有 env 變數表：`@app-server-protocol/src/protocol/v2/thread.rs#L62-L166`、`@app-server-protocol/src/protocol/v2/turn.rs#L96-L102`。
- 只有 `command/exec`（一次性命令）有 `env` 覆寫欄位，TUI 只在自己的 workspace command 用它，模型的 shell 工具不經這裡：`@app-server-protocol/src/protocol/v2/command_exec.rs#L84-L90`、`@tui/src/workspace_command.rs#L176-L196`。

**(a) shell 工具執行的命令**：由執行 core 的程序（daemon 模式 = daemon）spawn，env = `create_env(policy)` = `std::env::vars()` 再套 `shell_environment_policy`：`@protocol/src/shell_environment.rs#L69-L74`；unified exec `@core/src/unified_exec/process_manager.rs#L1469-L1471`；使用者 `!` 命令 `@core/src/tasks/user_shell.rs#L170`。

**(b) MCP server（含 `env_vars`）**：由 daemon spawn。預設白名單 + `env_vars` 的值都用 `env::var_os(...)` 取自 **daemon 程序**：`@rmcp-client/src/utils.rs#L16-L26`、`@rmcp-client/src/stdio_server_launcher.rs#L276`。`env_vars` 轉送的是 daemon 的值，不是分頁的值。

**(c) hook**：`Hooks::new` 建立時取 `std::env::vars_os()`（daemon 的環境）給所有 command hook：`@hooks/src/registry.rs#L79-L82`。第三方 issue（cosscom/shipyard#8）描述的就是這個。

### 2. 實機確認：沒做成（原因與步驟）

- 開工前狀態（唯讀）：`codex app-server daemon version` → `failed to connect to <使用者資料夾>\.codex\app-server-control\app-server-control.sock … (os error 10050)`，也就是**使用者的 CLI 共用 daemon 沒在跑**。程序清單只有 Codex 桌面版（PID 30640，`app-server` stdio）、VS Code 擴充（PID 36424，`app-server` stdio）、`codex-windows-sandbox-service.exe`（14320）、`codex-computer-use-swift.exe`（30972）。全程沒碰它們。
- 設計：隔離 `CODEX_HOME`（temp），config 裡放一個假 MCP server（node 腳本只把 `PROBE_TAB` / `BAT_TERMINAL_ID` 寫進檔案），`env_vars = ["PROBE_TAB","BAT_TERMINAL_ID"]`。session A（`PROBE_TAB=A`、`BAT_TERMINAL_ID=probe-a`，真實 `BAT_*` / `CT_*` 全部移除）`codex app-server daemon start`；session B（`PROBE_TAB=B`）以 `codex app-server proxy` 送 `initialize` → `command/exec`（`cmd /c set PROBE_TAB`）→ `thread/start`（會觸發 MCP 啟動），完全不呼叫模型。
- 結果：三次都在 daemon 啟動前被 codex 擋下：
  1. BAT 程序內直接執行：`Error: start the Windows daemon from a non-elevated terminal; shared clients must not inherit administrator privileges`。
  2. `runas /trustlevel:0x20000`：`IsInRole(Administrator)` = False，但 codex 看的 `TokenIsElevated` 仍為真，同一錯誤；另外 scratchpad 路徑太長，socket 報 `path must be shorter than SUN_LEN`（改用短路徑 `%TEMP%\cxp\h`）。
  3. 經 `explorer.exe` 啟動：仍是 elevated（`IsInRole` = True），同一錯誤。
- 根因：本機 `HKLM\…\Policies\System` `EnableLUA = 0`（UAC 關閉，唯讀查詢），所有程序都是提升權限，**在這台機器上 codex 永遠不會用共用 daemon**。要測就得改系統設定或建排程工作，超出本單權限，所以停在這裡，第 1 題以原始碼回答。
- 清理：三次 `daemon stop` 都回 `notRunning`；結束後 codex 程序清單與開工前相同（14320 / 30640 / 30972 / 36424），沒有殘留。temp `CODEX_HOME`（`%TEMP%\cxp`）已刪除；驅動腳本與紀錄留在 scratchpad（`…\scratchpad\probe\`），不在 repo 內。
- 附帶結論（實測）：**BAT 以系統管理員執行（含 UAC 關閉的機器）時，codex 分頁不可能接上共用 daemon**。

### 3. 對 BAT 的影響

BAT 端證據：`electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs` / `codexMcpOverrides`（`-c mcp_servers.bat.command|args|env_vars|tool_timeout_sec`）；`electron/terminal-command-handlers.ts` `createAgentPromptCommandBuilder` L1058-L1063（codex 派工一律加 `-c check_for_update_on_startup=false`，自訂參數已含此鍵時不加）；`electron/agent-runtime/agent-registry.ts` L266-L276、L452-L454（`CODEX_DISABLE_DAEMON_ARGS` 只在 `this.elevated` 時注入）；`electron/codex-agent-manager.ts`（Codex SDK → `codex exec`）。

| BAT 的 codex 啟動路徑 | 帶非 features 的 `-c`？ | 用 daemon？ | 分頁內 shell / MCP 讀到的 env | 依據 |
|---|---|---|---|---|
| helper 派工的 codex Worker | 是（`check_for_update_on_startup`；BAT MCP 開時另有 `mcp_servers.bat.*`） | 否（embedded） | 自己的 | 原始碼 |
| 手動 codex 分頁 / codex 塔台，BAT MCP 已注入（預設） | 是（`mcp_servers.bat.*`） | 否 | 自己的 | 原始碼 |
| 手動 codex 分頁，BAT MCP **沒注入**（Settings 關、RemoteServer 未 listen、shim 不在），自訂參數也沒有 `-c` | 否 | **非系統管理員時會用** | **daemon 的**（啟動 daemon 的分頁或外部終端） | 原始碼 + 推論 |
| 同上，但 BAT 以系統管理員執行 | — | 否（codex 自己設 `no_daemon`） | 自己的 | 原始碼 + 本機實測 |
| Codex SDK 面板（`codex exec`） | — | 否 | 自己的 | 原始碼 |
| 遠端 headless（WSL / SSH / Docker，Linux 無提升權限問題） | 同本機（`buildBatMcpLaunchArgs` 本機與 headless 共用） | 同上表依 BAT MCP 是否注入 | 同上 | 原始碼 + 推論 |

**在第三列的情境（推論，未實測）**，daemon env 若來自另一個 BAT 分頁 X：

- `BAT_TERMINAL_ID` / `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_HELPER_DIR` / `CT_MODE` / `BAT_USER_DATA` 全部是 X 的值。
- **通知錯投**：Worker 執行 `bat-notify.mjs --target "$BAT_TOWER_TERMINAL_ID"` 時，權杖、id、塔台都屬於 X，`authorizeHelperInvoke` 以 X 的身分放行，通知**成功送到 X 的塔台**。範圍權杖擋不住，因為它驗證的是「權杖與宣告的目標一致」，而這組值本來就一致。
- **派工落點錯誤**：codex 塔台派工時 `--notify-id "$BAT_TERMINAL_ID"` = X。X 是塔台 → 派出的 Worker 綁到 X 的塔台、落在 X 的工作區；X 是 Worker → `role-not-allowed`（helper 顯示 `Forbidden`）。
- **X 已關閉**：權杖已撤銷 → `Capability revoked` / auth 失敗；`--wait-started`、`--close-worker` 等全部失敗。
- **`whoami` 錯誤**：`bat-terminal.mjs` 的查詢以 X 的身分回答。BAT MCP 的 `bat_whoami` 不受影響：MCP 有注入時分頁就是 embedded。
- **CT 判斷錯誤**：`CT_MODE` 取 X 的值（例如 X 是 yolo Worker，當前分頁是 ask 塔台）。
- daemon 由 BAT 以外的終端啟動時：完全沒有 `BAT_*`，CT 判定為非 BAT 環境並改走手動回報（這種情況不會錯投，只是降級）。
- codex 的 hook 與使用者自己寫在 `~/.codex/config.toml` 的 MCP server 也拿 daemon env；BAT 不注入 codex hook（CLAUDE.md「blocked 狀態偵測」🔴 規則），所以不影響 BAT 的功能。
- OSC 7501 狀態偵測不受影響：OSC 由分頁內的 TUI 程序寫進 PTY（推論）。

**潛在回歸點（推論）**：BAT 現在的安全性靠 codex 的一條未文件化規則（「非 features 的 `-c` → embedded」）。codex 之後若把 `-c mcp_servers.*` 改成隨 thread 轉送給 daemon（就像 `features.worktrees` 等已轉送的旗標，`daemon_startup.rs#L134-L135` 註解 "already forwarded in thread requests"），BAT 的 codex 分頁會默默改走 daemon，第三列的問題就會擴大到所有 codex 分頁。

### 4. 建議

**推薦：不需緊急修正；先「文件註明 + source guard」，BAT 端修正列為可選。**

1. **文件（建議立刻做，XS）**：`docs/agent-guide/bat-mcp-shim.md` 加一節「codex 共用 daemon」，並在 CLAUDE.md「BAT MCP shim」節加一行不變式：BAT 的 codex 分頁靠非 features 的 `-c`（`mcp_servers.bat.*`、派工的 `check_for_update_on_startup`）讓 codex 0.163 走 embedded；共用 daemon 會讓 shell 命令與 MCP 拿到別的分頁的 `BAT_*`；`features.daemon_auto_start=false` 不能阻止連上已在跑的 daemon。codex 升版時查 `tui/src/daemon_startup.rs` `config_exclusion`。
2. **BAT 端修正（可選，S–M）**：codex 分頁在 BAT 會注入 helper env，但 BAT MCP 沒注入時，加 `--no-daemon`。
   - 要用 `--no-daemon`，不是 `features.daemon_auto_start=false`（後者不擋既有 daemon）。
   - 舊版相容：T0375 實測 0.133 遇到 `--no-daemon` 會 exit 2，所以要先查版本。可沿用 `createCodexOscVersionCheck`（`electron/codex-osc-version.ts`，`execFile` + 快取）。`--no-daemon` 從哪一版開始有**尚未查證**，實作時以 changelog 或 `codex --help` 確認，查不到版本就不注入。
   - `resume` / `fork`：`--no-daemon` 是 root 選項，要放在 `codex` 之後、子命令之前（與現有 `CODEX_DISABLE_DAEMON_ARGS` 同一位置）。codex 的 `FAILURE_HINT` 也要求 resume / fork 帶它。
   - 使用者自訂參數已含 `--no-daemon` / `daemon_auto_start` / `--remote` 時不加（`hasCodexDaemonOptOut` 擴充；`--remote` 與 `--no-daemon` 一起用會報錯，`startup_orchestration.rs#L16-L20`）。
   - `codex queue`：帶 `--no-daemon` 的 `codex queue` 直接報錯（`@tui/src/session_queue_commands.rs#L32-L35`），但 BAT 不呼叫 `codex queue`。BAT 分頁走 embedded 後，外部的 `codex queue` 也排不到這些 session。這在今天 BAT MCP 開啟時就已經是現狀，不是新的退化。
   - 順手：elevated 時的 `CODEX_DISABLE_DAEMON_ARGS` 在 codex 0.163 已多餘（codex 自己設 `no_daemon`），但對舊版仍有用，保留。
   - 切分：**S** = 只在「BAT MCP 沒注入」時加 `--no-daemon` + 版本檢查 + 測試；**M** = 所有 codex 分頁一律加（不再依賴 codex 的未文件化規則），要多處理手動分頁的非同步版本檢查（`buildLaunchCommand` 現在是同步的）與 headless 路徑。

**BUG 單草稿（推薦修正時使用）**

- 標題：codex 分頁在 BAT MCP 未注入、非系統管理員時接上 codex 共用 daemon，helper 讀到其他分頁的 `BAT_*`（通知可能錯投）
- 嚴重度：Low（P3）。只在 BAT MCP 關閉 / 不可用、非系統管理員、手動 codex 分頁、codex ≥ 有 daemon 的版本時發生；預設設定與 helper 派工不受影響
- 現象：codex 分頁裡由 codex 執行的 `bat-notify.mjs` / `bat-terminal.mjs` 使用的是啟動共用 daemon 的那個分頁的 `BAT_TERMINAL_ID` / `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID` / `CT_MODE`：Worker 完成通知送到別的塔台、派工落到別的工作區、或 `Forbidden` / `Capability revoked`
- 重現步驟（未實測，本機 UAC 關閉無法重現）：
  1. 非系統管理員執行 BAT，Settings → BAT MCP 關閉，codex ≥ 0.163.0，`~/.codex` 的共用 daemon 沒在跑。
  2. 在工作區 1 開 codex 分頁 X（這個分頁會自動啟動 daemon，daemon 繼承 X 的 env）。
  3. 在工作區 2 開 codex 分頁 Y，請 codex 執行 `node -e "console.log(process.env.BAT_TERMINAL_ID)"`。
  4. 預期 Y 的 id，實際印出 X 的 id；關掉 X 後在 Y 執行 helper → `Capability revoked`。
- 根因：codex 共用 daemon 模式下 shell / MCP / hook 都取 daemon 程序的 env（§ 1）；BAT 只在系統管理員時注入 `features.daemon_auto_start=false`，而這個旗標也擋不住既有 daemon。

### 落點檢查

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。
- C-1：工單在 REPO_ROOT 下 → PASS。
- C-3：`affects_files` 只有 `_ct-workorders/` 本工單 → not applicable。
- C-2：工單無 `branch` 欄位，目前 `main`。
- 非隔離工單（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`BAT_REMOTE_TOKEN`：已設定（未讀出）。
- 結果：PASS。

### 遵守的限制

- 沒改產品檔、其他工單、PLAN 或塔台狀態檔。`src/styles/settings.css` 的 M、`site/**` 與新出現的 BUG-156–158 / PLAN-052 未追蹤檔都不是本單變更，沒碰。
- 沒有停止、重啟或改設定任何既有的 codex daemon / app-server。沒改 `~/.codex/`、`~/.claude/`、BAT `settings.json`（只讀了 `~/.codex/` 目錄清單），也沒複製 auth 檔。
- 實驗只用假值（`PROBE_TAB=A|B`、`BAT_TERMINAL_ID=probe-a|b`），子程序先移除真實 `BAT_*` / `CT_*`。沒讀出、印出或寫入真實權杖。
- 模型呼叫 0 次。沒問塔台（無待決策題）。

### 互動紀錄

無（yolo，未提問）。

### Commit

只 commit 本工單檔（`git commit --only`），不 push。
