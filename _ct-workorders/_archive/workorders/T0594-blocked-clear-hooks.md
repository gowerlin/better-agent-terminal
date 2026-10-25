---
schema_version: 1
schema_kind: workorder
id: T0594
title: "PLAN-047 M1b-1 補強：`blocked` 加兩個清除 hook（`PostToolUse` AskUserQuestion、`PermissionDenied`），補滑鼠回答時一直掛著的漏洞"
type: feature
status: DONE
started_at: "2026-10-18T01:43:21+0800"
updated_at: "2026-10-18T01:52:52+0800"
completed_at: "2026-10-18T01:52:52+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T01:41:50+0800"
target_version: "0.7.0-pre.4"
depends_on: [T0590]
related:
  - "T0590 回報區「遭遇問題」第 1 點（清除規則漏洞與建議）；CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節"
  - "並行工單 T0593（BUG-149：`electron/terminal-command-handlers.ts` 等 shell family）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - "scripts/bat-mcp.mjs（只在 tool 說明需要時）"
  - "electron/__tests__/terminal-blocked-state.test.ts、electron/__tests__/blocked-hooks-launch.test.ts、scripts/__tests__/bat-hook.test.mjs、electron/remote/__tests__/headless-blocked-state-e2e.test.ts、electron/__tests__/bat-mcp-launch.test.ts"
  - e2e/t0590-blocked-state.spec.ts
  - "CLAUDE.md（只改「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節）"
  - _ct-workorders/T0594-blocked-clear-hooks.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0593 同時在主 checkout 改 `electron/terminal-command-handlers.ts`、`electron/shell-path-resolver.ts`、可能的 `electron/pty-manager.ts`（預設 shell accessor）、`e2e/t0592-codex-tower-worker.spec.ts` 與 CLAUDE.md 的「BAT MCP shim」小節。你不碰這些檔；`CLAUDE.md` 若兩邊都有改，commit 時只納入**你自己的 hunk**（`git apply --cached` 挑出，T0585 做法），commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、stdout 不輸出、不影響 claude 決策、不送 `tool_input` / 內容 / 權杖。不得呼叫模型做驗證以外的事；實機查證最多 1 次、`--model claude-haiku-5-5`、提示詞極短，可略過。"
---

# T0594 — `blocked` 清除 hook 補強

## 背景

T0590 的清除點是 `UserPromptSubmit` / `Stop` / 使用者鍵盤輸入 / PTY 結束。使用者**只用滑鼠**在 claude TUI 回答 AskUserQuestion 或拒絕權限時，滑鼠回報屬終端自動回應、不算輸入，也沒有 hook → `blocked` 一直掛到該回合 `Stop`（claude 繼續工作期間仍顯示 blocked）。T0590 Worker 建議加兩個只在特定情況才啟動 node 的 hook。

## 介面契約變更（在 T0590 契約上增補）

- `terminal:report-hook` 的 `event` 增加：
  - `ask-user-question-done`：`PostToolUse`，matcher `AskUserQuestion` → 若目前 `blocked` 且 `blockedReason` = `question` → 清除
  - `permission-denied`：`PermissionDenied`（請以內嵌 claude 2.1.300 二進位 / 官方 hooks 文件確認事件名與 payload；不存在則不加並在回報說明）→ 若目前 `blockedReason` = `permission` → 清除
- 原因不符時不清除（例：`question` 卡住時收到 `permission-denied` → `unchanged`）。
- 兩個新 hook 都設 `async: true`、`timeout` 同既有（清除類）。
- 舊 BAT 主程式收到新的 `event` 值會回 `INVALID_ARGS`：hook 腳本照樣 exit 0、靜默（版本混搭不影響 claude）。
- **不加** `PostToolUse` 全工具 matcher（成本），允許的權限仍靠鍵盤輸入 / `Stop` 清除，寫進已知限制。

## 任務

1. `bat-mcp-launch.ts` 的 hooks 設定加兩項；`terminal-blocked-state.ts` 狀態機與 `terminal:report-hook` 參數驗證加兩個事件；`bat-hook.mjs` 對應 stdin 事件名。
2. 測試：狀態機（各原因配對 / 不配對）、設定檔內容（新 matcher、`async`）、`bat-hook.mjs` 真程序（新事件、舊 BAT 回 `INVALID_ARGS` 仍 exit 0 且 stdout 空）、headless e2e 測試、`e2e/t0590-blocked-state.spec.ts` 加一段：`ask-user-question` → `blocked` → `ask-user-question-done` → 清除（不經鍵盤）。
3. CLAUDE.md「blocked 狀態偵測」小節：事件表、清除規則、已知限制（滑鼠回答的漏洞改寫：AskUserQuestion / 拒絕權限已涵蓋，允許權限仍未涵蓋）。不改其他小節。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. `npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0584-bat-mcp-shim.spec.ts` 通過。
3. 回報區附：新的設定檔 hooks 片段、`PermissionDenied` 查證結果（事件名、payload 欄位、來源）、實機查證結果或略過原因。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（`permission-denied` 依工單「不存在則不加並在回報說明」條款未加：事件存在但語意不符，見「遭遇問題」1）

落點檢查：**PASS** — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 全部存在；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_HOME` 未設（非 worktree 派工）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

commit `b571c98e` `feat(blocked): clear a question when AskUserQuestion finishes (T0594)`（9 檔，`git commit --only`；`src/styles/settings.css` 未納入）。

- `electron/terminal-blocked-state.ts`：`HookReportEvent` / `HOOK_REPORT_EVENTS` 加 `ask-user-question-done`（`HOOK_EVENT_REASON` = `null`，清除類）；新增 `HOOK_EVENT_CLEARS_ONLY = { 'ask-user-question-done': 'question' }`，`TerminalBlockedTracker.report` 對它只在目前 `reason === 'question'` 時清除，其他 reason / 未 blocked → `unchanged`（state 照實回傳）。`terminal:report-hook` 的參數驗證沿用 `HOOK_REPORT_EVENTS`，自動接受新事件；`permission-denied` 仍是 `INVALID_ARGS`。
- `electron/bat-mcp-launch.ts`：`BAT_CLAUDE_HOOKS` 加 `{ hookEvent: 'PostToolUse', matcher: 'AskUserQuestion', event: 'ask-user-question-done', async: true }`；`claudeHookSettingsContent` 改成同一 hookEvent 可累加多個 matcher（原本以 key 覆寫，第二個同名事件會蓋掉第一個）。
- `scripts/bat-hook.mjs`：`HOOK_EVENTS` / `HOOK_EVENT_NAMES` 加 `ask-user-question-done` ↔ `PostToolUse`；`tool_name` 不是 `AskUserQuestion` → 不送；只送 `{ event }`，不送 `tool_input` / `tool_response`（答案）。
- `scripts/bat-mcp.mjs`：tool 說明不需改（未動）。
- 測試：`terminal-blocked-state.test.ts`（狀態機配對 / 不配對、channel 回傳、`permission-denied` INVALID_ARGS；真 RemoteServer + 真 `bat-hook.mjs`：PostToolUse 清除、其他工具不送、`tool_response` 不上線；模擬 T0590 BAT 回 `INVALID_ARGS` → exit 0、stdout 空、狀態不動、`bat-scripts.log` `result: failed code: INVALID_ARGS`）、`blocked-hooks-launch.test.ts`（PostToolUse 片段、無 `PermissionDenied` / `PostToolUseFailure` / `PostToolBatch`、`BAT_CLAUDE_HOOKS` ⊂ `HOOK_REPORT_EVENTS`）、`bat-hook.test.mjs`、`headless-blocked-state-e2e.test.ts`（driver 支援 `then`：一個鍵入指令先 ask、隔 3 s done，期間無 client 輸入 → 離開 blocked）、`e2e/t0590-blocked-state.spec.ts` 3b 段（見下）。
- `CLAUDE.md`：只改「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節（事件表、PostToolUse / PermissionDenied 說明、清除規則、hook 腳本不送 `tool_response`、清除漏洞改寫、驗證）。

**新的設定檔 hooks 片段**（e2e 隔離實例實際寫出的 `claude-settings.json`，新增項）：

```json
"PostToolUse": [
  {
    "matcher": "AskUserQuestion",
    "hooks": [
      {
        "type": "command",
        "command": "node 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal/scripts/bat-hook.mjs' ask-user-question-done",
        "timeout": 5,
        "async": true
      }
    ]
  }
],
```

key 順序：`PermissionRequest`、`PreToolUse`、`Notification`、`PostToolUse`、`UserPromptSubmit`、`Stop`。

**驗收**

| 項目 | 結果 |
|---|---|
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npm run test:unit` | PASS：291 files / 5071 passed、3 skipped（commit 前最後一次 comment 修改後再跑相關 2 檔 24 項 PASS） |
| `npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0584-bat-mcp-shim.spec.ts` | PASS：2 passed（28.6 s；t0590 16.4 s） |

e2e 3b 實測：Worker 第二次 `ask-user-question`（54 ms）→ 塔台 MCP `bat_get_state` = `blocked (question)` → 6 s 後 Worker 執行 `ask-user-question-done`（exit 0、stdout 空），不經鍵盤 → `bat_wait fromState=blocked` `changed: true`、state 非 blocked；debug log `[blocked] terminal=<worker> → cleared (hook ask-user-question-done)`；`bat-scripts.log` `bat-hook` `ask-user-question-done` `cleared`。

**`PermissionDenied` 查證**（來源：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` `2.1.300 (Claude Code)` 二進位實讀）

- 事件名：`PermissionDenied`（存在；executor `executePermissionDeniedHooks`）。
- 說明：summary `After auto mode classifier denies a tool call`；`Input to command is JSON with tool_name, tool_input, tool_use_id, and reason.`；可回 `{"hookSpecificOutput":{"hookEventName":"PermissionDenied","retry":true}}`；matcher 比對 `tool_name`。
- payload：`hook_event_name: "PermissionDenied"`、`tool_name`、`tool_input`、`tool_use_id`、`reason`（加共同欄位）。
- 執行條件：tool 執行路徑在 `behavior !== 'allow'` 分支內，**只有** `decisionReason?.type === "classifier" && decisionReason.classifier === "auto-mode"` 才呼叫。使用者在權限對話框按拒絕的 deny 路徑直接 `return`：不呼叫任何 hook（無 `PermissionDenied`、無 `PostToolUse` / `PostToolUseFailure`，tool 未執行）。
- 結論：不加。auto-mode classifier 拒絕時沒有顯示對話框（不會先有 `permission-request`），且平行工具呼叫中另一個工具的權限對話框仍開著時收到它會**誤清**。已寫入 CLAUDE.md 事件表下方與已知限制。

**實機查證**（1 次，內嵌 claude 2.1.300、Windows、`-p "Reply with exactly: ok" --model claude-haiku-5-5 --settings=<本單產生的 claude-settings.json>`，hook 指向本 repo `scripts/bat-hook.mjs`，`BAT_REMOTE_PORT=1`（死 port）、`BAT_HELPER_LOG_DIR` 為 scratchpad）：claude 接受含 `PostToolUse` matcher + `async` 的設定檔、輸出 `ok`（7.1 s），`bat-scripts.log` 有 `user-prompt-submit` / `stop` 各一筆 `CONNECT_FAILED`（3 ms）。`PostToolUse(AskUserQuestion)` 本身未觸發（`-p` 無互動，AskUserQuestion 無法以真實 claude 回答），由使用者實機驗收。

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Renew 歷程

無。

### 遭遇問題

1. **`PermissionDenied` 不涵蓋使用者拒絕**（見上方查證）。工單契約的 `permission-denied` 依「不存在則不加」條款未實作；`terminal:report-hook` 收到它回 `INVALID_ARGS`（測試守住）。權限對話框以**滑鼠**允許或拒絕仍未涵蓋（維持到 `Stop` / 鍵盤輸入）。
2. **其他可補的候選**（未實作，需塔台決定，已寫進 CLAUDE.md 已知限制）：claude 2.1.300 有 `ElicitationResult` hook（`After a user responds to an MCP elicitation`）與 `Notification` 的 `elicitation_complete` / `elicitation_response` 類型 → 可清 `elicitation`（成本低，只在 elicitation 後執行）；`PostToolBatch`（`Fires once after every tool call in a batch has resolved`，payload 含 `tool_calls[]`）可在權限允許 / 拒絕後清 `permission`，但每批工具呼叫都啟動 node，成本同全工具 `PostToolUse`。以滑鼠拒絕權限後 claude 通常結束回合，`Stop` 在該路徑是否執行未查證。
3. AskUserQuestion 被拒絕 / 取消時 tool 不執行、沒有 `PostToolUse`（Esc 取消屬鍵盤輸入，會清）。
4. 並行：T0593 在本單執行期間 commit（`e283abdc` 等）；本單 build / e2e / unit 跑在含 T0593 變更的工作樹上，全綠。本單 commit 只含自己 9 檔，CLAUDE.md 只有「blocked 狀態偵測」小節一個 hunk。

### 回報時間

2026-10-18T01:52:45+0800
