import { describe, it, expect } from 'vitest'
import { parseBugFile, parseBugTrackerStats } from '../bug-tracker'

const BUG_FRONTMATTER = `---
schema_version: 1
schema_kind: bug
id: BUG-099
title: Frontmatter bug case
status: VERIFY
severity: high
created_at: "2026-04-28T10:00:00+08:00"
links:
  related_workorders:
    - T9100
---

# 🐛 BUG-099：Frontmatter bug case

| 欄位 | 值 |
|------|----|
| 狀態 | 🧪 VERIFY |
| 嚴重度 | High |
`

const BUG_LEGACY = `# 🐛 BUG-100：Legacy bug case

- **狀態**：✅ FIXED
- **嚴重度**：Medium
- **修復時間**：2026-04-20
- **修復工單**：T9101
`

const BUG_DRIFT = `---
schema_version: 1
schema_kind: bug
id: BUG-101
title: Drift case
status: FIXED
severity: medium
created_at: "2026-04-28T10:00:00+08:00"
---

# 🐛 BUG-101：Drift case

- **狀態**：🔴 OPEN
- **嚴重度**：Medium
`

const BUG_INVALID = `---
schema_version: 1
schema_kind: bug
id: BUG-102
title: Invalid status case
status: TRIAGE
severity: low
created_at: "2026-04-28T10:00:00+08:00"
---

# 🐛 BUG-102：Invalid status case
`

describe('parseBugFile — case A: pure frontmatter', () => {
  it('reads status, severity, related WO from frontmatter', () => {
    const e = parseBugFile(BUG_FRONTMATTER, 'BUG-099-frontmatter.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('VERIFY')
    expect(e?.severity).toBe('High')
    expect(e?.relatedWorkOrder).toBe('T9100')
    expect(e?.parseWarnings).toBeUndefined()
  })
})

describe('parseBugFile — case B: legacy fallback', () => {
  it('reads from body bullet list when no frontmatter', () => {
    const e = parseBugFile(BUG_LEGACY, '_archive/bugs/BUG-100-legacy.md')
    expect(e?.parseSource).toBe('legacy_markdown')
    expect(e?.status).toBe('FIXED')
    expect(e?.severity).toBe('Medium')
    expect(e?.relatedWorkOrder).toBe('T9101')
    expect(e?.parseWarnings?.[0].kind).toBe('missing_frontmatter')
  })
})

describe('parseBugFile — case C: drift', () => {
  it('frontmatter wins, drift warning attached', () => {
    const e = parseBugFile(BUG_DRIFT, 'BUG-101-drift.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('FIXED')
    expect(e?.parseWarnings?.find(w => w.kind === 'metadata_drift')).toBeDefined()
  })
})

describe('parseBugFile — case D: invalid status', () => {
  it('unknown enum does NOT silently bucket as OPEN; archived defaults CLOSED', () => {
    const e = parseBugFile(BUG_INVALID, '_archive/bugs/BUG-102-invalid.md')
    expect(e?.parseSource).toBe('frontmatter')
    expect(e?.status).toBe('CLOSED') // archived fallback when fm status invalid
    expect(e?.parseWarnings?.find(w => w.kind === 'unknown_status')).toBeDefined()
  })

  it('non-archived path with invalid fm status falls back to OPEN bucket', () => {
    const e = parseBugFile(BUG_INVALID, 'BUG-102-invalid.md')
    expect(e?.status).toBe('OPEN')
    expect(e?.parseWarnings?.find(w => w.kind === 'unknown_status')).toBeDefined()
  })
})

// ─── Index frontmatter stats ────────────────────────────────────────────────

describe('parseBugTrackerStats', () => {
  it('reads total + breakdown from index frontmatter', () => {
    const idx = `---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-04-28T18:15:00+08:00"
generator: control-tower-sync
total: 5
breakdown:
  OPEN: 2
  CLOSED: 3
---

# Bug Tracker
`
    const s = parseBugTrackerStats(idx)
    expect(s.source).toBe('frontmatter')
    expect(s.total).toBe(5)
    expect(s.breakdown.OPEN).toBe(2)
    expect(s.breakdown.CLOSED).toBe(3)
  })

  it('legacy fallback derives counts from sectioned tables', () => {
    const legacy = `# Bug Tracker

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 報修時間 | 連結 |
|----|------|--------|----------|------|
| BUG-200 | t1 | High | 2026-04-01 | [link](BUG-200.md) |
| BUG-201 | t2 | Low | 2026-04-02 | [link](BUG-201.md) |

## 🚫 已關閉

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|----------|------|
| BUG-202 | t3 | Medium | 2026-04-10 | [link](BUG-202.md) |
`
    const s = parseBugTrackerStats(legacy)
    expect(s.source).toBe('legacy_markdown')
    expect(s.total).toBe(3)
    expect(s.breakdown.OPEN).toBe(2)
    expect(s.breakdown.CLOSED).toBe(1)
  })

  it('flags drift when frontmatter total ≠ sum(breakdown)', () => {
    const idx = `---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-04-28T18:15:00+08:00"
generator: control-tower-sync
total: 100
breakdown:
  OPEN: 1
  CLOSED: 1
---
`
    const s = parseBugTrackerStats(idx)
    expect(s.warnings.find(w => w.kind === 'metadata_drift')).toBeDefined()
    // breakdown wins per spec
    expect(s.total).toBe(2)
  })
})
