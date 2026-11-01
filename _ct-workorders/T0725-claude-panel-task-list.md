---
schema_version: 1
schema_kind: workorder
id: T0725
title: "Claude 面板 Task 工作清單：Claude 5 模型開啟 todo / task 工具（`CLAUDE_CODE_ENABLE_TODO_TOOLS=1`）＋依 `TaskCreate` / `TaskUpdate` / `TaskList` 累積顯示清單"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:04:48+0800"
started_at: "2026-11-01T10:18:29+0800"
updated_at: "2026-11-01T10:29:38+0800"
completed_at: "2026-11-01T10:29:38+0800"
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

**DONE**。範圍 1–4 全部完成；驗收五項皆通過（實機驗收依本單規定留給使用者，步驟見下）。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT 為主 checkout 根目錄）；C-1 工單在 REPO_ROOT 下；C-3 測得的條目皆存在（資訊性）；C-2 無 `branch` 欄位，目前 `main`。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 改動摘要

產品 commit：`08bc8467`（`git commit --only`，只含下列檔案）。

1. **env 注入**（`electron/claude-agent-manager.ts`）：新增 `claudeTodoToolsEnv(env)`，回 `{ CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' }`；`sdkSpawnEnv` 改為 `claudeUpdateGuardEnv` + `claudeTodoToolsEnv` 合併，兩者都空才不傳 `env`。兩個函式 export 供測試。三個 spawn 點（`runQuery` / `getSupportedModels` / `forkSession`）原本就都經 `sdkSpawnEnv`，未改呼叫端。`claudeUpdateGuardEnv`（`claude-resolver.ts`）未動。
   - **尊重既有值的判斷**：主行程 `process.env` 已有 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 或 `CLAUDE_CODE_ENABLE_TASKS`（任何值，含空字串）→ 一律不加、不覆寫。理由：`TODO_TOOLS=0` 是使用者明確關閉；`ENABLE_TASKS=false` 代表使用者要 `TodoWrite`，此時再加 todo 旗標會讓 Claude 5 多出 `TodoWrite`（CLI：`TodoWrite.isEnabled = !QM() && o3()`），改變使用者自己的選擇。`~/.claude/settings.json` 的 `env` 由 CLI 自己套用，BAT 不讀（寫在 docs）。
   - 行為變化：system runtime 原本不傳 `env`（SDK 直接繼承 `process.env`），現在傳 `{ ...process.env, CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' }`；`DISABLE_UPDATES` 仍只給 embedded。
2. **重播函式** `src/lib/claude-task-list.ts`（新）：`replayTaskList(items, base)` → `{ list, snapshots }`、`applyTaskToolCall`、解析函式。格式先從內嵌 CLI 2.1.316 二進位的 `mapToolResultToToolResultBlockParam` 查證（未送模型請求）：
   - `TaskCreate` 結果 `Task #<id> created successfully: <subject>` 建項目；執行中（無結果）先以 `call-<tool id>` 暫列。
   - `TaskUpdate` 輸入改 `status` / `subject` / `activeForm`，`deleted` 移除；無結果時先套用，結果不是 `Updated task #…` 就不套用（CLI 失敗時回 `Task not found` 或 hook 錯誤文字，**不設 `is_error`**）；`status: 'error'` / `denied` 忽略。
   - `TaskList` 結果整份取代（`No tasks found` = 空清單），去掉 `[blocked by …]`；`(<owner>)` 後綴只在「已知 subject + owner」的形式時保留已知 subject。歷史結果被截在 2000 字（`HISTORY_RESULT_MAX_CHARS`，history loader 的 `slice(0, 2000)`）時不當完整快照：丟最後一行、只更新列出的項目。
   - JSON 區塊陣列結果取 text 區塊；任何解析失敗不丟例外、不清空清單；`TaskGet`、`TodoWrite`、`Task` / `Agent` 不影響。
3. **面板** `src/components/ClaudeAgentPanel.tsx`：
   - Task\* 卡片：標題「工作清單」＋本次動作摘要（`新增：<subject>` / `#<id> → <狀態>` / `已同步清單`）＋時間，點擊展開完整輸入 / 結果。
   - 累積清單只畫在**每段連續 Task\* 呼叫的最後一張卡片**（避免連續 5 個 `TaskCreate` 畫 5 份清單），附「已完成 n/m」；樣式沿用 `TodoWrite` 的 `claude-todo-*` CSS（狀態 class 名稱相同，未改 CSS），`activeForm` 放 tooltip。
   - 重播來源只用主時間軸 `messages`（sub-agent 的呼叫在各自 bucket）。封存（`ARCHIVE_TRIGGER` 300 則）移出的訊息先重播進新 state `taskListBase`，所以封存不會丟項目；三個既有的封存重設點（sys-init 新 session、`onHistory`、resume 切換）一併重設 `taskListBase`。從封存載回的舊卡片與 sub-agent 視窗內的 Task\* 卡片沒有快照，只顯示摘要行。
   - **不加 pinned 區塊**（判斷）：與 `TodoWrite` 一致，最新清單就在最近一張 Task\* 卡片；另加常駐區塊會和既有 pinned 使用者訊息搶版面。列為後續候選。
   - 未碰 `=== 'Task' || === 'Agent'` 判斷、`activeTasks`、`flushSync`；`TodoWrite` 分支未改。
4. **i18n**（en / zh-TW / zh-CN 各 10 個 key：`claude.taskList` / `taskListProgress` / `taskCreated` / `taskUpdated` / `taskListSynced` / `taskListEmpty` / `taskStatusPending` / `taskStatusInProgress` / `taskStatusCompleted` / `taskStatusDeleted`）。
5. **文件**：CLAUDE.md「Sub-agent / Active Tasks Tracking」補一行（Task\* 不是 sub-agent、面板 env 開啟、唯一實作位置、docs 連結）；`docs/agent-guide/claude-agent-sdk-cli.md` 新增「Claude 面板工作清單（T0725 / D195）」節並更新 SDK 0.3 ③ 的描述。CLAUDE.md 74,067 字元（< 100k）。

檔案：`electron/claude-agent-manager.ts`、`src/lib/claude-task-list.ts`（新）、`src/lib/__tests__/claude-task-list.test.ts`（新）、`electron/__tests__/claude-todo-tools-env.test.ts`（新）、`src/__tests__/claude-panel-task-list.test.tsx`（新）、`src/components/ClaudeAgentPanel.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`、`electron/remote/__tests__/headless-claude.test.ts`、`CLAUDE.md`、`docs/agent-guide/claude-agent-sdk-cli.md`。

### 驗證結果

| 關卡 | 結果 | 證據 |
|---|---|---|
| env 注入 / 尊重既有值 | PASS | `electron/__tests__/claude-todo-tools-env.test.ts` 12 tests（無變數 → 加；`TODO_TOOLS` = `0` / `false` / `1` / 空字串、`ENABLE_TASKS` = `false` / `1` → 不加；embedded 帶 `DISABLE_UPDATES` + todo、system 只帶 todo；不覆寫；不寫回 `process.env`） |
| 重播函式五種情境 | PASS | `src/lib/__tests__/claude-task-list.test.ts` 24 tests：create（含執行中暫列、JSON 結果）、update（含失敗結果 / error / denied / 未知 id）、deleted、TaskList 快照（含 owner 後綴、`No tasks found`、截斷歷史）、解析失敗不丟例外不清空、base 接續 = 一次重播、不改動 base |
| 面板元件 | PASS | `src/__tests__/claude-panel-task-list.test.tsx` 3 tests：`onHistory` 重播並只在每段最後一張卡片畫清單、即時 `onToolUse` / `onToolResult` / `TaskList` 快照、無 `.claude-active-task-item`、`TodoWrite` 照舊 |
| `activeTasks` 不受影響 | PASS | `electron/__tests__/claude-sdk03-task-tools.test.ts` 2 tests 通過（未修改） |
| `npm run test:unit` | PASS | 350 files passed；6256 passed / 3 skipped（第二次全跑；第一次的失敗見「遭遇問題」1） |
| `npm run typecheck` | PASS | 0 errors |
| `npm run typecheck:electron` | PASS | 0 errors |
| `npx vite build` | PASS | exit 0 |
| 實機（Claude 5 / 4.x 真實模型） | 未做（本單規定不耗 token） | 步驟見下 |

### 實機驗收步驟（給使用者）

前提：BAT 以本 commit 打包或 `npm run dev` 啟動；系統環境**不要**設 `CLAUDE_CODE_ENABLE_TODO_TOOLS` / `CLAUDE_CODE_ENABLE_TASKS`。

1. **Claude 5 出現 Task\* 與清單**：開 Claude Agent 面板，模型選 Opus 5.5（或任一 Claude 5），送「把『寫 README、加測試、跑 build』三件事列成工作清單，然後逐項做完並更新狀態」。預期：出現「工作清單」卡片，連續 3 個新增後的最後一張卡片顯示 3 項 ☐；之後每次 `TaskUpdate` 卡片顯示 `#n → 進行中` / `#n → 已完成`，清單勾選與「已完成 n/3」跟著變。上方 active task bar 不出現這些項目，debug log 沒有這些工具的 `[activeTasks]` 紀錄。
2. **4.x 有清單**：模型改 Sonnet 4.6（或 Opus 4.7），重複步驟 1，預期相同。
3. **resume 後清單重建**：步驟 1 的 session 完成後，按 Resume 選回該 session（或重開 BAT 讓分頁還原），預期歷史中的 Task\* 卡片重新畫出相同的清單與進度。
4. **尊重既有值**（選做）：以 `CLAUDE_CODE_ENABLE_TODO_TOOLS=0` 啟動 BAT，Claude 5 模型不應出現 Task\*（4.x 仍會，CLI 預設）。
5. **終端分頁不受影響**（選做）：Claude CLI 終端分頁內 `echo $env:CLAUDE_CODE_ENABLE_TODO_TOOLS`（pwsh）應為空。

### 遭遇問題

1. **既有測試的斷言隨本單行為改變**：`electron/remote/__tests__/headless-claude.test.ts`「system: probe runs the system claude without DISABLE_UPDATES」原本斷言 system 的 spawn `env` 為 `undefined`；本單讓 system 也帶 todo 旗標，改成斷言「沒有 `DISABLE_UPDATES`、有 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`（環境未預設時）」。此檔不在 `affects_files` 字面清單內（清單寫的是 `electron/__tests__/`），但它是 `sdkSpawnEnv` 行為的直接測試，不改則 `test:unit` 不會全過，判定屬本單範圍並在此說明。
2. **測試失敗輸出含環境變數**：上述測試第一次失敗時，vitest 的 diff 把整份 `process.env`（含本分頁的 helper 權杖）印出並寫進 scratchpad 的暫存 log；該 log 已立即刪除，未寫入任何追蹤檔或 commit，本回報不含任何權杖值。之後的全跑只擷取摘要行。【建議】日後測試對整個 env 物件做 `toBeUndefined` / `toEqual` 時改成只比對特定 key，避免失敗時傾印環境（本單已把該斷言改成只比對特定 key）。
3. 已知限制（寫在 docs）：sub-agent 自己呼叫的 Task\* 不併入主清單；從封存載回的舊卡片不畫清單；`TaskList` 的 `(<owner>)` 與結尾括號 subject 分不出來（僅已知 subject 時還原）；CLI 改結果文字格式時要同步改 `claude-task-list.ts`。

後續候選（給塔台）：可收合的 pinned「工作清單」區塊（長 session 捲走時仍看得到）；sub-agent Task\* 是否併入主清單（需先實測 CLI 的 sub-agent 是否共用同一份 task list）。

### 互動紀錄

無（未向塔台提問）。

### 回報時間

2026-11-01T10:29:38+0800
