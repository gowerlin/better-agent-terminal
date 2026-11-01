---
schema_version: 1
schema_kind: bug
id: BUG-190
title: "Claude Agent 面板：背景 Agent（`run_in_background: true`）執行中不在 active task bar，結束後卡片描述沒有完成標示"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T03:05:30+0800"
fixed_at: "2026-11-02T03:05:30+0800"
fix_commit: b8a3b7f7
impact:
  - claude-agent-panel
  - active-tasks
links:
  discovered_in: "T0739 回報區 F2（2026-11-01，真實模型 Haiku 5.5，CLI 2.1.316）"
  related: [T0759, T0739, T0727]
---
# BUG-190 — Claude Agent 面板：背景 Agent（`run_in_background: true`）執行中不在 active task bar，結束後卡片描述沒有完成標示

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（背景子代理還在跑，使用者看不到也無法從 task bar 停止） |
| 可重現 | 必現（CLI 2.1.316 起 Agent 預設可背景執行） |
| **狀態** | ✅ FIXED（T0759 `b8a3b7f7`，待實機驗收） |
| 回報者 | T0739 Worker |

## 現象

- 模型呼叫 `Agent`（`run_in_background: true`）：卡片出現約 1.5 s 後 `.claude-active-task-item` = 0（推論：背景啟動時 tool_result 立即回來，`activeTasks` 依 CLAUDE.md「Sub-agent / Active Tasks Tracking」隨 tool_result 清掉）。
- 背景子代理結束後卡片 `dot-success`，描述仍是原本的文字，沒有 `[completed] …`；CLI 自己多跑 1 個回合。
- 預期：背景子代理執行中留在 active task bar（可停止），結束（完成 / 失敗 / 停止）時移除並標示結果。

## 修正（T0759 `b8a3b7f7`，2026-11-02T03:05:30+0800）

- 查證（SDK 0.3.316 / CLI 2.1.316，假 API）：背景 Agent 啟動時就回 tool_result（`async_launched`），`activeTasks` 隨即清掉；結束由 `task_updated` / `task_notification` 送達。另發現 `activeTasks` 同一子代理有兩筆（tool_use_id 與 task_id），`stopTask` 送 tool_use_id 時 resolve 但子代理不停、卡片卻標 `[stopped by user]`（前景 / 背景都一樣）。
- 修正：背景項目的 tool_result 不移除、保持 running，結束信號到才移除並標 `[completed]` / `[failed]` / `[stopped …]`；`task_started` 改以 task_id 為 key（`stopTask` 送對的 id）；`stopTask` 失敗不蓋掉已結束的結果；session 結束時清空（既有上限）。`src/lib/agent-task-label.ts`（新）。
- 驗證：單元 16 項＋6 項突變；e2e v072-pre6-claude-panel ⑦b（背景執行中 bar 1 項、結束 0 項、卡片 completed、從 bar 停止可停）＋前景 ⑦ 照舊，修正前 ⑦b 失敗；typecheck 0 / 0、`test:unit` 6556 / 368 files、`vite build`（匯出目錄）。
- 待實機驗收：真實模型下背景 Agent 執行中出現在 active task bar、結束後移除並標示完成。
