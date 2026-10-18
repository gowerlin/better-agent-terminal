---
schema_version: 1
schema_kind: workorder
id: T0644
title: "PLAN-050 D：「以塔台開啟 Claude」入口——claude-cli 分頁啟動即 `--name \"<工作區> · Tower\"`（R2 (b)）"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: S
created_at: "2026-10-18T16:44:32+0800"
started_at: "2026-10-18T16:46:02+08:00"
updated_at: "2026-10-18T16:46:02+08:00"
depends_on: [T0641]
related:
  - "D167（使用者決定 R2 採 (a)+(b)）；T0640 回報區（R2 三案比較、介面契約草案 C-7、實作切分 D）"
  - "T0641（`claudeSessionName({ role: 'tower', … })` 已實作並有測試；renderer 經 `withBatMcpLaunchArgs` 第 5 參數 `sessionName` 送名稱；`docs/agent-guide/claude-session-name.md`）"
  - "T0562（`--set-role tower` / 塔台分頁標題 `src/lib/tower-terminal-title.ts`、`setAutoTitle`）；T0529（工作區預設 agent / 啟動參數）；T0572 / T0539（新建與 ⏻ 重啟經 `createPtyWithReplay` / `restartOrCreatePty`）"
  - "並行：T0642（B，只改 `electron/**`、`scripts/**`、docs 與 CLAUDE.md）"
affects_files:
  - "src/components/WorkspaceView.tsx 與新增入口所在的元件（例：新增終端的選單 / 按鈕）"
  - "src/stores/workspace-store.ts（分頁記錄 `launchRole`）"
  - "src/types/index.ts（`TerminalInstance.launchRole?`）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/**/__tests__/**"
  - "e2e/t0644-open-claude-as-tower.spec.ts（新）"
  - _ct-workorders/T0644-open-claude-as-tower.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **C-7**：新增「以塔台開啟 Claude」入口（位置自選，與現有開新 Agent 分頁的入口相鄰；回報說明並附截圖）。它開一個 claude-cli 分頁（套用工作區生效的 agent 啟動參數，`getEffectiveAgentArgs`），名稱用 `claudeSessionName({ role: 'tower', … })` → `<工作區> · Tower`。🔴 **只負責命名，不代替 `--set-role tower`**：不呼叫 `terminal:set-role`、不設定塔台角色、不自動輸入任何指令（角色仍由 CT 啟動時宣告）。"
  - "🔴 分頁記錄 `launchRole: 'tower'`（持久化於現有的分頁紀錄）；⏻ 重啟、BAT 重開還原時沿用同一個名稱。沒有 `launchRole` 的分頁行為與 T0641 完全相同（`<工作區> · <短 ID>`）。只限 claude-cli；選了別的預設 agent 的工作區也一樣開 claude-cli（入口名稱就寫 Claude）。"
  - "🔴 分頁標題：可用 `setAutoTitle` 先給 `Claude CLI · Tower`（與 T0562 一致、使用者命名優先）；不得用 `renameTerminal`（`workspace-store.towerRole.test.ts` source guard）。若決定不預設標題，回報說明理由。"
  - "🔴 所有 claude 啟動路徑仍經 `withBatMcpLaunchArgs`（`bat-mcp-launch.test.ts` source guard 計數不得放寬；新增入口若多一個 `buildLaunchCommand(` 呼叫，依該 guard 的規則更新並說明）。新建 PTY 經 `createPtyWithReplay` / `restartOrCreatePty`（T0572）。"
  - "🔴 **並行工單 T0642** 改 `electron/**`、`scripts/**`、`docs/agent-guide/**`、CLAUDE.md：本單**不得改這些檔案**。文件段落（入口位置、`launchRole`、名稱、已知限制、驗證清單）寫在本工單回報區的「文件草稿」小節，由後續 T0643 併入 `docs/agent-guide/claude-session-name.md` 與 CLAUDE.md。若實作必須改 `electron/**`（例如 IPC），先在工單提問。"
  - "🔴 新增 Dialog / 選單遵守 CLAUDE.md「Dialog 不因點擊外部關閉」節（若有 Dialog）；i18n 三語都要有。非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
  - "🔴 與另一張工單並行：`npx vite build` / e2e 共用 `dist` / `dist-electron`，兩邊同時 build 可能互相覆寫或鎖檔 —— build 或 e2e 出現與自己變更無關的失敗時，先重跑一次再判斷，並在回報區記錄。"
---

# T0644 — 「以塔台開啟 Claude」（PLAN-050 D）

## 背景

使用者決定 R2 採 (a)+(b)（D167）。(a) 已由 T0641 讓所有 claude-cli 分頁帶 `<工作區> · <短 ID>`；本單是 (b)：使用者明確要開塔台時，用新入口開出的 claude 分頁在 ListAgents 上直接顯示 `<工作區> · Tower`，不需要 CT 再查 BAT，跨 BAT host 也有效。

## 要做的事

1. UI 入口「以塔台開啟 Claude」（三語 i18n），開出的 claude-cli 分頁帶 Tower 名稱。
2. 分頁記錄 `launchRole: 'tower'`，⏻ 重啟 / BAT 重開還原沿用名稱。
3. 標題處理（見 memory_overrides）。
4. 回報區「文件草稿」小節（給 T0643 併入 docs / CLAUDE.md）。

## 驗證

- `npm run typecheck` = 0（本單只改 `src/**`；若動到 electron 型別另跑 `npm run typecheck:electron`）
- `npm run test:unit` 全綠（基線 5334 / 307；與 T0642 並行，數字可能交錯，回報自己跑的結果）
- `npx vite build` 成功
- e2e `e2e/t0644-open-claude-as-tower.spec.ts`（隔離實例、不耗 token；自訂參數 `--version` 或 argv 腳本代替 claude）：從新入口開分頁 → 啟動指令含 `--name=<ws> · Tower`；一般入口仍是 `<ws> · <短 ID>`；⏻ 重啟後仍是 Tower 名稱；截圖入口位置（存 `e2e-results/t0644/`，不入版控）

## 驗收

- 新入口開出的 claude 分頁名稱為 `<工作區> · Tower`，重啟 / 還原沿用；不設定角色
- 既有入口與其他 agent 不受影響
- 驗證全部通過；回報區附：入口位置截圖、測試清單、文件草稿、commit

---

## 回報區

### 待塔台決策

#### Q-1：T0641 的 source guard 逐字鎖住 tab 名稱那一行，本單改成依 `launchRole` 選名稱後它會失敗；可以由本單改這條 `electron/__tests__` 斷言嗎？
- 提問時間：2026-10-18T16:52:35+0800
- 背景：`electron/__tests__/claude-session-name-launch.test.ts:314` 斷言 `WorkspaceView.tsx` 內有 `const sessionName = claudeSessionName({ role: 'tab', workspaceName: sessionWorkspaceNameRef.current, terminalId })`。本單在 `startClaudeCliPty` 依分頁的 `launchRole` 選 `role: 'tower'` 或 `role: 'tab'`（`const sessionName = (launchRole === 'tower' ? claudeSessionName({ role: 'tower', … }) : claudeSessionName({ role: 'tab', … })) ?? undefined`），該斷言因此失敗（`npm run test:unit`：1 failed / 5345 passed）。其餘兩條斷言（`sessionWorkspaceNameRef`、`withBatMcpLaunchArgs(…, terminalId, sessionName)`）仍通過。memory_overrides 禁止本單改 `electron/**`；另外 T0642 目前**正在改同一個檔**（工作樹已有它未 commit 的 hunk，line 303），本單若現在用 `git commit --only` 提交這個檔，會把 T0642 未 commit 的變更一起帶進來。
- 選項：[A] 等 T0642 commit 該檔後，由本單只改那一條 `it(...)`：保留 tab 分支斷言（改成比對 `: claudeSessionName({ role: 'tab', workspaceName: sessionWorkspaceNameRef.current, terminalId })`），加上 tower 分支斷言，`git commit --only` 只提交該檔 / [B] 由塔台轉給 T0642 的 Worker 一併改這條斷言（本單在回報區附替換文字） / [C] 其他：________
- Worker 建議：[A]，只改測試、不動 `electron/**` 產品碼，斷言意圖不變（沒有 `launchRole` 的分頁仍是 `<ws> · <短 ID>`）；等 T0642 commit 後再改可避免把對方的 hunk 混進本單 commit。不建議為了迎合舊斷言把 WorkspaceView 改成另包一層函式，那等於繞過 guard。
- 影響範圍：`electron/__tests__/claude-session-name-launch.test.ts` 一條斷言；本單驗收「`npm run test:unit` 全綠」
- 阻塞：是（全綠與收尾 commit 要等答覆；其餘實作與驗證已完成）

（Worker 填寫）
