---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-01-bat-worker-session-map-advisory
title: 回覆 BMad-Guide 塔台：Worker session 對應 ADVISORY Q-B1–Q-B5——完整 sessionId 請走 `bat_get_state`；`bat-scripts.log` 不當契約、BAT 會補輪替；用量彙總不做；skill 管理不需 BAT 整合（但不要用 `--settings`）
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-01-bat-worker-session-map-advisory
status: RESOLVED
resolved_at: "2026-11-01T12:28:14+0800"
resolved_note: "BMad-Guide 塔台標記 RESOLVED（BMad-Guide D517）；CT PLAN-004 ⑥ 改為收單時於 --close-worker 前讀 bat_get_state.claudeSessionId，不依賴 bat-scripts.log，不在 Claude 啟動參數放 --settings"
delivered_at: "2026-11-01T12:25:49+0800"
decision: D197
local_workorder: "T0731（研究）"
created_at: "2026-11-01T12:09:58+0800"
---

# 回覆：Worker session 對應與用量彙總

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> ✅ **已定案（BAT D197，2026-11-01，BAT 使用者裁示照下列建議立場）。** 以下是 BAT 研究單 T0731 的查證結果與 BAT 的立場。
> 本文件不含權杖、完整 session id 或家目錄路徑（家目錄寫成 `<使用者資料夾>`）。

## 摘要

| 題目 | 建議立場 | 一句話理由 |
|---|---|---|
| Q-B1 `report-hook.session` 改完整 UUID、寫成約定 | **不採納**（維持前 8 碼）；改指引 CT 用既有契約 | 前 8 碼是 D167 的刻意決定；完整 sessionId 已經有正式契約：`bat_get_state` / `bat_list_terminals` / `bat_whoami` 的 `claudeSessionId` |
| Q-B2 新增 `worker-session` 紀錄 | **暫不採納**；若 CT 確定需要，BAT 可做（M），但要寫在主行程、另立契約 | 資料都在 BAT 主行程；但 CT 在收單時查 `bat_get_state` 就能拿到，不必等 BAT 發版 |
| Q-B3 `bat-scripts.log` 保存 / 輪替 | **目前無輪替，BAT 會開 BUG 補上**；CT 不要依賴它的保留期 | 這是診斷日誌，不是契約；10 月一個月長了約 36 MB |
| Q-B4 狀態列用量依 Worker 彙總 | **不採納** | 狀態列只屬於 Claude Agent 面板（SDK），Worker 是 Claude CLI 終端分頁，BAT 本來就沒有它們的用量；口徑也和 JSONL 不同 |
| Q-B5 skill 管理不需 BAT 整合 | **同意**，附兩個條件 | 工作區啟動參數可用，但 ① 同一工作區的塔台與 Worker 共用同一組參數；② 自訂參數含 `--settings` 時 BAT 不注入自己的 hooks |

## Q-B1：`report-hook` 的 `session` 欄記前 8 碼是刻意的

**現況**

- 刻意的。出處是 D167 第 2 點（2026-10-18，使用者裁示）：`SessionStart` hook 回報 sessionId，「日誌只記前 8 碼」；實作 T0642 契約 C-5。
- 兩個寫入點都只記前 8 碼：helper 端 `scripts/bat-hook.mjs` 的 `report-hook`（`session: outcome.sessionId.slice(0, 8)`），主行程鏡像 `electron/terminal-blocked-state.ts` 的 `sessionIdForLog`。debug log 的 `[agent-start]` 也一樣。BAT 的文件寫明「任何日誌都不記完整 sessionId」，單元測試與 e2e 都斷言日誌裡只有前 8 碼。
- **完整 sessionId 已經是 BAT 的正式契約**（T0642 R3）：`terminal:whoami` / `terminal:list` / `terminal:get-state`（MCP `bat_whoami` / `bat_list_terminals` / `bat_get_state`）的 `claudeSessionId`，塔台看得到自己與自己的 Worker。分頁結束後，結束紀錄保留 10 分鐘 / 最多 32 筆。BAT README「與 BMad Control Tower 協作」一節已列出。

**立場**：不改成完整 UUID，也不把 `bat-scripts.log` 的欄位寫成約定。

- `bat-scripts.log` 是診斷日誌（T0192 起的定位），欄位會隨除錯需要調整，不適合當跨專案契約。
- sessionId 不是權杖，但它可以拿來 `claude --resume` 那段對話；BAT repo 公開、使用者會把日誌附在問題回報裡，所以 D167 選擇在日誌裡只留前綴。
- 前 8 碼（32 位元）當交叉驗證夠用：CT 實測 1533 筆裡 0 筆對到多個檔。

**給 CT 的建議作法（不需要等 BAT 發版）**：塔台在 Worker 回報「完成」、送 `--close-worker` 之前呼叫一次 `bat_get_state`（`terminalId` = 該 Worker），把 `claudeSessionId`（完整 UUID）與 `claudeSessionName` 記進工單或塔台狀態。這樣 CT 就有自己保存、不受 BAT 日誌輪替影響的對應表。注意 `claudeSessionId` 是「最後一次」`SessionStart` 的值：Worker 中途 `/clear` 過的話，前一段 session 只能靠 JSONL 首訊息歸屬；`null` 不代表沒有 session（例如 hooks 被 claude 自己的設定關掉）。

## Q-B2：`worker-session` 紀錄

**現況**

- helper（`bat-terminal.mjs`）在 `terminal-created` 時還拿不到 sessionId：`SessionStart` hook 是在 claude 啟動後才回報，helper 那時通常已經結束（`--wait-started` 也只等 `agentStartedAt`，`terminal:wait` 不回 sessionId）。
- 主行程有全部資料：PTY 的 `workorder`、`workspaceId`、`agentPreset`、塔台 id（`BAT_TOWER_TERMINAL_ID`）、`role`（`--set-role tower`）、sessionId（`TerminalBlockedTracker`）、結束時間與 exit code（`ExitedPtyRecord`，`electron/pty-manager.ts` `recordExit`）。

**立場**：暫不採納。Q-B1 的作法能讓 CT 立刻拿到完整 sessionId。

若 CT 之後確定需要 BAT 端的歷史紀錄，BAT 可以做（規模 M），條件是：

- 由主行程寫（每次 `SessionStart` 換 sessionId 時寫一筆、分頁結束時寫一筆），不是 helper；
- 寫進**另一個有保存規則的檔案**，不是 `bat-scripts.log`，並在 BAT 文件訂出介面契約（欄位、版本、保存期）；
- 是否寫完整 sessionId 要 BAT 使用者另行裁示（等於修改 D167 的日誌政策）；
- `usage` 欄不做（見 Q-B4）。

## Q-B3：`bat-scripts.log` 目前沒有輪替

**現況**

- 兩個寫入者（helper 的 `scripts/_bat-logger.mjs`、主行程的 `electron/remote/remote-logger.ts`）都是 append-only，沒有大小上限、沒有輪替，也沒有清理。T0192 / T0193 當初明訂「先不做 rotation，超大時再處理」。
- 對照：同目錄的 `debug-*.log` 每次啟動一檔、只保留最近 10 個。
- BAT 本機實測（2026-11-01）：約 42 MB、約 19.5 萬筆、從 2026-05-28 起。9 月以前每月 1–2 MB；**10 月 35.6 MB**，其中 `report-hook`（T0590 起的 hook 回報，helper 端與主行程鏡像各記一筆）佔 20.7 MB。

**立場**：BAT 已開 BUG-179，下一個預覽版補上：BAT 啟動時檔案超過 10 MB 就輪替成帶時間戳的舊檔、保留最近 3 份（BAT D198）。CT **不要依賴**它的保留期；需要長期保存的對應請照 Q-B1 的作法由 CT 自己記。

## Q-B4：狀態列用量依 Worker 彙總

**現況**

- BAT 狀態列的成本 / Token 只出現在 **Claude Agent 面板**（SDK）。來源是 SDK `result` 訊息的 `total_cost_usd`（CLI 算好的整個 session 累計值）與 `modelUsage`（依模型累計，含 cache 讀寫，`electron/claude-agent-manager.ts`）。
- Worker 是 **Claude CLI 終端分頁**（helper 派工），BAT 不解析它們的用量，所以沒有東西可以彙總。
- 口徑也不同：JSONL 的 `message.usage` 是每個 API 回應的值、沒有金額（要自己套價格表）；SDK 的 `total_cost_usd` / `modelUsage` 是 CLI 算好的 session 累計值、依模型分列。兩者加總不保證一致。（BAT 本單未實測比對；JSONL 同一則回應是否拆成多行、子代理用量是否計入，請以 CT T0389 的實測為準。）

**立場**：不採納。要讓 BAT 拿到 CLI 分頁的用量，只能讀 JSONL（和 CT 重工），或在 BAT 的 `--settings` 注入 `statusLine`（會蓋掉使用者自己的狀態列），都不划算。CT 直接從 JSONL 算即可。

## Q-B5：skill 管理不需 BAT 整合

**立場**：同意不需要新功能，但請在 CT 文件註明兩個限制：

1. **同一工作區的塔台與 Worker 共用同一組參數**。BAT 的啟動參數以「工作區 × agent preset」為單位（工作區有設就整串取代全域）；helper 派工沒有逐張指定參數的選項。想讓塔台與 Worker 用不同 skill 組合，只能把 Worker 派到另一個工作區，或由 CT 自己在 skill 層區分。
2. **不要在 Claude CLI 的啟動參數放 `--settings`**。BAT 自己用 `--settings=<資料目錄>/bat-mcp/claude-settings.json` 注入 hooks；使用者參數已含 `--settings` 時，BAT 會**不注入 hooks**（不是合併）。那個分頁就沒有 blocked 偵測、`--wait-started` 會回 `unknown`、也不會回報 sessionId（`report-hook.session` 與 `claudeSessionId` 都會缺）。`skillOverrides` / `enabledPlugins` 請放在專案的 `.claude/settings.json` / `.claude/settings.local.json`，不衝突。Codex 的 `-c skills.config` 與 BAT 注入的 `-c mcp_servers.bat.*` 沒有衝突。

## BAT 的決定（D197 / D198）

1. Q-B1：維持 D167「日誌只記前 8 碼」；完整 sessionId 請走 `bat_get_state` / `bat_list_terminals` / `bat_whoami` 的 `claudeSessionId`。
2. Q-B2：暫不做。CT 之後若仍需要 BAT 端的歷史紀錄，請另送 HANDOVER，BAT 會以主行程寫入、獨立檔案與保存規則、另立契約的方式評估。
3. Q-B3：BUG-179 修正（啟動時 > 10 MB 輪替、保留 3 份；`report-hook` 雙寫暫不調整）。修正之後，`bat-scripts.log` 也只保證最近幾份，CT 不要依賴它的保留期。
4. Q-B4：不做。
5. Q-B5：同意不需 BAT 整合，請注意上面兩個條件。
