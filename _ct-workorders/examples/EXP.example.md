---
schema_version: 1
schema_kind: experiment
id: EXP-EXAMPLE-001
title: Example parser migration spike
status: CONCLUDED
topic: FRONTMATTER
created_at: "2026-04-28T18:30:00+08:00"
driving_decision: PLAN-034
related_plan: PLAN-034
success_criteria:
  - AC1
  - AC2
  - AC3
outcome_commit: abc1234
tags:
  - spike
  - parser
---

# EXP-EXAMPLE-001 — Example parser migration spike

## 元資料

| 欄位 | 內容 |
|------|------|
| **編號** | EXP-EXAMPLE-001 |
| **TOPIC** | FRONTMATTER |
| **狀態** | ✅ CONCLUDED |
| **建立時間** | 2026-04-28 18:30 (UTC+8) |
| **驅動決策** | PLAN-034 |
| **關聯 PLAN** | PLAN-034 |

## Hypothesis

BAT and CT can parse YAML frontmatter before legacy markdown metadata tables.

## Conclusion

The spike is considered successful when all parser paths can read the same status enum from frontmatter.

