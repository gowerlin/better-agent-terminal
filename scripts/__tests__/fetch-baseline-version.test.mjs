// T0488 / BUG-115 — fetch-baseline-tarball.mjs must resolve the server-bundle baseline
// to the base version of a local snapshot (`release.ps1 -Snapshot`): the snapshot
// version has no server-bundle release, and `npm run build`'s prebuild hook runs
// after build-version.js rewrote package.json to it.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import {
  baselineNotFoundHint,
  manifestMatchesVersion,
  resolveBaselineVersion,
} from '../fetch-baseline-tarball.mjs'

const require = createRequire(import.meta.url)
const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { formatSnapshotVersion, resolveVersion, stripSnapshotSuffix } = require(path.join(SCRIPTS, 'build-version.js'))

const NOW = new Date(2026, 9, 13, 23, 24, 11) // local time 2026-10-13 23:24:11

describe('stripSnapshotSuffix', () => {
  it('inverts formatSnapshotVersion for plain and prerelease bases', () => {
    for (const base of ['0.5.9', '0.6.0-pre.4', '1.2.3-rc.1']) {
      const snapshot = formatSnapshotVersion(base, NOW)
      expect(snapshot).not.toBe(base)
      expect(stripSnapshotSuffix(snapshot)).toBe(base)
    }
  })

  it('leaves real versions unchanged', () => {
    for (const v of ['0.6.0-pre.4', '0.5.9', '4.0.3-pre.1', '0.6.0-local', '0.6.0-local.1', '0.6.0-pre.local.x']) {
      expect(stripSnapshotSuffix(v)).toBe(v)
    }
  })

  it('only strips a trailing 12-digit stamp', () => {
    expect(stripSnapshotSuffix('0.6.0-pre.4.local.2610132324')).toBe('0.6.0-pre.4.local.2610132324')
    expect(stripSnapshotSuffix('0.6.0-local.261013232411.1')).toBe('0.6.0-local.261013232411.1')
  })
})

describe('resolveBaselineVersion', () => {
  it('snapshot package.json version → base version (the prebuild fetch in BUG-115)', () => {
    expect(resolveBaselineVersion({ pkgVersion: '0.6.0-pre.4.local.261013232411' })).toEqual({
      version: '0.6.0-pre.4',
      requested: '0.6.0-pre.4.local.261013232411',
      source: 'package.json',
      snapshot: true,
    })
    expect(resolveBaselineVersion({ pkgVersion: '0.5.9-local.261013232411' }).version).toBe('0.5.9')
  })

  it('a normal version is used as-is', () => {
    expect(resolveBaselineVersion({ pkgVersion: '0.6.0-pre.4' })).toEqual({
      version: '0.6.0-pre.4',
      requested: '0.6.0-pre.4',
      source: 'package.json',
      snapshot: false,
    })
    expect(resolveBaselineVersion({ pkgVersion: '0.5.9' }).version).toBe('0.5.9')
  })

  it('priority: --version → BAT_BASELINE_VERSION → package.json', () => {
    const env = { BAT_BASELINE_VERSION: '0.6.0-pre.3' }
    expect(resolveBaselineVersion({ argVersion: '0.6.0-pre.2', env, pkgVersion: '0.6.0-pre.4' })).toMatchObject({
      version: '0.6.0-pre.2',
      source: '--version',
    })
    expect(resolveBaselineVersion({ env, pkgVersion: '0.6.0-pre.4' })).toMatchObject({
      version: '0.6.0-pre.3',
      source: 'BAT_BASELINE_VERSION',
    })
    expect(resolveBaselineVersion({ env: { BAT_BASELINE_VERSION: '' }, pkgVersion: '0.6.0-pre.4' }).source).toBe(
      'package.json',
    )
  })

  it('strips a leading v and the snapshot suffix from every source', () => {
    expect(resolveBaselineVersion({ argVersion: 'v0.6.0-pre.4.local.261013232411' }).version).toBe('0.6.0-pre.4')
    expect(
      resolveBaselineVersion({ env: { BAT_BASELINE_VERSION: 'v0.6.0-pre.4.local.261013232411' }, pkgVersion: '0.1.0' })
        .version,
    ).toBe('0.6.0-pre.4')
  })

  it('ignores VERSION env (build / build:dir package package.json, not VERSION)', () => {
    expect(resolveBaselineVersion({ env: { VERSION: '9.9.9' }, pkgVersion: '0.6.0-pre.4' }).version).toBe('0.6.0-pre.4')
  })

  it('throws when there is no version at all', () => {
    expect(() => resolveBaselineVersion({ pkgVersion: '' })).toThrow(/no baseline version/)
    expect(() => resolveBaselineVersion({})).toThrow(/no baseline version/)
  })
})

describe('both fetches of one snapshot build resolve the same baseline', () => {
  const base = '0.6.0-pre.4'
  const snapshot = formatSnapshotVersion(base, NOW)

  it('release.ps1 -Snapshot (BAT_BASELINE_VERSION = resolved snapshot version)', () => {
    const env = { VERSION: snapshot, BAT_BASELINE_VERSION: snapshot }
    // 1st: build:release's fetch:baseline, package.json still at base
    expect(resolveBaselineVersion({ env, pkgVersion: base }).version).toBe(base)
    // 2nd: npm run build's prebuild, package.json rewritten by build-version.js
    expect(resolveBaselineVersion({ env, pkgVersion: snapshot }).version).toBe(base)
  })

  it('BAT_VERSION_SNAPSHOT=1 npm run build:release without release.ps1', () => {
    expect(resolveBaselineVersion({ pkgVersion: base }).version).toBe(base)
    expect(resolveBaselineVersion({ pkgVersion: snapshot }).version).toBe(base)
  })
})

describe('CI VERSION path of build-version.js is unchanged', () => {
  it('VERSION env still wins verbatim (minus v), snapshot flag ignored', () => {
    expect(
      resolveVersion({ env: { VERSION: 'v0.6.0-pre.5', BAT_VERSION_SNAPSHOT: '1' }, pkgVersion: '0.6.0-pre.4', now: NOW }),
    ).toEqual({ version: '0.6.0-pre.5', source: 'env', warnings: [] })
  })
})

describe('manifestMatchesVersion', () => {
  it('matches the manifest version field', () => {
    expect(manifestMatchesVersion(JSON.stringify({ version: '0.6.0-pre.4' }), '0.6.0-pre.4')).toBe(true)
    expect(manifestMatchesVersion(JSON.stringify({ version: 'v0.6.0-pre.4' }), '0.6.0-pre.4')).toBe(true)
  })

  it('rejects a manifest left over from another version, or an unreadable one', () => {
    expect(manifestMatchesVersion(JSON.stringify({ version: '0.5.9-pre.4' }), '0.6.0-pre.4')).toBe(false)
    expect(manifestMatchesVersion(JSON.stringify({}), '0.6.0-pre.4')).toBe(false)
    expect(manifestMatchesVersion('{not json', '0.6.0-pre.4')).toBe(false)
  })
})

describe('baselineNotFoundHint', () => {
  it('names the missing release and the override', () => {
    const hint = baselineNotFoundHint('0.6.0-pre.5')
    expect(hint).toContain('server-bundle-v0.6.0-pre.5')
    expect(hint).toContain('BAT_BASELINE_VERSION')
  })
})

describe('CLI --dry-run', () => {
  let tmp

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
    tmp = undefined
  })

  // stdout + stderr (console.warn) of a run that must exit 0
  const run = (args) => {
    const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'fetch-baseline-tarball.mjs'), ...args], {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, BAT_BASELINE_VERSION: '', GITHUB_TOKEN: '' },
    })
    expect(r.status, r.stderr).toBe(0)
    return r.stdout + r.stderr
  }

  it('plans the base version URLs for a snapshot version (no network)', () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'bat-fetch-baseline-'))
    const out = run([
      '--dry-run', '--host-os', 'win', '--host-arch', 'x64', '--output-dir', tmp,
      '--version', '0.6.0-pre.4.local.261013232411',
    ])
    expect(out).toContain('baseline v0.6.0-pre.4')
    expect(out).toContain(
      '/server-bundle-v0.6.0-pre.4/bat-server-linux-x64-v0.6.0-pre.4.tar.gz',
    )
    expect(out).toContain('/server-bundle-v0.6.0-pre.4/manifest.json')
    expect(out).not.toMatch(/local\.261013232411\//)
  })

  it('re-downloads a manifest.json left over from another version', () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'bat-fetch-baseline-'))
    writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({ version: '0.5.9-pre.4' }))
    const stale = run(['--dry-run', '--host-os', 'win', '--host-arch', 'x64', '--output-dir', tmp, '--version', '0.6.0-pre.4'])
    expect(stale).toContain('manifest.json is not for v0.6.0-pre.4')
    expect(stale).toContain('would download https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v0.6.0-pre.4/manifest.json')

    writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({ version: '0.6.0-pre.4' }))
    const fresh = run(['--dry-run', '--host-os', 'win', '--host-arch', 'x64', '--output-dir', tmp, '--version', '0.6.0-pre.4'])
    expect(fresh).toContain('manifest.json already present for v0.6.0-pre.4')
  })
})
