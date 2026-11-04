// T0858 / PLAN-065 W2 — Windows PTY holder packaging (scripts/pty-holder.cjs, build/installer.nsh).
//
// - getting Node: pinned version and SHA-256, nodejs.org only, never SHASUMS256.txt at build time, mismatch = failure,
//   cache and override re-verified (fetch is faked; the fake node.exe pin comes from _pty-holder-fixture.cjs);
// - the holder directory and its manifest (what is copied, key rule, line 3 the installer reads, checks);
// - the afterPack step only runs for Windows;
// - holder root rules, including the "install directory name + suffix" trap of NSIS' StartsWith('$INSTDIR');
// - source guards on build/installer.nsh (customInstall copy / cleanup) and package.json (no platform `files`).
// T0859 / PLAN-065 W3:
// - Node's LICENSE: pinned size + SHA-256, nodejs/node repo at the version tag only, shipped as node-LICENSE;
// - electron/pty-holder.ts (BAT, fork time) and this file (build / installer) follow the same holder rules.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import * as batHolder from '../../electron/pty-holder'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const holder = require('../pty-holder.cjs')
const {
  PTY_HOLDER_NODE,
  PTY_HOLDER_EXE_NAME,
  PTY_HOLDER_MANIFEST_FILE,
  PTY_HOLDER_ROOT_DIR_NAME,
  PTY_HOLDER_KEY_RE,
  holderNodeDownloadUrl,
  ensureHolderNodeExe,
  ensureHolderNodeLicense,
  holderNodeLicenseUrl,
  externalPackagesOf,
  holderSourceFiles,
  holderKey,
  buildHolderManifest,
  serializeHolderManifest,
  assemblePtyHolder,
  ptyHolderProblems,
  holderRootFor,
  holderRootConflictsWithInstallDir,
  builderArchName,
  afterPackPtyHolder,
} = holder
const { fakeNodeExe, fakeNodeLicense, useFakeHolderNode, writeFakeAppFiles, writeFakeHolder } = require('./_pty-holder-fixture.cjs')

/** fake fetch body for afterPack: node.exe for the dist URL, the LICENSE for the repo URL (T0859) */
const nodeOrLicense = (url) => (url === holderNodeLicenseUrl() ? fakeNodeLicense() : fakeNodeExe('x64'))

const REAL_PIN = JSON.parse(JSON.stringify(PTY_HOLDER_NODE))
const dirs = []
function tmp() {
  const d = mkdtempSync(path.join(os.tmpdir(), 'bat-t0858-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

/** fetch fake: records URLs; `body(url)` returns the bytes (or a status number). */
function fakeFetch(body) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const out = body(url)
    if (typeof out === 'number') return { ok: false, status: out, statusText: 'Nope', arrayBuffer: async () => new ArrayBuffer(0) }
    return { ok: true, status: 200, arrayBuffer: async () => out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) }
  }
  return { calls, fetchImpl }
}

describe('pinned Node (supply chain)', () => {
  it('Node 24.x (Electron 45 major), x64 + arm64, 64-hex SHA-256 and sizes written in the repo', () => {
    expect(REAL_PIN.version).toMatch(/^24\.\d+\.\d+$/)
    expect(Object.keys(REAL_PIN.binaries).sort()).toEqual(['arm64', 'x64'])
    for (const [arch, b] of Object.entries(REAL_PIN.binaries)) {
      expect(b.path).toBe(`win-${arch}/node.exe`)
      expect(b.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(Number.isInteger(b.size) && b.size > 50_000_000).toBe(true)
    }
  })

  it('downloads only from nodejs.org/dist, never reads SHASUMS256.txt', () => {
    expect(holderNodeDownloadUrl('x64')).toBe(`https://nodejs.org/dist/v${REAL_PIN.version}/win-x64/node.exe`)
    expect(holderNodeDownloadUrl('arm64')).toBe(`https://nodejs.org/dist/v${REAL_PIN.version}/win-arm64/node.exe`)
    expect(() => holderNodeDownloadUrl('ia32')).toThrow(/no pinned node.exe/)
    const src = readFileSync(path.join(ROOT, 'scripts', 'pty-holder.cjs'), 'utf8')
    expect(src).not.toMatch(/SHASUMS256\.txt['"`]/)
    const urls = [...src.matchAll(/https?:\/\/[^\s'"`]+/g)].map((m) => m[0])
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((u) => !u.startsWith('https://nodejs.org/dist') && !u.startsWith('https://raw.githubusercontent.com/nodejs/node') && !u.startsWith('https://github.com/nodejs/node/raw/'))).toEqual([])
    expect(holder.NODE_DIST_BASE_URL).toBe('https://nodejs.org/dist')
  })

  // T0859 (塔台補充 4): Node's LICENSE, same version tag as node.exe, pinned in the repo
  it('Node LICENSE: same version tag, nodejs/node repo only, size + SHA-256 written in the repo', () => {
    expect(holderNodeLicenseUrl()).toBe(`https://raw.githubusercontent.com/nodejs/node/v${REAL_PIN.version}/LICENSE`)
    expect(holder.NODE_LICENSE_BASE_URL).toBe('https://raw.githubusercontent.com/nodejs/node')
    expect(REAL_PIN.license).toEqual({ size: 157609, sha256: '5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace' })
    expect(holder.PTY_HOLDER_NODE_LICENSE_FILE).toBe('node-LICENSE')
  })
})

describe('ensureHolderNodeLicense (fake fetch, fake pin)', () => {
  let restore
  beforeAll(() => { restore = useFakeHolderNode('x64') })
  afterAll(() => restore())

  it('downloads the pinned LICENSE, verifies, caches; the cache is re-verified without fetching', async () => {
    const cacheDir = tmp()
    const { calls, fetchImpl } = fakeFetch(() => fakeNodeLicense())
    const file = await ensureHolderNodeLicense({ cacheDir, fetchImpl, licenseOverridePath: '' })
    expect(calls).toEqual([holderNodeLicenseUrl()])
    expect(readFileSync(file)).toEqual(fakeNodeLicense())
    expect(await ensureHolderNodeLicense({ cacheDir, fetchImpl, licenseOverridePath: '' })).toBe(file)
    expect(calls.length).toBe(1)
  })

  it('other bytes or an HTTP error → the build fails, nothing cached', async () => {
    const cacheDir = tmp()
    await expect(ensureHolderNodeLicense({ cacheDir, fetchImpl: fakeFetch(() => Buffer.from('MIT')).fetchImpl, licenseOverridePath: '' })).rejects.toThrow(/does not match the pinned Node v24\.\d+\.\d+ LICENSE: size 3, pinned/)
    await expect(ensureHolderNodeLicense({ cacheDir, fetchImpl: fakeFetch(() => 404).fetchImpl, licenseOverridePath: '' })).rejects.toThrow(/HTTP 404/)
    expect(readdirSync(cacheDir)).toEqual([])
  })

  it('override (BAT_PTY_HOLDER_NODE_LICENSE) only when it matches the pin; never downloads', async () => {
    const d = tmp()
    const good = path.join(d, 'LICENSE')
    writeFileSync(good, fakeNodeLicense())
    const { calls, fetchImpl } = fakeFetch(() => 500)
    expect(await ensureHolderNodeLicense({ cacheDir: d, fetchImpl, licenseOverridePath: good })).toBe(good)
    const bad = path.join(d, 'OTHER')
    writeFileSync(bad, 'x')
    await expect(ensureHolderNodeLicense({ cacheDir: d, fetchImpl, licenseOverridePath: bad })).rejects.toThrow(/BAT_PTY_HOLDER_NODE_LICENSE=.* is not the pinned Node/)
    expect(calls).toEqual([])
  })
})

describe('ensureHolderNodeExe (fake fetch, fake pin)', () => {
  let restore
  beforeAll(() => { restore = useFakeHolderNode('x64') })
  afterAll(() => restore())

  it('downloads, verifies, caches; the next build re-verifies the cache without fetching', async () => {
    const cacheDir = tmp()
    const { calls, fetchImpl } = fakeFetch(() => fakeNodeExe('x64'))
    const exe = await ensureHolderNodeExe('x64', { cacheDir, fetchImpl, overridePath: '' })
    expect(calls).toEqual([holderNodeDownloadUrl('x64')])
    expect(readFileSync(exe)).toEqual(fakeNodeExe('x64'))
    expect(await ensureHolderNodeExe('x64', { cacheDir, fetchImpl, overridePath: '' })).toBe(exe)
    expect(calls.length).toBe(1)
  })

  it('hash mismatch → fails, nothing left in the cache', async () => {
    const cacheDir = tmp()
    const { fetchImpl } = fakeFetch(() => Buffer.concat([fakeNodeExe('x64').subarray(0, 511), Buffer.from('X')]))
    await expect(ensureHolderNodeExe('x64', { cacheDir, fetchImpl, overridePath: '' })).rejects.toThrow(/SHA-256 [0-9a-f]{64}, pinned/)
    expect(readdirSync(cacheDir)).toEqual([])
  })

  it('size mismatch and HTTP errors → fail', async () => {
    const cacheDir = tmp()
    await expect(ensureHolderNodeExe('x64', { cacheDir, fetchImpl: fakeFetch(() => Buffer.from('MZ')).fetchImpl, overridePath: '' })).rejects.toThrow(/size 2, pinned/)
    await expect(ensureHolderNodeExe('x64', { cacheDir, fetchImpl: fakeFetch(() => 404).fetchImpl, overridePath: '' })).rejects.toThrow(/HTTP 404/)
    expect(readdirSync(cacheDir)).toEqual([])
  })

  it('a corrupted cache file is downloaded again', async () => {
    const cacheDir = tmp()
    const { calls, fetchImpl } = fakeFetch(() => fakeNodeExe('x64'))
    const exe = await ensureHolderNodeExe('x64', { cacheDir, fetchImpl, overridePath: '' })
    writeFileSync(exe, 'corrupted')
    expect(await ensureHolderNodeExe('x64', { cacheDir, fetchImpl, overridePath: '' })).toBe(exe)
    expect(calls.length).toBe(2)
    expect(readFileSync(exe)).toEqual(fakeNodeExe('x64'))
  })

  it('override (BAT_PTY_HOLDER_NODE_EXE) is used only when it matches the pin; never downloads', async () => {
    const d = tmp()
    const good = path.join(d, 'node.exe')
    writeFileSync(good, fakeNodeExe('x64'))
    const { calls, fetchImpl } = fakeFetch(() => 500)
    expect(await ensureHolderNodeExe('x64', { cacheDir: d, fetchImpl, overridePath: good })).toBe(good)
    const bad = path.join(d, 'other.exe')
    writeFileSync(bad, Buffer.alloc(512))
    await expect(ensureHolderNodeExe('x64', { cacheDir: d, fetchImpl, overridePath: bad })).rejects.toThrow(/BAT_PTY_HOLDER_NODE_EXE=.* is not the pinned/)
    expect(calls).toEqual([])
  })

  it('the real pin rejects anything but the real node.exe', async () => {
    restore()
    try {
      const d = tmp()
      const f = path.join(d, 'node.exe')
      writeFileSync(f, fakeNodeExe('x64'))
      await expect(ensureHolderNodeExe('x64', { cacheDir: d, overridePath: f })).rejects.toThrow(/is not the pinned node v24/)
    } finally {
      restore = useFakeHolderNode('x64')
    }
  })
})

describe('holder directory and manifest', () => {
  let restore
  beforeAll(() => { restore = useFakeHolderNode('x64') })
  afterAll(() => restore())

  it('externalPackagesOf: only non-builtin package roots', () => {
    expect(externalPackagesOf('require("fs");require("node:path");require("./x");require("@lydell/node-pty");require("ws/lib/a");require(\'@a/b/c\')')).toEqual(['@a/b', '@lydell/node-pty', 'ws'])
  })

  it('copies exe, Node LICENSE, terminal-server.js, node-pty JS + win32 natives; no .d.ts / README / .pdb', () => {
    const resources = path.join(tmp(), 'resources')
    const { holderDir, manifest } = writeFakeHolder(resources, 'x64')
    expect(manifest.files.map((f) => f.path)).toEqual([
      PTY_HOLDER_EXE_NAME,
      'node-LICENSE',
      'node_modules/@lydell/node-pty-win32-x64/conpty.node',
      'node_modules/@lydell/node-pty-win32-x64/conpty_console_list.node',
      'node_modules/@lydell/node-pty-win32-x64/package.json',
      'node_modules/@lydell/node-pty/LICENSE',
      'node_modules/@lydell/node-pty/conpty_console_list_agent.js',
      'node_modules/@lydell/node-pty/index.js',
      'node_modules/@lydell/node-pty/package.json',
      'node_modules/@lydell/node-pty/worker/conoutSocketWorker.js',
      'terminal-server.js',
    ])
    expect(ptyHolderProblems(holderDir, 'x64')).toEqual([])
    expect(manifest).toMatchObject({ schema: 1, nodeVersion: REAL_PIN.version, arch: 'x64', exe: 'bat-pty-holder.exe', entry: 'terminal-server.js' })
    expect(PTY_HOLDER_EXE_NAME.toLowerCase()).not.toBe('betteragentterminal.exe')
    // same bytes as the packaged app (terminal-server.js is the asar.unpacked copy)
    expect(readFileSync(path.join(holderDir, 'terminal-server.js'))).toEqual(readFileSync(path.join(resources, 'app.asar.unpacked', 'dist-electron', 'terminal-server.js')))
  })

  it('line 3 of the manifest is `  "key": "<key>",` (build/installer.nsh reads it); key = <nodeVersion>-<12 hex>', () => {
    const { holderDir, manifest } = writeFakeHolder(path.join(tmp(), 'resources'), 'x64')
    const text = readFileSync(path.join(holderDir, PTY_HOLDER_MANIFEST_FILE), 'utf8')
    expect(text.split('\n')[2]).toBe(`  "key": "${manifest.key}",`)
    expect(manifest.key).toMatch(PTY_HOLDER_KEY_RE)
    expect(manifest.key.startsWith(`${REAL_PIN.version}-`)).toBe(true)
    expect(text).toBe(serializeHolderManifest(manifest))
    expect(text).not.toMatch(/"(builtAt|batVersion|version)"/) // same content → same bytes (installer byte compare)
  })

  it('key depends only on the files: order-independent, changes with any size / hash / path / Node version', () => {
    const files = [{ path: 'a', size: 1, sha256: 'x' }, { path: 'b', size: 2, sha256: 'y' }]
    const key = holderKey('24.22.2', files)
    expect(holderKey('24.22.2', [...files].reverse())).toBe(key)
    expect(holderKey('24.22.3', files)).not.toBe(key)
    expect(holderKey('24.22.2', [{ ...files[0], sha256: 'z' }, files[1]])).not.toBe(key)
    expect(holderKey('24.22.2', [{ ...files[0], size: 3 }, files[1]])).not.toBe(key)
    expect(holderKey('24.22.2', [{ ...files[0], path: 'c' }, files[1]])).not.toBe(key)
    expect(buildHolderManifest(files, { arch: 'x64' }).key).toBe(key)
  })

  it('ptyHolderProblems: tampering, extra / missing files, bad key, BetterAgentTerminal.exe, wrong arch', () => {
    const make = () => writeFakeHolder(path.join(tmp(), 'resources'), 'x64').holderDir
    let d = make()
    writeFileSync(path.join(d, 'node_modules', '@lydell', 'node-pty', 'index.js'), 'changed')
    expect(ptyHolderProblems(d, 'x64').some((p) => p.startsWith('node_modules/@lydell/node-pty/index.js: size'))).toBe(true)

    d = make()
    writeFileSync(path.join(d, 'extra.txt'), '')
    expect(ptyHolderProblems(d, 'x64')).toEqual(['not in the manifest: extra.txt'])

    d = make()
    rmSync(path.join(d, 'terminal-server.js'))
    expect(ptyHolderProblems(d, 'x64')).toEqual(['missing: terminal-server.js'])

    d = make()
    const m = JSON.parse(readFileSync(path.join(d, PTY_HOLDER_MANIFEST_FILE), 'utf8'))
    writeFileSync(path.join(d, PTY_HOLDER_MANIFEST_FILE), serializeHolderManifest({ ...m, key: '24.22.2-000000000000' }))
    expect(ptyHolderProblems(d, 'x64')).toEqual([expect.stringMatching(/^manifest key 24\.22\.2-000000000000 does not match its files/)])

    d = make()
    writeFileSync(path.join(d, PTY_HOLDER_MANIFEST_FILE), JSON.stringify(m)) // valid JSON, key not on line 3
    expect(ptyHolderProblems(d, 'x64')).toContain('manifest line 3 is not `  "key": "<key>",` (build/installer.nsh reads it)')

    d = make()
    const files = m.files.map((f) => (f.path === PTY_HOLDER_EXE_NAME ? { ...f, path: 'BetterAgentTerminal.exe' } : f))
    writeFileSync(path.join(d, 'BetterAgentTerminal.exe'), readFileSync(path.join(d, PTY_HOLDER_EXE_NAME)))
    rmSync(path.join(d, PTY_HOLDER_EXE_NAME))
    writeFileSync(path.join(d, PTY_HOLDER_MANIFEST_FILE), serializeHolderManifest(buildHolderManifest(files, { arch: 'x64' })))
    const problems = ptyHolderProblems(d, 'x64')
    expect(problems).toContain('BetterAgentTerminal.exe: the holder must not ship BetterAgentTerminal.exe (NSIS ends it by image name)')
    expect(problems).toContain('manifest does not list bat-pty-holder.exe')

    // T0859: Node's LICENSE is required and must be the pinned one
    d = make()
    rmSync(path.join(d, 'node-LICENSE'))
    expect(ptyHolderProblems(d, 'x64')).toEqual(['missing: node-LICENSE'])

    d = make()
    expect(ptyHolderProblems(d, 'arm64')).toEqual(expect.arrayContaining(['manifest arch x64, expected arm64']))
    expect(ptyHolderProblems(path.join(tmp(), 'none'), 'x64')[0]).toMatch(/holder-manifest\.json: missing$/)
  })

  it('terminal-server.js requiring a package the holder does not carry → the build fails', () => {
    const resources = path.join(tmp(), 'resources')
    writeFakeAppFiles(resources, 'x64', { serverSource: 'require("@lydell/node-pty");require("ws")' })
    expect(() => holderSourceFiles(resources, 'x64', 'node.exe', 'node-LICENSE')).toThrow(/requires ws, which the holder does not carry/)
  })
})

describe('afterPackPtyHolder', () => {
  let restore
  beforeAll(() => { restore = useFakeHolderNode('x64') })
  afterAll(() => restore())

  const context = (appOutDir, platform, arch = 1) => ({
    appOutDir,
    arch,
    electronPlatformName: platform,
    packager: { getResourcesDir: (out) => path.join(out, 'resources') },
  })

  it('mac / linux: nothing fetched, nothing written', async () => {
    for (const platform of ['darwin', 'linux']) {
      const out = tmp()
      writeFakeAppFiles(path.join(out, 'resources'), 'x64')
      const { calls, fetchImpl } = fakeFetch(nodeOrLicense)
      expect(await afterPackPtyHolder(context(out, platform), { fetchImpl, cacheDir: tmp(), overridePath: '', licenseOverridePath: '' })).toBeNull()
      expect(calls).toEqual([])
      expect(existsSync(path.join(out, 'resources', 'pty-holder'))).toBe(false)
    }
    expect(await afterPackPtyHolder(null)).toBeNull()
  })

  it('win32 x64 (electron-builder Arch 1): assembles resources/pty-holder and checks it', async () => {
    const out = tmp()
    writeFakeAppFiles(path.join(out, 'resources'), 'x64')
    const { calls, fetchImpl } = fakeFetch(nodeOrLicense)
    const logs = []
    const result = await afterPackPtyHolder(context(out, 'win32', 1), { fetchImpl, cacheDir: tmp(), overridePath: '', licenseOverridePath: '', log: (l) => logs.push(l) })
    expect(calls).toEqual([holderNodeDownloadUrl('x64'), holderNodeLicenseUrl()])
    expect(result.holderDir).toBe(path.join(out, 'resources', 'pty-holder'))
    expect(ptyHolderProblems(result.holderDir, 'x64')).toEqual([])
    expect(readFileSync(path.join(result.holderDir, 'node-LICENSE'))).toEqual(fakeNodeLicense())
    expect(logs.at(-1)).toMatch(/^PTY holder 24\.\d+\.\d+-[0-9a-f]{12} in resources[\\/]pty-holder \(11 files, \d+ bytes\)$/)
  })

  it('win32 without the app files: fails before downloading', async () => {
    const out = tmp()
    mkdirSync(path.join(out, 'resources'), { recursive: true })
    const { calls, fetchImpl } = fakeFetch(nodeOrLicense)
    await expect(afterPackPtyHolder(context(out, 'win32'), { fetchImpl, cacheDir: tmp(), overridePath: '', licenseOverridePath: '' })).rejects.toThrow(/terminal-server\.js missing/)
    expect(calls).toEqual([])
  })

  it('builder arch names', () => {
    expect([0, 1, 2, 3, 4, 'arm64'].map(builderArchName)).toEqual(['ia32', 'x64', 'armv7l', 'arm64', 'universal', 'arm64'])
  })
})

describe('holder root (D2) and the install-directory prefix trap', () => {
  it('per-user %LOCALAPPDATA%\\BAT-PtyHolder, per-machine %ProgramFiles%\\BAT-PtyHolder', () => {
    const env = { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', ProgramW6432: 'C:\\Program Files', ProgramFiles: 'C:\\Program Files (x86)' }
    expect(holderRootFor('per-user', env)).toBe('C:\\Users\\u\\AppData\\Local\\BAT-PtyHolder')
    expect(holderRootFor('per-machine', env)).toBe('C:\\Program Files\\BAT-PtyHolder')
    expect(PTY_HOLDER_ROOT_DIR_NAME).toBe('BAT-PtyHolder')
    expect(() => holderRootFor('per-user', {})).toThrow()
  })

  it('default install directories never overlap the holder roots', () => {
    const env = { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', ProgramW6432: 'C:\\Program Files' }
    expect(holderRootConflictsWithInstallDir(holderRootFor('per-user', env), 'C:\\Users\\u\\AppData\\Local\\Programs\\BetterAgentTerminal')).toBe(false)
    expect(holderRootConflictsWithInstallDir(holderRootFor('per-machine', env), 'C:\\Program Files\\BetterAgentTerminal')).toBe(false)
  })

  it('the trap: install directory name + suffix (StartsWith without a trailing \\) is a conflict', () => {
    // why the root is not "<install dir name> PTY Holder"
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BetterAgentTerminal PTY Holder', 'C:\\Program Files\\BetterAgentTerminal')).toBe(true)
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BetterAgentTerminal-PtyHolder', 'C:\\Program Files\\BetterAgentTerminal')).toBe(true)
    // a custom install directory that is a prefix of our root
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BAT-PtyHolder', 'C:\\Program Files\\BAT')).toBe(true)
    expect(holderRootConflictsWithInstallDir('C:\\Users\\u\\AppData\\Local\\BAT-PtyHolder', 'c:\\users\\U\\appdata\\local\\bat')).toBe(true) // case-insensitive
    // the install directory inside the root, or equal to it
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BAT-PtyHolder', 'C:\\Program Files\\BAT-PtyHolder\\app')).toBe(true)
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BAT-PtyHolder', 'C:\\Program Files\\BAT-PtyHolder')).toBe(true)
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BAT-PtyHolder', '')).toBe(true)
    expect(holderRootConflictsWithInstallDir('C:\\Program Files\\BAT-PtyHolder', 'D:\\Apps\\BetterAgentTerminal')).toBe(false)
  })
})

// T0859 (塔台補充 1): BAT decides at fork time with electron/pty-holder.ts; the rules must not drift from this file
describe('electron/pty-holder.ts and scripts/pty-holder.cjs give the same answers', () => {
  it('same constants', () => {
    expect(batHolder.PTY_HOLDER_ROOT_DIR_NAME).toBe(PTY_HOLDER_ROOT_DIR_NAME)
    expect(batHolder.PTY_HOLDER_RESOURCES_DIR).toBe(holder.PTY_HOLDER_RESOURCES_DIR)
    expect(batHolder.PTY_HOLDER_MANIFEST_FILE).toBe(PTY_HOLDER_MANIFEST_FILE)
    expect(batHolder.PTY_HOLDER_EXE_NAME).toBe(PTY_HOLDER_EXE_NAME)
    expect(batHolder.PTY_HOLDER_ENTRY).toBe(holder.PTY_HOLDER_ENTRY)
    expect(batHolder.PTY_HOLDER_MANIFEST_SCHEMA).toBe(holder.PTY_HOLDER_MANIFEST_SCHEMA)
    expect(batHolder.PTY_HOLDER_KEY_RE.source).toBe(PTY_HOLDER_KEY_RE.source)
    // the NSIS marker BAT looks for is the one customInstall writes (T0823)
    const nsh = readFileSync(path.join(ROOT, 'build', 'installer.nsh'), 'utf8')
    expect(nsh).toContain(`!define BAT_INSTALLER_QUIT_MARKER "resources\\${batHolder.NSIS_INSTALL_MARKER}"`)
  })

  it('same key for the same files', () => {
    const sets = [
      [],
      [{ path: 'a', size: 1, sha256: 'x' }],
      [{ path: 'b', size: 2, sha256: 'y' }, { path: 'a', size: 1, sha256: 'x' }],
      [{ path: 'node_modules/@lydell/node-pty/index.js', size: 1234, sha256: 'f'.repeat(64) }, { path: 'bat-pty-holder.exe', size: 93922624, sha256: '1'.repeat(64) }],
    ]
    for (const files of sets) {
      for (const v of ['24.22.2', '1.2.3']) expect(batHolder.holderKey(v, files)).toBe(holderKey(v, files))
    }
  })

  it('same holder roots', () => {
    const envs = [
      { LOCALAPPDATA: 'C:\\Users\\demo\\AppData\\Local', ProgramW6432: 'C:\\Program Files', ProgramFiles: 'C:\\Program Files (x86)' },
      { LOCALAPPDATA: 'D:\\Profiles\\demo\\Local', ProgramFiles: 'E:\\Apps' },
      { LOCALAPPDATA: 'C:\\Users\\demo\\AppData\\Local' },
    ]
    for (const env of envs) {
      for (const scope of ['per-user', 'per-machine']) expect(batHolder.holderRootFor(scope, env)).toBe(holderRootFor(scope, env))
    }
    expect(() => batHolder.holderRootFor('per-user', {})).toThrow()
    expect(() => holderRootFor('per-user', {})).toThrow()
  })

  it('same prefix-conflict answers (incl. the "install directory name + suffix" trap)', () => {
    const roots = ['C:\\Program Files\\BAT-PtyHolder', 'C:\\Users\\demo\\AppData\\Local\\BAT-PtyHolder', '']
    const installs = [
      'C:\\Program Files\\BetterAgentTerminal', 'C:\\Users\\demo\\AppData\\Local\\Programs\\BetterAgentTerminal',
      'C:\\Program Files\\BAT', 'c:\\program files\\bat-ptyholder', 'C:\\Program Files\\BAT-PtyHolder\\app',
      'C:\\Users\\demo\\AppData\\Local\\B', 'D:\\Apps\\BetterAgentTerminal', 'C:\\', '',
    ]
    for (const root of roots) {
      for (const inst of installs) expect([root, inst, batHolder.holderRootConflictsWithInstallDir(root, inst)]).toEqual([root, inst, holderRootConflictsWithInstallDir(root, inst)])
    }
  })

  describe('a holder the build assembled is accepted by BAT; every change ptyHolderProblems rejects, BAT rejects too', () => {
    let restore
    beforeAll(() => { restore = useFakeHolderNode('x64') })
    afterAll(() => restore())

    /** resources/pty-holder (as packaged) + a copy at <root>/<key> (as the installer leaves it) */
    function packagedAndCopied() {
      const base = tmp()
      const resources = path.join(base, 'resources')
      const { holderDir, manifest } = writeFakeHolder(resources, 'x64')
      const copy = path.join(base, 'BAT-PtyHolder', manifest.key)
      cpSync(holderDir, copy, { recursive: true })
      const bytes = readFileSync(path.join(holderDir, PTY_HOLDER_MANIFEST_FILE))
      return { holderDir, copy, manifest, bytes }
    }
    const batProblems = ({ copy, manifest, bytes }) => batHolder.holderDirProblems(copy, manifest, bytes, batHolder.defaultPtyHolderFsDeps)

    it('the packaged manifest passes BAT\'s own manifest check; the copy passes both checks', async () => {
      const h = packagedAndCopied()
      expect(batHolder.manifestProblems(h.manifest)).toEqual([])
      expect(ptyHolderProblems(h.copy, 'x64')).toEqual([])
      expect(await batProblems(h)).toEqual([])
    })

    it('changed file, unlisted file (a planted DLL), missing file, other manifest → both reject', async () => {
      const cases = [
        (c) => writeFileSync(path.join(c, 'node_modules', '@lydell', 'node-pty', 'index.js'), 'changed'),
        (c) => writeFileSync(path.join(c, 'version.dll'), 'MZ'),
        (c) => rmSync(path.join(c, 'node-LICENSE')),
        (c) => writeFileSync(path.join(c, PTY_HOLDER_MANIFEST_FILE), readFileSync(path.join(c, PTY_HOLDER_MANIFEST_FILE), 'utf8').replace('"arch": "x64"', '"arch": "arm64"')),
      ]
      for (const change of cases) {
        const h = packagedAndCopied()
        change(h.copy)
        expect(ptyHolderProblems(h.copy, 'x64').length).toBeGreaterThan(0)
        expect((await batProblems(h)).length).toBeGreaterThan(0)
      }
    })

    it.runIf(process.platform === 'win32')('end to end on Windows: resolvePtyHolder picks the copy under %LOCALAPPDATA%\\BAT-PtyHolder', async () => {
      const base = tmp()
      const resources = path.join(base, 'Programs', 'BetterAgentTerminal', 'resources')
      const { holderDir, manifest } = writeFakeHolder(resources, 'x64')
      writeFileSync(path.join(resources, batHolder.NSIS_INSTALL_MARKER), '')
      const local = path.join(base, 'Local')
      cpSync(holderDir, path.join(local, 'BAT-PtyHolder', manifest.key), { recursive: true })
      const decision = await batHolder.resolvePtyHolder({
        platform: 'win32',
        isPackaged: true,
        execPath: path.join(base, 'Programs', 'BetterAgentTerminal', 'BetterAgentTerminal.exe'),
        resourcesPath: resources,
        arch: 'x64',
        env: { LOCALAPPDATA: local, ProgramW6432: path.join(base, 'PF') },
      })
      expect(decision).toMatchObject({ use: true, holder: { key: manifest.key, scope: 'per-user', dir: path.join(local, 'BAT-PtyHolder', manifest.key) } })
    })
  })
})

describe('source guards', () => {
  const nsh = readFileSync(path.join(ROOT, 'build', 'installer.nsh'), 'utf8')
  const macro = nsh.slice(nsh.indexOf('!macro batInstallPtyHolder'), nsh.indexOf('!macroend', nsh.indexOf('!macro batInstallPtyHolder')))

  it('installer.nsh: same root name, source dir and manifest name as scripts/pty-holder.cjs', () => {
    expect(nsh).toContain(`!define BAT_PTY_HOLDER_ROOT_NAME "${PTY_HOLDER_ROOT_DIR_NAME}"`)
    expect(nsh).toContain(`!define BAT_PTY_HOLDER_SOURCE "resources\\${holder.PTY_HOLDER_RESOURCES_DIR}"`)
    expect(nsh).toContain(`!define BAT_PTY_HOLDER_MANIFEST "${PTY_HOLDER_MANIFEST_FILE}"`)
  })

  it('installer.nsh: root by scope, prefix check both ways before anything is copied', () => {
    const order = [
      '${If} $installMode == "all"',
      'StrCpy $R1 "$PROGRAMFILES64\\${BAT_PTY_HOLDER_ROOT_NAME}"',
      'StrCpy $R1 "$LOCALAPPDATA\\${BAT_PTY_HOLDER_ROOT_NAME}"',
      '${If} $R3 == $INSTDIR',
      '${OrIf} $R4 == $R1',
      "StrCmpS $R4 '  \"key\": \"' 0 batPtyHolderKeyLine",
      '${If} $R2 < 18',
      'CopyFiles /SILENT "$R0\\*.*" "$R7.partial"',
      'Rename "$R7.partial" "$R7"',
      'batPtyHolderCleanup:',
      'StrCmp $R3 $R6 batPtyHolderCleanNext',
    ].map((t) => macro.indexOf(t))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // the key prefix the installer looks for is what serializeHolderManifest writes (10 characters)
    expect('  "key": "'.length).toBe(10)
    expect(macro).toContain('StrCpy $R4 $R3 10')
  })

  it('installer.nsh: nothing is removed without the "unused" answer; the check matches <dir>\\ ignoring case', () => {
    expect(nsh).toContain("$$_.Path.StartsWith('${_DIR}\\', 'OrdinalIgnoreCase')")
    expect(nsh).toMatch(/!define BAT_PTY_HOLDER_IN_USE 10\b/)
    expect(nsh).toMatch(/!define BAT_PTY_HOLDER_UNUSED 11\b/)
    const removals = [...macro.matchAll(/RMDir \/r "([^"]+)"/g)].map((m) => m[1])
    expect(removals).toEqual(['$R7', '$R7.partial', '$R7.partial', '$R7.partial', '$R1\\$R3'])
    // each removal of a directory a holder may run from comes right after an "unused" answer
    for (const target of ['RMDir /r "$R7"', 'RMDir /r "$R1\\$R3"']) {
      const at = macro.indexOf(target)
      const before = macro.slice(macro.lastIndexOf('!insertmacro batPtyHolderInUse', at), at)
      expect(before).toMatch(/\$\{(If|Else|EndIf)\}|BAT_PTY_HOLDER_UNUSED/)
      expect(before).toContain('BAT_PTY_HOLDER_UNUSED')
    }
    // the copy target is a .partial directory, never <key> itself
    expect(macro).not.toMatch(/CopyFiles[^\n]*"\$R7"/)
  })

  it('installer.nsh: customInstall keeps the T0823 marker first, then the holder; no new Var, nothing force-ended', () => {
    const install = nsh.slice(nsh.indexOf('!macro customInstall'), nsh.indexOf('!macroend', nsh.indexOf('!macro customInstall')))
    const marker = install.indexOf('FileOpen $0 "$INSTDIR\\${BAT_INSTALLER_QUIT_MARKER}" w')
    const copy = install.indexOf('!insertmacro batInstallPtyHolder')
    expect(marker).toBeGreaterThan(0)
    expect(copy).toBeGreaterThan(marker)
    expect([...nsh.matchAll(/^\s*Var\b.*$/gm)].map((m) => m[0].trim())).toEqual(['Var pid'])
    expect(nsh).not.toMatch(/Stop-Process|taskkill|KILL_PROCESS/)
    // T0823 customCheckAppRunning untouched
    const check = nsh.slice(nsh.indexOf('!macro customCheckAppRunning'))
    expect(check).toMatch(/!insertmacro IS_POWERSHELL_AVAILABLE\s+!insertmacro batRequestGracefulQuit\s+; electron-builder's check[^\n]*\n\s+!insertmacro _CHECK_APP_RUNNING\s+!macroend/)
    // every register the macro uses is saved and restored
    for (const r of ['$R0', '$R1', '$R2', '$R3', '$R4', '$R5', '$R6', '$R7', '$R8', '$R9']) {
      expect(macro).toContain(`Push ${r}`)
      expect(macro).toContain(`Pop ${r}`)
    }
  })

  it('package.json: no platform-level files (T0546), extraResources unchanged, afterPack hook kept', () => {
    const { build } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    for (const platform of ['win', 'mac', 'linux', 'nsis']) {
      expect(build[platform].files).toBeUndefined()
      expect(build[platform].extraResources).toBeUndefined()
      expect(build[platform].extraFiles).toBeUndefined()
    }
    expect(build.extraResources.map((e) => e.from)).toEqual(['scripts'])
    expect(build.afterPack).toBe('./scripts/version-manifest.cjs')
    expect(build.asarUnpack).toContain('dist-electron/terminal-server.js')
    expect(build.asarUnpack).toContain('node_modules/@lydell/node-pty/**/*')
    expect(build.asarUnpack).toContain('node_modules/@lydell/node-pty-*/**/*')
  })
})
