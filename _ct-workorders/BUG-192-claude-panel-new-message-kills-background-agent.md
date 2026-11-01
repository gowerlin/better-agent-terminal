---
schema_version: 1
schema_kind: bug
id: BUG-192
title: "Claude Agent 面板：背景子代理執行中送出新訊息，會中止整個 query、背景子代理一起被結束（卡片 error `Agent terminated unexpectedly`）"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-11-02T03:08:29+0800"
updated_at: "2026-11-02T05:23:23+0800"
fixed_at: "2026-11-02T04:28:37+0800"
closed_at: "2026-11-02T05:23:23+0800"
fix_commit: 9ab26222
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
| **狀態** | 🚫 CLOSED（T0769 `9ab26222`；交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0771 PASS，真實模型走注入路徑） |
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

## 修正（T0769 `9ab26222`，2026-11-02T04:28:37+0800）

- 修正（D214 / T0768 方案 C）：主回合 `result` 之後、有背景子代理在跑時，新訊息以 `Query.streamInput()` 注入同一個 query（不 abort、不另開 query、不清權限、不加「已中斷」前綴、注入回合有自己的 Cache History R 列）；`streamInput` 失敗 → 排隊，訊息下顯示「等背景子代理結束後送出」＋取消（`claude:cancel-queued-message`），query 結束後照現行 resume 送出。`perTaskStopAffordance: true`（Esc 只停回合）；`stopSession` 在仍有背景子代理時不設 idle；init 之後的 `exited with code` 不重試。
- 與草案的偏離：只在 `hasBackgroundTask` 時注入（沒有背景子代理時 SDK 在 result 當下就關輸入，寫入不丟錯、訊息會遺失；e2e 實測抓到）。
- 驗證：單元 15＋7 突變、面板 4＋1 突變；e2e v072-pre6-claude-panel ⑦c 兩輪綠（followup 約 150 ms 回覆、背景子代理不受影響），驗紅（修正前背景子代理被中止）；不回歸 ①–⑫ 全 PASS；typecheck 0 / 0、`test:unit` 6681 / 380 files、`vite build`（匯出目錄）。
- 已知限制：排隊清單不跨面板重新掛載；依賴 SDK 0.3.316 背景子代理執行中輸入仍開的行為（改了會退回排隊）。
- 待實機驗收：真實模型下背景子代理執行中送出新訊息 → 立即回覆、子代理繼續、task bar 不變。

## 驗收（2026-11-02T05:23:23+0800，第一百零四 session）

- 依據（R-G003）：交付版 `v0.7.3-pre.4` 安裝版（`BAT_E2E_EXECUTABLE`，隔離實例）自動化實測 T0771（`a173f74a` / 回報 `c24f9556`，D215）。
- 假 API：`v072-pre6-claude-panel` ⑦c PASS（主回合 result 後送訊息 157 ms 回覆、bar 仍 1 項、子代理未重跑、無 `Agent terminated unexpectedly`；注入回合中 Esc 後子代理照常完成）。
- 真實模型（Haiku 5.5）：背景子代理執行中、主回合已 result 時送「1+1」→ 3.1 s 回覆「2」，走**注入路徑**；bar 仍 1 項、卡片 running、無「已中斷」前綴、無排隊提示，子代理之後照常 `[completed]`。
- 未涵蓋：排隊退路（「等背景子代理結束後送出」＋取消）在真實時序下沒有出現，只有單元測試涵蓋（docs 已知限制）；macOS / Linux。
