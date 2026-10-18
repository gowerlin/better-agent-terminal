---
schema_version: 1
schema_kind: plan
id: PLAN-050
title: "跨 session 傳訊時辨識塔台 / Worker：BAT 開的 Claude 分頁在 ListAgents 可辨識，並可查分頁 ↔ session 對應"
status: PLANNED
priority: medium
created_at: "2026-10-18T15:48:20+0800"
links:
  source: "BMad-Guide 塔台需求提案（CT D067）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_request-2026-10-18-bat-session-identity.md`（2026-10-18 15:47，跨 session 訊息 bmad-guide-89）"
  related: [PLAN-047, PLAN-048, T0562, T0582, T0600]
---

# PLAN-050 — Claude 分頁的 session 識別

## 動機

CT 塔台以跨 session 訊息（SendMessage）找 BAT 塔台時，ListAgents 只顯示「工作目錄名＋兩字元」（例 `better-agent-terminal-93`），分不出塔台與 Worker。2026-10-18 實例：CT-T020 完成回覆被送到 T0627 Worker（12:54）；15:42 CT 只能靠使用者截圖推定塔台。BAT 知道分頁的 `role` / `workorder`，但不知道分頁對應哪個 Claude session。

## CT 的需求（原文摘要）

| # | 需求 | 驗收 |
|---|---|---|
| R1 | BAT 派出的 Claude Worker 在 ListAgents 上看得出專案與工單號 | 派 T#### 後，ListAgents 該列名稱含工作區名與 `T####` |
| R2 | 塔台 session 在 ListAgents 上看得出是哪個專案的塔台 | 兩個專案各開一個塔台，各自能從 ListAgents 找到對方塔台 |
| R3 | 分頁 ↔ session 名稱（或 sessionId）可查 | 例：`bat_list_terminals` 每列多一個欄位 |

範圍：只限 Claude 分頁（codex 不在 ListAgents）。CT 不向 Claude Code 提需求，只用其現有啟動參數。

## CT 提的可行做法（BAT 可另選）

- R1：派 Worker 時 `claude --name "<工作區名> · Worker · T####"`
- R2：`--set-role tower` 在 Claude 啟動之後，事後無法 `--name`；選項 (a) 所有 Claude 分頁啟動即命名 `<工作區名> · <分頁短 ID>` ＋ R3 ＋ 跨工作區唯讀查塔台、(b)「以塔台身分開分頁」啟動即 `--name "<工作區名> · Tower"`、(c) 過渡期使用者 `/rename`
- R3：`--session-id <uuid>` 或記下 `--name` 值，由 `bat_list_terminals` 回傳

## 待研究 / 待決（塔台整理）

1. 內嵌 claude CLI（`2.1.300` 線）`--name` / `--session-id` 的實際行為：ListAgents 是否顯示 `--name`、名稱字元限制（`·`、空白、中文）、與 `--resume` / `--continue` 的互動、system runtime 舊版是否認得（不認得會不會啟動失敗）
2. 注入點：BAT MCP 參數唯一組裝點 `buildBatMcpLaunchArgs` / `withBatMcpLaunchArgs`（`bat-mcp-launch.test.ts` source guard）；自訂參數已含 `--name` 時的處理
3. R2 選哪個做法（使用者決定）；跨工作區唯讀查塔台是否放寬 `authorizeHelperQueryTarget`（目前 `scope=workspace` 只到同工作區，D149 權杖範圍）
4. `--session-id` 的 UUID 由誰產生、BAT 重開（Terminal Server 存活）後的持久化
5. 版號：需新的 BAT 版號線（`0.7.0` 線已發到 pre.9，D151）
