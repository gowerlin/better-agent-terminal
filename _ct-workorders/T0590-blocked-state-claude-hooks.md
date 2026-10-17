---
schema_version: 1
schema_kind: workorder
id: T0590
title: "PLAN-047 M1b-1：`blocked` 狀態偵測（claude-cli 分頁以 hooks 回報；`terminal:get-state` / `list` / `wait` 與 MCP 帶出）"
type: feature
status: PENDING
started_at: null
updated_at: "2026-10-18T00:31:47+0800"
completed_at: null
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0590`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
