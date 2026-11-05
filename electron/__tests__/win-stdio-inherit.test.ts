// BUG-213 / T0866 (D291): the Terminal Server start runs with the inherited stdio handles made non-inheritable
// (electron/win-stdio-inherit.ts). The addon is mocked except in the last block, which loads the real node-gyp build
// when it exists (win32-x64 after `npm run build:native-win`).
import * as fs from 'fs'
import { createRequire } from 'module'
import * as path from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  WIN_STDIO_INHERIT_ADDON_FILE,
  WIN_STDIO_INHERIT_BUILD_SUBDIR,
  WIN_STDIO_INHERIT_RESOURCES_DIR,
  WIN_STDIO_INHERIT_SOURCE_DIR,
  createWinStdioInheritGuard,
  defaultWinStdioInheritLoadDeps,
  loadWinStdioInheritAddon,
  winStdioInheritAddonCandidates,
  type WinStdioInheritAddon,
  type WinStdioInheritLoad,
} from '../win-stdio-inherit'

const root = path.resolve(__dirname, '..', '..')
const requireCjs = createRequire(__filename)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildSide = requireCjs(path.join(root, 'scripts', 'win-stdio-inherit.cjs')) as {
  ADDON_FILE: string
  ADDON_SOURCE_DIR: string
  ADDON_BUILD_SUBDIR: string
  ADDON_RESOURCES_DIR: string
  builtAddonPath: (projectRoot: string) => string
  packagedAddonPath: (resourcesPath: string) => string
}

function guardWith(addon: WinStdioInheritAddon | null, platform: NodeJS.Platform = 'win32', reason: 'not-found' | 'load-failed' | 'bad-exports' = 'not-found') {
  const logs: string[] = []
  const candidates = vi.fn(() => ['C:\\fake\\bat_win_stdio_inherit.node'])
  const load = vi.fn((): WinStdioInheritLoad => (addon ? { addon, file: 'C:\\fake\\bat_win_stdio_inherit.node' } : { addon: null, reason }))
  const guard = createWinStdioInheritGuard({ platform, candidates, log: (l) => logs.push(l), load })
  return { guard, logs, candidates, load }
}

describe('createWinStdioInheritGuard', () => {
  it.each(['darwin', 'linux'] as const)('%s: start() as is — nothing looked up, loaded or logged', (platform) => {
    const disable = vi.fn(() => [1n])
    const { guard, logs, candidates, load } = guardWith({ disable, restore: vi.fn(() => 1) }, platform)
    const start = vi.fn(() => 'child')
    expect(guard.run(start)).toBe('child')
    expect(start).toHaveBeenCalledTimes(1)
    expect(candidates).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(disable).not.toHaveBeenCalled()
    expect(logs).toEqual([])
  })

  it('win32: disable → start → restore with exactly the handles disable reported; counts only in the log', () => {
    const order: string[] = []
    const saved = [0x1a4n, 0x2c8n]
    const addon: WinStdioInheritAddon = {
      disable: vi.fn(() => { order.push('disable'); return saved }),
      restore: vi.fn((handles: bigint[]) => { order.push('restore'); return handles.length }),
    }
    const { guard, logs } = guardWith(addon)
    const child = guard.run(() => { order.push('start'); return 'child' })
    expect(child).toBe('child')
    expect(order).toEqual(['disable', 'start', 'restore'])
    expect(addon.restore).toHaveBeenCalledWith(saved)
    expect(logs).toEqual(['[stdio-inherit] Terminal Server started without 2 inherited handle(s); 2 restored'])
    // handle values never reach the log
    expect(logs.join('\n')).not.toMatch(/1a4|2c8|420|712/i)
  })

  it('win32: nothing inheritable → restore([]) and a 0-count line', () => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => []), restore: vi.fn(() => 0) }
    const { guard, logs } = guardWith(addon)
    guard.run(() => null)
    expect(addon.restore).toHaveBeenCalledWith([])
    expect(logs).toEqual(['[stdio-inherit] Terminal Server started without 0 inherited handle(s); 0 restored'])
  })

  it('win32: restore runs when the start throws, and the error propagates', () => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => [7n]), restore: vi.fn(() => 1) }
    const { guard } = guardWith(addon)
    expect(() => guard.run(() => { throw new Error('spawn EACCES') })).toThrow('spawn EACCES')
    expect(addon.restore).toHaveBeenCalledWith([7n])
  })

  it.each([
    ['not-found', 'addon unavailable (not-found)'],
    ['load-failed', 'addon unavailable (load-failed)'],
    ['bad-exports', 'addon unavailable (bad-exports)'],
  ] as const)('win32 fail open: %s → start as before, one line with the reason code', (reason, text) => {
    const { guard, logs } = guardWith(null, 'win32', reason)
    const start = vi.fn(() => 'child')
    expect(guard.run(start)).toBe('child')
    expect(start).toHaveBeenCalledTimes(1)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain(text)
  })

  it('win32 fail open: disable throws → start, no restore', () => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => { throw new Error('boom') }), restore: vi.fn(() => 0) }
    const { guard, logs } = guardWith(addon)
    expect(guard.run(() => 'child')).toBe('child')
    expect(addon.restore).not.toHaveBeenCalled()
    expect(logs).toEqual([expect.stringContaining('disable failed (disable-failed)')])
  })

  it.each([
    ['null', null],
    ['numbers', [1, 2]],
    ['a string', 'x'],
    ['a mixed list', [1n, 'x']],
  ] as const)('win32 fail open: disable returns %s (not a BigInt list) → start, no restore', (_label, result) => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => result), restore: vi.fn(() => 0) }
    const { guard, logs } = guardWith(addon)
    expect(guard.run(() => 'child')).toBe('child')
    expect(addon.restore).not.toHaveBeenCalled()
    expect(logs).toEqual([expect.stringContaining('(bad-result)')])
  })

  it('win32: restore throwing still returns the child and logs restore-failed', () => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => [3n]), restore: vi.fn(() => { throw new Error('x') }) }
    const { guard, logs } = guardWith(addon)
    expect(guard.run(() => 'child')).toBe('child')
    expect(logs).toEqual(['[stdio-inherit] restore failed (restore-failed) for 1 handle(s)'])
  })

  it('win32: the addon is looked up once (first start), then reused — also after a failed lookup', () => {
    const addon: WinStdioInheritAddon = { disable: vi.fn(() => []), restore: vi.fn(() => 0) }
    const ok = guardWith(addon)
    ok.guard.run(() => 1)
    ok.guard.run(() => 2)
    expect(ok.candidates).toHaveBeenCalledTimes(1)
    expect(ok.load).toHaveBeenCalledTimes(1)
    expect(addon.disable).toHaveBeenCalledTimes(2)

    const missing = guardWith(null)
    missing.guard.run(() => 1)
    missing.guard.run(() => 2)
    expect(missing.load).toHaveBeenCalledTimes(1)
    expect(missing.logs).toHaveLength(2)
  })

  it('win32: a throwing loader or candidate list is a load failure, never an exception', () => {
    const logs: string[] = []
    const guard = createWinStdioInheritGuard({ platform: 'win32', candidates: () => { throw new Error('no app path') }, log: (l) => logs.push(l) })
    expect(guard.run(() => 'child')).toBe('child')
    expect(logs[0]).toContain('(load-failed)')
  })
})

describe('loadWinStdioInheritAddon', () => {
  const exists = (files: string[]) => (f: string) => files.includes(f)

  it('first existing candidate; missing → not-found', () => {
    const dlopen = vi.fn(() => ({ disable: () => [], restore: () => 0 }))
    expect(loadWinStdioInheritAddon(['a', 'b'], { exists: exists([]), dlopen })).toEqual({ addon: null, reason: 'not-found' })
    expect(dlopen).not.toHaveBeenCalled()
    const loaded = loadWinStdioInheritAddon(['a', 'b'], { exists: exists(['b']), dlopen })
    expect(dlopen).toHaveBeenCalledWith('b')
    expect(loaded.addon).not.toBeNull()
    expect('file' in loaded && loaded.file).toBe('b')
  })

  it('dlopen throwing → load-failed; exports without both functions → bad-exports', () => {
    expect(loadWinStdioInheritAddon(['a'], { exists: () => true, dlopen: () => { throw new Error('%1 is not a valid Win32 application') } })).toEqual({ addon: null, reason: 'load-failed' })
    expect(loadWinStdioInheritAddon(['a'], { exists: () => true, dlopen: () => ({ disable: () => [] }) })).toEqual({ addon: null, reason: 'bad-exports' })
    expect(loadWinStdioInheritAddon(['a'], { exists: () => true, dlopen: () => null })).toEqual({ addon: null, reason: 'bad-exports' })
  })

  it('an exists() that throws counts as missing', () => {
    expect(loadWinStdioInheritAddon(['a'], { exists: () => { throw new Error('EPERM') }, dlopen: () => ({}) })).toEqual({ addon: null, reason: 'not-found' })
  })
})

describe('where the addon is looked for (parity with scripts/win-stdio-inherit.cjs)', () => {
  it('packaged: <resources>/native/<file>; development: <app>/native/win-stdio-inherit/build/Release/<file>', () => {
    const resourcesPath = path.join(root, 'release', 'win-unpacked', 'resources')
    expect(winStdioInheritAddonCandidates({ isPackaged: true, resourcesPath, appPath: 'ignored' })).toEqual([buildSide.packagedAddonPath(resourcesPath)])
    expect(winStdioInheritAddonCandidates({ isPackaged: false, resourcesPath: 'ignored', appPath: root })).toEqual([buildSide.builtAddonPath(root)])
    expect(WIN_STDIO_INHERIT_ADDON_FILE).toBe(buildSide.ADDON_FILE)
    expect(WIN_STDIO_INHERIT_SOURCE_DIR).toBe(buildSide.ADDON_SOURCE_DIR)
    expect(WIN_STDIO_INHERIT_BUILD_SUBDIR).toBe(buildSide.ADDON_BUILD_SUBDIR)
    expect(WIN_STDIO_INHERIT_RESOURCES_DIR).toBe(buildSide.ADDON_RESOURCES_DIR)
  })

  it('binding.gyp target name matches the file name; the source uses only the four kernel32 calls', () => {
    const gyp = fs.readFileSync(path.join(root, ...WIN_STDIO_INHERIT_SOURCE_DIR.split('/'), 'binding.gyp'), 'utf8')
    expect(gyp).toContain(`"target_name": "${WIN_STDIO_INHERIT_ADDON_FILE.replace(/\.node$/, '')}"`)
    const c = fs.readFileSync(path.join(root, ...WIN_STDIO_INHERIT_SOURCE_DIR.split('/'), 'src', 'win_stdio_inherit.c'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '') // comments mention CreateProcessW
    const winApi = new Set(c.match(/\b(?:Get|Set|Create|Close|Duplicate|Open)[A-Z]\w+(?=\s*\()/g) ?? [])
    expect([...winApi].sort()).toEqual(['GetHandleInformation', 'GetStartupInfoW', 'GetStdHandle', 'SetHandleInformation'])
  })

  it('no prebuilt .node is committed under native/ (D291)', () => {
    const tracked = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.name === 'build') return []
      const full = path.join(dir, e.name)
      return e.isDirectory() ? tracked(full) : [full]
    })
    expect(tracked(path.join(root, 'native')).filter((f) => f.endsWith('.node'))).toEqual([])
    expect(fs.readFileSync(path.join(root, ...WIN_STDIO_INHERIT_SOURCE_DIR.split('/'), '.gitignore'), 'utf8')).toMatch(/^build\/$/m)
  })
})

describe('forkTerminalServer goes through the guard (source guards)', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.ts'), 'utf8')
  const fork = main.slice(main.indexOf('async function forkTerminalServer('), main.indexOf('async function startTerminalServer('))

  it('both starts — the holder spawn and the fork — are wrapped, synchronously, and are the only starts', () => {
    expect(fork).toContain('return terminalServerStdioGuard.run(() => spawn(spec.command, spec.args, spec.options))')
    expect(fork).toContain('return terminalServerStdioGuard.run(() => runWithoutCrashpadClient(() => fork(serverScript, [], terminalServerForkOptions(plan.stdio, env))))')
    expect(fork.match(/terminalServerStdioGuard\.run\(/g)).toHaveLength(2)
    expect(fork.match(/\bspawn\(/g)).toHaveLength(1)
    expect(main.match(/fork\(serverScript/g)).toHaveLength(1)
    // nothing asynchronous inside the wrapped calls
    for (const line of fork.split('\n').filter((l) => l.includes('terminalServerStdioGuard.run('))) expect(line).not.toContain('await')
  })

  it('the guard is created once at module level with process.platform and the logger, no other use', () => {
    expect(main).toContain("import { createWinStdioInheritGuard, winStdioInheritAddonCandidates } from './win-stdio-inherit'")
    expect(main.match(/createWinStdioInheritGuard\(/g)).toHaveLength(1)
    expect(main).toContain('const terminalServerStdioGuard = createWinStdioInheritGuard({\n  platform: process.platform,')
    expect(main).toContain('candidates: () => winStdioInheritAddonCandidates({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() }),')
    expect(main.match(/terminalServerStdioGuard\./g)).toHaveLength(2)
  })

  it('the module stays free of electron imports', () => {
    const src = fs.readFileSync(path.join(root, 'electron', 'win-stdio-inherit.ts'), 'utf8')
    expect(src).not.toMatch(/from 'electron'|require\('electron'\)/)
  })
})

const builtAddon = buildSide.builtAddonPath(root)
describe.runIf(process.platform === 'win32' && process.arch === 'x64' && fs.existsSync(builtAddon))('the real addon (node-gyp build)', () => {
  it('loads with the default deps; disable / restore round-trip on this process', () => {
    const loaded = loadWinStdioInheritAddon([builtAddon], defaultWinStdioInheritLoadDeps)
    expect(loaded.addon).not.toBeNull()
    const saved = loaded.addon!.disable()
    expect(Array.isArray(saved)).toBe(true)
    expect((saved as unknown[]).every((h) => typeof h === 'bigint')).toBe(true)
    expect(loaded.addon!.restore(saved as bigint[])).toBe((saved as bigint[]).length)
    // a second disable after restore finds the same handles again
    const again = loaded.addon!.disable() as bigint[]
    expect(again.length).toBe((saved as bigint[]).length)
    expect(loaded.addon!.restore(again)).toBe(again.length)
    expect(loaded.addon!.restore([0n, 2n ** 64n - 1n])).toBe(0)
  })
})
