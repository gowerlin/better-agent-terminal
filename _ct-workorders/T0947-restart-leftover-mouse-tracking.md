---
schema_version: 1
schema_kind: workorder
id: T0947
title: "BUG-229：⏻ 重啟 claude 分頁時舊程式留下的滑鼠追蹤沒關，滑鼠回報黏在 claude 啟動命令前面 → 重啟後不再讓殘留的滑鼠回報打進新 shell"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T20:49:15+08:00"
started_at: "2026-11-27T20:50:37+08:00"
updated_at: "2026-11-27T21:02:15+08:00"
completed_at: "2026-11-27T21:02:15+08:00"
session_ids:
  - "58de78af-d8ed-4156-9120-59f5f8266d23"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 T0946 同一版"
depends_on: []
related:
  - "BUG-229；D429 / D430（U-37：A）；BUG-166 / T0672（`MouseReportEchoDetector`）；T0568 / T0571 / T0573（滑鼠追蹤規則）；BUG-151（`holdInputForDispatch`）；T0539（`restartOrCreatePty`）；T0944（塔台分頁 ⏻ 帶 `/control-tower`）；T0946（BUG-228，並行，先合併）"
affects_files:
  - _ct-workorders/T0947-restart-leftover-mouse-tracking.md
  - src/components/TerminalPanel.tsx
  - src/lib/mouse-tracking-reset.ts
  - src/lib/__tests__/
  - src/lib/pty-replay.ts
  - src/components/WorkspaceView.tsx
  - src/__tests__/
  - electron/pty-manager.ts
  - electron/__tests__/
  - docs/agent-guide/terminal-context-menu.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0947` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。T0946（BUG-228）同時在 `ct/T0946` 改 `src/components/WorkspaceView.tsx` / `CLAUDE.md` / `electron/__tests__/`，合併時 T0946 先合；本單盡量不動 `startClaudeCliPty` 的命令組裝與 `src/lib/tower-launch-prompt.ts`、`src/utils/shell-quote.ts`。"
  - "🔴 現象（BUG-229，使用者截圖，BAT `0.8.0`、Windows、分頁 shell 是 Git Bash／UCRT64）：「以塔台開啟 Claude」的分頁按 ⏻ 重啟，新 shell 第一行是 `35;77;25M35;78;25M…;22M` 後面接 claude 啟動命令；bash 以 `;` 切開逐段 `command not found`，最後 `22MC:\\…\\claude.exe: No such file or directory`，claude 沒有啟動；之後提示列持續出現 `35;x;yM`（滑鼠追蹤仍開著）。塔台推測：① 舊 claude 被 ⏻ 結束、沒機會關掉滑鼠追蹤，新 PTY 沿用同一個 xterm，xterm 的 `mouseTrackingMode` 仍開著，滑鼠移動的 SGR 回報（`ESC [ < 35 ; x ; y M`，`ESC [ <` 被 readline 吃掉）寫進新 PTY；② 回報在啟動命令寫入前進了 bash 輸入列；③ T0672 的 `MouseReportEchoDetector` 這次沒作用。先查證三點（看 ⏻ → `restartOrCreatePty` → 寫入啟動命令的路徑、xterm 在重啟時的模式狀態、偵測器為何沒觸發），確認後再改；推測不成立 → 問塔台。"
  - "🔴 範圍：⏻ 重啟（與 PTY 結束後在同一個 xterm 起新 PTY 的其他路徑，例 Terminal Server recovery，查證後決定是否一併）後，舊程式留下的滑鼠追蹤不再把回報送進新 PTY；修好後 claude 分頁 ⏻ 時啟動命令原樣寫入。做法由 Worker 查證後選一個、回報區寫理由，例：新 PTY 開始前於本機 xterm `terminal.write` DECRST 關閉滑鼠追蹤（同 T0672 的做法），和／或啟動命令寫入前收到的輸入不放進命令前面。另查證 `MouseReportEchoDetector` 這次沒觸發的原因，屬它的缺陷就一起修。"
  - "🔴 做法限制：🔴 不寫 PTY 來關追蹤（DECRST 只寫本機 xterm，同 T0672）；🔴 程式正在跑時的滑鼠回報不改（T0568 / T0698 規則：xterm 寫進 PTY 的回報逐位元不變，只在新 PTY 起來之前／舊程式已結束時處理）；不改 xterm 版本、不改 PTY env、不改 T0944 的帶 / 不帶規則、不改 `--name=` / hooks / MCP 參數。🔴 一般 shell 分頁 ⏻、沒開滑鼠追蹤的分頁、⏻ 以外的輸入行為逐字不變（測試斷言）。"
  - "🔴 唯一實作：判斷與處理放在共用位置（例 `src/lib/mouse-tracking-reset.ts` 新增函式），TerminalPanel / pty-replay 只接線；不在 consumer 內聯。"
  - "🔴 測試：以真 xterm 實例（比照 `src/lib/__tests__/terminal-wheel-reports.test.ts` / T0672 的測試）重現「開追蹤 → 結束 → 新 PTY → 滑鼠移動」不再送出回報；啟動命令前沒有殘留輸入（若改了寫入路徑）；回歸：追蹤中程式的回報不變、Shift + 右鍵 / 右鍵選單 / 「重設滑鼠模式」不變。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機（安裝版 ⏻ 重啟塔台分頁）寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 文件：`docs/agent-guide/terminal-context-menu.md` 補一段（⏻ 重啟與殘留滑鼠追蹤）；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」節只在需要時補一句（唯一實作函式名），小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0947 — ⏻ 重啟後殘留的滑鼠追蹤不再打進新 shell（BUG-229）

## 背景

`v0.8.0` 實機驗收 A-16：「以塔台開啟 Claude」的分頁按 ⏻ 重啟，滑鼠回報 `35;x;yM` 黏在 claude 啟動命令前面，bash 把命令切碎，claude 沒有啟動，之後滑鼠一動還會繼續把回報打進 shell（BUG-229）。這和 BUG-228（Git Bash 改寫 `/control-tower`，T0946）是兩個問題。使用者裁示 U-37：A（現在派，與 T0946 並行，T0946 先合）。

## 範圍

- 查證根因（xterm 滑鼠模式在 ⏻ 後殘留、回報進入啟動命令前的輸入列、`MouseReportEchoDetector` 沒觸發）。
- ⏻ 重啟（查證後決定是否含其他同 xterm 重建 PTY 的路徑）不再把殘留的滑鼠回報送進新 PTY；claude 啟動命令原樣寫入。
- 共用實作；程式執行中的滑鼠回報與其他分頁行為逐字不變。

## 不做

- 不寫 PTY 關追蹤、不改 xterm 版本、不改 PTY env、不改 T0944 / T0946 負責的命令組裝。

## 驗收

- [ ] 回報區有根因查證（三點各自的結論）與選用做法的理由
- [ ] 真 xterm 測試：開追蹤 → 結束 → 新 PTY → 滑鼠移動，不送回報；回歸測試全過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0（改 electron 時 `typecheck:electron` = 0）
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T21:01:17+08:00
- **session_id**：58de78af-d8ed-4156-9120-59f5f8266d23
- **branch**：`ct/T0947`
- **base_sha**：`48f4dc98adbb7414779d944d79fabd3e2060c498`
- **validated_sha**：`6e58f168e7063d08798c0b36633452a3a434f44c`
- **head_sha**：`6e58f168e7063d08798c0b36633452a3a434f44c`（= validated_sha）
- **產品 commit**：`6e58f168` fix(terminal): turn off leftover mouse tracking before a new PTY starts in the same xterm (T0947, BUG-229)

### 落點檢查

PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：`src/components/TerminalPanel.tsx` 等存在。C-2：工單無 `branch` 欄位。`CT_HOME` = 主 checkout、`CT_WORKTREE_BRANCH` = `ct/T0947`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 根因查證（三點）

1. **xterm 的追蹤在 ⏻ 後殘留：成立。** claude-cli 分頁的 ⏻ 是 `WorkspaceView.handleRestart` → `pty.kill`（Windows `taskkill /F /T`）→ `startClaudeCliPty` → `createPtyThenLaunch`（`pty:create`）。TerminalPanel 以 terminal id 掛載，⏻ 不重新掛載，xterm 是同一個實例；被強制結束的 claude 送不出 DECRST，這條路徑上也沒有任何地方重設 xterm 的滑鼠模式。真 xterm 測試重現：開 `?1000h ?1002h ?1003h ?1006h` 後，移動滑鼠產生 `\x1b[<35;77;25M`（`35` = 沒按鍵的移動 = any-event 追蹤，與截圖相符）。
2. **回報在啟動命令前進了 bash 輸入列：成立。** `createPtyThenLaunch` 的 launch 在 `pty:create` 回來後 `setTimeout(500)` 才寫命令，這段時間的回報直接進新 shell。以 node-pty（ConPTY）起本機 Git Bash（提示列同為 `UCRT64`）實測：spawn 後 66 ms 寫入兩筆回報，bash 約 430 ms 起來後才回顯 `35;77;25M` / `35;78;25M`（`ESC [ <` 被 readline 吃掉），它們留在輸入列，之後寫入的文字接在後面 → `35;77;25M35;78;25M<command>`，與截圖一致。⏻ 路徑確實沒有 `holdInputForDispatch` 之類的保護（那只在 helper 派工）。
3. **`MouseReportEchoDetector` 沒觸發：時間窗的邊界，不是比對缺陷。** 同一實測：readline 對每個不認得的序列先閃一次畫面（`ESC[?5h` … `ESC[?5l`，約 100 ms）再回顯，一筆接一筆；先打進去的回報要等 shell 讀輸入才回顯。兩筆回報分別在送出後 479 ms / 588 ms 回顯，第二筆已超過 500 ms；shell 起得更慢（⏻ 時機器忙、profile 較重）或回報更多時全部落在窗外。命令執行期間（截圖中一長串 `command not found`）移動滑鼠的回報也一樣，下一個提示列才回顯、晚於 500 ms。閒置提示列送出的回報 139 ms 就回顯，偵測器會命中。所以偵測器本身沒壞；不放寬時間窗（會提高執行中 TUI 畫出相同字串時的誤判），改在 ⏻ 路徑直接處理。

### 選用做法與理由

- **新 PTY 在同一個 xterm 開始前後，追蹤還開著就在本機 xterm 寫 `MOUSE_TRACKING_RESET`**（同 T0672 F1：🔴 只寫 xterm、不寫 PTY）。關掉追蹤後滑鼠移動不再產生回報，啟動命令前就沒有東西，不需要改寫入路徑。
- 唯一實作 `resetLeftoverMouseTracking(id, reason)`（`src/lib/mouse-tracking-reset.ts`）：沒有掛載的 view、或 `isMouseTrackingOn` 為假 → 什麼都不做、回 false；否則呼叫 view 的重設，等 xterm 解析完（`terminal.write` 的 callback，最多 `LEFTOVER_MOUSE_RESET_WAIT_MS` = 200 ms）才 resolve，確保之後的滑鼠移動不會再送回報。TerminalPanel 只以 `registerLeftoverMouseTrackingView` 登記自己的 xterm，重設沿用既有 `resetMouseTracking`（多一個可選的解析完 callback；清偵測器、忘記保留的選取、日誌 `[mouse-tracking] reset: <reason> terminal=<id> mode=<mode>`）。
- 呼叫點：
  - `before-new-pty`：`restartOrCreatePty` 呼叫 `pty:restart` 前（一般 / codex 分頁 ⏻、codex 被中斷分頁恢復）；WorkspaceView claude-cli 分頁 ⏻ 與被中斷分頁恢復的 `pty.kill` 前（各一行）。
  - `new-pty-spawned`（補一次，舊程式結束前最後的輸出又開了追蹤時）：`restartOrCreatePty` restart 成功後、`createPtyWithReplay` 回 `created: true` 時。`created: false`（PTY 還在跑）不動，所以存活 PTY 的重連 / 重載不受影響；新分頁的 xterm 本來就沒有追蹤，是 no-op。
- **不改寫入路徑的理由**：問題只來自滑鼠回報，追蹤關掉就沒有；使用者在 ⏻ 期間自己打的字照舊（與修正前相同），屬另一件事、不在本單範圍。
- **Terminal Server recovery 不一併處理**：recovery 在主行程以同一 id 重建 shell，renderer 收不到「這個分頁的新 PTY 已建立」的訊號，也不寫啟動命令；殘留回報只進閒置提示列，由 T0672 偵測器處理（閒置時回顯在時間窗內）。之後從「被中斷的 agent 分頁」恢復時走上面的 `before-new-pty`。
- WorkspaceView 只加兩行呼叫與一行 import，沒有動 `startClaudeCliPty` 的命令組裝、`src/lib/tower-launch-prompt.ts`、`src/utils/shell-quote.ts`（與 T0946 的改動不同 hunk）。保留原本的 `await window.electronAPI.pty.kill(terminal.id)` 行，既有 source guard（`interrupted-agents-dialog.test.tsx`）不必改。

### 變更檔案

- `src/lib/mouse-tracking-reset.ts`：`LeftoverMouseTrackingReason` / `LeftoverMouseTrackingView` / `registerLeftoverMouseTrackingView` / `resetLeftoverMouseTracking` / `LEFTOVER_MOUSE_RESET_WAIT_MS` / `resetLeftoverMouseTrackingRegistry`（測試用）；檔頭說明 BUG-229。
- `src/lib/pty-replay.ts`：`restartOrCreatePty` 與 `createPtyWithReplay` 的呼叫點。
- `src/components/TerminalPanel.tsx`：登記 view、卸載時解除；`resetMouseTracking` 多可選 callback。
- `src/components/WorkspaceView.tsx`：claude-cli ⏻ 與被中斷分頁恢復的 `pty.kill` 前各一行。
- `src/lib/__tests__/mouse-tracking-restart.test.ts`（新）、`src/__tests__/terminal-context-menu.test.tsx`（檔尾新增一個 describe，既有測試未改）。
- `docs/agent-guide/terminal-context-menu.md`：T0672 節補「時間窗的邊界（T0947 實測）」；新節「⏻ 重啟與殘留的滑鼠追蹤（T0947 / BUG-229）」。
- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤」節第一點補一句（唯一實作函式名、呼叫點、docs 連結），小節標題未改。
- 未動 `electron/**`（`affects_files` 列了 `electron/pty-manager.ts` / `electron/__tests__/`，查證後不需要）。

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0 |
| `npm run typecheck` | 0 錯誤（exit 0） |
| `npx vite build` | exit 0 |
| `npm run typecheck:electron` | 未跑：本單未改 `electron/**` |
| `npm run test:unit`（head `6e58f168` 第一次完整執行） | exit 0；Test Files 514 passed / 3 skipped（517）；Tests 9293 passed / 42 skipped（9335）；0 failed |

新測試重點（`mouse-tracking-restart.test.ts`，真 xterm 5.5.0，滑鼠移動經 `CoreMouseService.triggerMouseEvent`）：
- 重現：追蹤留著時，滑鼠移動送出 `\x1b[<35;77;25M` / `\x1b[<35;78;25M`。
- 開追蹤 → ⏻（`restartOrCreatePty`，host 結束舊程式並 spawn 期間滑鼠持續移動）→ 新 PTY → 移動滑鼠：送進 PTY 的輸入是空的；之後寫入的啟動命令是唯一輸入；新程式再開追蹤後，回報逐位元與修正前相同。
- 舊程式在結束途中又開追蹤 → 新 PTY 執行時再重設一次（`before-new-pty`、`new-pty-spawned`）。
- 一般 shell（沒追蹤）⏻：不寫 xterm、不重設；沒有 view、已解除、別的分頁：不動；view 不回報解析完：200 ms 後 resolve。
- 程式執行中（不是新 PTY）：回報逐位元不變、不重設。
- `createPtyWithReplay`：`created: true` 重設、`created: false` / 失敗不動。
- Git Bash 回顯時間的實測資料（先打進去 479 / 588 ms、閒置 139 ms）對偵測器的結果。
- WorkspaceView source guard：重設在 `pty.kill` 前、`pty.kill` 在 `startClaudeCliPty` 前（⏻ 與恢復兩處）。

回歸：`terminal-context-menu.test.tsx` 全部 53 項通過（含 T0568 選單、T0569 Esc、T0571 / T0573 Shift 選取、T0672 F1 / F2「重設滑鼠模式」/「離開替代畫面」，與新增的 3 項接線測試：追蹤中只寫 xterm、記日誌含原因；沒追蹤不寫不記；卸載後不可達）；`pty-restart-or-create.test.ts`、`pty-replay.test.ts`、`interrupted-agents-dialog.test.tsx`（含 T0766 source guard）未改且通過。

### 待實機

不碰安裝版 BAT、不開 claude 回合，以下交使用者 / 塔台：
1. 安裝含本修正的版本，Windows、分頁 shell 為 Git Bash，「以塔台開啟 Claude」，等 claude 起來（滑鼠追蹤開著）。
2. 按 ⏻，期間讓滑鼠在分頁上持續移動。
3. 預期：新 shell 的命令列沒有 `35;x;yM`，claude 啟動並帶 `/control-tower`（BUG-228 / T0946 合併後）；debug log 有 `[mouse-tracking] reset: before-new-pty terminal=<id> mode=any`。
4. claude 起來後滑鼠照常運作（點擊、滾輪、Shift + 右鍵選單）。
5. 一般 shell 分頁 ⏻：log 沒有 `[mouse-tracking] reset:`。
6.（選）被中斷 agent 分頁從對話框恢復 claude：同 3。

### 相關通過案例判定

工單沒有〈相關通過案例〉節，不適用。

### 互動紀錄

- [20:50] 開工；落點 PASS；yolo、未向塔台提問。
- [20:55] 以 node-pty 起本機 Git Bash（ConPTY）實測回報的回顯形式與時間，作為第 ② ③ 點證據（暫存腳本在 session scratchpad，未進 repo）。
- [20:56] 原本把 WorkspaceView 的 `pty.kill` 包成新函式，發現既有 source guard 逐字檢查該行，改成保留原行、前面加一行重設，未改既有測試。

### 遭遇問題

- 無阻塞。`npm run test:unit` 輸出中有一段 Node stack trace（某個測試的子程序輸出），整體 exit 0、0 failed，與本單無關。

### 後續建議（交塔台）

- ⏻ 時 claude 留下的 alt screen（1049）不會離開，新 shell 畫在 alt buffer 上、沒有 scrollback（T0672 規則：不自動離開）。若實機覺得礙事，可另開單評估 ⏻ 時一併離開 alt screen（⏻ 時舊程式必然結束，與 T0672 不自動離開的理由不同）。
- 使用者在 ⏻ 的 500 ms 期間自己打的字仍會在啟動命令前面（修正前即如此）；如需要，可比照 BUG-151 的 `holdInputForDispatch` 另開單。
