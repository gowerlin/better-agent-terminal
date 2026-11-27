---
schema_version: 1
schema_kind: workorder
id: T0956
title: "BUG-232：登入導引分頁與遠端工具安裝也在命令寫入前保留使用者輸入（沿用 T0951 的 `sendLaunchCommand` / `holdInputUntilLaunch`）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:38:19+08:00"
started_at: "2026-11-27T22:39:59+08:00"
updated_at: "2026-11-27T22:49:19+08:00"
completed_at: "2026-11-27T22:49:19+08:00"
session_ids:
  - "f2d0a7c2-9a5c-46f0-ba47-f30bf001732b"
target_version: "下一個預覽版（`0.8.1-pre.2`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-232；D453（使用者：兩件事開單）；T0951 / BUG-231（`PtyManager.holdInputForLaunch` / `writeLaunchCommand` / `releaseLaunchHold`、`src/lib/launch-command.ts`、`pty:launch-command`、`docs/agent-guide/launch-command-input-hold.md`）；BUG-151；T0957（同時派工，⏻ 後游標）"
affects_files:
  - _ct-workorders/T0956-login-and-tool-install-input-hold.md
  - src/lib/claude-login-guide.ts
  - src/lib/__tests__/claude-login-guide.test.ts
  - src/components/WorkspaceView.tsx
  - src/App.tsx
  - src/hooks/useRemoteToolInstall.ts
  - src/hooks/__tests__/useRemoteToolInstall.test.tsx
  - src/lib/remote-tools/install-runner.ts
  - src/lib/remote-tools/
  - src/lib/launch-command.ts
  - src/lib/__tests__/
  - docs/agent-guide/launch-command-input-hold.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0956` 寫檔（base = 派工當下的 `main`，已含 T0951）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。T0957 同時在跑（`src/lib/mouse-tracking-reset.ts` / `pty-replay.ts`），本單盡量不動這兩個檔。"
  - "🔴 現象（BUG-232，T0951 查證時發現）：登入導引分頁（`openClaudeLoginTerminal`，只打字不送 Enter）與遠端工具安裝（`useRemoteToolInstall` / `src/lib/remote-tools/install-runner.ts`）在 create 之後才寫命令，這段時間使用者打的字會接在命令前面。先查證兩條路徑的建立與寫入方式（本機 / 遠端、是否經 `createPtyWithReplay` / `pty:create`），確認後再改；推測不成立 → 問塔台。"
  - "🔴 範圍：兩條路徑沿用 T0951 的機制（建立時帶 `holdInputUntilLaunch`、命令經 `sendLaunchCommand`；不打命令的分支 `releaseLaunchHold`），🔴 不另寫一套保留。登入導引分頁只打字不送 Enter：查證 `sendLaunchCommand` / `pty:launch-command` 能否寫不帶 `\\r` 的文字並在之後送出保留的輸入；不行就在 T0951 的共用實作加最小參數（例：命令結尾不加 Enter），回報區寫明。遠端工具安裝若在遠端 host 建 PTY，照 T0951 的 proxied 路徑；舊 bat-server（沒有 `pty:launch-command`）照舊 fallback，行為與修正前相同。"
  - "🔴 不變：命令內容（登入導引、安裝腳本）、Enter 與否、11 處既有 agent 啟動路徑、helper 派工（BUG-151）、PTY env、15 s / 64 KiB 上限與「到了照原樣寫出不丟」的規則逐字不變（既有測試不改且通過）。"
  - "🔴 測試：兩條路徑：命令寫入前打字 → PTY 收到「命令＋輸入」且命令完整（登入導引分頁沒有 Enter）；沒打字 → 只有命令；舊 host fallback；T0951 既有測試（`launch-input-hold.test.ts`、`launch-command.test.ts`）與 `useRemoteToolInstall.test.tsx`、`claude-login-guide.test.ts` 不改且通過（必然衝突 → 問塔台）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機寫〈待實機〉，不碰安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/launch-command-input-hold.md` 補這兩條路徑；CLAUDE.md 只在需要時於既有小節補一句，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0956 — 登入導引分頁與遠端工具安裝的命令前輸入保留（BUG-232）

## 背景

T0951（BUG-231）讓 11 處 agent 啟動命令在寫入前保留使用者輸入、寫完再依序送出。Worker 指出登入導引分頁與遠端工具安裝也在 create 之後寫命令，同一時間窗打的字會接在命令前面（BUG-232）。使用者裁示開單（D453）。

## 範圍

- 查證兩條路徑。
- 沿用 T0951 的共用機制補上保留；登入導引分頁維持不送 Enter。

## 不做

- 不另寫一套保留、不改命令內容、不改既有 11 處與 helper 派工。

## 驗收

- [ ] 回報區有查證與做法理由
- [ ] 兩條路徑的測試；T0951 與既有測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0（改 electron 時 `typecheck:electron` = 0）
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：端到端測試（真 `PtyManager`＋handlers）可以放 `electron/__tests__/` 嗎？
- **提問時間**：2026-11-27T22:46:33+08:00
- **背景**：兩條路徑已改好並 commit（`ct/T0956` `0bfbb6bb`）。我寫的端到端測試 `src/lib/__tests__/launch-hold-login-install.test.ts` 用真的 `registerPtyHandlers`＋`PtyManager`（同 T0951 `electron/__tests__/launch-input-hold.test.ts` 的 FakeServer 寫法）驗證「命令前打字 → PTY 收到命令（登入分頁沒有 Enter）＋輸入」，vitest 8/8 通過；但 `npm run typecheck`（`src` 專案）不允許 import `electron/**`（TS6305，`src/` 目前沒有任何檔這樣 import），所以放在 `src/lib/__tests__/` 會讓 typecheck ≠ 0。`electron/__tests__/` 不在 `affects_files`。
- **選項**：
  - A. 把這個檔移到 `electron/__tests__/launch-hold-login-install.test.ts`（內容不變；`typecheck:electron` 涵蓋它，electron 測試 import `src/` 是既有慣例）。只新增一個測試檔，不動 `electron/` 產品碼。
  - B. 留在 `src/lib/__tests__/`，改用假的 host（自己模擬「保留到 `launchCommand` 再寫命令＋輸入」），不用真 `PtyManager`。證據較弱（保留邏輯是測試自己寫的），範圍內。
  - 其他。
- **建議**：A。理由：位置與 T0951 的同類測試一致；驗的是真實的主行程保留，B 只能驗到 renderer 端接線（另一個檔 `src/lib/__tests__/launch-hold-login-install-wiring.test.tsx` 已經驗了接線）。
- **影響**：只影響測試檔的位置與 typecheck；產品碼不變。
- **是否阻擋後續**：是（typecheck = 0 是驗收條件，收單前要定案）。
- **通道**：BAT（`q-5b432d62-…`，22:47 answered：選 A，`electron/__tests__/` 視為本單 `affects_files` 的延伸，只新增測試檔）

### 完成狀態

- **狀態**：DONE（Worker 範圍的驗收全部通過；實機見〈待實機〉）
- **完成時間**：2026-11-27T22:49:19+08:00
- **session_id**：f2d0a7c2-9a5c-46f0-ba47-f30bf001732b

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：抽查 6 個 `affects_files` 皆存在於 worktree → PASS
- C-2：工單沒有 `branch` 欄位；worktree 分支 `ct/T0956`
- `CT_HOME`：已設定（主 checkout）；`CT_WORKTREE_BRANCH` = `ct/T0956`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`BAT_REMOTE_TOKEN`：已設定

### 查證（兩條路徑的建立與寫入方式）

| 路徑 | 建立 | 寫入（修正前） | 本機 / 遠端 |
|---|---|---|---|
| 登入導引分頁：Claude 面板「未登入」→ `CLAUDE_OPEN_LOGIN_TERMINAL_EVENT` → WorkspaceView `handleOpenLoginTerminal` → `openClaudeLoginTerminal`（`src/lib/claude-login-guide.ts`） | `createShell` = `createPtyThenLaunch` → `createPtyWithReplay` → `pty:create`；`launch` 只在 `created: true` 時跑 | `schedule`（`setTimeout` 500 ms）→ `pty.write(id, <cli> auth login)`，**不送 Enter** | 同一個視窗；遠端視窗的 `pty:create` / `pty:write` proxied 到遠端主機 |
| 遠端工具安裝：`useRemoteToolInstall`（App 掛一次）→ `runRemoteToolInstall`（`src/lib/remote-tools/install-runner.ts`） | `deps.createPty` = `createPtyThenLaunch` → `pty:create`；`created: false` / 失敗不打字 | `schedule`（500 ms）→ `pty.write(id, wrapWithSentinel(cmd, nonce) + '\r')` | 只在遠端 profile 視窗執行，PTY 在遠端主機（proxied） |

- 推測成立：兩者都是「`pty:create` 之後約 500 ms 才寫命令、分頁已 `setFocusedTerminal`」，與 BUG-231 同一個時間窗。
- `PtyManager.writeLaunchCommand(id, command)` 原樣寫出 `command`、不加任何字元 → 不帶 `\r` 的登入命令可直接經 `pty:launch-command` 送出，之後依序寫出保留的輸入。**共用實作不需要加參數，未改**（`src/lib/launch-command.ts`、`electron/**` 產品碼都沒動）。
- `createPtyWithReplay` 原樣把選項（含 `holdInputUntilLaunch`）傳給 `pty:create`；handler 只在 `created: true` 時 `holdInputForLaunch` → 兩條路徑都只在 `created: true` 時打命令，沒有「要了保留卻不打命令」的分支，不需要 `releaseLaunchHold`。
- 不在範圍：`probeRemoteHome`（遠端 `$HOME` 探測）開的是沒有分頁、沒有焦點的隱藏 PTY，使用者打不到字，照舊。

### 做法與理由

- 沿用 T0951：兩個模組的 deps 各多一個選填 `sendLaunchCommand(id, data)`；有給時 `pty:create` 選項帶 `holdInputUntilLaunch: true`、命令改經它送（500 ms → `pty:launch-command` → 命令、再寫保留的輸入；舊主機 `No handler` → `pty:write`）；沒給時照舊 `schedule` + `write`、不帶旗標（既有單元測試走這條，所以不必改）。
  - 登入分頁：`openClaudeLoginTerminal` 決定保留選項，經 `createShell` 第 4 個參數 `launchHold` 交給 WorkspaceView 原樣展開（`...launchHold`）；WorkspaceView 只接線（`sendLaunchCommand,`）。命令照舊沒有 Enter。
  - 遠端工具安裝：`runRemoteToolInstall` 在 `createPty` 選項加旗標；`useRemoteToolInstall` 傳 `(id, data) => sendLaunchCommand(id, data, pty)`（與原本 `write` 同一個視窗 `pty` API，舊執行留下的計時器不會寫進別的 API）。
- 理由：保留與送出仍只有主行程一份實作（T0951 / BUG-151）；旗標與命令放在同一個模組決定，避免「要了保留卻沒有送命令」只能靠 15 s 逾時；renderer 端只多一個注入點，便於測試。
- 遠端：`pty:create` / `pty:launch-command` 都是 proxied，保留在遠端主機的 `PtyManager`；舊 bat-server 忽略旗標且沒有 `pty:launch-command` → 行為與修正前逐字相同（測試有驗）。
- 不變：命令內容（登入命令的引號、安裝腳本與 sentinel）、Enter 與否、11 處 agent 啟動路徑（`sendLaunchCommand(` 仍 11 處、`holdInputUntilLaunch: true` 仍 6 處）、helper 派工、PTY env、15 s / 64 KiB 規則。

### 修改檔案

- `src/lib/claude-login-guide.ts`：`LoginShellLaunchHold`、deps `sendLaunchCommand?`、`createShell` 第 4 個參數
- `src/components/WorkspaceView.tsx`：登入分頁接線（`...launchHold`、`sendLaunchCommand`）
- `src/lib/remote-tools/install-runner.ts`：deps `sendLaunchCommand?`、選項旗標
- `src/hooks/useRemoteToolInstall.ts`：傳 `sendLaunchCommand`
- `electron/__tests__/launch-hold-login-install.test.ts`（新，Q-1 塔台裁示 A：`electron/__tests__/` 視為 `affects_files` 的延伸，只新增測試檔）
- `src/lib/__tests__/launch-hold-login-install-wiring.test.tsx`（新）
- `docs/agent-guide/launch-command-input-hold.md`：新增「登入導引分頁與遠端工具安裝」節，移除已知限制中的「未納入」，補驗證
- `CLAUDE.md`：「BAT MCP shim」節既有那一點補一句（標題未改）

### 測試

- `electron/__tests__/launch-hold-login-install.test.ts`（真 `registerPtyHandlers`＋`PtyManager`，Terminal Server 模式 FakeServer），8 項：
  - 登入分頁：命令前打字 `ls`、`中` → PTY 收到 `[登入命令, 'ls', '中']`，命令不含 `\r` / `\n`，之後的輸入直接寫入；沒打字 → 只有命令；舊主機 → `['ls', 命令]`（同修正前）；沒給 `sendLaunchCommand` → 選項不帶旗標、同修正前。旗標不傳給 Terminal Server。
  - 遠端工具安裝：同上四項（安裝行含 `\r`）。
- `src/lib/__tests__/launch-hold-login-install-wiring.test.tsx`，4 項：hook 的 `pty:create` 帶旗標、安裝行經 `pty.launchCommand`、舊主機 fallback `pty.write`；WorkspaceView 登入分頁接線 source guard。
- 既有測試未改且通過：`electron/__tests__/launch-input-hold.test.ts`、`src/lib/__tests__/launch-command.test.ts`、`src/lib/__tests__/claude-login-guide.test.ts`、`src/hooks/__tests__/useRemoteToolInstall.test.tsx`、`src/lib/remote-tools/__tests__/install-runner.test.ts`。

### 驗證（head = `137e7b6e`）

| 關卡 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0 |
| `npm run test:unit`（`137e7b6e` 第一次完整執行） | exit 0：Test Files 521 passed / 3 skipped（524）；Tests 9408 passed / 42 skipped（9450） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0（只新增 `electron/__tests__` 測試檔） |
| `npx vite build` | exit 0 |

- 註：`0bfbb6bb`（測試檔還在 `src/`）時跑過一次完整 unit（全綠，9404 passed / 46 skipped）與 vite build（exit 0），但 `npm run typecheck` 有 TS6305 → Q-1；移檔後在 `137e7b6e` 全部重跑如上。skipped 數不同是環境條件跳過的測試，非失敗。

### Git 證據

- `branch`：`ct/T0956`
- `base_sha`：`39557f4aae078ad11fe648ab0afeaca7d4f283f2`
- `validated_sha`：`137e7b6e677c5ff2c995b499350ee87a9554930c`
- `head_sha`：`137e7b6e677c5ff2c995b499350ee87a9554930c`
- commits：`0bfbb6bb` fix（產品＋docs＋測試）、`137e7b6e` test（移測試檔，Q-1 A）
- worktree `status --porcelain`：空；未 push、未觸發 workflow、未建 tag；未用 stash / reset / restore；LF

### 待實機

不碰安裝版 BAT；以下為給塔台 / 使用者的實機步驟（需本單合併進的建置）：

1. **登入分頁（本機）**：讓 Claude Agent 面板顯示「未登入」導引（例：暫時以未登入的 `CLAUDE_CONFIG_DIR` 開 BAT）→ 按開啟終端 → 分頁出現後立刻打 `abc`。預期：輸入列是 `<cli> auth login`＋`abc`（命令完整、在前），**沒有自動送出**；不打字時只有命令。
2. **登入分頁（遠端視窗，WSL / SSH）**：同上，在遠端 profile 視窗操作（bat-server 需為含 T0951 的版本）。預期同 1；舊 bat-server：與修正前相同（打的字在前）。
3. **遠端工具安裝**：遠端 profile 視窗的工具面板對一個未安裝工具按「安裝」→ 分頁出現後立刻打 `abc`。預期：安裝行完整執行（sentinel 結果與 toast 正常），`abc` 在安裝命令之後進入（安裝中被當成輸入或在下一個提示字元）。
4. 日誌：打過字時 debug log（遠端在 server 日誌）有 `[agent-command] id=<id> input before the launch command: <n> write(s), <bytes> bytes → sent after it`。

### 相關事項 / 後續建議

- `src/lib/__tests__/launch-command.test.ts` 的 `it('the login terminal (typed, not submitted) and plain shell tabs do not ask for the hold')` 未改且仍通過（它檢查 WorkspaceView 登入片段沒有 `holdInputUntilLaunch` 字樣；本單的旗標由 `claude-login-guide.ts` 決定、WorkspaceView 只展開 `launchHold`），但測試名稱的「登入分頁不要求保留」已與現況不符。建議塔台之後擇一小單把該 `it` 的登入部分改名 / 改成「WorkspaceView 不內聯旗標」，本單依「既有測試不改」未動。
- 遠端 `$HOME` 探測的隱藏 PTY 未納入（理由見〈查證〉）。

### 遭遇問題

- 端到端測試放在 `src/lib/__tests__/` 時 `npm run typecheck` 報 TS6305（`src` 專案不能 import `electron/**`）→ Q-1 問塔台，依 A 移到 `electron/__tests__/`。
- 第一次寫 docs 用 heredoc 夾 Python，`'\\r'` 被收成實際 CR（R-G005 的狀況）；已以位元組檢查改回字面 `\r`，檔案維持 LF。

### 互動紀錄

- [22:46] Q-1: 端到端測試放 `electron/__tests__/`？（BAT `--ask --submit`） → A（塔台，22:47）: 選 A，`electron/__tests__/` 視為 `affects_files` 的延伸、只新增測試檔，回報寫明；照驗收跑兩個 typecheck 與最終 head 的完整 unit → Action: `git mv` 到 `electron/__tests__/launch-hold-login-install.test.ts`、改 import 路徑、更新 docs，在 `137e7b6e` 重跑全部關卡
