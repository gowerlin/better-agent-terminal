---
schema_version: 1
schema_kind: bug
id: BUG-143
title: "終端分頁的 BAT 右鍵選單在終端有焦點時按 Esc 關不掉（只能點外部）"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-10-16T17:47:20+0800"
updated_at: "2026-10-16T21:48:35+0800"
fixed_at: "2026-10-16T17:53:35+0800"
closed_at: "2026-10-16T21:48:35+0800"
fix_commit: "fb66c0bc"
impact:
  - terminal-context-menu
links:
  discovered_in: "T0568 e2e（第六十八 session）"
  related: [T0569, BUG-142, T0568]
---

# BUG-143 — 終端右鍵選單按 Esc 關不掉

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（點選單外部仍可關閉） |
| 可重現 | 必現（T0568 e2e 觀察） |
| **狀態** | 🚫 CLOSED（2026-10-16 pre.7 實機：選單開著時 Esc 關閉且 claude 未中斷 PASS） |
| 回報者 | T0568 Worker 觀察，使用者決定開單 |

## 現象

- xterm 分頁右鍵打開 BAT 的 複製 / 貼上 選單後，終端（xterm 的 textarea）仍有焦點，按 Esc 選單不關閉。
- 預期：Esc 關閉選單（BUG-011a 原本的設計）。

## 推測根因（T0568 Worker 觀察；T0569 已證實，見下節）

- Esc 先進 xterm 的 textarea，xterm 處理按鍵時 `stopPropagation`，`src/components/TerminalPanel.tsx` 在 `document` 上的 BUG-011a listener（「Close context menu on Escape key」）收不到。
- 另需確認：Esc 是否同時被送進 PTY（例如 claude CLI 收到 Esc 會中斷）；選單開著時按 Esc 應只關選單。

## 根因與修正（T0569，2026-10-16）

- **根因證實**：
  - xterm 5.5.0 `Terminal._keyDown`（`src/browser/Terminal.ts`）：Escape 經 `evaluateKeyboardEvent` 得到 `ESC`，`coreService.triggerDataEvent` 寫進 PTY（BAT 的 `onData` → `pty.write`），之後 `cancel(event, true)` = `preventDefault` + `stopPropagation`。listener 掛在 xterm textarea 上，所以 `document` 的 BUG-011a listener 收不到。
  - 隔離實例探測（修正前的 build）：右鍵開選單後焦點為 `xterm-helper-textarea`；按 Esc → 選單仍在、node 腳本 stdin 收到 `"\u001b"`、window capture listener 收到 1 次、document bubble listener 0 次。⇒ 選單關不掉，且 Esc 已送進 PTY（claude CLI 會被中斷）。
- **修正**：`TerminalPanel.tsx` 的 `attachCustomKeyEventHandler`（xterm 處理按鍵前先呼叫）在選單開著時遇到 Esc → 關選單、`preventDefault` + `stopPropagation`、回 `false`（xterm 不寫 PTY）；判斷 `shouldCloseTerminalContextMenuOnKey`（`src/lib/terminal-context-menu.ts`）：IME 組字中（`imeComposing` / `isComposing` / keyCode 229）不算。選單沒開時 Esc 照常送進 PTY；焦點不在終端時仍由 `document` listener 關閉。
- 同一探測在修正後：選單關閉、stdin 無任何輸入。

## 實機驗收（2026-10-16 21:48，BAT 0.6.1-pre.7，使用者）

- 選單開著時按 Esc：選單關閉，claude CLI 沒有被中斷 → PASS
- → 🚫 CLOSED
