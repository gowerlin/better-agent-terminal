---
schema_version: 1
schema_kind: workorder
id: T0637
title: "探針：CT-T020 實機驗收 —— codex Worker 在 BAT 0.7.0-pre.9 上的啟動確認（OSC 7501 → `started:`）與 `blockedDetection: osc`"
type: verification
status: TODO
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

（派工後填寫：helper exit code、`started:` 行、stderr 診斷行）

### B. 執行中狀態

（塔台 `bat_get_state` 結果）

### C. blocked / input（使用者協助，選做）

（手動 codex 分頁觸發核准提示 → 塔台 `bat_list_terminals scope=workspace` 的 `state` / `blockedReason` / `blockedDetection`）

---

## 回報區

（Worker 填寫）
