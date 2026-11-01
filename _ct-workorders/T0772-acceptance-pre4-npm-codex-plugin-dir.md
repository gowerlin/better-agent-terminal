---
schema_version: 1
schema_kind: workorder
id: T0772
title: "pre.4 自動化驗收（安裝版）：環境類 —— BUG-189 npm 安裝的 codex（暫存 prefix）、BUG-191 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 下以 plugin 安裝 CT"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
started_at: "2026-11-02T05:14:34+0800"
updated_at: "2026-11-02T05:26:00+0800"
completed_at: "2026-11-02T05:26:00+0800"
session_ids:
  - "9200e5d5-9c04-4b7e-a1cf-49095c4a2218"
depends_on: []
related:
  - "BUG-189（T0758 `ddfb4f38`）、BUG-191（T0760 `eb5c0589`）；D215（本批自動化驗收）"
  - "既有 e2e：`e2e/t0742-codex-no-daemon.spec.ts`（含 T0758 的 npm shim 情境）；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）"
  - "CLAUDE.md「BAT MCP shim」節（codex 共用 daemon、`--no-daemon`、`resolveNpmCodexShim`）、「Claude Agent SDK / CLI」節（Claude 設定目錄、plugins 目錄 `resolveClaudePluginsDir`）、「CT plugin 安裝」節；`docs/agent-guide/bat-mcp-shim.md`、`docs/agent-guide/ct-plugin-install.md`"
affects_files:
  - "e2e/t0772-*.spec.ts（新增，檔名可調）"
  - "e2e/t0742-codex-no-daemon.spec.ts（只在需要支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/bat-mcp-shim.md
  - docs/agent-guide/ct-plugin-install.md
  - _ct-workorders/T0772-acceptance-pre4-npm-codex-plugin-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；不行再用現有 source build `dist` / `dist-electron`（04:29 由 `31fa4974` 建出，與 tag `v0.7.3-pre.4` 的 `src` / `electron` / `scripts` 無差異），回報逐情境寫明。🔴 不得跑 `npx vite build`（T0770–T0773 並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`。"
  - "🔴 情境 ①（BUG-189）：在暫存目錄以 `npm i -g --prefix <暫存目錄> @openai/codex@0.166.0` 安裝（使用者機器的 codex 是原生安裝版，🔴 不動使用者的 PATH、全域 npm、`~/.codex`、原生 codex）；隔離實例的 PATH 把該 prefix 放最前面、`CODEX_HOME` 指向暫存目錄（不登入）。a) Settings 關 BAT MCP → 開 Codex CLI 分頁 → 啟動命令含 `--no-daemon`；隔離實例 debug log 的 `[codex-version]` 解析到 npm 安裝的原生 `codex.exe` 與版本（不是 `version=unknown (first codex on PATH is …codex.cmd …)`）。b) 開 BAT MCP → 走 BAT MCP 注入路徑（依 CLAUDE.md 規則不加 `--no-daemon`）。c) 塔台分頁以 helper 派一個 codex Worker（`--agent codex-cli` 一類，依 helper 實際參數）→ 記錄 `blockedDetection` 與 `--wait-started` 結果（codex 未登入時的畫面照實記錄，不算缺陷）。另跑 t0742-codex-no-daemon。npm 下載失敗（網路）→ 該項 BLOCKED，其他照做。"
  - "🔴 情境 ②（BUG-191）：隔離實例 env 設 `CLAUDE_CODE_PLUGIN_CACHE_DIR=<暫存目錄>`、`CLAUDE_CONFIG_DIR=<另一個暫存目錄>`（🔴 不動使用者的 `~/.claude`），以內嵌 CLI（`claude plugin marketplace add` / `claude plugin install`）安裝 CT plugin `ct@<marketplace>`：優先用公開的 CT marketplace 或本機 CT repo（唯讀取用，不改它）；兩者都不可行時，比照 T0760 建一個假 marketplace（plugin 名 `ct`、含 `ct-exec` 等 SKILL.md），並寫明用哪個。驗：`installed_plugins.json` 確實在 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 下；BAT 的 skill 面板 / `*` 補全列出 CT 的 skill；指揮塔總覽 `*config` 的預設值層來源讀得到（`ct:read-config-sources`）。對照：不設 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時路徑不變（`<設定目錄>/plugins`）。"
  - "🔴 隔離與安全：一律用隔離實例，不碰使用者正在用的 BAT；暫存目錄名含 `t0772`，跑完刪除（npm prefix、CODEX_HOME、CLAUDE_CONFIG_DIR、plugin cache 都刪）。不得複製、讀出或印出任何認證檔或權杖內容，不傾印整個 `process.env`。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉附重現步驟與證據，由塔台開 BUG。"
  - "🔴 驗證：spec 跑 1 次，失敗時同一情境最多重跑 1 次並記錄（並行負載可能造成逾時）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`bat-mcp-shim.md`「codex 共用 daemon」驗證清單補一行（npm 安裝 codex 實測）、`ct-plugin-install.md` 驗證清單補一行（`CLAUDE_CODE_PLUGIN_CACHE_DIR` 實測）。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）：回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0772 — pre.4 自動化驗收（安裝版）：環境類

## 元資料

- **工單編號**：T0772
- **類型**：implementation（驗收用 e2e，不改產品程式碼）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。使用者選擇以自動化取代手動實機驗收（D215）。BUG-189 要 npm 安裝的 codex、BUG-191 要 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 加 plugin 安裝的 CT，兩者都和使用者目前的安裝方式不同，所以在暫存目錄與隔離實例內建出這兩種環境驗收，不動使用者的環境。

## 範圍

1. 情境 ① BUG-189、② BUG-191（見 frontmatter）。
2. 不回歸 t0742-codex-no-daemon。
3. docs 各一行。

## 不做

- 不動使用者的 PATH、全域 npm、`~/.codex`、`~/.claude`、原生 codex。
- 不改產品程式碼、不 build、不改共用 fixture。

## 驗收

- [x] 情境 ①a–c、②逐項結果，每項寫明驗收對象（安裝版 / source build）與用了哪個 marketplace
- [x] t0742-codex-no-daemon 綠、兩個 typecheck = 0
- [x] 暫存目錄已清除
- [x] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①a–c、② 全部 PASS；t0742-codex-no-daemon 2/2 綠；兩個 typecheck = 0；暫存目錄已清除）
- **驗收對象**：全部情境都用安裝版 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`），以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；沒有用 source build，沒有跑 `npx vite build`，沒改 `e2e/fixtures/electron-isolation.ts`
- **marketplace**：公開的 `gowerlin/Control-Tower`（`control-tower`，`ct@control-tower` 5.15.0，`gitCommitSha` `4bb9d997…`）；不需要用到假 marketplace（spec 內留有 T0760 式的本機假 marketplace 作為連不上時的後備）
- **session_id**：9200e5d5-9c04-4b7e-a1cf-49095c4a2218

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = 本 repo 主 checkout，`main`）
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`e2e/t0772-*.spec.ts` 含萬用字元、`_ct-workorders/` 項目排除；其餘 3 項皆存在 → PASS
- C-2：工單沒有 `branch` 欄位 → 不適用
- 未設 `CT_HOME`（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE` = `yolo`

### 產出與 commit

- 產品 commit `366b96b0`：
  - 新增 `e2e/t0772-pre4-env-acceptance.spec.ts`（2 個 test：① BUG-189、② BUG-191）
  - `docs/agent-guide/bat-mcp-shim.md`「codex 共用 daemon」驗證清單補一行（npm 安裝 codex 實測）
  - `docs/agent-guide/ct-plugin-install.md` 驗證清單補一行（`CLAUDE_CODE_PLUGIN_CACHE_DIR` 實測）
- 沒改 `e2e/t0742-codex-no-daemon.spec.ts`（安裝版直接跑得過，不需要改）；沒改產品程式碼

### 情境 ① BUG-189：npm 安裝的 codex（安裝版）

環境：`npm i -g --prefix <暫存>\npm --cache <暫存>\npm-cache @openai/codex@0.166.0`（npm 12.2.1，exit 0，約 4 s；npm cache 也放暫存，沒用使用者的全域 npm 與 cache）。npm 寫出 `codex.cmd` / `codex.ps1`，原生檔在 `<prefix>\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`（`--version` = 0.166.0）。隔離實例 PATH = `<prefix>;<原 PATH 去掉 node_modules\.bin>`、`CODEX_HOME` = 空暫存目錄（未登入）。分頁 shell（pwsh + 使用者 profile）的 `Get-Command codex` = `<prefix>\codex.ps1`。分頁內跑的是這個真的 npm codex（不是假 shim）。

| 項目 | 結果 | 證據 |
|---|---|---|
| a) BAT MCP 關 → Codex CLI 分頁 | PASS | `[codex-version] path=<prefix>\…\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe version=0.166.0 (probed) via=<prefix>\codex.cmd`（不是 `version=unknown (first codex on PATH is …codex.cmd …)`）；`[bat-mcp] tab agent=codex-cli terminal=… → injected: --no-daemon; mcp=no (turned off in Settings)`；執行中的 `codex.exe` 命令列 `-c features.daemon_auto_start=false --no-daemon` |
| b) BAT MCP 開 → Codex CLI 分頁 | PASS | 決策 `→ injected: -c 'mcp_servers.bat.command=…' -c 'mcp_servers.bat.args=[…bat-mcp.mjs]' -c 'mcp_servers.bat.env_vars=[…名稱…]' -c mcp_servers.bat.tool_timeout_sec=60`，沒有 `--no-daemon`；執行中的 `codex.exe` 命令列同樣只有 `mcp_servers.bat.*`、無 `--no-daemon` |
| c) 塔台分頁以 helper 派 codex Worker | PASS | `--set-role tower --mode yolo` exit 0；`bat-terminal.mjs --notify-id … --workspace … --agent codex --skill ct-exec --workorder T0772 --cwd <ws> --mode yolo --wait-started 30000` → `Terminal created`、`agent: codex-cli`；派工探測 `[codex-version] … version=0.166.0 (probed) via=<prefix>\codex.cmd`；`bat_get_state(Worker)` = `blockedDetection: osc`、`agentStarted: false`、`state: idle`；`--wait-started` 回 `  started: unconfirmed`、exit **8**、stderr `create: LAUNCH_UNCONFIRMED`（分頁保留）。Worker 命令列 `-c features.daemon_auto_start=false -c mcp_servers.bat.* -c check_for_update_on_startup=false "$ct-exec T0772"`（派工不加 `--no-daemon`，符合規則）；`[agent-command] codex skill … name=$ct-exec reason=fallback-no-plugin` |

①c 的畫面照實記錄：codex 未登入，Worker 停在「Welcome to Codex … Choose how you want to use Codex. > 1. Sign in with ChatGPT …」登入選單，沒有送 OSC 7501，所以 `agentStarted` 一直是 `false`、`--wait-started` 回 `unconfirmed`。這符合 T0621 契約（`osc` 分頁在第一個 OSC 7501 之前是 `false`，逾時回 `unconfirmed` exit 8），**不算缺陷**。BUG-189 修正前，經 npm shim 時派工探測回 `unknown`，Worker 會是 `blockedDetection: none`、`started: unknown`；本次是 `osc`，證明派工路徑也追到原生 `codex.exe`。

### 情境 ② BUG-191：`CLAUDE_CODE_PLUGIN_CACHE_DIR` 下的 CT plugin（安裝版）

安裝：安裝版內嵌 CLI（`resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe`，2.1.316），env 拿掉本 session 的 `BAT_*` / `CT_*` / `CLAUDE*` / `ANTHROPIC*`，`HOME` / `USERPROFILE` 指向暫存 home、`DISABLE_AUTOUPDATER=1`、`GIT_TERMINAL_PROMPT=0`：`claude plugin marketplace add gowerlin/Control-Tower` → `claude plugin install ct@control-tower --scope user`，兩步都 `✔ Successfully`。裝兩份：A = 設定目錄 a + cache 目錄 a；對照組 = 設定目錄 b、不設 cache 變數。暫存 home 安裝後仍是空的（CLI 沒寫到 home）。

| 項目 | 結果 | 證據 |
|---|---|---|
| `installed_plugins.json` 在 cache 目錄 | PASS | `<cache-a>\installed_plugins.json` 存在、`<config-a>\plugins\installed_plugins.json` 不存在；`installPath` = `<cache-a>\cache\control-tower\ct\5.15.0`（`known_marketplaces.json`、`marketplaces\` 也在 cache 目錄） |
| A) BAT env 設 `CLAUDE_CONFIG_DIR=<config-a>` + `CLAUDE_CODE_PLUGIN_CACHE_DIR=<cache-a>` | PASS | `claude:scan-skills` 列出 plugin 的 8 個 skill（`control-tower`、`ct-done`、`ct-evolve`、`ct-exec`、`ct-fieldguide`、`ct-help`、`ct-insights`、`ct-status`，scope `global`），與 plugin 的 `skills\` 目錄完全一致；`claude:scan-star-commands`（`*` 補全）= `ct-done … ct-status` 7 個；Skills 面板（右側 dock）顯示 `/ct-exec` 等（截圖於 `e2e-results`）；`ct:read-config-sources` 的 `installs.claude.plugin` = `{ version: "5.15.0", marketplace: "control-tower" }` |
| B) 同 `<config-a>`、不設 cache 變數 | PASS（對照） | skill 清單沒有任何 ct-*、`*` 補全為空、`installs.claude.plugin` = `null`：路徑不變，仍是 `<設定目錄>/plugins`（那裡沒有東西） |
| C) `<config-b>`（不設 cache 變數安裝）、不設 cache 變數 | PASS（對照） | `installed_plugins.json` 在 `<config-b>\plugins\`；skill / `*` 補全 / `installs.claude.plugin` 都與 A 相同 |
| 指揮塔總覽 `*config` 預設值層來源（`ct:read-config-sources`） | PASS（讀得到；來源見下） | 三次啟動 `defaults` 都是 `found`，路徑 `<使用者資料夾>\.codex\skills\control-tower\references\tower-config.md` |

預設值層說明：測試機器本來就有手動安裝的 Codex CT（`<使用者資料夾>\.codex\skills\control-tower\…`，只檢查存在），依 T0710 3-2「手動安裝優先（那份才是實際執行的）」，預設值層讀的是手動那份，所以在這台機器上看不到「預設值層讀 plugin 的 `tower-config.md`」。spec 會偵測這件事：沒有手動安裝時改驗 `defaults.path` 在 plugin 目錄底下。BAT 的 `homeDir` 取 `app.getPath('home')`（實測 = 使用者家目錄），不能用 env 改，所以本單沒辦法在不動使用者家目錄的情況下驗到這一段（見〈仍需手動〉）。plugin 是否被讀到，已由 `installs.claude.plugin`（同一個 channel、同一個 `findClaudeCtPlugins`）證明。

### 驗證

- `BAT_E2E_EXECUTABLE=<安裝版> npx playwright test e2e/t0772-pre4-env-acceptance.spec.ts`：② 1 passed（33.5 s）、① 1 passed（56.4 s）；各跑 1 次，沒有重跑
- `BAT_E2E_EXECUTABLE=<安裝版> npx playwright test e2e/t0742-codex-no-daemon.spec.ts`：2 passed（原生 codex.exe 0.166.0 → `--no-daemon`；npm shim 情境 → `via=…codex.cmd`、`--no-daemon`）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。`e2e/` 不在兩個 tsconfig 的範圍內；另以 `tsc --noEmit --skipLibCheck --target ES2022 --module esnext --moduleResolution bundler --types node e2e/t0772-pre4-env-acceptance.spec.ts` 單檔檢查 = 0
- 清理：`%TEMP%\bat-t0772-*` 0 個、`%APPDATA%\BetterAgentTerminal-runtime-e2e-t0772*` 0 個、命令列含 `bat-t0772` 的程序 0 個（npm prefix、npm cache、CODEX_HOME、兩個 CLAUDE_CONFIG_DIR、plugin cache、暫存 home 都在各 test 的暫存目錄內，`finally` 先殺殘留程序再刪；情境 ② 的事前手動試裝目錄也已刪除）
- 安全：沒讀、沒印任何認證檔或權杖；process 命令列只查含本次暫存目錄名的 `codex.exe` / `node.exe`，日誌把 `batcap.` 遮掉；`env_vars` 只有名稱。spec 與 docs 不含使用者家目錄路徑或帳號（`gowerlin/Control-Tower` 是公開 repo 名稱，docs 原本就有）

### 發現的問題

- 無產品缺陷。

### 仍需手動

- 「只裝 CT plugin（沒有任何手動安裝）時，總覽預設值層顯示 plugin 的 `tower-config.md`」：這台機器有手動 Codex CT，依規則讀手動那份；要實機看到得在沒有 `~/.codex/skills/control-tower` 的機器上驗（邏輯本身由 `electron/__tests__/ct-config-sources.test.ts`「只 plugin」涵蓋）。
- codex 登入狀態下的 npm codex Worker（`started: <ISO>`）：本單照工單不登入；登入後的流程與原生 codex 相同（`e2e/t0621-codex-osc-state.spec.ts` 以假模型涵蓋）。
- daemon 行為本身（非系統管理員 BAT + 已登入 codex）仍如 T0742 所述只能手動。

### 遭遇問題

- 寫 docs 時一度用 bash heredoc 包 JS 插入文字，反斜線被當成跳脫字元寫壞了一行（`\n`、`\v`、`\b`），已改用 `String.raw` 腳本重寫該行並檢查 diff，最終檔案正確。

### 互動紀錄

- 無（yolo；沒有需要問塔台的問題）。
