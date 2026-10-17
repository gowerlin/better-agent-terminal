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
 * - no `helperEnv` = no `BAT_REMOTE_*`, inherited ones dropped (T0575, T0574 gap 4: a BAT inside a
 *   BAT tab must not hand the outer token on); Electron's `helperEnv` since T0575 is
 *   `buildLocalHelperEnv` (see local-helper-capability.test.ts)
 * - T0481 (BUG-119): a host with `helperDir` (Electron) also gets `BAT_USER_DATA` = `dataDir` on
 *   all three env builders (Terminal Server, node-pty, child_process), overriding an inherited /
 *   client-supplied value; without `helperDir` (headless) it is not injected
 * - T0448 (T0445 #4): `restart` re-uses the old process's `customEnv` when `helperEnv` is set,
 *   so a restarted worker keeps its role / tower binding (old token revoked, new one issued)
 * - T0525 (BUG-131): Electron's `restart` keeps `customEnv` too, and the Terminal Server
 *   recovery rebuild (T0112) sends the full env; both use the helper values current at rebuild
 *   time (a changed server token / port is the new one)
 *
 * Same fake node-pty seeding as pty-manager-exit-hook.test.ts.
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

// child_process fallback spawn: real unless a test forces it to throw, or (T0481) to return a
// fake child whose spawn env is recorded.
const cpSpawn = vi.hoisted(() => ({ fail: false, fake: false, envs: [] as Record<string, string>[] }))
vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>()
  const { EventEmitter: Emitter } = await import('events')
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      if (cpSpawn.fail) throw new Error('spawn failed')
      if (cpSpawn.fake) {
        cpSpawn.envs.push((args[2] as { env: Record<string, string> }).env)
        return Object.assign(new Emitter(), { stdout: new Emitter(), stderr: new Emitter(), kill: () => true })
      }
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

/** T0481: Terminal Server IPC stand-in (as in pty-manager-locale-env.test.ts). */
class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string; env?: Record<string, string> }> = []
  send = (msg: { type: string; id?: string; env?: Record<string, string> }) => { this.sent.push(msg); return true }
}

/** T0481: Electron host deps — `helperDir` + `dataDir` = userData. */
const USER_DATA = path.join(CWD, 'BetterAgentTerminal-runtime-7')
const HELPER_DIR = path.join(CWD, 'bat-scripts')

const SAVED_KEYS = ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_HELPER_DIR', 'BAT_USER_DATA'] as const
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

  it('without helperEnv the env carries no BAT_REMOTE_*, inherited ones dropped (T0575 gap 4)', () => {
    process.env.BAT_REMOTE_PORT = '9876'
    process.env.BAT_REMOTE_TOKEN = 'outer-bat-server-token'
    const manager = makeManager()
    manager.create({ id: 'p4', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const env = spawnedEnv()
    expect(env.BAT_REMOTE_PORT).toBeUndefined()
    expect(env.BAT_REMOTE_TOKEN).toBeUndefined()
    expect(Object.values(env)).not.toContain('outer-bat-server-token')
    expect(env.BAT_SERVER_CERT_PATH).toBeUndefined()
    expect(env.BAT_HELPER_LOG_DIR).toBeUndefined()
  })

  it('T0575 gap 4: an inherited BAT_REMOTE_* is dropped on the Terminal Server path too; customEnv wins', () => {
    process.env.BAT_REMOTE_PORT = '9876'
    process.env.BAT_REMOTE_TOKEN = 'outer-bat-server-token'
    const manager = makeManager()
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    manager.create({ id: 'p4s', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    manager.create({ id: 'p4c', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_REMOTE_PORT: '1234' } })
    const [plain, custom] = server.sent.filter(msg => msg.type === 'pty:create')
    expect(plain.env?.BAT_REMOTE_PORT).toBeUndefined()
    expect(plain.env?.BAT_REMOTE_TOKEN).toBeUndefined()
    // An explicit workspace / caller value is the user's own choice, not inherited
    expect(custom.env?.BAT_REMOTE_PORT).toBe('1234')
    expect(custom.env?.BAT_REMOTE_TOKEN).toBeUndefined()
  })

  describe('BAT_USER_DATA for the local helpers (T0481 / BUG-119)', () => {
    it('node-pty: helperDir host gets BAT_USER_DATA = dataDir, over inherited and customEnv values', () => {
      process.env.BAT_USER_DATA = path.join(CWD, 'parent-bat-userdata')
      const manager = makeManager({ dataDir: USER_DATA, helperDir: HELPER_DIR, helperEnv: () => ({ BAT_REMOTE_PORT: '9876', BAT_REMOTE_TOKEN: 'batcap.local' }) })
      manager.create({ id: 'u1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_USER_DATA: '/client/value' } })
      const env = spawnedEnv()
      expect(env.BAT_USER_DATA).toBe(USER_DATA)
      expect(env.BAT_HELPER_DIR).toBe(HELPER_DIR)
      // The explicit helper overrides stay headless-only: the helpers derive both paths from userData.
      expect(env.BAT_SERVER_CERT_PATH).toBeUndefined()
      expect(env.BAT_HELPER_LOG_DIR).toBeUndefined()
      // No new grant: the only credential is the PTY's own capability (T0575).
      expect(env.BAT_REMOTE_TOKEN).toBe('batcap.local')
    })

    it('Terminal Server: the pty:create env carries BAT_USER_DATA = dataDir', () => {
      const manager = makeManager({ dataDir: USER_DATA, helperDir: HELPER_DIR })
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      expect(manager.create({ id: 'u2', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_USER_DATA: '/client/value' } })).toBe(true)
      const create = server.sent.find(msg => msg.type === 'pty:create')
      expect(create?.env?.BAT_USER_DATA).toBe(USER_DATA)
      expect(create?.env?.BAT_HELPER_DIR).toBe(HELPER_DIR)
      expect(ptySpawn).not.toHaveBeenCalled()
    })

    it('without helperDir (headless) BAT_USER_DATA is not injected; helperEnv paths are untouched', () => {
      const manager = makeManager({
        dataDir: USER_DATA,
        dropInheritedEnv: key => key.startsWith('BAT_'),
        helperEnv: () => ({ BAT_SERVER_CERT_PATH: '/data/server-cert.json', BAT_HELPER_LOG_DIR: '/data/Logs' }),
      })
      process.env.BAT_USER_DATA = path.join(CWD, 'parent-bat-userdata')
      manager.create({ id: 'u3', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
      const env = spawnedEnv()
      expect(env.BAT_USER_DATA).toBeUndefined()
      expect(env.BAT_SERVER_CERT_PATH).toBe('/data/server-cert.json')
      expect(env.BAT_HELPER_LOG_DIR).toBe('/data/Logs')
    })
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

  })

  describe('rebuilds keep the full env (T0525 / BUG-131)', () => {
    const WORKER_ENV = { BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo', CT_INTERACTIVE: '0', FOO: 'bar' }
    let dataDir: string

    beforeEach(() => {
      // handleServerDeath clears the PTY registry in dataDir: never let it touch a shared dir
      dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0525-pty-'))
    })

    afterEach(() => {
      fs.rmSync(dataDir, { recursive: true, force: true })
    })

    /** Electron host: helperDir + userData + a helper env (port / token) that can change. */
    function electronManager(remote: { port: number; token: string }): PtyManagerType {
      return makeManager({ dataDir, helperDir: HELPER_DIR, helperEnv: () => ({ BAT_REMOTE_PORT: String(remote.port), BAT_REMOTE_TOKEN: remote.token }) })
    }

    const ptyCreates = (server: FakeServer) => server.sent.filter(msg => msg.type === 'pty:create')

    it('node-pty (Electron): restart keeps customEnv + workspace; env equals the first one', () => {
      const manager = electronManager({ port: 9876, token: 'token-1' })
      manager.create({ id: 'r-1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      expect(manager.restart('r-1', CWD, '/bin/sh')).toBe(true)
      expect(spawnedEnv(1)).toMatchObject({ ...WORKER_ENV, BAT_WORKSPACE_ID: 'workspace-b', BAT_TERMINAL_ID: 'r-1' })
      expect(spawnedEnv(1)).toEqual(spawnedEnv(0))
    })

    it('node-pty (Electron): restart uses the current server token / port, not the old ones', () => {
      const remote = { port: 9876, token: 'token-1' }
      const manager = electronManager(remote)
      manager.create({ id: 'r-2', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      remote.port = 9877
      remote.token = 'token-2'
      expect(manager.restart('r-2', CWD, '/bin/sh')).toBe(true)
      const env = spawnedEnv(1)
      expect(env).toMatchObject({ BAT_REMOTE_PORT: '9877', BAT_REMOTE_TOKEN: 'token-2', BAT_HELPER_DIR: HELPER_DIR, BAT_USER_DATA: dataDir })
      expect(Object.values(env)).not.toContain('token-1')
      expect(env).toMatchObject(WORKER_ENV)
    })

    it('Terminal Server: restart re-sends pty:create with customEnv + workspace + current token', () => {
      const remote = { port: 9876, token: 'token-1' }
      const manager = electronManager(remote)
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      manager.create({ id: 'r-3', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      remote.token = 'token-2'
      expect(manager.restart('r-3', CWD, '/bin/sh')).toBe(true)
      const [first, second] = ptyCreates(server)
      expect(second.env).toMatchObject({ ...WORKER_ENV, BAT_WORKSPACE_ID: 'workspace-b', BAT_REMOTE_TOKEN: 'token-2' })
      expect({ ...second.env, BAT_REMOTE_TOKEN: 'token-1' }).toEqual(first.env)
    })

    it('Terminal Server reconnect (T0108): the idempotent re-create supplies customEnv / preset for a later restart', () => {
      const manager = electronManager({ port: 9876, token: 'token-1' })
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      ;(manager as unknown as { handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void })
        .handleReplayList([{ id: 'r-4', pid: 1, cwd: CWD }])
      const opts = { id: 'r-4', cwd: CWD, type: 'terminal' as const, shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b', agentPreset: 'claude-cli' }
      // The running PTY is left alone (T0108 / T0111): nothing is sent
      expect(manager.create(opts)).toBe(true)
      expect(ptyCreates(server)).toEqual([])
      expect(manager.restart('r-4', CWD, '/bin/sh')).toBe(true)
      const fresh = electronManager({ port: 9876, token: 'token-1' })
      const freshServer = new FakeServer()
      fresh.setServerProcess(freshServer as unknown as ChildProcess)
      fresh.create(opts)
      expect(ptyCreates(server)[0].env).toEqual(ptyCreates(freshServer)[0].env)
    })

    /** Kill the fake Terminal Server; `onRequestNewServer` hands out `next`. Resolves after the rebuild. */
    async function recover(manager: PtyManagerType, dead: FakeServer, next: FakeServer): Promise<void> {
      manager.onRequestNewServer = async () => next as unknown as ChildProcess
      dead.connected = false
      await (manager as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    }

    it('recovery (T0112): every rebuilt pty:create carries the full env a first create builds', async () => {
      const manager = electronManager({ port: 9876, token: 'token-1' })
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      manager.create({ id: 'v-1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      manager.create({ id: 'v-2', cwd: CWD, type: 'terminal', shell: '/bin/sh', workspaceId: 'workspace-c', agentPreset: 'claude-cli' })
      const firstEnvs = Object.fromEntries(ptyCreates(server).map(msg => [msg.id, msg.env]))

      const next = new FakeServer()
      await recover(manager, server, next)
      const rebuilt = ptyCreates(next)
      expect(rebuilt).toHaveLength(2)
      for (const msg of rebuilt) {
        const id = msg.id!
        expect(msg.env).toEqual(firstEnvs[id])
      }
      const v1 = rebuilt.find(msg => msg.id === 'v-1')!.env!
      expect(v1).toMatchObject({
        ...WORKER_ENV, BAT_SESSION: '1', BAT_TERMINAL_ID: 'v-1', BAT_WORKSPACE_ID: 'workspace-b',
        BAT_HELPER_DIR: HELPER_DIR, BAT_USER_DATA: dataDir, BAT_REMOTE_PORT: '9876', BAT_REMOTE_TOKEN: 'token-1',
        DISABLE_AUTOUPDATER: '1',
      })
      // claude-cli preset: the rebuild applies the same update guard the first create did
      const v2 = rebuilt.find(msg => msg.id === 'v-2')!.env!
      // (no runtime-router data dir here → default `embedded` mode → DISABLE_UPDATES=1)
      expect(firstEnvs['v-2']!.DISABLE_UPDATES).toBe('1')
      expect(v2.DISABLE_UPDATES).toBe('1')
      expect(v1.DISABLE_UPDATES).toBeUndefined()
      expect(v2.BAT_WORKSPACE_ID).toBe('workspace-c')
    })

    it('recovery (T0112): uses the server token current at rebuild time', async () => {
      const remote = { port: 9876, token: 'token-1' }
      const manager = electronManager(remote)
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      manager.create({ id: 'v-3', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      remote.port = 9877
      remote.token = 'token-2'
      const next = new FakeServer()
      await recover(manager, server, next)
      const env = ptyCreates(next)[0].env!
      expect(env).toMatchObject({ ...WORKER_ENV, BAT_REMOTE_PORT: '9877', BAT_REMOTE_TOKEN: 'token-2' })
      expect(Object.values(env)).not.toContain('token-1')
    })

    it('recovery (T0112): a PTY re-registered from the server list (T0108) rebuilds with what the renderer re-sent', async () => {
      const manager = electronManager({ port: 9876, token: 'token-1' })
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      ;(manager as unknown as { handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void })
        .handleReplayList([{ id: 'v-4', pid: 1, cwd: CWD }])
      manager.create({ id: 'v-4', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: WORKER_ENV, workspaceId: 'workspace-b' })
      const next = new FakeServer()
      await recover(manager, server, next)
      expect(ptyCreates(next)[0].env).toMatchObject({ ...WORKER_ENV, BAT_TERMINAL_ID: 'v-4', BAT_WORKSPACE_ID: 'workspace-b', BAT_REMOTE_TOKEN: 'token-1' })
    })
  })

  describe('restart keeps BAT_WORKSPACE_ID (T0523 / BUG-129)', () => {
    it('node-pty (Electron): the restarted PTY has the same workspace (was empty before T0523)', () => {
      const manager = makeManager()
      manager.create({ id: 'ws-1', cwd: CWD, type: 'terminal', shell: '/bin/sh', workspaceId: 'workspace-b' })
      expect(spawnedEnv(0).BAT_WORKSPACE_ID).toBe('workspace-b')
      expect(manager.restart('ws-1', CWD, '/bin/sh')).toBe(true)
      expect(spawnedEnv(1).BAT_WORKSPACE_ID).toBe('workspace-b')
    })

    it('Terminal Server: restart re-sends pty:create with the same workspace', () => {
      const manager = makeManager()
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      manager.create({ id: 'ws-2', cwd: CWD, type: 'terminal', shell: '/bin/sh', workspaceId: 'workspace-b' })
      expect(manager.restart('ws-2', CWD, '/bin/sh')).toBe(true)
      const creates = server.sent.filter(msg => msg.type === 'pty:create')
      expect(creates.map(msg => msg.env?.BAT_WORKSPACE_ID)).toEqual(['workspace-b', 'workspace-b'])
    })

    it('Terminal Server reconnect (T0108): the renderer\'s idempotent re-create supplies the workspace for a later restart', () => {
      const manager = makeManager()
      const server = new FakeServer()
      manager.setServerProcess(server as unknown as ChildProcess)
      ;(manager as unknown as { handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void })
        .handleReplayList([{ id: 'ws-3', pid: 1, cwd: CWD }])
      // initTerminals re-sends pty:create for the surviving PTY: skipped, but the workspace is kept
      expect(manager.create({ id: 'ws-3', cwd: CWD, type: 'terminal', shell: '/bin/sh', workspaceId: 'workspace-b' })).toBe(true)
      expect(server.sent.filter(msg => msg.type === 'pty:create')).toEqual([])
      expect(manager.restart('ws-3', CWD, '/bin/sh')).toBe(true)
      expect(server.sent.find(msg => msg.type === 'pty:create')?.env?.BAT_WORKSPACE_ID).toBe('workspace-b')
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

  // After the test above: node-pty is off for this module, so create() takes the child_process path.
  it('T0481: the child_process fallback carries BAT_USER_DATA = dataDir too', () => {
    const manager = makeManager({ dataDir: USER_DATA, helperDir: HELPER_DIR })
    cpSpawn.fake = true
    cpSpawn.envs.length = 0
    try {
      expect(manager.create({ id: 'u4', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_USER_DATA: '/client/value' } })).toBe(true)
    } finally {
      cpSpawn.fake = false
    }
    expect(ptySpawn).not.toHaveBeenCalled()
    expect(cpSpawn.envs).toHaveLength(1)
    expect(cpSpawn.envs[0].BAT_USER_DATA).toBe(USER_DATA)
    expect(cpSpawn.envs[0].BAT_HELPER_DIR).toBe(HELPER_DIR)
  })
})
