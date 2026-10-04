// @vitest-environment node
/**
 * T0433 (PLAN-036 P3 / K): `PtyManagerDeps.helperEnv` — the per-PTY helper env headless
 * injects (its capability as `BAT_REMOTE_TOKEN`).
 *
 * - spread last: neither `customEnv` nor the inherited env overrides it
 * - called once per spawned PTY, never for an idempotent re-create of a running id (that
 *   would re-issue — and so revoke — the capability the running shell holds)
 * - a throwing host still spawns the PTY, just without helper env
 * - a spawn that fails entirely reports the id through `onPtyExit` (revokes what was issued)
 * - no `helperEnv` (Electron) = env unchanged
 * - T0448 (T0445 #4): `restart` re-uses the old process's `customEnv` when `helperEnv` is set,
 *   so a restarted worker keeps its role / tower binding (old token revoked, new one issued);
 *   without `helperEnv` (Electron) restart still rebuilds the env without it
 *
 * Same fake node-pty seeding as pty-manager-exit-hook.test.ts.
 */
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

// child_process fallback spawn: real unless a test forces it to throw.
const cpSpawn = vi.hoisted(() => ({ fail: false }))
vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      if (cpSpawn.fail) throw new Error('spawn failed')
      return actual.spawn(...args)
    },
  }
})

import { logger } from '../logger'
import type { PtyManager as PtyManagerType, PtyManagerDeps } from '../pty-manager'
import type { buildHeadlessHelperEnv as BuildHeadlessHelperEnv } from '../remote/headless-entry'
import { authorizeHelperInvoke, HelperCapabilityRegistry } from '../remote/helper-capability'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
const CWD = os.tmpdir()
let PtyManager: typeof PtyManagerType
let buildHeadlessHelperEnv: typeof BuildHeadlessHelperEnv

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  // After the node-pty seed: headless-entry imports pty-manager too.
  ;({ buildHeadlessHelperEnv } = await import('../remote/headless-entry'))
})

let managers: PtyManagerType[] = []

function makeManager(extra: Partial<PtyManagerDeps> = {}): PtyManagerType {
  const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD, ...extra })
  managers.push(manager)
  return manager
}

const spawnedEnv = (call = 0): Record<string, string> => ptySpawn.mock.calls[call][2].env

const SAVED_KEYS = ['BAT_REMOTE_TOKEN', 'BAT_HELPER_DIR'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  for (const key of SAVED_KEYS) saved[key] = process.env[key]
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  for (const key of SAVED_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.restoreAllMocks()
})

describe('PtyManager helperEnv (T0433)', () => {
  it('is spread last: customEnv and inherited BAT_* cannot override it', () => {
    process.env.BAT_REMOTE_TOKEN = 'inherited-server-token'
    const helperEnv = vi.fn(() => ({ BAT_REMOTE_TOKEN: 'cap-1', BAT_HELPER_DIR: '/srv/scripts' }))
    const manager = makeManager({ helperEnv, dropInheritedEnv: key => key.startsWith('BAT_') })
    manager.create({
      id: 'p1',
      cwd: CWD,
      type: 'terminal',
      shell: '/bin/sh',
      customEnv: { BAT_REMOTE_TOKEN: 'client-supplied', BAT_TOWER_TERMINAL_ID: 'tower-1', FOO: 'bar' },
    })
    expect(helperEnv).toHaveBeenCalledTimes(1)
    expect(helperEnv).toHaveBeenCalledWith('p1', expect.objectContaining({ BAT_TOWER_TERMINAL_ID: 'tower-1' }))
    const env = spawnedEnv()
    expect(env.BAT_REMOTE_TOKEN).toBe('cap-1')
    expect(env.BAT_HELPER_DIR).toBe('/srv/scripts')
    expect(env.BAT_TERMINAL_ID).toBe('p1')
    expect(env.FOO).toBe('bar')
    expect(Object.values(env)).not.toContain('inherited-server-token')
  })

  it('is not called for an idempotent re-create of a running id', () => {
    const helperEnv = vi.fn(() => ({ BAT_REMOTE_TOKEN: 'cap' }))
    const manager = makeManager({ helperEnv })
    const opts = { id: 'p2', cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
    expect(manager.createWithResult(opts)).toEqual({ ok: true, created: true })
    expect(manager.createWithResult(opts)).toEqual({ ok: true, created: false })
    expect(helperEnv).toHaveBeenCalledTimes(1)
    expect(ptySpawn).toHaveBeenCalledTimes(1)
  })

  it('a throwing helperEnv still spawns the PTY, without helper env', () => {
    const manager = makeManager({ helperEnv: () => { throw new Error('boom') }, dropInheritedEnv: key => key.startsWith('BAT_') })
    expect(manager.create({ id: 'p3', cwd: CWD, type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const env = spawnedEnv()
    expect(env.BAT_TERMINAL_ID).toBe('p3')
    expect(env.BAT_REMOTE_TOKEN).toBeUndefined()
  })

  it('without helperEnv (Electron) the env carries no helper keys it did not have', () => {
    const manager = makeManager()
    manager.getRemoteServerInfo = () => ({ port: 9876, token: 'local-server-token' })
    manager.create({ id: 'p4', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const env = spawnedEnv()
    // Electron's own path is unchanged: getRemoteServerInfo still supplies port/token.
    expect(env.BAT_REMOTE_PORT).toBe('9876')
    expect(env.BAT_REMOTE_TOKEN).toBe('local-server-token')
    expect(env.BAT_SERVER_CERT_PATH).toBeUndefined()
    expect(env.BAT_HELPER_LOG_DIR).toBeUndefined()
  })

  describe('restart keeps the helper capability role (T0448 / T0445 #4)', () => {
    const TOWER = 'tower-1'

    /** Headless wiring: real registry + `buildHeadlessHelperEnv`, revoked on exit / kill. */
    function headlessManager(registry: HelperCapabilityRegistry): PtyManagerType {
      return makeManager({
        dropInheritedEnv: key => key.startsWith('BAT_'),
        helperEnv: (id, customEnv) => buildHeadlessHelperEnv({
          id,
          customEnv,
          capabilities: registry,
          endpoint: { port: 9877, certPath: '/data/server-cert.json', logDir: '/data/Logs' },
          helperDir: '/opt/bat/scripts',
          exists: () => true,
        }),
        onPtyExit: id => { registry.revokeTerminal(id) },
      })
    }

    const createAgentCommand = (capability: Parameters<typeof authorizeHelperInvoke>[0]) =>
      authorizeHelperInvoke(capability, 'terminal:create-agent-command', [{ id: 'new-worker' }], { isTerminalAlive: () => false })

    it('worker: still a worker bound to the same tower, cannot create-agent-command, old token revoked', () => {
      const registry = new HelperCapabilityRegistry()
      const manager = headlessManager(registry)
      const customEnv = { BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo', CT_INTERACTIVE: '0' }
      expect(manager.create({ id: 'w-1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv })).toBe(true)
      const oldToken = spawnedEnv(0).BAT_REMOTE_TOKEN
      expect(registry.verify(oldToken)?.capability).toEqual({ terminalId: 'w-1', towerId: TOWER, role: 'worker' })

      expect(manager.restart('w-1', CWD, '/bin/sh')).toBe(true)
      expect(ptySpawn).toHaveBeenCalledTimes(2)
      const env = spawnedEnv(1)
      expect(env).toMatchObject({ BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo', CT_INTERACTIVE: '0', BAT_TERMINAL_ID: 'w-1' })
      expect(env.BAT_REMOTE_TOKEN).not.toBe(oldToken)
      const capability = registry.verify(env.BAT_REMOTE_TOKEN)?.capability
      expect(capability).toEqual({ terminalId: 'w-1', towerId: TOWER, role: 'worker' })
      expect(createAgentCommand(capability!)).toEqual({ ok: false, reason: 'role-not-allowed' })
      expect(registry.verify(oldToken)).toBeNull()
      expect(registry.size).toBe(1)
    })

    it('tower: still a tower after restart, old token revoked', () => {
      const registry = new HelperCapabilityRegistry()
      const manager = headlessManager(registry)
      expect(manager.create({ id: TOWER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })).toBe(true)
      const oldToken = spawnedEnv(0).BAT_REMOTE_TOKEN
      expect(manager.restart(TOWER, CWD, '/bin/sh')).toBe(true)
      const capability = registry.verify(spawnedEnv(1).BAT_REMOTE_TOKEN)?.capability
      expect(capability).toEqual({ terminalId: TOWER, role: 'tower' })
      expect(createAgentCommand(capability!)).toEqual({ ok: true })
      expect(registry.verify(oldToken)).toBeNull()
      expect(registry.size).toBe(1)
    })

    it('without helperEnv (Electron) restart still rebuilds the env without the old customEnv', () => {
      const manager = makeManager()
      manager.create({ id: 'e-1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER, FOO: 'bar' } })
      expect(spawnedEnv(0)).toMatchObject({ BAT_TOWER_TERMINAL_ID: TOWER, FOO: 'bar' })
      const inheritedTower = process.env.BAT_TOWER_TERMINAL_ID
      expect(manager.restart('e-1', CWD, '/bin/sh')).toBe(true)
      const env = spawnedEnv(1)
      expect(env.FOO).toBeUndefined()
      expect(env.BAT_TOWER_TERMINAL_ID).toBe(inheritedTower)
      expect(env.BAT_TERMINAL_ID).toBe('e-1')
    })
  })

  // Last: a node-pty failure switches this module to the child_process fallback for good.
  it('a spawn that fails entirely reports the id through onPtyExit (revokes what was issued)', () => {
    ptySpawn.mockImplementationOnce(() => { throw new Error('node-pty down') })
    const onPtyExit = vi.fn()
    const helperEnv = vi.fn(() => ({ BAT_REMOTE_TOKEN: 'cap' }))
    const manager = makeManager({ helperEnv, onPtyExit })
    cpSpawn.fail = true
    try {
      expect(manager.create({ id: 'p5', cwd: CWD, type: 'terminal', shell: '/bin/sh' })).toBe(false)
    } finally {
      cpSpawn.fail = false
    }
    // Issued once for the attempt (shared by the fallback), revoked once nothing ran.
    expect(helperEnv).toHaveBeenCalledTimes(1)
    expect(onPtyExit).toHaveBeenCalledWith('p5')
  })
})
