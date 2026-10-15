// T0548 — e2e/real-remote/baseline-source.mjs: where the real-remote env scripts and the
// pre5 / pre6 / pre7 specs find a server bundle tarball now that installers ship no baseline
// (D146 / T0547). Order: explicit → dist-baseline/ → userData cache (.sha256 sidecar) → a
// pre-T0547 install's resources/bat-server-baseline; nothing → error naming fetch:baseline.

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  BASELINE_DIR_ENV,
  baseVersion,
  bundleMirrorContent,
  defaultInstalledBaselineDirs,
  defaultUserDataBundleDirs,
  resolveBaselineSource,
} from '../../e2e/real-remote/baseline-source.mjs'

const tmpRoots = []
afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true })
})

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'bat-t0548-src-'))
  tmpRoots.push(dir)
  return dir
}

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)

function manifestDir(dir, version, sha = SHA_A, { withTarball = true } = {}) {
  mkdirSync(dir, { recursive: true })
  const tarballs = {}
  for (const arch of ['linux-x64', 'linux-arm64', 'darwin-arm64']) {
    tarballs[arch] = { filename: `bat-server-${arch}-v${version}.tar.gz`, sha256: sha, size: 3 }
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: '1', version, buildDate: '2026-10-16T00:00:00.000Z', tarballs }))
  if (withTarball) writeFileSync(join(dir, `bat-server-linux-x64-v${version}.tar.gz`), 'tar')
  return dir
}

function cacheEntry(dir, version, sha = SHA_B, { sidecar = true, mtime } = {}) {
  mkdirSync(dir, { recursive: true })
  const name = `bat-server-linux-x64-v${version}.tar.gz`
  writeFileSync(join(dir, name), `cache-${version}`)
  if (sidecar) writeFileSync(join(dir, `${name}.sha256`), `${sha}  ${name}\n`)
  if (mtime) utimesSync(join(dir, name), mtime, mtime)
  return join(dir, name)
}

/** A repo root with only package.json (no dist-baseline/). */
function repo(version = '0.6.1-pre.4') {
  const root = tmp()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version }))
  return root
}

function resolve(root, extra = {}) {
  return resolveBaselineSource({ repoRoot: root, userDataDirs: [], installedDirs: [], env: {}, ...extra })
}

describe('resolveBaselineSource order (T0548)', () => {
  it('dist-baseline/ wins over the userData cache and the installed baseline', () => {
    const root = repo()
    manifestDir(join(root, 'dist-baseline'), '0.6.1-pre.4')
    const cache = tmp()
    cacheEntry(cache, '0.6.1-pre.4')
    const installed = manifestDir(join(tmp(), 'bat-server-baseline'), '0.6.0', SHA_C)
    const s = resolve(root, { userDataDirs: [cache], installedDirs: [installed] })
    expect(s.kind).toBe('dist-baseline')
    expect(s.version).toBe('0.6.1-pre.4')
    expect(s.sha256).toBe(SHA_A)
    expect(s.manifestPath).toBe(join(root, 'dist-baseline', 'manifest.json'))
  })

  it('userData cache (tarball + sidecar) when dist-baseline/ is missing', () => {
    const root = repo()
    const cache = tmp()
    const tarball = cacheEntry(cache, '0.6.1-pre.4')
    const installed = manifestDir(join(tmp(), 'bat-server-baseline'), '0.6.0', SHA_C)
    const s = resolve(root, { userDataDirs: [cache], installedDirs: [installed] })
    expect(s.kind).toBe('userdata-cache')
    expect(s.tarball).toBe(tarball)
    expect(s.sha256).toBe(SHA_B)
    expect(s.manifestPath).toBeNull()
    expect(s.tried[0]).toMatch(/^dist-baseline .*no manifest\.json/)
  })

  it('cache entries without a sidecar (or with a sidecar naming another file) are skipped', () => {
    const root = repo()
    const cache = tmp()
    cacheEntry(cache, '0.6.1-pre.4', SHA_B, { sidecar: false })
    const other = cacheEntry(cache, '0.6.1-pre.3')
    writeFileSync(`${other}.sha256`, `${SHA_B}  bat-server-linux-x64-v9.9.9.tar.gz\n`)
    const installed = manifestDir(join(tmp(), 'bat-server-baseline'), '0.6.0', SHA_C)
    expect(resolve(root, { userDataDirs: [cache], installedDirs: [installed] }).kind).toBe('installed')
  })

  it('cache prefers the repo base version, else the newest tarball', () => {
    const cache = tmp()
    cacheEntry(cache, '0.6.0', SHA_A, { mtime: new Date('2026-10-01T00:00:00Z') })
    cacheEntry(cache, '0.6.1-pre.4', SHA_B, { mtime: new Date('2026-09-01T00:00:00Z') })
    cacheEntry(cache, '0.6.1-pre.3', SHA_C, { mtime: new Date('2026-10-10T00:00:00Z') })
    // snapshot suffix of the repo version is removed
    expect(resolve(repo('0.6.1-pre.4-local.261016014531'), { userDataDirs: [cache] }).version).toBe('0.6.1-pre.4')
    expect(resolve(repo('0.7.0'), { userDataDirs: [cache] }).version).toBe('0.6.1-pre.3')
  })

  it('the installed baseline is the last resort (pre-T0547 install)', () => {
    const installed = manifestDir(join(tmp(), 'bat-server-baseline'), '0.6.0', SHA_C)
    const s = resolve(repo(), { installedDirs: [join(tmp(), 'missing'), installed] })
    expect(s.kind).toBe('installed')
    expect(s.dir).toBe(installed)
  })

  it('manifest listing a tarball that is not there does not count', () => {
    const root = repo()
    manifestDir(join(root, 'dist-baseline'), '0.6.1-pre.4', SHA_A, { withTarball: false })
    expect(() => resolve(root)).toThrow(/listed but missing/)
  })

  it('nothing found → error that names npm run fetch:baseline and every place tried', () => {
    const root = repo()
    const cache = join(tmp(), 'no-cache')
    let message = ''
    try {
      resolve(root, { userDataDirs: [cache], installedDirs: ['C:\\nowhere\\bat-server-baseline'] })
    } catch (err) {
      message = err.message
    }
    expect(message).toMatch(/npm run fetch:baseline/)
    expect(message).toContain(join(root, 'dist-baseline'))
    expect(message).toContain(cache)
    expect(message).toContain('C:\\nowhere\\bat-server-baseline')
  })
})

describe('explicit directory (T0548)', () => {
  it('--baseline-dir with manifest.json wins over everything', () => {
    const root = repo()
    manifestDir(join(root, 'dist-baseline'), '0.6.1-pre.4')
    const explicit = manifestDir(tmp(), '0.6.0-pre.7', SHA_C)
    const s = resolve(root, { explicitDir: explicit, explicitLabel: '--baseline-dir' })
    expect(s.kind).toBe('explicit')
    expect(s.version).toBe('0.6.0-pre.7')
  })

  it('an explicit directory may be a cache-style directory (tarball + .sha256)', () => {
    const explicit = tmp()
    cacheEntry(explicit, '0.6.1-pre.4')
    const s = resolve(repo(), { explicitDir: explicit })
    expect(s.kind).toBe('explicit')
    expect(s.sha256).toBe(SHA_B)
  })

  it(`${BASELINE_DIR_ENV} is the explicit directory when no option is given`, () => {
    const explicit = manifestDir(tmp(), '0.6.0-pre.7')
    const s = resolve(repo(), { env: { [BASELINE_DIR_ENV]: explicit } })
    expect(s.kind).toBe('explicit')
  })

  it('an explicit directory without a bundle is an error, never skipped', () => {
    const root = repo()
    manifestDir(join(root, 'dist-baseline'), '0.6.1-pre.4')
    const empty = tmp()
    expect(() => resolve(root, { explicitDir: empty, explicitLabel: '--baseline-dir' })).toThrow(/^--baseline-dir .*no manifest\.json/)
  })
})

describe('defaults', () => {
  it('userData cache follows the BUG-119 single userData directory', () => {
    expect(defaultUserDataBundleDirs({ env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, platform: 'win32', home: 'C:\\Users\\u' }))
      .toEqual([join('C:\\Users\\u\\AppData\\Roaming', 'BetterAgentTerminal', 'bat-server-bundles')])
    expect(defaultUserDataBundleDirs({ env: {}, platform: 'darwin', home: '/Users/u' }))
      .toEqual([join('/Users/u', 'Library', 'Application Support', 'BetterAgentTerminal', 'bat-server-bundles')])
    expect(defaultUserDataBundleDirs({ env: {}, platform: 'linux', home: '/home/u' }))
      .toEqual([join('/home/u', '.config', 'BetterAgentTerminal', 'bat-server-bundles')])
  })

  it('installed baseline: next to BAT_E2E_EXECUTABLE, then per-machine and per-user installs', () => {
    const dirs = defaultInstalledBaselineDirs({
      env: { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' },
      platform: 'win32',
      executable: 'D:\\BAT\\BetterAgentTerminal.exe',
    })
    expect(dirs).toEqual([
      join('D:\\BAT', 'resources', 'bat-server-baseline'),
      join('C:\\Program Files', 'BetterAgentTerminal', 'resources', 'bat-server-baseline'),
      join('C:\\Users\\u\\AppData\\Local', 'Programs', 'BetterAgentTerminal', 'resources', 'bat-server-baseline'),
    ])
    expect(defaultInstalledBaselineDirs({ env: {}, platform: 'linux' })).toEqual([])
  })

  it('baseVersion strips both snapshot forms', () => {
    expect(baseVersion('0.6.1-pre.3-local.261016014531')).toBe('0.6.1-pre.3')
    expect(baseVersion('0.6.1-pre.3.local.261016014531')).toBe('0.6.1-pre.3')
    expect(baseVersion('0.6.1')).toBe('0.6.1')
  })
})

describe('bundleMirrorContent (pre5 local mirror)', () => {
  it('a manifest source is served as is', () => {
    const root = repo()
    manifestDir(join(root, 'dist-baseline'), '0.6.1-pre.4')
    const s = resolve(root)
    const { manifest, files } = bundleMirrorContent(s)
    expect(manifest).toEqual(s.manifest)
    expect(files.get('bat-server-linux-x64-v0.6.1-pre.4.tar.gz')).toBe(join(root, 'dist-baseline', 'bat-server-linux-x64-v0.6.1-pre.4.tar.gz'))
  })

  it('a cache source gets a manifest the download module accepts, serving only its own tarball', async () => {
    const cache = tmp()
    const tarball = cacheEntry(cache, '0.6.1-pre.4')
    const s = resolve(repo(), { userDataDirs: [cache] })
    const { manifest, files } = bundleMirrorContent(s, { now: new Date('2026-10-16T00:00:00Z') })
    const { parseManifest } = await import('../../src/lib/server-bundle-manifest.ts')
    const parsed = parseManifest(JSON.stringify(manifest))
    expect(parsed.ok).toBe(true)
    expect(manifest.tarballs['linux-x64']).toEqual({ filename: 'bat-server-linux-x64-v0.6.1-pre.4.tar.gz', sha256: SHA_B, size: 'cache-0.6.1-pre.4'.length })
    expect([...files.entries()]).toEqual([['bat-server-linux-x64-v0.6.1-pre.4.tar.gz', tarball]])
  })
})
