---
schema_version: 1
schema_kind: workorder
id: T0951
title: "BUG-231：⏻ 重啟 agent 分頁時，啟動命令寫入前使用者打的字移到命令之後（比照 BUG-151 的派工保護）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:13:26+08:00"
started_at: "2026-11-27T21:14:59+08:00"
updated_at: "2026-11-27T21:29:42+08:00"
completed_at: "2026-11-27T21:29:42+08:00"
session_ids:
  - "90f671f5-522d-4956-8f8b-2c6e466d372e"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 BUG-228 / 229 / 230 同一批"
depends_on: []
related:
  - "BUG-231；D438（使用者：T0947 的兩項建議開單）；T0947 回報區〈後續建議〉2；BUG-229；BUG-151 / T0598（`PtyManager.holdInputForDispatch` / `writeDispatchCommand`）"
affects_files:
  - _ct-workorders/T0951-restart-hold-typed-input.md
  - src/components/WorkspaceView.tsx
  - src/lib/pty-replay.ts
  - src/lib/
  - src/__tests__/
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - electron/preload.ts
  - electron/__tests__/
  - docs/agent-guide/
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0951` 寫檔（base = 派工當下的 `main`，已含 T0946 / T0947）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時在跑：T0949（BUG-230，可能動 `electron/pty-manager.ts`）、T0950（⏻ 離開 alt screen，可能動 `pty-replay.ts` / `WorkspaceView.tsx`）；之後依序合併，盡量不動 T0946 的命令組裝（`towerLaunchCommandPrefix`）與 T0947 的 `resetLeftoverMouseTracking` 呼叫。"
  - "🔴 現象（BUG-231，T0947 查證時發現）：`createPtyThenLaunch`（`src/components/WorkspaceView.tsx`）在 `pty:create` 回來後 `setTimeout(500)` 才寫啟動命令；這段時間使用者打的字先進新 shell 的輸入列，啟動命令接在後面 → 命令被破壞。先查證（有哪些路徑以這種方式寫啟動命令：claude-cli ⏻ / 新開 / 恢復、codex 分頁等），確認後再改；推測不成立 → 問塔台。"
  - "🔴 範圍：renderer 寫啟動命令的路徑，在命令寫入前打進新分頁的使用者輸入移到命令之後，語意比照 helper 派工的 `holdInputForDispatch` / `writeDispatchCommand`（BUG-151）；能共用就共用既有實作（例：讓這條路徑也經主行程同一套保留機制），不另寫一套語意不同的。🔴 使用者輸入不得遺失、順序不變、只延後到命令之後；保留有上限與逾時（沿用 BUG-151 的值或寫明理由），命令寫入失敗 / PTY 結束時照舊送出或丟棄的規則與 BUG-151 一致。"
  - "🔴 不變：沒有啟動命令的一般 shell 分頁、命令寫入之後的輸入、helper 派工路徑、`{ auto: true }` 的寫入、T0788 / T0904 的通知保護、T0946 的 `MSYS2_ARG_CONV_EXCL` 前置變數、T0947 的滑鼠追蹤重設，一律逐字不變（測試斷言）。🔴 不改 PTY env。若要新增 IPC channel：不進 `HELPER_CHANNEL_ROLES`、handler 另拒 `ctx.helper`；proxied 與否依查證寫明。"
  - "🔴 唯一實作：保留與送出的邏輯在一個位置（優先沿用 `PtyManager` 既有的），consumer 只接線。"
  - "🔴 測試：⏻ 後命令寫入前打字 → PTY 收到「命令＋輸入」且命令完整；沒有打字 → 只有命令；一般 shell 分頁輸入不延後；BUG-151 既有測試不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 文件：相關 docs（例 `docs/agent-guide/new-pty-initial-size.md` 或派工輸入保護所在的 docs）補一段；CLAUDE.md 只在需要時於既有小節補一句（唯一實作函式名），小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0951 — ⏻ 期間打的字移到啟動命令之後（BUG-231）

## 背景

T0947（BUG-229）查證時發現：⏻ 後新 shell 起來到啟動命令寫入前約 500 ms，使用者打的字會先進輸入列，啟動命令接在後面而被破壞（BUG-231）。helper 派工已有同類保護（BUG-151），⏻ 路徑沒有。使用者裁示開單（D438）。

## 範圍

- 查證以 renderer 寫啟動命令的路徑。
- 命令寫入前的使用者輸入移到命令之後，語意比照 BUG-151，盡量共用既有實作。

## 不做

- 不改 helper 派工、一般 shell 分頁、PTY env、T0946 / T0947 的改動。

## 驗收

- [ ] 回報區有查證與做法理由
- [ ] 測試：打字不破壞命令、輸入不遺失且在命令之後；一般 shell 不延後；BUG-151 測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0（改 electron 時 `typecheck:electron` = 0）
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：T0944 的 source guard（`src/lib/__tests__/tower-launch-prompt.test.ts`「one launch write only」）與本單必然衝突，可否改它的兩個斷言？
- 提問時間：2026-11-27T21:27:08+0800
- 選項：[A] 改該 guard：`pty.write(` 次數 1 → 改數 `sendLaunchCommand(` = 1，字面值改成 `sendLaunchCommand(terminalId, cmd + '\r')`；「prompt 不另外打字」的第三個斷言不動 / [B] 不改測試：`sendLaunchCommand` 加一個 fallback writer 參數，讓 `startClaudeCliPty` 內仍留一個字面 `window.electronAPI.pty.write(terminalId, cmd + '\r')` / [C] 其他：________
- Worker 建議：[A]。guard 的意圖是「啟動命令只寫一次、`/control-tower` 不分開打」，[A] 原意不變只換寫入函式；[B] 是為了保留字面值而多一個參數，`startClaudeCliPty` 的字面 `pty.write` 也只會是 fallback，guard 反而在守一段不常走的程式。
- 影響範圍：`src/lib/__tests__/tower-launch-prompt.test.ts` 第 112–116 行（只有這一個測試；`bat-mcp-launch.test.ts` 的 guard 已改程式排版通過，未動測試）。完整 `npm run test:unit` 目前只剩這 1 個失敗（520 檔）。
- 阻塞：是（收單前的全綠驗收要等答覆）

### 完成狀態

- **狀態**：DONE
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`（PASS）；C-1 工單在 `$CT_HOME/_ct-workorders/` 下（PASS）；C-3 `affects_files` 前 5 項可測者皆存在（PASS）；C-2 無 `branch` 欄位。`CT_HOME` = 主 checkout、`CT_WORKTREE_BRANCH` = `ct/T0951`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **branch**：`ct/T0951`
- **base_sha**：`18d0a229ab342007a3aae709ac171e3543ea9c81`
- **validated_sha**：`f975ef45e6b46a572381b67e2549c9f3cf87aa81`
- **head_sha**：`f975ef45e6b46a572381b67e2549c9f3cf87aa81`（= validated_sha）
- **產品 commit**：`50528bf9`（`fix(T0951): BUG-231 hold input typed before a renderer agent launch command`）、`040a6833`（`resumeCodexCliTab` 排版配合 `bat-mcp-launch` guard）、`f975ef45`（T0944 guard 兩個斷言，塔台 Q-1 [A]）
- **session_id**：90f671f5-522d-4956-8f8b-2c6e466d372e

### 查證（推測成立）

`src/components/WorkspaceView.tsx` 在 T0951 前有 **11 處** `setTimeout(() => window.electronAPI.pty.write(id, 命令 + '\r'), 500)`，分屬 6 條路徑，全部在 `pty:create` / `pty:restart` 之後、分頁已有焦點時寫入：

| 路徑 | 建立方式 | 處數 |
|---|---|---|
| claude-cli：新開（Claude CLI、以塔台開啟 Claude、worktree）、⏻、還原、恢復被中斷分頁 | `startClaudeCliPty` → `createPtyThenLaunch`（⏻ / 恢復先 `pty:kill`） | 1 |
| 還原其他 terminal 型 agent 分頁（codex 等） | `createPtyThenLaunch` | 3 |
| 工作區沒有分頁時的預設 agent 分頁（`agentAutoCommand`） | `createPtyWithReplay` | 3 |
| 「+」新增其他 agent（`handleAddAgent`） | `createPtyWithReplay` | 2 |
| 其他 agent 分頁的 ⏻（`handleRestart`） | `restartOrCreatePty` | 1 |
| 恢復被中斷的 codex 分頁（`resumeCodexCliTab`） | `restartOrCreatePty` | 1 |

這段時間的輸入走 `pty:write` → `PtyManager.writeWithResult` 直接進 shell（沒有任何保留），之後才寫入的命令接在後面 → BUG-231 成立。另外兩個 renderer 寫入點不屬「啟動命令」、未納入：登入導引分頁（`openClaudeLoginTerminal`，只打字不送出）、遠端工具安裝（`useRemoteToolInstall`）。ct-exec / ct-done 按鈕走 `terminal:create-with-command`（主行程寫入，已有 BUG-151 保護）。

### 做法與理由

- **共用 BUG-151 的主行程保留**（工單要求「能共用就共用」「唯一實作在 PtyManager」）：新增 `PtyManager.holdInputForLaunch` / `writeLaunchCommand` / `releaseLaunchHold`，輸入存在 BUG-151 的同一個 `dispatchInputHolds`，擋不擋由 `writeWithResult` 的同一段判斷（自動回應不擋、其他依序存、回 `held-until-dispatch`）。只另記計時器與位元組數（`launchInputHolds`）。`writeDispatchCommand` 的行為與日誌字串不變（抽出共用的 `writeHeldInput`）。
- **為什麼保留要從主行程的 create 開始**：renderer 另發一個「開始保留」IPC 會晚於 `pty:create` 回覆，中間的按鍵仍會先進 shell。所以 `pty:create` 選項帶 `holdInputUntilLaunch: true`（`pty:restart` 第 4 個參數 `{ holdInputUntilLaunch: true }`），handler 在起了新 shell 的同一個 tick 呼叫 `holdInputForLaunch`；旗標不傳給 `PtyManager.create` / Terminal Server。
- **結束**：renderer 的 `sendLaunchCommand`（`src/lib/launch-command.ts`，仍等 500 ms）改送新 channel `pty:launch-command(id, 命令)` → 先寫命令、再寫保留的輸入；要了保留卻不打命令的分支呼叫 `releaseLaunchHold` → `pty:launch-command(id, null)` → 輸入照原樣寫出。PTY 結束（含 kill）→ 與 BUG-151 一樣丟掉並清計時器。
- **逾時 15 s、上限 64 KiB**：BUG-151 沒有這兩個值，因為它的命令由主行程 500 ms 後一定寫入；renderer 路徑中間有 IPC 與最多 5 s 的版本檢查，renderer 重新載入或出錯時可能永遠不送，所以加逾時（15 s 留餘裕）與上限；到了就把輸入**照原樣、依序寫出**（不丟），之後才到的命令是一般寫入。
- **channel**：`pty:launch-command` proxied（遠端視窗的 PTY 在遠端主機，保留也在那裡；加進 `PROXIED_CHANNELS` 與 `PATH_FREE_CHANNELS`），不進 `HELPER_CHANNEL_ROLES`，handler 另對 `ctx.helper` 回 `forbidden`。舊 bat-server：忽略旗標（不保留）、新 channel 回 `No handler` → renderer fallback 原本的 `pty:write`，行為與修正前相同。
- **`{ auto: true }`**：保留期間（只有新 shell 的啟動命令前）與 BUG-151 一樣由 `writeWithResult` 一併保留；保留之外的 auto 寫入不變（測試斷言）。這是沿用 BUG-151 語意，沒有另寫一套。

### 變更檔案

- `electron/pty-manager.ts`：`holdInputForLaunch` / `writeLaunchCommand` / `releaseLaunchHold` / `endLaunchHold` / `writeHeldInput`、常數 `LAUNCH_INPUT_HOLD_TIMEOUT_MS` / `LAUNCH_INPUT_HOLD_MAX_BYTES`、`writeWithResult` 的上限、`recordExit` / `dispose` 清計時器。
- `electron/handlers/pty.ts`：`pty:create` / `pty:restart` 的旗標、新 `pty:launch-command`。
- `electron/preload.ts`、`src/types/electron.d.ts`、`src/types/index.ts`（`CreatePtyOptions.holdInputUntilLaunch`）。
- `electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`（proxied 登記）。
- `src/lib/launch-command.ts`（新）、`src/lib/pty-replay.ts`（`restartOrCreatePty` 帶第 4 個參數，只在有旗標時）、`src/components/WorkspaceView.tsx`（11 處改經 `sendLaunchCommand`、6 個建立點帶旗標、不打命令的分支 `releaseLaunchHold`）。
- 測試：`electron/__tests__/launch-input-hold.test.ts`（新，18）、`src/lib/__tests__/launch-command.test.ts`（新，12）。
- 既有測試（塔台 Q-1 裁示 [A]）：`src/lib/__tests__/tower-launch-prompt.test.ts`「one launch write only」的兩個斷言 —— `pty.write(` 次數 1 → `sendLaunchCommand(` 次數 1、字面值 `window.electronAPI.pty.write(terminalId, cmd + '\r')` → `sendLaunchCommand(terminalId, cmd + '\r')`；第三個斷言（`/control-tower` 不另外打字）不動。理由：T0944 guard 的意圖是「啟動命令只寫一次、prompt 不分開打」，本單只換寫入函式（經 `pty:launch-command` 才能讓保留的輸入排在命令之後），意圖不變。`electron/__tests__/bat-mcp-launch.test.ts` 的 guard 未改（改程式排版讓 `resumeCodexCliTab` 符合原 regex）；BUG-151 的 `dispatch-input-before-command.test.ts` 未改。
- 文件：`docs/agent-guide/launch-command-input-hold.md`（新）、`docs/agent-guide/README.md`（索引一列）、`docs/agent-guide/bat-mcp-shim.md`（BUG-151 段後一句）、`CLAUDE.md`「BAT MCP shim」節派工那一點補一句（標題未改）。
- 偏離 `affects_files`：`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/types/index.ts`、`src/types/electron.d.ts` 不在清單內。工單已預期可能新增 IPC channel（「proxied 與否依查證寫明」），而 channel 不登記在 `PROXIED_CHANNELS` 本機也呼叫不到（BUG-095、`proxied-channels-binding.test.ts`），型別檔是新增欄位 / 方法的必要宣告；都是登記與型別，沒有邏輯。

### 測試與驗證

全部在 worktree（`npm ci` exit 0）、head `f975ef45` 執行：

| 關卡 | 結果 |
|---|---|
| `npm run test:unit` | exit 0：**517 檔通過 / 3 skipped（520）；9357 測試通過 / 47 skipped（9404）**，0 失敗 |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |

- 據實說明：第一次完整 `test:unit` 是在 `50528bf9` 跑的，2 檔失敗（兩個 source guard，見〈互動紀錄〉與〈變更檔案〉）；修正後在最終 head `f975ef45` 的第一次完整執行即全綠（上表）。
- 新測試：`electron/__tests__/launch-input-hold.test.ts` 18 個、`src/lib/__tests__/launch-command.test.ts` 12 個（含 `restartOrCreatePty` 參數與 WorkspaceView source guard），全過。
- 驗收對照：⏻ 後命令寫入前打字 → PTY 收到「命令＋輸入」且命令完整（`typed before the command …`、handler 端到端 `⏻ / new agent tab …`）；沒有打字 → 只有命令；一般 shell 分頁輸入不延後；BUG-151 `dispatch-input-before-command.test.ts` 未改且通過。
- 實機：未執行（工單規定），見〈待實機〉。

### 不變（測試斷言）

- 一般 shell 分頁（沒有旗標）：輸入不延後、選項原物件傳給 `createWithResult`（`launch-input-hold.test.ts`）；WorkspaceView 還原一般 shell 的分支與登入分頁不帶旗標（source guard）。
- `created: false` 不保留；命令寫入後的輸入直接寫入；保留之外的 `{ auto: true }` 立即寫入。
- helper 派工：`dispatch-input-before-command.test.ts` 未改且通過；helper 派工的保留不被 launch 路徑結束（測試）。
- 啟動命令內容（T0944 `/control-tower`、T0946 `MSYS2_ARG_CONV_EXCL` 前置變數）、T0947 `resetLeftoverMouseTracking` 呼叫點、T0788 / T0904 通知保護、PTY env、500 ms 等待：未動（diff 只換寫入方式與加旗標）。

### 待實機

不碰安裝版 BAT、不開 claude 回合；以下請在下一個預覽版實機確認：

1. Windows、Git Bash 分頁，「以塔台開啟 Claude」或 Claude CLI 分頁按 ⏻，立刻連打幾個字（例 `abc`）→ claude 正常啟動（命令沒被破壞），`abc` 出現在 claude 的輸入框；debug log 有 `[agent-command] id=<id> input before the launch command: … → sent after it`。
2. 同 1，⏻ 後不打字 → claude 正常啟動、沒有上述日誌。
3. codex 分頁（或其他 terminal 型 agent）按 ⏻ / 「+」新增，同 1 的檢查。
4. 一般 shell 分頁按 ⏻ 後立即打字 → 字立刻出現（不延後）。
5. 遠端視窗（WSL / SSH，bat-server 已更新）重複 1；舊版 bat-server 時行為與修正前相同（不保留、不出錯）。

### 互動紀錄

- [21:15] 開工；落點檢查 PASS；未讀到 `## 塔台補充（…）` 段落。
- [21:26] 第一次完整 `npm run test:unit`：2 檔失敗，都是 source guard。`electron/__tests__/bat-mcp-launch.test.ts`（codex 恢復那段的行距）→ 改程式排版通過、不動測試；`src/lib/__tests__/tower-launch-prompt.test.ts`（T0944「one launch write only」字面斷言 `pty.write`）→ 必然衝突，依工單問塔台。
- [21:27] Q-1（BAT 通道 `--ask --submit`，`q-efd3628e-bd7a6f543b4e4990`）：T0944 guard 可否改 → A（塔台）：[A]，改兩個斷言（計數改數 `sendLaunchCommand(` = 1、字面值改 `sendLaunchCommand(terminalId, cmd + '\r')`），第三個斷言不動，回報區寫明 → Action：照改（commit `f975ef45`），重跑全部關卡。
- [21:28] 驗證前／commit 前／填報告前三個節點的塔台補充檢查：無新段落。

### 遭遇問題

- 一次以 heredoc 跑 Python 取代時 `\\r` 被收成 `\r`，寫進一個 CR 字元；已改用 Edit 工具並以 bytes 檢查（檔案無 CR），R-G005 已知問題。

### 後續建議

1. 登入導引分頁（`openClaudeLoginTerminal`）與遠端工具安裝（`useRemoteToolInstall`）也在 create 後寫命令，同一時間窗的輸入會接在前面；若要一併保護，可帶 `holdInputUntilLaunch` 並改經 `sendLaunchCommand`（登入分頁不送 Enter，需確認語意）。
