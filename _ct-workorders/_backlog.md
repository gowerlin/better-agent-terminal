---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-05-15T13:10:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: 6
breakdown:
  IDEA: 2
  PLANNED: 2
  IN_PROGRESS: 2
  DONE: 0
  DROPPED: 0
---
# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-05-15 13:10 (UTC+8) — Session 43 收工：歸檔 8 張 DONE/DROPPED PLAN → `_archive/plans/`

## 統計
- 💡 Ideas: 2 | 📋 Planned: 2 | 🔄 In Progress: 2 | ✅ Done: 0 | 🚫 Dropped: 0 | **Total: 6**

> 已歸檔 PLAN（`_archive/plans/`）：27 張（含本 session 新增 8 張）

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | - | 🔄 IN_PROGRESS | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-032 | Setup Wizard Error UX Overhaul（含 Stepper `awaiting-input` 擴充 + 通用 error mapping framework） | - | 🔄 IN_PROGRESS | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |
| PLAN-014 | evaluate-vscode-extension-vs-git-gui | - | 📋 PLANNED | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-033 | Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR） | - | 📋 PLANNED | [PLAN-033](PLAN-033-tower-state-snapshot-archive-architecture.md) |
| PLAN-015 | refactor-dual-render-path-shared-helper | - | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts 整理 + R5 setup-wizard chunk 切分（BUG-069 audit 衍生） | - | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|

（已歸檔，見 `_archive/plans/`）

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|

（已歸檔，見 `_archive/plans/`）

## 🧪 EXP 實驗分支

| ID | 標題 | 狀態 |
|----|------|------|

（無熱區實驗；已歸檔的見 `_archive/workorders/`）
