import { describe, it, expect } from 'vitest'
import { parsePlanFile, parseBacklogStats } from '../backlog'

const PLAN_FRONTMATTER = `---
schema_version: 1
schema_kind: plan
id: PLAN-099
title: Frontmatter plan case
status: IN_PROGRESS
priority: high
created_at: "2026-04-28T10:00:00+08:00"
---

# 📋 PLAN-099：Frontmatter plan case

| 欄位 | 值 |
|------|----|
| 狀態 | 🔄 IN_PROGRESS |
`

const PLAN_LEGACY = `# 📋 PLAN-100：Legacy plan case

- **狀態**：✅ DONE
- **優先級**：🟢 Low
- **建立時間**：2026-04-15
`

const PLAN_DRIFT = `---
schema_version: 1
schema_kind: plan
id: PLAN-101
title: Drift case
status: PLANNED
priority: medium
created_at: "2026-04-28T10:00:00+08:00"
---

# 📋 PLAN-101：Drift case

- **狀態**：💡 IDEA
`

const PLAN_INVALID = `---
schema_version: 1
schema_kind: plan
id: PLAN-102
title: Invalid status
status: PARKED
priority: low
created_at: "2026-04-28T10:00:00+08:00"
---

# 💡 PLAN-102：Invalid status
`

describe('parsePlanFile — case A: pure frontmatter', () => {
  it('reads status, priority from frontmatter', () => {
    const e = parsePlanFile(PLAN_FRONTMATTER, 'PLAN-099-frontmatter.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('IN_PROGRESS')
    expect(e?.priority).toBe('High')
    expect(e?.title).toBe('Frontmatter plan case')
  })
})

describe('parsePlanFile — case B: legacy fallback', () => {
  it('reads from body bullet list when no frontmatter', () => {
    const e = parsePlanFile(PLAN_LEGACY, '_archive/plans/PLAN-100-legacy.md')
    expect(e?.parseSource).toBe('legacy_markdown')
    expect(e?.status).toBe('DONE')
    expect(e?.priority).toBe('Low')
    expect(e?.parseWarnings?.[0].kind).toBe('missing_frontmatter')
  })
})

describe('parsePlanFile — case C: drift', () => {
  it('frontmatter wins, drift warning attached', () => {
    const e = parsePlanFile(PLAN_DRIFT, 'PLAN-101-drift.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('PLANNED')
    expect(e?.parseWarnings?.find(w => w.kind === 'metadata_drift')).toBeDefined()
  })
})

describe('parsePlanFile — case D: invalid status', () => {
  it('unknown enum does NOT silently bucket as IDEA; archived defaults DONE', () => {
    const e = parsePlanFile(PLAN_INVALID, '_archive/plans/PLAN-102-invalid.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('DONE')
    expect(e?.parseWarnings?.find(w => w.kind === 'unknown_status')).toBeDefined()
  })

  it('non-archived path with invalid fm status falls back to IDEA bucket', () => {
    const e = parsePlanFile(PLAN_INVALID, 'PLAN-102-invalid.md')
    expect(e?.status).toBe('IDEA')
    expect(e?.parseWarnings?.find(w => w.kind === 'unknown_status')).toBeDefined()
  })
})

describe('parseBacklogStats', () => {
  it('reads total + breakdown from index frontmatter', () => {
    const idx = `---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-04-28T18:15:00+08:00"
generator: control-tower-sync
total: 4
breakdown:
  IDEA: 1
  PLANNED: 1
  IN_PROGRESS: 1
  DONE: 1
---
`
    const s = parseBacklogStats(idx)
    expect(s.source).toBe('frontmatter')
    expect(s.total).toBe(4)
    expect(s.breakdown.IDEA).toBe(1)
  })

  it('legacy fallback derives from sectioned tables', () => {
    const legacy = `# Backlog

## ✅ 已完成

| ID | 標題 | 優先級 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| PLAN-200 | t1 | High | 2026-04-01 | [link](PLAN-200.md) |

## 💡 想法

| ID | 標題 | 優先級 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| PLAN-201 | t2 | Low | 2026-04-02 | [link](PLAN-201.md) |
`
    const s = parseBacklogStats(legacy)
    expect(s.source).toBe('legacy_markdown')
    expect(s.total).toBe(2)
    expect(s.breakdown.DONE).toBe(1)
    expect(s.breakdown.IDEA).toBe(1)
  })
})
