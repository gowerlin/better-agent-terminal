---
schema_version: 1
schema_kind: bug
id: BUG-232
title: "登入導引分頁與遠端工具安裝：新終端起來到命令寫入前使用者打的字，會黏在命令前面（BUG-231 未涵蓋的兩條路徑）"
status: FIXED
severity: low
reproducibility: "推測必定：開登入導引分頁或執行遠端工具安裝後、命令寫入前立刻打字（T0951 查證時發現，未實機重現）"
created_at: "2026-11-27T22:38:19+08:00"
updated_at: "2026-11-27T22:55:01+08:00"
impact:
  - terminal-launch
  - remote-tools
links:
  discovered_in: "T0951 回報區〈後續建議〉1（D444）"
  related: [BUG-231, T0951, BUG-151, T0956, D453]
---
# BUG-232 — 登入導引分頁與遠端工具安裝的命令前輸入

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（要在命令寫入前很短的時間內打字才會發生） |
| 可重現 | 推測必定，未實機重現 |
| **狀態** | ✅ FIXED（T0956 `137e7b6e`，經 T0958 合併進 `main` `8ed38794`，D460；待發版驗收） |
| 回報者 | T0951 Worker 查證時發現；使用者裁示開單（2026-11-27 22:38） |
| 影響版本 | `v0.8.1-pre.1`（既有） |

## 現象（預期 vs 實際）

- T0951（BUG-231）把 renderer 的 11 處 agent 啟動命令改經 `sendLaunchCommand`，新終端建立時就開始保留使用者輸入，命令寫完再依序送出。
- 另外兩個 renderer 寫入點不屬於 agent 啟動命令、當時未納入：登入導引分頁（`openClaudeLoginTerminal`，只打字不送 Enter）與遠端工具安裝（`useRemoteToolInstall`）。這兩條路徑在 create 之後才寫命令，同一時間窗打的字會接在命令前面。

## 修正紀錄

- 2026-11-27 22:38 開單 → FIXING（T0956，D453）
- 2026-11-27 22:55 → FIXED：查證成立（兩條路徑都在 `pty:create` 後 500 ms 寫命令）。兩個模組的 deps 多選填 `sendLaunchCommand`，建立時帶 `holdInputUntilLaunch`、命令經 `pty:launch-command` 送；登入命令照舊不送 Enter；T0951 共用實作與 `electron/**` 產品碼未改；舊 bat-server fallback 不變。經 T0958 合併進 `main` `8ed38794`（D460）。
