---
schema_version: 1
schema_kind: bug
id: BUG-106
title: "worktree:merge 呼叫已移除的 WorktreeManager.mergeWorktree（3a470eb），本機與遠端皆 reject TypeError；preload / electron.d.ts 仍暴露 worktree.merge"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-05T04:37:14+08:00"
updated_at: "2026-10-05T05:40:32+08:00"
impact:
  - worktree
links:
  fix_workorder: T0417
  related: [T0405]
---

# BUG-106 — worktree:merge 指向已移除的方法

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（`3a470eb` 起設計為讓使用者用 CLI merge；channel 與 API 殘留） |
| 可重現 | always（呼叫即 TypeError） |
| **狀態** | ✅ FIXED |
| 回報者 | T0405 Worker（回報區「遭遇問題」1）；T0405 搬移時逐字保留行為 |

## 修復方向（待決）
- 移除 `worktree:merge` channel、preload `worktree.merge`、型別與呼叫端；或補回實作

## 修復（T0417，2026-10-05T05:40:32+08:00）
- 決策（D134）：**移除**，不補回 `WorktreeManager.mergeWorktree`
- 移除 `worktree:merge` handler（`electron/handlers/git.ts`）、preload `worktree.merge`、`src/types/electron.d.ts` 型別、`PROXIED_CHANNELS` / `PATH_FREE_CHANNELS` 條目；測試清單同步（22 → 21）
- renderer 無呼叫端、無 UI / i18n；`HEADLESS_UNSUPPORTED` 本無此條目
- 驗收：unit 1867 passed | 1 skipped；tsc 40（≤ 40）
