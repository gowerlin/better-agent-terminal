---
schema_version: 1
schema_kind: workorder
id: T0957
title: "BUG-233：⏻ 重啟後若舊程式留下隱藏的游標，新 PTY 開始時在本機 xterm 顯示游標（沿用 T0950 的時機）"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:38:19+08:00"
updated_at: "2026-11-27T22:38:19+08:00"
target_version: "下一個預覽版（`0.8.1-pre.2`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-233；D453（使用者：兩件事開單）；T0950（`leaveLeftoverAltScreen`，`new-pty-spawned`）；T0947（`resetLeftoverMouseTracking`）；T0955（A-23：Windows 游標看得到）；T0956（同時派工）"
affects_files:
  - _ct-workorders/T0957-restart-restore-hidden-cursor.md
  - src/lib/mouse-tracking-reset.ts
  - src/lib/pty-replay.ts
  - src/components/TerminalPanel.tsx
  - src/lib/__tests__/
  - src/__tests__/
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
  - "🔴 分支：只在 `ct/T0957` 寫檔（base = 派工當下的 `main`，已含 T0947 / T0950）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。T0956 同時在跑（`WorkspaceView.tsx` / 登入導引 / 遠端工具安裝），本單盡量不動那些檔。"
  - "🔴 現象（BUG-233）：T0950 以真 xterm 5.5.0 實測 `?1049l` 不還原 DECTCEM；舊程式送過 `ESC[?25l` 後被 ⏻ 結束，新 PTY 的 shell 若不送 `?25h`（WSL / SSH / macOS / Linux 的 bash），游標維持隱藏。T0955 在 Windows 實測看得到（ConPTY 新 shell 會送）。先查證：真 xterm 重現「隱藏 → ⏻ → 新 PTY（不送 `?25h`）→ 仍隱藏」，再改；推測不成立 → 問塔台。可行時以 WSL（本機有 WSL 才做，沒有就略過並寫明）實測 bash 是否送 `?25h`。"
  - "🔴 範圍：與 T0950 同一時機（`new-pty-spawned`，`restartOrCreatePty` restart 成功、`createPtyWithReplay` `created: true`），xterm 的游標隱藏時在本機 xterm 寫 `ESC[?25h`（同 T0947 / T0950：🔴 只寫 xterm、不寫 PTY）。判斷讀 xterm 的游標狀態（例：`terminal.modes` / 內部 `isCursorHidden`，讀不到即不動、記一行），唯一實作放 `src/lib/mouse-tracking-reset.ts`（與 `leaveLeftoverAltScreen` 同檔，可合成一個「新 PTY 前清殘留模式」的函式或分開，回報區寫理由）；consumer 只接線。"
  - "🔴 不變：游標沒隱藏、`created: false`（PTY 還在跑）、程式執行中、一般 shell 分頁沒有殘留時一律不寫 xterm；T0947 / T0950 / T0672 既有行為與測試不改且通過；不碰 bracketed paste / focus / DECCKM（T0950 判定影響小）。"
  - "🔴 測試：真 xterm 實例：隱藏游標 → ⏻ → 新 PTY → 游標看得到；未隱藏 → 不寫；`created: false` / 失敗 → 不動；與 alt screen 同時殘留時兩者都處理且順序正確；升級 xterm 時必跑的既有真 xterm 測試不改且通過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實機寫〈待實機〉（WSL / Linux 分頁 ⏻ 後游標看得到），不碰安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/terminal-context-menu.md` 的 T0950 節補游標；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」節只在需要時補一句，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0957 — ⏻ 後還原被隱藏的游標（BUG-233）

## 背景

T0950 讓 ⏻ 後離開殘留的 alt screen，但 `?1049l` 不還原舊程式隱藏的游標；Windows 新 shell 會自己顯示游標（T0955 實測），WSL / SSH / macOS / Linux 的 bash 不會，⏻ 後游標可能看不見（BUG-233）。使用者裁示開單（D453）。

## 範圍

- 真 xterm 重現；可行時 WSL 實測。
- 與 T0950 同一時機，游標隱藏時只在本機 xterm 顯示游標。

## 不做

- 不寫 PTY、不處理其他殘留模式、不改程式執行中的行為。

## 驗收

- [ ] 回報區有查證（含 WSL 實測或略過原因）
- [ ] 真 xterm 測試：隱藏 → ⏻ → 看得到；其他情況不動；既有測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
