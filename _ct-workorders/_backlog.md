---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-09-02T15:49:04+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 6
breakdown:
  IDEA: 2
  PLANNED: 2
  IN_PROGRESS: 1
  DONE: 1
  DROPPED: 0
---

# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-09-02 15:49 (UTC+8) — 第四十八 session：PLAN-032 → DONE 後重建

## 統計
- 💡 Ideas: 2 | 📋 Planned: 2 | 🔄 In Progress: 1 | ✅ Done: 1 | 🚫 Dropped: 0

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | 🔴 high | 🔄 IN_PROGRESS | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-033 | Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR） | 🔴 high | 📋 PLANNED | [PLAN-033](PLAN-033-tower-state-snapshot-archive-architecture.md) |
| PLAN-014 | evaluate-vscode-extension-vs-git-gui | 🟡 medium | 📋 PLANNED | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-015 | refactor-dual-render-path-shared-helper | 🟢 low | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts + R5 setup-wizard chunk 切分（BUG-069 衍生） | 🟢 low | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-032 | Setup Wizard Error UX Overhaul（Stepper awaiting-input + error mapping framework） | 2026-09-02 | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| _（無）_ | | | |
