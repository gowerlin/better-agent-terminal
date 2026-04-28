---
schema_version: 1
schema_kind: bug
id: BUG-999
title: Example parser status drift bug
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-04-28T18:15:00+08:00"
workaround: Open the markdown file and read frontmatter status directly.
impact:
  - control-tower-ui
  - status-statistics
links:
  trigger_plan: PLAN-034
  related_workorders:
    - T0313
    - T0314
tags:
  - parser
  - metadata
---

# BUG-999 — Example parser status drift bug

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-999 |
| 標題 | Example parser status drift bug |
| 狀態 | 🐛 OPEN |
| 嚴重度 | 🟡 Medium |
| 可重現 | 100% |
| Workaround | Open the markdown file and read frontmatter status directly. |
| 建立時間 | 2026-04-28 18:15 (UTC+8) |

## Symptoms

The UI status bucket differs from the metadata SoT.

## Resolution Criteria

- [ ] Frontmatter parser reads `status: OPEN`.
- [ ] Unknown status values do not fall back to Pending silently.

