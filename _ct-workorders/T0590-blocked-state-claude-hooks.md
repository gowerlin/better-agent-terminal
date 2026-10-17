---
schema_version: 1
schema_kind: workorder
id: T0590
title: "PLAN-047 M1b-1：`blocked` 狀態偵測（claude-cli 分頁以 hooks 回報；`terminal:get-state` / `list` / `wait` 與 MCP 帶出）"
type: feature
status: DONE
started_at: "2026-10-18T00:33:57+08:00"
updated_at: "2026-10-18T01:00:22+08:00"
completed_at: "2026-10-18T01:00:22+08:00"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T00:31:47+0800"
target_version: "0.7.0-pre.4（候選）"
isolation: worktree
depends_on: []
related:
  - "T0574 回報區 R2（blocked 偵測研究：claude hooks 事件、`--settings` 附加與使用者 hooks 合併、`disableAllHooks` / `allowManagedHooksOnly` 陷阱；codex 走 OSC 9，不在本單）"
  - "T0582（`terminal:get-state` / `list` / `wait`、`authorizeHelperInvoke`、`HELPER_CHANNEL_ROLES`、`[helper-query]` 稽核；`blocked` 當時保留給 M1b）、T0584（`electron/bat-mcp-launch.ts` 注入點、`<dataDir>/bat-mcp/` 設定檔、Settings「BAT MCP」開關、`scripts/bat-mcp.mjs`）、T0551 / T0566（`isTerminalAutoReply`、`onUserInput`：使用者輸入判定）"
  - "PLAN-047 §一.5、§四 M1b；並行工單 T0589（Q3，在主 checkout 改 `worktree-status-handlers.ts` / `ct-worktree.ts` / `pty-manager.ts` 已結束紀錄 / CLAUDE.md T0585 小節）"
affects_files:
  - "scripts/bat-hook.mjs（新）"
  - electron/bat-mcp-launch.ts
  - electron/pty-manager.ts
  - electron/terminal-query-handlers.ts
  - electron/remote/helper-capability.ts
  - "electron/handlers/pty.ts（只在使用者輸入清除 blocked 需要時）"
  - "electron/main.ts、electron/remote/headless-entry.ts（接線）"
  - "scripts/bat-mcp.mjs（`bat_get_state` / `bat_wait` / `bat_list_terminals` 的 schema 與摘要）"
  - "server bundle helper 清單（`serverBundleHelperScripts` 與相關測試）"
  - "src/components/SettingsPanel.tsx 與 src/locales/*.json（只改「BAT MCP」開關的說明文字，可選）"
  - "electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**、e2e（新檔）"
  - "CLAUDE.md（新增獨立小節；T0582 小節只改 `blocked` 那一句）"
  - _ct-workorders/T0590-blocked-state-claude-hooks.md
renew_count: 0
workdir: "BAT 隔離 worktree（`CT_WORKTREE`）"
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 隔離派工：依 `ct-exec` § Worktree Isolation。產品變更在 worktree（`CT_WORKTREE`）裡改並 commit 到 `ct/T0590`；本工單檔一律在主 checkout（`CT_HOME`）修改；worktree 裡的 `_ct-workorders/` 不得修改、不得 stage。不得在主 checkout commit 產品檔、不得切換主 checkout 的分支；不 merge 回 main（塔台另派合併）。"
  - "🔴 依賴由你安裝（D152）：在 worktree 執行 `npm ci`（約 2 GiB，npm 12 `allowScripts` 已涵蓋，不需手動補跑）。所有 build / typecheck / test / e2e 都在 worktree 跑。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。"
  - "🔴 並行：T0589 同時在主 checkout 改 `electron/worktree-status-handlers.ts`、`electron/ct-worktree.ts`、`electron/pty-manager.ts`（只動已結束紀錄）與 CLAUDE.md 的 T0585 小節。你在 `pty-manager.ts` 盡量把變更集中在新區塊；CLAUDE.md 不改 T0585 小節。"
  - "🔴 hook 腳本**絕不能影響 claude 的行為**：一律 exit 0、stdout 不輸出任何東西（尤其 `PermissionRequest` / `PreToolUse` 不得回傳決策 JSON）、連線失敗靜默、總時限 ≤ 2 s。只送事件名與（權限事件的）`tool_name`，**不得**送 `tool_input`、prompt、訊息內容或任何權杖。"
---

# T0590 — `blocked` 狀態偵測：claude hooks（PLAN-047 M1b-1）

## 背景

T0582 的 `terminal:get-state` 只有 `working` / `idle` / `exited`，`blocked`（分頁停在等使用者：權限確認、AskUserQuestion、elicitation）保留給 M1b。CT 的斷點 D 需要它：塔台要能知道 Worker 卡在等人回答，而不是在工作或已結束。

T0574 R2 已研究過做法：claude 用 hooks（立即、可信），codex 走 OSC 9（本單不做，之後 M1b-2）。

本機設定（塔台已查）：`agentCustomArgs.claude-cli` = `--dangerously-skip-permissions --effort high`，所以 CT yolo Worker **不會**出現權限提示；yolo 下會遇到的是 AskUserQuestion / elicitation（T0574 待決 7 的答案）。`PermissionRequest` 仍要做（非 yolo 使用者會用到）。

## 介面契約（本單定稿；CT 斷點 D 之後依此撰寫）

**1. 狀態**（`terminal:get-state`、`terminal:list` 的 `state`、`terminal:wait`）

- `state` 增加 `blocked`。優先序：`exited` > `blocked` > `working` / `idle`。
- `blocked` 時另回 `blockedReason`（`permission` / `question` / `elicitation`）、`blockedSince`（ms）、`source: 'hook'`（`working` / `idle` 仍為 `source: 'output'`）。
- 所有 state 回傳另加 `blockedDetection`：`hook`（這個分頁啟動時注入了 BAT hooks）/ `none`（沒注入：非 claude-cli、Settings 關閉、自訂參數已含 `--settings`、找不到 hook 腳本、raw command 模式…）。`none` 的分頁永遠不會回 `blocked`，CT 據此知道 `idle` 不代表「沒有在等人」。
- `terminal:wait` 參數不變；`until: 'state-change'` 會在進入 / 離開 `blocked` 時成立；`fromState` 可為 `blocked`。

**2. 進入 / 離開 `blocked`**

| hook 事件 | 效果 |
|---|---|
| `PermissionRequest` | → `blocked` / `permission`（記 `tool_name`，只進日誌） |
| `PreToolUse`，matcher `AskUserQuestion` | → `blocked` / `question` |
| `Notification`，`notification_type` = `elicitation_dialog` | → `blocked` / `elicitation` |
| `UserPromptSubmit`、`Stop` | 清除 `blocked` |

另外清除：該分頁的**使用者輸入**（本機視窗 / headless client 的 `pty:write`，且非 `isTerminalAutoReply`、非 `{ auto: true }`，與 T0551 / T0566 同一判斷）、PTY 結束、`pty:restart`。

不掛 `PostToolUse`（每次工具呼叫都要啟動一次 node，成本太高）；`Notification` 的 `permission_prompt`（約 6 s 才發）與 `idle_prompt`（約 60 s）不採用。若你認為清除規則有漏洞（例：使用者拒絕 AskUserQuestion 後 claude 沒有任何 hook 就繼續），寫進回報並提出建議，不要自行擴大掛的事件。

**3. 回報 channel** `terminal:report-hook`（只供 helper 經 RemoteServer 呼叫）

- 參數 `{ event: 'permission-request' | 'ask-user-question' | 'elicitation' | 'user-prompt-submit' | 'stop', toolName?: string }`；目標**永遠是呼叫者自己**（權杖綁定的 terminal，沒有 `terminalId` 參數）。
- `HELPER_CHANNEL_ROLES`：tower / worker 皆可（未宣告的 shell 分頁拿的是 tower 權杖，也要能回報）。列進 `proxied-channels-binding.test.ts` REGISTRY_ONLY、`headless-parity.test.ts` HELPER_ONLY、`helper-capability.test.ts` 白名單（14 個）。
- 參數不合 → `INVALID_ARGS`；呼叫者 PTY 不在 → `NOT_FOUND`。不計入 helper denial 節流以外的任何配額；同一分頁短時間大量回報不得拖慢主行程（合併或節流由你決定，寫進回報）。
- 日誌 `[blocked] terminal=<id> → blocked reason=<r> (hook <event>[ tool=<name>])` / `→ cleared (<原因>)`；`bat-scripts.log` 事件 `report-hook`（`event` / `result`）。不記內容、不記權杖。

**4. 注入**（`electron/bat-mcp-launch.ts`，與 BAT MCP 同一入口、同一組條件）

- 只對 `claude-cli` / `claude-cli-worktree`；與 `--mcp-config=` 一起由 `buildBatMcpLaunchArgs` 產生，本機與 headless 共用。
- 方式：`--settings`（指向 `<dataDir>/bat-mcp/claude-settings.json`，或 JSON 字串；選一種並說明理由，比照 `--mcp-config=` 的 variadic 陷阱實測參數形式）。設定檔只含 `hooks`，**不得**含 `disableAllHooks`、權限、模型或任何其他鍵；內容不同才重寫（temp + rename）；無權杖。
- hook 命令：`"${BAT_HELPER_NODE:-node}"` 規則同其他 helper（本機 `node`、headless bundle node），執行 `scripts/bat-hook.mjs <event>`；路徑含空白（`C:\Program Files\...`）時的引號要在 Windows（claude 以 Git Bash 或其他 shell 執行 hook，請查證）與 Linux / macOS 都正確。
- 條件：Settings「BAT MCP」開關（`batMcpEnabled`，預設開）關閉 → 不注入；自訂參數已含 `--settings` → 不注入 hooks（`--mcp-config` 判斷不變）；找不到 `bat-hook.mjs` → 不注入。PtyManager 記錄該分頁的 `blockedDetection`（restart / Terminal Server recovery 沿用，同 T0525 慣例）。
- 已知陷阱（T0574 R2）：使用者 / 專案設定 `disableAllHooks: true` 時 BAT hooks 也停用 → `blockedDetection` 仍是 `hook` 但不會有事件；寫進 CLAUDE.md 已知限制，不要在 `--settings` 寫 `disableAllHooks: false` 反制。
- 日誌沿用 `[bat-mcp] tab|dispatch agent=<id> → injected: …`，加上 hooks 是否注入。

**5. hook 腳本** `scripts/bat-hook.mjs`

- 從 stdin 讀 claude 的 hook JSON（只取 `hook_event_name` / `tool_name` / `notification_type`），用分頁 env 的 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 連 `wss://127.0.0.1`（憑證 pinning 沿用 `_bat-cert.mjs`，回應以 frame id 比對，BUG-114），送一個 `terminal:report-hook` 後結束。
- 遵守 memory_overrides 第 5 條（不影響 claude、不洩漏內容）。不在 BAT 環境（沒有 `BAT_*`）→ 立即 exit 0。
- 隨安裝檔（`extraResources` `*.mjs` 已涵蓋）與 server bundle（`serverBundleHelperScripts`）出貨；`verify-helper-bundle.js` 的 import 檢查要通過。

**6. MCP**：`bat_get_state` / `bat_list_terminals` / `bat_wait` 原樣轉送新欄位；schema 若有 state 列舉要加 `blocked`；摘要文字帶出 `blockedReason`。

**7. 不在本單**：codex（OSC 9 + 句型後援，M1b-2）、Claude Agent SDK 面板、縮圖 UI 標示、`terminal:wait` 新增 `until: 'blocked'`。

## 任務

1. 依契約實作 1–6；本機與 headless 對等。
2. 測試：
   - 單元：狀態機（各事件進入 / 清除、優先序、使用者輸入清除而 `{ auto }` / 終端自動回應不清除、restart / exit 清除、`blockedDetection` 沿用）、`terminal:report-hook` 授權（只影響自己、worker / tower / 未宣告 shell 皆可、參數不合）、注入（設定檔內容只有 hooks 且無權杖、參數形式、關閉 / 自訂 `--settings` / 找不到腳本 / 非 claude 不注入、`blockedDetection` 記錄）、`bat-hook.mjs`（真程序：stdin 各事件 → 正確 invoke；不在 BAT / 連線失敗 → exit 0、stdout 空；不送 `tool_input`）
   - 真 RemoteServer + 範圍權杖：hook 腳本以分頁權杖回報 → `get-state` 回 `blocked`；`wait until=state-change` 在進入 blocked 時返回
   - headless：真 headless + 真 node-pty（比照 `headless-terminal-query-e2e.test.ts`）
   - e2e（新檔，隔離實例，自訂 CLI 跑 node 腳本模擬 claude：以分頁 env 執行 `bat-hook.mjs` 送 `ask-user-question` → 塔台 `get-state` / MCP `bat_get_state` 為 `blocked`；分頁內打字 → 清除；不耗 token）
3. 實機查證（可選，最多 2 次、`--model claude-haiku-5-5`、提示詞極短）：用內嵌或系統 claude 以 `--settings` 跑 `-p`，確認 Windows 上 `UserPromptSubmit` / `Stop` hook 真的會執行 `bat-hook.mjs`（例：用暫時的 log 目錄看到事件）。做不到或判斷不值得就略過，寫進回報，實機留給使用者驗收。
4. `CLAUDE.md` 新增「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節：契約、事件表、清除規則、注入條件、`blockedDetection` 意義、已知限制（`disableAllHooks` / `allowManagedHooksOnly`、`--dangerously-skip-permissions` 下沒有權限提示、AskUserQuestion 被拒的情況、codex 未支援、T0108 replay 的 PTY 沒有記錄）、驗證清單。T0582 小節只把「`blocked` 保留給 M1b，本單不產生」改成指向新小節。

## 驗收條件

1. 在 worktree：`npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元 / 整合 / headless 測試與 e2e 通過。
3. 回報區附：實際注入的命令列片段與設定檔內容、`get-state` 的 `blocked` JSON 範例、hook 腳本一次回報的耗時、實機查證結果（或略過原因）、清除規則的漏洞與建議、與契約的差異（若有）、隔離分支證據。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 契約 1–6 本機與 headless 對等實作；驗收條件 1–3 全部達成。

### 產出摘要

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal` = `basename $CT_HOME`；C-1 工單在 `$CT_HOME/_ct-workorders/`；C-3 `affects_files` 祖先皆存在（PASS）；C-2 無 `branch` 欄位。`CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`、`CT_WORKTREE_BRANCH` = `ct/T0590`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。依賴：worktree 內 `npm ci`（exit 0）。

**新檔**
- `electron/terminal-blocked-state.ts`：`TerminalBlockedTracker`（狀態機、`blockedDetection` 以 terminal id 為鍵、上限 512）、`registerReportHookHandler`（`terminal:report-hook`）
- `scripts/bat-hook.mjs`：hook 腳本（重用 `bat-mcp.mjs` 的 `BatConnection`，新增 `clientName` 選項）
- 測試：`electron/__tests__/terminal-blocked-state.test.ts`（15）、`electron/__tests__/blocked-hooks-launch.test.ts`（11）、`electron/remote/__tests__/headless-blocked-state-e2e.test.ts`（4）、`scripts/__tests__/bat-hook.test.mjs`（5）、e2e `e2e/t0590-blocked-state.spec.ts`

**修改**：`electron/pty-manager.ts`（新區塊 4 個方法 + `clearActivity` / `noteUserInput` / `handleServerDeath` / `dispose` 各一行；未動已結束紀錄）、`electron/terminal-query-handlers.ts`（`stateOf` / list / `STATES`）、`electron/remote/helper-capability.ts`（角色表 + `authorizeHelperInvoke` case）、`electron/bat-mcp-launch.ts`（hooks 注入、`recordBlockedDetection`、日誌）、`electron/terminal-command-handlers.ts`（派工帶 `terminalId`）、`electron/main.ts`、`electron/remote/headless-entry.ts`（接線）、`electron/preload.ts`、`src/types/electron.d.ts`、`src/lib/bat-mcp-launch.ts`、`src/components/WorkspaceView.tsx`（5 處帶分頁 id）、`scripts/bat-mcp.mjs`（schema / 摘要）、`scripts/build-server-bundle.mjs` + `scripts/verify-helper-bundle.js`（bundle 6 個 helper）、三語 `batMcpEnabledHint`、CLAUDE.md（新增「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節；T0582 表格只改 `blocked` 那一句；**未動 T0585 小節**）、既有測試期望值（bat-mcp-launch / terminal-query-handlers / 角色表 14 / parity 清單 / bundle 清單 / t0584 e2e）。`handlers/pty.ts` 不需修改（使用者輸入經既有 `noteUserInput` 清除）。

**實際注入的命令列片段**（Windows pwsh，e2e 實測）：
```
'--mcp-config=<userData>\bat-mcp\claude.json' '--settings=<userData>\bat-mcp\claude-settings.json'
```
**設定檔內容**（`claude-settings.json`，只有 `hooks`，無權杖；e2e 實測，路徑為 worktree）：
```json
{ "hooks": {
  "PermissionRequest": [{ "hooks": [{ "type": "command", "command": "node '<repo>/scripts/bat-hook.mjs' permission-request", "timeout": 5 }] }],
  "PreToolUse": [{ "matcher": "AskUserQuestion", "hooks": [{ "type": "command", "command": "node '<repo>/scripts/bat-hook.mjs' ask-user-question", "timeout": 5 }] }],
  "Notification": [{ "matcher": "elicitation_dialog|elicitation_url_dialog", "hooks": [{ "type": "command", "command": "node '<repo>/scripts/bat-hook.mjs' elicitation", "timeout": 5 }] }],
  "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node '<repo>/scripts/bat-hook.mjs' user-prompt-submit", "timeout": 5, "async": true }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "node '<repo>/scripts/bat-hook.mjs' stop", "timeout": 5, "async": true }] }]
} }
```
參數形式：`--settings=`（claude 2.1.300 `--settings <file-or-json>` 只收一個值，`=` 兩種情況都安全，比照 `--mcp-config=`）；選檔案不選 JSON 字串（hook 命令含引號，放命令列要再為三種 shell 各包一層）。hook 命令引號：claude 2.1.300 二進位實讀 `shell` 說明「Defaults to bash (powershell on Windows without Git Bash)」→ 用 bash 與 PowerShell 都正確的形式：裸字 node + 單引號腳本路徑（Windows 轉 `/`）；測試中實際以 bash 與 pwsh 執行命令，argv 正確。未用 2.1.300 的 exec form（`args`），因較舊 system claude 不認得會把 `node` 當 REPL。

**`get-state` 的 `blocked` JSON 範例**（e2e，塔台經 MCP `bat_get_state`）：
```json
{ "terminalId": "0884ea72557a25e88c9e1b54cd7b4465", "state": "blocked", "lastOutputAt": 1792256124824, "idleMs": 436,
  "blockedReason": "question", "blockedSince": 1792256124911, "source": "hook", "blockedDetection": "hook" }
```
content 摘要：`0884ea72…: blocked (question), idle 436 ms`。

**hook 腳本一次回報耗時**：分頁內 `spawnSync` 量（node 啟動 + TLS + 一個 invoke）**59 ms**（e2e）；headless 與 RemoteServer 測試皆 < 2 s 斷言通過；死 port 3 ms 內結束。

**節流 / 合併**：每次回報 O(1)；日誌只記轉換；`bat-scripts.log` 的 `unchanged` 每分頁每 5 s 最多一筆；不另設配額。

**實機查證**（1 次，內嵌 claude 2.1.300、Windows、`-p "Reply with: ok" --model claude-haiku-5-5 --settings=<file>`，hook 指向本 repo `bat-hook.mjs`、`BAT_REMOTE_PORT=1`、暫存 `BAT_HELPER_LOG_DIR`）：exit 0、stdout `ok`、6.5 s；`bat-scripts.log` 出現 `hook: user-prompt-submit` 與 `hook: stop` 各一筆（`CONNECT_FAILED`，證明兩個 async hook 都由 claude 執行了 `bat-hook.mjs`）。權限 / AskUserQuestion / elicitation 的真實 claude 觸發未實測（需互動），留待使用者實機驗收。

**驗證 lanes**
- build / typecheck：`npx vite build` exit 0；`npm run typecheck` = 0；`npm run typecheck:electron` = 0 — PASS
- 單元：`npm run test:unit` **289 files / 5033 passed / 3 skipped，exit 0** — PASS
- 整合（真 RemoteServer + 範圍權杖 + 真 bat-hook 程序）、headless（真 headless + 真 node-pty）— PASS
- e2e：`npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0584-bat-mcp-shim.spec.ts` → **2 passed (21.6s)** — PASS
- `node scripts/verify-helper-bundle.js` OK（server bundle 6 個 helper）
- 實機 claude hook 執行（UserPromptSubmit / Stop）— PASS；其餘事件 — 未驗（使用者實機）

**與契約的差異**
1. `blockedDetection` 除了啟動決策，**一次被接受的回報也會設為 `hook`**：e2e 規格要求自訂 CLI 分頁（未注入）回報後讀到 `blocked`，與「`none` 永遠不回 blocked」並存只能這樣定義；不變式維持成立。
2. `Notification` matcher 另含 `elicitation_url_dialog`（claude 2.1.300 對 URL 型 elicitation 的類型，二進位實讀）。
3. 清除類 hook（`UserPromptSubmit` / `Stop`）設 `async: true`，避免每次送出 / 結束多等一次 node 啟動；進入類維持同步（回報早於對話框出現）。
4. `terminal:wait until: 'idle'` 以「不是 working」判斷，`blocked` 也成立。
5. `terminal:report-hook` 回傳多 `result`（`blocked` / `cleared` / `unchanged`）與 `state`（`blocked` / `not-blocked`）。沒有 helper 權杖的呼叫（server token / 本機）→ `INVALID_ARGS`。
6. `blockedDetection` 存在 PtyManager 內以 terminal id 為鍵的表（不掛在 instance 上），因 claude-cli 分頁先決定啟動參數、後 `pty:create`；restart / recovery / 結束後皆沿用。
7. bat-scripts.log 欄位名用 `hook`（非 `event`）：兩個 logger 都把 data 展開在 `event` 之後會覆蓋。

### 互動紀錄
無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程
無。

### 遭遇問題
- **清除規則漏洞與建議**（未自行擴大掛的事件）：
  1. 使用者**只用滑鼠**在 claude TUI 點選回答：滑鼠回報屬 `isTerminalAutoReply`，不算使用者輸入，且無 hook → `blocked` 維持到該回合 `Stop`（之後 claude 繼續工作期間仍顯示 blocked）。同理 elicitation 逾時自行關閉、AskUserQuestion 被以其他方式結束。**建議**：加 `PostToolUse` matcher `AskUserQuestion`（只在該工具後啟動 node，成本低）清除 question；加 `PermissionDenied` hook 清除 permission（二進位中有此事件）；允許的權限之後無低成本清除點（`PostToolUse` 不分工具則太貴），仍靠使用者鍵盤輸入 / Stop。
  2. `UserPromptSubmit` 為 async，理論上其清除回報可能晚於同回合極快的 `PreToolUse(AskUserQuestion)` 而誤清（模型回應至少數百 ms、hook ~60 ms，實務上不發生）。若要零風險可改回同步（每次送出多 ~60 ms）。
- 實作過程：Bash heredoc 會吃掉反斜線（L129），改用 Write 寫編輯腳本；`handlers/pty` 靜態 import 會先載入真 node-pty，測試改動態 import。
- 已知限制（已寫進 CLAUDE.md）：`disableAllHooks` / `allowManagedHooksOnly`、`--dangerously-skip-permissions` 無權限提示、codex 未支援、T0108 replay（BAT 重開時 detection 以當下設定重記，blocked 遺失）、headless server 重啟全失。

### 隔離分支證據
- branch：`ct/T0590`
- base_sha：`3362c8aac08cb4be5baab21364a7d07e7ec06fb9`
- validated_sha：`9afdf1109fbe8b673a9f6b8c4957686ed854c7cc`
- head_sha：`9afdf1109fbe8b673a9f6b8c4957686ed854c7cc`
- validated_sha ≠ head_sha 的說明：相同。驗證 gates 在 base `3362c8aa` + 未提交的工作樹上執行，驗證後未再修改任何檔案即原樣 commit 為 `9afdf110`（`git status --porcelain` 為空），故以該 commit 記為 validated_sha。

### 回報時間
2026-10-18T00:59:39+08:00
