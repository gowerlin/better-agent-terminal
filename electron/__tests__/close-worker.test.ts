// @vitest-environment node
/**
 * PLAN-041 / T0535: `terminal:close-worker` — a Tower closes the Worker tab it dispatched.
 *
 * - WorkerCloseScheduler (electron/close-worker.ts) against a fake PtyManager:
 *   INVALID_ARGS / NOT_FOUND / NOT_OWNER / AMBIGUOUS / BUSY / ok; `delayMs` clamped to
 *   0..300000; new output or local input during the delay cancels; a repeated request restarts
 *   the timer; a tab gone by then ends silently; delay 0 closes at once
 * - PtyManager records the dispatch's `workorder` (normalized) and keeps it across `restart`,
 *   the Terminal Server idempotent re-create and the recovery rebuild; output / input times
 * - `terminal:create-agent-command` (skill mode) passes `workorder` to the PTY; `pty:write` from a
 *   local window marks user input, a RemoteServer write does not
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('close-worker / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import {
  CLOSE_WORKER_IDLE_MS,
  CLOSE_WORKER_MAX_DELAY_MS,
  normalizeWorkorderId,
  WorkerCloseScheduler,
  type CloseWorkerPtyManager,
} from '../close-worker'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext, SharedHandler } from '../handlers/types'

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
let registerPtyHandlers: typeof import('../handlers/pty').registerPtyHandlers
let registerTerminalHandlers: typeof import('../handlers/terminal').registerTerminalHandlers

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ registerPtyHandlers } = await import('../handlers/pty'))
  ;({ registerTerminalHandlers } = await import('../handlers/terminal'))
})

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── WorkerCloseScheduler against a fake PtyManager ──

interface FakeWorker { tower?: string; workorder?: string; lastOutput?: number | null; lastInput?: number | null }

function fakePtys(workers: Record<string, FakeWorker>): CloseWorkerPtyManager & { workers: Record<string, FakeWorker> } {
  return {
    workers,
    findWorkerTerminals: (towerId, workorder) => Object.entries(workers)
      .filter(([, w]) => w.workorder === normalizeWorkorderId(workorder) && (towerId === null || w.tower === towerId))
      .map(([id]) => id),
    getTowerTerminalId: id => workers[id]?.tower,
    getLastOutputAt: id => workers[id]?.lastOutput ?? null,
    getLastUserInputAt: id => workers[id]?.lastInput ?? null,
    isAlive: id => id in workers,
  }
}

function setupScheduler(workers: Record<string, FakeWorker>) {
  const ptys = fakePtys(workers)
  const emitted: Array<{ channel: string; payload: unknown }> = []
  const logs: string[] = []
  const scheduler = new WorkerCloseScheduler({
    getPtyManager: () => ptys,
    emit: (channel, payload) => { emitted.push({ channel, payload }); return 1 },
    logger: { log: (...args: unknown[]) => { logs.push(args.join(' ')) }, warn: () => {} },
  })
  return { ptys, emitted, logs, scheduler }
}

const T0 = 1_000_000

describe('WorkerCloseScheduler (T0535)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })

  it('INVALID_ARGS: missing tower, bad work order, non-numeric delay', () => {
    const { scheduler, emitted } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    expect(scheduler.request({ workorder: 'T0535' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: '  ', workorder: 'T0535' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: 'tw', workorder: 'not-a-workorder' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: '10' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: Number.NaN })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request(null)).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(emitted).toEqual([])
  })

  it('NOT_FOUND: no Worker recorded with that work order', () => {
    const { scheduler } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0001' }, plain: {} })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('NOT_OWNER: the work order\'s Worker was dispatched by another tower (or none)', () => {
    const { scheduler, logs } = setupScheduler({ w1: { tower: 'other-tower', workorder: 'T0535' }, w2: { workorder: 'T0535' } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(logs.at(-1)).toContain('[close-worker] tower=tw workorder=T0535 → NOT_OWNER (dispatched by other-tower,(none))')
  })

  it('AMBIGUOUS: two Workers of this tower for the work order (Renew re-dispatch)', () => {
    const { scheduler, emitted } = setupScheduler({
      w1: { tower: 'tw', workorder: 'T0535' },
      w2: { tower: 'tw', workorder: 'T0535' },
      w3: { tower: 'other', workorder: 'T0535' },
    })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toEqual({ ok: false, code: 'AMBIGUOUS', terminalIds: ['w1', 'w2'] })
    expect(emitted).toEqual([])
  })

  it('BUSY: output within the last 5 s; idle at exactly 5 s', () => {
    const { scheduler, ptys } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 - CLOSE_WORKER_IDLE_MS + 1 } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toEqual({ ok: false, code: 'BUSY' })
    ptys.workers.w1.lastOutput = T0 - CLOSE_WORKER_IDLE_MS
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toMatchObject({ ok: true, terminalId: 'w1' })
  })

  it('ok, delay 0 (default): close requested at once, work order matched trimmed / case-insensitively', () => {
    const { scheduler, emitted } = setupScheduler({ w1: { tower: 'tw', workorder: 'CP-T0535' }, w2: { tower: 'tw', workorder: 'T0001' } })
    expect(scheduler.request({ towerId: 'tw', workorder: '  cp-t0535 ' })).toEqual({ ok: true, terminalId: 'w1', closeAt: T0, delayMs: 0 })
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(scheduler.pendingIds()).toEqual([])
  })

  it('ok with a delay: the close is requested when the timer fires', () => {
    const { scheduler, emitted, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })).toEqual({ ok: true, terminalId: 'w1', closeAt: T0 + 10_000, delayMs: 10_000 })
    vi.advanceTimersByTime(9_999)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(logs.at(-1)).toContain('id=w1 → close requested')
  })

  it('delayMs is clamped to 0..300000', () => {
    const { scheduler } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000_000 })).toMatchObject({ ok: true, delayMs: CLOSE_WORKER_MAX_DELAY_MS, closeAt: T0 + CLOSE_WORKER_MAX_DELAY_MS })
    const second = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    expect(second.scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: -50 })).toMatchObject({ ok: true, delayMs: 0, closeAt: T0 })
    expect(second.emitted).toHaveLength(1)
  })

  it('new output during the delay cancels the close', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(3_000)
    ptys.workers.w1.lastOutput = Date.now()
    vi.advanceTimersByTime(7_000)
    expect(emitted).toEqual([])
    expect(logs.at(-1)).toContain('→ cancelled (new output during the delay)')
  })

  it('user input during the delay cancels the close', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(1_000)
    ptys.workers.w1.lastInput = Date.now()
    vi.advanceTimersByTime(9_000)
    expect(emitted).toEqual([])
    expect(logs.at(-1)).toContain('→ cancelled (user input during the delay)')
  })

  it('input / output before the request does not cancel it', () => {
    const { scheduler, emitted } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastInput: T0 - 1, lastOutput: T0 - CLOSE_WORKER_IDLE_MS } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 2_000 })
    vi.advanceTimersByTime(2_000)
    expect(emitted).toHaveLength(1)
  })

  it('a repeated request restarts the timer (the latest one wins)', () => {
    const { scheduler, emitted, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(8_000)
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 5_000 })).toMatchObject({ ok: true, closeAt: T0 + 8_000 + 5_000 })
    expect(logs.at(-1)).toContain('(replaces the pending close)')
    vi.advanceTimersByTime(2_000) // the first timer's due time passes
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(3_000)
    expect(emitted).toHaveLength(1)
    vi.advanceTimersByTime(60_000)
    expect(emitted).toHaveLength(1)
  })

  it('a refused request leaves a pending close alone', () => {
    const { scheduler, emitted, ptys } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 4_000 })
    expect(scheduler.request({ towerId: 'other', workorder: 'T0535', delayMs: 0 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    void ptys
    vi.advanceTimersByTime(4_000)
    expect(emitted).toHaveLength(1)
  })

  it('the tab is gone when the timer fires → ends silently', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 1_000 })
    delete ptys.workers.w1
    vi.advanceTimersByTime(1_000)
    expect(emitted).toEqual([])
    expect(logs.at(-1)).toContain('→ skipped (terminal no longer exists)')
  })

  it('dispose clears pending timers', () => {
    const { scheduler, emitted } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 1_000 })
    scheduler.dispose()
    vi.advanceTimersByTime(5_000)
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual([])
  })
})

describe('normalizeWorkorderId (T0535)', () => {
  it('trims, upper-cases and checks the --workorder grammar', () => {
    expect(normalizeWorkorderId(' t0535 ')).toBe('T0535')
    expect(normalizeWorkorderId('ct-t011')).toBe('CT-T011')
    expect(normalizeWorkorderId('KEENBEST-T1')).toBeNull()
    expect(normalizeWorkorderId('T')).toBeNull()
    expect(normalizeWorkorderId(35)).toBeNull()
    expect(normalizeWorkorderId(undefined)).toBeNull()
  })
})

// ── PtyManager: records, lookups, rebuilds ──

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string }> = []
  send = (msg: { type: string; id?: string }) => { this.sent.push(msg); return true }
}

describe('PtyManager Worker records (T0535)', () => {
  let dataDir: string
  let managers: PtyManagerType[] = []

  beforeEach(() => {
    // handleServerDeath clears the PTY registry in dataDir: never let it touch a shared dir
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0535-pty-'))
  })

  afterEach(() => {
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  function makeManager(): PtyManagerType {
    const manager = new PtyManager({ emit: vi.fn(), dataDir })
    managers.push(manager)
    return manager
  }

  const WORKER = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }

  it('findWorkerTerminals / getTowerTerminalId: by work order, optionally by tower', () => {
    const m = makeManager()
    m.create({ id: 'w1', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw-a' }, workorder: ' t0535 ' })
    m.create({ id: 'w2', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw-b' }, workorder: 'T0535' })
    m.create({ id: 'w3', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw-a' }, workorder: 'T0001' })
    m.create({ id: 'plain', ...WORKER })
    m.create({ id: 'bad', ...WORKER, workorder: 'not-a-workorder' })
    expect(m.findWorkerTerminals(null, 'T0535')).toEqual(['w1', 'w2'])
    expect(m.findWorkerTerminals('tw-a', 't0535')).toEqual(['w1'])
    expect(m.findWorkerTerminals('tw-c', 'T0535')).toEqual([])
    expect(m.findWorkerTerminals(null, 'bogus')).toEqual([])
    expect(m.getTowerTerminalId('w2')).toBe('tw-b')
    expect(m.getTowerTerminalId('plain')).toBeUndefined()
  })

  it('output / user input times; cleared on kill', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    const m = makeManager()
    m.create({ id: 'w1', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, workorder: 'T0535' })
    expect(m.getLastOutputAt('w1')).toBeNull()
    const pty = ptySpawn.mock.results[0].value as FakePty
    const onData = pty.onData.mock.calls[0][0] as (data: string) => void
    vi.setSystemTime(T0 + 100)
    onData('hello')
    expect(m.getLastOutputAt('w1')).toBe(T0 + 100)
    expect(m.getLastUserInputAt('w1')).toBeNull()
    vi.setSystemTime(T0 + 200)
    m.noteUserInput('w1')
    m.noteUserInput('no-such-pty')
    expect(m.getLastUserInputAt('w1')).toBe(T0 + 200)
    expect(m.getLastUserInputAt('no-such-pty')).toBeNull()
    m.kill('w1')
    expect(m.getLastOutputAt('w1')).toBeNull()
    expect(m.getLastUserInputAt('w1')).toBeNull()
    expect(m.findWorkerTerminals(null, 'T0535')).toEqual([])
  })

  it('restart keeps the work order (node-pty)', () => {
    const m = makeManager()
    m.create({ id: 'w1', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, workorder: 'T0535' })
    expect(m.restart('w1', CWD, '/bin/sh')).toBe(true)
    expect(m.findWorkerTerminals('tw', 'T0535')).toEqual(['w1'])
  })

  it('Terminal Server: restart, the idempotent re-create and the recovery rebuild keep it', async () => {
    const m = makeManager()
    const server = new FakeServer()
    m.setServerProcess(server as unknown as ChildProcess)
    m.create({ id: 'w1', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, workorder: 'T0535' })
    expect(m.restart('w1', CWD, '/bin/sh')).toBe(true)
    expect(m.findWorkerTerminals('tw', 'T0535')).toEqual(['w1'])

    // T0108 reconnect: re-registered without customEnv / workorder; a re-create that carries them fills them in.
    ;(m as unknown as { handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void })
      .handleReplayList([{ id: 'w2', pid: 1, cwd: CWD }])
    expect(m.findWorkerTerminals(null, 'T0536')).toEqual([])
    m.create({ id: 'w2', ...WORKER, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, workorder: 'T0536' })
    expect(m.findWorkerTerminals('tw', 'T0536')).toEqual(['w2'])

    const next = new FakeServer()
    m.onRequestNewServer = async () => next as unknown as ChildProcess
    server.connected = false
    await (m as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    expect(next.sent.filter(msg => msg.type === 'pty:create').map(msg => msg.id).sort()).toEqual(['w1', 'w2'])
    expect(m.findWorkerTerminals('tw', 'T0535')).toEqual(['w1'])
    expect(m.findWorkerTerminals('tw', 'T0536')).toEqual(['w2'])
  })
})

// ── Handlers: create-agent-command records the work order; pty:write marks local input ──

describe('handlers (T0535)', () => {
  function registry() {
    const handlers = new Map<string, SharedHandler>()
    const invoke = (channel: string, ctx: HandlerContext, ...args: unknown[]) => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`not registered: ${channel}`)
      return Promise.resolve(handler(ctx, ...args))
    }
    return { handlers, register: (channel: string, handler: SharedHandler) => { handlers.set(channel, handler) }, invoke }
  }

  function terminalDeps(manager: PtyManagerType) {
    return {
      getPtyManager: () => manager,
      emit: () => 0,
      readSettings: () => null,
      buildAgentPromptCommand: async (opts: { prompt?: string; skill?: string; workorder?: string }) => ({
        command: `agent ${opts.prompt ?? `/${opts.skill} ${opts.workorder}`}`,
        agentId: 'claude-cli',
        prompt: opts.prompt ?? '',
        prefixNormalized: false,
      }),
      existsSync: () => false,
    }
  }

  it('create-agent-command (skill mode) records the work order; prompt mode does not', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD })
    try {
      const r = registry()
      registerTerminalHandlers(r.register, terminalDeps(manager))
      const REMOTE: HandlerContext = { windowId: null, connectionId: 'helper-1' }
      await r.invoke('terminal:create-agent-command', REMOTE, {
        id: 'w1', cwd: CWD, shell: '/bin/sh', skill: 'ct-exec', workorder: 'T0535', customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' },
      })
      await r.invoke('terminal:create-agent-command', REMOTE, {
        id: 'w2', cwd: CWD, shell: '/bin/sh', prompt: '/ct-exec T0535', customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' },
      })
      expect(manager.findWorkerTerminals('tw', 'T0535')).toEqual(['w1'])
      expect(r.handlers.has('terminal:close-worker')).toBe(false)
    } finally {
      manager.dispose()
    }
  })

  it('terminal:close-worker is registered when the host passes a closer', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD })
    try {
      const r = registry()
      const request = vi.fn(() => ({ ok: false as const, code: 'NOT_FOUND' as const }))
      registerTerminalHandlers(r.register, { ...terminalDeps(manager), workerCloser: { request } })
      const args = { towerId: 'tw', workorder: 'T0535', delayMs: 10 }
      expect(await r.invoke('terminal:close-worker', { windowId: null, connectionId: 'c' }, args)).toEqual({ ok: false, code: 'NOT_FOUND' })
      expect(request).toHaveBeenCalledWith(args)
    } finally {
      manager.dispose()
    }
  })

  it('pty:write from a local window marks user input; a RemoteServer write does not', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD })
    try {
      const r = registry()
      registerPtyHandlers(r.register, { getPtyManager: () => manager })
      manager.create({ id: 'w1', ...{ cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' } })
      expect(await r.invoke('pty:write', { windowId: null, connectionId: 'helper-1' }, 'w1', 'x')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).toBeNull()
      expect(await r.invoke('pty:write', { windowId: 'win-1' }, 'w1', 'y')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).not.toBeNull()
      // detached window: windowId null, no connection → still local input
      const before = manager.getLastUserInputAt('w1')
      expect(await r.invoke('pty:write', { windowId: null }, 'w1', 'z')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).toBeGreaterThanOrEqual(before!)
      expect(await r.invoke('pty:write', { windowId: 'win-1' }, 'nope', 'z')).toEqual({ ok: false, reason: 'pty-not-found' })
    } finally {
      manager.dispose()
    }
  })
})
