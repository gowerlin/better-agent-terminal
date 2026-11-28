---
schema_version: 1
schema_kind: workorder
id: T0983
title: "PLAN-066 F4（選項 D）＋BUG-238＋direct 模式 conin：自然結束的分頁在 ✕ / ⏻ / 同 id 重建時收掉 conhost；關分頁不再經 node-pty `kill()` 對已結束的 pid 呼叫 `process.kill`"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T19:04:38+08:00"
started_at: "2026-11-28T19:11:08+08:00"
updated_at: "2026-11-28T19:11:08+08:00"
session_ids:
  - "02c7441e-4ddf-4963-970a-7f6795aedb3f"
target_version: "下一個預覽版（`0.8.1-pre.6`；改 `terminal-server.js` → holder key 改變，發版前要跑 W6，發版前與使用者確認）"
depends_on: [T0982]
related:
  - "T0979（研究：③ F4、② direct conin、〈其他發現〉pid 重用，回報區〈可行修法〉與〈風險與不變式對照〉）；BUG-238；PLAN-066；T0540（程序樹結束順序）；T0539（⏻ 重啟）；T0704（recovery）；T0857（協定 v1 只做相加）；T0861（holder 接回）；T0887 / T0889（共用 conout Worker、`releaseEndedPtyInput`）；T0888（C3、量測 spec）；D521；D522（U-76：D、U-77：A）"
affects_files:
  - _ct-workorders/T0983-f4-release-exited-pty-on-close.md
  - electron/terminal-server/server.ts
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/process-tree.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - experiments/node-pty-worker/
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/pty-process-tree.md
  - docs/agent-guide/pty-holder.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0983` 寫檔（base = 派工當下的 `main`，應已含 T0982 合併的 `experiments/node-pty-worker/t0979/`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先讀 T0979 回報區〈③ F4〉〈② direct 模式 conin socket 殘留〉〈其他發現〉〈F4 產品選擇〉與 BUG-238，以那裡的量測、修法與不變式對照為規格。"
  - "🔴 使用者裁示（D522）：F4 採**選項 D**——shell 自己結束、分頁還開著（顯示 `[Process exited …]`）時保留 conhost；使用者按 ✕ 關閉、⏻ 重啟、或同 id 重建（BAT 重開恢復該分頁、holder 接回後恢復）時收掉。收掉時仍附著同一主控台的背景程序會一起結束（與 live 分頁 ✕ 結束整個程序樹的規則一致）。🔴 不做 A / B / C：shell 結束時不自動收、不偵測子孫。BUG-238 併入本單（U-77：A）。"
  - "🔴 修法（T0979 推薦案；細節可依實作調整，偏離時回報理由）：① `electron/terminal-server/shared-conout.ts` 新增 `releaseExitedPty(proc, platform)`：win32 且 node-pty 1.1.0 形狀相符（`_agent._ptyNative.kill`、`_agent._pty`、`_agent.inSocket`、`_agent._conoutSocketWorker.dispose`）時依序 ClosePseudoConsole → destroy conin → dispose 該 PTY 的 conout 轉送；形狀不符什麼都不做並記一行（不記 env / 內容）。② `server.ts`：`handlePtyExit` 在 win32 把自然結束的 proc 記進 `exitedPtys`（id → proc）；`killPty` 找不到 live entry 但 `exitedPtys` 有 → 釋放；`createPty` 遇到同 id 的 exited proc → 先釋放再 spawn；server `shutdown` 時一併釋放。③ BUG-238：`endPty`（T0540：先 `killProcessTree` 再 `pty.kill()`）改成程序樹結束後以同一套釋放收掉，🔴 不再呼叫 node-pty 的 `pty.kill()`（它會在 shell 已結束時 5 s 後對舊 pid `process.kill`）；direct 模式（`pty-manager.ts`）同理。🔴 T0540「先結束程序樹、再收 PTY」的順序不得對調。④ `pty-manager.ts`：`kill(id)` 在 `useServer` 且 instance 已因 exit 被刪除時，照樣送 `pty:kill`（舊 server 對不存在的 id 不做事、不回應，相容）；direct 模式在 `handleDirectExit` / `kill` 做同樣的記錄與釋放，並解決 ② conin 殘留（沿用 T0889 `releaseEndedPtyInput` 或新函式）。"
  - "🔴 不得改變：協定（🔴 不新增訊息類型，只是 `pty:kill` 對已結束的 id 多做釋放；新 host＋舊 server、舊 host＋新 server 兩方向都要相容並在回報區說明）；live 分頁 ✕ 的程序樹結束（T0540）；⏻ 重啟的新 PTY 建立、120x30 與尺寸同步（T0572 / T0539）；Terminal Server recovery（T0704）與孤兒清理順序；Recovery create hold（T0578）；holder 接回（T0861）；共用 conout Worker 規則（T0887 / T0889：輸出仍由 Worker 排空、批次轉送、Worker 當掉不自動重建、🔴 不改 `shared-conout-worker.cjs`）；node-pty 釘版 `1.1.0`；非 win32 行為逐字不變（macOS / Linux 不呼叫新函式）。"
  - "🔴 測試：擴充 `electron/__tests__/shared-conout-release.test.ts`（或新檔，Windows 真 node-pty；非 win32 skip）：自然結束後 conhost 仍在 → ✕（`pty:kill`）後不在；附著主控台的背景程序（T0979 `attached` 情境，`Start-Process -NoNewWindow ping`）在 ✕ 後結束、分頁開著時不結束；同 id 重建前先釋放；形狀不符不碰；source guard：`exitedPtys` 路徑與 `endPty` 不呼叫 `.kill()`（node-pty 的）；host `kill(id)` 對已結束的 id 會送 `pty:kill`；direct 模式 conin socket 不再累積。既有測試斷言不改（若必須改，先問塔台）。"
  - "🔴 量測（回報區附數字）：以 T0979 的 `experiments/node-pty-worker/t0979/ts-exit-residue.mjs`、`pty-end-residue.cjs`（必要時改成可帶 `--fix` 或新增情境，留在 `experiments/`）對修正前 / 後各跑一次：20 個自然結束後再 ✕ → conhost 0；direct 模式 100 次 kill 的 `PipeWrap` 不累積。只驅動自己 fork 的 Terminal Server / 自己載入的 node-pty，🔴 不碰使用者正在用的安裝版 BAT、Terminal Server、PTY holder，不用預設 userData；收尾殘留檢查列 PID。🔴 不得在開發機跑 W6 / 真的安裝程式（CLAUDE.md「Windows PTY holder」）。"
  - "🔴 不回歸（R-G003）：T0540 / T0539 / T0572 / T0578 / T0704 / T0857 / T0861 / T0866 / T0887 / T0889 / T0890 / T0947 / T0950 / T0957 相關測試逐一核對，回報區列〈相關通過案例〉；跑 `e2e/t0888-shared-conout-stress.spec.ts` 中原始碼建置即可跑的情境（C3）或說明為何不能跑。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。回報區寫明 holder key 是否改變（預期改變 → 塔台發版前跑 W6 `windows-upgrade-acceptance.yml`）。"
  - "🔴 文件：`docs/agent-guide/terminal-server-recovery.md`「Windows：共用 conout Worker」F4 段改寫（選項 D、釋放時機、背景程序行為）；`pty-process-tree.md`（`endPty` 不再呼叫 `pty.kill()`、BUG-238）；`pty-holder.md`（holder key 變動）；CLAUDE.md「Terminal Server 存活判定與 recovery」節共用 conout 一點與「關閉分頁時的程序樹」節各補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0983 — F4（選項 D）＋BUG-238＋direct 模式 conin 釋放

## 背景

T0979 研究 PLAN-066 後續：Windows Terminal Server 模式下，shell 自己結束的分頁每個留 1 個 conhost（約 1.6 MB）＋約 13 個 handle 到 server 結束，holder 保留時會跨 BAT 重開累積，之後關掉分頁也不會釋放。另發現關分頁時 node-pty `kill()` 會在 shell 已結束 5 s 後對舊 pid 呼叫 `process.kill`（BUG-238）。使用者 2026-11-28 裁示：F4 採選項 D（關閉或重啟分頁時收）、BUG-238 併入本單（U-76：D、U-77：A，D522）。direct 模式的 conin 殘留（T0979 ②）同一套釋放一起做。

## 範圍

- `releaseExitedPty`、Terminal Server 的 `exitedPtys` 與 `pty:kill` / 同 id 重建 / shutdown 釋放、`endPty` 不經 node-pty `kill()`、host 對已結束的 id 送 `pty:kill`、direct 模式同等處理。
- 真 node-pty 測試、修正前後量測、文件。

## 不做

- 不改協定訊息類型、`shared-conout-worker.cjs`、node-pty 版本；不做 F4 的 A / B / C；不做「只送 env 差異」（T0979 ①，延後）；不跑 W6；不發版。

## 驗收

- [ ] 自然結束的分頁在 ✕ / ⏻ / 同 id 重建後 conhost 結束；分頁開著時保留；附著主控台的背景程序在 ✕ 後結束
- [ ] `endPty` 與 direct 模式不再呼叫 node-pty `kill()`（source guard＋測試）；T0540 順序不變
- [ ] 新舊 host / server 組合相容（回報區說明）
- [ ] 修正前後量測（conhost 數、`PipeWrap`）
- [ ] 〈相關通過案例〉判定；既有斷言未改
- [ ] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] holder key 是否改變；docs 更新

---

## 回報區

（Worker 填寫）
