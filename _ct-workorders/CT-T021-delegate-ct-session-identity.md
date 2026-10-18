---
schema_version: 1
schema_kind: workorder
id: CT-T021
title: "【受派】CT 接 BAT 的 Claude session 識別：跨 session 選收件人改用 `claudeSessionName` / `scope: 'towers'`（PLAN-050 / D167；回應 CT D067 需求）"
type: implementation
status: IN_PROGRESS
repo: BMad-Guide
project: PLAN-050
priority: P2
sizing: S
created_at: "2026-10-18T17:29:45+0800"
depends_on:
  - "T0641 / T0642 / T0643 / T0644（`b6acce0a` / `12da2ca6` / `a54710aa` / `6174a6f2`，契約總表見 T0643 回報區）"
  - "BAT `0.7.1-pre.1`（預覽版，發佈後告知）"
related:
  - PLAN-050
  - D167
  - D168
  - T0640
  - CT-T020
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T021 — 跨 session 傳訊時辨識塔台 / Worker

## 跨專案協調

- **協調類型**：DELEGATE（回應 BMad-Guide 需求提案 `_request-2026-10-18-bat-session-identity.md`，CT D067）
- **來源專案**：better-agent-terminal（PLAN-050，D167）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `_ct-workorders/T0643-list-towers-scope.md` 回報區「PLAN-050 介面契約總表」C-1–C-8；`docs/agent-guide/claude-session-name.md`、`docs/agent-guide/helper-query-channels.md`（`terminal:list` / `whoami` / `get-state` 契約表與範圍）、`docs/agent-guide/worker-launch-confirmation.md`（`SessionStart` hook 回報 sessionId）、`CLAUDE.md`「Claude 分頁的 session 名稱」節。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：`0.7.1-pre.1`。舊 BAT（≤ `0.7.0-pre.9`）沒有這些欄位與 scope，CT 現行做法（訊息第一行請收件者確認身分、`_reply-*.md` 轉交）就是正確的降級。

## BAT 新契約（摘要；完整見權威）

| 項目 | 新行為 | 舊 BAT 的反應 |
|---|---|---|
| ListAgents 名稱 | BAT 開的 claude-cli 分頁啟動即 `--name`：Worker（helper 派工）`<工作區> · Worker · <T####>`；「以塔台開啟 Claude」入口 `<工作區> · Tower`；其他 claude-cli 分頁 `<工作區> · <短 ID>`（terminal id 去 `-` 取前 6 碼小寫）。分隔字元 ` · `（U+00B7）。遠端 headless 派工 `<工作區>` = `BAT`。使用者自訂參數已有 `--name` / `-n`、system claude `< 2.1.76` 或讀不到版本 → 不注入 | 不注入，ListAgents 顯示「目錄名＋兩字元」 |
| `claudeSessionName` / `claudeSessionId` | `terminal:whoami`、`terminal:list`（`mine` / `workspace`）每列、`terminal:get-state` 每個回傳都有這兩個鍵；`string \| null`。`claudeSessionId` 由 `SessionStart` hook 回報（`/clear` 等會換新值）。🔴 `claudeSessionId: null` 不代表沒有 session。`terminal:wait` 不加 | 沒有這兩個**鍵** → 視為不支援（不要當成 `null`） |
| `terminal:list { scope: 'towers' }`（MCP `bat_list_terminals scope=towers`） | 只給已 `--set-role tower` 的塔台；列出**同一個 BAT host 所有工作區**中執行中、已宣告的塔台（含自己，`self: true`），每列 `id` / `workspaceId` / `workspaceName` / `title?` / `claudeSessionName` / `state` / `alive` / `self`。不回 sessionId / cwd / 輸出；這些分頁的 get-state / read-output / wait 仍 `NOT_OWNER`。codex 塔台也會列出，`claudeSessionName: null` | `{ ok: false, code: 'INVALID_ARGS', message: 'scope' }`（MCP tool error `INVALID_ARGS: scope`）→ 判斷為不支援 |
| 「以塔台開啟 Claude」 | 只命名，不代替 `--set-role tower`；CT 宣告後標題結果為 `unchanged` | 沒有此入口 |

## 需要 CT 改的地方（建議，範圍由 BMad-Guide 決定）

1. **跨 session 選收件人規則**（BMad-Guide 需求原文 § 4）：要送給「某專案的 BAT 塔台」時，
   - ① 先看 ListAgents 有沒有 `<專案工作區> · Tower`（使用者用「以塔台開啟 Claude」開的塔台）；同名多列時要附 `[ref]` 或再用 ②；
   - ② 自己在 BAT 內且已宣告塔台 → `bat_list_terminals scope=towers`，以 `workspaceName` 找目標專案的塔台，取 `claudeSessionName` 對 ListAgents 的名稱；`INVALID_ARGS` → 舊 BAT，跳過；
   - ③ 都找不到（含對方是 codex 塔台、在別台 BAT / 遠端）→ 維持現行：`_reply-*.md` 請使用者轉交。
   - 名稱含 ` · Worker · T####` 的 session 一律**不是**塔台，不得當成收件人。
2. **Worker 名稱**：ct-exec 等文件提到「Worker 分頁 / session 名稱」的地方，可補 `<工作區> · Worker · T####` 的格式（純說明，CT 不需要做任何事，名稱由 BAT 加）。
3. **MCP 欄位表**（`auto-session.md` § BAT MCP 唯讀 tool 等）：補 `claudeSessionName` / `claudeSessionId`、`scope: towers` 的值域與「鍵不存在 = 舊 BAT」。
4. （選做）塔台啟動時，若 `bat_whoami` 的 `claudeSessionName` 不含 `Tower`，可在面板提示一句「用『以塔台開啟 Claude』開塔台，其他專案的塔台就能在跨 session 清單直接找到你」。是否加由 BMad-Guide 決定。

## 不在範圍

- codex 塔台之間的傳訊（不在 ListAgents、沒有 SendMessage）：BAT 另立 PLAN-051（IDEA），尚未研究。
- BAT 不自動 `/rename`、不改使用者已命名的 session。

## 驗收建議

- BAT `0.7.1-pre.1` 上：用「以塔台開啟 Claude」開 BAT 塔台 → BMad-Guide 塔台的 ListAgents 看得到 `better-agent-terminal · Tower`；BAT 派一張 Worker → ListAgents 有 `better-agent-terminal · Worker · T####`，CT 不會把它當成塔台。
- 兩個專案都在同一個 BAT、都已宣告塔台 → `bat_list_terminals scope=towers` 看到兩列，`claudeSessionName` 與 ListAgents 一致。

## 完成回覆

請以跨 session 訊息或 `_reply-*.md` 告知：修改的 CT 檔案與版本號、與 BAT 權威的差異（若有）、需要 BAT 補的東西（若有）。

### 收到的回覆（BAT 塔台記錄，2026-10-18T17:39:22+0800）

- BMad-Guide 塔台（bmad-guide-89）跨 session 訊息：**受理**（對方決策 D069）。契約 C-1–C-8 與 CT D067 需求一致、無疑問。
- CT 計畫：新規則加到 `cross-project-coordination.md`（順序 ① ListAgents `<工作區> · Tower` → ② `scope=towers` 以 `workspaceName` 對 `claudeSessionName`，`INVALID_ARGS` = 舊 BAT 跳過 → ③ `_reply-*.md`；含 `· Worker · T####` 不當收件人）；`auto-session.md` MCP 欄位表補兩欄與 `scope=towers`、「鍵不存在 = 舊 BAT」。版號（建議 v5.9.0）與選做項 4 待對方使用者決定。
- BAT 待辦：使用者安裝 `0.7.1-pre.1` 後由 BAT 塔台代跑 § 驗收建議；CT 發版後回覆修改檔案、版號與差異。
