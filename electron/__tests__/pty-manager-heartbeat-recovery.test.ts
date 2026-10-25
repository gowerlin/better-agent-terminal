// @vitest-environment node
/**
 * T0704 (BUG-171): the Terminal Server watchdog.
 *
 * A — heartbeat: the time since the last pong is monotonic (an NTP correction of the wall clock
 * made one 10 s gap 13032 ms and recovered a live server); a pong counts as missed only on
 * `HEARTBEAT_MAX_MISSES` (3) late ticks in a row, and even then a server whose process and IPC
 * are both alive is only logged. The IPC `exit` still recovers at once.
 *
 * B — recovery: the old server is cut off (listeners detached, IPC disconnected, its messages
 * dropped by generation) and ended with its process tree before the re-fork; the registry's PTY
 * trees are killed tree-first (T0540 order), the registry cleared, all before the re-fork.
 *
 * The Terminal Server is a fake fork IPC channel (EventEmitter + send spy), as in
 * pty-manager-server-exit.test.ts. Process calls go through `serverWatchdog` mocks: nothing here
 * signals a real process. Fake timers only fake the timer functions and Date (CLAUDE.md
 * "Frontend unit tests": recovery is awaited through its `recovered` broadcast, not vi.waitFor).
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import {
  PtyManager,
  defaultServerWatchdogDeps,
  killOrphanPtyProcesses,
  type PtyManagerDeps,
  type ServerDeathReason,
  type ServerWatchdogDeps,
} from '../pty-manager'
import { logger } from '../logger'
import { readRegistry, writeRegistry } from '../terminal-server/pty-registry'
import type { KillTreeResult } from '../terminal-server/process-tree'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const ID = 'tab-1'
const CWD = os.tmpdir()
const INTERVAL = 10_000

class FakeServer extends EventEmitter {
  connected = true
  exitCode: number | null = null
  signalCode: string | null = null
  autoPong = true
  sent: ServerRequest[] = []
  disconnect = vi.fn(() => { this.connected = false })
  constructor(readonly pid: number) { super() }
  send = (msg: ServerRequest) => {
    this.sent.push(msg)
    if (msg.type === 'server:ping' && this.autoPong) this.reply({ type: 'server:pong' })
    return true
  }
  reply(msg: ServerResponse) { this.emit('message', msg) }
  creates() { return this.sent.filter(m => m.type === 'pty:create') }
}

/** A server whose listeners cannot be removed — only the generation guard stands between it and the manager. */
class StickyServer extends FakeServer {
  override removeListener(): this { return this }
}

let dataDir: string
let mono: number
let alive: Set<number>
let calls: string[]
let killTreeResult: (pid: number) => KillTreeResult
let watchdog: ServerWatchdogDeps
let emit: Mock<PtyManagerDeps['emit']>
let manager: PtyManager
let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>
let log: ReturnType<typeof vi.spyOn>
let refork: Mock<() => Promise<ChildProcess | null>>
let next: FakeServer

function statuses(): unknown[] {
  return emit.mock.calls.filter(([channel]) => channel === 'terminal-server:status').map(([, s]) => s)
}
function exitEvents() {
  return emit.mock.calls.filter(([channel]) => channel === 'pty:exit')
}
function logged(spy: ReturnType<typeof vi.spyOn>, text: string): boolean {
  return spy.mock.calls.some((args: unknown[]) => args.some(a => typeof a === 'string' && a.includes(text)))
}

/** Advance the fake timers and the fake monotonic clock together, 1 s at a time. */
function advance(ms: number): void {
  for (let left = ms; left > 0; left -= 1000) {
    const step = Math.min(1000, left)
    mono += step
    vi.advanceTimersByTime(step)
  }
}

/** Resolves on the next `terminal-server:status` `recovered` / `failed`. */
function recoveryDone(): Promise<unknown> {
  return new Promise(resolve => {
    const impl = emit.getMockImplementation()
    emit.mockImplementation((channel, ...args) => {
      impl?.(channel, ...args)
      if (channel === 'terminal-server:status' && (args[0] === 'recovered' || args[0] === 'failed')) resolve(args[0])
    })
  })
}

function handleServerDeath(m: PtyManager, reason?: ServerDeathReason): Promise<void> {
  return (m as unknown as { handleServerDeath(r?: ServerDeathReason): Promise<void> }).handleServerDeath(reason)
}

function connect(server: FakeServer): void {
  manager.setServerProcess(server as unknown as ChildProcess)
  alive.add(server.pid)
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0704-pty-'))
  mono = 1_000_000
  alive = new Set()
  calls = []
  killTreeResult = () => 'killed'
  watchdog = {
    now: () => mono,
    isProcessAlive: (pid) => alive.has(pid),
    killTree: vi.fn(async (pid: number) => {
      calls.push(`tree ${pid}`)
      const result = killTreeResult(pid)
      if (result === 'killed') alive.delete(pid)
      return result
    }),
    kill: vi.fn((pid: number, signal: NodeJS.Signals) => {
      calls.push(`${signal} ${pid}`)
      if (!alive.has(pid)) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' })
      alive.delete(pid)
    }),
    platform: 'win32',
  }
  log = vi.spyOn(logger, 'log').mockImplementation(() => {})
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  error = vi.spyOn(logger, 'error').mockImplementation(() => {})
  emit = vi.fn<PtyManagerDeps['emit']>()
  manager = new PtyManager({ emit, dataDir, serverWatchdog: watchdog })
  next = new FakeServer(9000)
  refork = vi.fn(async () => {
    calls.push('refork')
    alive.add(next.pid)
    return next as unknown as ChildProcess
  })
  manager.onRequestNewServer = refork
})

afterEach(() => {
  manager.beginShutdown()
  manager.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('A: heartbeat (T0704)', () => {
  let server: FakeServer

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
    server = new FakeServer(4000)
    connect(server)
  })

  it.each([5_000, 15_000, 25_000])('the wall clock jumping forward %i ms does not recover a server that answers', (jump) => {
    advance(INTERVAL)
    vi.setSystemTime(Date.now() + jump) // NTP correction: the wall clock moves, the monotonic one does not
    advance(6 * INTERVAL)
    expect(refork).not.toHaveBeenCalled()
    expect(statuses()).toEqual([])
    expect(server.sent.filter(m => m.type === 'server:ping').length).toBe(7)
  })

  it('the default clock is monotonic, not Date.now', () => {
    const before = defaultServerWatchdogDeps.now()
    vi.setSystemTime(Date.now() + 20_000)
    expect(defaultServerWatchdogDeps.now() - before).toBeLessThan(1_000)
  })

  it('a late pong is not a death: misses below the threshold reset when a pong arrives', () => {
    alive.delete(server.pid) // even a server reported gone is not recovered before 3 late ticks
    server.autoPong = false
    advance(3 * INTERVAL) // ticks at 10 s (on time), 20 s and 30 s (2 late)
    expect(refork).not.toHaveBeenCalled()
    server.reply({ type: 'server:pong' })
    expect(logged(log, '[heartbeat] late pong arrived after 2 late tick(s)')).toBe(true)
    advance(2 * INTERVAL) // 1 late tick again, counted from 0
    expect(refork).not.toHaveBeenCalled()
    expect(statuses()).toEqual([])
  })

  it('3 late ticks in a row with the server process gone → recovery (not at 2)', async () => {
    alive.delete(server.pid) // the process is gone but no IPC exit arrived
    server.autoPong = false
    advance(3 * INTERVAL)
    expect(statuses()).toEqual([])
    const done = recoveryDone()
    advance(INTERVAL) // 40 s: third late tick
    expect(statuses()).toEqual(['recovering'])
    await expect(done).resolves.toBe('recovered')
    expect(refork).toHaveBeenCalledTimes(1)
    expect(logged(error, 'server process=gone ipc=connected — server dead')).toBe(true)
    expect(logged(error, 'attempting recovery... (reason=heartbeat)')).toBe(true)
  })

  it('3 late ticks with the IPC closed (process still there) → recovery, and that process is ended', async () => {
    server.autoPong = false
    advance(3 * INTERVAL)
    server.connected = false
    const done = recoveryDone()
    advance(INTERVAL)
    await expect(done).resolves.toBe('recovered')
    expect(calls).toEqual(['tree 4000', 'refork'])
    expect(alive.has(server.pid)).toBe(false)
  })

  it('server process and IPC both alive: never recovered, only `late pong` logged', () => {
    server.autoPong = false
    advance(12 * INTERVAL) // two minutes without a pong
    expect(refork).not.toHaveBeenCalled()
    expect(statuses()).toEqual([])
    const lates = warn.mock.calls.filter((args: unknown[]) => String(args[0]).startsWith('[heartbeat] late pong:'))
    expect(lates.length).toBeGreaterThanOrEqual(3) // at the threshold, then every 3 ticks
    expect(String(lates[0][0])).toContain('server process and IPC alive — no recovery')
    server.reply({ type: 'server:pong' })
    advance(INTERVAL)
    expect(refork).not.toHaveBeenCalled()
  })

  it('the IPC exit recovers at once, without waiting for a heartbeat tick', async () => {
    const done = recoveryDone()
    alive.delete(server.pid)
    server.exitCode = 1
    server.emit('exit', 1, null)
    expect(statuses()).toEqual(['recovering']) // synchronous, no timer advanced
    await expect(done).resolves.toBe('recovered')
    expect(logged(error, '(reason=ipc-exit)')).toBe(true)
    expect(calls).toEqual(['refork']) // the exited server is not killed again
  })
})

describe('B: recovery cuts off and ends the old server (T0704)', () => {
  let old: FakeServer

  function startTab(server: FakeServer, id = ID): void {
    expect(manager.create({ id, cwd: CWD, type: 'terminal', shell: 'test-shell' })).toBe(true)
    server.reply({ type: 'pty:created', id, pid: 100 })
  }

  it('after recovery the old server’s pty:exit / pty:data do not touch the rebuilt PTY with the same id', async () => {
    old = new FakeServer(4000)
    connect(old)
    startTab(old)
    await handleServerDeath(manager, 'heartbeat')

    expect(old.disconnect).toHaveBeenCalledTimes(1)
    expect(old.listenerCount('message')).toBe(0)
    expect(old.listenerCount('exit')).toBe(0)
    expect(next.creates().map(m => m.id)).toEqual([ID])

    // BUG-171: the old server reports the PTY the recovery killed (exit 1) — it must not end the new one
    old.reply({ type: 'pty:exit', id: ID, exitCode: 1 })
    old.reply({ type: 'pty:data', id: ID, data: 'old output' })
    old.emit('exit', 1, null) // its own end: not a second recovery
    expect(exitEvents()).toEqual([])
    expect(manager.getCwd(ID)).toBe(CWD)
    expect(refork).toHaveBeenCalledTimes(1)

    // the rebuilt PTY works on the new server and its own exit is still reported
    next.reply({ type: 'pty:created', id: ID, pid: 200 })
    manager.write(ID, 'echo hi\r')
    expect(next.sent.at(-1)).toEqual({ type: 'pty:write', id: ID, data: 'echo hi\r' })
    next.reply({ type: 'pty:exit', id: ID, exitCode: 0 })
    expect(exitEvents()).toEqual([['pty:exit', ID, 0]])
  })

  it('a listener that survives the detach is stopped by the generation guard (logged)', async () => {
    old = new StickyServer(4000)
    connect(old)
    startTab(old)
    await handleServerDeath(manager)

    old.reply({ type: 'pty:exit', id: ID, exitCode: 1 })
    old.reply({ type: 'pty:data', id: ID, data: 'old output' })
    old.emit('exit', 1, null)
    expect(exitEvents()).toEqual([])
    expect(manager.getCwd(ID)).toBe(CWD)
    expect(refork).toHaveBeenCalledTimes(1)
    expect(logged(warn, `dropped message from a replaced Terminal Server: type=pty:exit id=${ID}`)).toBe(true)
    expect(logged(warn, 'dropped so far: 2')).toBe(true)
  })

  it('Windows: old server tree, then each registry PTY tree before its shell, registry cleared — all before the re-fork', async () => {
    old = new FakeServer(4000)
    connect(old)
    startTab(old)
    alive.add(501)
    alive.add(502)
    writeRegistry({
      serverPid: 4000,
      ptys: [
        { id: 'a', pid: 501, cwd: CWD, createdAt: '' },
        { id: 'b', pid: 502, cwd: CWD, createdAt: '' },
      ],
      updatedAt: '',
    }, dataDir)
    killTreeResult = (pid) => (pid === 502 ? 'failed' : 'killed')
    refork.mockImplementation(async () => {
      calls.push(`refork (registry ${readRegistry(dataDir) === null ? 'cleared' : 'present'})`)
      return next as unknown as ChildProcess
    })

    await handleServerDeath(manager, 'heartbeat')

    expect(calls[0]).toBe('tree 4000')
    expect(calls.indexOf('tree 502')).toBeLessThan(calls.indexOf('SIGTERM 502'))
    expect(calls).toContain('tree 501')
    expect(calls).not.toContain('SIGTERM 501') // tree ended → no signal to a pid that may be reused
    expect(calls.at(-1)).toBe('refork (registry cleared)')
    expect(alive.has(4000)).toBe(false)
    expect(logged(log, 'ended the old Terminal Server pid=4000 (tree=killed, signal=none)')).toBe(true)
  })

  it('Windows: a failed tree kill of the old server falls back to TerminateProcess (SIGKILL)', async () => {
    old = new FakeServer(4000)
    connect(old)
    killTreeResult = () => 'failed'
    await handleServerDeath(manager)
    expect(calls).toEqual(['tree 4000', 'SIGKILL 4000', 'refork'])
  })

  it('non-Windows: the old server gets SIGKILL, never SIGTERM (its handler would delete the new server’s files)', async () => {
    watchdog.platform = 'linux'
    manager = new PtyManager({ emit, dataDir, serverWatchdog: watchdog })
    manager.onRequestNewServer = refork
    old = new FakeServer(4000)
    connect(old)
    await handleServerDeath(manager)
    expect(calls).toEqual(['SIGKILL 4000', 'refork'])
  })

  it('an old server that already exited is not signalled', async () => {
    old = new FakeServer(4000)
    connect(old)
    old.exitCode = 1
    await handleServerDeath(manager, 'ipc-exit')
    expect(calls).toEqual(['refork'])
    expect(logged(log, 'old Terminal Server process already gone')).toBe(true)
  })

  it('TCP mode (no ChildProcess): the registry’s serverPid is ended when that process exists', async () => {
    alive.add(4100)
    writeRegistry({ serverPid: 4100, ptys: [], updatedAt: '' }, dataDir)
    await handleServerDeath(manager, 'tcp-close')
    expect(calls).toEqual(['tree 4100', 'refork'])
  })

  it('a tab closed while no server is connected is dropped, not rebuilt; writes do not throw', async () => {
    old = new FakeServer(4000)
    connect(old)
    startTab(old, 'keep')
    startTab(old, 'closed')
    let release!: () => void
    refork.mockImplementation(() => new Promise(resolve => {
      release = () => resolve(next as unknown as ChildProcess)
    }))
    const recovering = handleServerDeath(manager)
    await vi.waitUntil(() => refork.mock.calls.length > 0) // real timers here; no IPC event to wait for
    expect(() => manager.write('keep', 'x')).not.toThrow()
    expect(() => manager.resize('keep', 80, 24)).not.toThrow()
    expect(manager.kill('closed')).toBe(true)
    release()
    await recovering
    expect(next.creates().map(m => m.id)).toEqual(['keep'])
    expect(manager.getCwd('closed')).toBeNull()
  })
})

describe('killOrphanPtyProcesses (T0704: T0540 order for the T0113 cleanup)', () => {
  it('tree first; SIGTERM only when the tree kill did not end it', async () => {
    const order: string[] = []
    await killOrphanPtyProcesses([11, 12, 13, 0, -1], {
      killTree: async (pid) => {
        order.push(`tree ${pid}`)
        return pid === 11 ? 'killed' : pid === 12 ? 'failed' : 'not-windows'
      },
      kill: (pid, signal) => { order.push(`${signal} ${pid}`) },
    })
    expect(order.filter(s => s.endsWith(' 11'))).toEqual(['tree 11'])
    expect(order.filter(s => s.endsWith(' 12'))).toEqual(['tree 12', 'SIGTERM 12'])
    expect(order.filter(s => s.endsWith(' 13'))).toEqual(['tree 13', 'SIGTERM 13'])
    expect(order.some(s => / (0|-1)$/.test(s))).toBe(false)
  })

  it('a throwing kill / killTree does not reject', async () => {
    await expect(killOrphanPtyProcesses([21], {
      killTree: async () => { throw new Error('boom') },
      kill: () => { throw new Error('ESRCH') },
    })).resolves.toBeUndefined()
  })

  it('Electron startup cleanup uses it too (source)', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')
    const startup = main.slice(main.indexOf('async function startTerminalServer('), main.indexOf('async function reforkTerminalServer('))
    expect(startup).toMatch(/await killOrphanPtyProcesses\(registry\.ptys\.map\(entry => entry\.pid\)\)/)
    expect(startup).not.toMatch(/process\.kill\(entry\.pid, 'SIGTERM'\)/)
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'pty-manager.ts'), 'utf8')
    const recovery = src.slice(src.indexOf('Terminal Server died — attempting recovery'), src.indexOf('Request main.ts to re-fork'))
    expect(recovery).not.toMatch(/process\.kill\(entry\.pid/)
    // the old server is ended before the orphans, and both before the re-fork
    expect(recovery.indexOf('await this.endReplacedServer(')).toBeLessThan(recovery.indexOf('await killOrphanPtyProcesses('))
    expect(recovery.indexOf('await killOrphanPtyProcesses(')).toBeLessThan(recovery.indexOf('clearRegistry(userDataPath)'))
  })
})
