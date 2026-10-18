---
schema_version: 1
schema_kind: workorder
id: T0648
title: "探針：codex 共用 app-server daemon 下，BAT 分頁的 `BAT_TERMINAL_ID` / 權杖 / BAT MCP 會不會取到別的分頁的值（唯讀）"
type: research
status: TODO
repo: better-agent-terminal
project: PLAN-051
priority: P2
sizing: S
created_at: "2026-10-18T18:23:28+0800"
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

（Worker 填寫）
