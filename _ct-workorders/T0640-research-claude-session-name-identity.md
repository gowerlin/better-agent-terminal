---
schema_version: 1
schema_kind: workorder
id: T0640
title: "研究：PLAN-050 Claude 分頁的 session 識別——實測 claude `--name` / `--session-id` 與 ListAgents，提出 R1–R3 的 BAT 做法與介面契約草案"
type: research
status: TODO
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T15:52:18+0800"
depends_on: []
related:
  - "PLAN-050（CT D067 需求提案原文：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_request-2026-10-18-bat-session-identity.md`，唯讀）"
  - "T0562（`--set-role tower` / 塔台分頁標題）、T0582（`terminal:list` / `whoami` 契約、`authorizeHelperQueryTarget` 範圍）、T0584（`buildBatMcpLaunchArgs` 注入唯一組裝點、`bat-mcp-launch.test.ts` source guard）、T0553（外部建立分頁標題）、D149（範圍權杖）"
affects_files:
  - _ct-workorders/T0640-research-claude-session-name-identity.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品檔、不 commit 產品檔**；實驗腳本、設定、擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。只 commit 本工單檔（`git commit --only`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不得修改使用者的 `%APPDATA%\\BetterAgentTerminal\\settings.json`、`~/.claude/`、`~/.codex/`；可以讀，回報不寫任何權杖 / API key / 帳號資訊（`BAT_REMOTE_TOKEN` 只寫「已設定」）。"
  - "🔴 實測 claude 時用最便宜的模型、最短的 prompt，或用不呼叫模型的方式（例如只啟動到 TUI 就結束、`--help`）；回報記下大約用了幾次模型呼叫。實驗開的 claude session 用完要結束，不得留下會出現在 ListAgents 的殘留 session。"
  - "🔴 不得對其他 session 送 SendMessage（只可用 ListAgents 唯讀觀察）；不得改名塔台或其他分頁的 session。"
  - "🔴 yolo Worker：不得問使用者；範圍內無法決定且猜錯會返工的選擇，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。R2 選 (a) / (b) / (c) 哪個是**使用者決定**，你只提推薦與理由，不要問塔台代決。"
---

# T0640 — 研究：Claude 分頁的 session 識別（PLAN-050）

## 背景

BMad-Guide 塔台以跨 session 訊息找 BAT 塔台時，ListAgents 只顯示「工作目錄名＋兩字元」（例 `better-agent-terminal-93`），分不出塔台與 Worker（今天兩次實例，見 PLAN-050）。CT 的需求：R1 派出的 Claude Worker 名稱含工作區與 `T####`；R2 看得出是哪個專案的塔台；R3 `bat_list_terminals` 等可查分頁 ↔ session 對應。CT 提的做法是 claude 現有啟動參數 `--name` / `--session-id`，R2 有 (a)(b)(c) 三案（見 PLAN-050）。

## 要回答的問題

### Q1 — claude CLI 的實際行為（實測，內嵌 CLI 與本機 system claude 各記版本）

1. `--name` / `-n`、`--session-id` 在目前內嵌版本（`@anthropic-ai/claude-code` `2.1.300` 線）是否存在、`--help` 原文怎麼寫
2. 帶 `--name "<名稱>"` 啟動後，**另一個** Claude session 的 ListAgents 是否顯示這個名稱（你自己就是 Claude session，可直接用 ListAgents 觀察）；名稱含 `·`、空白、中文時顯示是否正確、有無長度或字元限制、兩個 session 同名時 ListAgents 怎麼呈現
3. `--name` 與 `--resume` / `--continue`、`/rename`、`--session-id` 的互動（例：resume 時名稱是否沿用或被覆寫）
4. 較舊的 claude 遇到不認得的 `--name` 會怎樣（啟動失敗？忽略？）——以 `claude --help` 文件、changelog 或二進位字串判斷即可，不必安裝舊版；system runtime 的 claude 版本可能落後，這點決定要不要做版本門檻
5. `--session-id` 的 UUID 由呼叫端指定時的限制（格式、重複時的行為）；session 中能否查到自己的 sessionId / 名稱（例如 env、檔案）

### Q2 — BAT 的注入點與現況（讀程式碼）

1. claude 啟動參數的組裝點：BAT MCP 唯一組裝點 `buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts`）/ renderer `withBatMcpLaunchArgs`（`src/lib/bat-mcp-launch.ts`）、helper 派工 `createAgentPromptCommandBuilder`；`--name` 應該放哪、自訂參數已含 `--name` / `-n` 時怎麼處理
2. 分頁 ↔ session 對應目前有沒有任何資料（例如 Claude Agent SDK 面板的 sessionId、`claude-cli` 分頁有沒有記）；R3 要新增的欄位放在哪個回傳（`terminal:list` / `whoami` / `get-state`）、是否需要持久化（BAT 重開、Terminal Server 存活）
3. R2 的跨專案查塔台：`list scope=workspace` 目前只到同工作區（`authorizeHelperQueryTarget`）；(a) 案需要的「跨工作區列出塔台分頁」會放寬哪些範圍、是否碰到 D149 權杖範圍的原則；不放寬的替代（例如只靠名稱前綴）是否足夠
4. 名稱格式建議：與分頁標題（T0553 `externalTerminalTitle`、T0562 `<Agent> · Tower`）的關係；工作區名含特殊字元時的處理

### Q3 — 方案與推薦

- R1、R3 的推薦做法；R2 三案 (a)(b)(c) 的比較表（使用者操作、BAT 改動量、跨專案找塔台是否可靠、與 `--set-role` 時序的關係、已知限制），給一個推薦與理由
- 介面契約草案（給 CT 依此撰寫，格式比照 T0583 / T0600 的「介面契約」）：新欄位名與值域、名稱格式、不支援時的降級（舊 claude / system runtime / codex 分頁 / raw command）
- 實作切分建議（S / M / L、會動哪些檔、需要的 e2e）與風險

## 交付

回報區依 Q1–Q3 作答，每個結論附證據（指令輸出、ListAgents 觀察、檔案:行號）；標明哪些是實測、哪些是推論。

---

## 回報區

（Worker 填寫）
