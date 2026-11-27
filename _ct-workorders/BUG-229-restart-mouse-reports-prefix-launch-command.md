---
schema_version: 1
schema_kind: bug
id: BUG-229
title: "⏻ 重啟 claude 分頁：舊 claude 留下的滑鼠追蹤沒關，滑鼠回報被打進新 shell 並黏在 claude 啟動命令前面，claude 沒有啟動"
status: FIXED
severity: medium
reproducibility: "使用者實機一次（A-16）；推測：⏻ 時舊 claude 開著滑鼠追蹤、重啟期間滑鼠在分頁上移動"
created_at: "2026-11-27T20:47:56+08:00"
updated_at: "2026-11-27T21:09:24+08:00"
impact:
  - claude-cli
  - tower-tab
  - terminal-restart
links:
  discovered_in: "A-16（`v0.8.0` 實機驗收，T0944，D429）"
  related: [T0944, BUG-228, BUG-166, T0672, T0539, D429]
---
# BUG-229 — ⏻ 重啟後滑鼠回報黏在 claude 啟動命令前面

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（⏻ 重啟 claude 分頁後 claude 沒有啟動，分頁停在 bash，而且滑鼠一動就繼續打入亂碼） |
| 可重現 | 使用者實機一次；條件待 Worker 查證 |
| **狀態** | ✅ FIXED（T0947 `6e58f168`，經 T0948 合併進 `main` `dc37842c`，D437；待發版實機驗收） |
| 回報者 | 使用者 A-16 實機驗收（截圖，2026-11-27 20:47） |
| 影響版本 | `v0.8.0`（⏻ 重啟路徑既有；是否 T0944 前就有待查） |

## 現象（預期 vs 實際）

- 預期：「以塔台開啟 Claude」的分頁按 ⏻ 重啟，新的 claude 啟動並帶 `/control-tower`（A-16）。
- 實際（Windows、分頁 shell 是 Git Bash／UCRT64，塔台分頁 `82f1e7f0…`）：
  - 新 shell 的第一行命令是一串 `35;77;25M35;78;25M…;22M` 緊接著 `'C:\Users\<使用者資料夾>\.local\bin\claude.exe' '--mcp-config=…' … /control-tower`。
  - bash 以 `;` 切開，逐段回 `35: command not found`、`25M35: command not found`……，最後 `22MC:\Users\…\claude.exe: No such file or directory`，claude 沒有啟動。
  - 之後的提示列又出現 `35;85;22M35;84;…`：滑鼠追蹤仍開著，滑鼠在分頁上移動就持續把回報打進 shell。
  - BAT 查詢：該分頁 `role: shell`、`agentStarted: false`、`claudeSessionId: null`。
- `35;x;yM` 是 SGR 滑鼠移動回報（`ESC [ < 35 ; x ; y M`，`ESC [ <` 被 readline 吃掉）。

## 根因（塔台推測，待 Worker 確認）

1. 舊 claude 被 ⏻ 結束時沒有（也沒機會）關掉滑鼠追蹤；新 PTY 沿用同一個 xterm，`mouseTrackingMode` 仍是開著，滑鼠移動時 xterm 把回報寫進新 PTY。
2. 這些回報在 claude 啟動命令寫入之前進了 bash 的輸入列，於是黏在命令前面。helper 派工有 `holdInputForDispatch` / `writeDispatchCommand`（BUG-151）把先打的輸入移到命令之後，⏻ 重啟（`restartOrCreatePty` → `startClaudeCliPty`）可能沒有。
3. T0672（BUG-166）的 `MouseReportEchoDetector` 應在 shell 回顯回報時以 DECRST 關閉追蹤，這次沒有作用，原因待查（回顯形式不同、或 ⏻ 後沒有接上）。

## 已知的暫時做法

- 分頁右鍵「重設滑鼠模式」（T0672）後再 ⏻；或 ⏻ 時不要讓滑鼠在分頁上移動。

## 修正紀錄

- 2026-11-27 20:47 開單（OPEN，D429）
- 2026-11-27 20:49 → FIXING（T0947，U-37：A，D430）
- 2026-11-27 21:09 → FIXED：三點根因皆查證成立（⏻ 不重新掛載 xterm、強制結束的 claude 沒送 DECRST；啟動命令在 `pty:create` 後 500 ms 才寫，期間回報進了輸入列；`MouseReportEchoDetector` 是回顯晚於時間窗，不是缺陷）。新 PTY 在同一 xterm 開始前後只在本機 xterm 重設殘留的滑鼠追蹤（`resetLeftoverMouseTracking`，`src/lib/mouse-tracking-reset.ts`）。經 T0948 合併進 `main` `dc37842c`（D437）。待發版後重驗 A-16。
