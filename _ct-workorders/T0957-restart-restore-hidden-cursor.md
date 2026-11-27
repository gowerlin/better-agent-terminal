---
schema_version: 1
schema_kind: workorder
id: T0957
title: "BUG-233：⏻ 重啟後若舊程式留下隱藏的游標，新 PTY 開始時在本機 xterm 顯示游標（沿用 T0950 的時機）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:38:19+08:00"
updated_at: "2026-11-27T22:46:22+08:00"
started_at: "2026-11-27T22:40:01+08:00"
completed_at: "2026-11-27T22:46:22+08:00"
session_ids:
  - "203c99ec-0b0e-4863-b1c6-aef4dae85883"
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

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T22:46:22+08:00
- **session_id**：203c99ec-0b0e-4863-b1c6-aef4dae85883
- **摘要**：推測成立（真 xterm 重現＋WSL bash 實測不送 `?25h`）。新增 `showLeftoverHiddenCursor`，與 T0950 同一時機、緊接 `leaveLeftoverAltScreen` 之後，游標隱藏時只在本機 xterm 寫 `ESC[?25h`；驗證全綠。

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：`affects_files` 的程式 / 文件路徑都存在 → PASS
- C-2：工單沒有 `branch` 欄位，不適用
- `CT_HOME` 已設定；`CT_WORKTREE_BRANCH` = `ct/T0957`；`BAT_WORKSPACE_ID` 已設定（只記錄、不比對）；`BAT_REMOTE_TOKEN` 已設定

### 查證

1. **真 xterm 5.5.0 重現**（`src/lib/__tests__/cursor-restart.test.ts`「the bug, as a real xterm sees it」）：TUI `?1049h …?25l` → `?1049l`（T0950 寫的）→ WSL bash 啟動輸出（`?2004h`＋OSC 0 標題＋提示列）→ `_core.coreService.isCursorHidden` 仍為 `true`；不用 alt screen 只送 `?25l` 的程式也一樣。
2. **WSL 實測**（本機有 Ubuntu-24.04）：在 WSL 以 `script -q -c "<cmd>"` 起 `bash -i` 與 `bash -l -i`，`TERM=xterm-256color` / `xterm` 共 4 種組合，送 `exit` 前錄下 bash 寫出的原始位元組：4 種都只有 `ESC[?2004h`、`ESC]0;…BEL` 標題與提示列，**沒有** `ESC[?25h`、`ESC[?12;25h`，也沒有 `ESC[?25l`。⇒ 非 Windows 的 bash 不會自己顯示游標，BUG-233 的推測成立。Windows 看得到（T0955 A-23）是 ConPTY 重畫時送的。
3. 公開 API 沒有游標可見度：`terminal.modes`（xterm 5.5.0 typings）沒有 DECTCEM 欄位，所以讀內部 `_core.coreService.isCursorHidden`（同 T0698 讀 `_core.coreMouseService.activeEncoding` 的做法），讀不到回 `undefined` → 不動、記一行。

### 實作

- `src/lib/mouse-tracking-reset.ts`：
  - `CURSOR_SHOW` = `'\x1b[?25h'`。
  - `xtermCursorHidden(terminal)`：讀 `_core.coreService.isCursorHidden`，不是布林值就回 `undefined`。
  - `LeftoverMouseTrackingView` 多兩個選用方法 `cursorHidden?()` / `showCursor?(done)`。
  - `showLeftoverHiddenCursor(id)`（唯一實作）：沒有 view、view 沒登記 `showCursor`、`cursorHidden()` 不是 `true`（含 `undefined`）→ 不動、回 `false`；否則 `showCursor`，等解析完最多 `LEFTOVER_MOUSE_RESET_WAIT_MS`，回 `true`。
- `src/lib/pty-replay.ts`：`createPtyWithReplay`（`created: true`）與 `restartOrCreatePty`（restart 成功）在 `void leaveLeftoverAltScreen(id)` 下一行加 `void showLeftoverHiddenCursor(id)`。xterm 依收到的順序解析：先 `?1049l` 再 `?25h`，都在新 shell 第一段輸出之前（理由同 T0950：create 回應先到、輸出 16 ms 批次）。
- `src/components/TerminalPanel.tsx`：只接線。登記 `cursorHidden`（`xtermCursorHidden(terminal)`，`undefined` 時記 `[mouse-tracking] cursor state unknown: new-pty-spawned terminal=<id>`）與 `showCursor`（`terminal.write(CURSOR_SHOW, done)`＋`[mouse-tracking] cursor shown: new-pty-spawned terminal=<id>`）。
- **為什麼和 `leaveLeftoverAltScreen` 分開**：兩種殘留彼此獨立（不用 alt screen 的 TUI 也會隱藏游標；在 alt screen 被結束的程式可能已經顯示游標），各自判斷、各自記日誌；T0950 的呼叫、函式與測試完全不動（合成一個函式會改動 T0950 的呼叫點與既有斷言）。

### 不變（核對）

- 游標沒隱藏、讀不到、`created: false`、create / restart 失敗、程式執行中、`before-new-pty`：都不寫 xterm（測試覆蓋）。
- 不寫 PTY（TerminalPanel 測試斷言 `ptyWrite` 沒被呼叫）。
- 不碰 bracketed paste / focus / DECCKM。
- T0947 / T0950 / T0672 的既有測試**一行未改**、全部通過；`src/__tests__/terminal-context-menu.test.tsx` 只在 xterm stub 加 `_core.coreService.isCursorHidden`（預設 `false`，既有測試行為不變）並在檔尾新增一個 describe。

### 測試

- 新增 `src/lib/__tests__/cursor-restart.test.ts`（真 xterm 5.5.0，19 項）：bug 重現 2 項；`xtermCursorHidden` 讀值（`?25l` / `?25h`）與其他版面 `undefined`；隱藏 → 顯示；未隱藏 / 沒 view / 未登記 / 讀不到不寫；只影響自己的 id；等待上限；程式執行中不動；`restartOrCreatePty` restart 成功：呼叫順序 `reset:before-new-pty` → `leave-alt` → `show-cursor`，xterm 寫入順序 `?1049l` 先於 `?25h`，新 bash 輸出後仍看得到；新 shell 之後的程式再 `?25l` 照常隱藏；restart → false 改 create 只顯示一次；一般 shell 不寫 xterm；restart 失敗不動；`createPtyWithReplay` created / not created / failed。
- `src/__tests__/terminal-context-menu.test.tsx` 新增「hidden cursor shown when a new PTY starts (T0957)」4 項：隱藏 → 只寫 xterm＋日誌；可見 → 不寫不記；讀不到 → 不寫、記一行；卸載後不可達。

### 驗證（皆於 `validated_sha` 執行）

- worktree `npm ci`：exit 0（749 packages；`electron-winstaller` install script 被擋屬預期）。
- `npm run test:unit`（head 第一次完整執行）：exit 0，**Test Files 520 passed | 3 skipped (523)；Tests 9414 passed | 47 skipped (9461)**，72.84 s。
- `npm run typecheck`：exit 0（= 0 個錯誤）。
- `npx vite build`：exit 0（在 test:unit 跑完後才執行）。

### 待實機

1. 在 WSL（或 Linux / macOS / SSH）分頁啟動一個會隱藏游標的全螢幕程式（例 claude 或 `vim`），不讓它正常結束，按分頁的 ⏻。
2. 預期：新 shell 的提示列有游標（修正前看不到）；debug log 有 `[mouse-tracking] cursor shown: new-pty-spawned terminal=<id>`（在 alt screen 時前一行是 `alt screen left`）。
3. 一般 shell 分頁（沒有隱藏游標）按 ⏻：不出現 `cursor shown` / `cursor state unknown` 日誌。
4. Windows Git Bash / pwsh 分頁同樣操作：游標照常看得到（T0955 A-23 不回歸）。
- 不碰安裝版 BAT。

### 文件

- `docs/agent-guide/terminal-context-menu.md`：T0950 節「查證但沒有處理」改指向 T0957；新增「殘留的隱藏游標（T0957 / BUG-233，D453）」子節（現象、查證、修正、順序、分開理由、不變、升級 xterm 必跑的測試）；驗證段落補 T0957 測試。
- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤」節：T0950 那句之後補一句（唯一實作、讀內部欄位、升級 xterm 必跑），小節標題不改。

### 異動檔案

- `src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`、`src/components/TerminalPanel.tsx`
- `src/lib/__tests__/cursor-restart.test.ts`（新增）、`src/__tests__/terminal-context-menu.test.tsx`
- `docs/agent-guide/terminal-context-menu.md`、`CLAUDE.md`

### Commit 與 SHA

- `branch`：`ct/T0957`
- `base_sha`：`39557f4aae078ad11fe648ab0afeaca7d4f283f2`
- `validated_sha`：`165057fc6e1253de549ea3c49cf86cfec73cd6e6`
- `head_sha`：`165057fc6e1253de549ea3c49cf86cfec73cd6e6`（= validated_sha）
- product commit：`165057fc` `fix(terminal): T0957 show the cursor a killed program hid when a new PTY starts (BUG-233)`
- 收單前 `git -C "$CT_WORKTREE" status --porcelain` 為空；未 push、未觸發 workflow、未建 tag。

### 遭遇問題

- 寫 docs 時用 heredoc 傳給 Python，`\\x1b` 被收成 ESC 字元寫進檔案（R-G005 第 3 點的情況）；已以 `chr(92)` 改回文字 `\x1b` 並以位元組讀回確認（docs 0 個 ESC、所有異動檔 0 個 CRLF）。
- 開工的工單 commit（主 checkout `e9fec6bb`）漏了 Co-Authored-By 行，不影響內容。

### 互動紀錄

- [22:40] 開工，yolo、無塔台補充；全程未向塔台提問。

### 後續建議

1. BUG-233 可依 D453 流程改 `FIXED`，實機驗收（〈待實機〉1–4）後 `CLOSED`。
2. 同類殘留（bracketed paste 2004、focus 1004、DECCKM）仍未處理，T0950 判定影響小；若實機遇到再開單，可沿用同一個 view／時機模式。
