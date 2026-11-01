---
schema_version: 1
schema_kind: workorder
id: T0765
title: "研究：PLAN-055 Terminal Server recovery 後的 agent 分頁（列出被中斷的分頁、claude 分頁提供 `--resume`）設計與實作單草案"
type: research
status: DONE
started_at: "2026-11-02T02:25:26+0800"
updated_at: "2026-11-02T02:30:22+0800"
completed_at: "2026-11-02T02:30:22+0800"
session_ids:
  - "915700ed-5571-4a6c-a4ab-6552fbb091e6"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "PLAN-055；BUG-171 / T0703（回報區建議方向 C）/ T0704；D186；T0642（`claudeSessionId` 查詢與 `ClaudeSessionPersistence`）；T0112（recovery 以同 id 重建 shell）"
  - "`electron/pty-manager.ts`（`handleServerDeath`、recovery）、`electron/claude-session-name-record.ts`、`electron/terminal-blocked-state.ts`（sessionId）、`docs/agent-guide/terminal-server-recovery.md`、`docs/agent-guide/claude-session-name.md`"
affects_files:
  - docs/
  - _ct-workorders/PLAN-055-agent-tabs-after-terminal-server-recovery.md
  - _ct-workorders/T0765-research-plan055-agent-tabs-after-recovery.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只讀、不改產品程式碼、不 build、不跑 e2e（與其他 Worker 並行）；不動使用者正在用的 BAT 與 Terminal Server。"
  - "🔴 產出：① 現況：recovery 後 agent 分頁實際變成什麼（以程式與 T0703 / T0704 回報為據）、哪些資訊還在（`claudeSessionId`、`agentPreset`、`launchRole`、工單、codex 的 session）；② 設計：怎麼列出被中斷的分頁（通知 / 對話框 / 分頁標示）、claude 分頁怎麼提供 `--resume <id>`（自動或按鈕、與 BAT MCP / hooks / `--name` 注入的關係）、codex 分頁怎麼辦、Worker 分頁（塔台派工）的處理；③ 2–3 個方案的取捨與規模；④ 選定方案的實作單草案（affects_files、驗收、e2e 怎麼造 recovery）。寫在回報區；PLAN-055 只在〈研究結果〉補摘要，status 不改。"
  - "🔴 需要使用者偏好的點列成〈待決點〉，不問塔台、不停下（研究單收尾後由塔台轉問）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0765 — 研究：PLAN-055 Terminal Server recovery 後的 agent 分頁（列出被中斷的分頁、claude 分頁提供 `--resume`）設計與實作單草案

## 元資料

- **工單編號**：T0765
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

PLAN-055（IDEA）：Terminal Server recovery 後 agent 分頁無聲變成 shell。D210 排入本批，先研究設計。

## 範圍

現況、設計、方案取捨、實作單草案、待決點。只讀不改。

## 不做

- 不改產品程式碼；不 build；不發版。

## 驗收

- [x] ①–④ 齊全、有程式位置佐證
- [x] 待決點清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（研究單；①–④ 與待決點齊全，只讀，未改產品程式碼、未 build、未跑 e2e）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `docs/` 存在（資訊性）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；未設 `CT_HOME`（非 worktree）；`BAT_REMOTE_TOKEN` 已設定。
- **session_id**：915700ed-5571-4a6c-a4ab-6552fbb091e6

### 產出摘要

#### ① 現況：recovery 後 agent 分頁變成什麼

**流程**（`PtyManager.handleServerDeath`，`electron/pty-manager.ts:1767`）：

1. 廣播 `terminal-server:status` `recovering`（:1784）。
2. `notifySurvivingPtys([])`（:1795）→ main `onSurvivingPtys` 對 `claudeSessionPersistence.settle(() => false)`（`electron/main.ts:947-951`）。
3. `blockedTracker.clearAll('Terminal Server recovery')`（:1797）→ 清掉 blocked、turn、`started`（agentStarted）、codex 狀態，**以及 `sessionIds`**（`electron/terminal-blocked-state.ts:399-405`，`this.sessionIds.clear() // T0642`）。
4. `deps.onServerRecovery()`（:1801）→ main 取消所有塔台問題，並 `claudeSessionPersistence.persist()`（`electron/main.ts:961-964`）——此時 session id 已被 3 清掉，`claude-sessions.json` 被改寫成沒有 sessionId 的內容。
5. 結束舊 server、孤兒 PTY 樹、清 registry、re-fork（:1808-1835）。
6. 以同 id 重建 **shell**：`sendToServer({ type: 'pty:create', shell, args, cwd: inst.cwd, cols: 120, rows: 30, env })`，env 經 `buildPtyEnv`（T0525），`this.instances.set(id, { ...inst, process: null })`（:1838-1867）。**不重送 agent 啟動指令**。
7. 廣播 `recovered`（:1870），payload 只有字串，**沒有分頁清單**。

**renderer**：`App.tsx:715-724` 只顯示 toast（`app.terminalServerRecovering` → `app.terminalServerRecovered`「終端已恢復（歷史輸出已重置）」3 s 後消失 / `RecoveryFailed`），`ServerStatusToast.tsx`。沒有任何分頁層級的標示；xterm 保留舊畫面，接著出現新 shell 的提示字元。BUG-171（T0703 時間線）一次結束 5 個塔台 + 1 個 Worker，使用者只看到 `$`。

**recovery 後還在 / 不在的資訊**

| 資訊 | 位置 | recovery 後 |
|---|---|---|
| `agentPreset` | main `PtyInstance.agentPreset`（:62）；renderer `TerminalInstance.agentPreset`（只有使用者開的分頁） | ✅ 保留（`{ ...inst }`）。helper 派工分頁自 BUG-155 / T0639 起 main 有、renderer 沒有；raw command 模式兩邊都沒有 |
| `customEnv`（含 `BAT_TOWER_TERMINAL_ID`、`CT_MODE`、`CLAUDE_CODE_NO_FLICKER`） | `PtyInstance.customEnv` | ✅ 保留並用於重建 env（T0525） |
| `workspaceId` / `cwd`（啟動時的 cwd，worktree 分頁為 worktree 路徑） | `PtyInstance` | ✅ 保留 |
| `workorder` / `worktree`（Worker） | `PtyInstance`；renderer `TerminalInstance.workorder` / `towerTerminalId` / `ctWorktree` | ✅ 保留 |
| `role` / `towerMode`（`--set-role tower`） | `PtyInstance` | ✅ 保留——但分頁內已沒有 claude，`isYoloTerminal` 仍為真 |
| `launchRole: 'tower'` | renderer `TerminalInstance`（持久化） | ✅ 保留 |
| `claudeSessionName`（`--name=` 的名稱） | `claudeSessionNameRecords`（`electron/claude-session-name-record.ts`） | ✅ 保留（recovery 不清它） |
| **`claudeSessionId`** | `TerminalBlockedTracker.sessionIds` + `claude-sessions.json` | ❌ **清除**（步驟 3、4），這是 `--resume` 唯一需要而目前丟掉的資料 |
| `agentStarted` / blocked / turn / codex OSC 狀態 | `TerminalBlockedTracker` | ❌ 清除 |
| 塔台問題 | `tower-questions.ts` | ❌ 取消（T0607，預期行為） |
| helper 權杖 | `helperEnvFor(id, customEnv)` | ✅ 重建時重發（Worker 仍綁原塔台） |
| codex session id | 無 | ❌ BAT 從未取得（OSC 7501 不帶 id，`src/lib/codex-terminal-state.ts`） |
| 原派工指令（Worker 的 `/ct-exec T####` prompt） | 只在 `terminal:created-externally` payload 送出一次（`electron/terminal-command-handlers.ts:690-710`） | ❌ main 不保存 |

**其他事實**

- 內嵌 claude `2.1.316`：`-r, --resume [value]`（值可省略，省略即 picker）、`-n, --name <name>`、`--fork-session`（resume 時開新 session id）。`[value]` 是選擇性參數：**一律用 `--resume=<id>`**，理由同 `--mcp-config=`（避免吃掉後面的參數）。
- 內嵌 codex `0.166.0`：`codex resume [SESSION_ID] [PROMPT]`，預設開 picker 且**以 cwd 篩選**（`--all` 才看全部），`--last` 不顯示 picker 直接接最近一個。
- claude 的 session 檔在 `<CLAUDE_CONFIG_DIR 或 ~/.claude>/projects/<編碼後的 cwd>/<id>.jsonl`，`--resume` 必須在原 cwd 執行；重建的 shell 用 `inst.cwd`（原啟動 cwd），條件成立。設定目錄唯一入口 `resolveClaudeConfigDir`（`electron/claude-config-dir.ts`）。
- BAT 的 claude hooks 沒有 `SessionEnd`（`BAT_CLAUDE_HOOKS`，`electron/bat-mcp-launch.ts:147-163`）：使用者自己離開 claude 回到 shell 時 BAT 不知道。⇒ 「分頁原本在跑 agent」只能以「agentPreset 是 agent，或有過 `session-start` / OSC」近似，會有偽陽性（已離開 claude 的分頁也被列出）。
- 既有 ⏻ 重啟 claude-cli 分頁（`WorkspaceView.tsx:976-979`）＝ `pty.kill` + `startClaudeCliPty`：重開一個**新** claude，不 resume。
- `startClaudeCliPty`（`WorkspaceView.tsx:728-786`）經 `createPtyThenLaunch`：PTY 已存在（`created: false`）時不送啟動指令；recovery 後重建的 shell 正是「已存在」，所以不能直接呼叫，要先 kill（同 ⏻）或改走「寫入既有 shell」。
- headless（bat-server）不走 Terminal Server，`handleServerDeath` 不會被呼叫（`docs/agent-guide/terminal-server-recovery.md`「headless 不受影響」）；bat-server 整個死掉是另一種情境（遠端視窗重連），不在 PLAN-055 範圍。
- 相近但不同的情境：BAT 重開時 Recovery 提示選「重新開始」，claude-cli 分頁會以新 claude 啟動（`initTerminals` → `startClaudeCliPty`，created: true），`claude-sessions.json` 以 `settle(() => false, 'no surviving Terminal Server')` 丟棄（`electron/main.ts:384`）。同樣失去 session，可以共用本設計（列為待決點 P-6）。

#### ② 設計

**D-1 快照（main，唯一實作建議放 `electron/interrupted-agents.ts`，不 import electron）**

- `handleServerDeath` 在 `blockedTracker.clearAll` **之前**呼叫新 dep `onAgentsInterrupted(snapshot)`（或 PtyManager 自己產生快照再交給 dep），每個「可能在跑 agent」的分頁一列：
  `{ terminalId, workspaceId, agent: agentPreset ?? 'unknown', claudeSessionId | null, claudeSessionName | null, workorder?, towerTerminalId?, role?, launchedBy: 'tab' | 'dispatch', at }`。
- 判定（近似，見①）：`agentPreset` 是 agent（claude-cli / claude-cli-worktree / codex-cli / 其他 terminal-driven agent）**或** `getStartedAt(id) !== null` **或** `getSessionId(id) !== null` **或** 有 codex OSC 狀態。純 shell 分頁不列。
- `launchedBy`：`workorder` 或 `customEnv.BAT_TOWER_TERMINAL_ID` 有值 → `dispatch`，否則 `tab`。
- 🔴 快照只存 main 記憶體＋`claude-sessions.json`（無權杖），日誌只記 id、agent、session 前 8 碼。
- `claudeSessionId` 改由快照保存，**不再在 recovery 時寫掉**：`ClaudeSessionPersistence` 增加 `interrupted` 項（`{ terminalId, sessionId, at }`），在使用者 resume / 略過 / 關分頁 / 該分頁回報新 `session-start` 時移除；BAT 重開時這些項目不 settle 進 tracker（分頁已不是那個 claude），只供列表沿用（是否跨 BAT 重開保留 → 待決點 P-5）。

**D-2 列出被中斷的分頁（renderer）**

- 新事件 `terminal-server:agents-interrupted`（payload = 快照）＋ pull 查詢 `terminal-server:query-interrupted-agents`（沿用 T0111 模式：視窗晚於事件掛載也拿得到）。廣播所有視窗，每個視窗只取自己 store 裡有的 terminal id（detached 視窗同理）。
- 呈現（建議 **對話框＋分頁標示** 兩者）：
  - 對話框 `InterruptedAgentsDialog`：依工作區分組列出 分頁標題 / agent / Worker 工單 / 是否可 resume，每列按鈕「恢復」，底部「全部恢復（claude）」與「關閉」。🔴 依 CLAUDE.md「Dialog 不因點擊外部關閉」：`ModalOverlay` + [X] + `onEscape`（= 關閉，不 resume）。
  - 分頁標示：縮圖 / 分頁標籤顯示「⏸ agent 已中斷」，點擊開同一對話框；分頁被 resume、⏻ 重啟、關閉、或使用者按「略過」後移除。只存記憶體（與 `terminal-attention-store.ts` 的淡化狀態同層），不持久化到 workspace。
  - toast 文字 `app.terminalServerRecovered` 補一句「N 個 agent 分頁已中斷」並可點開對話框（N = 0 時不變）。
- 🔴 不自動 resume（理由：同時重開多個 claude 會一起花費、yolo 塔台 / Worker 會立刻依上下文繼續動作、中斷點可能在工具執行中）。是否提供「自動」選項 → 待決點 P-1。

**D-3 claude 分頁的 `--resume`**

- 啟動指令＝原本的啟動指令＋`--resume=<sessionId>`，其他一律照原路徑組（BAT MCP `--mcp-config=`、hooks `--settings=`、`--name=`、生效的自訂參數），**不另寫一份組裝**：
  - 使用者開的分頁（`launchedBy: 'tab'`，renderer 有 `agentPreset`）：`startClaudeCliPty(id, cwd, isWorktree, { resumeSessionId })`；呼叫端照 ⏻ 的做法先 `pty.kill(id)` 再啟動（`created: true` 才送指令，不必動 `createPtyThenLaunch`）。worktree 分頁：resume 時**不得**再 `worktree.create`，沿用 `terminal.worktreePath`。
  - 派工分頁（`launchedBy: 'dispatch'`，renderer 沒有 `agentPreset`）：main 新 channel `terminal:resume-interrupted-agent { terminalId }`（renderer IPC，不開放 helper），以 `createAgentPromptCommandBuilder` 加 `resumeSessionId` 選項、不帶 prompt，組出指令後 `writeDispatchCommand` 寫入重建的 shell（shell 是新的、閒置，不需 kill；沿用 BUG-151 的 input hold）。
- `--name`：`claudeSessionNameRecords` 仍在，原名照注入（claude `-n` 會更新 resume 後 session 的顯示名，ListAgents 名稱不變）。
- `--fork-session` 不加：沿用同一 session id，ClaudeSessionPersistence / ListAgents / CT 收單補記 session id 都不必改。
- 前置檢查（main，`resolveClaudeConfigDir` + cwd 編碼）：session 檔不存在 → 該列顯示「找不到 session，可重新開啟（新對話）」，不送 `--resume`。編碼規則若難以穩定重現，退而只檢查 id 格式（`CLAUDE_SESSION_ID_PATTERN`）並讓 claude 自己報錯（待實作單查證）。
- 自訂參數已含 `--resume` / `-r` / `--continue` / `-c` / `--session-id` / `--from-pr` / `--teleport` → 不加 `--resume=`，該列顯示原因（比照 `--name` 的 `user-args` 降級）。
- `session id` 未知（`blockedDetection: none`、hooks 被使用者設定關閉、system claude 太舊）→ 提供「開啟 resume 選單」：送 `--resume`（不帶值，claude 自己的 picker，cwd 篩選）。

**D-4 codex 分頁**

- BAT 沒有 codex session id。建議「恢復」= 在重建的 shell 送 `codex resume`（picker，預設以 cwd 篩選），使用者自己挑；BAT MCP `-c mcp_servers.bat.*` 與 `--no-daemon` 判斷照原路徑（`buildBatMcpLaunchArgs` 的 codex 分支）加上。
- 不用 `--last`：同一 cwd 多個 codex 分頁時會接錯（Worker 與塔台常同 repo）。
- 日後要精準 resume 需要 codex session id 來源（讀 `~/.codex/sessions` 依 cwd + 啟動時間比對，屬啟發式）→ 待決點 P-4，本單不做。

**D-5 Worker 分頁（塔台派工）**

- 列在對話框，標出工單編號與所屬塔台；可與一般 claude 分頁一樣 resume（env、權杖、`BAT_TOWER_TERMINAL_ID`、`CT_MODE` 已由 T0525 重建）。
- resume 後 claude 停在中斷前的對話，**不會自己繼續**；要不要附帶 prompt（例如「Terminal Server 重啟，請從中斷處繼續 T####」）→ 待決點 P-2。
- 塔台若同時被中斷，Worker 的完成通知仍會寫進塔台分頁（現在是 shell）→ 建議對話框排序：塔台在前、Worker 在後，並提示「先恢復塔台」。
- 是否主動通知塔台「Worker 中斷」：牽涉 BAT ↔ CT 契約（新通知字串或 `terminal:get-state` 新欄位，例如 `interruptedAt`），🔴 本設計不做，列待決點 P-3。現況下塔台查 `bat_get_state` 會看到 Worker `agentStarted: false`、`idle`，可據此判斷。

**D-6 與 BAT MCP / hooks / `--name` 的關係**

- 三者都在既有組裝點注入，resume 只多一段 `--resume=<id>`，放在 BAT 參數之後、自訂參數之前（與 `--name=` 同一段的尾端），由 `buildBatMcpLaunchArgs` 以外的呼叫端加（不改 `buildBatMcpLaunchArgs` 的語意，`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數不變）。
- resume 後 `SessionStart`（source=resume）照常回報同一 session id → `agentStarted`、`claudeSessionId` 自然恢復，分頁標示由此清除。
- `isYoloTerminal`：recovery 後塔台分頁仍是 yolo 但沒有 claude；usage-limit 只對 codex 送字、claude 絕不送（D148），本設計不改。

#### ③ 方案取捨

| 方案 | 內容 | 規模 | 優點 | 缺點 |
|---|---|---|---|---|
| A 看得見 | D-1 快照 + D-2 對話框 / 分頁標示；對話框顯示可複製的 `claude --resume <id>`，使用者自己貼 | S | 只動 main 一個 dep 與 renderer 一個元件；不碰啟動指令組裝 | 使用者要自己貼指令，還要自己記得 BAT MCP / `--name` 不會跟著（手打 `claude --resume` 不帶 BAT 參數 → 分頁失去 MCP / hooks / 名稱） |
| **B 一鍵恢復（建議）** | A + D-3 claude 按鈕（單個 / 全部）+ D-4 codex picker + D-5 Worker 可 resume、不通知塔台 | M | 恢復後與原分頁同等（MCP / hooks / name / 權杖）；不碰 CT 契約 | 兩條啟動路徑（renderer tab / main dispatch）都要加 `resumeSessionId`；session 檔檢查要查證 cwd 編碼 |
| C 全自動 | B + recovery 後自動 resume 全部 claude 分頁 + Worker 中斷通知塔台（新契約） | M–L | 使用者不必動作 | 同時重開多個 agent 的成本與連鎖動作風險；需 CT 契約與塔台決策；中斷在工具執行中時自動續行可能重做副作用 |

**選定 B**，分兩張實作單較穩：B1（快照 + 列表 + 標示 + claude resume）、B2（codex picker + Worker 附帶 prompt，視 P-2 / P-4 結果）。若塔台要一張，B 整張規模 M。

#### ④ 選定方案實作單草案（B1）

- **標題**：PLAN-055 B1：Terminal Server recovery 後列出被中斷的 agent 分頁，claude 分頁一鍵 `--resume`
- **type**：implementation；**sizing**：M；**priority**：P3
- **affects_files**（預估）：
  - `electron/pty-manager.ts`（`handleServerDeath`：`clearAll` 前呼叫快照 dep；`PtyManagerDeps.onAgentsInterrupted`）
  - `electron/interrupted-agents.ts`（新：快照建立、判定、記憶體 store、清除條件）
  - `electron/claude-session-name-record.ts`（`ClaudeSessionPersistence` 的 interrupted 項，recovery 不再丟 session id）
  - `electron/main.ts`（dep 接線、`terminal-server:agents-interrupted` 廣播、`terminal-server:query-interrupted-agents`、`terminal:resume-interrupted-agent` handler）
  - `electron/terminal-command-handlers.ts`（`createAgentPromptCommandBuilder` 的 `resumeSessionId` 選項、自訂參數已含 resume 類旗標時降級）
  - `electron/preload.ts`、`src/types/electron.d.ts`
  - `src/App.tsx`（事件 / pull 查詢、toast 補 N）、`src/components/InterruptedAgentsDialog.tsx`（新）、`src/components/WorkspaceView.tsx`（`startClaudeCliPty` 的 `resumeSessionId` 選項）、縮圖 / 分頁標示元件、`src/stores/` 記憶體狀態（或併入 `terminal-attention-store.ts`）
  - `src/locales/{en,zh-TW,zh-CN}.json`
  - 測試：`electron/__tests__/interrupted-agents.test.ts`（新）、`pty-manager-heartbeat-recovery.test.ts`（快照在 `clearAll` 前、內容正確）、`claude-session-persist*.test.ts`、`terminal-command-handlers` 的 builder 測試、`src/components/__tests__/interrupted-agents-dialog.test.tsx`（新）、`dialog-escape.test.tsx`（新 Dialog 計數）
  - e2e：`e2e/t####-agents-interrupted-recovery.spec.ts`（新）
  - 文件：`docs/agent-guide/terminal-server-recovery.md`（已知限制那一行改寫、新節）、`docs/agent-guide/claude-session-name.md`（session id 在 recovery 不再丟棄）、`CLAUDE.md`「Terminal Server 存活判定與 recovery」節加 3–5 行
- **必守規則（草案）**：
  - 🔴 快照在 `blockedTracker.clearAll` 之前取；`Terminal Server died — attempting recovery` 日誌字串不改（既有 source guard 以它定位）。
  - 🔴 不自動 resume；不改 recovery 的五步順序（T0704）。
  - 🔴 resume 指令一律經既有組裝點（`startClaudeCliPty` / `createAgentPromptCommandBuilder`），`--resume=` 用 `=` 形式；不加 `--fork-session`。
  - 🔴 不新增 helper channel / 不改 CT 契約；`terminal:resume-interrupted-agent` 只給 renderer。
  - 🔴 session id 只在 main 記憶體與 `claude-sessions.json`，日誌只記前 8 碼。
  - 新 Dialog 用 `ModalOverlay`、有 [X]、給 `onEscape`。
- **驗收**：
  - `npm run test:unit`、`npm run test:legacy`、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 通過。
  - 單元：快照只列 agent 分頁、純 shell 不列；`clearAll` 後 session id 仍可從快照取得；`claude-sessions.json` 在 recovery 後仍有 interrupted 項，resume / 略過 / 關分頁 / 新 `session-start` 後移除；builder 的 `resumeSessionId` 產生 `--resume=<id>` 且 BAT MCP / `--name=` 照舊、自訂參數含 `-c` / `--resume` 時不加；renderer 對話框依工作區分組、Esc 關閉不 resume、全部恢復只送 claude 列。
  - 不回歸：一般 ⏻ 重啟 claude-cli 仍開新 claude（無 `--resume`）；沒有 recovery 時 toast 與行為完全不變；T0704 既有 heartbeat / recovery 測試全過。
- **e2e 怎麼造 recovery**（沿用 `e2e/t0704-heartbeat-recovery.spec.ts` 的隔離實例做法，Windows、需先 `npx vite build`）：
  1. 隔離實例設定 Claude Runtime = system，PATH 前置一個 **stub `claude`**（`.cmd` / node 腳本）：`--version` 印 `2.1.316 (Claude Code)`（過 `--name` 版本門檻）；其他呼叫把 argv 寫到暫存檔，然後以 `bat-hook.mjs session-start` 的同一 channel（`terminal:report-hook`，分頁內有權杖）回報固定的假 sessionId，再停在 `read` 等待。這樣不需要真的 claude 登入。
  2. 開一個 claude-cli 分頁與一個一般 shell 分頁；確認 `bat_get_state` 的 `claudeSessionId` = 假 id。
  3. 只 `taskkill /F` Terminal Server 程序 → `reason=ipc-exit` recovery（與 T0704 e2e 相同）。
  4. 斷言：對話框出現且只列 claude 分頁、分頁有中斷標示；按「恢復」→ stub 記錄的 argv 含 `--resume=<假 id>`、`--mcp-config=`、`--name=`；分頁標示消失；`bat_get_state` 的 `agentStarted` 回到 true。
  5. 派工分頁：以塔台分頁執行 `bat-terminal.mjs` 派一個 Worker（stub claude），重複 3–4，斷言 argv 有 `--resume=` 且沒有原 prompt。

### 待決點（研究單收尾後由塔台轉問使用者）

| # | 問題 | 選項 | 建議 |
|---|---|---|---|
| P-1 | recovery 後是否自動 resume？ | a. 不自動，只列出＋按鈕（建議）／b. Settings 開關，預設關／c. 自動 | a：同時重開多個 agent 的費用與 yolo 連鎖動作風險，損失本來就只發生在 server 真的崩潰時 |
| P-2 | Worker resume 時要不要附帶一段 prompt 讓它自己繼續？ | a. 不附，使用者自己決定（建議）／b. 附固定字串「Terminal Server 重啟，請從中斷處繼續 T####」／c. 只對 yolo Worker 附 | a；b / c 會讓 Worker 在中斷於工具執行中時重做副作用 |
| P-3 | Worker 中斷要不要通知塔台？ | a. 不通知（建議，塔台可由 `bat_get_state` 看 `agentStarted: false`）／b. `terminal:get-state` 加 `interruptedAt` 欄位（BAT 契約，CT 要跟）／c. BAT 主動送通知到塔台分頁 | a；b 需另開 CT 協作工單 |
| P-4 | codex 分頁怎麼恢復？ | a. `codex resume` picker（cwd 篩選，建議）／b. 只列出、不提供按鈕／c. 另開研究：從 `~/.codex/sessions` 比對 session id | a |
| P-5 | 被中斷清單與 session id 要不要跨 BAT 重開保留？ | a. 只到 BAT 關閉為止（建議）／b. 存進 `claude-sessions.json` 跨重開 | a；跨重開後分頁 id 可能已被 Recovery 提示的「重新開始」改變語意 |
| P-6 | BAT 重開時 Recovery 提示選「重新開始」也要用同一個列表＋resume 嗎？ | a. 本次不做（建議，另開 IDEA）／b. 一併做 | a；那條路徑由 renderer `initTerminals` 啟動，觸發點不同 |
| P-7 | 要不要加 claude `SessionEnd` hook 來排除「使用者已自己離開 claude」的偽陽性？ | a. 不加，接受偽陽性（建議，列表只是提示）／b. 加（改 `BAT_CLAUDE_HOOKS`，屬 T0590 hook 表） | a |
| P-8 | 一張實作單還是兩張？ | a. B1 + B2 兩張（建議）／b. 一張 M | a |

### 遭遇問題

- 無阻斷。未問塔台（判讀問題都能由程式碼回答；偏好類列入〈待決點〉）。
- 查證時執行了內嵌 `claude --version` / `--help` 與 `codex --version` / `resume --help`（唯讀，取 resume / name 旗標的實際說明）；未啟動任何 session。
- 未驗證的推論：claude `-n` 在 `--resume` 時是否更新顯示名、claude session 檔的 cwd 編碼規則，交實作單查證（④已註明）。

### 互動紀錄

- 無（yolo，未提問）。

### 回報時間

- 2026-11-02T02:30:22+0800
