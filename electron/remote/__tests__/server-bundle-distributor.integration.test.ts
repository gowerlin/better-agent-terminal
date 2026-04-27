// PLAN-031 / T0325 — Integration tests for server-bundle distributor.
//
// Strategy (per T0325 §70-90):
//   * Real tmp `cacheDir` and `baselineDir` (no fs mocking — exercise the real
//     read/write/copy paths).
//   * vi.mock('../arch-detect') to stub `detectRemoteArch` so we don't shell
//     out to wsl/docker/ssh.
//   * vi.mock('../server-bundle-download') to stub `downloadServerBundle` and
//     verify the distributor's fallback wiring without exercising fetch.
//   * vi.mock('electron') to stub `app` (we override version/cacheDir/
//     baselineDir explicitly so app methods are never called, but the import
//     still needs to resolve in vitest).
//
// Coverage: ≥8 cases — cache hit, baseline hit, baseline corrupted (fail-
// closed), baseline missing-manifest fallback, baseline missing-tarball
// fallback, full download fallback, arch detection failure, abort during
// baseline SHA verify.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.5.0',
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../arch-detect', () => ({
  detectRemoteArch: vi.fn(),
}))

vi.mock('../server-bundle-download', () => ({
  downloadServerBundle: vi.fn(),
}))

import { distributeServerBundle } from '../server-bundle-distributor'
import { detectRemoteArch } from '../arch-detect'
import { downloadServerBundle } from '../server-bundle-download'
import type { ProfileEntry } from '../../profile-manager'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VERSION = '0.5.0'
const ARCH = 'linux-x64' as const

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function makeTarball(arch: string, version: string): Buffer {
  return Buffer.from(`fake-tarball::${arch}::v${version}::${'p'.repeat(1024)}`)
}

interface BaselineFixture {
  manifest: {
    schemaVersion: '1'
    version: string
    buildDate: string
    tarballs: Record<string, { filename: string; sha256: string; size: number }>
  }
  tarballs: Record<string, Buffer>
}

function makeBaselineFixture(version: string = VERSION): BaselineFixture {
  const archs: ReadonlyArray<'linux-x64' | 'linux-arm64' | 'darwin-arm64'> = [
    'linux-x64',
    'linux-arm64',
    'darwin-arm64',
  ]
  const tarballs: Record<string, Buffer> = {}
  const entries: Record<string, { filename: string; sha256: string; size: number }> = {}
  for (const arch of archs) {
    const tar = makeTarball(arch, version)
    tarballs[arch] = tar
    entries[arch] = {
      filename: `bat-server-${arch}-v${version}.tar.gz`,
      sha256: sha256Hex(tar),
      size: tar.length,
    }
  }
  return {
    manifest: {
      schemaVersion: '1',
      version,
      buildDate: '2026-04-01T00:00:00.000Z',
      tarballs: entries,
    },
    tarballs,
  }
}

async function writeBaseline(
  baselineDir: string,
  fixture: BaselineFixture,
  opts: { skipManifest?: boolean; skipArch?: 'linux-x64' | 'linux-arm64' | 'darwin-arm64' } = {},
): Promise<void> {
  await fs.mkdir(baselineDir, { recursive: true })
  if (!opts.skipManifest) {
    await fs.writeFile(
      path.join(baselineDir, 'manifest.json'),
      JSON.stringify(fixture.manifest),
    )
  }
  for (const [arch, buf] of Object.entries(fixture.tarballs)) {
    if (arch === opts.skipArch) continue
    await fs.writeFile(path.join(baselineDir, fixture.manifest.tarballs[arch].filename), buf)
  }
}

function makeProfile(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 'test-profile',
    name: 'Test SSH',
    targetOS: 'ssh-linux',
    sshServerArch: ARCH,
    ...overrides,
  } as ProfileEntry
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let cacheDir: string
let baselineDir: string
const ORIGINAL_RESOURCES_PATH = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath

beforeEach(async () => {
  cacheDir = path.join(os.tmpdir(), `bat-test-cache-${randomUUID()}`)
  baselineDir = path.join(os.tmpdir(), `bat-test-baseline-${randomUUID()}`)
  // process.resourcesPath is undefined outside Electron — distributor calls
  // resolveDefaultPaths even when caller overrides cacheDir/baselineDir.
  ;(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = os.tmpdir()
  // Default: arch detection succeeds, returns linux-x64.
  vi.mocked(detectRemoteArch).mockResolvedValue({ ok: true, arch: ARCH })
  // Default: download fallback returns success — overridden per-test as needed.
  vi.mocked(downloadServerBundle).mockResolvedValue({
    ok: true,
    tarballPath: '/tmp/synthetic-download.tar.gz',
    sha256: 'a'.repeat(64),
    sizeBytes: 1234,
    fromCache: false,
  })
})

afterEach(async () => {
  vi.clearAllMocks()
  if (ORIGINAL_RESOURCES_PATH === undefined) {
    delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  } else {
    ;(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
      ORIGINAL_RESOURCES_PATH
  }
  for (const dir of [cacheDir, baselineDir]) {
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch {
      // best-effort
    }
  }
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('distributeServerBundle integration', () => {
  it('cache hit: existing cached tarball matches baseline manifest SHA → source:cache', async () => {
    const fix = makeBaselineFixture()
    await writeBaseline(baselineDir, fix)
    // Pre-populate cache with the same tarball.
    await fs.mkdir(cacheDir, { recursive: true })
    const cachedFile = path.join(cacheDir, fix.manifest.tarballs[ARCH].filename)
    await fs.writeFile(cachedFile, fix.tarballs[ARCH])

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('cache')
    expect(result.tarballPath).toBe(cachedFile)
    expect(result.arch).toBe(ARCH)
    expect(downloadServerBundle).not.toHaveBeenCalled()
  })

  it('baseline hit: cache miss + valid baseline → source:baseline + auto copy to cache', async () => {
    const fix = makeBaselineFixture()
    await writeBaseline(baselineDir, fix)

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('baseline')
    expect(result.sha256).toBe(fix.manifest.tarballs[ARCH].sha256)

    // Verify baseline → cache copy happened (best-effort, asynchronous on real
    // FS but distributor awaits copyBaselineToCache before returning).
    const expectedCachePath = path.join(cacheDir, fix.manifest.tarballs[ARCH].filename)
    const cached = await fs.readFile(expectedCachePath)
    expect(cached.equals(fix.tarballs[ARCH])).toBe(true)
    expect(downloadServerBundle).not.toHaveBeenCalled()
  })

  it('baseline corrupted: tarball SHA mismatch → fail-closed (no download fallback)', async () => {
    const fix = makeBaselineFixture()
    // Write manifest claiming valid SHA but plant a corrupted tarball file
    // (same size, different content) so the SHA verify fails.
    await fs.mkdir(baselineDir, { recursive: true })
    await fs.writeFile(
      path.join(baselineDir, 'manifest.json'),
      JSON.stringify(fix.manifest),
    )
    const corruptedSize = fix.manifest.tarballs[ARCH].size
    const corrupted = Buffer.alloc(corruptedSize, 0x77)
    await fs.writeFile(
      path.join(baselineDir, fix.manifest.tarballs[ARCH].filename),
      corrupted,
    )
    // Other archs can be valid (don't matter for this test).
    for (const otherArch of ['linux-arm64', 'darwin-arm64'] as const) {
      await fs.writeFile(
        path.join(baselineDir, fix.manifest.tarballs[otherArch].filename),
        fix.tarballs[otherArch],
      )
    }

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('baseline-corrupted')
    // Critical: must NOT fall back to download.
    expect(downloadServerBundle).not.toHaveBeenCalled()
  })

  it('baseline missing-manifest: no manifest.json → fall through to download', async () => {
    // Empty baselineDir (no manifest.json).
    await fs.mkdir(baselineDir, { recursive: true })

    const expectedFilename = `bat-server-${ARCH}-v${VERSION}.tar.gz`
    vi.mocked(downloadServerBundle).mockResolvedValue({
      ok: true,
      tarballPath: path.join(cacheDir, expectedFilename),
      sha256: 'b'.repeat(64),
      sizeBytes: 4096,
      fromCache: false,
    })

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('download')
    expect(downloadServerBundle).toHaveBeenCalledOnce()
  })

  it('baseline missing-tarball: manifest present but tarball file absent → fall through to download', async () => {
    const fix = makeBaselineFixture()
    // Write manifest but skip writing the linux-x64 tarball.
    await fs.mkdir(baselineDir, { recursive: true })
    await fs.writeFile(
      path.join(baselineDir, 'manifest.json'),
      JSON.stringify(fix.manifest),
    )
    // Only write the other archs — linux-x64 missing.
    for (const otherArch of ['linux-arm64', 'darwin-arm64'] as const) {
      await fs.writeFile(
        path.join(baselineDir, fix.manifest.tarballs[otherArch].filename),
        fix.tarballs[otherArch],
      )
    }

    vi.mocked(downloadServerBundle).mockResolvedValue({
      ok: true,
      tarballPath: '/tmp/downloaded.tar.gz',
      sha256: 'c'.repeat(64),
      sizeBytes: 2048,
      fromCache: false,
    })

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('download')
    expect(downloadServerBundle).toHaveBeenCalledOnce()
  })

  it('download fallback: no cache, no baseline at all → source:download', async () => {
    // Neither dir populated.
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.mkdir(baselineDir, { recursive: true })

    vi.mocked(downloadServerBundle).mockResolvedValue({
      ok: true,
      tarballPath: '/tmp/downloaded.tar.gz',
      sha256: 'd'.repeat(64),
      sizeBytes: 9999,
      fromCache: false,
    })

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('download')
    expect(downloadServerBundle).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(downloadServerBundle).mock.calls[0][0]
    expect(callArgs.arch).toBe(ARCH)
    expect(callArgs.version).toBe(VERSION)
    expect(callArgs.cacheDir).toBe(cacheDir)
  })

  it('arch detection failed: profile missing sshServerArch → arch-detection-failed', async () => {
    vi.mocked(detectRemoteArch).mockResolvedValue({
      ok: false,
      error: 'SSH profile has no cached serverArch — run verify-auth first.',
      errorCode: 'no-state',
    })

    const result = await distributeServerBundle({
      profile: makeProfile({ sshServerArch: undefined }),
      version: VERSION,
      cacheDir,
      baselineDir,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('arch-detection-failed')
    // Should not have attempted download.
    expect(downloadServerBundle).not.toHaveBeenCalled()
  })

  it('abort during baseline SHA verify: AbortSignal triggered before start → aborted', async () => {
    const fix = makeBaselineFixture()
    await writeBaseline(baselineDir, fix)
    const ac = new AbortController()
    ac.abort()

    const result = await distributeServerBundle({
      profile: makeProfile(),
      version: VERSION,
      cacheDir,
      baselineDir,
      signal: ac.signal,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('aborted')
    expect(downloadServerBundle).not.toHaveBeenCalled()
  })
})
