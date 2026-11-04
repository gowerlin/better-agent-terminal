// PLAN-065 W3 / T0859 — start the Terminal Server from the PTY holder (electron/pty-holder.ts, main.ts forkTerminalServer).
//
// - path and key: holder roots, scope order, key of a reported holderDir, the NSIS "install dir + suffix" prefix trap;
// - resolvePtyHolder decisions with an in-memory file system: not win32 / not packaged touch no file at all, zip
//   (no NSIS marker), packaged manifest missing / broken, arch, root conflicts, not installed, manifest copy differs,
//   tampered / unlisted / missing file → fall back; a matching copy is used; the other scope is tried;
// - fork parameters: the fallback is exactly { detached, stdio, env } (as before T0859); the holder start has
//   execPath = holder exe, cwd = holder directory, no ELECTRON_RUN_AS_NODE, same stdio (with `ipc`);
// - source guards on main.ts / terminal-server.ts / pty-manager.ts.
// The parity with scripts/pty-holder.cjs (same key / root / prefix answers, a real assembled holder accepted) is in
// scripts/__tests__/pty-holder.test.mjs.
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import {
  NSIS_INSTALL_MARKER,
  PTY_HOLDER_MANIFEST_FILE,
  holderKey,
  holderKeyOfDir,
  holderRootConflictsWithInstallDir,
  holderRootFor,
  holderScopeOrder,
  holderSpawnSpec,
  manifestProblems,
  ptyHolderLogLine,
  resolvePtyHolder,
  terminalServerForkOptions,
  type PtyHolderFile,
  type PtyHolderFsDeps,
  type PtyHolderInput,
  type ValidPtyHolder,
} from '../pty-holder'

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const norm = (p: string) => p.replace(/[\\/]+/g, '/')

const LOCAL = 'C:\\Users\\demo\\AppData\\Local'
const PF = 'C:\\Program Files'
const ENV = { LOCALAPPDATA: LOCAL, ProgramW6432: PF, ProgramFiles: PF, 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }
const PER_USER_INSTALL = `${LOCAL}\\Programs\\BetterAgentTerminal`
const PER_MACHINE_INSTALL = `${PF}\\BetterAgentTerminal`

const CONTENT: Record<string, string> = {
  'bat-pty-holder.exe': 'MZ fake node',
  'node-LICENSE': 'Node.js is licensed for use as follows:',
  'terminal-server.js': '"use strict"; require("@lydell/node-pty")',
  'node_modules/@lydell/node-pty/package.json': '{}',
  'node_modules/@lydell/node-pty-win32-x64/conpty.node': 'MZ conpty',
}

function manifestOf(content: Record<string, string> = CONTENT, arch = 'x64') {
  const files: PtyHolderFile[] = Object.entries(content)
    .map(([p, c]) => ({ path: p, size: Buffer.byteLength(c), sha256: sha(c) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const manifest = { schema: 1, key: holderKey('24.22.2', files), nodeVersion: '24.22.2', arch, exe: 'bat-pty-holder.exe', entry: 'terminal-server.js', files }
  return { manifest, text: JSON.stringify(manifest, null, 2) + '\n' }
}

/** In-memory fs: files by normalized path (either separator, case kept); counts every access. */
function memFs(files: Record<string, string | Buffer>) {
  const store = new Map<string, Buffer>()
  for (const [p, c] of Object.entries(files)) store.set(norm(p), Buffer.isBuffer(c) ? c : Buffer.from(c))
  const calls: string[] = []
  const isDir = (p: string) => {
    const prefix = norm(p).replace(/\/$/, '') + '/'
    return [...store.keys()].some((k) => k.startsWith(prefix))
  }
  const deps: PtyHolderFsDeps = {
    readFile: async (p) => { calls.push(`read ${p}`); return store.get(norm(p)) ?? null },
    kind: async (p) => { calls.push(`kind ${p}`); return store.has(norm(p)) ? 'file' : isDir(p) ? 'dir' : null },
    size: async (p) => { calls.push(`size ${p}`); return store.get(norm(p))?.length ?? null },
    sha256: async (p) => { calls.push(`sha ${p}`); const b = store.get(norm(p)); return b ? crypto.createHash('sha256').update(b).digest('hex') : null },
    listFiles: async (dir) => {
      calls.push(`list ${dir}`)
      const prefix = norm(dir).replace(/\/$/, '') + '/'
      return [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort()
    },
    now: () => 0,
  }
  return { deps, calls, store }
}

/** A per-user NSIS install with the holder copied to %LOCALAPPDATA%\BAT-PtyHolder\<key> (mutate before use). */
function installed(opts: { installDir?: string; copyTo?: 'per-user' | 'per-machine' | 'both' | 'none'; marker?: boolean; packagedManifest?: string | null } = {}) {
  const installDir = opts.installDir ?? PER_USER_INSTALL
  const resources = `${installDir}\\resources`
  const { manifest, text } = manifestOf()
  const files: Record<string, string> = {}
  if (opts.marker !== false) files[`${resources}\\${NSIS_INSTALL_MARKER}`] = ''
  if (opts.packagedManifest !== null) files[`${resources}\\pty-holder\\holder-manifest.json`] = opts.packagedManifest ?? text
  const copyTo = opts.copyTo ?? 'per-user'
  const roots = copyTo === 'both' ? [`${LOCAL}\\BAT-PtyHolder`, `${PF}\\BAT-PtyHolder`]
    : copyTo === 'per-user' ? [`${LOCAL}\\BAT-PtyHolder`]
      : copyTo === 'per-machine' ? [`${PF}\\BAT-PtyHolder`] : []
  for (const root of roots) {
    files[`${root}\\${manifest.key}\\holder-manifest.json`] = text
    for (const [p, c] of Object.entries(CONTENT)) files[`${root}\\${manifest.key}\\${p.split('/').join('\\')}`] = c
  }
  const input: PtyHolderInput = { platform: 'win32', isPackaged: true, execPath: `${installDir}\\BetterAgentTerminal.exe`, resourcesPath: resources, arch: 'x64', env: ENV }
  return { input, manifest, text, files }
}

describe('holder roots, scope order, key of a reported holder directory', () => {
  it('per-user %LOCALAPPDATA%\\BAT-PtyHolder, per-machine %ProgramFiles%\\BAT-PtyHolder (installer: $LOCALAPPDATA / $PROGRAMFILES64)', () => {
    expect(holderRootFor('per-user', ENV)).toBe(`${LOCAL}\\BAT-PtyHolder`)
    expect(holderRootFor('per-machine', ENV)).toBe(`${PF}\\BAT-PtyHolder`)
    expect(holderRootFor('per-machine', { ProgramFiles: 'D:\\PF' })).toBe('D:\\PF\\BAT-PtyHolder')
    expect(() => holderRootFor('per-user', {})).toThrow(/LOCALAPPDATA/)
  })

  it('install directory under Program Files → per-machine first; anything else → per-user first', () => {
    expect(holderScopeOrder(PER_MACHINE_INSTALL, ENV)).toEqual(['per-machine', 'per-user'])
    expect(holderScopeOrder('c:\\program files (x86)\\BAT', ENV)).toEqual(['per-machine', 'per-user'])
    expect(holderScopeOrder(PER_USER_INSTALL, ENV)).toEqual(['per-user', 'per-machine'])
    expect(holderScopeOrder('D:\\Apps\\BetterAgentTerminal', ENV)).toEqual(['per-user', 'per-machine'])
    // "C:\Program Files Extra" is not under "C:\Program Files"
    expect(holderScopeOrder('C:\\Program Files Extra\\BAT', ENV)).toEqual(['per-user', 'per-machine'])
  })

  it('the prefix trap: install directory name + suffix, either direction, ignoring case', () => {
    expect(holderRootConflictsWithInstallDir(`${PF}\\BAT-PtyHolder`, PER_MACHINE_INSTALL)).toBe(false)
    expect(holderRootConflictsWithInstallDir(`${LOCAL}\\BAT-PtyHolder`, PER_USER_INSTALL)).toBe(false)
    expect(holderRootConflictsWithInstallDir(`${PF}\\BAT-PtyHolder`, `${PF}\\BAT`)).toBe(true) // "BAT" + "-PtyHolder"
    expect(holderRootConflictsWithInstallDir(`${PF}\\BAT-PtyHolder`, 'c:\\PROGRAM FILES\\bat')).toBe(true)
    expect(holderRootConflictsWithInstallDir(`${PF}\\BAT-PtyHolder`, `${PF}\\BAT-PtyHolder\\app`)).toBe(true)
    expect(holderRootConflictsWithInstallDir(`${PF}\\BAT-PtyHolder`, '')).toBe(true)
  })

  it('holder key of a reported holderDir: the last segment if it is a key, otherwise "unrecognised" (never the path)', () => {
    expect(holderKeyOfDir(`${LOCAL}\\BAT-PtyHolder\\24.22.2-57c3b8bd7d7a`)).toBe('24.22.2-57c3b8bd7d7a')
    expect(holderKeyOfDir('/x/BAT-PtyHolder/24.22.2-57c3b8bd7d7a/')).toBe('24.22.2-57c3b8bd7d7a')
    expect(holderKeyOfDir(`${LOCAL}\\somewhere\\else`)).toBe('unrecognised')
    expect(holderKeyOfDir('')).toBe('unrecognised')
  })

  it('manifestProblems: key must match the files; required files; no BetterAgentTerminal.exe; no path escapes', () => {
    const { manifest } = manifestOf()
    expect(manifestProblems(manifest)).toEqual([])
    expect(manifestProblems({ ...manifest, key: '24.22.2-000000000000' })).toEqual(['manifest key 24.22.2-000000000000 does not match its files'])
    const traversal = { ...manifest, files: [...manifest.files, { path: '../evil.dll', size: 1, sha256: sha('x') }] }
    expect(manifestProblems(traversal)[0]).toMatch(/malformed/)
    const { manifest: noEntry } = manifestOf({ 'bat-pty-holder.exe': 'x' })
    expect(manifestProblems(noEntry)).toEqual(['manifest does not list terminal-server.js'])
    const { manifest: bad } = manifestOf({ ...CONTENT, 'BetterAgentTerminal.exe': 'x' })
    expect(manifestProblems(bad)).toEqual(['BetterAgentTerminal.exe: a holder never ships BetterAgentTerminal.exe'])
    expect(manifestProblems(null)).toEqual(['manifest is not an object'])
  })
})

describe('resolvePtyHolder', () => {
  it('🔴 not win32 / not packaged: decided before any file access', async () => {
    for (const input of [
      { ...installed().input, platform: 'darwin' as const },
      { ...installed().input, platform: 'linux' as const },
      { ...installed().input, isPackaged: false },
    ]) {
      const { deps, calls } = memFs(installed().files)
      const decision = await resolvePtyHolder(input, deps)
      expect(decision.use).toBe(false)
      expect(calls).toEqual([])
    }
    const { deps } = memFs({})
    expect(await resolvePtyHolder({ ...installed().input, platform: 'linux' }, deps)).toMatchObject({ use: false, reason: 'not-win32' })
    expect(await resolvePtyHolder({ ...installed().input, isPackaged: false }, deps)).toMatchObject({ use: false, reason: 'not-packaged' })
  })

  it('per-user install with a matching copy → use it (every listed file re-hashed, the tree listed)', async () => {
    const { input, files, manifest } = installed()
    const { deps, calls } = memFs(files)
    const decision = await resolvePtyHolder(input, deps)
    const dir = `${LOCAL}\\BAT-PtyHolder\\${manifest.key}`
    expect(decision).toEqual({
      use: true,
      holder: { key: manifest.key, scope: 'per-user', dir, exePath: `${dir}\\bat-pty-holder.exe`, entryPath: `${dir}\\terminal-server.js` },
      elapsedMs: 0,
    })
    expect(calls.filter((c) => c.startsWith('sha ')).length).toBe(Object.keys(CONTENT).length)
    expect(calls.some((c) => c.startsWith('list '))).toBe(true)
  })

  it('per-machine install: Program Files root first; the other scope is still tried', async () => {
    const pm = installed({ installDir: PER_MACHINE_INSTALL, copyTo: 'both' })
    expect(await resolvePtyHolder(pm.input, memFs(pm.files).deps)).toMatchObject({ use: true, holder: { scope: 'per-machine' } })
    const onlyUser = installed({ installDir: PER_MACHINE_INSTALL, copyTo: 'per-user' })
    expect(await resolvePtyHolder(onlyUser.input, memFs(onlyUser.files).deps)).toMatchObject({ use: true, holder: { scope: 'per-user' } })
  })

  it('zip / build:dir (no NSIS marker) → not used, the holder is not even looked at', async () => {
    const { input, files } = installed({ marker: false })
    const { deps, calls } = memFs(files)
    expect(await resolvePtyHolder(input, deps)).toMatchObject({ use: false, reason: 'not-nsis-install' })
    expect(calls.some((c) => c.includes('BAT-PtyHolder'))).toBe(false)
  })

  it('packaged manifest missing / not JSON / key not matching its files / other arch → not used', async () => {
    const missing = installed({ packagedManifest: null })
    expect(await resolvePtyHolder(missing.input, memFs(missing.files).deps)).toMatchObject({ use: false, reason: 'no-packaged-manifest' })
    const garbage = installed({ packagedManifest: '{nope' })
    expect(await resolvePtyHolder(garbage.input, memFs(garbage.files).deps)).toMatchObject({ use: false, reason: 'packaged-manifest-invalid' })
    const { manifest } = manifestOf()
    const wrongKey = installed({ packagedManifest: JSON.stringify({ ...manifest, key: '24.22.2-000000000000' }, null, 2) + '\n' })
    expect(await resolvePtyHolder(wrongKey.input, memFs(wrongKey.files).deps)).toMatchObject({ use: false, reason: 'packaged-manifest-invalid' })
    const arm = installed()
    expect(await resolvePtyHolder({ ...arm.input, arch: 'arm64' }, memFs(arm.files).deps)).toMatchObject({ use: false, reason: 'arch-mismatch', key: manifest.key })
  })

  it('holder root and install directory prefixes of each other (custom install C:\\Program Files\\BAT) → that root is skipped', async () => {
    // per-machine root conflicts; per-user has no copy → not installed
    const custom = installed({ installDir: `${PF}\\BAT`, copyTo: 'per-machine' })
    const { deps, calls } = memFs(custom.files)
    expect(await resolvePtyHolder(custom.input, deps)).toMatchObject({ use: false, reason: 'not-installed' })
    expect(calls.some((c) => norm(c).includes(norm(`${PF}\\BAT-PtyHolder`)))).toBe(false)
    // both roots conflict → no-holder-root
    const both = installed({ installDir: 'C:\\B', copyTo: 'none' })
    const env = { LOCALAPPDATA: 'C:\\B-local', ProgramW6432: 'C:\\' }
    expect(await resolvePtyHolder({ ...both.input, env }, memFs(both.files).deps)).toMatchObject({ use: false, reason: 'no-holder-root' })
  })

  it('no copy at either root → not-installed (key reported)', async () => {
    const { input, files, manifest } = installed({ copyTo: 'none' })
    expect(await resolvePtyHolder(input, memFs(files).deps)).toMatchObject({ use: false, reason: 'not-installed', key: manifest.key })
  })

  it('manifest copy differs / tampered file / unlisted file / missing file → holder-invalid, never used', async () => {
    const dirOf = (key: string) => `${LOCAL}\\BAT-PtyHolder\\${key}`
    const variants: Array<[string, (files: Record<string, string>, key: string) => void, RegExp]> = [
      ['manifest copy differs', (f, k) => { f[`${dirOf(k)}\\holder-manifest.json`] += ' ' }, /holder-manifest\.json: differs from the packaged one/],
      ['tampered terminal-server.js (same size)', (f, k) => { f[`${dirOf(k)}\\terminal-server.js`] = f[`${dirOf(k)}\\terminal-server.js`].replace('use', 'USE') }, /terminal-server\.js: SHA-256 differs/],
      ['planted DLL next to the exe', (f, k) => { f[`${dirOf(k)}\\version.dll`] = 'MZ' }, /not in the manifest: version\.dll/],
      ['missing LICENSE', (f, k) => { delete f[`${dirOf(k)}\\node-LICENSE`] }, /missing: node-LICENSE/],
      ['other size', (f, k) => { f[`${dirOf(k)}\\bat-pty-holder.exe`] = 'MZ' }, /bat-pty-holder\.exe: size 2/],
    ]
    for (const [label, change, detail] of variants) {
      const { input, files, manifest } = installed()
      change(files, manifest.key)
      const decision = await resolvePtyHolder(input, memFs(files).deps)
      expect([label, decision.use]).toEqual([label, false])
      if (!decision.use) {
        expect(decision.reason).toBe('holder-invalid')
        expect(decision.details?.join('\n')).toMatch(detail)
      }
    }
  })

  it('a broken per-user copy does not hide a good per-machine one', async () => {
    const { input, files, manifest } = installed({ copyTo: 'both' })
    files[`${LOCAL}\\BAT-PtyHolder\\${manifest.key}\\terminal-server.js`] = 'x'
    expect(await resolvePtyHolder(input, memFs(files).deps)).toMatchObject({ use: true, holder: { scope: 'per-machine' } })
  })

  it('never throws: a failing file access is a fallback decision', async () => {
    const { input, files } = installed()
    const { deps } = memFs(files)
    const broken: PtyHolderFsDeps = { ...deps, sha256: async () => { throw new Error('EIO') } }
    expect(await resolvePtyHolder(input, broken)).toMatchObject({ use: false, reason: 'holder-invalid', details: ['unexpected: EIO'] })
  })

  it('log line: key, scope, result, time; no path, no env', () => {
    const holder: ValidPtyHolder = { key: '24.22.2-57c3b8bd7d7a', scope: 'per-user', dir: `${LOCAL}\\BAT-PtyHolder\\24.22.2-57c3b8bd7d7a`, exePath: 'x', entryPath: 'y' }
    const used = ptyHolderLogLine({ use: true, holder, elapsedMs: 120 })
    expect(used).toBe('[pty-holder] Terminal Server from holder 24.22.2-57c3b8bd7d7a (per-user), verified in 120 ms')
    const skipped = ptyHolderLogLine({ use: false, reason: 'holder-invalid', key: '24.22.2-57c3b8bd7d7a', details: ['per-user: not in the manifest: version.dll'], elapsedMs: 5 })
    expect(skipped).toBe('[pty-holder] not used (holder-invalid) 24.22.2-57c3b8bd7d7a after 5 ms: per-user: not in the manifest: version.dll — forking the Terminal Server as before')
    for (const line of [used, skipped]) expect(line).not.toMatch(/demo|AppData|LOCALAPPDATA|TOKEN/i)
  })
})

describe('fork parameters', () => {
  const stdio = ['ignore', 'ignore', 'ignore', 'ipc'] as const
  const env = { PATH: 'C:\\Windows', BAT_USER_DATA: 'C:\\ud', BAT_TERMINAL_SERVER_BAT_VERSION: '0.7.4', ELECTRON_RUN_AS_NODE: '1' }

  it('🔴 fallback (macOS / Linux / dev / zip / no valid holder): exactly { detached, stdio, env } as before T0859', () => {
    const opts = terminalServerForkOptions([...stdio], env)
    expect(opts).toStrictEqual({ detached: true, stdio: [...stdio], env })
    expect(opts.env).toBe(env) // the same object, nothing removed or added
    expect(Object.keys(opts).sort()).toEqual(['detached', 'env', 'stdio'])
  })

  it('holder: execPath = holder exe, script in the holder, cwd = holder directory, no ELECTRON_RUN_AS_NODE, same stdio', () => {
    const dir = `${LOCAL}\\BAT-PtyHolder\\24.22.2-57c3b8bd7d7a`
    const holder: ValidPtyHolder = { key: '24.22.2-57c3b8bd7d7a', scope: 'per-user', dir, exePath: `${dir}\\bat-pty-holder.exe`, entryPath: `${dir}\\terminal-server.js` }
    const spec = holderSpawnSpec(holder, [...stdio], env)
    expect(spec.command).toBe(`${dir}\\bat-pty-holder.exe`)
    expect(spec.args).toEqual([`${dir}\\terminal-server.js`])
    expect(spec.options).toStrictEqual({
      detached: true,
      stdio: [...stdio],
      env: { PATH: 'C:\\Windows', BAT_USER_DATA: 'C:\\ud', BAT_TERMINAL_SERVER_BAT_VERSION: '0.7.4' },
      cwd: dir,
      windowsHide: true,
    })
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1') // the caller's env is not modified
    expect(spec.options.stdio).toContain('ipc')
  })
})

describe('source guards', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
  const main = read('main.ts')
  const fork = main.slice(main.indexOf('async function forkTerminalServer('), main.indexOf('\n}\n', main.indexOf('async function forkTerminalServer(')))

  it('main.ts: the holder is only looked at for a win32 packaged app; the fallback fork keeps the T0816 guard', () => {
    expect(fork).toMatch(/if \(process\.platform === 'win32' && app\.isPackaged\) \{\s*const holder = await resolvePtyHolder\(/)
    expect(fork).toContain('logger.log(ptyHolderLogLine(holder))')
    expect(fork).toMatch(/if \(holder\.use\) \{\s*const spec = holderSpawnSpec\(holder\.holder, plan\.stdio, env\)\s*return spawn\(spec\.command, spec\.args, spec\.options\)/)
    expect(fork).toMatch(/return runWithoutCrashpadClient\(\(\) => fork\(serverScript, \[\], terminalServerForkOptions\(plan\.stdio, env\)\)\)\s*$/)
    // the env is built once, before either start, and carries T0857's version
    expect(fork.indexOf('BAT_TERMINAL_SERVER_BAT_VERSION: app.getVersion()')).toBeLessThan(fork.indexOf('resolvePtyHolder('))
    // one spawn of a Terminal Server, from the holder spec only
    expect(main.match(/spawn\(spec\.command, spec\.args, spec\.options\)/g)).toHaveLength(1)
    // both callers wait for it (the holder check is async)
    expect(main.match(/const child = await forkTerminalServer\(serverScript, userDataPath\)/g)).toHaveLength(2)
  })

  it('pty-holder.ts imports no electron; terminal-server.ts reports holderDir without any env', () => {
    const holder = read('pty-holder.ts')
    expect(holder).not.toMatch(/from 'electron'|require\('electron'\)/)
    const entry = read('terminal-server.ts')
    expect(entry).toMatch(/const holderDir = runningFromPtyHolder\(\) \? __dirname : undefined/)
    expect(entry).toContain('fs.existsSync(path.join(__dirname, PTY_HOLDER_MANIFEST_FILE))')
    expect(entry).not.toMatch(/process\.env\.[A-Z_]*HOLDER/)
    expect(PTY_HOLDER_MANIFEST_FILE).toBe('holder-manifest.json')
  })

  it('pty-manager.ts logs the holder key of hello-ok, never the reported path', () => {
    const pty = read('pty-manager.ts')
    expect(pty).toContain('(hello.holderDir ? `, holder ${holderKeyOfDir(hello.holderDir)}` : \'\')')
    const logs = pty.split('\n').filter((l) => /logger\.(log|warn|error)/.test(l))
    expect(logs.filter((l) => /\$\{hello\.holderDir\}/.test(l))).toEqual([])
  })
})

