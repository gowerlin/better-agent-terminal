---
schema_version: 1
schema_kind: bug
id: BUG-145
title: "新分頁的 PTY 有時停在建立時的尺寸（120x30），xterm 已 fit 成較寬的欄數，要按重繪才同步"
status: FIXING
severity: low
reproducibility: intermittent
created_at: "2026-10-16T22:12:44+0800"
updated_at: "2026-10-16T22:12:44+0800"
impact:
  - terminal-resize
  - pty
links:
  discovered_in: "T0571 e2e 觀察（隔離實例，2026-10-16）"
  related: [T0571, T0572]
---

# BUG-145 — 新分頁 PTY 停在建立時的尺寸

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（推測：TUI 依錯的欄數排版、折行錯位；按工具列重繪可恢復） |
| 可重現 | 偶發（T0571 e2e 隔離實例觀察；真實使用者情境未確認） |
| **狀態** | ⏳ FIXING（T0572：先確認再修） |
| 回報者 | T0571 Worker 觀察，塔台開單 |

## 現象

- T0571 的 e2e：隔離實例新分頁的 PTY 有時停在 spawn 尺寸 120x30，xterm 已經 fit 成 137 欄。
- spec 以工具列的 `terminal-redraw`（重送尺寸、PTY 收到 SIGWINCH）繞過後，座標才正確（`e2e/t0571-shift-right-click-copy.spec.ts` 約第 106 行）。
- Worker 判斷為「啟動時的 resize 競態」，不在 T0571 範圍，未處理。

## 期望

- 新分頁（含還原、重啟、外部建立的分頁）的 PTY 尺寸在 xterm 第一次 fit 之後與 xterm 一致，不需要使用者按重繪。

## 待確認

- 是否只在隔離實例 / e2e 發生，還是真實使用者也會遇到（例如 Terminal Server 模式下 `pty:create` 尚未完成時送出的 `pty:resize` 被丟掉）。
