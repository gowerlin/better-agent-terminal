---
schema_version: 1
schema_kind: workorder
id: T0571
title: "BUG-144：滑鼠追蹤開啟的分頁（claude CLI）選取文字後 Shift + 右鍵，BAT 選單要有「複製」"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-144
priority: P2
sizing: S
created_at: "2026-10-16T21:48:35+0800"
updated_at: "2026-10-16T21:48:35+0800"
target_version: "0.6.1-pre.8（未排發版）"
depends_on: []
related:
  - "BUG-144（現象：直接拖曳與 Shift + 拖曳兩種選法，Shift + 右鍵都只有「貼上」）"
  - "BUG-142 / T0568（Shift + 右鍵照開選單的設計，`src/lib/terminal-context-menu.ts`）；BUG-143 / T0569（同一個選單的 Esc）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - "src/__tests__/terminal-context-menu.test.tsx"
  - "e2e/t0568-context-menu-mouse-tracking.spec.ts 或新的 e2e/t0571-*.spec.ts"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤」一節，簡短補充）"
  - _ct-workorders/T0571-shift-right-click-copy-in-mouse-tracking-tab.md
  - _ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報；不改 T0568 的「不按 Shift 的右鍵在追蹤模式下不開選單」與 T0569 的 Esc 行為。"
---

# T0571 — BUG-144：Shift + 右鍵選單沒有「複製」

## 背景

T0568 讓滑鼠追蹤開啟的分頁（claude CLI 2.1.300 開 1000 / 1002 / 1003 / 1006）右鍵不開 BAT 選單，Shift + 右鍵照開，回報區寫「追蹤模式下 xterm 要用 Shift + 拖曳才能選取，接著 Shift + 右鍵就會出現「複製 / 貼上」」。但這條路徑沒有測試覆蓋（元件測試只測追蹤關閉時的「複製」，e2e 的 Shift 案例沒有選取）。

pre.7 實機（本機 Windows，claude CLI 分頁）：反白文字後 Shift + 右鍵，選單只有「貼上」。使用者**直接拖曳**與**Shift + 拖曳**兩種選法都試過，結果相同。

## 任務

1. **先重現並找根因**（隔離實例；node 腳本開 1000 / 1002 / 1003 / 1006 模擬 TUI，必要時再加週期重繪或 alt screen，接近 claude 的行為；不耗額度的話也可用內嵌 claude 實測）：
   - Shift + 拖曳後，`terminal.getSelection()` / `hasSelection()` 在拖曳結束、Shift + 右鍵 mousedown、`contextmenu` 三個時間點各是什麼
   - 選取是否被 Shift + 右鍵的 mousedown、程式重繪、focus report 或其他事件清掉；或 Shift + 拖曳在追蹤模式下其實沒建立 xterm 選取
   - 直接拖曳（不按 Shift）時的反白是誰畫的：若是 claude 自己的選取（xterm 沒有選取），BAT 讀不到內容，請在回報區寫明，並確認 claude 自己怎麼複製這段選取（例如放開滑鼠即複製、或不按 Shift 的右鍵複製，T0568 回報區有二進位證據）
2. **修正**：Shift + 拖曳選取後 Shift + 右鍵 → 選單有「複製」，點下後剪貼簿 = 反白文字。做法由你依根因決定，例如在選取被清掉之前保存選取，或在 Shift + 右鍵時不讓 xterm 清掉選取。不得破壞：
   - 追蹤關閉的一般 shell：右鍵選單與「複製」照舊
   - 追蹤開啟、不按 Shift 的右鍵：不開選單，程式照常收到右鍵（T0568）
   - 選單開著時的 Esc（T0569）
   - 選單關閉、點外部、點「複製」後的選取狀態不留下過期內容（例如保存的選取不能在之後別的右鍵沿用）
3. **直接拖曳的情況**：若確認反白是 claude 自己的選取、BAT 拿不到，**不要**為了顯示「複製」去讀 claude 的畫面猜內容；在回報區給塔台一句結論與建議（例如 claude 自己已複製 / 右鍵即複製），塔台再決定要不要另外處理。
4. **測試**：元件測試補「追蹤開啟 + Shift + 有選取 → 選單有複製，點了寫入剪貼簿」，以及你找到的根因對應案例；e2e（隔離實例）：腳本開追蹤 → Shift + 拖曳選取 → Shift + 右鍵 → 選單有「複製」→ 點下後剪貼簿內容正確（macOS skip，同 T0568）。
5. BUG-144 狀態改 FIXED、填修正 commit；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」補一兩句。

## 驗收條件

- [ ] 根因有證據（含直接拖曳時反白來源的結論）
- [ ] 追蹤開啟的分頁 Shift + 拖曳後 Shift + 右鍵 → 選單有「複製」且複製內容正確；一般 shell、追蹤中不按 Shift、Esc 行為不變
- [ ] `npm run test:unit` 全綠（基線 4614 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] e2e（`t0568` 與新案例）通過，或說明做不到的原因
- [ ] BUG-144 → FIXED

---

## 回報區

> 以下由 sub-session 填寫
