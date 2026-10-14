---
schema_version: 1
schema_kind: workorder
id: T0529
title: "PLAN-040：工作區層級預設 Agent ＋ Agent 啟動參數覆寫（設定入口、store、持久化、所有 consumer 含外部 helper 派工）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-040
priority: P1
sizing: M
created_at: "2026-10-14T17:50:29+0800"
started_at: "2026-10-14T17:51:49+0800"
updated_at: "2026-10-14T18:08:35+0800"
completed_at: "2026-10-14T18:08:35+0800"
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

- [x] 工作區設定可設 / 清除預設 Agent 與各 preset 啟動參數，重啟後保留
- [x] 所有 consumer（UI 按鈕、新建終端、外部 helper `--agent` 派工）使用工作區生效值；D140 查找順序不變
- [x] helper `--agent` 派工套用生效參數（與 UI 一致），raw command 模式不變
- [x] detached 視窗只讀，持久化規則不回歸
- [x] 三語 i18n
- [x] CLAUDE.md 補「工作區層級 Agent / 啟動參數」一節（查找順序、覆寫語意、detached 限制、helper 套用規則）；`_ct-workorders/_local-rules.md`「Agent 自訂參數自動套用」更新為新現況
- [x] PLAN-040：狀態與「實作」段同步

## Sub-session 執行指示

1. 讀本工單、PLAN-040、D142（`_ct-workorders/_decision-log.md`）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。工作區層級預設 Agent 與 Agent 啟動參數覆寫已完成，設定、儲存、所有 consumer 都接上了，外部 helper `--agent` 派工也包含在內。

- Landing Zone Check：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`。C-1 PASS。C-3 有可測項目且存在（`src/types/index.ts` 等）。C-2 工單沒有 `branch` 欄位，實際在 `main`。觀察到的 `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）。派發模式為 `CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 生效值解析集中在 **`src/lib/agent-launch-settings.ts`**，renderer 與 main 共用同一份，所以不需要另寫一致性測試：
  - `resolveEffectiveDefaultAgent(workspace, settings)`：查找順序為工作區 → Settings → `claude-code`（D140 不變）。
  - `resolveEffectiveAgentArgs(workspace, settings, presetId | presetIds[])`：以 preset 為單位。工作區有該 key（包含空字串）就整串取代全域值，沒有就用全域值，空字串代表不帶參數。可接受多個候選 id，查找時先查完工作區層的所有候選，再查全域層。
  - 另有 `hasWorkspaceArgsOverride` 與 `appendAgentArgs`。registry 的資料型別錯誤時一律忽略。
- 設定入口：工作區右鍵選單的「環境變數」改名為「**工作區設定…**」，`WorkspaceEnvDialog.tsx` 改為工作區設定對話框，環境變數成為其中一區。對話框包含：
  - 預設 Agent 下拉：「跟隨全域設定（目前：X）」加上所有 preset，清單與 Settings 相同，都用 `getVisiblePresets()`。
  - 「目前生效：agent（來源）」，來源分為此工作區、全域設定、內建預設三種。
  - 每個 preset 一列：「覆寫」勾選框、參數欄、來源標籤。未勾選時參數欄唯讀、灰字顯示全域值。勾選時先把全域值帶入，之後可以改。
- store（`workspace-store.ts`）新增：
  - `setWorkspaceDefaultAgent(id, agent | undefined)`、`setWorkspaceAgentCustomArg(id, presetId, args | undefined)`，寫法比照 `setWorkspaceEnvVars`：`notify()` 之後立即 `save()`。
  - `getEffectiveDefaultAgent(workspaceId)`、`getEffectiveAgentArgs(workspaceId, presetId)`：讀 store 的最新 state，不會被 memo 住的 callback 拿到舊值。
- Settings 的「預設 Agent」與「Agent 自訂參數」提示都補了一句「可在工作區設定覆寫」，三語都有。

### helper 派工原本是否套用自訂參數（查證結果）

**原本就有套用全域參數，只是不看工作區。** `_local-rules.md` 寫的「暫不支援，依賴 UI 按鈕」與實際不符。

- agent 模式（`terminal:create-agent-command`）自 `3abfb98`（2026-04-25，`feat(agent): 增加代理設定與命令創建功能…`）起就有 `extraArgs = settings.agentCustomArgs[agentId] || settings.agentCustomArgs[requestedAgent]`。T0431（`9fa2cc3`）把這段搬到 `electron/terminal-command-handlers.ts` 時沒有改動邏輯。
- 不看工作區的部分：`--agent default` 會讀工作區的 `defaultAgent`，但實務上它永遠是空的（沒有寫入點）；參數一律取全域值。
- 現在的行為：`--agent default` 與 `--agent <id>` 都套用**落點工作區**（T0523 規則）的生效參數，與 UI 按鈕一致。raw command 模式（`terminal:create-with-command`）不加參數，行為沒變。
- 主行程日誌在行尾多一欄 `argsSource=workspace|settings|builtin`。放在行尾是為了不破壞 T0523 e2e 對整行的比對。

### 修改檔案

新增：
- `src/lib/agent-launch-settings.ts`：唯一的解析實作。
- `src/lib/__tests__/agent-launch-settings.test.ts`
- `src/stores/__tests__/workspace-store.agentSettings.test.ts`
- `src/components/__tests__/workspace-settings-dialog.test.tsx`：對話框測試，另含 consumer source guard。
- `electron/__tests__/workspace-agent-launch-dispatch.test.ts`
- `e2e/t0529-workspace-agent-launch.spec.ts`

修改：
- `src/types/index.ts`：新增 `Workspace.agentCustomArgs`。
- `src/stores/workspace-store.ts`：上述 setter 與 getter。
- `src/components/WorkspaceEnvDialog.tsx`：改為工作區設定，支援 `readOnly`。
- `src/styles/env-snippets.css`：新增對話框樣式。這個檔案原本工作目錄是 CRLF，已正規化為 LF；repo 本來就以 LF 儲存（`.gitattributes eol=lf`），diff 只有新增的段落。
- `src/App.tsx`：
  - CT 派工按鈕改用生效值。
  - 主視窗的對話框接上 setter。
  - detached 分支加入唯讀對話框。
- `src/components/WorkspaceView.tsx`：
  - 7 處 `getAgentCustomArgs` 與 3 處 `workspace.defaultAgent || settings.defaultAgent` 都改用生效值。
  - `buildLaunchCommand` 帶入生效參數。
  - 新增 `onOpenWorkspaceSettings` 的分頁列齒輪按鈕，只有 detached 視窗會傳入這個 prop。
- `src/components/Sidebar.tsx`：選單文字改為 `sidebar.workspaceSettings`。
- `src/locales/{en,zh-TW,zh-CN}.json`：新增 `workspaceSettings.*` 與 `sidebar.workspaceSettings`，並補兩處 Settings 提示。
- `src/types/electron.d.ts`、`electron/preload.ts`：`agent.buildLaunchCommand(id, options?, extraArgs?)`。
- `electron/main.ts`：
  - `resolveWorkspaceDefaultAgent` 改為 `resolveWorkspaceAgentSettings`。
  - `agent:build-launch-command` 的第三參數用於 codex daemon opt-out 去重，沒帶時退回 Settings。
- `electron/terminal-command-handlers.ts`：
  - 依賴 `resolveWorkspaceAgentSettings`，取代原本的 `resolveWorkspaceDefaultAgent`。
  - `BuiltAgentCommand.argsSource`
  - 日誌新增 `argsSource=`。
- `electron/dispatch-workspace.ts`：新增 `findWorkspaceAgentSettings(entries, workspaceId)`，讓 main 的查找可以測試。
- `electron/remote/headless-entry.ts`：只改依賴名稱，headless 仍回傳 `null`。
- `electron/__tests__/agent-prompt-command.test.ts`：依新的依賴改寫。T0431 legacy 等價矩陣與 golden 字串都不變，仍然全綠。
- 文件：`CLAUDE.md` 新增一節、`_ct-workorders/_local-rules.md`、`_ct-workorders/PLAN-040-…md`，以及本工單。

未納入 commit：`src/styles/settings.css`（開工前就是 M 狀態，不是本單的變更）。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | **PASS** | exit 0，0 個錯誤 |
| `npm run typecheck:electron` | **PASS** | exit 0，0 個錯誤 |
| `npx vite build` | **PASS** | exit 0 |
| `npm run test:unit`（全套） | **PASS** | 221 個檔案通過；3700 個測試通過，1 個 skipped |
| 生效值解析 | **PASS** | `agent-launch-settings.test.ts`：未設 → 全域；空字串 → 無參數；有值 → 取代；`defaultAgent` 未設 → 全域 → `claude-code`；多候選 id；資料格式錯誤 |
| store 設定、清除、持久化、load 還原 | **PASS** | `workspace-store.agentSettings.test.ts` |
| UI consumer | **PASS** | store getter 測試，加上 source guard 確認 `App.tsx`、`WorkspaceView.tsx` 已不再呼叫 `settingsStore.getAgentCustomArgs` 或 `defaultAgent \|\| settings.defaultAgent` |
| helper `--agent default`、`--agent codex-cli`、`--agent codex`（簡寫）、空覆寫、raw 模式 | **PASS** | `workspace-agent-launch-dispatch.test.ts`，用真的 builder，`resolveDispatchWorkspaceFromEntries` 與 `findWorkspaceAgentSettings` 走同一份假 registry |
| detached 唯讀 | **PASS** | 對話框測試：唯讀時所有輸入停用並顯示提示。source guard：detached 分支沒有呼叫 setter |
| detached 持久化不回歸 | **PASS** | 全套 unit 已包含 `window-registry-detached-terminals`、`detached-workspace-persistence`、`renderer-flush`、`workspace-store.adoptDetached` / `flushSave`。e2e 見下兩列 |
| e2e `t0529-workspace-agent-launch.spec.ts` | **PASS** | 隔離實例，自訂 CLI 執行 node 腳本把 argv 與 `BAT_TERMINAL_ID` 寫入 temp jsonl，不消耗 token。驗證內容：<br>• A（agent X + 覆寫參數）與 B（跟隨全域）的 helper `--agent default` 命令列<br>• B 的 `--agent <id>`<br>• raw 模式不加參數<br>• C、D 工作區開啟時自動建立的 Agent 終端<br>• 在對話框設定與清除後，registry 立即反映（主行程讀得到） |
| e2e 回歸：`t0523-dispatch-workspace`、`detached-flush-on-close`、`detached-close-edges` | **PASS** | 與 `detached-terminal-persistence` 同一批執行。這批 4 個 spec 中，`t0523`、`flush-on-close`、`close-edges` 通過 |
| e2e 回歸：`detached-terminal-persistence` | **PASS**（重跑） | 第一次與其他 spec 合跑時在清除 temp 目錄的階段失敗：`EPERM … \\?\C:\…\Temp\t0491-HNtg4d`，屬 Windows 檔案鎖，功能斷言都已通過。單獨重跑為 `1 passed` |
| 實機 UI 驗收（真人） | 未做 | 對話框的視覺與 UX 需要人工確認，建議隨 pre.10 一併驗收 |

依 L141 沒有跑全套 e2e。

### detached / 多視窗 / 遠端說明

- **detached 視窗**：
  - 原本沒有任何工作區設定入口：detached 視窗沒有 sidebar，主視窗的 sidebar 也會濾掉 detached 中的工作區。
  - 現在分頁列多一個齒輪按鈕，開啟**唯讀**的工作區設定，所有輸入停用，並提示「關閉此視窗讓工作區回到主視窗後，再於主視窗修改」。
  - `saveDetachedWorkspaceTerminals` 沒有改動。
  - detached 期間兩邊都改不了這個工作區的設定，所以不會發生「主視窗改了、detached 沒看到」的情況。detached 視窗開啟時從父 entry 載入（`workspace:load`），值與 detach 當下一致，之後的派工與新建終端都讀得到。
- **主行程何時讀得到**：每個 setter 都會立即 `save()`，經過 `workspace:save` 進入 window registry。helper 派工時 `findWorkspaceAgentSettings` 讀 `windowRegistry.readAll()`，所以存檔完成後的下一次派工就生效，不必等 30 秒 autosave。e2e 已驗證設定與清除都立即寫入 registry。
- **多視窗**：同一 profile 另開的主視窗只顯示自己的工作區，工作區設定沒有跨視窗即時同步的需求；主行程永遠讀 registry 的最新值。
- **profile 快照與匯出入**：沿用整個工作區物件，新欄位自動帶上，沒有另外處理。
- **遠端**：
  - 遠端視窗的 UI 按鈕與新建終端在 client 端計算生效值（工作區存在 client 的 registry），照樣生效。
  - 遠端 Tower 經 headless bat-server 的 helper 派工**沒有工作區層級**：server 只讀 `<dataDir>/settings.json`，headless 的 `resolveWorkspaceAgentSettings` 回傳 `null`。這部分依工單不做。
  - 權杖範圍沒有改動。

### 偏差 / 備註

1. **超出 `affects_files` 的檔案**：
   - `electron/preload.ts`、`src/types/electron.d.ts`：`agent:build-launch-command` 原本拿**全域**參數判斷 codex daemon opt-out（T0377）。工作區覆寫參數後必須改傳生效值，否則工作區寫了 `--no-daemon` 仍會被加上 daemon 旗標。這是新增的可選參數，舊呼叫端行為不變。
   - `src/styles/env-snippets.css`：新增對話框樣式。
   - `electron/remote/headless-entry.ts`：只改依賴名稱。
2. **輕微語意差異**：全域參數為「只有空白」的字串時，舊的 helper 會用它（trim 後等同沒有參數），現在會改查下一個候選 key。Settings store 本來就會 trim 並刪除空值，實務上不會出現這種值。
3. **下拉不含自訂 CLI**：與 Settings 一致，都用 `getVisiblePresets()`。所以自訂 CLI 的工作區覆寫目前只能透過資料設定，無法在 UI 上設定；這也是 e2e 的自訂 CLI 用 seed 資料的原因。若要讓 UI 列出自訂 CLI，需要另開一單，同時改 Settings 與工作區設定。
4. **既有小問題（未修，範圍外）**：detached 視窗 GitHub 面板的「開啟設定」（`onOpenSettings`）只會 `setShowSettings(true)`，但 detached 分支沒有渲染 `SettingsPanel`，所以按了沒有反應。本單曾短暫加入後又移除，以免擴大範圍。建議塔台評估是否開單。
5. 右鍵選單的 key 由 `sidebar.environmentVariables` 改為 `sidebar.workspaceSettings`。舊 key 保留在 locale 中，`settings.environmentVariables` 等仍有其他地方在用。

### Commit

`feat(workspace): T0529 PLAN-040 workspace default agent and launch args`（`git commit --only` 只納入本單檔案；不 push）。實際 hash 請以 `git log --oneline -1` 為準。
