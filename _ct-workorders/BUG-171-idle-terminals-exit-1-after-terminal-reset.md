---
schema_version: 1
schema_kind: bug
id: BUG-171
title: "BAT 執行中忽然「終端重置」並出現 toast，之後好幾個閒置（未忙碌）的分頁顯示 `[Process exited with code 1]`，連執行中的 Claude CLI 塔台分頁也結束"
status: OPEN
severity: high
reproducibility: unknown
created_at: "2026-10-25T21:05:27+0800"
updated_at: "2026-10-25T21:05:27+0800"
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
| **狀態** | 📂 OPEN：研究工單 T0703 調查中 |
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

（T0703 填寫）

## 修正方向

（T0703 建議，塔台決定）
