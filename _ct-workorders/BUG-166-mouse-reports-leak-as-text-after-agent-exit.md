---
schema_version: 1
schema_kind: bug
id: BUG-166
title: "Agent 結束後的分頁，滑鼠移動 / 滾輪被當成文字輸入 shell（SGR 滑鼠回報殘留）"
status: OPEN
severity: medium
reproducibility: sometimes
created_at: "2026-10-19T15:52:11+0800"
updated_at: "2026-10-19T15:52:11+0800"
impact:
  - terminal-input
  - mouse-tracking
  - codex
links:
  discovered_in: "Gary 回報（2026-10-19 15:50，v0.7.1-pre.3，附兩張截圖）"
  related: [BUG-165, BUG-142, T0568, T0571, T0573, T0670, T0671]
---

# BUG-166 — Agent 結束後的分頁，滑鼠回報變成 shell 輸入的文字

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（垃圾字元進 shell 命令列；若接著按 Enter 會被當成命令執行） |
| 可重現 | 有時（Gary：「有時會一直不斷產生」） |
| **狀態** | 📂 OPEN（T0671 研究） |
| 回報者 | Gary（使用者轉達，附截圖） |

## 現象

- 15:50 Gary：「點到已經完成的工單 session，有時會一直不斷產生這個文字」。
- 截圖（使用者本機 scratchpad，未入庫；含客戶專案路徑，引用時去識別化）：zsh（powerlevel10k）提示列後面不斷出現
  `35;52;69M35;55;66M35;57;64M…64M39;3;64M` 這類字串，且持續增長。
- 預期：Agent（codex）結束、回到 shell 後，滑鼠移動 / 滾輪不應送任何東西進 PTY（或只由 BAT 處理捲動）。

## 塔台初判（推論，待 T0671 證實）

- 字串是 **SGR 滑鼠回報**（`ESC [ < Cb ; Cx ; Cy M`）去掉 `ESC [ <` 前綴後的殘骸：`35;x;y` = 無按鍵的滑鼠移動（any-event tracking，DECSET 1003）、`64;x;y` / `65;x;y` = 滾輪。
- 推論：TUI（codex）開了滑鼠追蹤（1003 + 1006），結束時沒有關掉（或異常結束），xterm 仍在追蹤模式；之後滑鼠在分頁上移動就把回報寫進 shell，zsh 吃掉 `ESC [ <`、其餘當文字插入。
- 待查：是否 BAT 自己在某些情況重新開啟追蹤（T0571 / T0573 的 `registerCsiHandler` 偵測重送的追蹤 DECSET、`MouseReportSelectionKeeper`、`SelectionDrag.resume()`）；是否只在 macOS。
- 與 BUG-165 的關係：codex 用 any-event 滑鼠追蹤時，每次滑鼠移動都送回報給 codex，可能也影響捲動順暢度。

## 待確認（給 Gary）

1. 該分頁的 agent 是 codex 嗎？是 Worker 做完後 codex 自己結束，還是被中斷 / 關掉？
2. 出現亂碼時，在該分頁執行 `printf '\e[?1000l\e[?1002l\e[?1003l\e[?1006l'` 後是否就停止？（確認是追蹤模式殘留）
