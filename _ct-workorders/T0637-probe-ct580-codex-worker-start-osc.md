---
schema_version: 1
schema_kind: workorder
id: T0637
title: "探針：CT-T020 實機驗收 —— codex Worker 在 BAT 0.7.0-pre.9 上的啟動確認（OSC 7501 → `started:`）與 `blockedDetection: osc`"
type: verification
status: DONE
started_at: "2026-10-18T15:34:49+08:00"
updated_at: "2026-10-18T15:35:10+08:00"
completed_at: "2026-10-18T15:35:10+08:00"
repo: better-agent-terminal
project: CT-T020 實機驗收（BMad-Guide 請 BAT 代跑）
priority: P2
sizing: S
created_at: "2026-10-18T15:32:42+0800"
depends_on: []
related:
  - "CT-T020（CT v5.8.0 接 codex OSC 7501；§ 驗收建議）；T0621（BAT 端 OSC 7501 / `--wait-started` 對 codex 生效）；T0629（上一張 codex 探針，L165 codex 時間戳）"
affects_files:
  - _ct-workorders/T0637-probe-ct580-codex-worker-start-osc.md
renew_count: 0
workdir: main repo
worker_question_timeout: 15
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單由 **codex** Worker 執行（塔台以 `--agent codex` 派工）。受測對象是 BAT 對 codex 分頁的啟動確認與狀態查詢，不是產品程式碼。"
  - "🔴 **所有時間戳一律用指令取得系統時間後代入**（PowerShell `Get-Date -Format \"yyyy-MM-ddTHH:mm:ssK\"`，或 bash `date \"+%Y-%m-%dT%H:%M:%S%z\"`），不得自行推估或改寫已寫下的時間（L165：上一張 codex 探針的提問時間比 commit 晚約 4.5 分鐘，事後又被改過）。frontmatter 的 `started_at` / `completed_at` / `updated_at` 同樣適用。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。另一張工單 T0638（網站）可能同時在改 `site/**`，不碰。不 push。commit 只含本檔（`git commit --only <本檔>`）。"
  - "🔴 回報區不得出現任何權杖值；`BAT_REMOTE_TOKEN` 只寫「已設定 / 未設定」與是否以 `batcap.` 開頭。"
---

# T0637 — 探針：codex Worker 啟動確認與 `osc` 偵測

## 背景

BAT `0.7.0-pre.9`（T0621）起，codex `>= 0.163.0` 的 Worker 會送 OSC 7501 狀態序列，BAT 以第一個序列當作「Worker 已啟動」，塔台派工帶 `--wait-started 30000` 時可拿到 `started: <時間>`；狀態查詢的 `blockedDetection` 為 `osc`。CT v5.8.0（CT-T020）已依此改寫規則，本單由 BAT 塔台代跑實機驗收。

塔台這一側會記錄：派工 helper 的 exit code 與 `started:` 行、你執行期間的 `bat_get_state`（期望 `blockedDetection: osc`、`agentStarted: true`）。你這一側只需要提供分頁內的觀察。

## Step 1 — 環境紀錄

1. 以指令取得目前時間，記為「開工時間」。
2. `codex --version` 的輸出；PowerShell `Get-Command codex -All` 列出的路徑順序（只列路徑，不列內容）。
3. 環境變數（只記是否存在或值的形式，不記權杖）：`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`CT_MODE`、`BAT_REMOTE_TOKEN`（已設定 / 是否 `batcap.` 開頭）。
4. 呼叫 BAT MCP tool `bat_whoami`（不帶參數），把回傳的 `role`、`agent`、`yolo`、`towerMode`、`workorder`、`towerTerminalId` 照抄進回報區。MCP tool 不可用 → 記下原因（錯誤訊息第一行），繼續 Step 2。
5. 呼叫 `bat_get_state`（不帶參數，查自己），照抄 `state`、`blockedDetection`、`agentStarted`、`agentStartedAt`（若有）。

## Step 2 — 收尾

照 ct-exec 收尾：回報區填寫上述紀錄、`### 驗收證據`、commit（只含本檔），完成後送 `T0637 完成`（yolo `--submit`）。完成時間同樣以指令取得。

## 驗收條件

- Step 1 各項都有紀錄（不可用的項目寫明原因）
- `bat_whoami` 的 `role` = `worker`、`agent` 為 codex 的 preset
- `bat_get_state` 的 `blockedDetection` = `osc`、`agentStarted` = `true`（若不是，照實記錄，不要重試或改寫）
- 回報區所有時間戳都來自系統指令；無權杖值；commit 只含本檔

---

## 塔台驗收紀錄（塔台填寫，Worker 不改）

### A. 派工啟動確認

- **PASS**。2026-10-18 15:34:07（系統時間）派工：`bat-terminal.mjs … --mode yolo --no-interactive --agent codex --skill ct-exec --workorder T0637 --wait-started 30000`（BAT 安裝版 FileVersion `0.7.0-pre.9`，塔台 CT v5.8.1）。
- helper exit `0`；stdout `agent: codex-cli (--agent codex: from --agent)`、`started: 2026-10-18T07:34:07.163Z`；stderr 無 `wait-started:` 診斷行。對照 pre.8 的 T0629 是 `started: unknown`。
- 本機 codex `0.163.0`，PATH 第一個是 `…\OpenAI\Codex\bin\codex.exe`（原生 exe，不是 npm shim）。
- 同時派出的 claude Worker T0638：`started: 2026-10-18T07:33:57.906Z`（對照組）。

### B. 執行中狀態

- **PASS**。派工後立即 `bat_get_state`（T0637 分頁）：`state: working`、`blockedDetection: osc`、`agentStarted: true`、`agentStartedAt: 1792308847163`（= 07:34:07.163Z，與 helper `started:` 相同）、`pendingQuestions: 0`。
- `bat_list_terminals scope=mine`：分頁標題 `Codex CLI · Worker · T0637`、`role: worker`、`blockedDetection: osc`、`agentStarted: true`。
- Worker 端 `bat_get_state` 自查結果相同（見回報區）。
- 觀察（非 CT-T020 範圍）：`bat_whoami` 沒有 `agent` 欄位 → 塔台查證為 BAT 端問題：helper 派工的 `ptyManager.create`（`electron/terminal-command-handlers.ts`）沒有傳 `agentPreset`，所有 helper 派出的 Worker 都缺這個欄位；另開 BUG-155。`towerMode` 只有塔台分頁才有，Worker 沒有屬預期。
- L165 對照：Worker 的 `started_at` 15:34:49、`completed_at` 15:35:10，commit `dc5622fb` 15:35:16，時間戳與系統一致。

### C. blocked / input（使用者協助，選做）

- **PASS（非 Worker 分頁觸發）**。Worker 分頁的 codex 帶 `--yolo`（codex-cli 自訂參數），核准被略過，因此改由使用者在同工作區的一般 PowerShell 分頁（標題「New Terminal」，`role: shell`）手動執行 `codex -a on-request -s read-only`（codex `0.163.0`；`-a untrusted` 在 0.163.0 已不存在，只接受 `on-request` / `never`），要求「在目前目錄建立檔案 approval-probe.txt」→ 出現「Would you like to run the following command?」核准提示（使用者截圖，約 15:53）。
- 塔台 `bat_list_terminals scope=workspace`（提示顯示中）：`state: blocked`、`blockedReason: input`、`blockedDetection: osc`、`agentStarted: true`。手動分頁不是派工分頁，`osc` 來自 BAT 觀察到輸出中的 OSC 7501（觀察式，`none` → `osc`）。
- 塔台依 CT v5.8.1 斷點 D：只以分頁標題告知使用者「『New Terminal』分頁的 codex 正在等你回應核准提示」，不代答、不送按鍵。
- 使用者選拒絕 → 15:54:28 `bat_list_terminals`：同分頁 `state: working`、無 `blockedReason`、`blockedDetection: osc`（清除 PASS）；repo 內沒有 `approval-probe.txt`。
- 範圍限制：tower 對非自己 Worker 的分頁只有 `list scope=workspace` 的 metadata（`authorizeHelperQueryTarget`），所以本項用 `bat_list_terminals`，不是 `bat_get_state`；欄位值域相同。

---

## 回報區

### 執行摘要

- 狀態：DONE；實機探針已完成。工單原狀態為 `TODO`，本次依流程開始執行。
- 落點檢查：PASS。`repo` 預期值 `better-agent-terminal` = 實際 repo basename `better-agent-terminal`；`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。C-1 工單位於 repo 內；C-3 指定工單路徑存在。`CT_HOME` 未設定；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- 開工時間：2026-10-18T15:34:49+08:00

### 互動紀錄

- [2026-10-18T15:35:10+08:00] 執行 T0637；未向塔台提問，依工單直接完成探針。

### 環境紀錄

- `codex --version`：`codex-cli 0.163.0`
- `Get-Command codex -All` 路徑（依序）：
  1. `<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`
  2. `<使用者資料夾>\AppData\Roaming\npm\codex.ps1`
  3. `<使用者資料夾>\AppData\Roaming\npm\codex.cmd`
  4. `<使用者資料夾>\AppData\Roaming\npm\codex`
- 環境變數：`BAT_SESSION=1`；`BAT_TERMINAL_ID` 已設定；`BAT_TOWER_TERMINAL_ID` 已設定；`BAT_WORKSPACE_ID` 已設定；`CT_MODE=yolo`；`BAT_REMOTE_TOKEN` 已設定、以 `batcap.` 開頭（未記錄權杖值）。
- `bat_whoami`：`role=worker`；`agent` 欄位未提供（回傳只有 terminalId、workspaceId、role、towerTerminalId、workorder、yolo、cwd；派工工單指定 codex preset）；`yolo=true`；`towerMode` 欄位未提供；`workorder=T0637`；`towerTerminalId=d64be77a-fa33-4391-b92c-70069ddfd207`。

### 驗收證據

- `bat_get_state`（本分頁）：`state=working`；`blockedDetection=osc`；`agentStarted=true`；`agentStartedAt=1792308847163`（Unix epoch milliseconds，照 MCP 回傳）。
- codex 版本符合 `>= 0.163.0`；BAT MCP 顯示 OSC 偵測且已確認 agent 啟動。`bat_whoami` 未提供 `agent` / `towerMode` 欄位，已如實記錄；codex preset 由派工工單指定。
- 狀態探測沒有重試或改寫結果。Helper `started:` / exit code 與塔台側執行中快照由塔台記錄。

### 檔案與提交

- 僅修改本工單檔；產品程式碼未讀取、未修改，未執行 build / test。
- 提交：依工單要求僅提交本工單檔，commit message 含 T0637。
- 偏差 / 後續：MCP `bat_whoami` 未提供 `agent`、`towerMode`；塔台可在其派工驗收紀錄補充 helper `started:` 輸出。
