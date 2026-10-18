---
schema_version: 1
schema_kind: workorder
id: T0645
title: "探針：PLAN-050 / BUG-155 / CT-T021 實機驗收 —— claude Worker 的 session 名稱、`claudeSessionId` 與 `agent`（BAT 0.7.1-pre.1 × CT v5.9.0）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-050 實機驗收 + CT-T021 § 5 情境 2（BMad-Guide 請 BAT 代跑）
priority: P2
sizing: S
created_at: "2026-10-18T17:57:55+0800"
started_at: "2026-10-18T17:58:29+0800"
updated_at: "2026-10-18T17:59:20+0800"
completed_at: "2026-10-18T17:59:20+0800"
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

> 環境：安裝版 BAT FileVersion `0.7.1-pre.1`；塔台分頁「Claude CLI · Tower」（一般分頁開啟，session 名稱 `better-agent-terminal · d64be7`），control-tower **v5.9.0**，auto-session `on`，派工 `--mode yolo --no-interactive`；Worker 載入 ct-exec `5.9.0`。

### A. 派工啟動確認 — PASS

- 17:58:22（系統時間）派工 `bat-terminal.mjs … --agent default --skill ct-exec --workorder T0645 --wait-started 30000`：exit `0`，`agent: claude-cli (--agent default: Settings default agent)`，`started: 2026-10-18T09:58:22.278Z`。

### B. 名稱與狀態欄位 — PASS

- 派工後立即塔台 `bat_get_state`（T0645 分頁）：`claudeSessionName: better-agent-terminal · Worker · T0645`、`claudeSessionId: 89d0ee8d-4038-4d8e-bc2b-2e7f697eb4a3`、`blockedDetection: hook`、`agentStarted: true`、`agentStartedAt: 1792317502278`（= helper `started:`）。
- ListAgents（塔台 session）：`better-agent-terminal · Worker · T0645`，與 BAT 名稱完全相同（CT-T021 § 5 情境 2）。
- Worker 端 `bat_whoami` 有 `agent: claude-cli`（BUG-155 實機 PASS），`claudeSessionId` 與 Worker 自己的 session 目錄名一致（見回報區）。

### C. `/clear` 換 sessionId — PASS

- 使用者於 Worker 回報後在分頁輸入 `/clear`；18:00 塔台 `bat_get_state`：`claudeSessionId: 6732a6a1-2f29-46d5-a21d-5385c48a63cf`（換新），`claudeSessionName` 不變，`agentStartedAt` 仍是 `1792317502278`（只記第一次 `SessionStart`，符合 T0600 契約）。ListAgents 名稱不變。

### D. 塔台分頁與 `scope: towers`（啟動時）— PASS

- 塔台 `bat_whoami`：`role: tower`、`agent: claude-cli`、`towerMode: on`、`claudeSessionName: better-agent-terminal · d64be7`、`claudeSessionId` = 本塔台 session 實際 ID。
- `bat_list_terminals scope=towers`：兩列（本塔台 `self: true`、`BMad-Guide · 590537` `self: false`），每列只有 metadata；兩個名稱與 ListAgents 完全相同（CT-T021 § 5 情境 3）。
- CT v5.9.0 面板提示：本塔台名稱不以 ` · Tower` 結尾 → 啟動面板出現「以塔台開啟 Claude」提示（CT-T021 § 5 情境 4 的本側旁證）。

### 未驗

- 「以塔台開啟 Claude」開的塔台名稱 `better-agent-terminal · Tower` 與對方 ListAgents 直接命中（CT-T021 § 5 情境 1）：使用者決定留在原分頁，延後。

### 回收

- 18:00 `--close-worker T0645 --delay-ms 10000` exit `0`。

---

## 回報區

### 結果摘要

- 狀態：DONE。Step 1 五項全部取得；驗收條件中 Worker 一側可觀察的項目全部符合（見 `### 驗收證據`）。
- 未讀產品程式碼、未改其他檔案、未跑 build / test、未 push；commit 只含本檔。

### 落點檢查（Landing Zone Check）

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本檔 → not applicable
- C-2：工單無 `branch` 欄位；目前分支 `main`
- `CT_HOME`：未設定（非 worktree 派工）
- `BAT_WORKSPACE_ID`（僅記錄）：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`

### Step 1 — 環境紀錄

1. 開工時間：`2026-10-18T17:58:29+0800`（`date "+%Y-%m-%dT%H:%M:%S%z"`）
2. 環境變數（Git Bash `env` 可見，未出現 shell 可見性差異）：
   - `BAT_SESSION` = `1`
   - `BAT_TERMINAL_ID` = `ddedd519a5dda0196303cab576fc2618`
   - `BAT_TOWER_TERMINAL_ID` = `d64be77a-fa33-4391-b92c-70069ddfd207`
   - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`
   - `CT_MODE` = `yolo`（另有 `CT_INTERACTIVE` = `0`）
   - `BAT_REMOTE_TOKEN`：已設定，以 `batcap.` 開頭（值不記錄）
3. ct-exec skill 版本：`5.9.0`（`C:\Users\Gower\.claude\skills\ct-exec\SKILL.md` 第 5 行 `<!-- ct-exec-version: 5.9.0 -->`；檔內無 `control-tower-version` 註解，以 `ct-exec-version` 為準）
4. `bat_whoami`（不帶參數）回傳，全部鍵值照抄：

   ```json
   {"terminalId":"ddedd519a5dda0196303cab576fc2618","workspaceId":"cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b","role":"worker","towerTerminalId":"d64be77a-fa33-4391-b92c-70069ddfd207","workorder":"T0645","yolo":true,"agent":"claude-cli","cwd":"D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal","claudeSessionName":"better-agent-terminal · Worker · T0645","claudeSessionId":"89d0ee8d-4038-4d8e-bc2b-2e7f697eb4a3"}
   ```

   回傳中沒有任何權杖類鍵值。
5. `bat_get_state`（不帶參數）回傳：
   - `state` = `working`
   - `blockedDetection` = `hook`
   - `agentStarted` = `true`
   - `agentStartedAt` = `1792317502278`（`node` 換算 = `2026-10-18T09:58:22.278Z` = `17:58:22+0800`，早於開工時間 7 秒）
   - `claudeSessionName` = `better-agent-terminal · Worker · T0645`
   - `claudeSessionId` = `89d0ee8d-4038-4d8e-bc2b-2e7f697eb4a3`
   - 其餘鍵（供參考）：`terminalId` = `ddedd519a5dda0196303cab576fc2618`、`lastOutputAt` = `1792317522095`、`idleMs` = `135`、`source` = `output`、`pendingQuestions` = `0`

### 驗收證據

| 驗收條件 | 觀察值 | 判定 |
|---|---|---|
| `bat_whoami.role` = `worker` | `worker` | PASS |
| `bat_whoami.agent` 存在且為 claude preset | `claude-cli` | PASS |
| `bat_whoami.claudeSessionName` = `better-agent-terminal · Worker · T0645` | 完全相符 | PASS |
| `bat_whoami.claudeSessionId` 為 UUID | `89d0ee8d-4038-4d8e-bc2b-2e7f697eb4a3`（8-4-4-4-12 hex） | PASS |
| `bat_get_state.blockedDetection` = `hook` | `hook` | PASS |
| `bat_get_state.agentStarted` = `true` | `true` | PASS |
| 時間戳來自系統指令、無權杖值、commit 只含本檔 | 見下 | PASS |

- 旁證：`claudeSessionId` 與本 claude session 的 scratchpad 目錄名（`…\89d0ee8d-4038-4d8e-bc2b-2e7f697eb4a3\scratchpad`，由 Claude Code 依 session id 建立）一致，可佐證 hook 回報的 UUID 就是本分頁實際的 claude session。
- `bat_whoami` 與 `bat_get_state` 的 `claudeSessionName` / `claudeSessionId` 互相一致。
- 所有時間戳取自 `date "+%Y-%m-%dT%H:%M:%S%z"`；毫秒值以 `node -e 'new Date(ms).toISOString()'` 換算。

### 變更檔案

- `_ct-workorders/T0645-probe-plan050-claude-worker-identity.md`（只有本檔）

### Commit 狀態

- 無產品變更，無產品 commit。
- 工單 commit：`git commit --only _ct-workorders/T0645-probe-plan050-claude-worker-identity.md`（hash 見 git log；工單內不回填自身 hash）。
- `src/styles/settings.css` 的 M 為既有未提交變更，未觸碰、未納入 commit。

### 偏差

- 工單初始 `status` 為 `TODO`（ct-exec 預期 `PENDING`），照常改為 `IN_PROGRESS`。

### 遭遇問題

- 無。

### 互動紀錄

- 無（未向塔台提問）。
