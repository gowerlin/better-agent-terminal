---
schema_version: 1
schema_kind: bug
id: BUG-171
title: "BAT 執行中忽然「終端重置」並出現 toast，之後好幾個閒置（未忙碌）的分頁顯示 `[Process exited with code 1]`，連執行中的 Claude CLI 塔台分頁也結束"
status: FIXED
severity: high
reproducibility: conditional（系統時鐘往前跳 ≥ 3 秒時觸發；T0703 由日誌、程序列表、系統事件記錄確認，未在隔離實例重現）
created_at: "2026-10-25T21:05:27+0800"
updated_at: "2026-10-25T21:36:00+0800"
impact:
  - terminal-server-recovery
  - pty-lifecycle
links:
  discovered_in: "使用者回報（2026-10-25 第九十四 session，附截圖）"
  related: [T0703, T0578, T0540, T0572, T0669, BUG-164]
---

# BUG-171 — 終端重置後閒置分頁 exit 1

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（執行中的 agent 分頁被結束，含其他專案的塔台；原因與範圍未明） |
| 可重現 | 未知 |
| **狀態** | ✅ FIXED：T0704 `68ab2a42`（heartbeat 單調時鐘 + 連續 3 次 + 程序 / IPC 確認；recovery 以 server generation 丟棄舊訊息、先結束舊 server 程序樹、孤兒先殺樹）＋ T0705 `d7ffa080`（toast i18n、server env 不進 PTY）；待下一個預覽版實機驗收。C 另開 PLAN-055（D186） |
| 回報者 | 使用者 |

## 現象

- 時間：2026-10-25 21:05（UTC+8）前不久，使用者回報時間為準。
- BAT 執行中忽然發生「終端重置」，畫面出現 toast 提示（原文未記錄）。
- 之後發現**好幾個未忙碌的分頁**顯示 `[Process exited with code 1]`。
- 截圖例：工作區 `BMad-Guide` 的分頁 `Claude CLI · Tower`（原本執行 claude 的塔台），畫面只剩一個 Git Bash（UCRT64）提示字元 `$`，接著 `[Process exited with code 1]`，claude session 已不在。
- 同一個 BAT 視窗中，工作區 `better-agent-terminal` 的塔台分頁（本塔台）沒有結束，claude 與 BAT MCP 正常。
- 預期：BAT 不應自行結束正在執行的分頁；若真的需要重建，分頁應還原原本的程序或明確告知使用者。
- 實際：閒置分頁的程序消失，只留 exit 1。

## 已知線索

- 本次 BAT 啟動的日誌：`<appData>/BetterAgentTerminal/Logs/debug-20261024-141441.log`（2026-10-24 14:14 啟動），另有 `bat-scripts.log`。
- 塔台分頁環境有 `BAT_IDLE_TIMEOUT_MS=1800000`（30 分鐘）。【推論】可能與「只有閒置分頁受影響」有關，待查。
- 可能的機制（未驗證）：Terminal Server 死掉後的 recovery 重建（`handleServerDeath`）、GPU 崩潰後的終端重建（T0669）、閒置逾時。

## 根因

（T0703 調查，證據細節見 T0703 回報區）

1. **觸發**：2026-10-25 12:59:04Z（20:59:04），Windows 時間服務做 NTP 校正，系統時鐘往前跳 **+3.03 秒**（系統事件記錄 Kernel-General 事件 1：`12:59:01.8726Z → 12:59:04.9031Z`）。
2. **heartbeat 誤判**：`PtyManager.startHeartbeat`（`electron/pty-manager.ts:1592`）用牆鐘 `Date.now()` 算距離上次 pong 的時間，門檻只有 10 s + 3 s，一次取樣超過就判死，不確認 server 是否還在。12:59:50.403Z 日誌 `heartbeat timeout (13032ms since last pong) — server dead`：13032 ≈ 10001 + 3031。當時 **Terminal Server 其實活著**：舊 server pid 33404 到現在仍在執行。
3. **recovery 誤殺**：`handleServerDeath` 依 registry 殺掉 6 個分頁的 shell，claude 一起被殺；re-fork 第二個 server（pid 38124），以同 id 重建 6 個 bash。重建只開 shell、不重跑 agent，所以分頁剩新的 `$` 提示字元。toast 是 `App.tsx:716`「終端已恢復（歷史輸出已重置）」。
4. **錯誤的 exit 1**：舊 server 沒被關掉，它的 IPC `'message'` 監聽也沒拆（`pty-manager.ts:616-620`、`:1645` 只把 `serverProcess` 設為 null）。舊 PTY 被 SIGTERM 殺掉（Windows：TerminateProcess，exit code 1），舊 server 送出 `pty:exit(id, 1)`。主行程把它套到同 id 的新 instance 上：重建時沒設 `awaitingCreated`，BUG-101 的防護擋不到。結果新 instance 被刪，renderer 印出 `[Process exited with code 1]`。舊 server 還用同 id 刪掉了新 shell 的 registry 項目。
5. **「只影響閒置分頁」是錯覺**：6 個分頁（5 個閒置塔台、1 個忙碌 Worker）的 claude 全部被殺。忙碌 Worker 的 exit 晚 4.5 分鐘才到，看起來像沒事。better-agent-terminal 原本的塔台（0d357566）也結束了；目前的塔台是 13:03:03 另開的新分頁。
6. **副作用**：
   - 新 server 下 6 個沒有分頁的 shell 還活著
   - 舊 server 與它的 6 個 conhost 還活著
   - 舊分頁的內層 bash 有 12 個成了孤兒：SIGTERM 先殺外層 bash，之後 `taskkill /T` 找不到程序樹
7. **不是新回歸**：T0112（2026-04-13）以來就有的缺陷；安裝版 `0.7.1-pre.6`，目前 main 的相關程式沒有差異。`BAT_IDLE_TIMEOUT_MS` 是 Terminal Server 自己的閒置關閉設定，因為 env 帶入 PTY 才出現在分頁裡，和本事件無關。

## 修正方向

（T0703 建議，塔台決定）

- **A（推薦，P1）heartbeat 不再誤判**：改用單調時鐘；連續多次沒收到 pong 才判死；判死前確認 server 程序與 IPC 是否還在。位置：`PtyManager.startHeartbeat`。
- **B（推薦，和 A 合成一張單）recovery 本身要安全**：
  - 進入 recovery 先拆掉舊 server 的監聽並關掉舊 server（含程序樹）
  - 從舊 server 來的訊息一律丟棄（server generation，或重建的 instance 帶 `awaitingCreated`）
  - 孤兒清理改成先 `taskkill /T` 再殺 shell（同 T0540 順序）
  - 位置：`handleServerDeath` / `setServerProcess` / `reforkTerminalServer`
- **C（另開 PLAN）agent 分頁不再無聲變成 shell**：recovery 後列出被中斷的 agent 分頁，保留 `claudeSessionId` 並提供 `--resume`。
- A + B 都不改 BAT ↔ CT 契約，也不影響遠端 headless。
