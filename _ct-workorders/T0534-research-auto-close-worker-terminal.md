---
schema_version: 1
schema_kind: workorder
id: T0534
title: "研究：塔台收單完成後自動關閉 Worker 工單終端，BAT 需要改什麼、CT local_rule 能做到哪裡，並提出方案與推薦"
type: research
status: DONE
repo: better-agent-terminal
project: TOWER-UX
priority: P3
sizing: S
created_at: "2026-10-15T15:15:21+0800"
updated_at: "2026-10-15T15:25:58+0800"
completed_at: "2026-10-15T15:25:58+0800"
started_at: "2026-10-15T15:16:06+0800"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - "T0523 / BUG-129（派工落點：--notify-id 塔台終端所屬工作區）"
  - "T0525 / BUG-131（PtyManager 記 customEnv / agentPreset，buildPtyEnv 唯一組裝點）"
  - "T0432 / T0450（headless 範圍權杖：tower 角色只允許 terminal:create-agent-command）"
  - "T0504（detached 視窗關窗 flush）"
affects_files:
  - _ct-workorders/T0534-research-auto-close-worker-terminal.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **純研究，不改任何 tracked 檔**（除本工單）。不寫程式、不開 PLAN、不改 `_local-rules.md` 與 `~/.claude/skills/**`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。不要對真實 BAT 呼叫 `pty:kill` 或任何會關閉分頁的動作。需要實機觀察時一律隔離實例（`--runtime=<N>`），不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
---

# T0534 — 研究：收單後自動關閉 Worker 終端

## 背景

使用者問：塔台在「收單完成」後，能不能自動關掉 Worker 的工單終端？在 BAT 環境下要改 BAT，還是擴充 CT local_rule 就夠？

塔台初步判讀（**待本單驗證，不得直接當結論引用**）：

- 關分頁只存在於 renderer：`src/components/WorkspaceView.tsx` `handleCloseTerminal` / `handleConfirmClose`（停程序 → 視需要清 worktree → `workspaceStore.removeTerminal` → `save()`）。主行程與 helper 沒有入口。
- `pty:kill` 存在、本機 helper 持全權 server token 可呼叫，但只殺程序，分頁留著顯示 `[Process exited with code …]`（`TerminalPanel.tsx` `onExit`），重開 BAT 可能還原。
- 遠端 headless tower 權杖只允許 `terminal:create-agent-command`。
- 初步結論：要乾淨關分頁需改 BAT（新 IPC + renderer 關閉路徑 + helper 參數 + 遠端權杖），local_rule 只負責「何時呼叫」。

## 任務

1. **現況盤點（附 `檔案:行號`）**
   - 使用者按 ✕ 關閉分頁的完整路徑：renderer 呼叫了哪些 IPC、Claude 整合分頁（`stopSession`）與 PTY 分頁的差異、worktree 清理、registry 持久化、detached 視窗的情形。
   - 只呼叫 `pty:kill` 時實際發生什麼：分頁狀態、`save()` 後 registry 是否仍有該終端、重開 BAT 是否還原、Terminal Server 端是否清乾淨。只能用程式碼推論或隔離實例驗證。
   - Worker 分頁身分：主行程 / PtyManager 能否可靠判定「某分頁是某塔台派出的 Worker」（`customEnv.BAT_TOWER_TERMINAL_ID`、headless registry 的子 PTY 追蹤），pty:restart / Terminal Server recovery 後是否仍保留。
   - 塔台如何得知 Worker terminal id：`bat-terminal.mjs` 輸出、`bat-notify` 的 source、工單欄位；有無現成記錄。
   - 遠端 headless：tower / worker 權杖目前允許的 channel，要加關閉能力需動哪裡、範圍怎麼限。
2. **CT 側盤點**：`~/.claude/skills/control-tower`、`ct-done`、`ct-exec`（唯讀）中「收單完成」的定義與觸發點；local_rule（Layer 3）能掛在哪個時點；Codex 版塔台是否同一套流程。
3. **方案比較（至少 3 個，含代價與風險）**，至少涵蓋：
   - A：只改 local_rule（不改 BAT），用現有能力能做到的最大程度（例如 `pty:kill`、Worker 自行結束），以及做不到的部分。
   - B：BAT 新增「關閉 Worker 分頁」能力（IPC + renderer + helper 參數 + 遠端權杖），local_rule 呼叫。
   - C：BAT 自己處理，不靠塔台呼叫（例如 Worker `bat-notify` 回報完成後自動關閉 / 設定選項），或其他你認為更好的做法。
   - 每個方案都要說明：本機 / 遠端 / detached 視窗是否適用；誤關（關到使用者自己的分頁、Worker 還在跑）的防護；Worker 畫面輸出遺失問題（延遲關閉、保留輸出、設定開關）；對既有功能的退化風險（No Regressions）。
4. **推薦一個方案**，列出實作工單拆分建議（BAT 端 / CT 端各需改哪些檔、驗收方式、預估 sizing）。

## 驗收條件

- [ ] 現況盤點每一點都有 `檔案:行號` 或隔離實例的實測證據
- [ ] 塔台初步判讀逐點標「成立 / 不成立 / 部分成立」
- [ ] 至少 3 個方案的比較表 + 推薦 + 工單拆分
- [ ] 未改動任何 tracked 檔（本工單除外）

## 回報區

### 0. 執行摘要

- 開始：2026-10-15T15:16:06+0800（`CT_MODE=yolo`、`CT_INTERACTIVE=0`，無互動）
- 著陸檢查：**PASS**
  - C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` → PASS
  - C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
  - C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable
  - C-2：無 `branch` 欄位；目前在 `main`
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 證據方式：全部以**程式碼閱讀推論**取得（主 session 抽查關鍵行 + 3 個唯讀子代理平行盤點）。**沒有開隔離實例實測**，原因：結論都有直接程式碼路徑可證，實測不會改變判斷。下面標「未實測」的項目是推論，實作工單應補驗。
- 結論一句話：**要乾淨關掉分頁必須改 BAT**。只改 local_rule 最多只能殺掉程序，留下 `[Process exited …]` 的死分頁（而且得先有一支新 helper 才做得到），遠端完全做不到。推薦方案 B'：BAT 加「塔台關閉自己派出的 Worker 分頁」能力，預設關閉、以工單 id + 塔台 id 驗證歸屬；由 CT local_rule 在 DONE 收單後呼叫。

### 1. 現況盤點

#### 1.1 使用者按 ✕ 關閉分頁的路徑

- ✕ 按鈕呼叫 `onClose(terminal.id)`（`src/components/MainPanel.tsx:222-228`），接到 `handleCloseTerminal`（`src/components/WorkspaceView.tsx:1055`、`:1076`）。
- `handleCloseTerminal`（`WorkspaceView.tsx:886-900`）：
  - 有 agent preset（`!== 'none'`）、`isAltBuffer`、或 `hasPendingAction` 任一成立 → 顯示 `CloseConfirmDialog`（`:890-893`；元件 `src/components/CloseConfirmDialog.tsx:10-38`，掛在 `WorkspaceView.tsx:1391-1398`）。
  - 都不成立（閒置 shell）→ 直接 `pty.kill(id)` → `workspaceStore.removeTerminal(id)` → `workspaceStore.save()`（`:895-898`）。
- `handleConfirmClose(cleanWorktree)`（`WorkspaceView.tsx:902-920`）：
  - **SDK 整合分頁**（`isIntegrated`：`claude-code` / `-v2` / `-worktree` / `codex-agent` / `-worktree`，`src/types/agent-runtime.ts:72-84`）：呼叫 `claude.stopSession(id)` → `claude:stop-session`（`electron/handlers/claude.ts:224`），**不呼叫 `pty:kill`**。若勾選清理且為 worktree preset 或有 `worktreePath`，再呼叫 `claude.cleanupWorktree(id, true)`（`:905-909`）。`stopSession` 只停 query，session 物件留在記憶體到 app 結束（`electron/claude-agent-manager.ts:1691-1716`、`:2534-2546`）。
  - **其他分頁**（一般 shell，以及 `claude-cli` / codex CLI 這類 agent-CLI PTY）：`pty.kill(id)`。只有勾選清理**且** preset 正好是 `claude-cli-worktree` 時才呼叫 `worktree.remove(id, true)`（`:910-915`；`electron/handlers/git.ts:177-184`）。
  - 兩條路徑最後都 `removeTerminal` + `save()`（`:916-918`）。
- 持久化：`removeTerminal`（`src/stores/workspace-store.ts:485-502`）把終端從清單過濾掉並移焦點；`save()`（`workspace-store.ts:935-971`）→ `workspace:save`（`electron/main.ts:2150-2168`）→ `saveWindowWorkspaces`（`electron/window-registry.ts:335-354`）寫入該視窗的 registry entry。
- **Detached 視窗**：同一套 `WorkspaceView`（`?detached=<wsId>`，`main.ts:3367-3369`；`src/App.tsx:935-961`），關閉路徑與確認框完全相同。`workspace:save` 走 `saveDetachedWorkspace`（`main.ts:2312-2328`、`:2374-2376`）→ `saveDetachedWorkspaceTerminals`（`window-registry.ts:357-366`），只取代父 entry 裡該 workspace 的終端清單；detach 期間父視窗的 save 保留這份清單（`main.ts:3365`、`window-registry.ts:343-345`），所以在 detached 視窗關掉的分頁不會被父視窗寫回。`pty:exit` 會送到 detached 視窗（`main.ts:731-739`，`getAllWindows()`）。
- **外部派工建立的 Worker 分頁**：`addExternalTerminal` 建出 `{ id, workspaceId, type:'terminal', title:'Remote: <命令第一個 token>', cwd, … }`，**沒有 `agentPreset`**（`workspace-store.ts:463-471`）。因此使用者按 ✕ 關 Worker 時，只有 alt buffer 或 pending action 才會跳確認框，否則直接 kill + remove（推論：claude CLI 互動模式不用 alt buffer，通常不會跳確認框；未實測）。

#### 1.2 只呼叫 `pty:kill` 時會發生什麼

- 主行程 handler：`electron/handlers/pty.ts:84` → `PtyManager.kill`。
  - Terminal Server 模式（`useServer`，`electron/pty-manager.ts:429-432`；Terminal Server 在啟動時就開，`main.ts:1515`）：送 `{type:'pty:kill'}` 給 server，刪掉本地 instance 與 replay buffer，`notifyPtyExit(id)`（`pty-manager.ts:938-944`）。
  - direct 模式：kill 程序，Windows 另外跑 `taskkill /F /T`（`pty-manager.ts:946-965`）。
- Terminal Server 端：`killPty`（`electron/terminal-server/server.ts:283-291`）kill PTY，並從 `ptys` map 與 PTY registry（`removePtyEntry`）移除 → **server 端清得乾淨**。⚠️ server 模式只呼叫 `entry.pty.kill()`，沒有 `taskkill /T`（`:286`），Windows 上 shell 的子程序（例如 claude CLI）能不能確定被一起終止，**未實測**。
- Renderer：`TerminalPanel` 的 `onExit` 只在 xterm 寫入 `[Process exited with code N]`（`src/components/TerminalPanel.tsx:683-687`）。整個 renderer 沒有任何地方在 `pty:exit` 時移除分頁 → **分頁留著**。
- Registry：store 裡的 entry 沒有動，所以每次 `save()`（含 30 秒 autosave，`workspace-store.ts:111`、`:1016-1023`）都會把它寫回 registry。
- 重開 BAT：`load()` → `applySerializedData` 依清單重建分頁（`workspace-store.ts:973-1013`、`:87-109`），`initTerminals` 再為每個分頁建立程序（`WorkspaceView.tsx:447-527`）。外部派工的分頁沒有 `agentPreset`，所以走 `createPtyWithReplay`（`:490-492`）：Terminal Server 上已經沒有這個 id，會用**同一個 id 開一個新的空 shell**，原本的 `/ct-exec` 不會重跑。也就是說「會還原成一個空 shell 分頁」，不會還原成 Worker。
- 對死分頁按 ⏻ 重啟沒有效果：`PtyManager.restart` 找不到 instance 就回 `false`（`pty-manager.ts:988-1003`），`WorkspaceView.tsx:940-955` 沒檢查回傳值。
- 找不到任何「程序結束後自動重啟」的邏輯。

#### 1.3 主行程有沒有「關分頁」的入口

- **沒有**。preload 裡所有 main→renderer 事件中，與終端生命週期相關的只有 `pty:output` / `pty:exit` / `terminal:created-externally` / `terminal:notified` / `terminal:keypress` / `workspace:reload` / `workspace:detached` / `workspace:reattached` / `workspace:flush-save` / `terminal-server:*`（`electron/preload.ts:33-104`、`:908`、`:918`）。不存在 `terminal:close` / `terminal:remove` 這類事件。
- 唯一理論上的間接方式：main 改 registry 後送不帶資料的 `workspace:reload` 讓 renderer 重 `load()`（`workspace-store.ts:840-848`）。目前沒有任何程式這樣做，而且會與 renderer 的 save 互相覆寫（違反 T0491「讀改寫用 `updateEntry`」的精神），**不建議**。
- 遠端 client 呼叫 `workspace:save` 會拿到 `false`（沒有 window id，`main.ts:2151`）→ helper 也無法透過 save 把分頁從持久化狀態移除。

#### 1.4 Worker 分頁的身分

- 派工 payload：`bat-terminal.mjs` 在 client 端產生 terminal id（`randomBytes(16).toString('hex')`，`scripts/bat-terminal.mjs:358`）。`--notify-id` 會變成 `customEnv.BAT_TOWER_TERMINAL_ID`（`:730`），並一起送出 `skill` / `workorder` / `workspaceId` / `CT_MODE` / `CT_INTERACTIVE`（`:727-746`）。
- Handler：`terminal:create-agent-command`（`electron/terminal-command-handlers.ts:540-627`）→ `createWithCommand` → `ptyManager.create({ id, cwd, shell, customEnv, workspaceId })`（`:465-472`）。本機的 `customEnv` 不過濾，原樣傳入（`pickWhitelistedEnv` 只用在日誌，`:406`）。`terminal:created-externally` 事件只帶 `{ id, cwd, command, workspaceId, towerTerminalId?, workspaceResolved? }`，**不帶 `workorder` / `skill`**（`:478-502`）。
- PtyManager：`PtyInstance` 記錄 `customEnv` / `workspaceId` / `agentPreset`（`pty-manager.ts:50-57`；三條 spawn 分支 `:757`、`:800`、`:856`）。`pty:restart`（`pty-manager.ts:988-1003`）和 Terminal Server crash recovery（`:1117-1139`）都會沿用 → 主行程**在同一次 BAT 執行期間**能可靠判定「X 是 tower Y 派出的 Worker」（`customEnv.BAT_TOWER_TERMINAL_ID === Y`）。但目前**沒有 public getter**（`:606-1005`），而 `workorder` 根本沒有記錄。
- 斷點 = BAT 重開：Terminal Server 存活時，`handleReplayList` 重新註冊的 PTY 不帶 `customEnv`（`pty-manager.ts:480-486`）。之後 renderer 還原時的 `pty:create` 只放工作區 / 全域 env（`:739-742`；`WorkspaceView.tsx:466`、`:481-489`）。程序本身的環境變數還在，但主行程已經不知道它屬於哪個塔台。
- Renderer 記錄：`TerminalInstance` 沒有 tower id / workorder / 外部派工旗標（`src/types/index.ts:38-69`）。`addExternalTerminal` 只用 `towerTerminalId` 來決定落點（`workspace-store.ts:417-430`）。`save()` 只序列化 `id, workspaceId, type, agentPreset, title, alias, cwd, sdkSessionId, model, agentParams, sessionMeta`（`:944-956`）→ **持久化狀態裡沒有任何塔台關聯**。
- 遠端 headless：worker 權杖的 `towerId` 綁定（`electron/remote/helper-capability.ts:118-121`），加上 `HelperTowerSpawnQuota` 的 `children` set（`:338-426`，只在記憶體，只提供數量 `liveChildren()`）。`pty:restart` 會重新簽發權杖並保留角色（T0448）。server 重啟後全部失效。

#### 1.5 塔台怎麼知道 Worker 的 terminal id

- `bat-terminal.mjs` 成功時 stdout 印 `✓ Terminal created: <32 hex id>`（`scripts/bat-terminal.mjs:847`），後面接 `  workspace: …` / `  agent: …`（`:596-601`、`:618-622`、`:643`），exit 0。server 回 `TerminalCreatedReport { ok, terminalId, workspace, agent }`（`terminal-command-handlers.ts:75-94`、`:614-624`）。
- `bat-scripts.log` 有 `terminal-created { result:'ok', terminalId, landing, agent }`（`bat-terminal.mjs:851-857`），`invoke-create-with-command` 帶 `terminalId` + `workorder`（`:751-762`）→ **id 與工單的對應有記在日誌裡**，但那是診斷日誌，不是契約。
- CT 側：塔台規則**明文不解析 stdout**，成功判定只看 exit code（`~/.claude/skills/control-tower/SKILL.md:115`；`references/auto-session.md:881-896`），所以 id 實際上被丟掉。工單 frontmatter schema 沒有 terminal 欄位（`references/work-order-template.md:728-755`）。
- `bat-notify.mjs`：`--source` 預設是 `$BAT_TERMINAL_ID`（`scripts/bat-notify.mjs:155`），但 ct-exec 一律傳 `--source "T####"`（`~/.claude/skills/ct-exec/SKILL.md:322`），所以實際上收到的是工單 id。`terminal:notify` 不檢查 `source`（`electron/handlers/terminal.ts:112-149`），renderer 只用它顯示 toast（`src/App.tsx:505-522`）→ **renderer 不知道是哪個分頁送來的通知**。本機任何持全權 token 的呼叫者都能偽造 `source`。

#### 1.6 本機 RemoteServer 與 `pty:kill`

- Electron 的 `new RemoteServer()` 不帶 options（`main.ts:430`），本機 PTY 一律注入全權 server token（`main.ts:1677-1680`；`pty-manager.ts:322`）。
- 全權 token 的 frame 直接 `invokeHandler(frame.channel, …)`，沒有 channel 過濾（`electron/remote/remote-server.ts:724-730`；`handler-registry.ts:25-31`）。`PROXIED_CHANNELS` 有列 `pty:kill`（`protocol.ts:38`），但這份清單不限制全權 client → **本機 helper 協定上可以對任意 id 呼叫 `pty:kill`，沒有歸屬檢查**。
- 但**目前沒有任何 helper 腳本提供 kill 功能**：`bat-terminal.mjs` 只建立分頁、`bat-notify.mjs` 只 notify / write / keypress。塔台要呼叫 kill，就得新增腳本（= 改 BAT `scripts/`），或在塔台白名單外臨時寫 WebSocket client（違反 `auto-session.md:947`「白名單以外的 Bash 操作仍然嚴格禁止」）。

#### 1.7 遠端 headless 權杖

- `HELPER_CHANNEL_ROLES`（`electron/remote/helper-capability.ts:208-213`，預設拒絕）：tower = `terminal:create-agent-command`；worker = `terminal:notify` / `pty:write` / `terminal:keypress`。
- 角色判定：`customEnv` 有 `BAT_TOWER_TERMINAL_ID` 的 PTY 是 worker，其餘都是 tower（`helper-capability.ts:118-120`；`headless-entry.ts:274-277`）。
- 檢查點：`RemoteServer.handleHelperFrame` 每個 frame 都重新查 capability（`remote-server.ts:1051-1060`）→ `authorizeHelperInvoke`（`:1083-1086`；`helper-capability.ts:264-304`）→ create 走 quota（`:1090-1098`）。
- 要讓 tower 只能關自己的 Worker，需要改：`HELPER_CHANNEL_ROLES` 加新 channel（tower）；`authorizeHelperInvoke` 加 case（目標 id 合法、不是自己、`isWorkerOf(target, capability.terminalId)`）；`HelperInvokeContext`（`helper-capability.ts:223-232`）與 `remote-server.ts:1083-1086` 傳入新檢查；`HelperCapabilityRegistry` 加 `isWorkerOf(childId, towerId)`（掃 `role==='worker' && towerId===…`，資料已經在）。關閉事件要讓 client renderer 收到，必須加進 `PROXIED_EVENTS`（`electron/remote/protocol.ts:105-115`），並在 `App.tsx` 處理。

### 2. CT 側盤點（唯讀）

- 「收單完成」在 skill 裡叫「回報處理流程」：Worker 送 `T#### 完成` / `部分完成` / `需要協助`（`ct-exec/SKILL.md:306-323`）；yolo 用 `--submit` 自動送出，塔台以 regex `^<ID>\s+(完成|部分完成|失敗|需要協助)\s*$` 比對（`control-tower/references/yolo-mode.md:199-237`）。塔台的步驟：讀回報區 → 核對狀態 / SHA / 驗證證據 → 更新 tower state 與 BUG/PLAN → `*sync` → 決定下一步（`control-tower/SKILL.md:148-154`；完整版 `references/work-order-system.md:272-294`，最後輸出 `✅ T#### 已確認完成` 確認區塊 `:287-294`）。收單不 commit，commit 是 Worker 的責任。
- **最後一步之後 Worker 才真的不需要**，但只限 DONE：Renew 預設 Worker session 還活著（「Worker 不需退出 session，重讀工單…即可繼續執行」，`references/research-workorder.md:219`、`:253`；`references/onboarding.md:362`）。PARTIAL / FAILED / BLOCKED / 需 Renew 的研究單，收單後 Worker 仍有用。
- Layer 3：`_local-rules.md` 在塔台啟動 step 1（`control-tower/SKILL.md:30`）與 Worker 啟動 step 3（`ct-exec/SKILL.md:23`）載入，優先順序 Project > Global > Core（`references/data-layer-architecture.md:30-49`）。內容是自由文字，**沒有具名的「收單後」掛點**（搜尋 hook / after_ / on_done / 擴充點都沒有結果）。但有先例：先寫在 Layer 3，之後升級成系統層（BUG-020 / T0731，`references/auto-session.md:903-905`）。本專案 `_local-rules.md` 已有「Bash 白名單擴充」一節（`_ct-workorders/_local-rules.md:305-312`），可以在那裡加關閉指令。
- 能掛的時點：「決定下一步」之後、輸出 `✅ 已確認完成` 確認區塊時，條件為 `status == DONE` 且不 Renew。塔台的 Bash 受白名單限制（`auto-session.md:925-947`），關閉指令必須加進白名單。
- Worker 收尾後不會退出：ct-exec 在 notify 或手動 fallback 後就結束（`ct-exec/SKILL.md:306-325`），沒有 `/exit`，Worker session 保持閒置。
- 所有 skill 目錄都沒有提到 `pty:kill`、關閉或清理終端。
- Codex 版塔台：`C:/Users/Gower/.codex/skills/{control-tower,ct-exec,ct-done}` 是**獨立複本**，`diff -rq` 與 `.claude` 版內容相同（只差 `.sonar/`），流程一致；差別只在 BAT 把 `--skill` 轉成 `/ct-exec`（Claude）或 `$ct-exec`（Codex）（`auto-session.md:786-787`）。`_local-rules.md` 在專案裡，兩種塔台都會讀 → local_rule 方案對兩者都有效。⚠️ `C:/Users/Gower/.codex/AGENTS.md:23-32` 的派工範例少了 `--cwd` / `--no-interactive`，而且把 `BAT_TOWER_TERMINAL_ID` 列為塔台必要變數，與 skill 不一致（不在本單範圍，列入後續）。

### 3. 塔台初步判讀逐點驗證

| # | 初步判讀 | 判定 | 說明 |
|---|---|---|---|
| 1 | 關分頁只存在於 renderer（`handleCloseTerminal` / `handleConfirmClose`：停程序 → 視需要清 worktree → `removeTerminal` → `save()`），主行程與 helper 沒有入口 | **成立** | §1.1、§1.3。補充：SDK 整合分頁停程序用的是 `claude:stop-session` 而不是 `pty:kill`；worktree 只在使用者勾選時才清。唯一間接方式（改 registry + `workspace:reload`）沒有被使用，也不安全。 |
| 2 | `pty:kill` 存在、本機 helper 持全權 token 可呼叫，但只殺程序，分頁留著顯示 `[Process exited with code …]`，重開 BAT 可能還原 | **成立（需補充）** | §1.2、§1.6。補充：① 協定上可以呼叫，但**目前沒有任何 helper 腳本提供 kill**，塔台要用就得改 BAT `scripts/`；② 「還原」的內容是**同 id 的空 shell 分頁**，不是 Worker；③ Terminal Server 端的 `ptys` map 與 registry 會清乾淨；④ Windows server 模式的子程序有沒有一起終止，未實測。 |
| 3 | 遠端 headless tower 權杖只允許 `terminal:create-agent-command` | **成立** | `helper-capability.ts:208-213`。 |
| 4 | 要乾淨關分頁需改 BAT（新 IPC + renderer 關閉路徑 + helper 參數 + 遠端權杖），local_rule 只負責何時呼叫 | **成立（需補充）** | 還缺三項：① **Worker 身分 / 工單對應**：主行程目前沒記 `workorder`，PtyInstance 的 tower 關聯也沒有 getter，BAT 重開後就斷了；② **opt-in 設定與防誤關**（歸屬驗證、Worker 仍有輸出時不關）；③ CT 端要把關閉指令加進 Bash 白名單，並定義只在 DONE 不 Renew 時才呼叫。 |

### 4. 方案比較

| 面向 | A：只改 local_rule | B'：BAT 新增「關閉 Worker 分頁」能力，塔台呼叫（**推薦**） | C：BAT 在 Worker 回報完成後自動關閉 | D：BAT 標示 Worker + 手動批次關閉 |
|---|---|---|---|---|
| 做法 | 塔台收單後 kill Worker 程序；或要求 Worker notify 後自己結束 | 新 IPC `terminal:close-worker { towerId, workorder \| id, delayMs }`：main 驗證歸屬 → 送 `terminal:close-requested` → renderer 走與 ✕ 相同的關閉函式（`removeTerminal` + `save()`）；helper `bat-terminal.mjs --close-worker T####`；遠端 tower 權杖加這個 channel 並驗證 `isWorkerOf`；Settings 開關（預設關閉） | `bat-notify` 帶 `senderTerminalId`；BAT 收到 Worker 送給自己塔台、內容符合 `T#### 完成` 的通知時，延遲 N 秒自動關閉 sender；Settings 開關 | 分頁記錄 `towerTerminalId` / `workorder` 並持久化；分頁列顯示「已回報」標記；右鍵選單「關閉已完成的 Worker 分頁」 |
| 能否真正關掉分頁 | ❌ 只能殺程序，留下死分頁（§1.2），而且得先新增 kill helper（嚴格說已經不是「只改 local_rule」）。讓 Worker 自己結束 = claude CLI 結束，shell 分頁還在 | ✅ | ✅ | ✅（人按） |
| 本機 | 部分（死分頁） | ✅ | ✅ | ✅ |
| 遠端 headless | ❌ tower 權杖沒有 kill | ✅ 需要 B'-2（權杖 + `PROXIED_EVENTS`） | ✅ 需要權杖驗證 sender（server 知道 `capability.terminalId`，`remote-server.ts:1051`） | ✅（純 client 端） |
| Detached 視窗 | 死分頁同樣出現 | ✅ 事件送到所有視窗（含 detached），持有該分頁的 `WorkspaceView` 處理；save 走 `saveDetachedWorkspaceTerminals`，語意不變 | ✅ 同 B' | ✅ |
| 誤關防護 | ❌ 全權 token 可以 kill 任何 id；塔台還得自己記住 id | ✅ main 只接受 `PtyInstance.customEnv.BAT_TOWER_TERMINAL_ID === towerId` 的目標（遠端用 `isWorkerOf`，是真正的權限邊界）；以 `workorder` 查詢時要求唯一命中；目標分頁最近 N 秒仍有輸出（`lastActivityTime`）則拒絕，除非 `--force` | ⚠️ 依賴 CT 的文字協定（訊息格式），BAT 等於內嵌了 CT 的語意；「回報完成」不等於「塔台已收單」 | ✅ 人工決定 |
| Worker 還在跑 / 需要 Renew | ⚠️ 塔台自己判斷 | ✅ 只在 DONE 且不 Renew 時呼叫（CT 規則）+ 活動檢查 | ❌ 塔台還沒讀回報就關了；PARTIAL 或研究單 Renew 時 Worker 已經不在（claude session 可以 resume，但要人手動接） | ✅ |
| 畫面輸出遺失 | 死分頁的輸出還在 | `delayMs` 延遲關閉（建議預設 10 s）；回報區才是證據的權威來源；claude session transcript 保留在 `~/.claude/projects`（可 `--resume`）；設定預設關閉 | 同 B'，但更早關 | 不遺失 |
| No Regressions 風險 | 低（不改 BAT），但死分頁會在重開後變成空 shell 殘留 | 中低：新增 channel 與事件，✕ 路徑重構成共用函式（必須讓 `handleConfirmClose` 行為逐位元不變）；設定預設關閉 = 預設行為不變 | 中：`terminal:notify` 語意擴張；文字協定一變就失效 | 低：只新增欄位與 UI |
| 工作量 | S（但需要一支新 helper，而且效果有限） | M（BAT 本機）+ S（遠端）+ S（CT） | M | S-M |
| Codex 塔台 | 共用 local_rule | 共用 local_rule | 不需要 CT 改動 | 不需要 CT 改動 |

### 5. 推薦：方案 B'（BAT 提供歸屬驗證的關閉能力，CT local_rule 決定時機）

理由：
1. 「何時關」是塔台的判斷（DONE、不 Renew、已收單），「能不能關、關哪個」是 BAT 的權限與歸屬判斷。B' 剛好按這條線切開。C 把 CT 語意寫進 BAT，A 做不到真正關閉。
2. 歸屬資料已經存在（本機 `PtyInstance.customEnv.BAT_TOWER_TERMINAL_ID`、遠端 worker capability 的 `towerId`），只需要補 getter 和 `workorder` 欄位。
3. 以 `workorder` + `towerId` 查詢，塔台**不需要記住 terminal id**，也不必違反 CT「不解析 stdout」的規則，context 壓縮後照樣能用。
4. 預設關閉 + opt-in，預設行為與現況完全相同（No Regressions）。
5. D 可以當成 B' 的副產品（同樣要持久化 tower / workorder），之後另案。

已知限制（需在工單裡明載）：BAT 重開之後，主行程失去關聯（§1.4）→ `close-worker` 回 `not-found`，塔台改為提示使用者手動關閉。若要跨重開也有效，需做 B'-4 持久化。

### 6. 實作工單拆分建議

| 工單 | 範圍 | 主要檔案 | 驗收 | sizing |
|---|---|---|---|---|
| B'-1 BAT 本機關閉能力 | ① PtyManager 記錄 `workorder`（由 `create-agent-command` 的 `workorder` 參數帶入）並提供 `findWorkerTerminals(towerId, workorder?)` / `getTowerOf(id)` getter；② 新 handler `terminal:close-worker`（驗證歸屬、唯一命中、Settings 開關、`delayMs`），回 `{ ok, closedId } \| { ok:false, code: 'DISABLED' \| 'NOT_FOUND' \| 'NOT_OWNER' \| 'AMBIGUOUS' \| 'BUSY' }`；③ 新事件 `terminal:close-requested` → renderer 把 `handleConfirmClose` 的關閉邏輯抽成共用函式（不清 worktree），由 `App.tsx` 呼叫；activity 檢查用 `lastActivityTime`；④ `bat-terminal.mjs --close-worker T#### [--delay-ms N] [--force]`（frame id 比對沿用 BUG-114 規則），exit code 表示結果；⑤ Settings 開關（三語 i18n），預設關閉 | `electron/pty-manager.ts`、`electron/terminal-command-handlers.ts`、`electron/handlers/terminal.ts`、`electron/preload.ts`、`src/App.tsx`、`src/components/WorkspaceView.tsx`（抽共用關閉函式）、`src/stores/workspace-store.ts`、`scripts/bat-terminal.mjs`、Settings 元件 + `src/locales/*.json`、`src/types/index.ts` | unit：歸屬驗證各 code、唯一命中、activity 拒絕、設定關閉回 `DISABLED`；source guard：✕ 路徑行為不變；e2e（隔離實例，自訂 CLI 跑 node 腳本，不耗 token）：派工 → `--close-worker` → 分頁消失且 registry 不含該 id → 重開 BAT 不還原；detached 視窗同樣驗；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` | M |
| B'-2 遠端 headless | `HELPER_CHANNEL_ROLES` 的 tower 加 `terminal:close-worker`；`authorizeHelperInvoke` + `HelperInvokeContext` + `HelperCapabilityRegistry.isWorkerOf`；`terminal:close-requested` 加進 `PROXIED_EVENTS`；headless 端的 handler 實作（沒有 Settings 時，開關由 client 端判斷，或用 server `settings.json`，需決策） | `electron/remote/helper-capability.ts`、`electron/remote/remote-server.ts`、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts` | `headless-remote-tower-e2e.test.ts` 擴充：tower 關自己的 Worker OK、關別的 tower 的 Worker / 自己 / 使用者分頁 → `Forbidden`；worker 權杖呼叫 → `channel-not-allowed`；`npm run typecheck:electron` = 0 | S |
| B'-3 CT local_rule | `_local-rules.md`：①「Bash 白名單擴充」加入 `--close-worker`；② 新增「收單後關閉 Worker」一節：只在 `status == DONE` 且不 Renew、輸出 `✅ 已確認完成` 之後呼叫；`DISABLED` / `NOT_FOUND` → 靜默；`BUSY` / `NOT_OWNER` / `AMBIGUOUS` → 回報使用者、不重試；③ 記錄 BAT 重開後失效的限制。同時修正 `auto-session.md` 的 `result=true` 漂移（CT 系統層，需塔台另外決策） | `_ct-workorders/_local-rules.md`（之後可升級到 `~/.claude/skills/control-tower/references/auto-session.md` 與 `.codex` 複本） | 實機（隔離實例或使用者 BAT）：Claude 塔台 / Codex 塔台各派一單 → DONE 收單 → 分頁在延遲後關閉 | S |
| B'-4（選配）持久化 Worker 關聯 | `TerminalInstance` 加 `towerTerminalId` / `workorder`，`addExternalTerminal` 寫入、`save()` 序列化；BAT 重開後 `close-worker` 改由 renderer 端驗證歸屬；同時是方案 D（UI 標示 + 批次關閉）的基礎 | `src/types/index.ts`、`src/stores/workspace-store.ts`、`electron/terminal-command-handlers.ts`（事件帶 `workorder`）、`electron/window-registry.ts`（序列化不變） | unit：序列化往返；e2e：重開 BAT 後仍能關閉 | S-M |

建議順序：B'-1 → B'-3（先本機可用）→ B'-2 → B'-4。需要塔台決策的點：① `delayMs` 預設值；② 遠端開關以哪一邊為準；③ `BUSY` 判定的閒置秒數；④ PARTIAL / 研究單是否永遠不自動關閉（建議是）。

### 7. 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| 現況盤點有 `檔案:行號` | PASS | §1、§2（主 session 抽查：`WorkspaceView.tsx:886-920`、`TerminalPanel.tsx:683-687`、`pty-manager.ts:429-432`、`:938-944`、`terminal-server/server.ts:283-291`、`terminal-command-handlers.ts:478-492`、`App.tsx:491-500`、`workspace-store.ts:463-471`、`remote-server.ts:724-730`、`helper-capability.ts:208-213`、`protocol.ts:105-115`、`bat-terminal.mjs:358`、`:847-856`、`bat-notify.mjs:85-90`、`:154-155`） |
| 初步判讀逐點標記 | PASS | §3 |
| ≥ 3 方案比較 + 推薦 + 拆分 | PASS | §4（4 個方案）、§5、§6 |
| 隔離實例實測 | 未執行 | 以程式碼推論為主；標「未實測」的項目（Windows server 模式子程序終止、claude CLI 是否用 alt buffer）交給 B'-1 的 e2e 補驗 |
| 未改動 tracked 檔（本工單除外） | PASS | commit 前 `git status --short` 只有 `M src/styles/settings.css`（非本單變更，未 commit）與本工單 |
| 不碰使用者 BAT | PASS | 沒有呼叫任何 helper / IPC，沒有開任何 BAT 實例 |

### 8. 偏差、阻礙、後續

- 偏差：工單原始狀態是 `TODO`（skill 預期 `PENDING`），直接改為 `IN_PROGRESS`。
- 阻礙：無。
- 後續（給塔台，不在本單範圍）：
  1. CT `references/auto-session.md` 寫的成功日誌是 `result=true`，但 `bat-terminal.mjs` 實際寫 `result: 'ok'`（`scripts/bat-terminal.mjs:851-852`）；`auto-session.md:894` 把 `null` stdout 描述為舊行為。
  2. `yolo-mode.md:444-447` 說 notify 失敗時工單停在 `IN_PROGRESS`，與 `ct-exec/SKILL.md` 先寫最終狀態再 notify 的流程不一致。
  3. `C:/Users/Gower/.codex/AGENTS.md:23-32` 的派工範例與 skill 不一致（少 `--cwd` / `--no-interactive`；`BAT_TOWER_TERMINAL_ID` 被列為塔台必要變數）。
  4. `remote-logger` 的 `sourceTerminalId` 讀 `customEnv.BAT_TERMINAL_ID`（`terminal-command-handlers.ts:407`），但 `bat-terminal` 從不送這個值，所以永遠是空的（診斷缺口）。
  5. 對死分頁按 ⏻ 重啟沒有反應（`PtyManager.restart` 回 `false` 但 UI 沒檢查，`WorkspaceView.tsx:940-955`）——是小 bug，可以另開 BUG。

### 9. Commit

- 只 commit 本工單（`git commit --only`），不包含 `src/styles/settings.css`；不 push。commit 訊息帶 `T0534`，可用 `git log --grep T0534` 查到。
