---
schema_version: 1
schema_kind: bug
id: BUG-113
title: "Detached workspace 視窗顯示 Workspace not found：workspace:load / save 以 ctx.windowId 讀寫 registry，detached 視窗不在 windowMap（windowId null）→ load 回 null、save 回 false；自 512c118 多視窗重構起 detach 功能失效（本機 / 遠端皆然）"
status: OPEN
severity: medium
reproducibility: unknown
created_at: "2026-10-05T06:43:42+08:00"
updated_at: "2026-10-05T06:43:42+08:00"
impact:
  - detached-workspace
links:
  fix_workorder: T0453
  related: [BUG-112, T0446]
---

# BUG-113 — detached workspace 視窗載不到 workspace

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（detach 功能整個不可用；推定，未實機） |
| 可重現 | 程式碼證據（T0446 `git log -S`），未實機確認 |
| **狀態** | 📂 OPEN |
| 回報者 | T0446 Worker（遭遇問題 1） |

## 現象（T0446 回報）

- `workspace:load` / `workspace:save`（ALWAYS_LOCAL）以 `ctx.windowId` 讀寫 window registry；detached 視窗不在 `windowMap` → `windowId` null → `main.ts` `if (!ctx.windowId) return null` → load 回 `null`、save 回 `false`
- renderer `App.tsx` detached 模式找不到 workspace → `app.workspaceNotFound`
- guard 來自 `512c118 refactor: single-process multi-window architecture`（2026-03-28），晚於 detach 功能 `070b61a`（2026-02-13）

## 修復方向（T0453）

detached 視窗唯讀載入父視窗 entry（T0446 的 `detachedWindowRecords` 已有 `parentWindowId`），持久化只由父視窗負責；避免 detached 視窗的 store（含全部 workspace、30 秒 autosave）覆寫父視窗 entry。
