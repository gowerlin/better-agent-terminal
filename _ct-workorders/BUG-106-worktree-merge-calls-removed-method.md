---
schema_version: 1
schema_kind: bug
id: BUG-106
title: "worktree:merge 呼叫已移除的 WorktreeManager.mergeWorktree（3a470eb），本機與遠端皆 reject TypeError；preload / electron.d.ts 仍暴露 worktree.merge"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-05T04:37:14+08:00"
updated_at: "2026-10-05T04:37:14+08:00"
impact:
  - worktree
links:
  fix_workorder: null
  related: [T0405]
---

# BUG-106 — worktree:merge 指向已移除的方法

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（`3a470eb` 起設計為讓使用者用 CLI merge；channel 與 API 殘留） |
| 可重現 | always（呼叫即 TypeError） |
| **狀態** | 📂 OPEN |
| 回報者 | T0405 Worker（回報區「遭遇問題」1）；T0405 搬移時逐字保留行為 |

## 修復方向（待決）
- 移除 `worktree:merge` channel、preload `worktree.merge`、型別與呼叫端；或補回實作
