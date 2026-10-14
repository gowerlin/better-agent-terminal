---
schema_version: 1
schema_kind: workorder
id: T0529
title: "PLAN-040：工作區層級預設 Agent ＋ Agent 啟動參數覆寫（設定入口、store、持久化、所有 consumer 含外部 helper 派工）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-040
priority: P1
sizing: M
created_at: "2026-10-14T17:50:29+0800"
started_at: ""
updated_at: "2026-10-14T17:50:29+0800"
completed_at: ""
target_version: "0.6.0-pre.10"
related:
  - PLAN-040
  - D142
  - D140
  - "T0128（全域 Agent 自訂參數 agentCustomArgs）"
  - "T0523 / T0527（外部 helper 派工落點、--agent 簡寫）"
  - BUG-129
affects_files:
  - src/types/index.ts
  - src/stores/workspace-store.ts
  - src/components/WorkspaceEnvDialog.tsx
  - src/components/Sidebar.tsx
  - src/components/WorkspaceView.tsx
  - src/components/SettingsPanel.tsx
  - src/App.tsx
  - src/lib/
  - src/locales/
  - electron/main.ts
  - electron/terminal-command-handlers.ts
  - electron/dispatch-workspace.ts
  - electron/window-registry.ts
  - electron/__tests__/
  - src/stores/__tests__/
  - src/__tests__/
  - src/components/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/_local-rules.md
  - _ct-workorders/T0529-workspace-agent-and-launch-args.md
  - _ct-workorders/PLAN-040-workspace-default-agent-setting.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）；helper 測試設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp（CLAUDE.md BUG-114 節）。e2e 一律隔離實例、用 echo 自訂 agent，不消耗 Claude / Codex token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 **D140 不變**：`--agent default` 查找順序維持「落點工作區 defaultAgent → Settings defaultAgent → claude-code」，不得改成沿用塔台自己的 agent。"
  - "🔴 **Detached 視窗持久化規則不得破壞**（CLAUDE.md「Detached workspace 視窗的持久化」）：`workspace:save` 從 detached 視窗只合併終端清單。D142：detached 視窗的設定入口只讀並提示到主視窗設定；不要改 `saveDetachedWorkspaceTerminals` 的語意。"
  - "🔴 遠端 headless 權杖範圍不變（PLAN-036 K / T0450）；本單不實作遠端工作區預設。"
  - "🔴 三語 i18n（`src/locales/*.json`）同步，不得只加一種語言。"
---

# T0529 — 工作區層級預設 Agent ＋ 啟動參數覆寫（PLAN-040）

## 背景

- `Workspace.defaultAgent`（`src/types/index.ts:18`）有 consumer 在讀（`src/App.tsx` 派工按鈕、`src/components/WorkspaceView.tsx` 新建 Agent 終端 / 派工、`electron/main.ts` `resolveWorkspaceDefaultAgent` 外部派工），但 **store 與 UI 都沒有寫入點**，永遠是空的（D140 更正、PLAN-040）
- Agent 啟動參數目前只有全域：`settings.agentCustomArgs?: Record<presetId, string>`（`src/types/index.ts:316`，T0128）
- 使用者（2026-10-14 17:4x）決定 PLAN-040 擴大為「各工作區獨立設定 Agent **與啟動參數**」，現在開工。情境：Gary 一個專案用 Codex、一個用 Claude，而且不同專案的 Codex 想帶不同 `--model` / `-c` 參數

請先讀 **PLAN-040**（範圍初稿、持久化邊界）、**D142**（本單設計裁決）。

## 設計裁決（D142，Worker 照做；有更好理由可調整並在回報區說明）

1. **資料**：`Workspace` 新增 `agentCustomArgs?: Record<presetId, string>`（與全域同形）。`defaultAgent` 沿用既有欄位
2. **覆寫語意**：以 preset 為單位
   - 工作區 `agentCustomArgs` **沒有**該 preset 的 key → 跟隨全域 `settings.agentCustomArgs[preset]`
   - **有** key（含空字串）→ 整串取代全域（不串接）。空字串 = 「這個工作區不帶任何自訂參數」
   - `defaultAgent` 未設定 = 跟隨全域（D140 順序不變）
   - 生效值的解析集中成**單一函式**（例如 `resolveEffectiveAgentArgs(workspace, settings, presetId)`），renderer 與 main 共用或各有一份但有一致性測試，不要在各 consumer 內聯
3. **設定入口**：建議放在既有的工作區設定對話框 `WorkspaceEnvDialog.tsx`（必要時把標題 / 入口改成「工作區設定」，環境變數成為其中一區）：
   - 預設 Agent 下拉：「跟隨全域（目前：<全域值>）」+ 所有 agent preset（清單與 Settings 預設 Agent 下拉一致）
   - 啟動參數：每個 preset 一列（或至少目前選定 / 生效的 agent），「覆寫全域」勾選 + 參數文字欄；未勾選時顯示全域值（唯讀、灰字）
   - 顯示「目前生效的 agent 與參數、來源」（工作區 / 全域 / 內建）
   - Settings 的預設 Agent 與自訂參數提示文字補一句「可在工作區設定覆寫」
4. **store**：`workspace-store.ts` 新增寫入 API（比照 `setWorkspaceEnvVars` 的寫法與持久化），能設定與清除（回到跟隨全域）
5. **detached 視窗**：設定入口只讀，提示「請在主視窗設定」；detached 視窗內的派工 / 新建終端仍要**讀到**最新的工作區值（主視窗改完後 detached 何時看到，說明現況即可，不要求即時同步）
6. **consumer 全部改用生效值**：
   - UI：派工按鈕（`App.tsx`）、新建 Agent 終端與派工（`WorkspaceView.tsx`）、其他用到 `agentCustomArgs` 的地方（全部 grep 出來）
   - main：外部 helper 派工 `terminal:create-agent-command`（`--agent default` 以 T0523 落點工作區解析 agent）。**目前 helper 派工是否套用全域 `agentCustomArgs`，請先查清楚**：`_local-rules.md`「Agent 自訂參數自動套用」記載 helper 路徑「暫不支援，依賴 UI 按鈕」。D142：helper 的 `--agent` 模式（含 `default` 與指定 id）一律套用**落點工作區的生效參數**，與 UI 按鈕一致；raw command 模式（`bat-terminal.mjs codex …`）不加參數（使用者自己寫了完整指令）
   - main 讀工作區值的來源：window registry（`electron/window-registry.ts`）的 entry；確認 renderer 改設定後 main 何時讀得到（save 佇列 / autosave），必要時讓設定變更立即 save
7. **遠端 headless**：不做；在回報區說明現況（headless 用 `<dataDir>/settings.json`，沒有工作區層級）

## 驗證

- 單元：
  - 生效值解析：未設 → 全域；空字串 → 無參數；有值 → 取代；`defaultAgent` 未設 → 全域 → `claude-code`
  - store 設定 / 清除 / 持久化（含 load 後還原）
  - consumer：UI 派工按鈕、新建 Agent 終端、helper `--agent default` / `--agent codex` 都用到工作區生效的 agent 與參數；raw command 模式不加參數
  - detached 視窗：入口只讀；`workspace:save` 從 detached 不覆寫父 entry 的工作區設定（既有測試 `window-registry-detached-terminals` / `detached-workspace-persistence` 全綠）
- e2e（隔離實例，echo 自訂 agent；可擴充 `e2e/t0523-dispatch-workspace.spec.ts` 或新 spec）：兩個工作區分別設「agent X + 參數 A」與「跟隨全域」，helper 派工與新建 Agent 終端開出的命令列符合預期
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [ ] 工作區設定可設 / 清除預設 Agent 與各 preset 啟動參數，重啟後保留
- [ ] 所有 consumer（UI 按鈕、新建終端、外部 helper `--agent` 派工）使用工作區生效值；D140 查找順序不變
- [ ] helper `--agent` 派工套用生效參數（與 UI 一致），raw command 模式不變
- [ ] detached 視窗只讀，持久化規則不回歸
- [ ] 三語 i18n
- [ ] CLAUDE.md 補「工作區層級 Agent / 啟動參數」一節（查找順序、覆寫語意、detached 限制、helper 套用規則）；`_ct-workorders/_local-rules.md`「Agent 自訂參數自動套用」更新為新現況
- [ ] PLAN-040：狀態與「實作」段同步

## Sub-session 執行指示

1. 讀本工單、PLAN-040、D142（`_ct-workorders/_decision-log.md`）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

### helper 派工原本是否套用自訂參數（查證結果）

### 修改檔案

### 驗證

### detached / 多視窗 / 遠端說明

### 偏差 / 備註

### Commit
