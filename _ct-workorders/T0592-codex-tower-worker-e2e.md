---
schema_version: 1
schema_kind: workorder
id: T0592
title: "D153 A 層：codex CLI × Tower / Worker 整合 e2e（真 codex `app-server` 連真 BAT，不呼叫模型）"
type: test
status: PENDING
started_at: null
updated_at: "2026-10-18T01:08:55+0800"
completed_at: null
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
