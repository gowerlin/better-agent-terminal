---
schema_version: 1
schema_kind: bug
id: BUG-143
title: "終端分頁的 BAT 右鍵選單在終端有焦點時按 Esc 關不掉（只能點外部）"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-16T17:47:20+0800"
updated_at: "2026-10-16T17:47:20+0800"
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
| **狀態** | 🔴 OPEN（T0569 修正中；與 BUG-142 同批發版） |
| 回報者 | T0568 Worker 觀察，使用者決定開單 |

## 現象

- xterm 分頁右鍵打開 BAT 的 複製 / 貼上 選單後，終端（xterm 的 textarea）仍有焦點，按 Esc 選單不關閉。
- 預期：Esc 關閉選單（BUG-011a 原本的設計）。

## 推測根因（T0568 Worker 觀察，待 T0569 確認）

- Esc 先進 xterm 的 textarea，xterm 處理按鍵時 `stopPropagation`，`src/components/TerminalPanel.tsx` 在 `document` 上的 BUG-011a listener（「Close context menu on Escape key」）收不到。
- 另需確認：Esc 是否同時被送進 PTY（例如 claude CLI 收到 Esc 會中斷）；選單開著時按 Esc 應只關選單。
