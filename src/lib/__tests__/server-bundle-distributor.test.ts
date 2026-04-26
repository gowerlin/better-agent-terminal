// PLAN-031 / T0320 — pure helper tests for server-bundle-distributor module.
//
// Only covers pure functions exported from
// `src/lib/server-bundle-distributor-helpers.ts`. The full three-layer
// distributor flow (electron/remote/server-bundle-distributor.ts) involves
// fs + electron `app` + T0319/T0318 integration and is integration-tested in
// Sprint 5 (out of scope per 工單 §244-250).

import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyDistributeError,
  expectedTarballFilename,
  resolveDefaultPaths,
  shouldFallbackToDownload,
} from '../server-bundle-distributor-helpers'

describe('expectedTarballFilename', () => {
  it('builds linux-x64 filename for stable version', () => {
    expect(expectedTarballFilename('linux-x64', '0.5.0')).toBe(
      'bat-server-linux-x64-v0.5.0.tar.gz',
    )
  })

  it('builds linux-arm64 filename for pre-release version', () => {
    expect(expectedTarballFilename('linux-arm64', '0.5.0-pre.1')).toBe(
      'bat-server-linux-arm64-v0.5.0-pre.1.tar.gz',
    )
  })

  it('builds darwin-arm64 filename for stable version', () => {
    expect(expectedTarballFilename('darwin-arm64', '1.2.3')).toBe(
      'bat-server-darwin-arm64-v1.2.3.tar.gz',
    )
  })

  it('round-trips arch + version into filename pattern parseable by suffix check', () => {
    const f = expectedTarballFilename('linux-x64', '0.5.0-rc.4')
    expect(f.endsWith('.tar.gz')).toBe(true)
    expect(f).toContain('linux-x64')
    expect(f).toContain('v0.5.0-rc.4')
  })
})

describe('resolveDefaultPaths', () => {
  it('joins macOS-style userData + resourcesPath', () => {
    const paths = resolveDefaultPaths({
      userDataDir: '/Users/x/Library/Application Support/bat',
      resourcesPath: '/Applications/bat.app/Contents/Resources',
    })
    expect(paths.cacheDir).toBe(
      path.join('/Users/x/Library/Application Support/bat', 'bat-server-bundles'),
    )
    expect(paths.baselineDir).toBe(
      path.join('/Applications/bat.app/Contents/Resources', 'bat-server-baseline'),
    )
  })

  it('joins Windows-style userData + resourcesPath', () => {
    const paths = resolveDefaultPaths({
      userDataDir: 'C:\\Users\\x\\AppData\\Roaming\\bat',
      resourcesPath: 'C:\\Program Files\\bat\\resources',
    })
    expect(paths.cacheDir).toBe(
      path.join('C:\\Users\\x\\AppData\\Roaming\\bat', 'bat-server-bundles'),
    )
    expect(paths.baselineDir).toBe(
      path.join('C:\\Program Files\\bat\\resources', 'bat-server-baseline'),
    )
  })

  it('joins Linux-style userData + resourcesPath', () => {
    const paths = resolveDefaultPaths({
      userDataDir: '/home/x/.config/bat',
      resourcesPath: '/opt/bat/resources',
    })
    expect(paths.cacheDir).toBe(path.join('/home/x/.config/bat', 'bat-server-bundles'))
    expect(paths.baselineDir).toBe(path.join('/opt/bat/resources', 'bat-server-baseline'))
  })
})

describe('classifyDistributeError', () => {
  it('baseline layer → baseline-corrupted with actionable message', () => {
    const result = classifyDistributeError(
      'baseline',
      'expected SHA abc... actual def...',
    )
    expect(result.errorCode).toBe('baseline-corrupted')
    expect(result.error).toContain('Baseline tarball corrupted')
    expect(result.error).toContain('Run installer again')
    expect(result.error).toContain('expected SHA abc')
  })

  it('download layer → download-failed wrapping inner error', () => {
    const result = classifyDistributeError(
      'download',
      'rate-limited: GitHub rate limit exceeded',
    )
    expect(result.errorCode).toBe('download-failed')
    expect(result.error).toContain('Download fallback failed')
    expect(result.error).toContain('rate-limited')
  })

  it('cache layer (reserved) → no-source-available with cache prefix', () => {
    const result = classifyDistributeError('cache', 'mkdir EACCES')
    expect(result.errorCode).toBe('no-source-available')
    expect(result.error).toContain('Cache layer error')
    expect(result.error).toContain('mkdir EACCES')
  })

  it('preserves inner error verbatim across all layers', () => {
    const inner = 'manifest-fetch-failed: HTTP 404 for https://example.com/manifest.json'
    expect(classifyDistributeError('download', inner).error).toContain(inner)
    expect(classifyDistributeError('baseline', inner).error).toContain(inner)
    expect(classifyDistributeError('cache', inner).error).toContain(inner)
  })
})

describe('shouldFallbackToDownload', () => {
  it('missing-manifest → fallback to download (legitimate baseline gap)', () => {
    expect(shouldFallbackToDownload('missing-manifest')).toBe(true)
  })

  it('missing-tarball → fallback to download (cross-arch baseline lacks this arch)', () => {
    expect(shouldFallbackToDownload('missing-tarball')).toBe(true)
  })

  it('corrupted → do NOT fallback (fail-closed; installer integrity issue)', () => {
    expect(shouldFallbackToDownload('corrupted')).toBe(false)
  })
})
