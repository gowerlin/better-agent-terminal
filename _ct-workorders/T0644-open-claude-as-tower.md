---
schema_version: 1
schema_kind: workorder
id: T0644
title: "PLAN-050 D：「以塔台開啟 Claude」入口——claude-cli 分頁啟動即 `--name \"<工作區> · Tower\"`（R2 (b)）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: S
created_at: "2026-10-18T16:44:32+0800"
started_at: "2026-10-18T16:46:02+08:00"
updated_at: "2026-10-18T17:11:14+08:00"
completed_at: "2026-10-18T17:11:14+08:00"
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

### 完成狀態

**DONE**：從新入口「以塔台開啟 Claude」開出的 claude-cli 分頁帶 `--name=<工作區> · Tower`，⏻ 重啟與 BAT 重開還原後名稱不變；不設定角色，也不自動輸入任何指令。既有入口與其他 agent 不受影響。驗證全部通過。

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：`src/stores/workspace-store.ts`、`src/types/index.ts`、`src/locales/*.json` 等檔案存在 → PASS（僅供參考）
- C-2：工單沒有 `branch` 欄位，不適用；工作分支為 `main`
- 非隔離工單（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

### 實作摘要

1. **入口位置**：分頁縮圖列右上角「+」（新增終端或 Agent）選單，緊接在「Claude CLI」下方，標籤是「以塔台開啟 Claude」（en `Open Claude as Tower`、zh-CN `以塔台打开 Claude`）。滑鼠停在上面時的提示寫明「只負責命名，塔台角色仍由 Control Tower 啟動時宣告」。Claude CLI 在該視窗不可用時，新入口以同一個原因停用；選單裡沒有 Claude CLI 時，新入口排在 agent 清單最後；舊版選單（沒有 registry 定義）也排在 Claude CLI 下方。實作：`ThumbnailBar` 新增 prop `onAddClaudeCliAsTower`。
2. **開分頁**：`WorkspaceView.handleAddClaudeCliAsTower` 依序呼叫 `workspaceStore.addTerminal(ws, 'claude-cli', { launchRole: 'tower' })`、`setAutoTitle(id, towerTerminalTitle({ agentPreset: 'claude-cli' }))`（得到 `Claude CLI · Tower`）、`startClaudeCliPty(id, folder, false)`。不論工作區預設 agent 是什麼，一律開 claude-cli；啟動參數照舊取 `getEffectiveAgentArgs(ws, 'claude-cli')`。
3. **命名**：`startClaudeCliPty` 從 store 讀該分頁的 `launchRole`。值為 `'tower'` 時用 `claudeSessionName({ role: 'tower', … })`（`<ws> · Tower`），其他情況照 T0641 用 `role: 'tab'`（`<ws> · <短 ID>`）。新建分頁、BAT 重開還原（init 的 restored 迴圈）、⏻ 重啟（`handleRestart` 的 claude-cli 分支）都走 `startClaudeCliPty`，三條路徑結果一致。名稱一樣經 `withBatMcpLaunchArgs` 送出，沒有新增 `buildLaunchCommand(` 呼叫，`bat-mcp-launch.test.ts` 的計數不變。
4. **持久化**：新增 `TerminalInstance.launchRole?: 'tower'`。`save()` 會寫出這個欄位；`toTerminalInstance` 還原時只接受 `'tower'`，其他值丟掉；detached 視窗收回時保留。沒有 `launchRole` 的分頁行為與 T0641 相同。
5. **標題**：用 `setAutoTitle` 預設為 `Claude CLI · Tower`。這和 T0562 `--set-role tower` 會給的標題一樣，所以 CT 之後宣告角色時結果是 `unchanged`。使用者自己改的名稱優先。沒有用 `renameTerminal`。
6. **刻意不做的事**：不呼叫 `terminal:set-role`、不設定塔台角色、不對 PTY 寫入任何額外指令。單元測試的 source guard 會檢查 handler 內沒有 `setRole`、`applyTerminalRole`、`pty.write`、`renameTerminal`。本單沒有新增 Dialog。

### 變更檔案

- `src/types/index.ts`：新增 `TerminalInstance.launchRole`
- `src/stores/workspace-store.ts`：`addTerminal` 加第三參數 `options.launchRole`；存檔與還原
- `src/components/ThumbnailBar.tsx`：選單項目
- `src/components/WorkspaceView.tsx`：`handleAddClaudeCliAsTower`；`startClaudeCliPty` 依 `launchRole` 選名稱
- `src/locales/en.json`、`zh-TW.json`、`zh-CN.json`：`terminal.openClaudeAsTower` / `terminal.openClaudeAsTowerHint`
- 新增測試：`src/stores/__tests__/workspace-store.launchRole.test.ts`、`src/components/__tests__/open-claude-as-tower-menu.test.tsx`
- 新增 e2e：`e2e/t0644-open-claude-as-tower.spec.ts`
- `electron/__tests__/claude-session-name-launch.test.ts`：只加一行 tower 分支斷言（依 Q-1 答覆 [A]，見下方）

### 測試清單

- `workspace-store.launchRole.test.ts`（6 個）：只有明確指定時才記錄 `launchRole`；save → load 後保留，舊資料與其他值不帶這個欄位；detached 收回後保留；source guard 檢查：handler 依序走 `addTerminal(…, { launchRole: 'tower' })`、`setAutoTitle`、`startClaudeCliPty`，不設角色、不輸入指令、不呼叫 rename；`startClaudeCliPty` 從 store 讀 `launchRole` 選名稱；`onAddClaudeCliAsTower` 有接到 ThumbnailBar。
- `open-claude-as-tower-menu.test.tsx`（6 個）：項目排在 Claude CLI 下方，點擊時呼叫 tower handler 而不是 `onAddAgent`；Claude CLI 不可用時停用；選單沒有 Claude CLI 時排在最後；沒傳 callback 時不顯示；舊版選單；三語 key 都存在。
- `claude-session-name-launch.test.ts`：新增一行 tower 分支斷言。
- e2e `t0644-open-claude-as-tower.spec.ts`：隔離實例，工作區名稱 `測試工作區 T0644`，claude-cli 自訂參數為 `--version`（不耗 token）。驗證四件事：
  1. 從新入口開分頁 → 存檔帶 `launchRole: 'tower'`、標題 `Claude CLI · Tower`，日誌有 `[bat-mcp] tab … '--name=測試工作區 T0644 · Tower'; … name=yes`
  2. 從既有「Claude CLI」入口開分頁 → `--name=測試工作區 T0644 · <短 ID>`，不帶 `launchRole`
  3. ⏻ 重啟 Tower 分頁 → 名稱仍是 `· Tower`
  4. reload（模擬 BAT 重開還原）→ Tower 分頁仍是 `· Tower`，一般分頁仍是 `· <短 ID>`

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS | 0（HEAD `64374e0d`） |
| `npm run typecheck:electron` | PASS | 0（本單只動到 electron 的測試檔，仍跑了一次） |
| `npm run test:unit` | PASS | 310 files / 5371 passed / 3 skipped（含 T0642 新增的測試；基線 5334 / 307） |
| `npx vite build` | PASS | exit 0 |
| e2e `t0644-open-claude-as-tower.spec.ts` | PASS | 跑了兩次：第一次在 `6174a6f2` 提交前的工作樹，1 passed；第二次在 HEAD `64374e0d` 與 `t0641` 一起跑，2 passed |
| e2e `t0641-claude-session-name.spec.ts`（回歸） | PASS | HEAD `64374e0d`，1 passed |
| 入口截圖 | 已存 | `e2e-results/t0644/add-menu.png`：選單打開，「以塔台開啟 Claude」在「Claude CLI」正下方。`e2e-results/t0644/tower-tab.png`：分頁標題 `Claude CLI · Tower`，PTY 顯示 `'--name=測試工作區 T0644 · Tower' --version` → `2.1.300 (Claude Code)`。`e2e-results/` 已列在 `.gitignore`，不入版控 |

與 T0642 並行的情況：T0642 尚未提交時跑的第一次全量 `test:unit` 有 1 個失敗，就是 Q-1 提到的 guard，其餘全部通過；T0642 提交後重跑，全部通過。build 與 e2e 沒有出現與本單無關的失敗。

### Commit

- `97922596` chore: T0644 IN_PROGRESS, Q-1 to Tower（工單）
- `6174a6f2` feat(T0644): "Open Claude as Tower" entry（產品程式 + 單元測試 + e2e）
- `64374e0d` test(T0644): source guard also covers the Tower session name branch（Q-1 [A]）
- 另有本次收尾 commit（回報區）
- 全部用 `git commit --only`；沒有碰 `src/styles/settings.css` 的 M；沒有 push

### 偏差與遭遇問題

- Q-1：T0641 的 source guard 逐字比對 tab 名稱那一行；本單改成依 `launchRole` 選名稱後，這條斷言失敗。塔台答覆 [A]。17:07:39 第 15 次檢查時條件成立，這時 T0642 的 commit `12da2ca6` 已經自行把 tab 分支斷言改成符合本單的寫法（比對 `: claudeSessionName({ role: 'tab', … })) ?? undefined`）。因此本單只在同一個 `it(...)` 裡補一行 tower 分支斷言，其他斷言都沒動。
- 超出 `affects_files` 的檔案：`src/components/ThumbnailBar.tsx`（就是工單所說「新增入口所在的元件」）；`electron/__tests__/claude-session-name-launch.test.ts`（依 Q-1 答覆）。

### 文件草稿（給 T0643 併入 `docs/agent-guide/claude-session-name.md` 與 CLAUDE.md）

**`docs/agent-guide/claude-session-name.md` 新增一節「以塔台開啟 Claude（T0644，PLAN-050 D）」：**

- 入口：分頁縮圖列「+」選單，緊接在「Claude CLI」下方的「以塔台開啟 Claude」（en `Open Claude as Tower`、zh-CN `以塔台打开 Claude`；i18n key `terminal.openClaudeAsTower` / `terminal.openClaudeAsTowerHint`）。Claude CLI 在該視窗不可用時，以同一個原因停用；選單沒有 Claude CLI 時排在 agent 清單最後。實作：`ThumbnailBar` 的 prop `onAddClaudeCliAsTower`、`WorkspaceView.handleAddClaudeCliAsTower`。
- 行為：一律開 claude-cli 分頁（不看工作區預設 agent），套用工作區生效的 claude-cli 啟動參數（`getEffectiveAgentArgs`），session 名稱為 `<ws> · Tower`（`claudeSessionName({ role: 'tower' })`）。標題預設 `Claude CLI · Tower`（`setAutoTitle`，與 T0562 一致；使用者改名優先）。
- 🔴 只負責命名：不呼叫 `terminal:set-role`、不設定塔台角色、不自動輸入任何指令；塔台角色仍由 CT 啟動時以 `--set-role tower` 宣告。CT 宣告後標題的結果為 `unchanged`。
- `launchRole`：`TerminalInstance.launchRole?: 'tower'`，隨分頁一起存檔（`workspaceStore.save()`）。還原時只接受 `'tower'`；detached 視窗收回時保留。`startClaudeCliPty` 每次從 store 讀這個欄位決定名稱，所以新建、⏻ 重啟、BAT 重開還原都是同一個名稱。沒有 `launchRole` 的分頁照 T0641 規則（`<ws> · <短 ID>`）。
- 不注入名稱的情況與 T0641 相同：自訂參數已含 `--name` / `-n` 時不注入；system claude `< 2.1.76` 或讀不到版本時不注入。
- 已知限制：
  - 名稱只在 BAT 啟動 claude 時決定。分頁內執行 `/rename`，或之後改了工作區名稱，都不會反映到已在執行的 session；要等下次 ⏻ 重啟才會用新的工作區名稱。
  - 只支援 claude-cli；claude-cli-worktree、Claude Agent（SDK）、codex 等沒有這個入口。
  - 同一個工作區開多個「以塔台開啟」分頁時名稱相同（都是 `<ws> · Tower`），ListAgents 上分不出來。
  - 使用者手動改分頁名稱不影響 session 名稱（名稱看 `launchRole`，不看標題）。
- 驗證清單：`src/stores/__tests__/workspace-store.launchRole.test.ts`、`src/components/__tests__/open-claude-as-tower-menu.test.tsx`、`electron/__tests__/claude-session-name-launch.test.ts`（tower 分支 guard）；e2e `e2e/t0644-open-claude-as-tower.spec.ts`（新入口 / 既有入口 / ⏻ 重啟 / reload；截圖存 `e2e-results/t0644/`）。

**CLAUDE.md「Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）」節加一行：**

- 「以塔台開啟 Claude」（T0644）：縮圖列「+」選單，位置在 Claude CLI 下方；開 claude-cli 分頁並記錄 `launchRole: 'tower'`（持久化），`startClaudeCliPty` 依此取名 `<ws> · Tower`，⏻ 重啟與還原沿用。🔴 只命名，不做 `--set-role`、不輸入指令；標題用 `setAutoTitle`（`Claude CLI · Tower`）。

### 互動紀錄

- [16:53] Q-1: T0641 的 source guard 逐字比對 tab 名稱那一行，可以由本單修改這條 `electron/__tests__` 斷言嗎？ → A（塔台，BAT 通道，choice 1）: [A] 同意，只改那一個 `it(...)`。先提交本單其他檔案，等 T0642 提交該測試檔（每 60 s 檢查一次，最多 45 分鐘）；條件成立後只改那條斷言並用 `git commit --only` 提交，全部通過後收尾；逾時則以 PARTIAL 收尾。 → Action: 先提交 `6174a6f2`；17:07:39 條件成立（T0642 的 `12da2ca6` 已自行改好 tab 分支），補上一行 tower 分支斷言（`64374e0d`），全部測試通過。

### Renew 歷程

無。
