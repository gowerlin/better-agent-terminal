// @vitest-environment node
/**
 * PLAN-041 / T0535: `terminal:close-worker` — a Tower closes the Worker tab it dispatched.
 *
 * - WorkerCloseScheduler (electron/close-worker.ts) against a fake PtyManager:
 *   INVALID_ARGS / NOT_FOUND / NOT_OWNER / AMBIGUOUS / ok; `delayMs` clamped to 0..300000;
 *   local input during the delay cancels; a repeated request restarts the timer; a tab gone by
 *   then ends silently; delay 0 closes at once
 * - T0545 / D145: recent output no longer refuses (no BUSY) and output during the delay no
 *   longer cancels; a tab still printing when the delay is up is closed once quiet for 5 s,
 *   at most 60 s past the due time (then given up); input while waiting cancels
 * - PtyManager records the dispatch's `workorder` (normalized) and keeps it across `restart`,
 *   the Terminal Server idempotent re-create and the recovery rebuild; output / input times
 * - `terminal:create-agent-command` (skill mode) passes `workorder` to the PTY; `pty:write` from a
 *   local window marks user input, a RemoteServer write does not
 * - T0551 / BUG-140: a write made only of terminal auto-replies (focus in / out, DSR / DA answers,
 *   mouse reports …) is not user input, locally or from a headless client; typing, Enter, a paste
 *   or a write mixing a reply with other characters still is; end to end through `pty:write`, the
 *   scheduler closes the tab despite focus reports during the delay / the quiet wait
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
  CLOSE_WORKER_MAX_QUIET_WAIT_MS,
  isTerminalAutoReply,
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

function setupScheduler(workers: Record<string, FakeWorker>, isOwnedBy?: (terminalId: string, towerId: string) => boolean) {
  const ptys = fakePtys(workers)
  const emitted: Array<{ channel: string; payload: unknown }> = []
  const logs: string[] = []
  const scheduler = new WorkerCloseScheduler({
    getPtyManager: () => ptys,
    ...(isOwnedBy ? { isOwnedBy } : {}),
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

  it('T0536: a tower is never its own Worker → NOT_OWNER', () => {
    const { scheduler, emitted } = setupScheduler({ tw: { tower: 'tw', workorder: 'T0536' } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0536' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(emitted).toEqual([])
  })

  it('T0536: isOwnedBy (headless isWorkerOf) is an extra check — false → NOT_OWNER; it narrows AMBIGUOUS', () => {
    const owned = new Set(['w2'])
    const isOwnedBy = vi.fn((id: string, tower: string) => tower === 'tw' && owned.has(id))
    const { scheduler, emitted } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0536' } }, isOwnedBy)
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0536' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(isOwnedBy).toHaveBeenCalledWith('w1', 'tw')

    const both = setupScheduler({ w1: { tower: 'tw', workorder: 'T0536' }, w2: { tower: 'tw', workorder: 'T0536' } }, isOwnedBy)
    expect(both.scheduler.request({ towerId: 'tw', workorder: 'T0536' })).toMatchObject({ ok: true, terminalId: 'w2' })
    expect(both.emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w2' } }])
    // BAT_TOWER_TERMINAL_ID still has to match: isOwnedBy alone does not make another tower's Worker ours
    const other = setupScheduler({ w2: { tower: 'other', workorder: 'T0536' } }, () => true)
    expect(other.scheduler.request({ towerId: 'tw', workorder: 'T0536' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(emitted).toEqual([])
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

  it('T0545: output within the last 5 s no longer refuses (no BUSY): scheduled, closed once quiet', () => {
    const { scheduler, emitted, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 - 812 } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 2_000 })).toEqual({ ok: true, terminalId: 'w1', closeAt: T0 + 2_000, delayMs: 2_000 })
    expect(logs.at(-1)).toContain('id=w1 → scheduled delayMs=2000 (output 812 ms ago; will wait for quiet)')
    vi.advanceTimersByTime(2_000) // the output is 2812 ms old by now: quiet at T0 - 812 + 5000
    expect(emitted).toEqual([])
    expect(logs.at(-1)).toContain('id=w1 → still printing (output 2812 ms ago): waiting for quiet (at most 60 s)')
    vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS - 2_812 - 1)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(logs.at(-1)).toContain('id=w1 → close requested after waiting 2.2 s for quiet (windows=1)')
    expect(scheduler.pendingIds()).toEqual([])
  })

  it('T0545: quiet at exactly 5 s closes at once; the scheduled log says nothing about waiting', () => {
    const { scheduler, emitted, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 - CLOSE_WORKER_IDLE_MS } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toMatchObject({ ok: true, terminalId: 'w1' })
    expect(logs.at(-2)).toMatch(/→ scheduled delayMs=0$/)
    expect(logs.at(-1)).toContain('id=w1 → close requested (windows=1)')
    expect(emitted).toHaveLength(1)
  })

  it('T0545: delay 0 while printing waits for quiet instead of closing at once', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 - 1_000 } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535' })).toEqual({ ok: true, terminalId: 'w1', closeAt: T0, delayMs: 0 })
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual(['w1'])
    vi.advanceTimersByTime(2_000)
    ptys.workers.w1.lastOutput = Date.now() // still printing: the quiet window restarts
    vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS - 1)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toHaveLength(1)
    expect(logs.at(-1)).toContain('→ close requested after waiting 7.0 s for quiet')
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

  it('T0545: output during the delay no longer cancels (quiet again by the due time → closes on time)', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(3_000)
    ptys.workers.w1.lastOutput = Date.now()
    vi.advanceTimersByTime(7_000)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(logs.at(-1)).toContain('id=w1 → close requested (windows=1)')
    expect(logs.join('\n')).not.toContain('cancelled')
  })

  it('T0545: still printing when the delay is up → waits, closes after 5 s of quiet', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(9_000)
    ptys.workers.w1.lastOutput = Date.now()
    vi.advanceTimersByTime(1_000) // due: output 1 s ago
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual(['w1'])
    expect(logs.at(-1)).toContain('→ still printing (output 1000 ms ago): waiting for quiet (at most 60 s)')
    for (let i = 0; i < 5; i++) { // prints every 2 s for another 10 s
      vi.advanceTimersByTime(2_000)
      ptys.workers.w1.lastOutput = Date.now()
    }
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS - 1)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(logs.at(-1)).toContain('→ close requested after waiting 15.0 s for quiet (windows=1)')
    expect(logs.filter(line => line.includes('still printing'))).toHaveLength(1)
  })

  it('T0545: still printing 60 s after the delay → given up, no close-requested, tab kept', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 } })
    const ticker = setInterval(() => { ptys.workers.w1.lastOutput = Date.now() }, 1_000) // a TUI redrawing every second
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 10_000 })
    vi.advanceTimersByTime(10_000 + CLOSE_WORKER_MAX_QUIET_WAIT_MS - 1)
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual(['w1'])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual([])
    expect(logs.at(-1)).toContain('id=w1 → cancelled (still printing 60 s after the delay; tab kept)')
    clearInterval(ticker)
    vi.advanceTimersByTime(120_000)
    expect(emitted).toEqual([])
  })

  it('T0545: quiet right at the 60 s deadline still closes', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 } })
    const ticker = setInterval(() => { ptys.workers.w1.lastOutput = Date.now() }, 1_000)
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 0 })
    vi.advanceTimersByTime(CLOSE_WORKER_MAX_QUIET_WAIT_MS - CLOSE_WORKER_IDLE_MS)
    clearInterval(ticker) // last output: quiet for 5 s exactly at the deadline
    vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS - 1)
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    expect(logs.at(-1)).toContain('id=w1 → close requested after waiting 60.0 s for quiet')
  })

  it('T0545: user input while waiting for quiet cancels', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535' } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 3_000 })
    vi.advanceTimersByTime(2_000)
    ptys.workers.w1.lastOutput = Date.now()
    vi.advanceTimersByTime(1_000) // due, still printing → waiting
    expect(scheduler.pendingIds()).toEqual(['w1'])
    vi.advanceTimersByTime(1_000)
    ptys.workers.w1.lastInput = Date.now()
    vi.advanceTimersByTime(CLOSE_WORKER_MAX_QUIET_WAIT_MS)
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual([])
    expect(logs.at(-1)).toContain('id=w1 → cancelled (user input while waiting for quiet)')
  })

  it('T0545: a new request replaces a close waiting for quiet (the latest one wins)', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 0 }) // waiting for quiet until T0 + 5000
    vi.advanceTimersByTime(1_000)
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 20_000 })).toMatchObject({ ok: true, closeAt: T0 + 21_000 })
    expect(logs.at(-1)).toContain('(output 1000 ms ago; will wait for quiet) (replaces the pending close)')
    vi.advanceTimersByTime(19_999) // the old quiet check (T0 + 5000) passes without closing
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'w1' } }])
    void ptys
  })

  it('T0545: the tab is gone while waiting for quiet → ends silently', () => {
    const { scheduler, emitted, ptys, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0535', lastOutput: T0 } })
    scheduler.request({ towerId: 'tw', workorder: 'T0535', delayMs: 0 })
    expect(scheduler.pendingIds()).toEqual(['w1'])
    delete ptys.workers.w1
    vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS)
    expect(emitted).toEqual([])
    expect(scheduler.pendingIds()).toEqual([])
    expect(logs.at(-1)).toContain('→ skipped (terminal no longer exists)')
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

  it('T0536: isUserInput overrides the rule (headless: a client connection counts, a helper does not)', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD })
    try {
      const r = registry()
      registerPtyHandlers(r.register, { getPtyManager: () => manager, isUserInput: ctx => ctx.connectionId === 'client-1' })
      manager.create({ id: 'w1', ...{ cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' } })
      expect(await r.invoke('pty:write', { windowId: null, connectionId: 'helper-1' }, 'w1', 'x')).toEqual({ ok: true })
      expect(await r.invoke('pty:write', { windowId: null }, 'w1', 'x')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).toBeNull()
      expect(await r.invoke('pty:write', { windowId: null, connectionId: 'client-1' }, 'w1', 'y')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).not.toBeNull()
    } finally {
      manager.dispose()
    }
  })
})

// ── T0551 / BUG-140: terminal auto-replies are not user input ──

const FOCUS_IN = '\x1b[I'
const FOCUS_OUT = '\x1b[O'
const AUTO_REPLIES: Array<[string, string]> = [
  ['focus in', FOCUS_IN],
  ['focus out', FOCUS_OUT],
  ['cursor position report (DSR 6)', '\x1b[24;80R'],
  ['DECXCPR', '\x1b[?24;80;1R'],
  ['device status report (DSR 5)', '\x1b[0n'],
  ['DA1', '\x1b[?1;2c'],
  ['DA2', '\x1b[>0;276;0c'],
  ['DECRQM reply', '\x1b[?2004;1$y'],
  ['XTWINOPS size report', '\x1b[8;24;80t'],
  ['kitty keyboard flags', '\x1b[?0u'],
  ['SGR mouse press / release', '\x1b[<0;10;5M\x1b[<0;10;5m'],
  ['urxvt mouse', '\x1b[32;10;5M'],
  ['X10 mouse', '\x1b[M !!'],
  ['OSC colour reply (BEL)', '\x1b]11;rgb:1e1e/1e1e/1e1e\x07'],
  ['OSC colour reply (ST)', '\x1b]10;rgb:d4d4/d4d4/d4d4\x1b\\'],
  ['DCS XTVERSION', '\x1bP>|xterm.js(5.5.0)\x1b\\'],
  ['DCS DECRQSS', '\x1bP1$r0m\x1b\\'],
  ['several replies in one write', `${FOCUS_OUT}${FOCUS_IN}\x1b[3;1R`],
]
const USER_INPUT: Array<[string, string]> = [
  ['a character', 'x'],
  ['Enter', '\r'],
  ['Shift+Enter newline', '\n'],
  ['Esc alone', '\x1b'],
  ['an arrow key', '\x1b[A'],
  ['an SS3 arrow key', '\x1bOA'],
  ['F5', '\x1b[15~'],
  ['Shift+Tab', '\x1b[Z'],
  ['Alt+[ (incomplete CSI)', '\x1b['],
  ['Alt+Shift+P (DCS introducer alone)', '\x1bP'],
  ['an unterminated OSC', '\x1b]11;rgb:1e1e/1e1e/1e1e'],
  ['a bracketed paste', '\x1b[200~hello\x1b[201~'],
  ['a plain paste', 'git status\r'],
  ['an IME commit', '中文'],
  ['a focus report followed by a character', `${FOCUS_IN}x`],
  ['a character followed by a focus report', `x${FOCUS_OUT}`],
  ['a reply then Enter', '\x1b[24;80R\r'],
]

describe('isTerminalAutoReply (T0551)', () => {
  it.each(AUTO_REPLIES)('%s → auto-reply', (_label, data) => {
    expect(isTerminalAutoReply(data)).toBe(true)
  })

  it.each(USER_INPUT)('%s → user input', (_label, data) => {
    expect(isTerminalAutoReply(data)).toBe(false)
  })

  it('empty and non-string data are not auto-replies (counted as before)', () => {
    expect(isTerminalAutoReply('')).toBe(false)
    expect(isTerminalAutoReply(undefined)).toBe(false)
    expect(isTerminalAutoReply(null)).toBe(false)
    expect(isTerminalAutoReply(42)).toBe(false)
  })
})

describe('pty:write user input with terminal auto-replies (T0551)', () => {
  let dataDir: string
  let managers: PtyManagerType[] = []

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0551-pty-'))
  })

  afterEach(() => {
    for (const m of managers.splice(0)) m.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  /** A PtyManager with Worker `w1` (Tower `tw`, T0551) and its `pty:write` handler. */
  function setup(isUserInput?: (ctx: HandlerContext) => boolean) {
    const manager = new PtyManager({ emit: vi.fn(), dataDir })
    managers.push(manager)
    manager.create({ id: 'w1', cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, workorder: 'T0551' })
    const pty = ptySpawn.mock.results.at(-1)!.value as FakePty
    const handlers = new Map<string, SharedHandler>()
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, {
      getPtyManager: () => manager,
      ...(isUserInput ? { isUserInput } : {}),
    })
    const write = (ctx: HandlerContext, data: unknown) => Promise.resolve(handlers.get('pty:write')!(ctx, 'w1', data))
    return { manager, pty, write }
  }

  const LOCAL: HandlerContext = { windowId: 'win-1' }
  const HELPER: HandlerContext = { windowId: null, connectionId: 'helper-1' }
  const CLIENT: HandlerContext = { windowId: null, connectionId: 'client-1' }

  it('local window: auto-replies reach the PTY but are not input', async () => {
    const { manager, pty, write } = setup()
    for (const [, data] of AUTO_REPLIES) expect(await write(LOCAL, data)).toEqual({ ok: true })
    expect(manager.getLastUserInputAt('w1')).toBeNull()
    expect(pty.write.mock.calls.map(c => c[0])).toEqual(AUTO_REPLIES.map(([, d]) => d))
  })

  it.each(USER_INPUT)('local window: %s is input', async (_label, data) => {
    const { manager, pty, write } = setup()
    expect(await write(LOCAL, data)).toEqual({ ok: true })
    expect(manager.getLastUserInputAt('w1')).not.toBeNull()
    expect(pty.write).toHaveBeenCalledWith(data)
  })

  it('a helper write never counts, typed text or not', async () => {
    const { manager, write } = setup()
    await write(HELPER, 'x')
    await write(HELPER, FOCUS_IN)
    expect(manager.getLastUserInputAt('w1')).toBeNull()
  })

  it('headless (isUserInput = client connection): same rule for a client; a helper never counts', async () => {
    const { manager, write } = setup(ctx => ctx.connectionId === 'client-1')
    await write(CLIENT, FOCUS_OUT)
    await write(CLIENT, '\x1b[?1;2c')
    await write(CLIENT, '\x1b[12;1R')
    await write(HELPER, 'typed by a helper\r')
    expect(manager.getLastUserInputAt('w1')).toBeNull()
    await write(CLIENT, `${FOCUS_IN}y`)
    expect(manager.getLastUserInputAt('w1')).not.toBeNull()
  })

  describe('with the scheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(T0)
    })

    function scheduler(manager: PtyManagerType) {
      const emitted: unknown[] = []
      const logs: string[] = []
      const s = new WorkerCloseScheduler({
        getPtyManager: () => manager,
        emit: (_channel, payload) => { emitted.push(payload); return 1 },
        logger: { log: (...args: unknown[]) => { logs.push(args.join(' ')) }, warn: () => {} },
      })
      return { s, emitted, logs }
    }

    it('focus in / out, DSR and DA replies during the delay → closed on time', async () => {
      const { manager, write } = setup()
      const { s, emitted, logs } = scheduler(manager)
      expect(s.request({ towerId: 'tw', workorder: 'T0551', delayMs: 10_000 })).toMatchObject({ ok: true })
      for (const data of [FOCUS_OUT, FOCUS_IN, '\x1b[3;1R', '\x1b[?1;2c', '\x1b[0n']) {
        vi.advanceTimersByTime(1_000)
        await write(LOCAL, data)
      }
      vi.advanceTimersByTime(5_000)
      expect(emitted).toEqual([{ id: 'w1' }])
      expect(logs.at(-1)).toContain('id=w1 → close requested')
    })

    it('focus reports while waiting for quiet → still closed once quiet', async () => {
      const { manager, pty, write } = setup()
      const { s, emitted, logs } = scheduler(manager)
      const onData = pty.onData.mock.calls[0][0] as (data: string) => void
      s.request({ towerId: 'tw', workorder: 'T0551', delayMs: 2_000 })
      vi.advanceTimersByTime(1_000)
      onData('wrap-up output')
      vi.advanceTimersByTime(1_000) // due, printing → waiting for quiet
      expect(s.pendingIds()).toEqual(['w1'])
      await write(LOCAL, FOCUS_IN)
      vi.advanceTimersByTime(1_000)
      await write(LOCAL, FOCUS_OUT)
      vi.advanceTimersByTime(CLOSE_WORKER_IDLE_MS)
      expect(emitted).toEqual([{ id: 'w1' }])
      expect(logs.at(-1)).toMatch(/id=w1 → close requested after waiting \d+\.\d s for quiet/)
    })

    it('typing during the delay (right after a focus report) still cancels', async () => {
      const { manager, write } = setup()
      const { s, emitted, logs } = scheduler(manager)
      s.request({ towerId: 'tw', workorder: 'T0551', delayMs: 10_000 })
      vi.advanceTimersByTime(1_000)
      await write(LOCAL, FOCUS_IN)
      vi.advanceTimersByTime(1_000)
      await write(LOCAL, 'x')
      vi.advanceTimersByTime(8_000)
      expect(emitted).toEqual([])
      expect(logs.at(-1)).toContain('id=w1 → cancelled (user input during the delay)')
    })

    it('a paste while waiting for quiet still cancels', async () => {
      const { manager, pty, write } = setup()
      const { s, emitted, logs } = scheduler(manager)
      const onData = pty.onData.mock.calls[0][0] as (data: string) => void
      onData('printing')
      s.request({ towerId: 'tw', workorder: 'T0551', delayMs: 0 }) // waiting for quiet
      vi.advanceTimersByTime(1_000)
      await write(LOCAL, '\x1b[200~pasted\x1b[201~')
      vi.advanceTimersByTime(CLOSE_WORKER_MAX_QUIET_WAIT_MS)
      expect(emitted).toEqual([])
      expect(logs.at(-1)).toContain('id=w1 → cancelled (user input while waiting for quiet)')
    })
  })
})
