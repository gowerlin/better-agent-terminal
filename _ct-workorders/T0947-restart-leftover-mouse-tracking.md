---
schema_version: 1
schema_kind: workorder
id: T0947
title: "BUG-229：⏻ 重啟 claude 分頁時舊程式留下的滑鼠追蹤沒關，滑鼠回報黏在 claude 啟動命令前面 → 重啟後不再讓殘留的滑鼠回報打進新 shell"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T20:49:15+08:00"
started_at: "2026-11-27T20:50:37+08:00"
updated_at: "2026-11-27T20:50:37+08:00"
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

（Worker 填寫）
