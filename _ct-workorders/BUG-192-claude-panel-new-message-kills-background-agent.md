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

## 研究結果（T0768，2026-11-02，SDK 0.3.316 / CLI 2.1.316 假 API 實錄）

- **根因**：主回合 `result` 後 renderer 已不在 streaming，但主行程的 query 要等背景子代理結束、CLI 進入 idle 才結束；`sendMessage` 看到 `isStreaming` 就 abort，CLI 被結束、子代理一起死。resume 時 CLI 補一則 `task_notification stopped`（「didn't finish before the previous session ended」），模型拿不到子代理結果。
- **可行做法（實測）**：① 在仍開著的 query 上 `Query.streamInput()` 注入新訊息：子代理不受影響、回合正常、權限 / 切模式 / prompt suggestion 照常；輸入已關時立即丟 `ProcessTransport is not ready for writing`，可退回排隊。② 排隊到子代理結束後以 resume 送出：模型看得到子代理結果，但要等。③ 整個面板改常駐串流輸入：也可行，改動大。宣告 `perTaskStopAffordance: true` 後 Esc（`interrupt`）不再殺背景子代理；不宣告會殺，且 CLI 之後 `exit code 1`。
- **建議**：注入（①）＋失敗退回排隊（②）＋宣告 `perTaskStopAffordance`；實作單草案、必守規則、驗收與待決點 P-1–P-4 見 T0768 回報區。
- 狀態不變（OPEN），待塔台開實作單。
