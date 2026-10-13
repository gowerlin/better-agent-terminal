// T0492 — src/lib/snapshot-version.ts is the single SoT for the local snapshot
// suffix rule; scripts/build-version.js requires the same file.

import { createRequire } from 'node:module'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { stripSnapshotSuffix } from '../snapshot-version'

const require = createRequire(import.meta.url)
const buildVersion = require(path.join(__dirname, '..', '..', '..', 'scripts', 'build-version.js'))

describe('stripSnapshotSuffix', () => {
  it('strips -local.<yyMMddHHmmss> and .local.<yyMMddHHmmss>', () => {
    expect(stripSnapshotSuffix('0.5.9-local.261004204034')).toBe('0.5.9')
    expect(stripSnapshotSuffix('0.6.0-pre.4.local.261013234500')).toBe('0.6.0-pre.4')
  })

  it('leaves real versions and look-alikes unchanged', () => {
    for (const v of ['0.6.0-pre.4', '0.5.9', '4.0.3-pre.1', '0.6.0-local', '0.6.0-local.1', '0.6.0-local.2610132345']) {
      expect(stripSnapshotSuffix(v)).toBe(v)
    }
  })

  it('inverts build-version.js formatSnapshotVersion', () => {
    const now = new Date(2026, 9, 13, 23, 45, 0)
    for (const base of ['0.5.9', '0.6.0-pre.4']) {
      expect(stripSnapshotSuffix(buildVersion.formatSnapshotVersion(base, now))).toBe(base)
    }
  })

  it('build-version.js re-exports this implementation (no second regex)', () => {
    expect(buildVersion.stripSnapshotSuffix('0.6.0-pre.4.local.261013234500')).toBe('0.6.0-pre.4')
    expect(buildVersion.stripSnapshotSuffix('0.6.0-local.1')).toBe('0.6.0-local.1')
  })
})
