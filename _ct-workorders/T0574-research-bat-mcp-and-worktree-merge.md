---
schema_version: 1
schema_kind: workorder
id: T0574
title: "研究：PLAN-047 BAT MCP Server 與 Worktree 合併 — 外部查證、本機範圍權杖影響面、stdio shim 原型、worktree / 合併工單實測"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M-L
created_at: "2026-10-17T18:42:52+0800"
started_at: "2026-10-17T18:44:38+08:00"
updated_at: "2026-10-17T19:00:19+08:00"
completed_at: "2026-10-17T19:00:19+08:00"
depends_on: []
related:
  - "PLAN-047（塔台初評：§一 現況對照、§二 可行性、§三 修正建議、§三之一 合併改由合併工單）"
  - "外部提案原檔：D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案.md"
  - "PLAN-036 K / T0420 / T0432 / T0447–T0450（headless 每 PTY 範圍權杖、`electron/remote/helper-capability.ts`）"
  - "T0535 / T0545 / T0551（close-worker）、T0562 / T0565（set-role）、T0523 / T0527（派工落點 / cwd 檢核）、T0566（`src/lib/usage-limit.ts` 畫面辨識）"
  - "`electron/worktree-manager.ts`（現有 worktree，Agent 面板 / `claude-cli-worktree` 用）"
affects_files:
  - _ct-workorders/T0574-research-bat-mcp-and-worktree-merge.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品程式碼、測試、CLAUDE.md、package.json**；唯一可寫入並 commit 的檔案是本工單（`git commit --only _ct-workorders/T0574-research-bat-mcp-and-worktree-merge.md`）。原型與實驗檔一律放在 repo 外的暫存目錄，結束後刪除，只把關鍵片段貼進回報區。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；需要 BAT 時用隔離實例（需先 `npx vite build`）。可讀使用者的 `%APPDATA%\\BetterAgentTerminal\\Logs\\` 日誌（只讀）。"
  - "🔴 worktree 實驗**不得在本 repo 上 `git worktree add` 或建分支**：先 `git clone --local` 到 repo 外暫存目錄，在 clone 上做；結束後整個刪除。"
  - "🔴 不得對 claude / codex 送出任何 prompt（不耗額度）。驗證 MCP 連線只用不消耗額度的方式（例如 `claude mcp list` / `claude mcp get` 的健康檢查、自寫的 JSON-RPC 測試 client、讀 CLI 二進位字串）。"
  - "🔴 外部查證以官方文件為準，每一項附 URL 與取用日期；查不到官方原文的寫「未證實」，不得以推測代替。"
---

# T0574 — 研究：BAT MCP Server 與 Worktree 合併

## 元資料

- **工單編號**：T0574
- **任務名稱**：研究：PLAN-047 的可行性缺口查證與原型實測
- **狀態**：DONE
- **類型**：research
- **互動模式**：disabled（`--no-interactive`；需要使用者決定的事項寫進回報區「待塔台 / 使用者決定」，不要停下來問）
- **Renew 次數**：0
- **建立時間**：2026-10-17 18:42 (UTC+8)

## 背景

使用者收到外部提案「BAT MCP Server 與 Worktree 合併規格提案」，提案方不了解 BAT / CT 實作細節。塔台已在 **PLAN-047** 完成初評（請先完整讀 PLAN-047，它是本單的起點，不要重做已確認的對照）。初評結論：

- 全部技術上可做；約一半有現成零件（headless 每 PTY 權杖、`create-agent-command`、`close-worker`、`lastOutputAt` / `getLastOutput`、`worktree-manager.ts`、`bat-scripts.log`）。
- **本機 PTY 持有全權 server token**（塔台 2026-10-17 實測本機分頁 `BAT_REMOTE_TOKEN` 不是 `batcap.` 前綴）→ 塔台建議前置條件改為「本機範圍權杖」，取代提案的 bat-daemon 分離。
- 塔台建議 MCP 傳輸首選 **stdio shim（`bat-mcp.mjs`）連既有 RemoteServer WSS**，不開新 HTTP 埠。
- 使用者方向（塔台同意）：**合併不由 BAT 執行，改由塔台派「合併工單」**；BAT 只提供唯讀信號；合併工單在整合 worktree 做、main 只 `--ff-only`。
- 塔台無法確認的：MCP 規格「2026-07-28 版」內容、Claude Code / Codex 當前 MCP 設定能力、blocked 偵測的 hook 能力。

## 研究目標

產出**可決策**的結論，讓塔台定案 PLAN-047 的範圍、階段與第一批實作工單。

## 調查範圍與研究指引

### R1 外部查證（官方文件，附 URL + 取用日期）

1. MCP 規格目前的最新版本與日期；提案引用的「2026-07-28 版」是否存在；若存在，確認：移除協定層 session / `Mcp-Session-Id`、HTTP+SSE 棄用、Sampling / Logging 棄用、`_meta` 的 OpenTelemetry 慣例。不存在則寫出實際最新版本對應的事實。
2. Claude Code 的 MCP 設定：`.mcp.json` 的 stdio / http 類型、`${VAR}` 展開是否適用於 `command` / `args` / `env` / `url` / `headers`；專案層 MCP server 的使用者核准流程；tool 呼叫逾時（長輪詢 `bat_wait` 30–60 s 是否會被截斷）；內嵌 CLI 2.1.300 是否支援上述（可讀 `node_modules/@anthropic-ai/claude-code` 內容）。
3. Codex CLI（目前常用的 0.16x）的 MCP 設定：`config.toml` 的 stdio / streamable HTTP、bearer token 環境變數、專案層設定是否存在。
4. 結論：stdio shim 是否兩邊都能用、Streamable HTTP 是否兩邊都能用、各自限制。

### R2 blocked 偵測（Worker 停在權限確認 / 等回答）

1. Claude Code hooks：有哪些事件可判斷「等待權限 / 等待使用者輸入 / 回合結束」（例如 Notification、Stop 等事件與 matcher）；內嵌 2.1.300 是否支援。
2. BAT 如何注入 hook **而不覆寫使用者 / 專案設定**：`--settings` 旗標、設定合併規則、env；與 PLAN-044 遇到的「專案層設定影響 CLI 行為」是否有同類陷阱。
3. Codex：有沒有對應的 hook / notify 事件可表示等待核准；沒有的話，畫面啟發式需要的句型（只從 CLI 二進位字串或官方文件取，不實際觸發），參考 `src/lib/usage-limit.ts` 的行首句型做法評估誤判風險。
4. 結論：各 agent 的 `source: hook | heuristic` 可達成度、預估延遲（提案驗收「5 秒內回 blocked」是否合理）。

### R3 本機範圍權杖（A' 回移本機）影響面

1. 列出本機 PTY 內所有使用 `BAT_REMOTE_TOKEN` 的呼叫者與其用到的 channel：`scripts/bat-terminal.mjs` 各模式（建立 agent / raw command / `--close-worker` / `--set-role`）、`scripts/bat-notify.mjs`、其他 `scripts/*.mjs`、BAT 內建 skill / preset 會呼叫的路徑。以 grep 為主，附檔案:行號。
2. headless 的 `helper-capability.ts` / `buildHeadlessHelperEnv` 能否直接給本機用；本機特有差異（Terminal Server 模式、T0108 replay 的 PTY 沒有 env 記錄、`pty:restart`、Terminal Server recovery、detached 視窗、本機的 raw command 模式 `terminal:create-with-command` 目前會被範圍權杖拒絕）。
3. 相容性：舊 helper / 舊 CT skill 搭配新 BAT、反之；BAT 重開但 Terminal Server 存活時已存在分頁的 env 仍是舊 token 的處理。
4. 結論：遷移步驟、風險、工單切分與估計。

### R4 `bat-mcp` stdio shim 原型（repo 外暫存目錄）

1. 寫最小原型：stdio JSON-RPC MCP server，讀 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / 憑證（參考 `scripts/_bat-cert.mjs`、helper 的 `MinimalWS` 與 frame id 比對規則 BUG-114），連**隔離實例**的 RemoteServer；提供 `initialize`、`tools/list`、至少一個唯讀 tool（例如 `bat_whoami` 由 env + 一個既有 channel 組成）。
2. 評估「零依賴手寫」vs「官方 MCP SDK」：helper 以 `extraResources` 散檔部署（`verify-helper-bundle.js` 只掃相對 `.mjs` import），SDK 依賴要怎麼進安裝檔與 server bundle、大小影響（安裝檔瘦身規則見 `CLAUDE.md`）。
3. 驗證：自寫測試 client 完成 handshake + `tools/list` + `tools/call`；內嵌 claude 以 `--mcp-config` 或 `claude mcp` 健康檢查確認能連上（**不送 prompt**）。
4. 遠端 headless：以靜態分析評估 shim 在遠端 PTY（`BAT_HELPER_NODE`、`batcap.` 權杖、角色表需新增哪些 channel）的可行性。
5. 結論：shim 方案是否成立、需要 BAT 新增哪些唯讀 channel（例如列終端、終端狀態、讀輸出），附建議 channel 清單與權限角色。

### R5 worktree 與合併工單實測（`git clone --local` 到 repo 外）

1. 在 clone 上建立 repo 外 worktree，量測（Windows）：`npm ci` 時間與磁碟用量、`npm run test:unit` 能否通過、`npx vite build` 時間。
2. 本專案特有：`_ct-workorders/` 在 repo 內且產品測試讀真實檔案（L133）。評估 `CT_HOME` 方案，至少比較：(a) env `CT_HOME` 指向主 checkout、worktree 內副本唯讀不提交；(b) worktree 以 sparse-checkout 排除 `_ct-workorders/`（測試是否因此失敗）；(c) 其他你發現更好的做法。附各自對 ct-exec（CT 端）的改動需求。
3. 合併工單流程演練（臨時 git repo 夾具即可）：整合 worktree 併入工單分支 → 驗收 → `git merge --ff-only` 到 main；涵蓋無衝突、文字衝突、驗收失敗、合併期間 main 被別人前進四種情況，記錄每種情況 main SHA 是否保持不變、塔台收單需要比對哪些 SHA。
4. BAT 唯讀信號可行性：`git merge-tree --write-tree` 試算衝突（本機 git 版本是否支援）、ahead / behind、實際變更 vs `affects_files` 的計算成本。
5. 小型無衝突合併是否允許塔台直接做：提出判準建議（例如 ff 可行 + 無範圍外檔案 + 驗收已在 Worker 跑過）。

### R6 綜合

1. 修正後的階段表（PLAN-047 §四），每階段工單估計與依賴。
2. PLAN-047 §五 與提案 §16 Q1–Q14 的建議答案（每題一行，附依據；Q9–Q11 依合併工單方向）。
3. 需要 CT 端（CT-T014 起）配合的變更清單與介面契約草案要點（只列要點，不寫 skill）。

## 互動規則

- `--no-interactive`：不向使用者提問。需要決策的事項列在回報區「待塔台 / 使用者決定」，附建議。
- 某項查不到或無法實測時，寫明原因與替代證據，繼續其他項；不要因單項卡住而停下。

## 驗收條件

1. R1–R6 每項都有結論，且標明證據等級：[官方文件 URL] / [碼 檔:行] / [實測] / [推論]。
2. R4 原型有實測輸出（handshake / tools/list / tools/call 的實際 JSON 片段）。
3. R5 有 `npm ci` / test / build 的實測數字與四種合併情況的 main SHA 表。
4. 「調查結論」是可決策的；「建議方向」至少兩個方案並給推薦。
5. 只 commit 本工單檔；暫存目錄（clone、原型、夾具）已刪除並在回報區寫明。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
**DONE**（R1–R6 全部有結論；R4 原型、R5 實測皆有實際輸出；只有一項無法實測：Codex 實際連上 MCP server 的握手需要開 Codex session，屬禁止範圍，改以設定解析與二進位字串佐證，見 R1-3 / R4）

**落點檢查**：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 內；C-3 `affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 互動紀錄
無（`CT_INTERACTIVE=0`，未向使用者提問；待決事項列於下方）。

### 調查結論

證據等級：**[文件]** 官方文件（皆 2026-10-17 取用）／**[碼]** 本 repo 檔:行／**[實測]** 本單實際執行／**[二進位]** CLI 執行檔字串／**[推論]**。

#### R1 外部查證

**R1-1 MCP 規格：提案引用的「2026-07-28 版」存在，且是目前最新版。** 提案的四點全部成立，而且改動比提案寫的更大：連 `initialize` 握手都移除了。
- 「The current protocol version is 2026-07-28.」— https://modelcontextprotocol.io/specification/versioning [文件]
- changelog（https://modelcontextprotocol.io/specification/2026-07-28/changelog）[文件，本人親讀]：
  - (a) ✅ 「Remove protocol-level sessions and the `Mcp-Session-Id` header from the Streamable HTTP transport.」
  - 另外 ✅ 「Make MCP stateless: remove the `initialize`/`notifications/initialized` handshake. Every request now carries its protocol version and client capabilities in `_meta` (`io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`)」；新增必備的 `server/discover`；移除 `ping` 與 `logging/setLevel`；所有 result 都要帶 `resultType`；`tools/list` 要帶 `ttlMs` / `cacheScope`。
  - (b) ✅ HTTP+SSE「Reclassify … as Deprecated … Migrate to Streamable HTTP」
  - (c) ✅ 「Deprecate the Roots, Sampling, and Logging features (SEP-2577)」
  - (d) ✅ 「Document OpenTelemetry trace context propagation conventions for `_meta` keys (`traceparent`, `tracestate`, `baggage`) (SEP-414)」
- 相容性（https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning）[文件]：新舊兩代分為 modern 與 legacy（`2025-11-25` 以前）。stdio client 先送 `server/discover` 探測，收到非 modern 錯誤才退回 `initialize`。server 可以兩代都支援（dual-era）。
- 規格完整版本清單：changelog 只寫出上一版 `2025-11-25`。2024-11-05 / 2025-03-26 / 2025-06-18 的正式列表沒有讀到 → **未證實**。

**R1-2 Claude Code（https://code.claude.com/docs/en/mcp 、/env-vars 、/cli-reference）**
- 支援的類型：`stdio` / `http`（`streamable-http` 是 `http` 的別名）/ `sse`（已棄用）/ `ws` [文件]。
- `${VAR}` 與 `${VAR:-default}` 適用於 `command`、`args`、`env`、`url`、`headers`。未設定又沒有預設值時保留原字面並警告 [文件]。**實測**：內嵌 2.1.300 對 stdio server 的 `args` 裡的 `--terminal=${BAT_TERMINAL_ID}` 與 `env` 的 `${BAT_WORKSPACE_ID}` 都在 spawn 時展開，shim 收到 `argv:["--terminal=t0574tab"]`、`expandedEnv:"ws-t0574"`。`BAT_REMOTE_TOKEN` 沒寫在設定裡也由 PTY env **繼承**到 shim（`tokenKind:"server-token"`）[實測]。
- 專案層 `.mcp.json`：互動模式下「prompts for approval … before using project-scoped servers」；`-p` / SDK 不詢問；在 untrusted folder 中，專案 `.claude/settings.json` 的 `enableAllProjectMcpServers` 會被忽略，user / managed / `--settings` 的核准仍有效 [文件]。
- 逾時：`MCP_TIMEOUT` 是啟動逾時，預設 30 s；`MCP_TOOL_TIMEOUT` 預設約 28 h。另有「For an HTTP, SSE, or claude.ai connector server, each request also times out after 60 seconds by default … **Stdio and WebSocket servers have no per-request timer**」[文件]。⇒ **stdio 上 30–60 s 的 `bat_wait` 長輪詢不會被截斷；走 HTTP 時會被 60 s 截斷**，需在 server 設定加 `timeout`（推論）。閒置逾時：stdio 30 min、網路 server 5 min。
- `--mcp-config <json|file>`、`--strict-mcp-config` [文件]。⇒ BAT 啟動 claude-cli / 派工時可直接附上 `--mcp-config`，不必提交 `.mcp.json`，也避開專案核准提示（推論）。
- `claude mcp list` / `get` 會實際連線做健康檢查 [文件]。實測結果見 R4。
- 內嵌 2.1.300 的二進位含 `server/discover`（83 處）、`2026-07-28`（28）、`MCP_TOOL_TIMEOUT`、`strict-mcp-config`、`enableAllProjectMcpServers` [二進位]。
- header 變數展開是哪一版開始支援：CHANGELOG 未找到 → **未證實**（2.1.300 文件已列入，不影響本專案）。

**R1-3 Codex CLI（https://learn.chatgpt.com/docs/extend/mcp?surface=cli 、/docs/config-file/config-reference；`developers.openai.com/codex/*` 會 308 轉到這裡）**
- `[mcp_servers.<name>]`：stdio 用 `command` / `args` / `env` / `env_vars` / `cwd`；Streamable HTTP 用 `url` / `bearer_token_env_var` / `http_headers` / `env_http_headers` [文件]。
- `startup_timeout_sec` 預設 10 s，`tool_timeout_sec` 預設 **60 s** [文件]。⇒ 60 s 的長輪詢必須調高逾時，或 server 端把等待控制在 ≤ 45 s。
- 專案層 `.codex/config.toml` 存在，但「applies only to trusted projects」[文件]。
- `experimental_use_rmcp_client` 已移除（openai/codex PR #8087，2025-12-20 合併）[文件]。
- **實測（隔離 `CODEX_HOME`，codex-cli 0.162.1）**：
  - `codex mcp add` / `list` / `get` 正常。
  - `list` **不連線**：shim 的 debug 檔沒有產生，Auth 欄顯示 `Unsupported`，所以無法用它驗證握手。
  - **`codex mcp list -c 'mcp_servers.batcli.command="node"' -c 'mcp_servers.batcli.tool_timeout_sec=120'` 可以在啟動時定義 MCP server 而不寫入 config.toml**（`config.toml` 中 `batcli` 出現 0 次，`get` 顯示 `tool_timeout_sec: 120`）。⇒ BAT 派工 codex 時可用 `-c` 注入，不動使用者設定。
- 0.162.1 二進位含 `server/discover`（13 處）、`2026-07-28`（19）、`notifications/initialized`（7）、`bearer_token_env_var`、`tool_timeout_sec` [二進位]。⇒ 推測兩代都支援，但**沒有實際握手證據**（需要開 session）。

**R1-4 結論**
| | Claude Code 2.1.300 | Codex 0.162.1 |
|---|---|---|
| stdio shim | ✅ [實測：discover + tools/list 經 `claude mcp list` 連上] | ✅ 設定可用 [實測：設定解析]；握手未實測；`tool_timeout_sec` 預設 60 s |
| Streamable HTTP + bearer | ✅ `headers: Authorization: Bearer ${VAR}` [文件]；每個請求 60 s 逾時 | ✅ `bearer_token_env_var` [文件]；工具逾時 60 s |
| 注入方式（不改使用者 / 專案檔） | `--mcp-config '<json>'` [文件] | `-c mcp_servers.bat.*=…` [實測] |

⇒ **stdio shim 兩邊都能用，而且在 Claude 端沒有 60 s 截斷**，是較好的方案。HTTP 兩邊也都能用，但多一個埠、要做 Origin 驗證，還有 60 s 限制。

#### R2 blocked 偵測

**R2-1 Claude Code hooks（https://code.claude.com/docs/en/hooks）**
- 共 33 個事件，其中有用的是：
  - **`PermissionRequest`**：「When a tool call needs a permission decision」，在權限對話框出現**之前**觸發 [文件，本人親讀表格]。input 包含 `tool_name`、`tool_input`、`permission_suggestions`。不會為 sandbox 網路請求觸發 [文件，子代理引述]。
  - **`Notification`** 的 `notification_type`：`permission_prompt`、`idle_prompt`、`elicitation_dialog`、`agent_needs_input`、`quota_auto_resume_*` 等 [文件，親讀]。`permission_prompt` 約等 **6 秒**才發，而且每次按鍵都會延後；`idle_prompt` 在回覆結束約 60 s 後才發 [文件，子代理引述]。
  - **`Stop`**：每個回合結束時觸發。
- 內嵌 2.1.300 二進位含 `"PermissionRequest"`（67 處）、`permission_prompt`（45）、`idle_prompt`、`agent_needs_input`、`disableAllHooks`、`allowManagedHooksOnly` [二進位]。
- ⇒ blocked 的訊號用 `PermissionRequest`（立即）＋ `PreToolUse` matcher `AskUserQuestion`（等回答，推論）＋ `Notification` `elicitation_dialog`。`Stop` 視為「回合結束 → 候選 idle」。**`permission_prompt` 太慢，不採用**。
- ⚠️ CT yolo Worker 若以略過權限的模式執行，根本不會出現權限提示；yolo 下的 blocked 主要會是 AskUserQuestion / elicitation（推論，需確認 CT yolo 的 claude 啟動旗標）。

**R2-2 注入而不覆寫使用者設定**
- 優先序：managed > `--settings` > local > project > user [文件，https://code.claude.com/docs/en/settings]。
- 「Hook entries merge across settings levels rather than replacing each other」；同一個 handler 定義在多處只跑一次 [文件，親讀]。⇒ **BAT 用 `--settings '<json>'` 附加 hooks，會與使用者 / 專案的 hooks 並存，不會覆寫**。
- **與 PLAN-044 同類的陷阱**：
  - ① 專案 / local / user 設 `"disableAllHooks": true` 時，BAT 注入的 hooks 也一起停用。BAT 不應在 `--settings` 寫 `disableAllHooks:false` 來反制，因為那會連使用者刻意關掉的 hooks 一起打開。應降級為啟發式並在日誌標明（推論）。
  - ② managed `allowManagedHooksOnly` 會擋掉 user / project / local / plugin hooks；文件沒點名 `--settings` 來源 → 是否也被擋**未證實**。
  - ③ `--setting-sources` 不要動（會改變使用者行為）。

**R2-3 Codex**
- **有完整 hooks 系統**，包含 `PermissionRequest`（「about to ask for approval」，不需要核准的指令不觸發）與 `Stop`；hooks 預設啟用 [文件，https://learn.chatgpt.com/docs/hooks]。但「**Non-managed hooks must be reviewed and trusted before they run**」，信任以 hook hash 記錄、經 `/hooks` 審核；專案 hooks 只在 trusted project 載入 [文件]。⇒ BAT 注入的 hook 第一次會要使用者審核，YOLO 不適合靠它。用 `-c` 注入的 hooks 算不算 trusted → **未證實**。
- `notify` 只有 `agent-turn-complete` [文件]。`tui.notifications` 可過濾 `approval-requested`，搭配 `tui.notification_method = "osc9"`、`tui.notification_condition = "always"`，會在 PTY 串流送出 **OSC 9**（https://learn.chatgpt.com/docs/config-file/config-advanced）[文件]。⇒ BAT 本來就在解析 PTY 輸出，用 `-c` 打開後即可**以 OSC 9 取得結構化的「等待核准」訊號**，比句型啟發式精確（推論，未實際觸發）。
- 啟發式句型（0.162.1 二進位）[二進位]：
  - `Would you like to run the following command?`
  - `Would you like to make the following edits?`
  - `Would you like to grant these permissions?`
  - `Would you like to send input to the existing terminal?`
  - 選項列 `Yes, and don't ask again for this command in this session` / `No, and tell Codex what to do differently`
  - 誤判風險比照 `src/lib/usage-limit.ts`：只認行首完整句＋安靜 5 s。問句可能出現在 agent 回覆中被引用，用「問句＋選項列同時出現在畫面最後 40 行」可大幅降低誤判（推論）。句型會隨 CLI 版本漂移，與 PLAN-044 同一風險。

**R2-4 結論**
| agent | 來源 | 可達成度 | 預估延遲 |
|---|---|---|---|
| claude | `hook`（PermissionRequest / PreToolUse AskUserQuestion / elicitation） | 高；`disableAllHooks` / `allowManagedHooksOnly` 時降級 | < 1–2 s（hook 啟動 node + WSS 約數百 ms，推論） |
| codex | `osc`（OSC 9 approval-requested，建議新增此 source 值）→ `heuristic` 後援 | 中；hooks 要信任審核，不建議 | OSC 約 1 s；啟發式需安靜 5 s → 約 5–6 s |

⇒ 提案驗收「5 秒內回 blocked」對 claude 合理；對 codex 建議改成「OSC ≤ 5 s；啟發式 ≤ 10 s」。

#### R3 本機範圍權杖影響面（子代理 Explore 盤點，檔:行皆在本 repo）

**呼叫者與 channel** [碼]
- `scripts/bat-terminal.mjs:530-531`（env）；選擇 channel 在 `:934`：
  - agent 模式 → `terminal:create-agent-command`
  - **raw command 模式 → `terminal:create-with-command`**（`:935-981`）
  - `--close-worker` → `terminal:close-worker`（`:1088`）
  - `--set-role` → `terminal:set-role`（`:1146`）
- `scripts/bat-notify.mjs:243-244`：`terminal:notify`（`:543`）、`pty:write`（`:582`）、`--submit` 時 `terminal:keypress`（`:637`）。
- 其他 scripts 只檢查變數名稱（`smoke-remote-headless.mjs`、`remote-tools-install-check.mjs`）。`_bat-logger.mjs:39,49` 刻意不記 token。
- repo 內 `.claude/`、`.agents/` 沒有 skill 呼叫 helper；CT skill 在 repo 外。

**env 來源** [碼]
- `electron/pty-manager.ts:312-359` `buildPtyEnv` 在 `:355` 放入 `remoteInfo.token`，來源是 `main.ts:1694-1697` 的 `remoteServer.currentToken`，也就是持久化在 `server-token.json`、與 QR / 行動 client 共用的那一把全權 token。
- `restart`（`:1131-1149`）與 Terminal Server recovery（`:1259-1285`）都會重新 `buildPtyEnv`，所以新權杖會自動帶入。
- **T0108 replay 的 PTY 保留原始 env**：`pty:list` 只回 `{id,pid,cwd}`（`terminal-server/protocol.ts:23`）。

**全權 token 的實際權限比 PLAN-047 寫的更大** [碼]：server-token client 直接 `invokeHandler(frame.channel)`（`remote-server.ts:742`），能呼叫**所有 `registerHandler` channel**，不只 `PROXIED_CHANNELS`。包括 `fs:*`、`settings:save`、`claude:*`、對任意 id 的 `pty:write`、`pty:get-buffer`，而且會收到全部廣播（含每個 PTY 的 `pty:output`）。R4 實測也證實本機分頁的 token 是 32 字元的 server token。

**能力權杖的程式碼本機已具備，只是沒接線** [碼]
- `RemoteServer` 的 capability 路徑（`acceptHelper` / `handleHelperFrame` / `authorizeHelperInvoke`，`remote-server.ts:1005-1137`）是共用程式碼，只在傳入 `helperCapabilities` 選項時啟用（`:98-101`）。
- 本機 `main.ts:438` 是 `new RemoteServer()`，沒有傳任何選項；headless 在 `headless-entry.ts:892-907` 有完整接線。
- `helper-capability.ts` 沒有 electron 依賴，只用 `crypto`，可直接重用。
- 本機需要補的：
  - ① `RemoteServer` 選項：`helperCapabilities` / `isTerminalAlive` / `isKnownAgent` / `getPtyCapacity`
  - ② `createElectronPtyDeps` 加 `helperEnv`（簽發 `batcap.`；有 `customEnv.BAT_TOWER_TERMINAL_ID` → worker，否則 tower），PTY env **不再放 server token**
  - ③ `onPtyExit` → `revokeTerminal`
  - ④ `WorkerCloseScheduler` 加 `isOwnedBy: isWorkerOf`（`main.ts:2180-2186`）
- `buildHeadlessHelperEnv`（`headless-entry.ts:257-296`）只有 `issue()`＋port/token 是通用的；`BAT_HELPER_NODE`、`PATH` 附加、`BAT_SERVER_CERT_PATH` 是 headless 專用。本機的憑證由 `BAT_USER_DATA` 解析（`_bat-cert.mjs:29-31`），沿用即可。

**本機特有的缺口**
1. **raw command 模式會被拒**：`terminal:create-with-command` 不在 `HELPER_CHANNEL_ROLES`。CLAUDE.md 記載本機慣用 `bat-terminal.mjs claude "/ct-exec T####"`。⇒ 二選一：(a) tower 角色允許此 channel，沿用 create-agent-command 的限制（不得指定 `shell`、`customEnv` 白名單、配額）；(b) CT 全面改用 agent 模式。**建議 (a)**：tower 在自己的 shell 本來就能執行任意命令，多開一個 PTY 的額外風險有限，且不必與 CT 同步升級。
2. **BAT 重開但 Terminal Server 存活（T0108）會造成回歸**：權杖只存記憶體（`helper-capability.ts:18-22`），存活 PTY 的 env 仍是舊 `batcap.`，BAT 重開後全部失效。今天因為 server token 有持久化，所以照常可用。⇒ 必須補持久化：只存 digest＋`terminalId`＋`towerId`（不存 token 本身；SHA-256 of 256-bit 不可逆），寫進 userData。replay 完成後，只還原 `pty:list` 中仍存活的 id。這也順帶補齊 replay PTY 的 tower / worker 綁定。
3. **detached 視窗**：權杖綁 PTY 不綁視窗，不受影響（推論）。
4. **BAT 套 BAT（巢狀）**：本機 PTY 不過濾繼承 env（`pty-manager.ts:266-268`）。內層 BAT 的 RemoteServer 啟動失敗時，會把外層的 token 傳下去。⇒ `buildPtyEnv` 應在 `remoteInfo` 為 null 時刪除繼承來的 `BAT_REMOTE_*`。
5. `getPtyCapacity` 在 Electron 回 `max: 0`（無上限），只剩每個 tower 的 8 子 PTY / 1 s 間隔限制。CT 平行派工若超過 8 張會被拒，需要確認上限要不要放寬或可設定。

**相容性**
| 組合 | 結果 |
|---|---|
| 舊 helper + 新 BAT | helper 不分辨 token 種類，`batcap.` 照樣能用（遠端已實證，T0434）；只有 raw command 模式受缺口 1 影響 |
| 新 helper + 舊 BAT | 不變（舊 BAT 給全權 token） |
| 升級當下已存在的 PTY（Terminal Server 跨版本存活） | env 仍是全權 server token。新 BAT 仍須接受 server token（遠端 client / QR 要用），所以舊分頁維持全權直到重開。**不建議輪替 token**（會讓既有遠端 client 失效），改為文件說明 |

**遷移步驟與切分**
- **A1**（M，1 張）：本機接線 ①–④、缺口 1 (a)、缺口 4、單元測試（比照 `headless-*` 測試）＋e2e（隔離實例：分頁 token 為 `batcap.`、tower 可派工 / 回收 / set-role、worker 可 notify、worker 呼叫 `pty:create` 被拒）。
- **A2**（M，1 張，依賴 A1）：缺口 2 持久化與 replay 還原、升級相容說明、e2e（重開 BAT、Terminal Server 存活 → 舊分頁 helper 仍可用）。
- 風險：最大的是 A2 若沒做就先上 A1，BAT 重開後所有塔台 / Worker 的 helper 會失效（`Authentication failed`），CT 的 auto-session 會中斷。⇒ **A1 與 A2 必須同版發佈**。

#### R4 `bat-mcp` stdio shim 原型

**原型**（repo 外暫存，約 200 行、零依賴，已刪除）：stdio NDJSON JSON-RPC 搭配最小 TLS+WebSocket client，沿用 helper 的 fingerprint pinning（`BAT_SERVER_CERT_PATH` / `BAT_USER_DATA/server-cert.json`）與 frame id 比對（BUG-114）。每次 `tools/call` 開一條連線（與 helper 相同模式，不需處理 30 s WS ping）。**dual-era**：同時支援 legacy `initialize` 與 2026-07-28 `server/discover`＋per-request `_meta`。tools 有 `bat_whoami`（env＋`pty:get-cwd`）與 `bat_read_output`（`pty:get-buffer`，只讀自己）。

**實測環境**：clone worktree 的 `npx vite build` → Playwright 隔離實例（`--runtime=e2e-t0574-1792234389951`，RemoteServer port 55116，不是 9876）→ 在該實例的分頁（pwsh）內執行測試 client，env 全部由 BAT 注入。結束後 Terminal Server 已停（`alive after teardown: false`），runtime userData 已刪除（`removed: true`）。

legacy（2025-11-25）實際 JSON [實測]：
```
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"t0574-client","version":"0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"bat-mcp-proto","version":"0.0.1"}}}   (34 ms)
-> {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
<- {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"bat_whoami",…,"annotations":{"readOnlyHint":true,…}},{"name":"bat_read_output",…}]}}   (1 ms)
-> {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"bat_whoami","arguments":{}}}
<- {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"…"}],"structuredContent":{"terminalId":"t0574tab","workspaceId":"ws-t0574","towerTerminalId":null,"ctMode":null,"role":"unknown","cwd":"C:\\Users\\Gower\\AppData\\Local\\Temp\\…\\scratchpad\\r4-ws","tokenKind":"server-token(full)","wire":{"frames":2,"ignoredFrames":0}}}}   (10 ms，含 TLS+auth+invoke)
-> {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"bat_nope","arguments":{}}}
<- {"jsonrpc":"2.0","id":5,"error":{"code":-32602,"message":"Unknown tool: bat_nope"}}
```
modern（2026-07-28）[實測]：
```
-> {"jsonrpc":"2.0","id":"d1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{…},"io.modelcontextprotocol/clientCapabilities":{}}}}
<- {"jsonrpc":"2.0","id":"d1","result":{"resultType":"complete","supportedVersions":["2026-07-28","2025-11-25","2025-06-18","2025-03-26","2024-11-05"],"capabilities":{"tools":{}},"instructions":"…","_meta":{"io.modelcontextprotocol/serverInfo":{"name":"bat-mcp-proto","version":"0.0.1"}}}}
-> tools/call bat_whoami（帶 _meta）→ {"resultType":"complete","content":[…],"structuredContent":{…同上…}}   (8 ms)
-> tools/list（_meta protocolVersion "1900-01-01"）
<- {"error":{"code":-32022,"message":"Unsupported protocol version","data":{"supported":[…],"requested":"1900-01-01"}}}
```
**內嵌 claude 2.1.300 健康檢查**（隔離 `CLAUDE_CONFIG_DIR`，user scope，**沒有送任何 prompt**）[實測]：
```
claude mcp add-json -s user bat '{"type":"stdio","command":"node","args":["…/bat-mcp.mjs","--terminal=${BAT_TERMINAL_ID}"],"env":{"BAT_MCP_EXPANDED":"${BAT_WORKSPACE_ID}"}}'
→ Added stdio MCP server bat to user config
claude mcp list → bat: node …/bat-mcp.mjs --terminal=${BAT_TERMINAL_ID} - ✔ Connected
claude mcp get bat → Status: ✔ Connected / Type: stdio
shim 端記錄：recv server/discover id "server-discover-probe-1" _meta.protocolVersion "2026-07-28" clientInfo {"name":"claude-code","version":"2.1.300"}
            → recv tools/list（帶 _meta 2026-07-28）
            start argv ["--terminal=t0574tab"], expandedEnv "ws-t0574", tokenKind "server-token"
```
⇒ **Claude Code 2.1.300 已經走 modern 協定（先 `server/discover`）**。舊 SDK（只會 `initialize`）做的 server 會經過 fallback；手寫 dual-era 直接走 modern 路徑。
- 附帶發現：`pty:get-buffer` 回傳 `{data: <原始 ANSI>}`，正式實作要用 `plainTextFromOutput`（T0566）轉成文字，並加 cursor 與遮罩。

**零依賴手寫 vs 官方 SDK**
- helper 是以 `extraResources` 散檔部署的，`verify-helper-bundle.js` 只掃相對 `.mjs` import [文件 CLAUDE.md]。SDK 必須另外打包（esbuild 成單檔），或在 resources 放 node_modules。後者要擴充安裝檔瘦身白名單、`asar-runtime-deps` 測試、server bundle 的 `serverBundleHelperScripts` 與 `verify-server-bundle.js`（推論）。
- 規格剛改成無狀態（2026-07-28）。stdio server 的協定面只有 `server/discover` / `tools/list` / `tools/call`（＋legacy `initialize`），原型約 200 行就涵蓋。SDK 對 2026-07-28 的支援版本**未證實**。
- **建議手寫零依賴**：契約測試把官方 `schema.json` 當 devDependency fixture 驗證輸入輸出（推論）；正式版要處理 `resultType`、`ttlMs`/`cacheScope`、`-32022`、`_meta` 的 `traceparent` 透傳到 `bat-scripts.log`。

**遠端 headless（靜態分析）**
- 遠端 PTY 已有 `BAT_HELPER_NODE`、`batcap.` 權杖、`BAT_SERVER_CERT_PATH`（`headless-entry.ts:285-294`）[碼]。shim 用 `"${BAT_HELPER_NODE:-node}"` 執行即可。
- server 端由 `create-agent-command` 組啟動命令，可附 `--mcp-config` 帶絕對路徑。
- 需要：`bat-mcp.mjs` 加入 `serverBundleHelperScripts` / `extraResources.filter`；`HELPER_CHANNEL_ROLES` 加入下列新 channel；helper 連線不收廣播（`remote-server.ts:795-810` 只送 full-token client），所以 `bat_wait` 必須是 server 端長輪詢 channel，不能訂閱事件。

**建議新增的唯讀 channel**（`registerHandler`，本機與 headless 共用，列入 `HELPER_CHANNEL_ROLES`）
| channel | MCP tool | 資料來源 [碼] | tower | worker |
|---|---|---|---|---|
| `terminal:whoami` | `bat_whoami` | capability 綁定＋`PtyInstance.workorder`＋`isYoloTerminal`＋`getTerminalRole` | ✅ | ✅ |
| `terminal:list` | `bat_list_terminals` | PtyManager instances＋window registry 標題（headless 無標題） | 自己工作區＋自己的 Worker | 自己＋綁定的 tower |
| `terminal:get-state` | `bat_get_state` | `getLastOutputAt`（`pty-manager.ts:773`）、exit、hook 回報 | 自己的 Worker | 自己 |
| `terminal:read-output` | `bat_read_output` | `getReplayBuffer`（`:655`）→ `plainTextFromOutput`＋cursor＋遮罩 | 自己的 Worker | 自己 |
| `terminal:wait` | `bat_wait`（state_change / exit） | 同上，server 端最多等 45 s | 自己的 Worker | 自己 |
| `worktree:terminal-status` | `bat_worktree_status` | git rev-list / merge-tree / diff（見 R5） | 自己的 Worker | 自己 |
| `terminal:report-hook`（寫入，僅限自己） | —（hook helper `bat-hook.mjs` 用） | 寫入 blocked / idle 狀態 | — | 只寫自己 |

- 一般分頁（shell）在本機會被判定為 tower 角色（沒有 towerId）。提案的 `shell` 角色需要第三種判定（例如沒有 `set-role` 也沒有 towerId → 只能查自己），見 Q3。

#### R5 worktree 與合併工單實測（Windows 11，git 2.56.0.windows.2，node 24.22.0，npm 12.2.0）

| 項目 | 數值 [實測] |
|---|---|
| `git clone --local`（C: ↔ D: 跨磁碟） | ❌ `fatal: failed to create link … Improper link`（不能跨磁碟硬連結）→ 改 `--no-hardlinks` 1 s，`.git` 214 MiB |
| 暫存路徑（基底 169 字元）＋無 `core.longpaths` | ❌ `Filename too long`（commit-graph 檔）→ 加 `-c core.longpaths=true` 才成功 |
| `git worktree add` | 0–1 s；checkout 36 MiB（`.git` 共用） |
| `npm ci`（npm cache 熱） | 15–16 s；**node_modules 2079 MiB／每個 worktree** |
| `npm ci`（全新 `--cache`，electron 下載 cache 仍熱） | 16 s；下載 578 MiB |
| `node scripts/verify-native-modules.js` | ✅ 內嵌 claude native、whisper binary 都在 |
| `npm run test:unit` | ✅ 266 檔 / 4642 passed / 6 skipped，60 s；跑完 `git status` 乾淨（測試不寫入追蹤檔） |
| `npx vite build` | ✅ 6–8 s |
| e2e 隔離實例從 worktree build 啟動 | ✅（R4 就是這樣跑的） |
| 提案位置 `<repo 上層>\.bat-worktrees\better-agent-terminal\T0574\` | 102 字元＋最長相對路徑 119（`node_modules/@testing-library/…/accessible-name-and-description.d.ts.map`）= 221 < 260 ✅ |

**CT_HOME 方案**
- **(b) sparse-checkout 排除 `_ct-workorders/`** [實測]：`git sparse-checkout set --no-cone '/*' '!/_ct-workorders/'` 後 `test:unit` → **5 failed**（`parser-parity.test.ts` 的 T0335 / T0336 / T0337 / BUG-081 / PLAN-033 樣本找不到），其餘 4640 passed。要改測試（樣本搬進 `src/types/__tests__/fixtures/`），而且合併工單的整合 worktree 一樣要跑完整測試 → **不建議作為主方案**。
- **(a) env `CT_HOME` 指向主 checkout，worktree 內副本唯讀不提交**：測試照常通過（副本在，60 s 全綠）。風險有兩個：
  - ① Worker 不小心提交副本。對策：ct-exec 在 worktree 中拒絕 stage `_ct-workorders/`，BAT 的 `out_of_scope_files` 也會標出。
  - ② Worker 在主 checkout 提交工單檔會推進 main，正在進行的合併工單 ff-only 就會被拒（見合併案例 4）。對策：合併工單規則「main 若只在 `_ct-workorders/**` 前進 → 在整合分支再 `git merge main` 後 ff，不重跑驗收」（產品樹相同，推論）。
- **(c) 更好的組合（建議）**：**(a)＋把 parser-parity 樣本改成 fixture 複本**（一張小工單）。這樣產品測試不再依賴 `_ct-workorders/`，日後要改走 (b) 或把工單移出 repo 都不會受測試牽制，也一併解除 L133 的歸檔限制。
- ct-exec 需要的改動（CT 端）：
  - 讀寫與 commit 工單一律走 `$CT_HOME/_ct-workorders/`：`git -C "$CT_HOME" commit --only …`
  - 在 worktree（`git rev-parse --git-common-dir` ≠ `--git-dir`）中禁止 stage `_ct-workorders/`
  - 回報區記 `base_sha` / `head_sha` / `validated_sha`
  - 落點檢查 C-0 在 worktree 仍然成立：worktree 的 `basename(toplevel)` 是 `T####`，不是 repo 名稱 → **C-0 必須改用 `basename(dirname(git-common-dir))` 或 `CT_HOME`**，否則每張 worktree 工單都會 `WRONG_REPO_CONFIRMED`

**合併工單流程演練**（臨時 repo 夾具；整合 worktree 長期保留；main checkout 為塔台的工作樹）[實測]
| 情況 | main@派工 | ff 前 main | 結束後 main | 結果 |
|---|---|---|---|---|
| 1 無衝突 | d2da29d | d2da29d | 6ec0fa4 | 驗收 pass；`--no-ff` 合併 commit 6ec0fa4；`--ff-only` 成功 |
| 2 文字衝突 | 3fe7b42 | 3fe7b42 | 23373ef | `CONFLICT (content): Merge conflict in a.txt`；衝突期間 main 仍是 3fe7b42；解衝突＋驗收 pass → ff 成功 |
| 3 驗收失敗 | 23373ef | 23373ef | 23373ef | 驗收 fail → 不 ff，丟棄 `merge/T4`；**main 不變** |
| 4 合併期間 main 被前進 | 23373ef | ae5f775 | ae5f775 | 合併 commit 的 parent1 = 23373ef ≠ main；`fatal: Not possible to fast-forward, aborting.`；**main 不變** |
| 4b main checkout 有髒檔重疊 | ae5f775 | ae5f775 | ae5f775 → a6ffe8d | `error: The following untracked working tree files would be overwritten by merge:` → ff 被拒；清掉後 ff 成功 |

- ⇒ 「通過前 main 不變」由 `--ff-only` 機械保證，四種情況都成立。
- 4b 對本專案有實際意義：塔台 main checkout 常有未提交檔（例如本次 `src/styles/settings.css`），ff 只在與合併檔案重疊時才會被拒。
- **塔台收單需比對的 SHA**：
  - ① `base_sha`：派工時的 main，寫進工單 frontmatter
  - ② `head_sha`：Worker 工單分支 head＝驗收時的 SHA
  - ③ 合併 commit 的 parent1 必須等於 ff 前的 main，parent2 必須等於 ②
  - ④ ff 後 main 必須等於合併 commit
  - ⑤ 若 main 在合併期間前進：`git diff --name-only <parent1>..main` 只有 `_ct-workorders/**` → 可再 merge main 後 ff；否則 Renew 重做

**BAT 唯讀信號成本**（在本 repo clone 上：2095 commits、pack 195.5 MiB；分支自 HEAD~20 / ~100 / ~400 分出）[實測]
- `git merge-tree --write-tree --name-only --no-messages main <branch>`：**50–53 ms**；exit 0 = 乾淨、1 = 有衝突，並列出衝突檔（夾具中 `a.txt` exit=1 已驗證）。跑完 main 工作樹 `git status` 為空（不動工作樹）。
- `git rev-list --left-right --count main...<branch>`（behind / ahead）：51–58 ms。
- `git diff --name-only main...<branch>`（實際變更）：56–85 ms；與 `affects_files` 比對是純字串 glob，成本可忽略。
- ⇒ 每個 Worker 一次狀態查詢約 0.2 s，可以隨需計算並快取到 HEAD 改變為止。git 2.56 支援 `merge-tree --write-tree`（2.38 起提供）。

**小型無衝突合併由塔台直接做的判準（建議）**——全部成立才可直接做：
1. 工單分支 `behind = 0`（base 就是目前的 main，或 main 只在 `_ct-workorders/**` 前進），因此合併後的樹＝Worker 已驗收的樹
2. Worker 回報的 `validated_sha` = 目前的分支 head
3. 實際變更 ⊆ `affects_files`，且不含 `_ct-workorders/`
4. `merge-tree` 乾淨
5. main checkout 沒有與變更重疊的髒檔

做法：`--no-ff` 與 `--ff-only` 不能同時用，所以二選一：在整合 worktree 做 `--no-ff` 合併，再對 main `--ff-only`（保留合併 commit，與 Q9 一致）；或接受線性歷史，直接 `git merge --ff-only <branch>`。任一條不成立就派合併工單。（推論，依據案例 1–4 的機械保證）

#### R6 綜合 → 見下方「建議方向」與「建議下一步」

**修正後階段表**（取代 PLAN-047 §四）
| 階段 | 內容 | 估計 | 依賴 |
|---|---|---|---|
| R | 本單 | 完成 | — |
| A1 | 本機範圍權杖接線＋raw command 政策＋巢狀 env 清除 | 1 張 M | — |
| A2 | 能力權杖跨 BAT 重開持久化（T0108 replay）＋升級相容 | 1 張 M | A1；**與 A1 同版發佈** |
| M1 | `bat-mcp.mjs`（手寫 dual-era）＋唯讀 channel（whoami / list / get_state 不含 blocked / read_output / wait）＋注入（claude `--mcp-config`、codex `-c`，含 `tool_timeout_sec`）＋稽核＋headless 對等 | 2 張 | A1（A2 可並行） |
| M1b | blocked：claude hooks（`--settings` 附加 PermissionRequest / PreToolUse AskUserQuestion / Notification elicitation / Stop）＋`terminal:report-hook`；codex OSC 9 approval-requested＋啟發式後援 | 1–2 張 | M1 |
| T | parser-parity 樣本改 fixture（解除測試對 `_ct-workorders/` 的依賴） | 1 張 S | — |
| W1 | worktree 隔離派工（`--isolation worktree`、repo 外位置、分支 `ct/T####`、worktree 池與 lock hash 未變時跳過 `npm ci`、`CT_HOME` 注入）＋`--close-worker` keep / remove / archive＋唯讀 `worktree:terminal-status` | 2 張＋CT-T014 | T；status 的 MCP 曝露需 M1 |
| W-merge | 合併工單模板＋收單 SHA 比對＋直接合併判準（純 CT） | CT-T015 | W1 |
| M2 | 訊息 / artifact / 跨 workspace 白名單 | 3 張＋CT-T | M1 |
| M3 | 控制類（MCP dispatch、send_input＋UI 閘門、close） | 1–2 張＋CT-T | M2、A1/A2 |

**提案 §16 Q1–Q14 建議答案**
- **Q1** 沿用既有 WSS，用 stdio shim 連過去。依據：兩邊 client 都支援 stdio；Claude 的 stdio 沒有 60 s 截斷；Claude 2.1.300 實測已連上（R1-4 / R4）。
- **Q2** 不需要 daemon 分離；前置條件改為 A1+A2。依據：capability 程式碼已在共用的 RemoteServer，只差接線（R3）。
- **Q3** `shell` 角色只能查自己（whoami / 自己的 get_state）。依據：本機一般分頁目前沒有 towerId 會被當成 tower，需要新增判定（R4 表後註）。
- **Q4** 記憶體＋userData 下有上限的目錄（例如 64 MiB／工作區、TTL 24 h），BAT 重開不保留。依據：與權杖生命週期一致（推論）。
- **Q5** 預設遮罩：`batcap.` 權杖、`sk-` / `ghp_` / `AKIA` 這類 token 樣式、`Authorization:` header 值、PEM 區塊；專案可在設定檔追加（推論）。
- **Q6** stdio shim 只連 127.0.0.1 的既有 TLS 埠，不新增 loopback HTTP，所以沒有新的防護軟體相容風險；named pipe 不需要（推論）。
- **Q7** 狀態偵測與 shim 的通用部分可回饋上游；CT 專屬的 worktree / CT_HOME / 合併規則留在本 fork（推論；上游是否接受未知）。
- **Q8** 斷點 D：claude hook 來源 blocked ≥ 60 s、codex 啟發式 ≥ 120 s 才觸發；`experience-level` 低時減半（推論）。
- **Q9** `--no-ff`，合併 commit 訊息含工單 ID；工單可以覆寫成 squash；不採 rebase（會改寫 Worker 已驗收的 SHA）。依據：R5 案例 1–4。
- **Q10** 專用整合 worktree（長期保留，避免每次 `npm ci`）；main 只做 `--ff-only`。依據：R5 案例 4b（main checkout 的髒檔不影響合併過程）。
- **Q11** 沿用一般工單＋固定模板（`kind: merge`、`merges: [T####]`），不新增單據類型。依據：PLAN-047 §三之一。
- **Q12** 預設不隔離；只有「可能與他人並行改同區」或 EXP 時才用 worktree。依據：每個 worktree 2.1 GB＋npm ci 約 16 s；池化重用可降到秒級（R5）。
- **Q13** worktree 池＋lock hash 未變時跳過 `npm ci`；e2e 已有 `freePort()` 隔離（`e2e/fixtures/electron-isolation.ts`）不用處理；npm cache 共用（R5、[碼]）。
- **Q14** 本 repo 沒有受保護的 main，直接 ff；金融客戶專案改為「合併工單只推進整合分支，整合分支 → main 走 PR」，由工單 frontmatter `merge_target` 指定（推論）。

**PLAN-047 §五 待決議題的建議答案**
- 做到哪一階段：R → A1+A2 → M1 → M1b，W1 與 T 可並行；M2 / M3 等 M1 用過一段時間再決定。
- Q1 / Q2：同上。
- 遠端同步：要。headless 已有權杖與 `BAT_HELPER_NODE`，handler 共用。
- worktree 軌道與 MCP 分開立案：要（W1 不依賴 MCP）。
- 合併執行者：合併工單（R5 證實 ff-only 能機械保證 main 不變）。
- 小型合併由塔台直接做：可以，依上述 5 條判準。

**CT 端（CT-T014 起）需要配合的變更與介面契約要點**
1. `CT_HOME`：BAT 對 `--isolation worktree` 派出的 Worker 注入 `CT_HOME=<主 checkout 絕對路徑>`；ct-exec 的讀寫與 commit 一律用 `$CT_HOME/_ct-workorders/`。
2. **落點檢查 C-0 在 worktree 的修正**：repo identity 改取 `basename(dirname(realpath(git rev-parse --git-common-dir)))`，或比對 `CT_HOME`。
3. ct-exec 在 worktree 中拒絕 stage `_ct-workorders/`；回報 `base_sha` / `head_sha` / `validated_sha`。
4. helper 契約（BAT 定、CT 依約撰寫，比照 CT-T011 / T013）：
   - `bat-terminal.mjs --isolation worktree`，stdout 多印 `worktree:` / `branch:` / `base:`
   - `--close-worker … --worktree keep|remove|archive`
   - 新的 exit code：worktree 建立失敗另給一碼
5. MCP 降級鏈：MCP → helper CLI → 檔案；tool 錯誤碼沿用 `NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS`。
6. 合併工單模板（`kind: merge`、`merges`、`integration_worktree`）＋收單 SHA 比對五步＋直接合併判準；斷點 E（非 yolo 合併前確認）。
7. 斷點 D 使用 `bat_get_state`；尚無 MCP 時用 helper `--get-state`（可選，M1 一併提供）。

### 建議方向
- **[A] 依修正版推進（權杖 → shim → blocked，worktree 並行，合併走工單）**：A1+A2 同版 → M1（stdio shim＋唯讀）→ M1b；T＋W1＋CT-T014 / T015 並行。先關掉今天就存在的本機全權 token 越權面，MCP 建在它上面。
- **[B] 照提案原樣（Streamable HTTP＋bat-daemon 分離＋BAT 合併引擎）**：多一個埠與 Origin 防護、兩邊 client 都有 60 s 限制、要先做大型架構搬遷、BAT 要新增 git 寫入能力。R1 證實技術可行，但成本與風險都高於 [A]，價值沒有多出來。
- **[C] 最小化：只做 A1+A2 與 W1 / 合併工單，暫不做 MCP**：helper CLI 補 `--get-state` / `--read-output`，CT 用 CLI 輪詢。成本最低，但 agent 仍要解析 CLI 文字，而且沒有 `bat_wait`。
- **推薦：[A]**。理由：
  - 本機範圍權杖本來就該做（R3：全權 token 可呼叫所有 handler，包括 `fs:*` / `settings:save`）
  - stdio shim 已實測可行，Claude 端零設定檔改動（`--mcp-config`）
  - 合併工單由 `--ff-only` 機械保證 main 不變，BAT 不需要新增寫入能力

### 待塔台 / 使用者決定
1. A1 的 raw command 模式：**建議 tower 角色允許 `terminal:create-with-command`（加上限制）**，或要求 CT 全面改用 agent 模式。
2. 每個 tower 同時存活 8 個子 PTY 的上限（`HELPER_TOWER_MAX_LIVE_CHILDREN`）本機要不要放寬或可設定。
3. 升級當下仍存活的舊分頁維持全權 token 到重開為止（**建議接受，不輪替 token**）。
4. blocked 新增 `source: "osc"`（codex OSC 9）：要不要納入提案的 `hook | heuristic` 列舉。
5. codex blocked 的驗收標準改為「OSC ≤ 5 s；啟發式 ≤ 10 s」。
6. 是否先開 T（parser-parity 樣本改 fixture）來解除 `_ct-workorders/` 對產品測試的牽制（同時解除 L133 的歸檔限制）。
7. CT yolo Worker 的 claude 是否以略過權限的模式執行（會影響 M1b 以 PermissionRequest 還是 AskUserQuestion 為主）。
8. 直接合併判準第 1 條要允許「main 只在 `_ct-workorders/**` 前進」，還是嚴格要求 `behind = 0`。

### 建議下一步
- [ ] 開實作工單 **A1**（本機範圍權杖接線，M）與 **A2**（跨 BAT 重開持久化，M），同版發佈
- [ ] 開實作工單 **T**（parser-parity 樣本改 fixture，S）
- [ ] 開實作工單 **M1**（`bat-mcp.mjs` dual-era 手寫＋唯讀 channel＋注入＋headless 對等，2 張），依賴 A1
- [ ] 開 **CT-T014**（CT_HOME / C-0 worktree 修正 / SHA 回報）與 **CT-T015**（合併工單模板＋收單 SHA 比對＋直接合併判準），等 BAT W1 介面契約定稿
- [ ] M1b（blocked）在 M1 之後；開單前先確認待決事項 7
- [ ] 不需要 Renew

### Renew 歷程
無

### 遭遇問題
1. **🔴 違反 memory_override（已自行復原）**：18:45 第一版 R5 腳本的 `git clone --local` 因 C: ↔ D: 跨磁碟無法硬連結而失敗（`Improper link`）。腳本沒有 `set -e`，而 Bash 工具的 cwd 停在主 repo，後續的 `git worktree add <scratchpad>/wt/T9999 -b ct/T9999` 因此**在本 repo 上執行**：建立了 worktree 登記＋分支 `ct/T9999`（指向 c7f12934，沒有新 commit）。worktree 目錄本身在 repo 外的 scratchpad，`npm ci` / test / build 也在那裡跑。約 2.5 分鐘後發現，立即執行 `git worktree remove --force` 與 `git branch -D ct/T9999`。之後確認：`.git/worktrees` 不存在、沒有 `ct/*` 分支、main reflog 只有塔台原本的三筆 commit、main HEAD 與工作樹未變（只剩原本的 `src/styles/settings.css` M 與本工單）。該次量測（`npm ci` 16 s / 2079 MiB、test:unit 60 s 全綠、build 8 s）內容與之後在正確 clone 上重測的結果一致，都列在 R5。重做時改用 `--no-hardlinks`＋`core.longpaths`＋`set -e`＋toplevel / common-dir 斷言。**建議塔台日後的 worktree 實驗工單補一句「腳本必須 `set -e` 並斷言 `git rev-parse --git-common-dir`」**。
2. Codex 的 MCP 握手沒有實測：`codex mcp list` 不連線，要真正連線必須開 Codex session（違反「不耗額度」）。改以設定解析（`-c` 注入實測）＋二進位字串佐證。
3. Codex 的 `PermissionRequest` hook 與 OSC 9 `approval-requested` 都沒有實際觸發（觸發需要 agent 執行指令），只有文件與二進位字串證據。

### 暫存清理
全部在 scratchpad（repo 外），已刪除並確認目錄為空：`clone/`（250 MiB）、`wt/`（T9999 / T9998 兩個 worktree 含 node_modules，4244 MiB）、`fx/`（合併夾具）、`npmcache-cold/`（578 MiB）、`codex-home/`、`proto/`（bat-mcp.mjs / client.mjs）、`r4-out/`（含隔離 `CLAUDE_CONFIG_DIR`）、`r4-ws/`、`scripts/`、各 log。隔離 BAT 實例的 runtime userData 已由 fixture 刪除（`%APPDATA%` 下 `runtime-e2e-t0574*` 為 0 筆），Terminal Server 已結束；沒有殘留行程。主 repo 誤建的 worktree / 分支已移除（見遭遇問題 1）。使用者的 BAT（9876）、`~/.claude.json`、`~/.codex/config.toml` 都沒有碰過。

### Commit
只 commit 本工單檔：`git commit --only _ct-workorders/T0574-research-bat-mcp-and-worktree-merge.md`（hash 見 git log；不 push）。

### 回報時間
2026-10-17T19:00:19+08:00
