---
schema_version: 1
schema_kind: workorder
id: T0523
title: "塔台派工落到錯的工作區 / --agent default 解析錯：讓派工落點與 agent 以塔台終端「目前所屬工作區」為準（BUG-129）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-129
priority: P1
sizing: M
created_at: "2026-10-14T13:31:24+0800"
started_at: "2026-10-14T13:33:09+0800"
updated_at: "2026-10-14T13:48:40+0800"
completed_at: "2026-10-14T13:48:40+0800"
target_version: "0.6.0-pre.8"
related:
  - BUG-129
  - "T0176（BAT_WORKSPACE_ID 注入）"
  - "T0137 / BUG-031（未帶 --workspace → active workspace，設計行為）"
  - "T0361（external terminal 落點日誌）"
  - "T0130（created-externally → addExternalTerminal）"
affects_files:
  - electron/terminal-command-handlers.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/remote/
  - scripts/bat-terminal.mjs
  - src/App.tsx
  - src/stores/workspace-store.ts
  - src/components/WorkspaceView.tsx
  - src/types/
  - electron/__tests__/
  - src/__tests__/
  - src/stores/__tests__/
  - scripts/__tests__/
  - _ct-workorders/T0523-tower-dispatch-workspace-routing.md
  - _ct-workorders/BUG-129-tower-dispatch-lands-in-wrong-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）；helper 測試設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp（CLAUDE.md BUG-114 節）。e2e 一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 遠端（headless，PLAN-036 K）權杖範圍不得放寬：tower 權杖仍只能 `terminal:create-agent-command`；`BAT_TOWER_TERMINAL_ID` 只能是自己。本機 / 遠端行為都要守住。"
  - "🔴 不改「完全沒帶 `--workspace` → active workspace」的既有設計（T0137 / BUG-031），除非有 notify-id 可推得更正確的落點且在回報區說明。"
---

# T0523 — 塔台派工落點 / agent 以塔台終端所屬工作區為準（BUG-129）

## 背景

Gary（mac，BAT ≥ pre.5）的 Codex 塔台在 **SCB** 工作區派工（`bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --agent default …`），Worker 分頁卻出現在 **土銀** 工作區，而且用 Claude Code 開（他預期 Codex）。cwd 是對的（SCB）。現象、三張截圖、初步分析見 **BUG-129**（請先讀並看截圖）。

塔台推定兩個症狀是同一根因：塔台 PTY 帶的 `BAT_WORKSPACE_ID` 不是 SCB（PTY 建立時注入、之後不變），導致落點與 `resolveWorkspaceDefaultAgent(workspaceId)` 都用了別的工作區。**Gary 的日誌尚未取得**（Gower 索取中）。

## 任務

1. **找出 `BAT_WORKSPACE_ID` 會跟分頁目前所屬工作區不一致的所有路徑**（逐條確認、寫進回報區）：分頁在工作區之間移動 / 拖曳、啟動還原、Terminal Server 重新接回既有 PTY（PTY 存活但 renderer 重建）、`pty:restart`、工作區複製 / 匯入、detach / reattach、外部建立（`created-externally` → `addExternalTerminal`）後分頁再被移動、`--workspace` 帶未知 id 時退回 active。哪條最可能是 Gary 的情境，依程式碼判斷
2. **修正方向（建議，Worker 可調整並說明取捨）**：派工的落點與 `default` agent 解析，以「**`--notify-id` 那個塔台終端目前在 renderer 所屬的工作區**」為準，`--workspace` 為次要 / 相容輸入：
   - 兩者一致 → 照舊
   - 不一致 → 用塔台終端實際所屬的工作區，`logger.warn` 記錄兩個 id
   - notify-id 找不到（外部 shell、舊 helper）→ 維持現行（`--workspace` → active）
   - 主行程是否知道「terminal → workspace」的即時對應、需不需要向 renderer 查詢，由 Worker 依架構決定；遠端 headless 的對應方式一併考慮（headless 沒有 renderer workspace）
3. **讓 `BAT_WORKSPACE_ID` 不再過期**（若成本可接受）：例如分頁換工作區時更新 main 端的 terminal→workspace 對應，讓 helper 有可靠來源；PTY 的 env 本身改不了，在回報區說明
4. **`--agent default` 的語意**：確認修正後 `default` = 落點工作區的 `defaultAgent` → `settings.defaultAgent` → `claude-code`。Gary 預期 Codex：判斷這是「工作區解析錯」造成，還是他的 SCB 工作區 / 全域本來就沒設 Codex。若有「塔台本身跑在 Codex，`default` 卻開 Claude」這種 UX 落差，在回報區提出建議即可，不要自行改預設語意
5. **可觀測性**：`bat-terminal.mjs` 成功時的 stdout 與 `bat-scripts.log` 加印實際落點工作區（名稱或 id）與解析出的 agent，讓塔台能自行核對（不得破壞「成功判定只看 exit code」與 `waitForMessage` 以 frame id 比對的既有規則）
6. **Gary 情境的判定方式**：在回報區寫明拿到 Gary 日誌後要看哪幾行（例如 `[T0130] External terminal added … workspaceId(landed)=… workspaceId(requested)=…`、`[agent-command] resolved agent=…`）以及如何對應到第 1 點的哪條路徑

## 驗證

- 單元測試：塔台終端屬 B、`--workspace` 帶 A → 落在 B、agent 用 B 的 default；兩者一致 → 不變；notify-id 未知 → 維持既有行為；未帶 `--workspace` → active（不變）；第 1 點找到的具體過期路徑至少一條有回歸測試
- 遠端 headless：既有 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`、權杖範圍測試全綠
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- 可行的話，用隔離實例做 e2e：兩個工作區，在 B 的終端以 helper 帶 A 的 workspace id 派工，確認落在 B

## 驗收條件

- [ ] 根因路徑清單 + 最可能的 Gary 情境（日誌未到前標明「推論」）
- [ ] 塔台終端所屬工作區與 `--workspace` 不一致時，落點 / agent 以塔台所屬工作區為準
- [ ] helper 輸出 / 日誌可看到實際落點與 agent
- [ ] 遠端權杖範圍不變
- [ ] BUG-129：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-129、三張截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**（驗收條件全部達成），但有一個殘留風險要先講：**Gary 的情境最可能（推論）是 agent CLI 自己還原了舊環境**，這種情況下 `--notify-id` 跟 `--workspace` 兩個值都是錯的，本單的修正**改不回正確落點**，只能讓錯誤被看見（helper 會印出實際落點）。細節見第 2 節，後續建議見第 7 節。

本單完成的事：
- 本機派工：落點與 `--agent default` 都改成以「`--notify-id` 塔台終端在 window registry 裡所屬的工作區」為準，`--workspace` 退為 fallback；兩者不一致時 `logger.warn`
- 遠端 headless：server 端沒有 registry，`--workspace` 照舊傳下去；改由 client renderer 的 `addExternalTerminal` 判斷：這個視窗有該塔台終端時，落在塔台的工作區。權杖範圍完全沒動
- `pty:restart` 會保留 `BAT_WORKSPACE_ID`。原本 Electron 重啟後會變成空字串，Terminal Server 重接（T0108）後再重啟也一樣
- 多視窗：本機 `created-externally` 會送到所有視窗，沒有該工作區的視窗原本會把分頁加進自己的 active 工作區（重複、落錯）。現在只要 registry 認得該工作區，其他視窗就略過
- helper 成功時在 `✓ Terminal created` 之後多印實際落點與 agent，並寫進 `bat-scripts.log`

### 1. 讓 `BAT_WORKSPACE_ID` 與分頁所屬工作區不一致的路徑（逐條，依程式碼）

前提：renderer 在建立分頁時注入的值一律正確。每個 `WorkspaceView` 以 `key={workspace.id}` 渲染（`src/App.tsx:1100`），所有 `pty.create` / `createWithCommand` 都帶自己的 `workspace.id`；`workspace-store` **沒有任何 API 會改 `terminal.workspaceId`**（`reorderTerminals` 只排序）。

| # | 路徑 | 結論 | 處理 |
|---|---|---|---|
| 1 | 分頁在工作區之間移動 / 拖曳 | **不存在**：沒有搬移功能 | — |
| 2 | 啟動還原（`initTerminals`） | 正確：帶自己的 `workspace.id`（`WorkspaceView.tsx:474` 等） | — |
| 3 | Terminal Server 重接既有 PTY（T0108 replay + idempotent `pty:create`） | 活著的 PTY 保留原 env，值正確；但 main 的 instance 沒有記 `workspaceId`，接下來的 restart 會帶空值 | **修**：idempotent `pty:create` 補記 `workspaceId`（`pty-manager.ts`） |
| 4 | `pty:restart`（分頁 ↺，非 claude-cli 分頁，例如 Codex CLI 分頁） | **過期**：Electron 的 `restart()` 重建 env 時不帶 `workspaceId`，結果是 `BAT_WORKSPACE_ID=''`。之後派工時 `--workspace ""` 會讓 helper 以 usage error exit 1 | **修** + 回歸測試（`pty-manager-helper-env.test.ts`，含 Terminal Server 路徑） |
| 5 | Terminal Server heartbeat 復原（T0112，`pty-manager.ts` recovery 段） | **過期**：重建時送出的 `pty:create` **不帶 env**，PTY 拿到的是 server 行程繼承的 env，`BAT_*` 不是缺就是過期 | **未修**（要重送整組 env，牽涉 helper token，超出本單）→ 第 7 節 |
| 6 | 工作區複製 / 匯入 | 找不到會複製 workspace id 的功能（profile snapshot 保留原 id） | — |
| 7 | detach / reattach | detached 視窗載入整個父 entry，兩邊都有所有工作區；分頁 id 不變，落點正確 | — |
| 8 | 外部建立（`created-externally`）後再被移動 | 分頁無法移動 | — |
| 9 | `--workspace` 帶未知 id → 退回 active（T0137 / T0361） | 設計行為。塔台找不到時維持原樣；找得到時由塔台決定 | 依工單方向 |
| 10 | **多個 registry 視窗（同一程序）** | **新發現**：本機事件送給所有視窗，沒有該工作區的視窗會退回自己的 active 工作區，結果分頁重複、落錯 | **修**：registry 認得該工作區時，payload 標 `workspaceResolved`，沒有該工作區的視窗略過（`workspace-store.ts`） |
| 11 | **agent CLI 自己還原環境**（例如 Codex 的 `shell_snapshot`，或 resume 一個在別的分頁開的 thread） | BAT 外部因素：agent 執行指令時看到的 `BAT_*` 不是 PTY 真正的 env | BAT 無法從 env 修正；本單讓它可見（helper 輸出）→ 第 2、7 節 |

### 2. 最可能的 Gary 情境（**推論**，Gary 日誌尚未取得）

- helper exit 0，代表 `--workspace "$BAT_WORKSPACE_ID"` **不是空字串**（空字串會 usage error exit 1）。所以 #4 不是 Gary 的情境，#5 在 Finder 啟動的 BAT 上也多半是空值
- Gary 只有一個視窗（「Default:1」），兩個工作區都在 sidebar，所以 #10 也不是
- 剩下兩種可能：(a) 值就是 **土銀的 id**，直接落在土銀；(b) 值是未知 id，退回 active，而派工當下 Gary 正在看土銀（Codex 已經跑了 15 分鐘，有可能）
- BAT 自己的路徑不會把**非空但屬於別的工作區**的 id 注入 SCB 分頁。最吻合 (a) 的是 #11：Gary 的 Codex 狀態列顯示 thread 名稱「**套用2025_土銀客服中心建置案規則**」，表示 SCB 分頁裡跑的是一個與土銀有關的 thread（可能是 resume 來的）。Codex 二進位裡有 `shell_snapshot` 機制（以 `thread_id` 為鍵，擷取並匯出 shell 環境；本機 codex-cli 0.162.1 的字串可見 `shell_snapshots` / `features.shell_snapshot` / `shell snapshot contains a brokered credential outside exported environment`）。如果 resume 時沿用了在土銀分頁擷取的快照，Codex 執行的每個指令都會看到土銀的 `BAT_WORKSPACE_ID` **和** `BAT_TERMINAL_ID`。這也和 Gary 的 Codex 塔台自己寫下的規則一致（「若繼承的 `BAT_WORKSPACE_ID` / `BAT_TERMINAL_ID` 指向其他專案」）
- agent 會開成 Claude，是因為解析到的工作區（土銀，或 (b) 的情況根本沒有工作區）沒有設 codex 為 defaultAgent，於是退到 `settings.defaultAgent` → `claude-code`
- ⚠️ 如果真的是 #11：`--notify-id` 也指向土銀的 Codex 分頁，本單的「塔台終端優先」會**一樣落在土銀**，Worker 的 notify 也會送到土銀分頁。本單在這個情境的價值只有可觀測性（helper 會印 `workspace: 2025_土銀… — the Tower terminal's workspace`，塔台可以自己核對）

### 3. Gary 日誌拿到後怎麼判定

`debug-*.log`（`~/Library/Application Support/BetterAgentTerminal/Logs/`）：
1. `[remote][terminal] terminal-created id=bbe2011f0a4c657884595b351f2a38ab result=true workspaceId=<R>` → R = helper 送來的 `--workspace`
2. `[agent-command] resolved agent=default to claude-cli` → 確認走的是 default
3. `[T0130] External terminal added: id=bbe2011f… workspaceId(landed)=<L> workspaceId(requested)=<R>`，若同時有 `[T0361] Workspace miss: requested=<R> …` → R 是未知 id

`bat-scripts.log`（同目錄）：
4. `"script":"bat-terminal","event":"invoke"` 的 `env`（`snapshotBatEnv`：`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID`）與 `"event":"parsed"` 的 `notifyId` / `workspaceId` → 塔台指令實際看到的值

`windows.json` 或 profile snapshot：
5. 從 `terminals[]` 找出 SCB 那個 Codex CLI 分頁的 `id`

對應方式：
- R = 土銀 id，且 4 的 `BAT_TERMINAL_ID` ≠ 5 的 SCB 分頁 id（而是土銀 Codex 分頁的 id）→ **#11**（env 來自另一個分頁）。本單無法修正，走第 7 節的後續工單
- R = 土銀 id，但 `BAT_TERMINAL_ID` = SCB 分頁 id → SCB 分頁本身 env 的 `BAT_WORKSPACE_ID` 過期（#5 或尚未發現的路徑）→ **本單的修正會讓它落在 SCB**
- R 未知且 L = 土銀 → #9（id 來自已刪除 / 重建的工作區或其他 profile，當下 active 是土銀）
- 快速自查（不用日誌）：在 SCB 的 Codex 裡執行 `echo $BAT_TERMINAL_ID $BAT_WORKSPACE_ID`，再在 SCB 開一個普通終端分頁執行同一行，比對兩邊的 `BAT_WORKSPACE_ID`；另外可以 `grep -l BAT_WORKSPACE_ID ~/.codex/shell_snapshots/*` 看快照內容

### 4. `--agent default` 的語意

修正後 `default` = **落點工作區**的 `defaultAgent` → `settings.defaultAgent` → `claude-code`（`createAgentPromptCommandBuilder` 的順序沒變，只是傳進去的 workspace 改成解析後的落點）。helper 會印出 agent 來源（`--agent` / the workspace's default agent / Settings default agent / built-in default）。

Gary 預期 Codex：就算落點正確（SCB），只要 SCB 工作區和全域都沒把 codex 設為預設，`default` 還是會開 Claude。他的 Codex 塔台事後是在**它自己專案的** `_local-rules.md` 記下「Worker 預設 Codex」，而不是改 BAT 設定，所以很可能 SCB 本來就沒設。**UX 建議（未實作，不改預設語意）**：在 workspace / settings 都沒設的情況下，`default` 可以考慮沿用「塔台終端自己的 agent preset」（塔台跑 codex-cli 就派 codex）；或在 Settings 的派工區塊加說明。這需要塔台決策。

### 5. 修改檔案

| 檔案 | 內容 |
|---|---|
| `electron/dispatch-workspace.ts`（新） | 純函式 `resolveDispatchWorkspaceFromEntries`：塔台終端 → `--workspace` → active；回傳 `workspaceId` / `workspaceName` / `known` / `source` / `mismatch` |
| `electron/terminal-command-handlers.ts` | 外部派工（沒有 invoking window）才解析；`create-agent-command` 用解析後的工作區組 agent；`created-externally` payload 加 `towerTerminalId` / `workspaceResolved`；`reportLanding` 時回 `{ ok, terminalId, workspace, agent }`；`agentSource`；mismatch 時 `[T0523]` warn；日誌補 `workspaceSource` / `requestedWorkspaceId` |
| `electron/handlers/terminal.ts`、`electron/main.ts` | 接上 `resolveDispatchWorkspace`（`windowRegistry.readAll()`）。headless 不提供，等於 passthrough |
| `electron/pty-manager.ts` | instance 記 `workspaceId`；`restart` 沿用；idempotent `pty:create` 補記 |
| `electron/preload.ts`、`src/types/electron.d.ts`、`src/App.tsx` | `onCreatedExternally` 型別補 `towerTerminalId` / `workspaceResolved`；`[T0130]` 日誌加 `tower=` |
| `src/stores/workspace-store.ts` | `addExternalTerminal`：這個視窗有該塔台終端時用塔台的工作區（本機 / 遠端都適用）；`workspaceResolved` 而本視窗沒有該工作區 → 略過 |
| `scripts/bat-terminal.mjs` | 送 `reportLanding: true`；成功時印 `  workspace: …` / `  agent: …`，mismatch 警告寫 stderr；`terminal-created` 事件記錄 `landing` / `agent`；help 文字更新 |
| 測試 | `electron/__tests__/terminal-handlers.test.ts`（+10）、`agent-prompt-command.test.ts`（legacy 比對排除 `agentSource` + 4 個 agentSource case）、`pty-manager-helper-env.test.ts`（+3）、`electron/remote/__tests__/headless-terminal.test.ts`（payload 多 `towerTerminalId`）、`src/stores/__tests__/workspace-store.addExternalTerminal.test.ts`（+4）、`tests/bat-terminal-response-correlation.test.mjs`（+2）、`e2e/t0523-dispatch-workspace.spec.ts`（新） |

相容性：
- 舊 helper 對新 BAT：沒送 `reportLanding`，照舊回 `true`
- 新 helper 對舊 BAT（含舊 headless server）：多出的欄位會被忽略，回 `true`，只印 `✓` 那一行
- 成功判定仍只看 exit code；`waitForMessage` 仍以 frame id 比對；`✓ Terminal created: <id>` 仍是 stdout 第一行
- 由視窗自己建立的分頁不經過解析器（測試守住）

### 6. 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| build | PASS | `npx vite build` exit 0 |
| 單元測試（全套） | PASS | `npm run test:unit`：216 files，3596 passed / 1 skipped（skipped 為既有） |
| 工單指定案例 | PASS | 塔台屬 B + `--workspace` A → 落 B、agent 用 B 的 default；兩者一致 → 不變；notify-id 未知 → `--workspace`；兩者都沒帶 → active（`workspaceId` undefined）；restart 過期路徑回歸測試 ×3 |
| 遠端 headless | PASS | `headless-remote-tower-e2e` / `headless-helper-capability` / `helper-capability` / `headless-helper-narrowing`：4 files 130 passed。`helper-capability.ts` 沒改 |
| 隔離實例 e2e | PASS | `npx playwright test e2e/t0523-dispatch-workspace.spec.ts`：1 passed。兩個工作區、塔台分頁在 B、helper 帶 A：stdout `workspace: T0523-B (e2e-t0523-ws-b) — the Tower terminal's workspace (--notify-id)` / `agent: e2e-t0523-echo-agent (--agent default: the workspace's default agent)`，registry 中落點 = B；對照組（無塔台、`--workspace` A）落 A。agent 用 `echo` 自訂 CLI，沒有啟動 LLM |
| 實機（Gary / mac） | 未驗 | 需要 Gary 日誌或升版後實測（第 3 節） |

全程沒碰使用者正在用的 BAT（port 9876 / 真實 userData）。helper 測試與 e2e 的 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 都指向 temp。沒有跑全套 e2e。

### 7. 後續建議（交塔台決策）

1. **#11 的根治**：用不依賴 env 的方式辨識呼叫者是哪個 PTY。例如 helper 送出自己的祖先 PID 鏈（mac / Linux 用 `ps -o ppid=`），main 拿去比對 PTY pid；或以 `cwd` 與工作區 `folderPath` 做一致性檢查（只作提示，T0137 已否決以 cwd 當主規則）。先用第 3 節確認 Gary 是不是 #11
2. **#5 Terminal Server heartbeat 復原不帶 env**：重建時應重送完整 env（含 helper 變數），另開工單
3. Electron `restart` 仍會丟掉 `customEnv`（工作區環境變數、Worker 的 `BAT_TOWER_TERMINAL_ID`）。T0448 刻意只對 headless 保留；Electron 要不要比照，需要決策
4. 第 4 節的 `default` agent UX 建議
5. `CLAUDE.md` / control-tower `references/auto-session.md` 可補一句：「`--notify-id` 塔台終端的工作區優先於 `--workspace`；helper 會印出實際落點」（本單 `affects_files` 不含這兩份檔案，所以沒改）

### 8. 偏差 / 備註

- 工單提到三張截圖，`D:\Downloads\` 只有兩張（`messageImage_1791955327079_0.jpg`、`messageImage_1791955358535_0.jpg`）。第三張 `messageImage_1791955533975.jpg` 不存在，該截圖內容改以 BUG-129 的文字描述為準
- 「完全沒帶 `--workspace`」：**有 `--notify-id` 且 registry 找得到該塔台時，改落在塔台的工作區**（工單允許「有 notify-id 可推得更正確的落點」）；兩者都沒有時仍是 active（T0137 不變）
- 本機 renderer 日誌 `[T0130] … workspaceId(requested)=` 現在顯示的是 main 解析後的 id；helper 原本送來的 `--workspace` 記在 main 的 `[T0523] dispatch workspace mismatch` 與 `[remote][terminal] terminal-created … requestedWorkspaceId=`
- 工作樹中另有其他 session 的變更（`src/styles/settings.css`、T0524 相關檔案），不屬本單，未 commit

### Landing Zone Check

- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS：工單位於 REPO_ROOT 之下
- C-3 PASS（informational）：前 5 個 `affects_files` 都存在
- C-2：工單沒有 `branch` 欄位（目前在 `main`）
- `BAT_WORKSPACE_ID`（evidence only）= `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Commit

- `dcdfffe` fix(dispatch): land Tower dispatches in the --notify-id terminal's workspace (T0523, BUG-129)（`git commit --only`，19 files；不 push）
- closeout metadata commit 接在其後
