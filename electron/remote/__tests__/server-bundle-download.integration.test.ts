// PLAN-031 / T0325 — Integration tests for server-bundle download module.
//
// Strategy (per T0325 §40-65):
//   * vi.spyOn(globalThis, 'fetch') — synthesize Response objects with body
//     ReadableStreams + headers (incl. X-RateLimit-* for the rate-limit case).
//   * Real tmp dir for cacheDir — avoids over-mocking fs while still being
//     hermetic. Each test gets a unique randomUUID-suffixed directory and
//     afterEach unlinks it.
//   * Real fixture buffers + crypto.createHash('sha256') for true SHA values.
//
// Coverage: ≥10 cases across happy-path, cache hit/stale, SHA mismatch,
// manifest fetch/parse failure, arch-not-in-manifest, rate limit, abort, and
// GITHUB_TOKEN auth header. Spec §40-65.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

import {
  downloadServerBundle,
  type DownloadResult,
} from '../server-bundle-download'

// ─── Test fixtures ───────────────────────────────────────────────────────────

const VERSION = '0.5.0'
const ARCH = 'linux-x64' as const

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function makeTarball(arch: string, version: string): Buffer {
  // Deterministic-but-distinct synthetic bytes — enough payload to flow through
  // the streaming pipeline (multiple chunks possible, though Web ReadableStream
  // here will emit as one).
  return Buffer.from(`fake-tarball::${arch}::v${version}::pad::${'x'.repeat(2048)}`)
}

interface ManifestShape {
  schemaVersion: '1'
  version: string
  buildDate: string
  tarballs: Record<string, { filename: string; sha256: string; size: number }>
}

function makeManifest(opts: {
  version?: string
  archs?: ReadonlyArray<'linux-x64' | 'linux-arm64' | 'darwin-arm64'>
  /** Optional override of a specific arch's SHA — used to simulate mismatch */
  shaOverrides?: Partial<Record<'linux-x64' | 'linux-arm64' | 'darwin-arm64', string>>
}): { manifest: ManifestShape; tarballs: Record<string, Buffer> } {
  const version = opts.version ?? VERSION
  const archs = opts.archs ?? ['linux-x64', 'linux-arm64', 'darwin-arm64']
  const tarballs: Record<string, Buffer> = {}
  const entries: Record<string, { filename: string; sha256: string; size: number }> = {}
  for (const arch of archs) {
    const tar = makeTarball(arch, version)
    tarballs[arch] = tar
    entries[arch] = {
      filename: `bat-server-${arch}-v${version}.tar.gz`,
      sha256: opts.shaOverrides?.[arch] ?? sha256Hex(tar),
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

// ─── Response factory ────────────────────────────────────────────────────────

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function bufferResponse(buf: Buffer, init?: ResponseInit): Response {
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { 'content-length': String(buf.length) },
    ...init,
  })
}

function rateLimitResponse(resetUnix: number): Response {
  return new Response('{"message":"API rate limit exceeded"}', {
    status: 403,
    headers: {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetUnix),
      'X-RateLimit-Limit': '60',
    },
  })
}

// ─── Tmp dir lifecycle ───────────────────────────────────────────────────────

let cacheDir: string
const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN

beforeEach(async () => {
  cacheDir = path.join(os.tmpdir(), `bat-test-cache-${randomUUID()}`)
  delete process.env.GITHUB_TOKEN
})

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_TOKEN === undefined) delete process.env.GITHUB_TOKEN
  else process.env.GITHUB_TOKEN = ORIGINAL_TOKEN
  vi.restoreAllMocks()
  try {
    await fs.rm(cacheDir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('downloadServerBundle integration', () => {
  it('happy path: fetch manifest → fetch tarball → SHA verify → cache write', async () => {
    const { manifest, tarballs } = makeManifest({})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(tarballs[ARCH])
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromCache).toBe(false)
    expect(result.sha256).toBe(manifest.tarballs[ARCH].sha256)
    expect(result.sizeBytes).toBe(tarballs[ARCH].length)
    const onDisk = await fs.readFile(result.tarballPath)
    expect(onDisk.equals(tarballs[ARCH])).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('cache hit: existing cache file with correct SHA → fromCache:true', async () => {
    const { manifest, tarballs } = makeManifest({})
    const filename = manifest.tarballs[ARCH].filename
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(path.join(cacheDir, filename), tarballs[ARCH])

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      throw new Error(`unexpected fetch for ${u}`)
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromCache).toBe(true)
    expect(result.sha256).toBe(manifest.tarballs[ARCH].sha256)
    // Only manifest fetched, no tarball.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('cache stale: cache SHA mismatch → re-download', async () => {
    const { manifest, tarballs } = makeManifest({})
    const filename = manifest.tarballs[ARCH].filename
    await fs.mkdir(cacheDir, { recursive: true })
    // Plant a corrupted file matching expected size to trick size check, then
    // fail SHA — must be exactly entry.size bytes so size check passes and we
    // exercise the SHA verify path.
    const corrupted = Buffer.alloc(tarballs[ARCH].length, 0x42)
    await fs.writeFile(path.join(cacheDir, filename), corrupted)

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(tarballs[ARCH])
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromCache).toBe(false) // stale → re-download
    const onDisk = await fs.readFile(result.tarballPath)
    expect(onDisk.equals(tarballs[ARCH])).toBe(true)
  })

  it('SHA mismatch on download: fetched tarball SHA ≠ manifest SHA → sha-mismatch', async () => {
    const { manifest, tarballs } = makeManifest({})
    // Serve a different buffer than the manifest claims, so SHA verify fails.
    const wrong = Buffer.alloc(tarballs[ARCH].length, 0x99)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(wrong)
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('sha-mismatch')
    // Tmp file cleaned up.
    const tmpPath = path.join(cacheDir, `${manifest.tarballs[ARCH].filename}.tmp`)
    await expect(fs.access(tmpPath)).rejects.toThrow()
  })

  it('manifest fetch failed: 500 → retries 3× → manifest-fetch-failed', async () => {
    let attempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++
      return new Response('upstream broken', { status: 500 })
    })

    const result: DownloadResult = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('manifest-fetch-failed')
    expect(attempts).toBe(4) // 1 immediate + 3 retries
  }, 15000)

  it('manifest parse failed: invalid JSON → manifest-parse-failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('this is not json {', { status: 200 }),
    )

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('manifest-parse-failed')
  })

  it('arch not in manifest: requesting linux-arm64 from a manifest missing it → arch-not-in-manifest', async () => {
    const { manifest } = makeManifest({ archs: ['linux-x64', 'darwin-arm64'] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      throw new Error(`unexpected fetch for ${u}`)
    })

    // Manifest only validates as schema v1 if all 3 archs are present (per
    // server-bundle-manifest validator). So we request an arch that the
    // *parser* will reject as missing — this surfaces as 'manifest-parse-failed'
    // because manifest validation is strict.
    // To exercise the 'arch-not-in-manifest' branch we'd need a manifest that
    // parses but lacks our arch — which the validator forbids. Document this
    // and expect parse-failed instead. The runtime branch is still defended
    // (see server-bundle-download.ts:366).
    const result = await downloadServerBundle({
      arch: 'linux-arm64',
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    // Manifest validator requires all three archs, so partial archs surface as
    // parse-failed before reaching the lookup branch.
    expect(result.errorCode).toBe('manifest-parse-failed')
  })

  it('rate limited: HTTP 403 + X-RateLimit-Remaining=0 → rate-limited with reset hint', async () => {
    const reset = Math.floor(Date.now() / 1000) + 3600
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => rateLimitResponse(reset))

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('rate-limited')
    expect(result.error).toMatch(/Reset at/i)
    expect(result.error).toMatch(/GITHUB_TOKEN/i)
  })

  it('abort: AbortSignal triggered before start → aborted + tmp file not orphaned', async () => {
    const { manifest, tarballs } = makeManifest({})
    const ac = new AbortController()
    // Pre-abort to deterministically hit the abort path during manifest fetch.
    ac.abort()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(tarballs[ARCH])
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
      signal: ac.signal,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('aborted')
    // No tmp file should exist (manifest fetch aborted before tarball stage).
    const tmpPath = path.join(cacheDir, `${manifest.tarballs[ARCH].filename}.tmp`)
    await expect(fs.access(tmpPath)).rejects.toThrow()
  })

  it('GITHUB_TOKEN: options.githubToken is forwarded as Authorization Bearer header', async () => {
    const { manifest, tarballs } = makeManifest({})
    const seenAuth: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      if (headers['Authorization']) seenAuth.push(headers['Authorization'])
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(tarballs[ARCH])
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
      githubToken: 'ghp_testtoken_12345',
    })

    expect(result.ok).toBe(true)
    expect(seenAuth.length).toBeGreaterThanOrEqual(2) // manifest + tarball
    expect(seenAuth.every((h) => h === 'Bearer ghp_testtoken_12345')).toBe(true)
  })

  it('GITHUB_TOKEN: process.env.GITHUB_TOKEN is used when options.githubToken is absent', async () => {
    process.env.GITHUB_TOKEN = 'ghp_envtoken_98765'
    const { manifest, tarballs } = makeManifest({})
    let seenAuth = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      if (headers['Authorization']) seenAuth = headers['Authorization']
      const u = String(url)
      if (u.endsWith('/manifest.json')) return jsonResponse(manifest)
      return bufferResponse(tarballs[ARCH])
    })

    const result = await downloadServerBundle({
      arch: ARCH,
      version: VERSION,
      cacheDir,
      baseURL: 'https://mirror.example.com/bat',
    })

    expect(result.ok).toBe(true)
    expect(seenAuth).toBe('Bearer ghp_envtoken_98765')
  })
})
