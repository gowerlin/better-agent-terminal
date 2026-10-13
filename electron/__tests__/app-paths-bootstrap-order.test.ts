// @vitest-environment node
/**
 * BUG-119 / T0480: app-paths-bootstrap must run before any other module of the
 * main process (static checks), and must set the app name before it touches any
 * path, then pin userData explicitly (runtime checks with a mocked electron).
 * T0485: it then starts the disk log + early crash capture and applies the macOS
 * PATH fix; those modules (logger / early-crash-log / early-path-fix) stay inside
 * the same small import whitelist.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ELECTRON_DIR = path.resolve(__dirname, '..')

function importSpecifiers(file: string): string[] {
  const source = fs.readFileSync(path.join(ELECTRON_DIR, file), 'utf-8')
  const specs: string[] = []
  // Covers `import x from 'y'`, `import { a,\n b } from 'y'`, `import 'y'` and `export … from 'y'`.
  const re = /^\s*(?:import|export)\s(?:[^'"`;]*?\sfrom\s)?['"]([^'"]+)['"]/gm
  for (let m = re.exec(source); m; m = re.exec(source)) specs.push(m[1])
  return specs
}

describe('static import order', () => {
  it("main.ts's first import is app-paths-bootstrap", () => {
    expect(importSpecifiers('main.ts')[0]).toBe('./app-paths-bootstrap')
  })

  it('app-paths-bootstrap imports no other electron/ module than userdata-migration / logger / early-*', () => {
    const specs = importSpecifiers('app-paths-bootstrap.ts')
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs) {
      expect(['electron', 'path', 'node:path', 'fs', 'node:fs', './userdata-migration', './logger', './early-crash-log', './early-path-fix']).toContain(spec)
    }
  })

  it('T0485 early modules only import fs / path / child_process / ./logger', () => {
    for (const spec of importSpecifiers('logger.ts')) expect(['fs', 'node:fs', 'path', 'node:path']).toContain(spec)
    for (const spec of importSpecifiers('early-crash-log.ts')) expect(['./logger']).toContain(spec)
    for (const spec of importSpecifiers('early-path-fix.ts')) expect(['child_process', 'node:child_process', 'fs', 'node:fs']).toContain(spec)
  })

  it('main.ts no longer carries the macOS PATH fix (it runs from the bootstrap)', () => {
    const main = fs.readFileSync(path.join(ELECTRON_DIR, 'main.ts'), 'utf-8')
    expect(main).not.toMatch(/process\.env\.PATH\s*=/)
    const bootstrap = fs.readFileSync(path.join(ELECTRON_DIR, 'app-paths-bootstrap.ts'), 'utf-8')
    expect(bootstrap.indexOf("app.setPath('userData'")).toBeLessThan(bootstrap.indexOf('logger.init('))
    expect(bootstrap.indexOf('logger.init(')).toBeLessThan(bootstrap.indexOf('installEarlyCrashCapture()'))
    expect(bootstrap.indexOf('installEarlyCrashCapture()')).toBeLessThan(bootstrap.indexOf('applyGuiLaunchPathFix()'))
  })

  it('userdata-migration stays electron-free (only fs / path / pid-manager)', () => {
    for (const spec of importSpecifiers('userdata-migration.ts')) {
      expect(['fs', 'node:fs', 'path', 'node:path', './terminal-server/pid-manager']).toContain(spec)
    }
    for (const spec of importSpecifiers(path.join('terminal-server', 'pid-manager.ts'))) {
      expect(['fs', 'node:fs', 'path', 'node:path']).toContain(spec)
    }
  })

  it('main.ts no longer sets the app name or a runtime userData itself', () => {
    const main = fs.readFileSync(path.join(ELECTRON_DIR, 'main.ts'), 'utf-8')
    expect(main).not.toMatch(/app\.setName\(/)
    expect(main).not.toMatch(/app\.setPath\(\s*['"]userData['"]/)
  })
})

describe('bootstrap runtime behaviour', () => {
  const calls: string[] = []
  let appData: string
  const originalArgv = process.argv
  const originalRuntime = process.env.BAT_RUNTIME

  beforeEach(() => {
    vi.resetModules()
    calls.length = 0
    appData = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0480-bootstrap-'))
    vi.doMock('../early-path-fix', () => ({
      applyGuiLaunchPathFix: () => {
        calls.push('pathFix')
        return null
      },
    }))
    vi.doMock('electron', () => ({
      app: {
        setName: (name: string) => calls.push(`setName:${name}`),
        getPath: (name: string) => {
          calls.push(`getPath:${name}`)
          if (name === 'appData') return appData
          throw new Error(`unexpected getPath(${name})`)
        },
        setPath: (name: string, value: string) => calls.push(`setPath:${name}:${value}`),
      },
    }))
    delete process.env.BAT_RUNTIME
  })

  afterEach(async () => {
    // Undo the bootstrap's process-wide side effects (monitor + console.error mirror).
    ;(await import('../early-crash-log')).endEarlyCrashCapture()
    process.argv = originalArgv
    if (originalRuntime === undefined) delete process.env.BAT_RUNTIME
    else process.env.BAT_RUNTIME = originalRuntime
    vi.doUnmock('electron')
    vi.doUnmock('../early-path-fix')
    fs.rmSync(appData, { recursive: true, force: true })
  })

  it('default instance: setName first, then appData, then setPath(userData) to BetterAgentTerminal', async () => {
    process.argv = ['electron', '.']
    const mod = await import('../app-paths-bootstrap')
    const target = path.join(appData, 'BetterAgentTerminal')
    expect(calls).toEqual(['setName:BetterAgentTerminal', 'getPath:appData', `setPath:userData:${target}`, 'pathFix'])
    expect(mod.runtimeId).toBeUndefined()
    expect(mod.resolvedUserData).toBe(target)
    expect(mod.migrationReport.userData).toBe(target)
  })

  it('T0485: the disk log starts in the bootstrap, in <userData>/Logs, with the settings.json level', async () => {
    process.argv = ['electron', '.', '--runtime=96']
    const target = path.join(appData, 'BetterAgentTerminal-runtime-96')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'settings.json'), JSON.stringify({ logLevel: 'warn' }))
    await import('../app-paths-bootstrap')
    const { logger } = await import('../logger')
    expect(logger.getLogsDir()).toBe(path.join(target, 'Logs'))
    expect(logger.getInfo().logLevel).toBe('warn')
    // level warn filters the info-level startup line; the file opens on the first warn
    logger.warn('t0485-bootstrap-warn')
    const files = fs.readdirSync(path.join(target, 'Logs'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^debug-\d{8}-\d{6}\.log$/)
  })

  it('--runtime= wins over BAT_RUNTIME and renames the legacy runtime directory', async () => {
    process.argv = ['electron', '.', '--runtime=97']
    process.env.BAT_RUNTIME = '5'
    const legacy = path.join(appData, 'better-agent-terminal-runtime-97')
    fs.mkdirSync(legacy)
    fs.writeFileSync(path.join(legacy, 'settings.json'), '{"m":1}')
    const mod = await import('../app-paths-bootstrap')
    const target = path.join(appData, 'BetterAgentTerminal-runtime-97')
    expect(mod.runtimeId).toBe('97')
    expect(mod.resolvedUserData).toBe(target)
    expect(calls.slice(-2)).toEqual([`setPath:userData:${target}`, 'pathFix'])
    expect(fs.readFileSync(path.join(target, 'settings.json'), 'utf-8')).toBe('{"m":1}')
    expect(fs.existsSync(legacy)).toBe(false)
  })

  it('BAT_RUNTIME is used when there is no --runtime=', async () => {
    process.argv = ['electron', '.']
    process.env.BAT_RUNTIME = '5'
    const mod = await import('../app-paths-bootstrap')
    expect(mod.runtimeId).toBe('5')
    expect(mod.resolvedUserData).toBe(path.join(appData, 'BetterAgentTerminal-runtime-5'))
  })
})
