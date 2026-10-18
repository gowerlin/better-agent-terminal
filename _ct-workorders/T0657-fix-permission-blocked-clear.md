---
schema_version: 1
schema_kind: workorder
id: T0657
title: "BUG-162：查明 yolo Worker 的 Bash 為何觸發 `PermissionRequest`、由誰放行；權限請求結束後清除 `blocked` / `permission`（評估 `PostToolBatch` / `PostToolUse` 成本後實作）"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-162
priority: P2
sizing: M
created_at: "2026-10-18T19:30:08+0800"
started_at: "2026-10-18T19:31:25+08:00"
updated_at: "2026-10-18T19:52:06+08:00"
completed_at: "2026-10-18T19:52:06+08:00"
depends_on: []
related:
  - "BUG-162（使用者截圖；debug log 第 2634 行 `→ blocked reason=permission (hook permission-request tool=Bash)`，terminal `9e13a14065edf2130036ef0c4869d0b6` = T0656 Worker，claude session id `17d6ac32-f620-4f1c-ae43-148976d22a46`）"
  - "契約與實作：CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」節；`docs/agent-guide/blocked-state.md`（事件表、清除規則、已知限制的「清除漏洞」與候選 `PostToolBatch`）；`BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）、`scripts/bat-hook.mjs`、`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）；T0594 / T0597 / T0620 的前例；縮圖 ⚠️ `workerAttention`（`src/lib/terminal-attention.ts`，T0609）"
affects_files:
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - electron/terminal-blocked-state.ts
  - "electron/__tests__/terminal-blocked-state.test.ts、electron/__tests__/blocked-hooks-launch.test.ts、scripts/__tests__/bat-hook.test.mjs、electron/remote/__tests__/headless-blocked-state-e2e.test.ts（擴充）"
  - "docs/agent-guide/blocked-state.md；CLAUDE.md（只在「blocked 狀態偵測」節的必守規則改變時動一句）"
  - _ct-workorders/T0657-fix-permission-blocked-clear.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **先查明再修**（寫進回報區，標實測 / 原始碼 / 推論）：① 2026-10-18T11:22:52Z 那次 `PermissionRequest(Bash)` 的來源——唯讀查 T0656 Worker 的 claude transcript（`~/.claude/projects/<該專案>/17d6ac32-f620-4f1c-ae43-148976d22a46.jsonl`，只看那個時間點前後的 tool_use / 權限相關紀錄；回報**不得**貼命令全文或任何內容，只寫命令類型與權限判斷結果）、該 Worker 實際的啟動參數（是否有 `--dangerously-skip-permissions`，看 BAT 日誌的派工命令或 PTY 命令列，不印權杖）、claude 版本；② bypass 模式下哪些 Bash 情況仍會執行 `PermissionRequest` hook、之後由誰放行（自動模式分類器、受保護路徑、sandbox、其他 hook…），以內嵌 / 系統 claude 二進位字串與官方文件查證，標版本；③ 放行（允許 / 拒絕 / 自動）之後 claude 會執行哪些 hook（`PostToolUse` / `PostToolUseFailure` / `PostToolBatch` / `PermissionDenied`…），可用於清除的是哪個。"
  - "🔴 **修正原則**：只清 `permission`（比照 T0594 / T0620 的 `HOOK_EVENT_CLEARS_ONLY`：不得誤清 `question` / `elicitation` / codex `input` / `tower`）；平行工具呼叫中另一個權限對話框仍開著時不得誤清（若選定的 hook 無法區分，回報說明風險與取捨）。清除類 hook 一律 `async: true`。比較 `PostToolBatch`、全工具 `PostToolUse`（+ `PostToolUseFailure`）等候選的成本（每次工具呼叫多啟動一個 node 的實測耗時，`bat-hook.mjs` 已有 1.8 s 總時限）與正確性，選一個並寫明理由；若成本不可接受，改提替代（例如只在已是 `blocked` / `permission` 時才需要的作法），不要硬上。"
  - "🔴 `bat-hook.mjs` 規則不變：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、不送 `tool_input` / `tool_response`；新事件名在舊 BAT 回 `INVALID_ARGS` 時仍 exit 0。不得在 `--settings` 寫 `disableAllHooks: false`。介面契約（T0590 / T0600 的欄位、值域、優先序）不變。"
  - "🔴 測試：狀態機（只清 `permission`、其他 reason `unchanged`）、hook 表（新 entry、async、matcher）、真 `bat-hook.mjs` 程序（新事件送出、不送內容、exit 0 無 stdout）、headless e2e（真 node-pty：permission → 新事件 → 離開 blocked，無 client 輸入）。不耗 token；不呼叫模型。🔴 **不要執行 Playwright e2e**（`playwright.config.ts` 的 `outputDir` 是 `e2e-results`，會清空；且 T0656 正在跑隔離實例）；e2e spec 若需要更新期望值，改檔不跑、回報列出待跑的 spec。"
  - "🔴 非隔離工單。T0656（`e2e/**`、`site/**`、`README.md`、`assets/**`、`.gitignore`、`playwright.config.ts`）同時進行，不碰它的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0657 — 權限請求放行後清除 ⚠️

## 背景

使用者截圖：T0656 Worker 的縮圖顯示 ⚠️（等使用者），但 Worker 一直在執行、沒有等輸入。BAT 日誌：19:22:52（本地）`→ blocked reason=permission (hook permission-request tool=Bash)`。BAT 的 `permission` 只在 `UserPromptSubmit` / `Stop` / 使用者輸入時清除，所以權限請求在沒有鍵盤輸入的情況下被放行後，⚠️ 會留到該回合 `Stop`（`docs/agent-guide/blocked-state.md` 已知限制）。CT yolo Worker 以 `--dangerously-skip-permissions` 啟動，原本預期一般工具不會有權限請求，這次 Bash 為何會有、由誰放行，尚未知道。詳見 BUG-162。

## 要做的事

1. 查明（見 memory_overrides 第 1 點），回報區附證據。
2. 選定清除用的 hook 並說明成本 / 正確性取捨；實作（hook 表、`bat-hook.mjs`、狀態機）。
3. 測試（見 memory_overrides）。
4. `docs/agent-guide/blocked-state.md`：事件表、清除規則、已知限制更新；CLAUDE.md 只在必守規則改變時動一句。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功

## 驗收

- 權限請求被放行（不經鍵盤）後，分頁離開 `blocked` / `permission`；其他 reason 不受影響
- 回報區附：觸發來源與放行者查證、候選比較與選擇理由、測試清單、待跑的 e2e、commit
- 只改 `affects_files`；未 push

## 回報區

### 待塔台決策

#### Q-1：`PostToolBatch` 清除要不要依 `agent_id` 區分（需改 affects_files 外的 `electron/pty-manager.ts` 一行轉傳）？
- 提問時間：2026-10-18T19:36:20+0800
- 選項：[A] 准許改 `electron/pty-manager.ts`：`reportHookEvent` 多一個 `agentId?` 參數原樣轉給 `TerminalBlockedTracker.report`（只此一行簽章 + 一行轉傳）；`permission-request` 記下發出者的 `agent_id`（主執行緒 = 空），`post-tool-batch` 只清同一個 agent 的權限、所有 agent 都清完才離開 `blocked` / [B] 不改 pty-manager.ts、不分 agent：任何 `PostToolBatch` 都清 `permission`，回報區寫明風險 / [C] 其他：________
- Worker 建議：[A]。claude 2.1.302 的 hook payload 共同欄位帶 `agent_id`（subagent 才有），`PostToolBatch` 在同一 agent 內本來就等整批工具（含平行的權限對話框）都結束才執行，所以同 agent 不會誤清；但背景 subagent 的權限對話框開著時，主執行緒（或另一個 subagent）的批次結束會把它誤清（⚠️ 消失、實際仍在等人）。[A] 消掉這個誤清，代價只是 pty-manager.ts 一行轉傳；[B] 範圍較小，但留下誤清風險。
- 影響範圍：`electron/pty-manager.ts`（`reportHookEvent` 簽章與轉傳，僅此）、`electron/terminal-blocked-state.ts`（tracker / handler 多 `agentId`）、`scripts/bat-hook.mjs`（送 `agentId`）、對應測試。
- 阻塞：否（先做 hook 表、bat-hook、狀態機與測試；收尾前依答覆定案）

### 完成狀態

**FIXED**（實作與單元 / headless e2e 測試完成；待實機驗收：Worker 再遇到 bypass 下的權限提示、不經鍵盤結束後 ⚠️ 消失）。

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`affects_files` 前 5 項皆存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）
- 非隔離工單（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 查證：觸發來源與放行者

1. **那次 `PermissionRequest(Bash)` 的來源**（實測：T0656 Worker transcript `17d6ac32-….jsonl`，只讀 metadata，不含命令內容）
   - 2026-10-18T11:22:52.669Z 一個 Bash 呼叫（命令類型：`rm`，目標為磁碟根層目錄），BAT 日誌 11:22:52.774Z `→ blocked reason=permission (hook permission-request tool=Bash)`。
   - 11:24:52.711Z（**整 120 s** 後）tool_result `is_error`，`permissionDecision: { decision: "reject", source: "config", reasonType: "safetyCheck" }`、`toolDenialKind: permission-rule`，訊息為 claude 內建「危險 rm」安全檢查（"This command would remove a critical system directory. This requires explicit approval and cannot be auto-allowed by permission rules."；"no person did (the permission prompt timed out …)"）。同 session 其他 92 次工具呼叫皆 `{ decision: accept, reasonType: mode }`。
   - 之後回合繼續（11:25:01 下一個工具呼叫），沒有任何鍵盤輸入 → BAT 一直 `blocked` / `permission`（11:29:22 塔台 get-state 仍 `reason=permission`）。
   - **放行者 = claude 自己的 120 s 逾時拒絕**，不是使用者、不是分類器、不是其他 hook。
2. **Worker 啟動參數與版本**（實測：BAT debug log `debug-20261018-175554.log`、settings.json，不含權杖）：系統 claude `C:\Users\Gower\.local\bin\claude.exe` **2.1.302**（`claudeRuntime.mode = system`）；BAT 自訂參數 `claude-cli = --dangerously-skip-permissions --effort high`（`argsSource=settings`）；transcript `permission-mode` = `bypassPermissions`；BAT 注入 `--mcp-config=` / `--settings=` / `--name=`、`hooks=yes`。
3. **bypass 下為何仍有 `PermissionRequest`、誰放行**（原始碼：claude 2.1.302 二進位內嵌 JS 靜態閱讀；內嵌 2.1.300 也有同樣的 `PostToolBatch` 字串）：
   - 安全檢查回 `behavior: "ask"`、`decisionReason.type: "safetyCheck"`、`classifier_approvable: false`（"dangerous rm"、Windows path bypass 等需手動核准），bypass 模式不跳過；`Mxn()` 給它一個 `autoDenyWindow`。
   - 設定 `tengu_splendid_horizon` 預設 `{ enabled: true, showDialog: true, timeoutMs: 120000, maxDialogTimeouts: 3 }`；逾時 → `tengu_safety_check_dialog_auto_denied`、`logDecision({ decision: "reject", source: "config" })`，回一般 deny tool_result；同 session 已 3 次沒人回答 → 不再顯示對話框、直接拒絕（`tengu_safety_check_dialog_capped`，不執行 `PermissionRequest`）。`CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT` 可關逾時。
   - `PermissionRequest` hook（`executePermissionRequestHooks`）在對話框顯示前同步執行 → BAT 記 `permission`（符合日誌時間差約 100 ms）。
4. **放行之後 claude 執行哪些 hook**（原始碼）：
   - `PermissionDenied`：只在 `decisionReason.type === "classifier"` 且 `classifier === "auto-mode"` 時（逾時拒絕不會）。
   - `PostToolUse` / `PostToolUseFailure`：只在工具實際執行後；被拒的呼叫直接寫 deny tool_result，兩者都不執行。
   - **`PostToolBatch`**：主迴圈在該批所有工具呼叫結束（允許 / 拒絕 / 逾時拒絕）後、下一次模型請求前執行一次（MCP end-turn 路徑也執行），payload 有 `tool_calls` 與共同欄位（含 subagent 的 `agent_id`）。→ 可用於清除的只有 `PostToolBatch`。
   - 使用者在對話框按拒絕：走 `cancelAndAbort`（推論：中止回合、不到 `PostToolBatch`；未實測，鍵盤拒絕本來就算輸入會清）。
5. 舊 claude 相容（原始碼）：2.1.302 對設定檔中不認得的 hook 事件只警告並忽略該項（`Unknown hook event "…" was ignored`），不影響其他 hook；更舊的系統 claude 未查證。

### 候選比較與選擇

| 候選 | 涵蓋允許 / 拒絕 / 逾時 | 平行權限對話框 | 成本 |
|---|---|---|---|
| 全工具 `PostToolUse`（+ `PostToolUseFailure`） | 只涵蓋允許（被拒的呼叫兩者都不執行） | 同批另一個工具完成即誤清 | 每次工具呼叫一個 node（T0656：151 次 / 31 分） |
| `PermissionDenied` | 只有 auto-mode classifier | — | 低 |
| **`PostToolBatch`（採用）** | 三種都涵蓋 | 同一 agent 內等整批結束才執行，不誤清；跨 agent 以 `agent_id` 區分（Q-1） | 每批一個 node（T0656：126 批 / 31 分，少約 17%） |

成本實測（Windows、node 24.22.0、`bat-hook.mjs post-tool-batch`、20 KB payload、各 10 次中位數；`async: true`，claude 不等）：node 本身啟動 37 ms；不在 BAT 46 ms；死 port 52 ms；對已安裝 BAT（回 `INVALID_ARGS`）56 ms，回報本身 6–7 ms。判斷：背景約 56 ms / 批、每分鐘約 4 批，可接受。

### 實作

- `electron/bat-mcp-launch.ts`：`BAT_CLAUDE_HOOKS` 加 `{ hookEvent: 'PostToolBatch', event: 'post-tool-batch', async: true }`（無 matcher）。
- `scripts/bat-hook.mjs`：新事件 `post-tool-batch`（`hook_event_name` 必須是 `PostToolBatch`；`agent_id` 不存在或合法才送，認不出的不送）；`permission-request` 另送合法的 `agentId`；只讀 `tool_input` / `tool_calls` 之前的頂層欄位（`HOOK_INPUT_STOP_FIELDS`、`hookInputPrefix`），大批次不受 256 KiB 上限影響；`bat-scripts.log` 多 `agent`。規則不變：exit 0、stdout 不輸出、失敗靜默、不送 `tool_input` / `tool_response` / `tool_calls`。
- `electron/terminal-blocked-state.ts`：`post-tool-batch` 加入 `HOOK_REPORT_EVENTS`、`HOOK_EVENT_CLEARS_ONLY` = `permission`；tracker 以 `permissionAgents` 記每個分頁有權限請求的 agent（主執行緒 = 空字串），批次只移除自己的 agent、全部移除才清除；上限 `PERMISSION_AGENTS_MAX` = 32，超過 → 退回「任何批次都清」並記一行日誌；離開 `permission` 即忘掉。handler 驗證 `agentId`（`HOOK_AGENT_ID_PATTERN`，同 toolName 規則）：只用於 `permission-request` / `post-tool-batch`，不合 → `INVALID_ARGS`（選這個而不是當主執行緒，避免誤清），其他事件忽略；mirror 多 `agent`。
- `electron/pty-manager.ts`：`reportHookEvent` 多 `agentId?` 參數並轉給 tracker（Q-1 准許，見偏離）。
- `docs/agent-guide/blocked-state.md`：事件表、「權限請求結束（T0657）」節、清除規則、channel 參數、hook 腳本、日誌、已知限制、驗證清單。CLAUDE.md 未改（必守規則未變）。
- 介面契約（T0590 / T0600 欄位、值域、優先序）不變；未寫 `disableAllHooks`。

### 測試清單

- `electron/__tests__/terminal-blocked-state.test.ts`（+5 個）：`post-tool-batch` 只清 `permission`（`question` 含 T0597 組合、`elicitation`、未 blocked → `unchanged`；其他清除事件不清 `permission`）；依 agent 清除、`blockedSince` 不變、離開 `permission` 後忘掉；32 上限與退回日誌；channel（清除、`agentId` 不合 → `INVALID_ARGS`、其他事件忽略、mirror `agent`、相近名稱 `INVALID_ARGS`）；真 RemoteServer + 真 `bat-hook.mjs` 程序（400 KiB 批次仍清除、subagent 只被自己的批次清、認不出的輸入不送、不送 `tool_calls` / `tool_input`、exit 0 無 stdout）；T0657 前的 BAT（`agentId` 被忽略、`post-tool-batch` 回 `INVALID_ARGS` → exit 0 無 stdout / stderr、狀態不變）。舊 BAT 忽略多餘欄位另以原始碼確認：HEAD 版 handler 只讀 `event` / `toolName` / `sessionId`。
- `electron/__tests__/blocked-hooks-launch.test.ts`：設定檔多 `PostToolBatch`（無 matcher、async）、仍無全工具 `PostToolUse` / `PostToolUseFailure` / `PermissionDenied`、事件序。
- `scripts/__tests__/bat-hook.test.mjs`（+5 個）：`hookReport` 的 `post-tool-batch` / `agentId`、`hookInputPrefix`、`readHookInput` stop field、`reportHook` 帶 `agentId` 與舊 BAT 回 `INVALID_ARGS`。
- `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`（+1 個）：真 headless + 真 node-pty，permission → 3 s 後 post-tool-batch → 離開 `blocked`、無 client 輸入；subagent 的權限經過主執行緒的批次仍 `blocked`、自己的批次後離開。
- 不耗 token、不呼叫模型；未執行 Playwright。

### 驗證

- `npm run typecheck` = **0**（exit 0）；`npm run typecheck:electron` = **0**（exit 0）
- `npm run test:unit`：**314 files passed / 5463 passed / 3 skipped**（第二次全跑）。第一次全跑 1 失敗：`electron/__tests__/bat-mcp-codex-env.test.ts` 的 `afterEach` `rmSync` 10 s 逾時（codex、與本單無關，並行負載下 Windows 檔案鎖），單獨重跑 5/5 通過、第二次全跑通過。
- `npx vite build`：成功（exit 0）
- 已安裝 BAT 實機（舊 BAT）：新 `bat-hook.mjs post-tool-batch` 對自己的分頁回 `INVALID_ARGS`，exit 0、stdout 0 bytes（日誌寫到 scratchpad）。

### 待跑的 e2e

- 🔴 `e2e/t0590-blocked-state.spec.ts` 第 280 行 `Object.keys(parsed.hooks)` 需在 `'ElicitationResult'` 之後加 `'PostToolBatch'`，否則會失敗。本單**未改**：`e2e/**` 屬同時進行的 T0656（工單禁止碰）。改完後需 `npx vite build` 再跑該 spec。
- 其他（`e2e/t0584-bat-mcp-shim.spec.ts`、`e2e/t0600-launch-confirmation.spec.ts`）grep 未見事件清單比對，建議一併跑一次。

### 偏離

- 改了 affects_files 外的 `electron/pty-manager.ts`（`reportHookEvent` 簽章、轉傳與註解），依塔台 Q-1 答覆 [A] 准許，視為 affects_files 追加。
- frontmatter `status` 原為 `TODO`（非 `PENDING`），照 IN_PROGRESS → FIXED 處理。

### 遭遇問題

- 無阻塞。Bash 工具的 heredoc 遇到部分內容會解析失敗，改寫成 scratchpad 腳本或檔案再套用。

### Commit

- `ff14fa5d` fix(blocked): clear a permission prompt when its tool batch resolves (T0657, BUG-162)：產品 + 測試 + docs（9 檔）
- `ebba77e8` chore: T0657 Q-1 to tower (ct)；本工單收尾另有一個 commit
- 未 push

### 互動紀錄

- [19:37] Q-1: `PostToolBatch` 清除要不要依 `agent_id` 區分（需改 `electron/pty-manager.ts`）？ → A（塔台，BAT 通道）: [A] 准許改 pty-manager.ts（僅 `reportHookEvent` 多 `agentId?` 並轉傳，記偏離）；條件：① handler 驗證格式、不合當主執行緒或 `INVALID_ARGS` 擇一寫明，只用於兩個事件 ② 每分頁 agent 上限（例 32），超過行為寫明（建議退回任何批次都清 + 日誌）③ 舊 BAT 收到多餘 `agentId` 不得因此失敗或仍 exit 0 且狀態不變，測試涵蓋 ④ 日誌可記 agentId，不得記 tool_input / tool_response → Action: 照做；① 選 `INVALID_ARGS`、② 上限 32 + 退回與日誌、③ 舊 BAT 模擬測試 + HEAD 原始碼確認、④ 日誌只記 agent id。
