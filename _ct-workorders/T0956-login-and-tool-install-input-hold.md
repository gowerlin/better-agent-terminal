---
schema_version: 1
schema_kind: workorder
id: T0956
title: "BUG-232：登入導引分頁與遠端工具安裝也在命令寫入前保留使用者輸入（沿用 T0951 的 `sendLaunchCommand` / `holdInputUntilLaunch`）"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:38:19+08:00"
started_at: "2026-11-27T22:39:59+08:00"
updated_at: "2026-11-27T22:39:59+08:00"
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
tower_question: open
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
