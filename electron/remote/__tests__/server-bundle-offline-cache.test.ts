// D146 / T0547 — installers no longer ship a server bundle baseline.
//
//   * server-bundle-cache.ts: sha256 sidecars, cache lookup verified by its own sidecar
//   * distributor + the real download module (fetch spied, arch detection mocked):
//       no baseline → download → tarball + sidecar in the cache
//       offline + cache → hit without any fetch
//       offline + no cache → download-failed naming the import option, with arch / version
//       mismatching / legacy (no sidecar) cache entries
//   * server-bundle-import.ts: import ok / sha mismatch / target / version / filename /
//     sidecar missing or foreign, the IPC flow with injected dialogs, and
//     import → distributor cache hit (same cache layout as a download)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.5.0',
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../arch-detect', () => ({
  detectRemoteArch: vi.fn(),
}))

import { detectRemoteArch } from '../arch-detect'
import { distributeServerBundle } from '../server-bundle-distributor'
import {
  formatSha256Sidecar,
  lookupCachedTarball,
  parseServerBundleFilename,
  parseSha256Sidecar,
  sidecarPathFor,
} from '../server-bundle-cache'
import {
  importLocalServerBundle,
  importServerBundleTarball,
  parseImportLocalRequest,
} from '../server-bundle-import'
import type { ProfileEntry } from '../../profile-manager'

const VERSION = '0.5.0'
const ARCH = 'linux-x64' as const
const FILENAME = `bat-server-${ARCH}-v${VERSION}.tar.gz`

const sha256Hex = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex')
const makeTarball = (arch: string, version: string): Buffer =>
  Buffer.from(`fake-tarball::${arch}::v${version}::${'z'.repeat(4096)}`)

function makeManifest(version = VERSION) {
  const tarballs: Record<string, Buffer> = {}
  const entries: Record<string, { filename: string; sha256: string; size: number }> = {}
  for (const arch of ['linux-x64', 'linux-arm64', 'darwin-arm64']) {
    const tar = makeTarball(arch, version)
    tarballs[arch] = tar
    entries[arch] = { filename: `bat-server-${arch}-v${version}.tar.gz`, sha256: sha256Hex(tar), size: tar.length }
  }
  return {
    manifest: { schemaVersion: '1' as const, version, buildDate: '2026-10-16T00:00:00.000Z', tarballs: entries },
    tarballs,
  }
}

const profile = { id: 'p', name: 'p', targetOS: 'ssh-linux', sshServerArch: ARCH } as unknown as ProfileEntry

let root: string
let cacheDir: string
let baselineDir: string
let srcDir: string
const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_BASE_URL = process.env.BAT_SERVER_BUNDLE_BASE_URL

beforeEach(async () => {
  root = path.join(os.tmpdir(), `bat-t0547-${randomUUID()}`)
  cacheDir = path.join(root, 'bat-server-bundles')
  baselineDir = path.join(root, 'no-baseline') // never created: the D146 installer
  srcDir = path.join(root, 'usb-stick')
  await fs.mkdir(srcDir, { recursive: true })
  ;(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = root
  delete process.env.BAT_SERVER_BUNDLE_BASE_URL
  vi.mocked(detectRemoteArch).mockResolvedValue({ ok: true, arch: ARCH, rawUname: 'x86_64' })
})

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
  if (ORIGINAL_BASE_URL === undefined) delete process.env.BAT_SERVER_BUNDLE_BASE_URL
  else process.env.BAT_SERVER_BUNDLE_BASE_URL = ORIGINAL_BASE_URL
  await fs.rm(root, { recursive: true, force: true })
})

/** fetch that serves the release (manifest + tarballs). */
function onlineFetch(manifest: unknown, tarballs: Record<string, Buffer>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.endsWith('/manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 })
    const arch = Object.keys(tarballs).find((a) => u.endsWith(`bat-server-${a}-v${VERSION}.tar.gz`))
    if (!arch) return new Response('not found', { status: 404, statusText: 'Not Found' })
    return new Response(new Uint8Array(tarballs[arch]), { status: 200 })
  })
}

/** fetch with no network at all (what undici throws offline, no retryable code). */
function offlineFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new TypeError('fetch failed')
  })
}

async function writeImportSource(buf: Buffer, name = FILENAME, sidecar: string | null = formatSha256Sidecar(sha256Hex(buf), name)) {
  const tarballPath = path.join(srcDir, name)
  await fs.writeFile(tarballPath, buf)
  if (sidecar !== null) await fs.writeFile(`${tarballPath}.sha256`, sidecar)
  return tarballPath
}

describe('sha256 sidecar format (server-bundle-cache.ts)', () => {
  const sha = 'a'.repeat(64)

  it('round-trips the sha256sum format build-server-bundle.mjs writes', () => {
    expect(formatSha256Sidecar(sha, FILENAME)).toBe(`${sha}  ${FILENAME}\n`)
    expect(parseSha256Sidecar(formatSha256Sidecar(sha, FILENAME), FILENAME)).toEqual({ ok: true, sha256: sha })
  })

  it('accepts a bare hash, CRLF, upper case and the binary marker', () => {
    expect(parseSha256Sidecar(`${sha}\r\n`, FILENAME)).toEqual({ ok: true, sha256: sha })
    expect(parseSha256Sidecar(`${'A'.repeat(64)} *${FILENAME}`, FILENAME)).toEqual({ ok: true, sha256: sha })
  })

  it('rejects another file name, several lines and non-hex', () => {
    expect(parseSha256Sidecar(`${sha}  bat-server-linux-arm64-v0.5.0.tar.gz\n`, FILENAME).ok).toBe(false)
    expect(parseSha256Sidecar(`${sha}  ${FILENAME}\n${sha}  ${FILENAME}\n`, FILENAME).ok).toBe(false)
    expect(parseSha256Sidecar('not-a-hash  x\n', FILENAME).ok).toBe(false)
    expect(parseSha256Sidecar('', FILENAME).ok).toBe(false)
  })

  it('parses only whitelisted bundle file names', () => {
    expect(parseServerBundleFilename('bat-server-linux-x64-v0.6.1-pre.3.tar.gz')).toEqual({ arch: 'linux-x64', version: '0.6.1-pre.3' })
    expect(parseServerBundleFilename('bat-server-darwin-arm64-v1.2.3.tar.gz')).toEqual({ arch: 'darwin-arm64', version: '1.2.3' })
    for (const bad of [
      'bat-server-darwin-x64-v1.2.3.tar.gz',
      'bat-server-linux-x64-v1.2.tar.gz',
      'bat-server-linux-x64-v1.2.3.tar.gz.sha256',
      'bat-server-linux-x64-v1.2.3;rm -rf.tar.gz',
      '../bat-server-linux-x64-v1.2.3.tar.gz',
      'bat-server-linux-x64-v1.2.3.tgz',
    ]) {
      expect(parseServerBundleFilename(bad)).toBeNull()
    }
  })
})

describe('lookupCachedTarball', () => {
  it('hit when the tarball matches its own sidecar; missing / unverifiable otherwise', async () => {
    const buf = makeTarball(ARCH, VERSION)
    expect((await lookupCachedTarball(cacheDir, FILENAME)).state).toBe('missing')
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(path.join(cacheDir, FILENAME), buf)
    expect((await lookupCachedTarball(cacheDir, FILENAME)).state).toBe('unverifiable')
    await fs.writeFile(sidecarPathFor(path.join(cacheDir, FILENAME)), formatSha256Sidecar(sha256Hex(buf), FILENAME))
    expect(await lookupCachedTarball(cacheDir, FILENAME)).toEqual({
      state: 'hit',
      tarballPath: path.join(cacheDir, FILENAME),
      sha256: sha256Hex(buf),
      sizeBytes: buf.length,
    })
  })

  it('a tarball that no longer matches its sidecar is removed with the sidecar', async () => {
    await fs.mkdir(cacheDir, { recursive: true })
    const tarballPath = path.join(cacheDir, FILENAME)
    await fs.writeFile(tarballPath, Buffer.from('truncated'))
    await fs.writeFile(sidecarPathFor(tarballPath), formatSha256Sidecar('b'.repeat(64), FILENAME))
    expect((await lookupCachedTarball(cacheDir, FILENAME)).state).toBe('mismatch')
    await expect(fs.stat(tarballPath)).rejects.toThrow()
    await expect(fs.stat(sidecarPathFor(tarballPath))).rejects.toThrow()
  })
})

describe('distributor without a baseline (D146)', () => {
  it('no baseline → downloads the release, caches tarball + sidecar', async () => {
    const { manifest, tarballs } = makeManifest()
    const fetchSpy = onlineFetch(manifest, tarballs)

    const result = await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })

    expect(result).toMatchObject({ ok: true, source: 'download', arch: ARCH, sha256: manifest.tarballs[ARCH].sha256 })
    expect(fetchSpy.mock.calls.map(([u]) => String(u))).toEqual([
      `https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v${VERSION}/manifest.json`,
      `https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v${VERSION}/${FILENAME}`,
    ])
    const sidecar = await fs.readFile(path.join(cacheDir, `${FILENAME}.sha256`), 'utf8')
    expect(sidecar).toBe(`${manifest.tarballs[ARCH].sha256}  ${FILENAME}\n`)
  })

  it('BAT_SERVER_BUNDLE_BASE_URL still overrides the download source', async () => {
    const { manifest, tarballs } = makeManifest()
    process.env.BAT_SERVER_BUNDLE_BASE_URL = 'https://mirror.example.com/bat/'
    const fetchSpy = onlineFetch(manifest, tarballs)
    const result = await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })
    expect(result.ok).toBe(true)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://mirror.example.com/bat/manifest.json')
  })

  it('offline + downloaded earlier → cache hit verified by the sidecar, no fetch at all', async () => {
    const { manifest, tarballs } = makeManifest()
    onlineFetch(manifest, tarballs)
    expect((await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })).ok).toBe(true)
    vi.restoreAllMocks()
    vi.mocked(detectRemoteArch).mockResolvedValue({ ok: true, arch: ARCH, rawUname: 'x86_64' })
    const offline = offlineFetch()

    const result = await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })

    expect(result).toMatchObject({ ok: true, source: 'cache', sha256: manifest.tarballs[ARCH].sha256, sizeBytes: tarballs[ARCH].length })
    expect(offline).not.toHaveBeenCalled()
  })

  it('offline + no cache → download-failed that names the import option, with arch and version', async () => {
    offlineFetch()
    const result = await distributeServerBundle({ profile, version: '0.5.0-local.261016011213', cacheDir, baselineDir })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('download-failed')
    expect(result.arch).toBe(ARCH)
    expect(result.version).toBe(VERSION) // snapshot suffix stripped
    expect(result.error).toContain(`Import a local tarball instead (${FILENAME} with ${FILENAME}.sha256`)
    expect(result.error).toContain('BAT_SERVER_BUNDLE_BASE_URL')
  })

  it('a pre-T0547 cache entry (no sidecar) is re-verified by the download path and gets a sidecar', async () => {
    const { manifest, tarballs } = makeManifest()
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(path.join(cacheDir, FILENAME), tarballs[ARCH])
    const fetchSpy = onlineFetch(manifest, tarballs)

    const result = await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })

    expect(result).toMatchObject({ ok: true, source: 'download' })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // manifest only: the cached tarball matched
    expect(await fs.readFile(path.join(cacheDir, `${FILENAME}.sha256`), 'utf8')).toContain(manifest.tarballs[ARCH].sha256)
  })

  it('a cache entry that does not match its sidecar is dropped and downloaded again', async () => {
    const { manifest, tarballs } = makeManifest()
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(path.join(cacheDir, FILENAME), Buffer.alloc(tarballs[ARCH].length, 0x41))
    await fs.writeFile(path.join(cacheDir, `${FILENAME}.sha256`), formatSha256Sidecar(manifest.tarballs[ARCH].sha256, FILENAME))
    onlineFetch(manifest, tarballs)

    const result = await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })

    expect(result).toMatchObject({ ok: true, source: 'download' })
    expect((await fs.readFile(path.join(cacheDir, FILENAME))).equals(tarballs[ARCH])).toBe(true)
  })

  it('an installer that still ships a baseline: the cache copy gets a sidecar, so the next run needs no baseline', async () => {
    const { manifest, tarballs } = makeManifest()
    const shippedBaseline = path.join(root, 'bat-server-baseline')
    await fs.mkdir(shippedBaseline, { recursive: true })
    await fs.writeFile(path.join(shippedBaseline, 'manifest.json'), JSON.stringify(manifest))
    await fs.writeFile(path.join(shippedBaseline, FILENAME), tarballs[ARCH])

    expect(await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir: shippedBaseline })).toMatchObject({ ok: true, source: 'baseline' })
    const offline = offlineFetch()
    expect(await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })).toMatchObject({ ok: true, source: 'cache' })
    expect(offline).not.toHaveBeenCalled()
  })
})

describe('import a local tarball (server-bundle-import.ts)', () => {
  const opts = (tarballPath: string, extra: Record<string, unknown> = {}) => ({
    tarballPath, expectedArch: ARCH, expectedVersion: VERSION, cacheDir, ...extra,
  })

  it('ok: verified copy + sidecar land in the cache; the distributor then hits it offline', async () => {
    const buf = makeTarball(ARCH, VERSION)
    const src = await writeImportSource(buf)

    const result = await importServerBundleTarball(opts(src))

    expect(result).toEqual({ ok: true, tarballPath: path.join(cacheDir, FILENAME), sha256: sha256Hex(buf), sizeBytes: buf.length, arch: ARCH, version: VERSION })
    expect((await fs.readFile(path.join(cacheDir, FILENAME))).equals(buf)).toBe(true)
    expect(await fs.readFile(path.join(cacheDir, `${FILENAME}.sha256`), 'utf8')).toBe(formatSha256Sidecar(sha256Hex(buf), FILENAME))
    expect((await fs.readdir(cacheDir)).sort()).toEqual([FILENAME, `${FILENAME}.sha256`])

    const offline = offlineFetch()
    expect(await distributeServerBundle({ profile, version: VERSION, cacheDir, baselineDir })).toMatchObject({ ok: true, source: 'cache', sha256: sha256Hex(buf) })
    expect(offline).not.toHaveBeenCalled()
  })

  it('sha mismatch: nothing is written to the cache', async () => {
    const src = await writeImportSource(makeTarball(ARCH, VERSION), FILENAME, formatSha256Sidecar('c'.repeat(64), FILENAME))
    const result = await importServerBundleTarball(opts(src))
    expect(result).toMatchObject({ ok: false, errorCode: 'sha-mismatch', details: { file: FILENAME, expected: 'c'.repeat(64) } })
    expect(await fs.readdir(cacheDir)).toEqual([])
  })

  it('target mismatch: an arm64 bundle for an x64 remote', async () => {
    const name = `bat-server-linux-arm64-v${VERSION}.tar.gz`
    const src = await writeImportSource(makeTarball('linux-arm64', VERSION), name)
    expect(await importServerBundleTarball(opts(src))).toMatchObject({
      ok: false, errorCode: 'arch-mismatch', details: { expected: ARCH, actual: 'linux-arm64' },
    })
  })

  it('version mismatch: a bundle of another BAT version', async () => {
    const name = `bat-server-${ARCH}-v0.4.9.tar.gz`
    const src = await writeImportSource(makeTarball(ARCH, '0.4.9'), name)
    expect(await importServerBundleTarball(opts(src))).toMatchObject({
      ok: false, errorCode: 'version-mismatch', details: { expected: VERSION, actual: '0.4.9' },
    })
  })

  it('illegal file names are rejected before any IO', async () => {
    for (const name of ['server.tar.gz', `bat-server-${ARCH}-v${VERSION}.tar.gz.bak`, `bat-server-${ARCH}-v${VERSION} (1).tar.gz`]) {
      const result = await importServerBundleTarball(opts(path.join(srcDir, name)))
      expect(result).toMatchObject({ ok: false, errorCode: 'invalid-filename' })
    }
    expect(await importServerBundleTarball(opts(FILENAME))).toMatchObject({ ok: false, errorCode: 'read-failed' }) // relative
  })

  it('sidecar missing / of another file / not a sidecar', async () => {
    const buf = makeTarball(ARCH, VERSION)
    const src = await writeImportSource(buf, FILENAME, null)
    expect(await importServerBundleTarball(opts(src))).toMatchObject({ ok: false, errorCode: 'sidecar-missing' })
    await fs.writeFile(`${src}.sha256`, formatSha256Sidecar(sha256Hex(buf), 'bat-server-linux-arm64-v0.5.0.tar.gz'))
    expect(await importServerBundleTarball(opts(src))).toMatchObject({ ok: false, errorCode: 'sidecar-invalid' })
    await fs.writeFile(`${src}.sha256`, 'x'.repeat(5000))
    expect(await importServerBundleTarball(opts(src))).toMatchObject({ ok: false, errorCode: 'sidecar-invalid' })
  })

  it('an existing cache entry of another target is left alone', async () => {
    await fs.mkdir(cacheDir, { recursive: true })
    const other = `bat-server-linux-arm64-v${VERSION}.tar.gz`
    await fs.writeFile(path.join(cacheDir, other), 'other')
    await fs.writeFile(path.join(cacheDir, `${other}.sha256`), formatSha256Sidecar('d'.repeat(64), other))
    const src = await writeImportSource(makeTarball(ARCH, VERSION))
    expect((await importServerBundleTarball(opts(src))).ok).toBe(true)
    expect(await fs.readFile(path.join(cacheDir, other), 'utf8')).toBe('other')
  })
})

describe('server-bundle:import-local flow (dialogs injected)', () => {
  const deps = (pickTarball: () => Promise<string | null>, pickSidecar: () => Promise<string | null> = async () => null) => ({
    cacheDir,
    pickTarball: vi.fn(pickTarball),
    pickSidecar: vi.fn(pickSidecar),
  })

  it('validates the request: arch whitelist, version shape, snapshot stripped, titles bounded', () => {
    expect(parseImportLocalRequest({ arch: 'linux-x64', version: '0.6.1-pre.3.local.261016011213', dialogTitle: 'Pick' })).toEqual({
      arch: 'linux-x64', version: '0.6.1-pre.3', dialogTitle: 'Pick', sidecarDialogTitle: undefined,
    })
    expect(parseImportLocalRequest({ arch: 'win32-x64', version: '0.6.1' })).toBeNull()
    expect(parseImportLocalRequest({ arch: 'linux-x64', version: '0.6.1; calc' })).toBeNull()
    expect(parseImportLocalRequest({ arch: 'linux-x64', version: '../0.6.1' })).toBeNull()
    expect(parseImportLocalRequest(null)).toBeNull()
    expect(parseImportLocalRequest({ arch: 'linux-x64', version: '1.0.0', dialogTitle: 'x'.repeat(500) })?.dialogTitle).toBeUndefined()
  })

  it('invalid request → invalid-arguments without opening a dialog', async () => {
    const d = deps(async () => '/never')
    expect(await importLocalServerBundle({ arch: 'x', version: VERSION }, d)).toMatchObject({ ok: false, errorCode: 'invalid-arguments' })
    expect(d.pickTarball).not.toHaveBeenCalled()
  })

  it('cancelled dialog → cancelled, cache untouched', async () => {
    const d = deps(async () => null)
    expect(await importLocalServerBundle({ arch: ARCH, version: VERSION }, d)).toMatchObject({ ok: false, errorCode: 'cancelled' })
    await expect(fs.readdir(cacheDir)).rejects.toThrow()
  })

  it('sidecar next to the tarball → one dialog only', async () => {
    const src = await writeImportSource(makeTarball(ARCH, VERSION))
    const d = deps(async () => src)
    expect(await importLocalServerBundle({ arch: ARCH, version: VERSION, dialogTitle: 'T' }, d)).toMatchObject({ ok: true })
    expect(d.pickTarball).toHaveBeenCalledWith('T')
    expect(d.pickSidecar).not.toHaveBeenCalled()
  })

  it('no sidecar next to it → asks for one; a picked sidecar is used, none → sidecar-missing', async () => {
    const buf = makeTarball(ARCH, VERSION)
    const src = await writeImportSource(buf, FILENAME, null)
    expect(await importLocalServerBundle({ arch: ARCH, version: VERSION }, deps(async () => src))).toMatchObject({ ok: false, errorCode: 'sidecar-missing' })

    const elsewhere = path.join(root, 'checksums.sha256')
    await fs.writeFile(elsewhere, formatSha256Sidecar(sha256Hex(buf), FILENAME))
    const d = deps(async () => src, async () => elsewhere)
    expect(await importLocalServerBundle({ arch: ARCH, version: VERSION }, d)).toMatchObject({ ok: true })
    expect(d.pickSidecar).toHaveBeenCalledWith(`Select ${FILENAME}.sha256`, FILENAME)
  })

  it('a wrong file is rejected before asking for its sidecar', async () => {
    const name = `bat-server-${ARCH}-v0.4.9.tar.gz`
    const src = await writeImportSource(makeTarball(ARCH, '0.4.9'), name, null)
    const d = deps(async () => src)
    expect(await importLocalServerBundle({ arch: ARCH, version: VERSION }, d)).toMatchObject({ ok: false, errorCode: 'version-mismatch' })
    expect(d.pickSidecar).not.toHaveBeenCalled()
  })
})
