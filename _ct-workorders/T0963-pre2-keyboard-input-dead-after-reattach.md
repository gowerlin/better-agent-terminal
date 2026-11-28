---
schema_version: 1
schema_kind: workorder
id: T0963
title: "BUG-234：查出 `0.8.1-pre.2` 自動恢復後鍵盤無法輸入（滑鼠貼上可用、新開 Codex CLI 也一樣）的原因並修正"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T11:09:41+0800"
started_at: "2026-11-28T11:11:45+0800"
updated_at: "2026-11-28T11:11:45+0800"
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

- [ ] 回報區有原因查證（日誌摘要、差異判斷、隔離實例 pre.1 / pre.2 對照）
- [ ] 修正＋回歸測試（修正前失敗、修正後通過）；BUG-232 / 233 行為保留
- [ ] 〈相關通過案例〉判定（T0955 / T0959）
- [ ] 本分支打包的隔離實例：自動接回後與新開 Codex CLI 分頁鍵盤可用
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
