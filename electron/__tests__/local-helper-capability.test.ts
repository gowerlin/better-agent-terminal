// @vitest-environment node
/**
 * PLAN-047 / T0575 (D149): Electron's local PTYs get a per-PTY capability (`batcap.`) instead of
 * the RemoteServer's full server token.
 *
 *   - `buildLocalHelperEnv`: port + issued capability; tower, or worker of `BAT_TOWER_TERMINAL_ID`;
 *     nothing when the RemoteServer is not listening; the log names terminal + role, never the token
 *   - PtyManager wired like main.ts (`helperEnv` + `onPtyExit` revoke): every spawn path, restart
 *     keeps the role (T0448), kill / exit revoke, idempotent re-create keeps the running token,
 *     Terminal Server recovery re-issues
 *   - `LOCAL_HELPER_CHANNEL_ROLES`: a tower may call `terminal:create-with-command` (raw command
 *     mode) under the create-agent-command limits; T0579: the same table as headless
 *   - a real RemoteServer with the local wiring: raw command passes, its quota applies, a worker's
 *     `pty:create` / `fs:*` / … are Forbidden (the handler never runs), the server token still works
 *   - `capabilityOrSavedTabOwnership` (the local `--close-worker` `isOwnedBy`)
 *   - main.ts source guard of the wiring
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / helper-capability must not import electron')
})

import { logger } from '../logger'
import { capabilityOrSavedTabOwnership, WorkerCloseScheduler, type CloseWorkerPtyManager } from '../close-worker'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { registerHandler } from '../remote/handler-registry'
import {
  authorizeHelperInvoke,
  buildLocalHelperEnv,
  HELPER_CHANNEL_ROLES,
  HELPER_CREATE_CHANNELS,
  HELPER_TOWER_CREATE_INTERVAL_MS,
  HelperCapabilityRegistry,
  HelperTowerSpawnQuota,
  LOCAL_HELPER_CHANNEL_ROLES,
  type HelperCapability,
} from '../remote/helper-capability'
import { RemoteServer } from '../remote/remote-server'
import type { RemoteFrame } from '../remote/protocol'

const CWD = os.tmpdir()
const TOWER = 'tower-1'

describe('buildLocalHelperEnv (T0575)', () => {
  const logs: string[] = []
  const log = (message: string) => { logs.push(message) }
  beforeEach(() => { logs.length = 0 })

  it('tower: BAT_REMOTE_PORT + a batcap. capability of the tower role', () => {
    const registry = new HelperCapabilityRegistry()
    const env = buildLocalHelperEnv({ id: 'pane-1', customEnv: {}, capabilities: registry, endpoint: { port: 9876 }, log })
    expect(Object.keys(env).sort()).toEqual(['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN'])
    expect(env.BAT_REMOTE_PORT).toBe('9876')
    expect(env.BAT_REMOTE_TOKEN.startsWith('batcap.')).toBe(true)
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'pane-1', role: 'tower' })
    expect(logs).toEqual(['[helper-cap] issued: terminal=pane-1 role=tower'])
    expect(logs.join('\n')).not.toContain(env.BAT_REMOTE_TOKEN.slice('batcap.'.length, 20))
  })

  it('customEnv.BAT_TOWER_TERMINAL_ID ⇒ worker bound to that tower', () => {
    const registry = new HelperCapabilityRegistry()
    const env = buildLocalHelperEnv({ id: 'w-1', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo' }, capabilities: registry, endpoint: { port: 1 }, log })
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'w-1', towerId: TOWER, role: 'worker' })
    expect(registry.isWorkerOf('w-1', TOWER)).toBe(true)
    expect(logs).toEqual([`[helper-cap] issued: terminal=w-1 role=worker tower=${TOWER}`])
  })

  it('an empty BAT_TOWER_TERMINAL_ID is a tower', () => {
    const registry = new HelperCapabilityRegistry()
    const env = buildLocalHelperEnv({ id: 'p', customEnv: { BAT_TOWER_TERMINAL_ID: '' }, capabilities: registry, endpoint: { port: 1 } })
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability.role).toBe('tower')
  })

  it('RemoteServer not listening ⇒ nothing issued, no env', () => {
    const registry = new HelperCapabilityRegistry()
    expect(buildLocalHelperEnv({ id: 'p', customEnv: {}, capabilities: registry, endpoint: null, log })).toEqual({})
    expect(registry.size).toBe(0)
    expect(logs[0]).toContain('not issued: terminal=p (RemoteServer not listening)')
  })

  it('an id or tower id the registry refuses ⇒ nothing issued, no env', () => {
    const registry = new HelperCapabilityRegistry()
    expect(buildLocalHelperEnv({ id: 'bad id', customEnv: {}, capabilities: registry, endpoint: { port: 1 }, log })).toEqual({})
    expect(buildLocalHelperEnv({ id: 'ok', customEnv: { BAT_TOWER_TERMINAL_ID: 'x;y' }, capabilities: registry, endpoint: { port: 1 }, log })).toEqual({})
    expect(registry.size).toBe(0)
    expect(logs).toHaveLength(2)
    for (const line of logs) expect(line).toContain('[helper-cap] not issued')
  })
})

// ── PtyManager with the main.ts wiring (fake node-pty, as pty-manager-helper-env.test.ts) ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string; env?: Record<string, string> }> = []
  send = (msg: { type: string; id?: string; env?: Record<string, string> }) => { this.sent.push(msg); return true }
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

describe('PtyManager with local capabilities (T0575)', () => {
  let dataDir: string
  let managers: PtyManagerType[] = []
  const savedToken = process.env.BAT_REMOTE_TOKEN
  const savedPort = process.env.BAT_REMOTE_PORT

  beforeEach(() => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0575-pty-'))
  })

  afterEach(() => {
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    if (savedToken === undefined) delete process.env.BAT_REMOTE_TOKEN
    else process.env.BAT_REMOTE_TOKEN = savedToken
    if (savedPort === undefined) delete process.env.BAT_REMOTE_PORT
    else process.env.BAT_REMOTE_PORT = savedPort
    vi.restoreAllMocks()
  })

  /** main.ts `createElectronPtyDeps()` (helperEnv + revoke on exit), endpoint switchable. */
  function localManager(registry: HelperCapabilityRegistry, endpoint: { current: { port: number } | null } = { current: { port: 9876 } }) {
    const revoked: string[] = []
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperDir: path.join(dataDir, 'scripts'),
      helperEnv: (id, customEnv) => buildLocalHelperEnv({ id, customEnv, capabilities: registry, endpoint: endpoint.current }),
      onPtyExit: id => { if (registry.revokeTerminal(id) > 0) revoked.push(id) },
    })
    managers.push(manager)
    return { manager, revoked }
  }

  const envOf = (call: number) => ptySpawn.mock.calls[call][2].env

  it('node-pty: the PTY env token is a batcap. capability, never an inherited server token', () => {
    process.env.BAT_REMOTE_TOKEN = 'outer-server-token-abcdefghijklmnop'
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    expect(manager.create({ id: 'tw', cwd: CWD, type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const env = envOf(0)
    expect(env.BAT_REMOTE_TOKEN.startsWith('batcap.')).toBe(true)
    expect(env.BAT_REMOTE_PORT).toBe('9876')
    expect(Object.values(env)).not.toContain('outer-server-token-abcdefghijklmnop')
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'tw', role: 'tower' })
  })

  it('Terminal Server: the pty:create env carries the capability (worker of its tower)', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    manager.create({ id: 'w', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER } })
    const create = server.sent.find(msg => msg.type === 'pty:create')!
    expect(registry.verify(create.env!.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'w', towerId: TOWER, role: 'worker' })
  })

  it('RemoteServer not listening: no BAT_REMOTE_* at all (inherited ones dropped, T0574 gap 4)', () => {
    process.env.BAT_REMOTE_PORT = '9876'
    process.env.BAT_REMOTE_TOKEN = 'outer-server-token'
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry, { current: null })
    manager.create({ id: 'nested', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    expect(envOf(0).BAT_REMOTE_PORT).toBeUndefined()
    expect(envOf(0).BAT_REMOTE_TOKEN).toBeUndefined()
    expect(registry.size).toBe(0)
  })

  it('restart keeps the worker role and tower; the old token is revoked (T0448)', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager, revoked } = localManager(registry)
    manager.create({ id: 'w', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo' } })
    const oldToken = envOf(0).BAT_REMOTE_TOKEN
    expect(manager.restart('w', CWD, '/bin/sh')).toBe(true)
    const newToken = envOf(1).BAT_REMOTE_TOKEN
    expect(newToken).not.toBe(oldToken)
    expect(registry.verify(oldToken)).toBeNull()
    expect(registry.isRecentlyRevoked(oldToken)).toBe(true)
    expect(registry.verify(newToken)?.capability).toEqual({ terminalId: 'w', towerId: TOWER, role: 'worker' })
    expect(revoked).toEqual(['w'])
    expect(registry.size).toBe(1)
  })

  it('restart keeps the tower role', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    manager.create({ id: TOWER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    manager.restart(TOWER, CWD, '/bin/sh')
    expect(registry.verify(envOf(1).BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: TOWER, role: 'tower' })
  })

  it('kill revokes the PTY capability', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager, revoked } = localManager(registry)
    manager.create({ id: 'k', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const token = envOf(0).BAT_REMOTE_TOKEN
    manager.kill('k')
    expect(registry.verify(token)).toBeNull()
    expect(registry.isRecentlyRevoked(token)).toBe(true)
    expect(revoked).toEqual(['k'])
  })

  it('the PTY exiting on its own revokes its capability', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    manager.create({ id: 'e', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const token = envOf(0).BAT_REMOTE_TOKEN
    const fake = ptySpawn.mock.results[0].value as FakePty
    const onExit = fake.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode: 0 })
    expect(registry.verify(token)).toBeNull()
  })

  it('an idempotent re-create of a running id keeps the running token valid', () => {
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    manager.create({ id: 'i', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const token = envOf(0).BAT_REMOTE_TOKEN
    manager.create({ id: 'i', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    expect(ptySpawn).toHaveBeenCalledTimes(1)
    expect(registry.verify(token)?.capability.terminalId).toBe('i')
  })

  it('Terminal Server recovery re-issues: rebuilt PTYs get new capabilities with their roles', async () => {
    const registry = new HelperCapabilityRegistry()
    const { manager } = localManager(registry)
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    manager.create({ id: 'rw', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER } })
    const before = server.sent.find(msg => msg.type === 'pty:create')!.env!.BAT_REMOTE_TOKEN
    const next = new FakeServer()
    manager.onRequestNewServer = async () => next as unknown as ChildProcess
    server.connected = false
    await (manager as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    const after = next.sent.find(msg => msg.type === 'pty:create')!.env!.BAT_REMOTE_TOKEN
    expect(after).not.toBe(before)
    expect(registry.verify(before)).toBeNull()
    expect(registry.verify(after)?.capability).toEqual({ terminalId: 'rw', towerId: TOWER, role: 'worker' })
  })
})

// ── Role tables ──

const towerCap: HelperCapability = { terminalId: TOWER, role: 'tower' }
const workerCap: HelperCapability = { terminalId: 'w-1', towerId: TOWER, role: 'worker' }
const localCtx = { isTerminalAlive: (id: string) => id === TOWER || id === 'running', isKnownAgent: (a: string) => a === 'claude-cli', channelRoles: LOCAL_HELPER_CHANNEL_ROLES }
const reason = (d: { ok: boolean; reason?: string }) => (d.ok ? 'ok' : d.reason)
const raw = (opts: Record<string, unknown>, cap = towerCap, ctx: Parameters<typeof authorizeHelperInvoke>[3] = localCtx) =>
  reason(authorizeHelperInvoke(cap, 'terminal:create-with-command', [opts], ctx))

describe('LOCAL_HELPER_CHANNEL_ROLES (T0575 / D149)', () => {
  it('T0579: is the headless table itself — raw command mode for a tower on both', () => {
    expect(LOCAL_HELPER_CHANNEL_ROLES).toBe(HELPER_CHANNEL_ROLES)
    expect(HELPER_CHANNEL_ROLES['terminal:create-with-command']).toEqual(['tower'])
    expect(HELPER_CREATE_CHANNELS).toEqual(['terminal:create-agent-command', 'terminal:create-with-command'])
  })

  it('T0579: headless (default table) allows raw command mode for a tower too', () => {
    expect(raw({ id: 'new-1', cwd: CWD, command: 'claude' }, towerCap, { isTerminalAlive: () => false })).toBe('ok')
  })

  it('tower: the bat-terminal.mjs raw command payload passes', () => {
    expect(raw({ id: 'new-1', cwd: CWD, command: 'claude "/ct-exec T0001"', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo', CT_INTERACTIVE: '0' }, workspaceId: 'ws', reportLanding: true })).toBe('ok')
    expect(raw({ id: 'new-1', cwd: CWD })).toBe('ok')
  })

  it.each([
    ['an existing id (it would type into that tab)', { id: 'running', command: 'x' }, 'terminal-exists'],
    ['its own id', { id: TOWER, command: 'x' }, 'target-not-bound'],
    ['an invalid id', { id: 'a b', command: 'x' }, 'invalid-terminal-id'],
    ['a shell', { id: 'new-1', command: 'x', shell: 'C:\\evil.exe' }, 'shell-not-allowed'],
    ['a customEnv key off the whitelist', { id: 'new-1', command: 'x', customEnv: { PATH: '/evil' } }, 'custom-env-not-allowed'],
    ['a non-string customEnv value', { id: 'new-1', command: 'x', customEnv: { CT_MODE: 1 } }, 'invalid-custom-env'],
    ['another tower as BAT_TOWER_TERMINAL_ID', { id: 'new-1', command: 'x', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-2' } }, 'tower-not-bound'],
    ['an unknown agent', { id: 'new-1', command: 'x', agent: 'evil' }, 'agent-not-allowed'],
    ['a non-string command', { id: 'new-1', command: ['rm'] }, 'invalid-payload'],
  ])('tower: %s → denied', (_what, opts, expected) => {
    expect(raw(opts as Record<string, unknown>)).toBe(expected)
  })

  it('worker: raw command mode is not its channel', () => {
    expect(raw({ id: 'new-1', command: 'x' }, workerCap)).toBe('role-not-allowed')
  })

  it('no liveness check ⇒ denied (fail closed)', () => {
    expect(raw({ id: 'new-1', command: 'x' }, towerCap, { channelRoles: LOCAL_HELPER_CHANNEL_ROLES })).toBe('terminal-liveness-unknown')
  })

  it('the other channels keep their headless rules under the local table', () => {
    const local = (cap: HelperCapability, channel: string, args: unknown[]) => reason(authorizeHelperInvoke(cap, channel, args, localCtx))
    expect(local(workerCap, 'terminal:notify', [{ targetId: TOWER, message: 'x' }])).toBe('ok')
    expect(local(workerCap, 'terminal:notify', [{ targetId: 'other', message: 'x' }])).toBe('target-not-bound')
    expect(local(towerCap, 'terminal:notify', [{ targetId: TOWER, message: 'x' }])).toBe('role-not-allowed')
    expect(local(workerCap, 'pty:write', [TOWER, 'T0575 完成'])).toBe('ok')
    expect(local(workerCap, 'pty:write', [TOWER, 'x\r'])).toBe('control-character-not-allowed')
    expect(local(towerCap, 'terminal:close-worker', [{ towerId: TOWER, workorder: 'T0001' }])).toBe('ok')
    expect(local(towerCap, 'terminal:set-role', [{ terminalId: TOWER, role: 'tower' }])).toBe('ok')
    for (const channel of ['pty:create', 'pty:kill', 'pty:get-buffer', 'fs:readdir', 'settings:save', 'claude:send-message', 'git:status']) {
      expect(local(towerCap, channel, [{ id: 'x' }])).toBe('channel-not-allowed')
      expect(local(workerCap, channel, [{ id: 'x' }])).toBe('channel-not-allowed')
    }
  })
})

// ── A real RemoteServer with the main.ts wiring ──

interface Conn { ws: WebSocket; frames: RemoteFrame[] }

describe('local RemoteServer with helper capabilities (T0575)', () => {
  const SERVER_TOKEN = 'b'.repeat(32)
  const handled: Array<{ channel: string; args: unknown[] }> = []
  const alive = new Set<string>([TOWER, 'w-1'])
  let dir: string
  let server: RemoteServer
  let registry: HelperCapabilityRegistry
  let port: number
  let now = 1_000_000
  const sockets: WebSocket[] = []

  beforeAll(async () => {
    for (const channel of ['terminal:create-with-command', 'terminal:create-agent-command', 'pty:create', 'fs:readdir', 'settings:save']) {
      registerHandler(channel, async (_ctx, ...args: unknown[]) => {
        handled.push({ channel, args })
        if (channel.startsWith('terminal:create-')) alive.add((args[0] as { id: string }).id)
        return true
      })
    }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0575-'))
    const silent = () => {}
    registry = new HelperCapabilityRegistry()
    server = new RemoteServer({
      logger: { log: silent, warn: silent, error: silent },
      helperCapabilities: registry,
      helperChannelRoles: LOCAL_HELPER_CHANNEL_ROLES,
      isTerminalAlive: id => alive.has(id),
      isKnownAgent: agent => agent === 'claude-cli',
      getPtyCapacity: () => ({ count: alive.size, max: 0 }),
      helperSpawnQuota: new HelperTowerSpawnQuota({ now: () => now }),
    })
    server.configDir = dir
    port = (await server.start(0, SERVER_TOKEN, 'localhost')).port
  })

  afterAll(() => {
    for (const ws of sockets) ws.terminate()
    server?.stop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  async function connect(token: string): Promise<{ conn: Conn; error?: string }> {
    const ws = new WebSocket(`wss://127.0.0.1:${port}`, { rejectUnauthorized: false })
    sockets.push(ws)
    const conn: Conn = { ws, frames: [] }
    ws.on('error', () => {})
    ws.on('message', data => { try { conn.frames.push(JSON.parse(data.toString())) } catch { /* ignore */ } })
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject) })
    ws.send(JSON.stringify({ type: 'auth', id: 'auth', token, args: ['t0575'] }))
    const frame = await frameOf(conn, 'auth')
    return { conn, error: frame.error }
  }

  function frameOf(conn: Conn, id: string): Promise<RemoteFrame> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${id}`)), 5_000)
      const check = () => {
        const frame = conn.frames.find(f => f.id === id)
        if (!frame) return
        clearTimeout(timer)
        conn.ws.off('message', check)
        resolve(frame)
      }
      conn.ws.on('message', check)
      check()
    })
  }

  let seq = 0
  async function invoke(conn: Conn, channel: string, ...args: unknown[]): Promise<RemoteFrame> {
    const id = `i-${seq++}`
    conn.ws.send(JSON.stringify({ type: 'invoke', id, channel, args }))
    return frameOf(conn, id)
  }

  it('tower: raw command mode creates a worker of itself (the handler runs)', async () => {
    const { conn, error } = await connect(registry.issue(TOWER))
    expect(error).toBeUndefined()
    const before = handled.length
    const result = await invoke(conn, 'terminal:create-with-command', { id: 'raw-1', cwd: CWD, command: 'claude "/ct-exec T0001"', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER }, reportLanding: true })
    expect(result).toMatchObject({ type: 'invoke-result', result: true })
    expect(handled.slice(before).map(h => h.channel)).toEqual(['terminal:create-with-command'])
  })

  it('tower: raw command mode passes the creation quota (rate limit), like create-agent-command', async () => {
    const { conn } = await connect(registry.issue(TOWER))
    now += HELPER_TOWER_CREATE_INTERVAL_MS
    expect(await invoke(conn, 'terminal:create-with-command', { id: 'raw-2', cwd: CWD, command: 'x' })).toMatchObject({ result: true })
    expect(await invoke(conn, 'terminal:create-agent-command', { id: 'raw-3', cwd: CWD, prompt: 'p' }))
      .toMatchObject({ type: 'invoke-error', error: 'Forbidden: create-rate-limited' })
    expect(await invoke(conn, 'terminal:create-with-command', { id: 'raw-4', cwd: CWD, command: 'x' }))
      .toMatchObject({ type: 'invoke-error', error: 'Forbidden: create-rate-limited' })
  })

  it('worker: pty:create / fs:* / settings:save / raw command are Forbidden, the handler never runs', async () => {
    const { conn } = await connect(registry.issue('w-1', { towerId: TOWER }))
    const before = handled.length
    expect(await invoke(conn, 'pty:create', { id: 'evil', cwd: CWD, type: 'terminal' })).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })
    expect(await invoke(conn, 'fs:readdir', CWD)).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })
    expect(await invoke(conn, 'settings:save', '{}')).toMatchObject({ type: 'invoke-error', error: 'Forbidden: channel-not-allowed' })
    expect(await invoke(conn, 'terminal:create-with-command', { id: 'evil-2', cwd: CWD, command: 'x' })).toMatchObject({ type: 'invoke-error', error: 'Forbidden: role-not-allowed' })
    expect(handled.length).toBe(before)
  })

  it('the server token still authenticates a client with every handler', async () => {
    const { conn, error } = await connect(SERVER_TOKEN)
    expect(error).toBeUndefined()
    expect(await invoke(conn, 'pty:create', { id: 'client-pty', cwd: CWD, type: 'terminal' })).toMatchObject({ type: 'invoke-result', result: true })
  })

  it('a revoked capability is refused at auth with "Capability revoked"', async () => {
    const token = registry.issue('gone')
    registry.revokeTerminal('gone')
    expect((await connect(token)).error).toBe('Capability revoked')
  })

  it('a capability of a previous BAT process (unknown here) is "Invalid token" (T0576 fixes the restart case)', async () => {
    const stale = new HelperCapabilityRegistry().issue(TOWER)
    expect((await connect(stale)).error).toBe('Invalid token')
  })
})

// ── --close-worker ownership (T0575, as headless T0536, keeping T0537) ──

describe('capabilityOrSavedTabOwnership (T0575)', () => {
  it('a Worker this process recorded must hold a worker capability of the asking tower', () => {
    const registry = new HelperCapabilityRegistry()
    registry.issue('w-1', { towerId: TOWER })
    registry.issue('w-2')
    const owned = capabilityOrSavedTabOwnership((id, tower) => registry.isWorkerOf(id, tower), () => true)
    expect(owned('w-1', TOWER)).toBe(true)
    expect(owned('w-1', 'tower-2')).toBe(false)
    expect(owned('w-2', TOWER)).toBe(false)
  })

  it('a Worker whose ownership came from its saved tab (nothing recorded, T0537) is accepted', () => {
    const owned = capabilityOrSavedTabOwnership(() => false, () => false)
    expect(owned('restored', TOWER)).toBe(true)
  })

  it('in the scheduler: no worker capability ⇒ NOT_OWNER', () => {
    const ptys: CloseWorkerPtyManager = {
      findWorkerTerminals: () => ['w-1'],
      getTowerTerminalId: () => TOWER,
      getLastOutputAt: () => null,
      getLastUserInputAt: () => null,
      isAlive: () => true,
    }
    const registry = new HelperCapabilityRegistry()
    const scheduler = new WorkerCloseScheduler({
      getPtyManager: () => ptys,
      emit: () => 1,
      logger: { log: () => {}, warn: () => {} },
      isOwnedBy: capabilityOrSavedTabOwnership((id, tower) => registry.isWorkerOf(id, tower), () => true),
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    expect(scheduler.request({ towerId: TOWER, workorder: 'T0001' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    registry.issue('w-1', { towerId: TOWER })
    expect(scheduler.request({ towerId: TOWER, workorder: 'T0001' })).toMatchObject({ ok: true, terminalId: 'w-1' })
    scheduler.dispose()
  })
})

// ── main.ts wiring (source guard) ──

describe('main.ts wiring (T0575 source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf-8')

  it('the local RemoteServer gets the capability registry, the local role table and the helper context', () => {
    const ctor = main.match(/const remoteServer = new RemoteServer\(\{([\s\S]*?)\n\}\)/)
    expect(ctor).not.toBeNull()
    for (const key of ['helperCapabilities: localHelperCapabilities', 'helperChannelRoles: LOCAL_HELPER_CHANNEL_ROLES', 'isTerminalAlive:', 'isKnownAgent:', 'getPtyCapacity:']) {
      expect(ctor![1]).toContain(key)
    }
    expect(ctor![1]).toContain('normalizeAgentAlias(agent)')
  })

  it('PTY env comes from buildLocalHelperEnv; the server token never goes into a PTY', () => {
    const deps = main.match(/function createElectronPtyDeps\(\): PtyManagerDeps \{([\s\S]*?)\n\}/)
    expect(deps).not.toBeNull()
    expect(deps![1]).toContain('helperEnv: (id, customEnv) => buildLocalHelperEnv(')
    expect(deps![1]).toContain('localHelperCapabilities.revokeTerminal(id)')
    expect(main).not.toMatch(/getRemoteServerInfo/)
    expect(deps![1]).not.toContain('currentToken')
  })

  it('--close-worker checks ownership with the capability registry', () => {
    expect(main).toMatch(/isOwnedBy: capabilityOrSavedTabOwnership\(\s*\(terminalId, towerId\) => localHelperCapabilities\.isWorkerOf\(terminalId, towerId\)/)
  })

  it('the Terminal Server is forked without inherited BAT_REMOTE_*', () => {
    const forks = main.match(/fork\(serverScript, \[\], \{[\s\S]*?env: \{\s*\.\.\.(\w+\(\)|process\.env)/g) ?? []
    expect(forks).toHaveLength(2)
    for (const fork of forks) expect(fork).toContain('...terminalServerInheritedEnv()')
  })
})
