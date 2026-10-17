---
schema_version: 1
schema_kind: bug
id: BUG-147
title: "Recovery 選「重新開始」時，舊 Terminal Server 延後刪 pid / port 檔，把新 server 剛寫的檔案刪掉（下次啟動再 fork、前一個成孤兒）"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-17T20:16:57+0800"
fixed_at: "2026-10-17T20:16:57+0800"
fixed_by: T0578
fix_commit: "f833e3b0"
impact:
  - terminal-server
links:
  discovered_in: "T0578 回報區「偏差 / 範圍外發現」1"
  related: [T0578, T0540, BUG-146]
---

# BUG-147 — 「重新開始」的 pid 檔競態

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（多一個孤兒 Terminal Server，idle timeout 才結束） |
| 可重現 | 必現（T0578 隔離實例：重新開始後 30 s 內 pid 檔不存在） |
| **狀態** | ✅ FIXED（T0578，`f833e3b0`；塔台補記錄） |

## 現象

BAT 重開且 Terminal Server 存活，Recovery 選「重新開始」：

- **預期**：舊 server 結束，新 server 啟動並寫好 pid / port / registry 檔。
- **實際**：舊 server 收到 `server:shutdown` 立即關 TCP，但 pid / port / registry 檔要等全部 PTY 程序樹結束後才刪（T0540 `shutdown()` 的 `ended.then`）。main 此時已 fork 新 server，新 server 寫的檔案被舊 server 刪掉。後果：下次 BAT 啟動找不到這個 server → 再 fork 一個，前一個成為孤兒。刪檔時序是依程式碼推得，沒有單獨量測。

## 修正

T0578 在 fresh-start handler 加 `waitForTerminalServerExit`（`isServerRunning` 為否，最多 5 s，逾時 warn 後照舊）再刪檔、fork。修正後 3 輪都取得新 pid。實機驗收隨 `v0.7.0-pre.1`。
