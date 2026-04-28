---
schema_version: 1
schema_kind: workorder
id: T9999
title: Example frontmatter-enabled work order
type: research
project: PLAN-034
status: IN_PROGRESS
created_at: "2026-04-28T18:25:00+08:00"
started_at: "2026-04-28T19:16:49+08:00"
sizing: L
depends_on:
  - PLAN-034
followups:
  - T10000
affects_files:
  - _ct-workorders/T9999-*.md
  - _ct-workorders/examples/
  - "docs/含中文路徑/*.md"
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
tags:
  - schema
  - control-tower
---

# T9999 — Example frontmatter-enabled work order

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T9999 |
| 類型 | research |
| 所屬 | PLAN-034 |
| 狀態 | 🔄 IN_PROGRESS |
| 建立時間 | 2026-04-28 18:25 (UTC+8) |
| 開始時間 | 2026-04-28 19:16:49 +08:00 |
| Sizing | L |
| 依賴 | PLAN-034 |
| 後續 | T10000 |
| 互動旗標 | `--mode yolo --no-interactive` |
| 工作目錄 | main repo |
| `affects_files` | `_ct-workorders/T9999-*.md` / `_ct-workorders/examples/` / `docs/含中文路徑/*.md` |

## Task

This body table is for humans. BAT and CT parsers must read the YAML frontmatter first.

## Acceptance Criteria

- [ ] Parser returns `status: IN_PROGRESS` from frontmatter.
- [ ] Body table drift emits a warning but does not replace frontmatter.

