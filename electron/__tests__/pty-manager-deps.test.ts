// @vitest-environment node
/**
 * T0389 (PLAN-036 P0-B): PtyManager host DI.
 *
 * - PtyManager no longer imports `electron`; the mock below throws if any
 *   module in its import graph tries to.
 * - `emit` receives the PTY events the Electron build used to send to windows.
 * - `helperDir` decides `BAT_HELPER_DIR`; empty / undefined (headless) = not injected.
 * - `createWindowBroadcastEmit` keeps the pre-DI window + broadcastHub fan-out.
 */
import * as fs from 'fs'
import * as path from 'path'
import { build, type Plugin } from 'esbuild'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager, createWindowBroadcastEmit, type PtyManagerDeps, type PtyEventWindow } from '../pty-manager'
import { broadcastHub } from '../remote/broadcast-hub'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const HELPER_ENV = 'BAT_HELPER_DIR'

interface ShellProbe {
  shell: string
  /**
   * Prints `M:set:<value>:E` or `M:::E` then exits. The marker is spelled
   * differently in the command itself (cmd `^:` escapes, printf `%s`), so the
   * terminal echo of the typed input never matches.
   */
  command: string
}

function shellProbe(): ShellProbe | null {
  if (process.platform === 'win32') {
    return {
      shell: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
      command: `if defined ${HELPER_ENV} (echo M^:set^:%${HELPER_ENV}%^:E) else (echo M^:^:^:E)\r\nexit\r\n`,
    }
  }
  if (!fs.existsSync('/bin/bash')) return null
  return {
    shell: '/bin/bash',
    command: `printf 'M:%s:%s:E\\n' "\${${HELPER_ENV}+set}" "\$${HELPER_ENV}"; exit\n`,
  }
}

/** Observed BAT_HELPER_DIR ('' = unset), or null while the answer has not arrived. */
function parseProbe(output: string): string | null {
  // ConPTY / readline interleave VT sequences with the text; drop them first.
  // eslint-disable-next-line no-control-regex
  const plain = output.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
  const m = plain.match(/M:(set)?:(.*?):E/)
  if (!m) return null
  return m[1] ? m[2] : ''
}

async function runHelperDirProbe(helperDir: string | undefined) {
  const probe = shellProbe()
  if (!probe) throw new Error('no shell available for the PTY probe')
  const emit = vi.fn<PtyManagerDeps['emit']>()
  const manager = new PtyManager({ emit, dataDir: PROJECT_ROOT, helperDir })
  const id = `t0389-${helperDir ? 'with' : 'without'}-helper-${process.pid}`
  try {
    expect(manager.create({ id, cwd: PROJECT_ROOT, type: 'terminal', shell: probe.shell })).toBe(true)
    manager.write(id, probe.command)

    const outputOf = () => emit.mock.calls
      .filter(([channel, termId]) => channel === 'pty:output' && termId === id)
      .map(([, , data]) => String(data))
      .join('')
    const exited = () => emit.mock.calls.some(([channel, termId]) => channel === 'pty:exit' && termId === id)

    await vi.waitFor(() => {
      expect(parseProbe(outputOf())).not.toBeNull()
      expect(exited()).toBe(true)
    }, { timeout: 15_000, interval: 50 })
    return parseProbe(outputOf())
  } finally {
    manager.kill(id)
    manager.dispose()
  }
}

describe('PtyManager deps (T0389)', () => {
  const inherited = process.env[HELPER_ENV]

  afterEach(() => {
    if (inherited === undefined) delete process.env[HELPER_ENV]
    else process.env[HELPER_ENV] = inherited
  })

  it('does not inject BAT_HELPER_DIR when the host has no helper dir, and emits PTY events', { timeout: 20_000 }, async () => {
    // A BAT-hosted test runner inherits BAT_HELPER_DIR itself; clear it so only injection can set it.
    delete process.env[HELPER_ENV]
    expect(await runHelperDirProbe(undefined)).toBe('')
  })

  it('injects BAT_HELPER_DIR from deps.helperDir', { timeout: 20_000 }, async () => {
    delete process.env[HELPER_ENV]
    const helperDir = path.join(PROJECT_ROOT, 'scripts')
    expect(await runHelperDirProbe(helperDir)).toBe(helperDir)
  })
})

describe('createWindowBroadcastEmit (Electron emit)', () => {
  it('sends to live windows, skips destroyed ones, tolerates disposed frames, then mirrors to broadcastHub', () => {
    const hub = vi.spyOn(broadcastHub, 'broadcast')
    const live = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    const destroyed = { isDestroyed: () => true, webContents: { send: vi.fn() } }
    const disposed = {
      isDestroyed: () => false,
      webContents: { send: vi.fn(() => { throw new Error('Render frame was disposed') }) },
    }
    const windows: PtyEventWindow[] = [live, destroyed, disposed]

    const emit = createWindowBroadcastEmit(() => windows)
    emit('pty:exit', 'term-1', 0)

    expect(live.webContents.send).toHaveBeenCalledWith('pty:exit', 'term-1', 0)
    expect(destroyed.webContents.send).not.toHaveBeenCalled()
    expect(disposed.webContents.send).toHaveBeenCalledTimes(1)
    expect(hub).toHaveBeenCalledWith('pty:exit', 'term-1', 0)
    hub.mockRestore()
  })
})

describe('electron-free import graph', () => {
  // Bundle-level check: inside the repo `import 'electron'` does not throw at
  // import time, so only a resolve-time scan proves the modules are headless-safe.
  it.each([
    ['electron/pty-manager.ts'],
    ['electron/claude-runtime-router.ts'],
  ])('%s never resolves electron', { timeout: 30_000 }, async (entry) => {
    const electronImporters: string[] = []
    const scan: Plugin = {
      name: 't0389-electron-scan',
      setup(b) {
        b.onResolve({ filter: /^electron(\/.*)?$/ }, args => {
          electronImporters.push(path.relative(PROJECT_ROOT, args.importer))
          return { path: args.path, external: true }
        })
        // Third-party packages are not under test; keep native addons out of the bundle.
        b.onResolve({ filter: /^[^./]/ }, args => (
          args.kind === 'entry-point' || path.isAbsolute(args.path) ? undefined : { path: args.path, external: true }
        ))
      },
    }
    await build({
      absWorkingDir: PROJECT_ROOT,
      entryPoints: [path.join(PROJECT_ROOT, entry)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      plugins: [scan],
    })
    expect(electronImporters).toEqual([])
  })
})
