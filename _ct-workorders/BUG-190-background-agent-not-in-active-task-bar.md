---
schema_version: 1
schema_kind: bug
id: BUG-190
title: "Claude Agent 面板：背景 Agent（`run_in_background: true`）執行中不在 active task bar，結束後卡片描述沒有完成標示"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T02:23:44+0800"
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
| **狀態** | 🔧 FIXING（T0759） |
| 回報者 | T0739 Worker |

## 現象

- 模型呼叫 `Agent`（`run_in_background: true`）：卡片出現約 1.5 s 後 `.claude-active-task-item` = 0（推論：背景啟動時 tool_result 立即回來，`activeTasks` 依 CLAUDE.md「Sub-agent / Active Tasks Tracking」隨 tool_result 清掉）。
- 背景子代理結束後卡片 `dot-success`，描述仍是原本的文字，沒有 `[completed] …`；CLI 自己多跑 1 個回合。
- 預期：背景子代理執行中留在 active task bar（可停止），結束（完成 / 失敗 / 停止）時移除並標示結果。
