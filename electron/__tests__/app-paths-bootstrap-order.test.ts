// @vitest-environment node
/**
 * BUG-119 / T0480: app-paths-bootstrap must run before any other module of the
 * main process (static checks), and must set the app name before it touches any
 * path, then pin userData explicitly (runtime checks with a mocked electron).
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

  it('app-paths-bootstrap imports no other electron/ module than userdata-migration', () => {
    const specs = importSpecifiers('app-paths-bootstrap.ts')
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs) expect(['electron', 'path', 'node:path', 'fs', 'node:fs', './userdata-migration']).toContain(spec)
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

  afterEach(() => {
    process.argv = originalArgv
    if (originalRuntime === undefined) delete process.env.BAT_RUNTIME
    else process.env.BAT_RUNTIME = originalRuntime
    vi.doUnmock('electron')
    fs.rmSync(appData, { recursive: true, force: true })
  })

  it('default instance: setName first, then appData, then setPath(userData) to BetterAgentTerminal', async () => {
    process.argv = ['electron', '.']
    const mod = await import('../app-paths-bootstrap')
    const target = path.join(appData, 'BetterAgentTerminal')
    expect(calls).toEqual(['setName:BetterAgentTerminal', 'getPath:appData', `setPath:userData:${target}`])
    expect(mod.runtimeId).toBeUndefined()
    expect(mod.resolvedUserData).toBe(target)
    expect(mod.migrationReport.userData).toBe(target)
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
    expect(calls.at(-1)).toBe(`setPath:userData:${target}`)
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
