---
schema_version: 1
schema_kind: workorder
id: T0569
title: "BUG-143：終端分頁的 BAT 右鍵選單開著時，按 Esc 關閉選單（終端有焦點也一樣），且該次 Esc 不送進 PTY"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-143
priority: P2
sizing: XS
created_at: "2026-10-16T17:47:20+0800"
updated_at: "2026-10-16T17:47:20+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.7（與 BUG-142 / T0568 同批，未排發版）"
depends_on: [T0568]
related:
  - "BUG-143；BUG-142 / T0568（同一個右鍵選單，`src/lib/terminal-context-menu.ts`）；BUG-011a（原 Esc 關選單設計）；T0567（Dialog Esc 統一，`src/components/common/modal-stack.ts`，右鍵選單不是 Dialog）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/terminal-context-menu.ts（若需要）"
  - "src/__tests__/terminal-context-menu.test.tsx 或新增測試"
  - "e2e/t0568-context-menu-mouse-tracking.spec.ts（可把點外部關選單改回 / 補上 Esc 案例）"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節補一句）"
  - _ct-workorders/T0569-terminal-context-menu-esc-closes.md
  - _ct-workorders/BUG-143-terminal-context-menu-esc-not-closing.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 T0568 的行為（滑鼠追蹤時不開選單、Shift + 右鍵照開）不變；選單沒開時 Esc 照常送進 PTY（claude CLI 的 Esc 中斷不得受影響）。"
---

# T0569 — BUG-143：終端右鍵選單按 Esc 關閉

## 背景

T0568 Worker 觀察：xterm 分頁打開 BAT 右鍵選單後，終端仍有焦點，按 Esc 關不掉選單。推測 Esc 先進 xterm textarea，xterm 處理按鍵時 `stopPropagation`，`TerminalPanel.tsx` 在 `document` 上的 BUG-011a listener 收不到（見 BUG-143）。

## 任務

1. **確認根因**（實際的事件路徑），以及選單開著時按 Esc 是否也被送進 PTY。
2. **修正**：選單開著時按 Esc → 只關選單、**不**送進 PTY；選單沒開時 Esc 行為完全不變。做法由你決定並在回報區說明（例：選單開啟時以 xterm `attachCustomKeyEventHandler` 攔下 Esc、或在 capture 階段處理、或打開選單時把焦點移到選單）。IME 組字中的 Esc 不當成關選單（比照 T0567）。
3. **測試**：單元 / 元件：選單開著 + 終端有焦點時 Esc 關閉且不寫 PTY；選單沒開時 Esc 照常寫 PTY。e2e：擴充 `e2e/t0568-context-menu-mouse-tracking.spec.ts` 或新增，在隔離實例以 Esc 關選單，並確認腳本 stdin 沒收到 `\x1b`。
4. BUG-143 → FIXED、填修正 commit；CLAUDE.md T0568 那節補一句。

## 驗收條件

- [ ] 根因有證據
- [ ] 選單開著時 Esc 關閉選單且不送進 PTY；選單沒開時 Esc 不變；T0568 行為不變
- [ ] `npm run test:unit` 全綠（基線 4606 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] BUG-143 → FIXED

---

## 回報區

> 以下由 sub-session 填寫
