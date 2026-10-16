// @vitest-environment node
/**
 * PLAN-044 / T0566 (D148): UsageLimitContinueScheduler (electron/usage-limit-continue.ts).
 *
 * - off (default) → nothing tracked, shown or sent
 * - codex limit in a yolo tab → scheduled at reset + delay, sent then (text + Enter); a newer limit
 *   replaces the pending one; user input cancels; an auto reply is not input (the handler's rule);
 *   at most 2 sends in a row (then hint `cap`), user input resets the streak; weekly → hint only;
 *   the tab gone / Settings off / yolo removed → not sent; the screen changed by the due time →
 *   not sent (re-check); a long wait survives a clock jump (sleep); the limit already acted on
 *   stays history
 * - claude: the CLI's own auto continue → hint only, never text; stale → Enter only after the delay
 * - non-yolo tab → hint `not-yolo`; headless with no client → not sent (logged)
 * - `pty:write` `{ auto: true }` is not user input: neither the usage-limit wait nor a
 *   `--close-worker` delay is cancelled by it; real PtyManager output reaches the scheduler
 */
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('usage-limit-continue / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import {
  USAGE_LIMIT_CONTINUE_CHANNEL,
  USAGE_LIMIT_MAX_TICK_MS,
  USAGE_LIMIT_QUIET_MS,
  USAGE_LIMIT_STATUS_CHANNEL,
  USAGE_LIMIT_STREAK_RESET_MS,
  UsageLimitContinueScheduler,
  type UsageLimitPtyManager,
} from '../usage-limit-continue'
import { WorkerCloseScheduler } from '../close-worker'
import type { UsageLimitConfig, UsageLimitContinueEvent, UsageLimitStatusEvent } from '../../src/lib/usage-limit'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext, SharedHandler } from '../handlers/types'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}
const ptySpawn = vi.fn(() => new FakePty())
let PtyManager: typeof PtyManagerType
let registerPtyHandlers: typeof import('../handlers/pty').registerPtyHandlers

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ registerPtyHandlers } = await import('../handlers/pty'))
})

const START = new Date(2026, 9, 16, 15, 0, 0).getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const at = (hour: number, minute: number) => new Date(2026, 9, 16, hour, minute).getTime()
const clock = (epoch: number) => {
  const d = new Date(epoch)
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}
const codexLimit = (reset: number) => `\r\n\x1b[31m■\x1b[0m You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at ${clock(reset)}.\r\n\r\n› Ask Codex to do anything\r\n`

interface Tab { alive: boolean; yolo: boolean }

function setup(opts: { config?: Partial<UsageLimitConfig>; tabs?: Record<string, Partial<Tab>>; canDeliver?: () => boolean } = {}) {
  const tabs: Record<string, Tab> = {}
  for (const [id, t] of Object.entries(opts.tabs ?? { t1: {} })) tabs[id] = { alive: true, yolo: true, ...t }
  const config: UsageLimitConfig = { enabled: true, text: '繼續', delayMinutes: 2, ...opts.config }
  const emitted: Array<{ channel: string; payload: unknown }> = []
  const logs: string[] = []
  const ptys: UsageLimitPtyManager = {
    isAlive: id => tabs[id]?.alive ?? false,
    isYoloTerminal: id => tabs[id]?.yolo ?? false,
  }
  const scheduler = new UsageLimitContinueScheduler({
    getPtyManager: () => ptys,
    readConfig: () => ({ ...config }),
    emit: (channel, payload) => { emitted.push({ channel, payload }); return 1 },
    ...(opts.canDeliver ? { canDeliver: opts.canDeliver } : {}),
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: () => {} },
  })
  const sends = () => emitted.filter(e => e.channel === USAGE_LIMIT_CONTINUE_CHANNEL).map(e => e.payload as UsageLimitContinueEvent)
  const statuses = (id = 't1') => emitted.filter(e => e.channel === USAGE_LIMIT_STATUS_CHANNEL && (e.payload as UsageLimitStatusEvent).id === id)
    .map(e => (e.payload as UsageLimitStatusEvent).status)
  const lastStatus = (id = 't1') => statuses(id).at(-1) ?? null
  /** Output, then the tab stays quiet long enough to be classified. */
  const print = (data: string, id = 't1') => {
    scheduler.onOutput(id, data)
    vi.advanceTimersByTime(USAGE_LIMIT_QUIET_MS)
  }
  return { scheduler, tabs, config, emitted, logs, sends, statuses, lastStatus, print }
}

describe('off by default', () => {
  it('disabled → output is not tracked; nothing shown or sent', () => {
    const s = setup({ config: { enabled: false } })
    s.print(codexLimit(at(15, 10)))
    vi.advanceTimersByTime(60 * 60_000)
    expect(s.emitted).toEqual([])
    expect(s.scheduler.pendingIds()).toEqual([])
  })
})

describe('codex (yolo tab)', () => {
  it('scheduled at reset + delay after the tab went quiet; sends the Settings text + Enter then', () => {
    const s = setup()
    const reset = at(15, 10)
    s.scheduler.onOutput('t1', codexLimit(reset))
    vi.advanceTimersByTime(USAGE_LIMIT_QUIET_MS - 1)
    expect(s.emitted).toEqual([]) // not classified before the quiet time
    vi.advanceTimersByTime(1)
    expect(s.lastStatus()).toEqual({ state: 'scheduled', agent: 'codex', action: 'text', dueAt: reset + 2 * 60_000, resetsAt: reset, resetText: '3:10 PM' })
    vi.setSystemTime(reset + 2 * 60_000 - 1000)
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toEqual([{ id: 't1', action: 'text', text: '繼續', agent: 'codex', traceId: expect.stringMatching(/^usage-limit-/) }])
    expect(s.lastStatus()).toBeNull()
    expect(s.logs.some(l => l.includes('[usage-limit] id=t1 → send requested: text "繼續" + Enter'))).toBe(true)
  })

  it('delay 0 and a reset already reached → sent right after the quiet time', () => {
    const s = setup({ config: { delayMinutes: 0 } })
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(1)
  })

  it('a newer limit message replaces the pending send (latest wins)', () => {
    const s = setup()
    s.print(codexLimit(at(15, 10)))
    s.print(codexLimit(at(15, 40)))
    expect(s.lastStatus()).toMatchObject({ state: 'scheduled', resetsAt: at(15, 40) })
    vi.setSystemTime(at(15, 20))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toEqual([])
    vi.setSystemTime(at(15, 42))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toHaveLength(1)
    expect(s.logs.some(l => l.includes('(replaces the pending send)'))).toBe(true)
  })

  it('a redraw of the same limit keeps the running timer', () => {
    const s = setup()
    s.print(codexLimit(at(15, 10)))
    const first = s.statuses().length
    s.print(codexLimit(at(15, 10)))
    expect(s.statuses()).toHaveLength(first)
    expect(s.logs.filter(l => l.includes('→ scheduled'))).toHaveLength(1)
  })

  it('user input while waiting cancels; the limit on screen is then history (no re-schedule)', () => {
    const s = setup()
    s.print(codexLimit(at(15, 10)))
    s.scheduler.onUserInput('t1')
    expect(s.scheduler.pendingIds()).toEqual([])
    expect(s.lastStatus()).toBeNull()
    s.print('\x1b[3;1H› ab') // the composer echo
    vi.setSystemTime(at(15, 30))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toEqual([])
    expect(s.logs.some(l => l.includes('→ cancelled (user input while waiting'))).toBe(true)
    // a new limit after the input is a new occurrence
    s.print(codexLimit(at(15, 50)))
    expect(s.lastStatus()).toMatchObject({ state: 'scheduled', resetsAt: at(15, 50) })
  })

  it('after a send the old limit line is history: the reply below it does not re-schedule', () => {
    const s = setup({ config: { delayMinutes: 0 } })
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(1)
    s.print('\r\n› 繼續\r\n\r\n• Continuing with step 2.\r\n')
    vi.advanceTimersByTime(60 * 60_000)
    expect(s.sends()).toHaveLength(1)
    expect(s.lastStatus()).toBeNull()
  })

  it('at most 2 automatic sends in a row, then hint `cap`; user input or a long gap resets the streak', () => {
    const s = setup({ config: { delayMinutes: 0 } })
    for (let i = 0; i < 2; i++) {
      s.print(codexLimit(at(15, 0)))
      vi.advanceTimersByTime(1)
    }
    expect(s.sends()).toHaveLength(2)
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(2)
    expect(s.lastStatus()).toMatchObject({ state: 'hint', hint: 'cap', agent: 'codex' })
    s.scheduler.onUserInput('t1')
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(3)
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(4)
    // the agent worked for a while before the next limit: a new streak
    vi.setSystemTime(Date.now() + USAGE_LIMIT_STREAK_RESET_MS + 1000)
    s.print(codexLimit(at(15, 0) + USAGE_LIMIT_STREAK_RESET_MS + 1000))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(5)
  })

  it('a reset more than 5 h 15 min out (weekly), try again later, a spend cap → hint only', () => {
    const s = setup({ tabs: { a: {}, b: {}, c: {} } })
    s.print(codexLimit(at(21, 0)), 'a')
    s.print("■ You've hit your usage limit. Try again later.\r\n", 'b')
    s.print('■ You hit your spend cap. Raise it in settings.\r\n', 'c')
    expect(s.lastStatus('a')).toMatchObject({ state: 'hint', hint: 'weekly', resetsAt: at(21, 0) })
    expect(s.lastStatus('b')).toMatchObject({ state: 'hint', hint: 'no-reset-time' })
    expect(s.lastStatus('c')).toMatchObject({ state: 'hint', hint: 'non-timed' })
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(s.sends()).toEqual([])
    expect(s.scheduler.pendingIds()).toEqual([])
  })

  it('the screen changed by the due time (re-check) → not sent', () => {
    const s = setup({ config: { delayMinutes: 0 } })
    s.print(codexLimit(at(15, 10)))
    // the next one-minute check comes in 60 s; new output 3 s before it, the wall clock past due:
    // the check runs before the tab is quiet again, so only the due-time re-check sees it
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS - 3000)
    vi.setSystemTime(at(15, 10) + 1000)
    s.scheduler.onOutput('t1', '\r\n■ Your workspace is out of credits. Ask your admin.\r\n')
    vi.advanceTimersByTime(3000)
    expect(s.sends()).toEqual([])
    expect(s.logs.some(l => l.includes('→ not sent (re-check failed: the screen shows hint non-timed)'))).toBe(true)
  })

  it('a long wait survives a clock jump (sleep / resume): checked every minute against the wall clock', () => {
    const s = setup()
    const reset = at(18, 0)
    s.print(codexLimit(reset))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS) // one tick, still early
    expect(s.sends()).toEqual([])
    vi.setSystemTime(reset + 3 * 60_000) // the computer slept past the due time
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toHaveLength(1)
    expect(s.logs.some(l => /s late\)/.test(l))).toBe(true)
  })

  it('the tab gone before the due time, Settings turned off, yolo removed → not sent', () => {
    const s = setup({ tabs: { gone: {}, off: {}, notyolo: {} } })
    s.print(codexLimit(at(15, 10)), 'gone')
    s.print(codexLimit(at(15, 10)), 'notyolo')
    s.tabs.gone.alive = false
    s.tabs.notyolo.yolo = false
    vi.setSystemTime(at(15, 13))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toEqual([])
    expect(s.logs.some(l => l.includes('id=gone → not sent (terminal no longer exists)'))).toBe(true)
    expect(s.logs.some(l => l.includes('id=notyolo → not sent (no longer a yolo tab)'))).toBe(true)

    s.print(codexLimit(at(15, 30)), 'off')
    expect(s.scheduler.pendingIds()).toEqual(['off'])
    s.config.enabled = false
    s.scheduler.refreshConfig()
    expect(s.scheduler.pendingIds()).toEqual([])
    expect(s.logs.some(l => l.includes('id=off → cancelled (turned off in Settings)'))).toBe(true)
    expect(s.lastStatus('off')).toBeNull()
    vi.setSystemTime(at(15, 40))
    vi.advanceTimersByTime(USAGE_LIMIT_MAX_TICK_MS)
    expect(s.sends()).toEqual([])
  })

  it('onExit drops the pending send and the tab state', () => {
    const s = setup()
    s.print(codexLimit(at(15, 10)))
    s.scheduler.onExit('t1')
    expect(s.scheduler.pendingIds()).toEqual([])
    expect(s.logs.some(l => l.includes('id=t1 → cancelled (terminal ended)'))).toBe(true)
  })
})

describe('claude', () => {
  const limit = "\r\n  ⎿  You've hit your session limit · resets 4pm (Asia/Taipei)\r\n"

  it('the CLI continues by itself → hint cli-auto, nothing sent ever', () => {
    const s = setup({ config: { delayMinutes: 0 } })
    s.print(limit + '\r\nUsage limit reached · continuing automatically at 4pm · esc to cancel\r\n')
    expect(s.lastStatus()).toMatchObject({ state: 'hint', agent: 'claude', hint: 'cli-auto', resetText: '4pm' })
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(s.sends()).toEqual([])
  })

  it('a limit without the CLI line (D2) and a weekly limit → hint only', () => {
    const s = setup({ tabs: { a: {}, b: {} }, config: { delayMinutes: 0 } })
    s.print(limit, 'a')
    s.print("\r\n  ⎿  You've hit your weekly limit · resets Oct 20, 3pm (Asia/Taipei)\r\n", 'b')
    expect(s.lastStatus('a')).toMatchObject({ state: 'hint', hint: 'cli-unavailable' })
    expect(s.lastStatus('b')).toMatchObject({ state: 'hint', hint: 'weekly' })
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(s.sends()).toEqual([])
  })

  it('stale (slept past the reset) → Enter only, after the delay; the CLI resuming first cancels it', () => {
    const s = setup({ tabs: { a: {}, b: {} } })
    const stale = '\r\nYour usage limit has reset\r\nPress enter to continue\r\n'
    s.print(limit + stale, 'a')
    s.print(limit + stale, 'b')
    expect(s.lastStatus('a')).toMatchObject({ state: 'scheduled', agent: 'claude', action: 'enter', dueAt: START + USAGE_LIMIT_QUIET_MS + 2 * 60_000 })
    s.print('\r\nUsage limit available again · continuing now\r\n', 'b')
    expect(s.lastStatus('b')).toBeNull()
    vi.advanceTimersByTime(2 * 60_000)
    expect(s.sends()).toEqual([{ id: 'a', action: 'enter', agent: 'claude', traceId: expect.any(String) }])
    expect(s.sends()[0]).not.toHaveProperty('text')
  })
})

describe('non-yolo tab, headless without a client', () => {
  it('non-yolo → hint not-yolo, no schedule', () => {
    const s = setup({ tabs: { t1: { yolo: false } }, config: { delayMinutes: 0 } })
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(60 * 60_000)
    expect(s.lastStatus()).toMatchObject({ state: 'hint', hint: 'not-yolo', agent: 'codex' })
    expect(s.sends()).toEqual([])
    expect(s.logs.some(l => l.includes('hint only (not a yolo tab)'))).toBe(true)
  })

  it('canDeliver false (no client connected) → not sent, logged', () => {
    let clients = 0
    const s = setup({ config: { delayMinutes: 0 }, canDeliver: () => clients > 0 })
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toEqual([])
    expect(s.logs.some(l => l.includes('→ not sent (no client connected)'))).toBe(true)
    clients = 1
    s.print(codexLimit(at(15, 0)))
    vi.advanceTimersByTime(1)
    expect(s.sends()).toHaveLength(1)
  })
})

describe('pty:write and the real PtyManager', () => {
  function registry() {
    const handlers = new Map<string, SharedHandler>()
    const invoke = (channel: string, ctx: HandlerContext, ...args: unknown[]) => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`not registered: ${channel}`)
      return Promise.resolve(handler(ctx, ...args))
    }
    return { register: (channel: string, handler: SharedHandler) => { handlers.set(channel, handler) }, invoke }
  }
  const TAB = { cwd: os.tmpdir(), type: 'terminal' as const, shell: '/bin/sh' }
  const LOCAL: HandlerContext = { windowId: 'win-1' }

  it('{ auto: true } is not user input (no noteUserInput, no onUserInput); an auto reply neither; typing is', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir() })
    const onUserInput = vi.fn()
    try {
      const r = registry()
      registerPtyHandlers(r.register, { getPtyManager: () => manager, onUserInput })
      manager.create({ id: 'w1', ...TAB })
      expect(await r.invoke('pty:write', LOCAL, 'w1', '繼續', { auto: true })).toEqual({ ok: true })
      expect(await r.invoke('pty:write', LOCAL, 'w1', '\r', { auto: true })).toEqual({ ok: true })
      expect(await r.invoke('pty:write', LOCAL, 'w1', '\x1b[I')).toEqual({ ok: true })
      expect(manager.getLastUserInputAt('w1')).toBeNull()
      expect(onUserInput).not.toHaveBeenCalled()
      // a malformed flag is not "auto"
      expect(await r.invoke('pty:write', LOCAL, 'w1', 'x', { auto: 'yes' })).toEqual({ ok: true })
      expect(onUserInput).toHaveBeenCalledWith('w1')
      expect(manager.getLastUserInputAt('w1')).not.toBeNull()
    } finally {
      manager.dispose()
    }
  })

  it('the automatic continue does not cancel a --close-worker delay of the same tab; typing does', async () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir() })
    try {
      const r = registry()
      registerPtyHandlers(r.register, { getPtyManager: () => manager })
      manager.create({ id: 'w1', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw', CT_MODE: 'yolo' }, workorder: 'T0566' })
      manager.create({ id: 'w2', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw', CT_MODE: 'yolo' }, workorder: 'T0567' })
      const emitted: unknown[] = []
      const closer = new WorkerCloseScheduler({ getPtyManager: () => manager, emit: (_c, p) => { emitted.push(p); return 1 }, logger })
      expect(closer.request({ towerId: 'tw', workorder: 'T0566', delayMs: 10_000 })).toMatchObject({ ok: true })
      expect(closer.request({ towerId: 'tw', workorder: 'T0567', delayMs: 10_000 })).toMatchObject({ ok: true })
      vi.advanceTimersByTime(1000)
      await r.invoke('pty:write', LOCAL, 'w1', '繼續', { auto: true })
      await r.invoke('pty:write', LOCAL, 'w1', '\r', { auto: true })
      await r.invoke('pty:write', LOCAL, 'w2', 'x')
      vi.advanceTimersByTime(10_000)
      expect(emitted).toEqual([{ id: 'w1' }])
      closer.dispose()
    } finally {
      manager.dispose()
    }
  })

  it('PtyManager hands live output to onPtyOutput; isYoloTerminal decides; exit drops the tab', () => {
    const emitted: Array<{ channel: string; payload: unknown }> = []
    let scheduler: UsageLimitContinueScheduler | null = null
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir: os.tmpdir(),
      onPtyOutput: (id, data) => scheduler?.onOutput(id, data),
      onPtyExit: id => scheduler?.onExit(id),
    })
    scheduler = new UsageLimitContinueScheduler({
      getPtyManager: () => manager,
      readConfig: () => ({ enabled: true, text: '繼續', delayMinutes: 0 }),
      emit: (channel, payload) => { emitted.push({ channel, payload }); return 1 },
      logger: { log: () => {}, warn: () => {} },
    })
    try {
      manager.create({ id: 'tw', ...TAB })
      manager.create({ id: 'plain', ...TAB })
      manager.setTerminalRole('tw', 'tower', 'yolo')
      const ptys = ptySpawn.mock.results.slice(-2).map(r => r.value as FakePty)
      const feed = (pty: FakePty, data: string) => (pty.onData.mock.calls[0][0] as (d: string) => void)(data)
      feed(ptys[0], codexLimit(at(15, 0)))
      feed(ptys[1], codexLimit(at(15, 0)))
      vi.advanceTimersByTime(USAGE_LIMIT_QUIET_MS)
      vi.advanceTimersByTime(1)
      const sends = emitted.filter(e => e.channel === USAGE_LIMIT_CONTINUE_CHANNEL).map(e => (e.payload as UsageLimitContinueEvent).id)
      expect(sends).toEqual(['tw'])
      const plain = emitted.filter(e => e.channel === USAGE_LIMIT_STATUS_CHANNEL && (e.payload as UsageLimitStatusEvent).id === 'plain')
      expect((plain.at(-1)?.payload as UsageLimitStatusEvent).status).toMatchObject({ hint: 'not-yolo' })

      feed(ptys[1], codexLimit(at(15, 20)))
      manager.kill('plain')
      vi.advanceTimersByTime(USAGE_LIMIT_QUIET_MS)
      expect(scheduler.pendingIds()).toEqual([])
    } finally {
      scheduler.dispose()
      manager.dispose()
    }
  })
})
