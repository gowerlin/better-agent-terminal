---
schema_version: 1
schema_kind: workorder
id: T0645
title: "探針：PLAN-050 / BUG-155 / CT-T021 實機驗收 —— claude Worker 的 session 名稱、`claudeSessionId` 與 `agent`（BAT 0.7.1-pre.1 × CT v5.9.0）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-050 實機驗收 + CT-T021 § 5 情境 2（BMad-Guide 請 BAT 代跑）
priority: P2
sizing: S
created_at: "2026-10-18T17:57:55+0800"
depends_on: []
related:
  - "PLAN-050（T0641 `--name`、T0642 `claudeSessionName` / `claudeSessionId`、T0643 `scope: towers`）；BUG-155（T0639 helper 派工補 `agentPreset`）；CT-T021（BMad-Guide 回覆稿 `_reply-2026-10-18-ct-v590-session-identity.md` § 5）"
affects_files:
  - _ct-workorders/T0645-probe-plan050-claude-worker-identity.md
renew_count: 0
workdir: main repo
worker_question_timeout: 15
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 受測對象是 BAT 對 claude Worker 分頁注入的 session 名稱與狀態查詢欄位，不是產品程式碼。"
  - "🔴 所有時間戳一律用指令取得系統時間後代入（PowerShell `Get-Date -Format \"yyyy-MM-ddTHH:mm:ssK\"` 或 bash `date \"+%Y-%m-%dT%H:%M:%S%z\"`），frontmatter 的 `started_at` / `completed_at` / `updated_at` 同樣適用。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 只含本檔（`git commit --only <本檔>`）。"
  - "🔴 回報區不得出現任何權杖值；`BAT_REMOTE_TOKEN` 只寫「已設定 / 未設定」與是否以 `batcap.` 開頭。`claudeSessionId` 可照抄（不是權杖）。"
---

# T0645 — 探針：claude Worker 的 session 識別

## 背景

BAT `0.7.1-pre.1`（PLAN-050）起，helper 派工的 claude Worker 啟動時帶 `claude --name=<工作區> · Worker · <T####>`，`SessionStart` hook 回報 session UUID；BAT MCP `bat_whoami` / `bat_get_state` 回 `claudeSessionName` / `claudeSessionId`，BUG-155 修正後 `bat_whoami` 也有 `agent`。CT v5.9.0（CT-T021）依此判斷跨 session 收件人：名稱含 ` · Worker · T####` 的 session 一律不當塔台。

塔台這一側記錄：派工 helper 的 exit code 與 `started:` 行、ListAgents 看到的名稱、塔台查你分頁的 `bat_get_state`。你這一側只需要提供分頁內的觀察。

## Step 1 — 環境紀錄

1. 以指令取得目前時間，記為「開工時間」。
2. 環境變數（只記是否存在或值的形式，不記權杖）：`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`CT_MODE`、`BAT_REMOTE_TOKEN`（已設定 / 是否 `batcap.` 開頭）。
3. 你目前載入的 ct-exec skill 版本（skill 檔開頭的 `control-tower-version` 註解或 frontmatter；讀不到就寫「未知」）。
4. 呼叫 BAT MCP `bat_whoami`（不帶參數），把回傳 JSON 的**所有鍵與值**照抄進回報區（權杖類值除外，實際上不應出現）。MCP 不可用 → 記下錯誤訊息第一行，繼續。
5. 呼叫 `bat_get_state`（不帶參數），照抄 `state`、`blockedDetection`、`agentStarted`、`agentStartedAt`、`claudeSessionName`、`claudeSessionId`。

## Step 2 — 收尾

照 ct-exec 收尾：回報區填寫上述紀錄、`### 驗收證據`、commit（只含本檔），完成後送 `T0645 完成`（yolo `--submit`）。完成時間同樣以指令取得。

## 驗收條件

- Step 1 各項都有紀錄（不可用的項目寫明原因）
- `bat_whoami`：`role` = `worker`、`agent` 存在且為 claude 的 preset、`claudeSessionName` = `better-agent-terminal · Worker · T0645`、`claudeSessionId` 為 UUID
- `bat_get_state`：`blockedDetection` = `hook`、`agentStarted` = `true`（若不是，照實記錄，不要重試或改寫）
- 回報區所有時間戳都來自系統指令；無權杖值；commit 只含本檔

---

## 塔台驗收紀錄（塔台填寫，Worker 不改）

（待填）

---

## 回報區

（Worker 填寫）
