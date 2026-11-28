---
schema_version: 1
schema_kind: bug
id: BUG-238
title: "Windows：關閉分頁時 node-pty `kill()` 在 shell 已結束後約 5 s 對舊 shell pid 呼叫 `process.kill`，pid 被重用時可能結束無關的程序"
status: FIXED
severity: low
reproducibility: "依 node-pty 1.1.0 原始碼（`windowsPtyAgent.js` 118–131）＋T0979 實測「以已結束的 shell pid 查主控台清單 → `AttachConsole failed`」推論；未實測到 pid 重用（機率低）"
created_at: "2026-11-28T19:04:38+08:00"
updated_at: "2026-11-28T19:42:32+08:00"
impact:
  - terminal-server
  - pty-manager
links:
  discovered_in: "T0979（PLAN-066 後續研究〈其他發現〉）"
  related: [T0979, T0983, T0540, T0889, PLAN-066]
---
# BUG-238 — node-pty `kill()` 對已結束的 shell pid 呼叫 `process.kill`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（需要 5 s 內 pid 被重用才會誤殺；未實測到） |
| 可重現 | 原始碼推論＋主控台清單查詢失敗實測（T0979） |
| **狀態** | ✅ FIXED（T0983 `89327c0a` 合併進 `main` `f53c938c`，D524；待發版：發版前跑 W6） |
| 回報者 | T0979 Worker（2026-11-28 19:01） |
| 影響版本 | 共用 conout Worker 前就存在（node-pty 1.1.0 行為；T0540 起的 `endPty` 順序會走到） |

## 現象（預期 vs 實際）

- 預期：關閉分頁時只結束該分頁的程序樹，不碰其他程序。
- 實際（推論）：`WindowsPtyAgent.kill()` 先 fork `conpty_console_list_agent` 以 shell pid 查主控台程序清單；shell 已結束時查詢以 `AttachConsole failed` 結束（exit 1），node-pty 只等 `message`，5 s 逾時後對清單 `[shell pid]` 呼叫 `process.kill`。Terminal Server `endPty`（T0540：先 `taskkill /T` 再 `pty.kill()`）與 direct 模式（`pty.kill()` 後立刻 `taskkill`）都會在 shell 已被 taskkill 結束後走到這段；那 5 s 內若 pid 被系統重用，會結束到無關的程序。

## 修法方向

- `endPty`／direct 模式在 taskkill 之後不再呼叫 node-pty 的 `pty.kill()`，改以 ClosePseudoConsole＋釋放 conin＋停轉送收掉（與 F4 選項 D 同一套釋放函式）；T0540「先結束程序樹」的順序不變。會改 `terminal-server.js` → holder key 改變 → 發版前要跑 W6。

## 修正紀錄

- 2026-11-28 19:04 開單，U-77：A → 併入 F4 實作單 T0983 → FIXING（D522）
- 2026-11-28 19:42 → FIXED：T0983（Windows `endPty` 與 direct 模式在 taskkill 後以 `releaseExitedPty` 收 PTY、不經 node-pty `kill()`；Windows 真 node-pty 測試攔截 `fork` 確認不再起 `conpty_console_list_agent`；BAT 關閉後 1 s 的 conhost 修正前 14 個、修正後 0 個）合併進 `main` `f53c938c`（U-80：A，D524）。形狀不符時退回 `pty.kill()`（釘版 node-pty 1.1.0 下不會發生）。待發版後 CLOSED
