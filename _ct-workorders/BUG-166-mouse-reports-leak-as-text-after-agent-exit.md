---
schema_version: 1
schema_kind: bug
id: BUG-166
title: "Agent 結束後的分頁，滑鼠移動 / 滾輪被當成文字輸入 shell（SGR 滑鼠回報殘留）"
status: OPEN
severity: medium
reproducibility: sometimes
created_at: "2026-10-19T15:52:11+0800"
updated_at: "2026-10-19T17:30:20+0800"
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
| **狀態** | 📂 OPEN（T0671 研究 DONE `58dc95d4`：codex 0.163 **只有被訊號結束**（SIGINT / TERM / HUP / KILL）時不還原滑鼠追蹤與 alt screen；BAT 不開也不保留追蹤；Unix PTY 跨平台、Windows 原生 ConPTY 無殘骸；建議 F1 + F2（S），待使用者決定） |
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

## T0671 研究結論（2026-10-19，DONE `58dc95d4`；細節見工單回報區）

- 【實測】初判成立並補條件：codex-cli 0.163.0 以 `/quit`、Ctrl+C、Ctrl+D、Ctrl+Z 離開都會還原；**收到 SIGINT / SIGTERM / SIGHUP（原生或 node 包裝）或 SIGKILL 時不送任何還原**，xterm 停在 `mouseTrackingMode=any` + alt screen（1004 / 2004 也殘留）。zsh 5.9 實測產生與 Gary 截圖相同的字串。
- 【原始碼】BAT 只讀 `mouseTrackingMode`，不寫任何滑鼠 DECSET / DECRST；`registerCsiHandler` 回 `false`、`SelectionDrag.resume()` 不送回報 ⇒ BAT 不是原因，但目前也沒有任何重設機制。
- 【實測】Claude CLI 2.1.303：inline renderer 不開滑鼠追蹤；fullscreen 會開，但 `/exit`、Ctrl+C ×2、Ctrl+Z、SIGTERM、SIGHUP 都還原，只有 SIGKILL 殘留。
- 平台：Unix PTY 跨平台（macOS / Linux / WSL / SSH / Docker；BAT 的 WSL 分頁實測重現）；Windows 原生 ConPTY（pwsh 內跑 codex.exe / claude.exe）不會出現殘骸（conhost 吃掉回報）。
- 辨識特徵：被訊號結束的分頁回到 shell 後仍在 alt screen，往上捲看不到 codex 對話。
- 修正提案：**F1**（S）偵測 SGR 回報被回顯成文字 → 只在本機 xterm 送 DECRST 關掉追蹤（不寫 PTY）、記日誌；**F2**（S）右鍵選單「重設滑鼠模式」。F1 需在 CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」節補一句例外。F4：向 codex 上游回報訊號不還原終端（使用者決定）。不推薦 OSC 7501 `clear` 或提示列觸發（殘留情況不會送 `clear`；BAT 無 OSC 133）。
- 與 BUG-165：codex 對無按鍵移動回報不重繪（0 bytes），any-event 追蹤不是捲動不順的主因。
- 2026-10-19 17:30 使用者決策：修正先等 Gary 回覆（codex 怎麼結束、往上捲是否看得到對話）再決定；不向 codex 上游回報（F4）。

## Gary 回覆（2026-10-19 17:28–17:29，使用者轉達）

- 「我其實沒有動他耶，我就切過去那個 session，他就已經變成 terminal 命令列了，自己跳開的」→ codex 不是正常退出（正常退出會還原），符合 T0671「被訊號結束 / 崩潰」的條件；是誰結束 codex（記憶體壓力、崩潰、其他程序）未知。
- 「有空再排吧，不急著修」「我覺得這小問題」→ 不急，排程時再派 F1 + F2。
