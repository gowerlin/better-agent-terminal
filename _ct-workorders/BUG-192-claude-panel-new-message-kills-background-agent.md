---
schema_version: 1
schema_kind: bug
id: BUG-192
title: "Claude Agent 面板：背景子代理執行中送出新訊息，會中止整個 query、背景子代理一起被結束（卡片 error `Agent terminated unexpectedly`）"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-11-02T03:08:29+0800"
updated_at: "2026-11-02T03:08:29+0800"
impact:
  - claude-agent-panel
  - active-tasks
links:
  discovered_in: "T0759 回報區〈後續建議〉（2026-11-02，SDK 0.3.316 / CLI 2.1.316 假 API 查證）"
  related: [T0768, T0759, BUG-190, T0739]
---
# BUG-192 — Claude Agent 面板：背景子代理執行中送出新訊息，會中止整個 query、背景子代理一起被結束（卡片 error `Agent terminated unexpectedly`）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（CLI 2.1.316 的 Agent 預設背景執行，使用者在子代理跑的時候繼續對話就會殺掉它） |
| 可重現 | 必現（背景子代理執行中、query 仍在進行時送新訊息） |
| **狀態** | 📂 OPEN（T0768 研究中） |
| 回報者 | T0759 Worker |

## 現象

- 背景子代理在跑時，面板的 query 仍在進行（`isStreaming`）；`sendMessage` 走「中止目前 query 再送」路徑：CLI 被中止，背景子代理一起結束，卡片標 error `Agent terminated unexpectedly`，新訊息前面加「使用者先前的訊息（已中斷）」。
- 預期：使用者可以在背景子代理執行時繼續對話，子代理不受影響（或至少明確告知並讓使用者選擇）。
- T0759 提的可能方向：改用串流輸入（同一個 query 送後續訊息）並宣告 `perTaskStopAffordance`；或背景子代理執行中把新訊息排隊。
