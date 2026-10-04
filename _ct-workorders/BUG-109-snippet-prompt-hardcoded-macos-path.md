---
schema_version: 1
schema_kind: bug
id: BUG-109
title: "/snippet 情境 prompt 寫死 macOS 路徑 ~/Library/Application Support/better-agent-terminal/snippets.json；Windows / Linux / 遠端視窗皆錯（snippet 已改 ALWAYS_LOCAL，遠端 agent 讀不到本機 DB）"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-10-05T05:51:45+08:00"
impact:
  - snippets
  - claude-panel
links:
  fix_workorder: T0441
  related: [T0421, T0422]
---

# BUG-109 — /snippet prompt 寫死 macOS 路徑

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low |
| 可重現 | always（程式碼證據） |
| **狀態** | 📂 OPEN |
| 回報者 | T0421 Worker（「遭遇問題」1） |

## 現象

- `ClaudeAgentPanel.tsx`（約 :1431）`/snippet` 情境 prompt 寫死 `~/Library/Application Support/better-agent-terminal/snippets.json`，叫 agent 用 Read / Write 工具改 JSON
- Windows / Linux 路徑不同；且 snippet 實際存於 better-sqlite3（是否仍有 `snippets.json` 待確認）
- T0422 讓 `snippet:*` 變 ALWAYS_LOCAL 後，遠端視窗的 agent 跑在遠端，更不可能讀寫本機 snippet

## 修復方向（待 T0441 確認）

prompt 改為注入 snippet 清單 / 經 IPC 操作，不叫 agent 直接改檔；或遠端視窗停用該流程並提示。
