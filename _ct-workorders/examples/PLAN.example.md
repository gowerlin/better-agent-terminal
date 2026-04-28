---
schema_version: 1
schema_kind: plan
id: PLAN-999
title: Example metadata schema rollout plan
status: PLANNED
priority: high
created_at: "2026-04-28T18:20:00+08:00"
plan_type:
  - architecture
  - technical-improvement
trigger_bugs:
  - BUG-999
scope:
  - BAT parser
  - CT sync
  - CT templates
estimated_workorders: 6
tags:
  - schema
  - migration
---

# PLAN-999 — Example metadata schema rollout plan

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-999 |
| 標題 | Example metadata schema rollout plan |
| 狀態 | 📋 PLANNED |
| 優先級 | 🔴 High |
| 類型 | 架構調整 + 技術改善 |
| 建立時間 | 2026-04-28 18:20 (UTC+8) |
| 觸發 BUG | BUG-999 |

## Goals

- Establish frontmatter as the metadata SoT.
- Keep markdown body sections readable for humans.
- Migrate hot-zone documents without touching `_archive/`.

