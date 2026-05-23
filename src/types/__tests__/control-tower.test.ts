import { describe, it, expect } from 'vitest'
import { isWorkOrderFile, parseWorkOrder, statusColor, statusLabel } from '../control-tower'

const FRONTMATTER_DONE = `---
schema_version: 1
schema_kind: workorder
id: T9001
title: Frontmatter happy path
type: impl
status: DONE
created_at: "2026-04-28T18:25:00+08:00"
completed_at: "2026-04-28T19:05:00+08:00"
sizing: M
project: PLAN-034
---

# T9001 — Frontmatter happy path

## Metadata

| 欄位 | 內容 |
|------|------|
| 狀態 | ✅ DONE |
`

// Mirrors the actual on-disk T0313/T0314 layout: no frontmatter, status only
// in the body metadata table. Sprint 3 must keep this working until Sprint 4
// migration runs.
const LEGACY_TABLE_DONE = `# T0313 — Legacy table layout

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0313 |
| 任務名稱 | Legacy table layout |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-25 10:00 |
| 完成時間 | 2026-04-25 15:30 |
`

const FRONTMATTER_BODY_DRIFT = `---
schema_version: 1
schema_kind: workorder
id: T9002
title: Drift case
status: DONE
created_at: "2026-04-28T18:25:00+08:00"
---

# T9002 — Drift case

## Metadata

| 欄位 | 內容 |
|------|------|
| 狀態 | 📋 PENDING |
`

const FRONTMATTER_INVALID_STATUS = `---
schema_version: 1
schema_kind: workorder
id: T9003
title: Invalid status
status: NEW
created_at: "2026-04-28T18:25:00+08:00"
---

# T9003 — Invalid status

| 狀態 | NEW |
`

const FRONTMATTER_ABANDONED = `---
schema_version: 1
schema_kind: workorder
id: CP-T1148
title: Cross-project abandoned fixture
type: fix
status: ABANDONED
created_at: "2026-05-23T20:03:20+08:00"
updated_at: "2026-05-23T20:13:40+08:00"
---

# CP-T1148 — Cross-project abandoned fixture

## Metadata

| 欄位 | 內容 |
|------|------|
| 狀態 | 🚫 ABANDONED |
`

const FRONTMATTER_BAD_YAML = `---
schema_version: 1
schema_kind: workorder
  bad: [unclosed
---

# T9004
`

describe('parseWorkOrder — case A: pure frontmatter', () => {
  it('reads status, title, sizing from frontmatter', () => {
    const wo = parseWorkOrder('T9001-frontmatter.md', FRONTMATTER_DONE)
    expect(wo.parseSource).toBe('frontmatter')
    expect(wo.status).toBe('DONE')
    expect(wo.title).toBe('Frontmatter happy path')
    expect(wo.estimatedSize).toBe('M')
    expect(wo.targetSubproject).toBe('PLAN-034')
    expect(wo.completedAt).toBe('2026-04-28T19:05:00+08:00')
    // Body has matching status — no drift warning
    expect(wo.parseWarnings).toBeUndefined()
  })
})

describe('parseWorkOrder — case B: legacy markdown fallback', () => {
  it('reads status from body table when no frontmatter', () => {
    const wo = parseWorkOrder('T0313-legacy.md', LEGACY_TABLE_DONE)
    expect(wo.parseSource).toBe('legacy_markdown')
    expect(wo.status).toBe('DONE')
    expect(wo.id).toBe('T0313')
    expect(wo.parseWarnings?.[0].kind).toBe('missing_frontmatter')
  })
})

describe('parseWorkOrder — case C: frontmatter / body drift', () => {
  it('frontmatter wins, attaches metadata_drift warning', () => {
    const wo = parseWorkOrder('T9002-drift.md', FRONTMATTER_BODY_DRIFT)
    expect(wo.parseSource).toBe('frontmatter')
    expect(wo.status).toBe('DONE') // frontmatter wins
    const driftWarning = wo.parseWarnings?.find(w => w.kind === 'metadata_drift')
    expect(driftWarning).toBeDefined()
    expect(driftWarning?.field).toBe('status')
    expect(driftWarning?.frontmatter_value).toBe('DONE')
  })
})

describe('parseWorkOrder — ABANDONED final/inactive workorder status', () => {
  it('accepts ABANDONED frontmatter for CP-T#### workorders', () => {
    const wo = parseWorkOrder('CP-T1148-abandoned-fixture.md', FRONTMATTER_ABANDONED)
    expect(wo.parseSource).toBe('frontmatter')
    expect(wo.id).toBe('CP-T1148')
    expect(wo.status).toBe('ABANDONED')
    expect(wo.status).not.toBe('PENDING')
    expect(wo.status).not.toBe('BLOCKED')
    expect(wo.status).not.toBe('PARTIAL')
    expect(wo.parseWarnings).toBeUndefined()
  })

  it('exposes a neutral abandoned badge class and label', () => {
    expect(statusColor('ABANDONED')).toBe('ct-status-abandoned')
    expect(statusLabel('ABANDONED')).toBe('🚫 Abandoned')
  })

  it('recognizes both T#### and CP-T#### markdown files as workorders', () => {
    expect(isWorkOrderFile('T0001-normal-workorder.md')).toBe(true)
    expect(isWorkOrderFile('CP-T1148-cross-project-workorder.md')).toBe(true)
    expect(isWorkOrderFile('BUG-001-not-workorder.md')).toBe(false)
  })
})

describe('parseWorkOrder — case D: invalid frontmatter (regression guard for BUG-077)', () => {
  it('unknown status enum is marked INVALID, NEVER PENDING', () => {
    const wo = parseWorkOrder('T9003-invalid.md', FRONTMATTER_INVALID_STATUS)
    expect(wo.parseSource).toBe('frontmatter')
    expect(wo.status).toBe('INVALID')
    expect(wo.status).not.toBe('PENDING')
    const warn = wo.parseWarnings?.find(w => w.kind === 'unknown_status')
    expect(warn).toBeDefined()
  })

  it('malformed YAML falls back to legacy parser AND keeps invalid_frontmatter warning', () => {
    const wo = parseWorkOrder('T9004-bad-yaml.md', FRONTMATTER_BAD_YAML)
    expect(wo.parseSource).toBe('legacy_markdown')
    const warn = wo.parseWarnings?.find(w => w.kind === 'invalid_frontmatter')
    expect(warn).toBeDefined()
  })
})

describe('parseWorkOrder — BUG-077 regression', () => {
  it('T0313-style legacy file still resolves to DONE, not PENDING', () => {
    const wo = parseWorkOrder('T0313-something.md', LEGACY_TABLE_DONE)
    expect(wo.status).toBe('DONE')
    expect(wo.status).not.toBe('PENDING')
  })

  it('T0314-style frontmatter DONE never falls back to PENDING', () => {
    const t0314Like = `---
schema_version: 1
schema_kind: workorder
id: T0314
title: Hot zone work order
status: DONE
created_at: "2026-04-26T09:00:00+08:00"
completed_at: "2026-04-26T11:30:00+08:00"
---

# T0314 — Hot zone work order
`
    const wo = parseWorkOrder('T0314-hotzone.md', t0314Like)
    expect(wo.status).toBe('DONE')
  })
})
