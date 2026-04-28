/**
 * PLAN-034 Sprint 5 / T0346 — drift telemetry unit tests
 * Relocated from src/utils/__tests__/ to electron/__tests__/ by T0348 (BUG-078).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { logDrift, readRecentDrift, defaultDriftLogPath } from '../ct-drift-telemetry'
import type { ParseWarning } from '../../src/utils/ct-frontmatter'

let tmpDir: string
let logFile: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ct-drift-'))
  logFile = join(tmpDir, 'ct-drift.log')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('ct-drift-telemetry', () => {
  it('appends one line per warning to the log file', () => {
    const warnings: ParseWarning[] = [
      {
        kind: 'metadata_drift',
        field: 'status',
        frontmatter_value: 'DONE',
        body_value: 'IN_PROGRESS',
      },
      { kind: 'unknown_status', field: 'status', frontmatter_value: 'WHATEVER' },
    ]

    const written = logDrift('T9999-foo.md', warnings, { logFile })
    expect(written).toBe(2)
    expect(existsSync(logFile)).toBe(true)

    const content = readFileSync(logFile, 'utf8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('T9999-foo.md')
    expect(lines[0]).toContain('metadata_drift')
    expect(lines[0]).toContain('DONE')
    expect(lines[0]).toContain('IN_PROGRESS')
    expect(lines[1]).toContain('unknown_status')
    expect(lines[1]).toContain('WHATEVER')
  })

  it('is a no-op for empty / undefined warnings', () => {
    expect(logDrift('x.md', undefined, { logFile })).toBe(0)
    expect(logDrift('x.md', [], { logFile })).toBe(0)
    expect(existsSync(logFile)).toBe(false)
  })

  it('readRecentDrift filters by lookback window', () => {
    const oldTs = new Date('2026-01-01T00:00:00Z')
    const recentTs = new Date('2026-04-28T00:00:00Z')

    logDrift('a.md', [{ kind: 'unknown_status', field: 'status' }], {
      logFile,
      now: () => oldTs,
    })
    logDrift('b.md', [{ kind: 'metadata_drift', field: 'status' }], {
      logFile,
      now: () => recentTs,
    })

    // 7-day window relative to recentTs: should drop the old entry.
    const entries = readRecentDrift({
      logFile,
      days: 7,
      now: () => new Date('2026-04-29T00:00:00Z'),
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.file).toBe('b.md')
    expect(entries[0]?.kind).toBe('metadata_drift')
  })

  it('readRecentDrift returns [] when log is absent', () => {
    expect(readRecentDrift({ logFile, days: 7 })).toEqual([])
  })

  it('sanitizes pipe and newline characters in values', () => {
    logDrift(
      'T1.md',
      [
        {
          kind: 'metadata_drift',
          field: 'status',
          frontmatter_value: 'DONE | suspicious',
          body_value: 'IN\nPROGRESS',
        },
      ],
      { logFile },
    )
    const content = readFileSync(logFile, 'utf8').trim()
    // Exactly one line; pipes-in-values were collapsed so split() yields 6 parts.
    expect(content.split('\n')).toHaveLength(1)
    const cells = content.split(' | ')
    expect(cells).toHaveLength(6)
    expect(cells[4]).toBe('DONE   suspicious')
    expect(cells[5]).toBe('IN PROGRESS')
  })

  it('defaultDriftLogPath uses userDataDir when provided', () => {
    const p = defaultDriftLogPath('/tmp/fake-userdata')
    expect(p).toMatch(/[\\\/]tmp[\\\/]fake-userdata[\\\/]ct-drift\.log$/)
  })

  it('logDrift writes under userDataDir when provided (no logFile override)', () => {
    const userDataDir = join(tmpDir, 'userdata')
    const written = logDrift('T2.md', [{ kind: 'unknown_status', field: 'status' }], {
      userDataDir,
    })
    expect(written).toBe(1)
    expect(existsSync(join(userDataDir, 'ct-drift.log'))).toBe(true)
  })
})
