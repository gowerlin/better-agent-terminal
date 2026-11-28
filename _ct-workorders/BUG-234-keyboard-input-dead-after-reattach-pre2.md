---
schema_version: 1
schema_kind: bug
id: BUG-234
title: "`0.8.1-pre.2`：終端分頁鍵盤無法輸入（自動恢復後與全新啟動後新開的 Claude CLI / Codex CLI 都一樣），Enter 也沒反應；滑鼠右鍵貼上可用；新開的 Codex CLI 分頁一樣；退回 `0.8.1-pre.1` 正常"
status: FIXING
severity: high
reproducibility: "使用者實機（Windows 11，`0.8.1-pre.2` 安裝版）；確切條件待 T0963 查證"
created_at: "2026-11-28T11:09:41+0800"
updated_at: "2026-11-28T11:15:15+0800"
impact:
  - terminal-input
  - regression
links:
  discovered_in: "使用者回報（2026-11-28 第一百四十 session）"
  related: [T0963, T0956, T0957, T0951, BUG-231, BUG-232, BUG-233]
---
# BUG-234 — pre.2 自動恢復後鍵盤無法輸入

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（終端打不了字，只能用滑鼠貼上；使用者被迫退版） |
| 可重現 | 使用者實機；條件待查 |
| **狀態** | ⏳ FIXING（T0963） |
| 回報者 | 使用者（2026-11-28 11:09） |
| 影響版本 | `v0.8.1-pre.2`（`v0.8.1-pre.1` 正常） |

## 現象（預期 vs 實際）

- 預期：BAT 重開、自動恢復（接回終端）後，分頁照常可用鍵盤輸入。
- 實際（使用者原話）：「塔台 自動恢復後，鍵盤似乎無法輸入（滑鼠可剪貼簿貼上，但鍵盤 Enter 一樣無反應）；開一個新的 Codex CLI，狀況一樣；目前這則訊息是我退回 -pre.1 才能用」。
- 也就是：塔台分頁（接回的 claude）與新開的 Codex CLI 分頁都打不了字、Enter 沒反應；滑鼠貼上進得去。
- 補充（11:15）：全新啟動 BAT、新開 Claude CLI 分頁也一樣（不限於自動恢復）。
- 補充（11:18）：「但是 pwsh 終端沒問題」⇒ 一般 shell 分頁正常，只有 agent 分頁（Claude CLI / Codex CLI）打不了字。

## 線索（塔台整理，未查證）

- pre.1 → pre.2 的產品改動只有兩張：T0956（BUG-232，登入導引分頁與遠端工具安裝的啟動命令前保留輸入：`claude-login-guide.ts`、`install-runner.ts`、`useRemoteToolInstall.ts`、`WorkspaceView.tsx`、`pty-replay.ts`）與 T0957（BUG-233，新 PTY 開始時顯示殘留的隱藏游標：`mouse-tracking-reset.ts`、`pty-replay.ts`、`TerminalPanel.tsx`）。
- 本機日誌（`%APPDATA%\BetterAgentTerminal\Logs`）：`debug-20261128-110127.log`、`debug-20261128-110745.log`、`debug-20261128-110847.log`；推測其中有 pre.2 自動恢復那次與退回 pre.1 那次，以 log 開頭的版號為準。

## 修正紀錄

- 2026-11-28 11:09 開單 → FIXING（T0963）
- 2026-11-28 11:15 使用者補充：「全新啟動 BAT 時，開一個全新 Claude CLI 狀況一樣」⇒ 不限於自動恢復；已寫入 T0963〈塔台補充（執行中 #1）〉
- 2026-11-28 11:18 使用者補充：pwsh 分頁正常 ⇒ 只有 agent 分頁；已寫入 T0963〈塔台補充（執行中 #2）〉
