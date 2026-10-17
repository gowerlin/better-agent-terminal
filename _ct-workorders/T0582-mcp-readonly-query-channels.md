---
schema_version: 1
schema_kind: workorder
id: T0582
title: "PLAN-047 M1-1：helper 唯讀查詢 channel（whoami / list / get-state / read-output / wait）+ shell 範圍 + 輸出遮罩，本機與 headless 共用"
type: feature
status: TODO
started_at: ""
updated_at: "2026-10-17T21:52:34+0800"
completed_at: ""
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-17T21:52:34+0800"
target_version: "0.7.0-pre.2（候選，與 T0583 / T0584 / T0585 同批再定）"
depends_on: []
related:
  - "PLAN-047（§一.3 Tool 對照、研究結論 R4）、T0574 回報區 R4「建議新增的唯讀 channel」表與 Q3 / Q5 建議答案"
  - "D149 / D152；T0575 / T0579（`HELPER_CHANNEL_ROLES` 本機與 headless 共用）、T0566（`plainTextFromOutput`）、T0565（`getTerminalRole` / `isYoloTerminal`）、T0536（`isWorkerOf`）"
  - "並行工單 T0583（W1-1）：同樣會改 `electron/remote/helper-capability.ts` 與 `CLAUDE.md`"
affects_files:
  - electron/remote/helper-capability.ts
  - "electron/terminal-query-handlers.ts（新，名稱可自訂；本機與 headless 共用的 handler 註冊）"
  - "electron/pty-manager.ts（必要的唯讀 accessor）"
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "src/lib/（遮罩等純函式，可新檔）"
  - "electron/__tests__/**、electron/remote/__tests__/**（新增 / 修改，含 `proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0582-mcp-readonly-query-channels.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0583 同時在改 `electron/remote/helper-capability.ts`（它只動 `create-*` 參數驗證 / `customEnv` 相關）與 `CLAUDE.md`（它新增 worktree 小節）。你只動 `HELPER_CHANNEL_ROLES` 與新增的範圍判定函式；CLAUDE.md 只新增你自己的小節。commit 前 `git diff -- <檔>` 確認只含你的 hunk；若檔案已有對方未 commit 的變更，用 `git add -p` 只 stage 自己的 hunk 再 commit，不得夾帶。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 一律隔離實例（需先 `npx vite build`），teardown 以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData。"
  - "🔴 本單只做唯讀查詢。不做 MCP shim（T0584）、不做 blocked 偵測 / `terminal:report-hook`（M1b）、不做 `worktree:terminal-status`（T0585）；權杖值不得出現在日誌、回報、測試快照。"
---

# T0582 — helper 唯讀查詢 channel（M1-1）

## 背景

PLAN-047 路線 [A]（D149）：MCP 建在 A1 / A2 的範圍權杖上，傳輸用 stdio shim 連既有 RemoteServer（T0584）。shim 只是轉接，能力本身是 RemoteServer 上的 helper channel。T0574 R4 建議新增一組唯讀 channel；本單實作其中不依賴 blocked 偵測與 worktree 的五個，本機與 headless 共用同一份 handler 與角色表（比照 T0579）。

## 介面契約（本單定稿，T0584 shim 與 CT 依此撰寫；實作若需調整，回報區寫明差異與理由）

所有 channel 只接受 helper 權杖（`batcap.`）連線呼叫，handler 以**呼叫者權杖綁定的 terminal id** 為身分，不接受參數宣告身分。server token（全權）連線照現行規則可呼叫（測試 / 舊相容），範圍不受限。

**範圍（scope）判定**——唯一實作一個函式，五個 channel 共用：

| 呼叫者 | 可查詢的目標 |
|---|---|
| 任何權杖 | 自己 |
| tower 權杖 | 自己 + `isWorkerOf(目標, 自己)` 成立的 Worker |
| tower 權杖且 `getTerminalRole(自己) === 'tower'`（已 `--set-role tower`） | 上一列 + `terminal:list` 可列出**同工作區**的其他分頁（只列 metadata，不給輸出） |
| worker 權杖 | 自己 + 綁定的塔台（`whoami` / `list` / `get-state` 可；`read-output` / `wait` 只能自己） |

- 「tower 權杖但未宣告」= 提案的 `shell` 角色（Q3）：本機一般分頁沒有 towerId 會拿到 tower 權杖，但讀取範圍只有自己與自己派出的 Worker。
- 範圍外 → `{ ok:false, code:'NOT_OWNER' }`；目標不存在 → `NOT_FOUND`；參數不合 → `INVALID_ARGS`。（錯誤碼與 `--close-worker` 一致）

**channel**（`registerHandler`，回傳一律 `{ ok:true, ... }` / `{ ok:false, code, message? }`）：

| channel | 參數 | 回傳重點 |
|---|---|---|
| `terminal:whoami` | 無 | `terminalId`、`workspaceId`、`role`（`tower` / `worker` / `shell`，依上表）、`towerTerminalId?`、`workorder?`、`yolo`（`isYoloTerminal`）、`towerMode?`、`agent?`（agentPreset）、`cwd?` |
| `terminal:list` | `{ scope?: 'mine' \| 'workspace' }`（預設 `mine` = 自己 + 自己的 Worker / 綁定塔台；`workspace` 需已宣告塔台） | 陣列：`id`、`role`、`workorder?`、`towerTerminalId?`、`title?`（本機取 window registry 已存標題；headless 無）、`state`（同 get-state 的 `state`）、`alive` |
| `terminal:get-state` | `{ terminalId?: string }`（預設自己） | `state`：`working`（最近 `IDLE_MS` 內有輸出）/ `idle` / `exited`；`lastOutputAt`、`idleMs`、`exitCode?`；`source: 'output'`。`blocked` 列為保留值（M1b），本單不產生 |
| `terminal:read-output` | `{ terminalId?, cursor?: string, maxLines?: number }` | 去 ANSI 文字（沿用 `plainTextFromOutput`，T0566），`lines`、`nextCursor`（之後再讀只拿新行；舊 cursor 已被 buffer 捲掉時回 `truncated: true` 與目前可得的起點）、`masked: number`（遮罩次數）。`maxLines` 預設 200、上限 1000 |
| `terminal:wait` | `{ terminalId?, until: 'state-change' \| 'exit' \| 'idle', fromState?, timeoutMs? }` | server 端長輪詢，`timeoutMs` 預設 / 上限 **45000**（helper invoke 逾時需同步放寬，見任務 4）；回 `{ ok:true, changed: boolean, state, ... }`，逾時 `changed:false`（不是錯誤） |

- `IDLE_MS`：沿用既有「安靜」常數語意（close-worker 的 5 s），不新增可設定值；回報區寫明採用的常數。
- **遮罩**（Q5，唯一實作一個純函式，`read-output` 必經）：`batcap.` 權杖、server token 樣式、`sk-` / `ghp_` / `github_pat_` / `AKIA` 類 token、`Authorization:` / `Bearer ` 之後的值、PEM 區塊（`-----BEGIN … PRIVATE KEY-----` 到 END）→ 以 `[REDACTED:<kind>]` 取代。只遮罩、不拒絕。
- **稽核**：每次呼叫主行程記一行 `[helper-query] channel=… caller=<id> target=<id> → ok|<code>`（不記輸出內容），並以既有 `mirrorToBatScripts` 寫一筆 `bat-scripts.log` 事件（headless 寫 server 的 `Logs/bat-scripts.log`，比照現有 helper 事件）。

## 任務

1. 角色表：在 `HELPER_CHANNEL_ROLES` 加五個 channel（tower / worker 皆可呼叫，範圍由 handler 判定）；範圍判定函式放在 `helper-capability.ts` 或新檔，本機 `RemoteServer` 與 headless 共用。
2. handler：新模組註冊五個 channel，`main.ts` 與 `headless-entry.ts` 各自接線（資料來源：`PtyManager` 的 instances / `getLastOutputAt` / replay buffer / exit 記錄、`getTerminalRole`、`isYoloTerminal`、`PtyInstance.workorder` / `customEnv.BAT_TOWER_TERMINAL_ID`；本機標題取 window registry cache）。缺的唯讀 accessor 補在 `PtyManager`。
3. 已結束的 PTY：`get-state` 能回 `exited`（保留最近結束的少量紀錄即可，上限與保留時間自訂並寫進 CLAUDE.md）；超出即 `NOT_FOUND`。
4. `terminal:wait` 的長輪詢不得卡住其他 invoke；RemoteServer / helper 端若有固定 invoke 逾時，確認 45 s 的 wait 能完成（必要時讓 server 端對此 channel 的回應不受一般逾時限制，回報區說明做法）。
5. 測試：範圍判定每一列（含 shell = 未宣告塔台、別人的 Worker → `NOT_OWNER`、worker 讀塔台輸出 → `NOT_OWNER`）、遮罩每一種樣式、cursor 增量與 truncated、wait 三種 until 與逾時、exited；真 RemoteServer + 範圍權杖的整合測試；headless 真 node-pty 對等測試（比照 `headless-set-role-e2e.test.ts`）；`proxied-channels-binding.test.ts` / `headless-parity.test.ts` 清單更新。
6. CLAUDE.md：新增「helper 唯讀查詢 channel（PLAN-047 M1 / T0582）」小節：契約表、範圍表、遮罩規則、常數、日誌、已知限制、驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元 / 整合 / headless 測試通過。
3. e2e（隔離實例，比照 `e2e/t0575-local-scoped-token.spec.ts`，在分頁內以分頁 env 執行一支呼叫 RemoteServer 的小腳本）：塔台分頁派一個 Worker（自訂 CLI 跑 node 腳本，不耗 token）→ 塔台 `whoami` / `list` / `get-state` / `read-output`（看得到 Worker 輸出、權杖樣式被遮罩）/ `wait until=exit` 成功；Worker 讀塔台輸出 → `NOT_OWNER`；未宣告塔台的一般分頁 `list scope=workspace` → `NOT_OWNER`。
4. 回報區附：實際採用的常數、與契約的差異（若有）、T0584 shim 需要知道的事項。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
