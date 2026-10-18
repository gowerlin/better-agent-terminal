---
schema_version: 1
schema_kind: workorder
id: T0620
title: "PLAN-047 M1b-2：claude `ElicitationResult` 清除 `blocked: elicitation`（滑鼠回答 / 逾時關閉的清除漏洞）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-18T11:25:51+0800"
started_at: "2026-10-18T11:27:15+0800"
updated_at: "2026-10-18T11:33:47+0800"
completed_at: "2026-10-18T11:33:47+0800"
commit: f1b28724
depends_on: []
related:
  - "`docs/agent-guide/blocked-state.md` 已知限制「清除漏洞」：elicitation 以滑鼠回答或逾時自行關閉時，`blocked` 維持到該回合 `Stop`；候選 `ElicitationResult` hook（claude 2.1.300：`After a user responds to an MCP elicitation`）與 `Notification` 的 `elicitation_complete` / `elicitation_response`"
  - "T0590（hooks 事件表、`terminal:report-hook`）/ T0594（`ask-user-question-done` 只清 `question` 的寫法）/ T0597（`hookEventReason`）/ T0600（`SessionStart`、`claudeHooksDisabledBy`）"
  - "並行：T0619（codex 研究，不改產品檔）"
affects_files:
  - electron/bat-mcp-launch.ts
  - electron/terminal-blocked-state.ts
  - scripts/bat-hook.mjs
  - "electron/__tests__/**、scripts/__tests__/**（相關測試）"
  - "e2e/t0590-blocked-state.spec.ts（若需補案例）"
  - docs/agent-guide/blocked-state.md
  - "CLAUDE.md（只在「blocked 狀態偵測（PLAN-047 M1b / T0590）」節需要時改一句）"
  - _ct-workorders/T0620-claude-elicitation-result-clear.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 非隔離工單，在主 checkout 工作。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>` 或精確 stage。不 push。"
  - "🔴 hook 腳本規則沿用 T0590 / T0600（CLAUDE.md「blocked 狀態偵測」節）：`scripts/bat-hook.mjs` 一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 `HOOK_DEADLINE_MS`；不得在 `--settings` 寫 `disableAllHooks: false`。"
  - "🔴 不改 `terminal:get-state` / `list` / `wait` 的回傳欄位與 `blockedReason` 值域（T0590 / T0600 / T0607 契約）；本單只新增一個清除事件。"
---

# T0620 — claude `ElicitationResult` 清除 `blocked: elicitation`

## 目標

claude 分頁顯示 MCP elicitation 對話框時，BAT 記 `blocked` / `elicitation`（`Notification` matcher `elicitation_dialog|elicitation_url_dialog`）。
目前只有 `UserPromptSubmit` / `Stop` / 使用者鍵盤輸入能清除，所以**滑鼠回答**或**對話框逾時自行關閉**時，`blocked` 會維持到該回合 `Stop`。
本單加一個清除事件，讓 elicitation 結束時立即清除 `elicitation`（只清 `elicitation`，比照 `ask-user-question-done` 只清 `question`）。

## 要做的事

1. **查證**（內嵌 claude 的實際版本，`node_modules/@anthropic-ai/claude-code*` 二進位 / 文件）：`ElicitationResult` hook 是否存在、何時執行（回答 / 拒絕 / 取消 / 逾時各自會不會執行）、payload 欄位；`Notification` 的 `elicitation_complete` / `elicitation_response` 類型是否存在、何時送。選定清除用的事件（可兩者都掛，需說明理由），寫進回報區並標證據等級。
2. **實作**：
   - `BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）新增清除項，`async: true`（claude 不等）。
   - `scripts/bat-hook.mjs` 的 `HOOK_EVENTS` 加新事件名（例如 `elicitation-done`）。
   - `electron/terminal-blocked-state.ts`：新事件只清 `elicitation`；其他 reason（`permission` / `question` / `tower`）時回 `unchanged`。
   - 舊版 `bat-hook.mjs` / 舊設定檔不送這個事件 → 行為與現在相同（向下相容）。
3. **測試**：`electron/__tests__` 的 blocked-state / launch 相關測試補案例（事件表、設定檔內容、只清 `elicitation`、其他 reason 不清、未知事件仍拒絕）；`scripts/__tests__` 的 bat-hook 測試補新事件。e2e `t0590-blocked-state.spec.ts` 若已有 elicitation 案例就補一個清除步驟，沒有就不新增。
4. **文件**：`docs/agent-guide/blocked-state.md` 事件表、清除規則、已知限制（把 elicitation 從「仍未涵蓋」移出，寫明新的涵蓋範圍與仍不涵蓋的情況）；CLAUDE.md 只在必要時改一句。

## 不在本單

- 權限對話框以滑鼠允許 / 拒絕的清除（`PostToolBatch` 成本高，未決定）。
- codex（T0619 研究中）。
- 不改 Claude Agent SDK 面板。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- 若改了 e2e：`npx playwright test e2e/t0590-blocked-state.spec.ts` 通過（需先 `npx vite build`）
- 回報區：查證結論（證據等級）、改動檔案、測試結果、commit hash

---

## 回報區

### 結果摘要

`DONE`。新增清除事件 `elicitation-done`：claude `ElicitationResult` hook 與 `Notification`（matcher `elicitation_response`）都掛（皆 `async: true`），只清 `blocked` / `elicitation`（`HOOK_EVENT_CLEARS_ONLY`），其他 reason / 未 blocked → `unchanged`。`terminal:get-state` / `list` / `wait` 回傳欄位與 `blockedReason` 值域不變。

### 落點檢查

- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`electron/bat-mcp-launch.ts` 等皆存在）；C-2 無 `branch` 欄位（`main`）
- `CT_HOME` 未設定（非隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 查證結論（內嵌 claude `2.1.300`，`node_modules/@anthropic-ai/claude-code/bin/claude.exe` 二進位靜態閱讀；系統 claude 為 2.1.302，未讀）

證據等級：**A** = 二進位原文直接讀到；**B** = 依原文推論、未實機觸發。

1. **`ElicitationResult` hook 存在**（A）：summary `After a user responds to an MCP elicitation`；input `mcp_server_name` / `elicitation_id` / `mode` / `action` / `content`（函式 `QAt`：`hook_event_name:"ElicitationResult"`）；matcher 比對 `mcp_server_name`；exit 2 = 把回應改成 decline、stdout JSON 可改 action / content（BAT 腳本不輸出，且為 async，無影響）。
2. **執行時機**（A）：互動 handler `handle` → `Elicitation` hook（若 hook 直接回應 → 不顯示對話框、不跑 result hook）→ `ask()` 顯示對話框（`requestDialog(fre)`；`fre` 預設值 `{action:"cancel"}`）→ 結束後 `runElicitationResultHooks(...)`（`Kwn`）：先 `ElicitationResult` hook，**之後**送 `Notification` `elicitation_response`（訊息 `Elicitation response for server "<名>": <action>`）。`Kwn` 的三個分支（hook 擋下 / 正常 / hook 出錯）都送 `elicitation_response`。
3. **回答 / 拒絕 / 取消**（A）：三者都是對話框正常結束，`ElicitationResult` 與 `elicitation_response` 都執行。
4. **逾時 / 請求被取消**（B）：hook runner `S0` 在 `signal.aborted` 時 `return []` → **`ElicitationResult` 不執行**（A）；Notification runner `b0` 不帶請求 signal，`elicitation_response` 仍送（A）。對話框在 signal 中止時回預設值的推論：`ask()` 於 `requestDialog` 返回後才檢查 `t.aborted`、bridge 路徑 `GRr` 明寫中止回 `dialog.default`（本機 dialog queue 的中止處理未讀到原文）→ B。
5. **`elicitation_complete`**（A）：URL 型 elicitation 伺服器送 `notifications/elicitation/complete` 時的 Notification；只關閉接受後的「等待完成」畫面（`showWaiting`，帶 `waitingState`，依 `Gbo` 不送 `elicitation_url_dialog`）。可能在原對話框還開著時就到 → **不採用**（會誤清）。
6. `async: true` 對任何 command hook 通用（`lH`：`e.async===!0` → 背景執行）（A）。

**選定**：兩個都掛，對應同一個 `elicitation-done`。理由：`elicitation_response` 涵蓋全部結束路徑（含逾時 / 取消），是主要清除；`ElicitationResult` 不必等使用者自己的 `ElicitationResult` hook 跑完（`elicitation_response` 在它們之後才送），且兩者任一改名另一個仍有效；成本是每次 elicitation 多一個 node 程序（elicitation 罕見），第二次回報為 `unchanged`。

### 改動檔案（commit `f1b28724`）

- `electron/terminal-blocked-state.ts`：`HookReportEvent` / `HOOK_REPORT_EVENTS` 加 `elicitation-done`；`HOOK_EVENT_REASON` → `null`；`HOOK_EVENT_CLEARS_ONLY` 加 `'elicitation-done': 'elicitation'`；檔頭事件表
- `electron/bat-mcp-launch.ts`：`BAT_CLAUDE_HOOKS` 加 `ElicitationResult` 與 `Notification`（`elicitation_response`），皆 `async: true`
- `scripts/bat-hook.mjs`：`HOOK_EVENTS` 加 `elicitation-done`；`HOOK_EVENT_NAMES` 改為陣列（`elicitation-done` 接受 `ElicitationResult` / `Notification`）；`Notification` 非 `elicitation_response` 不送；不送 `content` / `action` / 訊息
- 測試：`electron/__tests__/terminal-blocked-state.test.ts`（狀態機只清 `elicitation`、連續兩次、其他 reason / 未 blocked `unchanged`、反向 `ask-user-question-done` 不清 `elicitation`；channel；相近名稱 `INVALID_ARGS`；真 RemoteServer + 真 `bat-hook.mjs` 程序：`ElicitationResult`（含秘密 `content`）/ `elicitation_response` 各自清除且只送 `{ event }`、其他通知類型不送、舊 BAT `INVALID_ARGS` 仍 exit 0 無 stdout、狀態不變）、`electron/__tests__/blocked-hooks-launch.test.ts`（設定檔內容、無 `elicitation_complete`、事件序）、`scripts/__tests__/bat-hook.test.mjs`（`hookReport` 篩選）
- `docs/agent-guide/blocked-state.md`：事件表、新增「elicitation 結束（T0620）」說明、清除規則、hook 腳本篩選、已知限制（elicitation 移出「仍未涵蓋」並寫明仍不涵蓋者）、驗證清單
- CLAUDE.md：未改（該節只指向 docs，內容仍正確）
- e2e `t0590-blocked-state.spec.ts`：無 elicitation 案例，依工單未新增

向下相容：舊 `bat-hook.mjs` / 舊設定檔不送新事件 → 行為不變；新設定檔 + 舊 BAT → `INVALID_ARGS`、hook exit 0、狀態不變（已測）。

### 驗收

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：301 files passed、5237 passed / 3 skipped（5240） |
| `npm run typecheck` | PASS：0（exit 0） |
| `npm run typecheck:electron` | PASS：0（exit 0） |
| `npx vite build` | PASS（exit 0） |
| e2e | 未改，不適用 |
| 實機（真 claude + MCP elicitation） | 未執行：需能發 elicitation 的 MCP server 與互動操作；查證為二進位靜態閱讀 |

### 已知限制 / 後續

- 多個 MCP server 同時 elicitation：前一個的 async 清除回報可能晚於下一個對話框的 `elicitation_dialog` 回報而誤清（`elicitation_dialog` payload 無 `elicitation_id`，無法對應），之後少報 `blocked` 直到回答下一個（已寫入 docs）。
- 依賴 `ElicitationResult` / `elicitation_response` 字串，claude 改名時需同步改。
- 建議實機驗收：在 claude-cli 分頁觸發一次 form elicitation，以滑鼠回答，debug log 應見 `→ cleared (hook elicitation-done)`。

### Commit

- 產品：`f1b28724`（只含上列 7 檔；`src/styles/settings.css` 與 T0619 工單的修改不是本單的，未碰）
- 工單：本次回報 commit（見 git log）
