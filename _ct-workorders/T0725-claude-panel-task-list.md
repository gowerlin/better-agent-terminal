---
schema_version: 1
schema_kind: workorder
id: T0725
title: "Claude 面板 Task 工作清單：Claude 5 模型開啟 todo / task 工具（`CLAUDE_CODE_ENABLE_TODO_TOOLS=1`）＋依 `TaskCreate` / `TaskUpdate` / `TaskList` 累積顯示清單"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:04:48+0800"
started_at: ""
updated_at: "2026-11-01T10:04:48+0800"
completed_at: ""
depends_on: [T0721, T0724]
related:
  - "D195（使用者選「開啟並做 UI」）；T0721 研究（`8b2037b5`）回報區 R2 與「實作單草案 2」（設計選項 A）"
  - "T0718（SDK 0.3；`electron/__tests__/claude-sdk03-task-tools.test.ts` 守住 Task* 不進 `activeTasks`）"
  - "CLAUDE.md「Sub-agent / Active Tasks Tracking」、「React Rendering」、「Claude Agent SDK / CLI」；`docs/agent-guide/claude-agent-sdk-cli.md`"
  - "T0724（同檔 `electron/claude-agent-manager.ts`，須先完成）"
affects_files:
  - src/lib/claude-task-list.ts
  - src/lib/__tests__/claude-task-list.test.ts
  - src/components/ClaudeAgentPanel.tsx
  - "src/components/ 下 Claude 面板相關的 CSS（若清單樣式需要）"
  - src/locales/en.json
  - src/locales/zh-CN.json
  - src/locales/zh-TW.json
  - electron/claude-agent-manager.ts
  - "electron/__tests__/（`sdkSpawnEnv` 注入的測試）"
  - CLAUDE.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0725-claude-panel-task-list.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 開啟方式（D195）：只在 Claude 面板（SDK）的 spawn env 加 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`，唯一位置 `sdkSpawnEnv`（`electron/claude-agent-manager.ts`）；不影響 Claude CLI 終端分頁、helper 派工、codex；不加 Settings 開關；不用 `allowedTools`（會改權限行為）。使用者 / 系統環境已設 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 或 `CLAUDE_CODE_ENABLE_TASKS` 時尊重既有值（不覆寫），並在回報說明判斷。embedded 與 system runtime 都適用（比照 `claudeUpdateGuardEnv` 的作法另寫，不要塞進 update guard）。"
  - "🔴 清單 UI（T0721 設計選項 A）：新增純函式 `src/lib/claude-task-list.ts`，依訊息順序重播：`TaskCreate` 結果文字建項目（id 只在結果文字 `Task #<id> created successfully: <subject>`）、`TaskUpdate` 輸入改狀態（`pending` / `in_progress` / `completed` / `deleted`）、`TaskList` 結果整份取代；結果文字解析失敗時不丟例外、不清空既有清單。面板在 Task* 卡片處畫最新清單（沿用 `TodoWrite` 勾選清單的樣式）；是否另加 pinned 區塊由你依版面判斷並在回報說明。歷史 / resume 載入時同一函式重播，不新增 IPC。`TodoWrite` 的既有顯示不變。"
  - "🔴 不得把 Task* 當成 sub-agent：不進 `activeTasks`、不改 `=== 'Task' || === 'Agent'` 判斷、不用 `flushSync`（CLAUDE.md「React Rendering」只限 Agent / Task 狀態）。`claude-sdk03-task-tools.test.ts` 必須照樣通過。"
  - "🔴 不送真實模型請求、不耗 token：以單元測試（重播函式、env 注入）與元件測試驗證；Claude 5 / 4.x 實際是否出現 Task* 留給使用者實機驗收，在回報列出實機驗收步驟。"
  - "🔴 驗收：`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。CLAUDE.md 只在「Sub-agent / Active Tasks Tracking」補一行（Task* 是清單工具、不是 sub-agent；面板 env 開啟 todo tools），細節寫 docs，遵守檔頭撰寫規則。新增 i18n 字串三個語系都要有。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。會改變使用者可見行為而本單沒寫到的，先問塔台。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0725 — Claude 面板 Task 工作清單

## 元資料

- **工單編號**：T0725
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T10:04:48+0800
- **預估規模**：M

## 背景

T0721 查證（CLI 2.1.316）：預設工具一律是 `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`（不是 `TodoWrite`），但 Claude 5 模型要 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 或明確點名工具才拿得到；BAT 內建的 4 個 Claude 5 模型因此看不到工作清單，4.x 模型會用但面板只畫成一般工具卡片。使用者決定（D195）：Claude 面板開啟 todo tools，並做累積式工作清單 UI。

## 範圍

1. `sdkSpawnEnv` 注入 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`（尊重既有值）＋測試。
2. `src/lib/claude-task-list.ts` 重播函式＋測試（create / update / deleted / TaskList 快照 / 解析失敗）。
3. `ClaudeAgentPanel.tsx` 顯示累積清單；i18n。
4. CLAUDE.md 一行、docs。

## 不做

- 不改 Claude CLI 終端分頁、codex、helper 派工。
- 不加 Settings 開關。
- 不做實機（耗 token）驗收。

## 驗收

- [ ] env 注入與尊重既有值的測試
- [ ] 重播函式測試涵蓋五種情境
- [ ] `activeTasks` 不受影響（`claude-sdk03-task-tools.test.ts` 通過）
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] 回報列出使用者實機驗收步驟（Claude 5 出現 Task* 與清單、4.x 有清單、resume 後清單重建）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 改動摘要

### 驗證結果

### 實機驗收步驟（給使用者）

### 遭遇問題

### 回報時間
