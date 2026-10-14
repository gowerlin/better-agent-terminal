---
schema_version: 1
schema_kind: bug
id: BUG-135
title: "detached 視窗關閉、父視窗取回終端清單時，focus fallback 取全域 terminals[0]，可能指向其他工作區的終端"
status: FIXING
severity: low
reproducibility: unknown
created_at: "2026-10-15T01:32:28+0800"
updated_at: "2026-10-15T01:32:28+0800"
impact:
  - detached-window
  - terminal-focus
links:
  discovered_in: "T0531 回報區「偏差 / 備註」後續建議"
  fix_workorder: T0532
  related: [BUG-134, T0531]
---

# BUG-135 — adoptDetached focus 跨工作區

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（focus 指錯對象：snippet 貼上、Skills / Agents 面板等讀 `focusedTerminalId` 的功能會作用到別的工作區終端） |
| 可重現 | 未確認（程式碼證據，T0531） |
| **狀態** | 🔧 FIXING（T0532） |
| 回報者 | T0531 Worker |

## 現象

`src/stores/workspace-store.ts` 的 detached 終端清單取回路徑（`adoptDetached` / `adoptDetachedWorkspaceTerminals` 一帶，T0531 回報約 L908）在需要重設 focus 時 fallback 到**全域** `terminals[0]`，與 BUG-134 修正前的 `removeTerminal()` 同類。

## 預期

focus fallback 限定在 active 工作區（或被取回的工作區，依語意判斷）內；沒有則 `null`。
