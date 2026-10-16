---
schema_version: 1
schema_kind: bug
id: BUG-142
title: "claude CLI 分頁按滑鼠右鍵：已經貼上，同時又跳出 BAT 的「貼上」右鍵選單（重複、不合理）"
status: OPEN
severity: low
reproducibility: likely
created_at: "2026-10-16T17:31:58+0800"
updated_at: "2026-10-16T17:31:58+0800"
impact:
  - terminal-context-menu
  - terminal-input
links:
  discovered_in: "使用者回報（第六十八 session，本機 BAT 0.6.1-pre.6，塔台分頁 claude CLI 2.1.300）"
  related: [T0568]
---

# BUG-142 — claude CLI 分頁右鍵同時貼上又跳選單

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（功能可用，但多一個多餘的選單；若再點選單的「貼上」會貼兩次） |
| 可重現 | 推測可重現（使用者回報；只在 claude CLI 分頁看過） |
| **狀態** | 🔴 OPEN（T0568 修正中） |
| 回報者 | 使用者（截圖：claude CLI 輸入框、右鍵後出現只有「貼上」一項的 BAT 選單） |

## 現象

- claude CLI 分頁（塔台分頁，claude 2.1.300）在輸入框按右鍵：剪貼簿內容**已經貼上**，同時 BAT 的右鍵選單（只有「貼上」，因為沒有選取）也出現。
- 一般 PowerShell / bash 分頁：使用者沒看過此問題。

## 期望（使用者 2026-10-16 選定）

- **分頁內的程式自己處理右鍵時（例如 claude CLI 開了滑鼠模式並自己貼上），BAT 不再疊一層選單。**
- 一般 shell 分頁照舊：右鍵顯示 BAT 的 複製 / 貼上 選單。

## 推測根因（未驗證，交給 T0568 確認）

- BAT 的 `contextmenu` 處理（`src/components/TerminalPanel.tsx`，`containerRef` 上的 listener）只 `setContextMenu`，本身**不會**貼上。
- 貼上應來自 claude CLI：它的 TUI 開了滑鼠追蹤（DECSET 1000 / 1002 / 1003 + 1006），xterm 把右鍵送成滑鼠回報給 PTY，claude CLI 收到右鍵自己讀剪貼簿貼上。同一個右鍵的 DOM `contextmenu` 事件仍觸發 BAT 選單 → 兩邊都動作。
