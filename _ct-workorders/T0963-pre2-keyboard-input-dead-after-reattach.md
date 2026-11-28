---
schema_version: 1
schema_kind: workorder
id: T0963
title: "BUG-234：查出 `0.8.1-pre.2` 自動恢復後鍵盤無法輸入（滑鼠貼上可用、新開 Codex CLI 也一樣）的原因並修正"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T11:09:41+0800"
started_at: "2026-11-28T11:11:45+0800"
updated_at: "2026-11-28T11:25:11+0800"
completed_at: "2026-11-28T11:25:11+0800"
session_ids:
  - "076fe418-ac76-4e9e-ac57-e14bc1a215ff"
target_version: "下一個預覽版（`0.8.1-pre.3`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-234；T0956（BUG-232）；T0957（BUG-233）；T0951（BUG-231，`holdInputForLaunch` / `sendLaunchCommand`）；T0861（holder 自動接回）；T0955 / T0959（交付版隔離實例＋假 claude 驗收工具）"
affects_files:
  - _ct-workorders/T0963-pre2-keyboard-input-dead-after-reattach.md
  - src/components/
  - src/lib/
  - src/hooks/
  - src/stores/
  - src/__tests__/
  - electron/
  - e2e/manual/
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
  - "🔴 分支：只在 `ct/T0963` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現象（使用者原話）：「0.8.1-pre.2 塔台自動恢復後，鍵盤似乎無法輸入（滑鼠可剪貼簿貼上，但鍵盤 Enter 一樣無反應）；開一個新的 Codex CLI，狀況一樣；目前這則訊息是我退回 -pre.1 才能用」。接回的塔台分頁（claude）與新開的 Codex CLI 分頁都打不了字；滑鼠貼上進得去；pre.1 正常。"
  - "🔴 先查證、再改：① 讀本機 `%APPDATA%\\BetterAgentTerminal\\Logs` 的 `debug-20261128-110127.log` / `debug-20261128-110745.log` / `debug-20261128-110847.log`（以開頭版號判斷哪個是 pre.2、哪個是退回的 pre.1；只讀、不刪、不改），找鍵盤輸入與 `pty:write` / launch hold（`[launch-hold]` 類）/ `new-pty-spawned` / `cursor` / 例外 / renderer 錯誤的紀錄，回報區只摘要、不貼權杖或家目錄路徑；② pre.1 → pre.2 產品差異只有 T0956 與 T0957（`git diff v0.8.1-pre.1 v0.8.1-pre.2 -- src electron scripts`），逐一判斷哪個會讓鍵盤輸入不進 PTY 而滑鼠貼上可以（比較兩者在 renderer 與主行程的路徑：xterm `onData` / `attachCustomKeyEventHandler`、焦點、`PtyManager.holdInputForLaunch` / `writeLaunchCommand`、`pty:launch-command` 是否送到）；③ 以 T0955 / T0959 的做法（`e2e/manual/t0959-v081-pre2-acceptance.ts`：GitHub release 的 `0.8.1-pre.2` 與 `0.8.1-pre.1` zip、隔離 userData / runtime、假 claude）重現：BAT 重開自動接回 → 鍵盤輸入與 Enter 是否進 PTY；新開 Codex CLI 分頁同樣檢查（本機沒有 codex 時以假的 codex 或寫明略過）。pre.1 不重現、pre.2 重現 = 確認。重現不了 → 寫明試過的條件並問塔台，不要猜著改。"
  - "🔴 修正：找到原因後在 `main` 的程式修正，保留 BUG-232（T0956）與 BUG-233（T0957）修好的行為；如果正確修法需要拿掉或大改 T0956 / T0957 的功能 → 停下問塔台。CLAUDE.md 列的唯一實作（`sendLaunchCommand`、`showLeftoverHiddenCursor` 等）照規則改在唯一實作處。"
  - "🔴 不回歸（R-G003）：T0955 A-19–A-23 與 T0959 R0 / B233 / B232-login 的交付版驗收案例逐一核對改動後預期仍成立，回報區列〈相關通過案例〉判定；既有測試不改斷言（只能新增）。新增回歸測試：能在單元測試重現的就寫單元測試（修正前失敗、修正後通過）；修正後以隔離實例＋本分支打包（`npm run build:dir` 或既有做法）再跑一次重現步驟確認鍵盤可用。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。🔴 不碰使用者正在用的安裝版 BAT（不安裝、不關閉、不改它的 userData）；隔離實例一律用自己的 userData 與 runtime。"
  - "🔴 文件：對應 docs/agent-guide 檔補原因與修正；CLAUDE.md 只在需要時補一句，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0963 — pre.2 自動恢復後鍵盤無法輸入（BUG-234）

## 背景

使用者在 `0.8.1-pre.2` 遇到：BAT 自動恢復（接回終端）後，塔台分頁打不了字、Enter 沒反應，滑鼠右鍵貼上可以；新開 Codex CLI 分頁也一樣；退回 `0.8.1-pre.1` 正常。pre.1 → pre.2 的產品改動只有 T0956（BUG-232）與 T0957（BUG-233）。

## 範圍

- 讀本機日誌、比對 T0956 / T0957 差異，以隔離實例重現（pre.2 重現、pre.1 不重現）。
- 修正原因，保留 BUG-232 / BUG-233 的修正；加回歸測試；以本分支打包的隔離實例確認鍵盤可用。

## 不做

- 不碰安裝版 BAT；不發版；不改 T0956 / T0957 以外無關的行為。

## 驗收

- [x] 回報區有原因查證（日誌摘要、差異判斷、隔離實例 pre.1 / pre.2 對照）
- [x] 修正＋回歸測試（修正前失敗、修正後通過）；BUG-232 / 233 行為保留
- [x] 〈相關通過案例〉判定（T0955 / T0959）
- [x] 本分支打包的隔離實例：自動接回後與新開 Claude CLI 分頁鍵盤可用（Codex CLI 未以真 codex 實測：同一條主行程路徑由單元測試涵蓋，列入〈待實機〉）
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 〈待實機〉步驟；docs 更新

## 塔台補充（執行中 #1）

> 2026-11-28 11:15 (UTC+8)，使用者補充。

- **新事實**：使用者原話「全新啟動 BAT 時，開一個全新 Claude CLI 狀況一樣」。⇒ 不限於自動恢復 / 接回：**全新啟動的 BAT 裡新開的 Claude CLI 分頁也打不了字**。重現與查證請以「全新啟動 → 新開 Claude CLI（以及 Codex CLI）分頁 → 鍵盤輸入與 Enter」為主路徑，自動接回改為次要情境。
- 推論（未查證，供參考）：新開 agent 分頁走 `holdInputUntilLaunch` → `PtyManager.holdInputForLaunch` → `sendLaunchCommand` / `pty:launch-command` → `writeLaunchCommand` 的路徑（T0951 / T0956），若 launch 命令的放行沒有送到，輸入會一直被保留；滑鼠貼上能進去這點與此推論不完全吻合，請一併比對貼上與鍵盤的路徑差異。
- 驗收第 4 項改為：本分支打包的隔離實例「全新啟動後新開 Claude CLI / Codex CLI 分頁」與「自動接回後」鍵盤都可用。範圍與其他規則不變。

## 塔台補充（執行中 #2）

> 2026-11-28 11:18 (UTC+8)，使用者補充。

- **新事實**：使用者原話「但是 pwsh 終端沒問題」。⇒ 一般 pwsh shell 分頁在 pre.2 可以用鍵盤輸入；打不了字的是 **agent 分頁**（Claude CLI、Codex CLI，含接回的塔台 claude 分頁）。
- 這讓「agent 分頁的啟動命令前保留輸入（`holdInputUntilLaunch` / `holdInputForLaunch` → `sendLaunchCommand` / `pty:launch-command` / `writeLaunchCommand`）沒有放行」或「只套用在 agent 分頁的按鍵處理」更可疑；查證時把 pwsh 分頁當對照組（同一個 pre.2 實例，pwsh 可打字、agent 分頁不行）。仍需以證據確認，不要只憑推論修。
- 驗收加一項：修正後 pwsh 分頁照常可用（不回歸）。範圍與其他規則不變。

---

## 回報區

### 完成狀態

- **狀態**：DONE（原因查證、修正、回歸測試、交付版隔離實例對照全部完成）
- **session_id**：076fe418-ac76-4e9e-ac57-e14bc1a215ff
- **一句話**：原因是 T0951（`0.8.1-pre.1` 起）的 `PtyManager.writeLaunchCommand`：啟動命令前**沒人打字**時，保留清單（空陣列）沒有從 `dispatchInputHolds` 刪掉，之後該分頁所有按鍵、Enter、貼上都被保留且沒有計時器結束它。🔴 不是 pre.2 引入的：pre.1 用同樣步驟一樣重現；使用者退回 pre.1 能用，是因為退版後分頁都是接回既有 PTY（`created: false`，不保留）。

### 原因查證

**① 使用者日誌（只讀）**
- `debug-20261128-110127.log` = pre.2（`update-check current=0.8.1-pre.2`）。這次啟動 Terminal Server 由 holder 全新啟動，所有分頁都是**新 spawn 的 PTY**（`pty:create … → Terminal Server`、`server spawned PTY`）：塔台 `57b9ec12`、新開的塔台 `c2f1a2e3`、Codex CLI `50b1d050`、Claude CLI `29c893bf`，以及 03:06:26 的 ⏻。整段沒有任何一次使用者送出的回合（`user-prompt-submit` 只出現在 `/control-tower` 啟動參數自動觸發的那幾次）；Ctrl+V 有 `[terminal-paste] Ctrl+V → text` 紀錄（按鍵處理有收到，焦點在 xterm）。沒有 `[agent-command] … input before the launch command` 行（= 保留期間沒打字），也沒有例外 / renderer 錯誤。
- `debug-20261128-110745.log` = 安裝程式的 `--installer-quit-request`（交給執行中的 BAT 後結束）。
- `debug-20261128-110847.log` = 退回的 pre.1（`update current=0.8.1-pre.1`）：holder 接回，三個分頁都是 `pty:create SKIP (idempotent)`、`PTY already running, launch command skipped`（不保留）；03:09:03 起使用者正常送出回合。
- 結論：能不能打字取決於「分頁是新 spawn（有保留）還是接回（沒保留）」，不是版本。

**② 差異判斷（`git diff v0.8.1-pre.1 v0.8.1-pre.2 -- src electron scripts`）**
- 產品差異只有 T0956（登入導引分頁、遠端工具安裝改走 `sendLaunchCommand`）與 T0957（⏻ 後 `showLeftoverHiddenCursor` 只寫本機 xterm `ESC[?25h`）。兩者都不碰一般 agent 分頁的輸入路徑；`xtermCursorHidden` 只讀欄位，xterm 5.5.0 的 `isCursorHidden` 只用在游標繪製。
- 兩版發佈 zip 的 `app.asar` 解開比對：`dist-electron/`（主行程、preload）**逐位元相同**，差異只在 renderer bundle。
- 主行程 `writeWithResult`：`dispatchInputHolds` 有清單且不是終端自動回應（`isTerminalAutoReply`，滑鼠回報、焦點事件）→ 存起來。`writeLaunchCommand` 原碼 `const held = this.endLaunchHold(id) ? … : []; if (held.length > 0) this.dispatchInputHolds.delete(id)`：空清單不刪 → 保留永遠不結束（計時器已在 `endLaunchHold` 清掉）。鍵盤與貼上都走 `pty:write`，同樣被保留；只有滑鼠回報進得去。
- 關於「滑鼠貼上可用」：隔離實例中貼上（xterm `paste`）同樣進不去。使用者觀察到的應是剛好落在保留結束前、或在接回分頁上的貼上；日誌無法再細分，判定不影響原因。

**③ 隔離實例重現（新增 `e2e/manual/t0963-keyboard-repro.ts`：發佈 zip、隔離 runtime / userData、Git Bash、假 claude 全螢幕；鍵入 `abc`＋Enter 與 xterm 貼上，看假 claude 的 stdin 紀錄）**

| 案例 | pre.1 zip | pre.2 zip | 本分支打包（修正後） |
|---|---|---|---|
| shell（Git Bash）鍵盤＋貼上 | PASS | PASS | PASS |
| 新開 Claude CLI 鍵盤 `abc`＋Enter | **FAIL**（stdin 空） | **FAIL**（stdin 只有 `ESC[<35;…M` 滑鼠回報） | PASS（`"abc\r"`） |
| 新開 Claude CLI 貼上 | **FAIL** | **FAIL** | PASS（`"PASTEDTEXT"`） |
| 同分頁 ⏻ 後 鍵盤 / 貼上 | **FAIL** / **FAIL** | **FAIL** / **FAIL** | PASS / PASS |
| 之後新開的 shell 分頁 | PASS | PASS | PASS |

- 工單原本的判準是「pre.1 不重現、pre.2 重現 = 確認」；實測兩版都重現，原因已由程式與單元測試確定、修正後消失，所以照實記錄並直接修，沒有問塔台（屬工單範圍內、不需拿掉 T0956 / T0957）。
- 塔台補充 #1（全新啟動新開 Claude CLI 也一樣）、#2（pwsh 沒問題）與上表一致：沒有啟動命令的 shell 分頁不保留。

### 修正

- `electron/pty-manager.ts` `writeLaunchCommand`：只要 `endLaunchHold(id)` 為真（確實是 launch 保留），一律刪掉 `dispatchInputHolds` 的清單（空的也刪），再寫命令、寫保留的輸入。不是 launch 保留（helper 派工 BUG-151、或沒有保留）時照舊不動。開始保留、15 s 逾時、64 KiB 上限、PTY 結束、日誌字串、renderer 端全部不變；T0956 / T0957 的程式沒有動。
- 新增測試（`electron/__tests__/launch-input-hold.test.ts`，既有斷言未改）：
  - 「nothing typed before the command → the keys typed after it go straight through」：修正前 **FAIL**（`writeWithResult` 回 `held-until-dispatch`），修正後 PASS。
  - 「⏻ again after a command with nothing typed → a new hold, ended by the next command」。
- 交付版重現工具 `e2e/manual/t0963-keyboard-repro.ts`（README 有說明與修正前後結果）。

### 相關通過案例判定（R-G003）

| 案例 | 改動後預期 | 本分支打包實測 |
|---|---|---|
| T0955 A-19（塔台全螢幕） | 不變 | PASS |
| T0955 A-20（⏻ 後命令前打字 → 命令在前、輸入在後） | 不變（有打字的路徑原本就刪清單） | PASS |
| T0955 A-21（Recovery 保留接回） | 不變（接回不保留） | PASS |
| T0955 A-22（重新開始） | 不變 | PASS |
| T0955 A-23（⏻ 後游標 / 捲動） | 不變 | PASS |
| T0955 反例-Claude CLI / 反例-shell | 不變 | PASS / PASS |
| T0959 B233（WSL）＋對照 | 不變（T0957 未動） | PASS / PASS |
| T0959 B233-gitbash（不回歸）＋對照 | 不變 | PASS / PASS |
| T0959 B232-login＋對照（不打字） | 不變；對照組「不打字」之後輸入現在會直接寫入（原本會被卡住，驗收沒測打字） | PASS / PASS |
| T0959 B232-install | 未判定（同 T0959，需遠端 profile 視窗） | 未判定 |
| T0959 R0 | = T0955 全套 | 見上 |

沒有通過案例的預期結果被改變。

### 驗證

- worktree `npm ci` exit 0。
- `npm run test:unit`（head `45a9427c`，第一次完整執行）：Test Files **522 passed** | 3 skipped（525）；Tests **9428 passed** | 47 skipped（9475）；exit 0。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- `npx vite build`：經 `npm run build:dir`（`clean:dist-electron` → native → verify → `vite build` → `electron-builder --dir`）exit 0。
- 本分支打包 `release/win-unpacked`：`t0963-keyboard-repro.ts` 4/4 PASS；`t0955-v081-acceptance.ts` exit 0（全 PASS）；`t0959-v081-pre2-acceptance.ts` exit 0（可判定項全 PASS）。隔離：各驅動的 Terminal Server 結束、runtime userData 移除、`~/.claude` / `~/.codex` 雜湊不變、安裝版 BAT 核心程序 pid 前後相同；沒有安裝、關閉或改動使用者的安裝版 BAT。結果在本機 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0963-results/`（不進 repo）。
- Codex CLI 分頁：沒有以真的 codex 在隔離實例實測（需要登入 / 網路）。新開 codex 分頁走同一個 `holdInputUntilLaunch` → `writeLaunchCommand`（主行程共用、與 agent 種類無關），由單元測試涵蓋；列入〈待實機〉。
- 自動接回：接回的 PTY（`created: false`）原本就不保留，A-21 PASS；使用者 pre.2 日誌裡打不了字的其實都是新 spawn 的分頁。

### 待實機（使用者，裝上含本修正的版本後）

1. 全新啟動 BAT → 「+」→ Claude CLI → 等 claude 畫面出來後**先不要打字**，再打一句話按 Enter → 送得出去。
2. 同上開 Codex CLI 分頁 → 打字＋Enter 有反應。
3. 「以塔台開啟 Claude」分頁、⏻ 重啟後的 claude 分頁 → 同樣能打字。
4. 一般 pwsh 分頁照常可用；升級後自動接回的分頁照常可用。
5. 回歸：⏻ 後**馬上**打幾個字（命令前打字）→ 字出現在 claude 輸入框（T0951 行為不變）。

### 檔案變更

- `electron/pty-manager.ts`（修正）
- `electron/__tests__/launch-input-hold.test.ts`（新增 2 項）
- `e2e/manual/t0963-keyboard-repro.ts`（新增）、`e2e/manual/README.md`（新增一節）
- `docs/agent-guide/launch-command-input-hold.md`（新增「沒打字時保留沒有結束（T0963 / BUG-234）」一節、驗證一句）
- `CLAUDE.md`（「BAT MCP shim」節的 BUG-231 句尾補一句不變式；標題未改）

### Commit 與 SHA

- `branch`：ct/T0963
- `base_sha`：763ca8c2ea8b761d1b6e3ad849380c914c53615c
- `validated_sha`：45a9427ce796c2c17c8d8ef1c9e1e78b62f89009
- `head_sha`：45a9427ce796c2c17c8d8ef1c9e1e78b62f89009
- 產品 commit：`45a9427c fix(T0963): end the launch input hold when nothing was typed before the command (BUG-234)`；worktree `status --porcelain` 為空。未 push。

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：前 5 個可測路徑（`src/components/` 等）皆存在。C-2：工單無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0963`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- `CT_MODE` = yolo、`CT_INTERACTIVE` = 0。

### 遭遇問題

- 工單「pre.1 不重現、pre.2 重現」的前提與實測不符（兩版都重現）；已依證據處理，見〈原因查證〉③。
- 本機 Git Bash 下 `python` 讀 `/c/…` 路徑失敗一次（`MSYS_NO_PATHCONV`），改 `cygpath -m` 後正常。

### 後續建議（給塔台）

- BUG-234 的發生版本應記為 `0.8.1-pre.1`（T0951 起），pre.1 的 A-19–A-23 驗收只測「命令前打字」，沒有測「命令後打字」；T0963 的重現工具可補進之後交付版的驗收。
- pre.1 / pre.2 的發佈說明可補一行已知問題（新開 agent 分頁打不了字，接回的分頁不受影響）。

### 互動紀錄

- [11:15] 📥 塔台補充（執行中 #1）於〈跨 session 通知〉讀到 → 重現主路徑改為全新啟動新開 Claude CLI；與已寫好的重現腳本一致，照做。
- [11:19] 📥 塔台補充（執行中 #2）於〈跨 session 通知〉讀到 → shell 分頁當對照組（重現腳本的 shell / shell-2 案例），驗收補「shell 分頁不回歸」（PASS）。
