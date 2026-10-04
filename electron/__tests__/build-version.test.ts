import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

// T0376 / D125 — version resolution for scripts/build-version.js (CommonJS).
// Lives here because electron/__tests__/ is already in vite.config.ts test.include.
const require = createRequire(import.meta.url)
const { resolveVersion, formatSnapshotVersion } = require('../../scripts/build-version.js') as {
  resolveVersion: (input: {
    env?: Record<string, string | undefined>
    pkgVersion?: string
    tags?: string[]
    now?: Date
  }) => { version: string; source: string; warnings: string[] }
  formatSnapshotVersion: (base: string, now: Date) => string
}

const NOW = new Date(2026, 9, 4, 20, 40, 34) // local time 2026-10-04 20:40:34

describe('resolveVersion', () => {
  it('VERSION env wins over package.json (CI path)', () => {
    const r = resolveVersion({ env: { VERSION: '0.5.9-pre.4' }, pkgVersion: '0.1.0', tags: ['v9.9.9'] })
    expect(r).toEqual({ version: '0.5.9-pre.4', source: 'env', warnings: [] })
  })

  it('strips a leading v from VERSION env (pre-release.yml passes v<version>)', () => {
    expect(resolveVersion({ env: { VERSION: 'v0.5.9-pre.4' }, pkgVersion: '0.1.0' }).version).toBe('0.5.9-pre.4')
    expect(resolveVersion({ env: { VERSION: 'v1.2.3' } }).version).toBe('1.2.3')
  })

  it('ignores an empty VERSION env', () => {
    expect(resolveVersion({ env: { VERSION: '' }, pkgVersion: '0.5.9' }).source).toBe('package.json')
  })

  it('falls back to package.json version, keeping the -pre.N suffix', () => {
    const r = resolveVersion({ env: {}, pkgVersion: '0.5.9-pre.4', tags: [] })
    expect(r).toEqual({ version: '0.5.9-pre.4', source: 'package.json', warnings: [] })
  })

  it('does not warn when a HEAD v* tag matches package.json (prerelease suffix kept)', () => {
    const r = resolveVersion({ env: {}, pkgVersion: '0.5.9-pre.4', tags: ['v0.5.9-pre.4'] })
    expect(r.version).toBe('0.5.9-pre.4')
    expect(r.warnings).toEqual([])
  })

  it('warns and keeps package.json when a HEAD v* tag disagrees', () => {
    const r = resolveVersion({ env: {}, pkgVersion: '0.5.9-pre.4', tags: ['v0.5.9-pre.3'] })
    expect(r.version).toBe('0.5.9-pre.4')
    expect(r.source).toBe('package.json')
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('v0.5.9-pre.3')
    expect(r.warnings[0]).toContain('0.5.9-pre.4')
  })

  it('accepts any matching tag when HEAD carries several', () => {
    const r = resolveVersion({ env: {}, pkgVersion: '0.5.9', tags: ['v4.0.3', 'v0.5.9'] })
    expect(r.warnings).toEqual([])
  })

  it('ignores non-version tags', () => {
    const r = resolveVersion({ env: {}, pkgVersion: '0.5.9', tags: ['vnext', 'server-bundle-v0.5.8'] })
    expect(r.warnings).toEqual([])
  })

  it('throws when neither VERSION env nor package.json version exist (no silent timestamp)', () => {
    expect(() => resolveVersion({ env: {}, pkgVersion: '' })).toThrow(/VERSION/)
    expect(() => resolveVersion({ env: {}, pkgVersion: undefined })).toThrow(/VERSION/)
  })

  it('produces a snapshot version only when BAT_VERSION_SNAPSHOT=1', () => {
    const r = resolveVersion({ env: { BAT_VERSION_SNAPSHOT: '1' }, pkgVersion: '0.5.9-pre.4', now: NOW })
    expect(r).toEqual({ version: '0.5.9-pre.4.local.261004204034', source: 'snapshot', warnings: [] })
  })

  it('VERSION env still wins over BAT_VERSION_SNAPSHOT', () => {
    const r = resolveVersion({ env: { VERSION: '1.0.0', BAT_VERSION_SNAPSHOT: '1' }, pkgVersion: '0.5.9', now: NOW })
    expect(r.version).toBe('1.0.0')
  })
})

describe('formatSnapshotVersion', () => {
  it('appends -local.<yyMMddHHmmss> to a release version', () => {
    expect(formatSnapshotVersion('0.5.9', NOW)).toBe('0.5.9-local.261004204034')
  })

  it('extends an existing prerelease with .local.<stamp>', () => {
    expect(formatSnapshotVersion('0.5.9-pre.4', NOW)).toBe('0.5.9-pre.4.local.261004204034')
  })

  it('zero-pads every field', () => {
    expect(formatSnapshotVersion('0.5.9', new Date(2027, 0, 2, 3, 4, 5))).toBe('0.5.9-local.270102030405')
  })

  it('never sorts above the base version (stays a prerelease, unlike the old 1.yy.* stamp)', () => {
    const v = formatSnapshotVersion('0.5.9', NOW)
    expect(v.startsWith('0.5.9-')).toBe(true)
    expect(v.startsWith('1.')).toBe(false)
  })
})
