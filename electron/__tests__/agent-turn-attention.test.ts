// @vitest-environment node
/**
 * T0694 (D180): the agent's turn in main — `TerminalBlockedTracker` (claude hook `user-prompt-submit` →
 * `stop`, codex OSC 7501 `working` → `idle` / `clear`, the quiet fallback, the PTY ending, the
 * Terminal Server recovery) and its push: `terminal:attention-changed` carries `busy: true` while a
 * turn runs (Electron main and headless wire `PtyManager.isAgentTurnActive` the same way).
 *
 *   - tracker: transitions, logs, `onChange`, `report` results unchanged (the report-hook contract)
 *   - codex: working starts, blocked keeps, idle / clear end; a hook tab ignores the sequence
 *   - quiet fallback: no output for `AGENT_TURN_QUIET_END_MS` ends it; output keeps it; never while blocked
 *   - PtyManager + notifier: busy sent / cleared, with blocked, PTY exit, a `none` tab never busy
 *   - D155: the event carries state fields only
 *   - `BATCH_CLOSE_RECENT_OUTPUT_MS` (renderer) = `CLOSE_WORKER_IDLE_MS` (main)
 *   - wiring (source guard): main.ts and headless pass `isTurnActive`
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-blocked-state / terminal-attention / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { CLOSE_WORKER_IDLE_MS } from '../close-worker'
import { ATTENTION_CHANGED_CHANNEL, computeTerminalAttention, TerminalAttentionNotifier } from '../terminal-attention'
import { AGENT_TURN_QUIET_END_MS, TerminalBlockedTracker } from '../terminal-blocked-state'
import { CODEX_OSC_PREFIX } from '../../src/lib/codex-terminal-state'
import { BATCH_CLOSE_RECENT_OUTPUT_MS, isEmptyAttention, type TerminalAttentionEvent } from '../../src/lib/terminal-attention'

/** A manual clock with timers (no vitest fake timers). */
function makeClock(start = 1_000_000) {
  let t = start
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number): unknown => {
      const id = ++seq
      timers.set(id, { at: t + ms, fn })
      return id
    },
    clearTimer: (handle: unknown) => { timers.delete(handle as number) },
    advance(ms: number) {
      const end = t + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        t = Math.max(t, due[1].at)
        due[1].fn()
      }
      t = end
    },
    set: (ms: number) => { t = ms },
    get timers() { return timers.size },
  }
}

function makeTracker(quietEndMs?: number) {
  const clock = makeClock()
  const lines: string[] = []
  const changes: string[] = []
  const lastOutput = new Map<string, number>()
  const tr = new TerminalBlockedTracker(
    { log: m => { lines.push(m) } },
    clock.now,
    id => { changes.push(id) },
    undefined,
    {
      ...(quietEndMs !== undefined ? { quietEndMs } : {}),
      lastOutputAt: id => lastOutput.get(id) ?? null,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    },
  )
  const output = (id: string) => { lastOutput.set(id, clock.now()) }
  return { tr, clock, lines, changes, output }
}

describe('TerminalBlockedTracker: the agent turn (T0694)', () => {
  it('claude: user-prompt-submit starts, stop ends; repeated events change nothing; logged and announced', () => {
    const { tr, lines, changes } = makeTracker()
    expect(tr.isTurnActive('a')).toBe(false)
    // the report-hook result stays about `blocked` (contract unchanged)
    expect(tr.report('a', 'user-prompt-submit')).toEqual({ result: 'unchanged', state: null })
    expect(tr.isTurnActive('a')).toBe(true)
    expect(tr.report('a', 'user-prompt-submit')).toEqual({ result: 'unchanged', state: null })
    expect(tr.report('a', 'stop')).toEqual({ result: 'unchanged', state: null })
    expect(tr.isTurnActive('a')).toBe(false)
    expect(tr.report('a', 'stop')).toEqual({ result: 'unchanged', state: null })
    expect(lines).toEqual([
      '[turn] terminal=a → started (hook user-prompt-submit)',
      '[turn] terminal=a → ended (hook stop)',
    ])
    expect(changes).toEqual(['a', 'a'])
  })

  it('claude: a prompt during the turn is blocked → the turn goes on; stop ends both', () => {
    const { tr } = makeTracker()
    tr.report('a', 'user-prompt-submit')
    expect(tr.report('a', 'permission-request', 'Bash').result).toBe('blocked')
    expect(tr.isTurnActive('a')).toBe(true)
    tr.clearForUserInput('a') // the user answers by keyboard
    expect(tr.isTurnActive('a')).toBe(true)
    expect(tr.report('a', 'stop')).toEqual({ result: 'unchanged', state: null })
    expect(tr.isTurnActive('a')).toBe(false)
  })

  it('session-start and the other hook events neither start nor end a turn', () => {
    const { tr } = makeTracker()
    for (const event of ['session-start', 'permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch'] as const) {
      tr.report('a', event)
      expect(tr.isTurnActive('a')).toBe(false)
    }
    tr.report('b', 'user-prompt-submit')
    for (const event of ['session-start', 'permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch'] as const) {
      tr.report('b', event)
      expect(tr.isTurnActive('b')).toBe(true)
    }
  })

  it('codex OSC: working starts; blocked keeps it; idle / clear end it; logged', () => {
    const { tr, lines } = makeTracker()
    tr.observeCodexState('c', 'idle')
    expect(tr.isTurnActive('c')).toBe(false)
    tr.observeCodexState('c', 'working')
    expect(tr.isTurnActive('c')).toBe(true)
    tr.observeCodexState('c', 'blocked')
    expect(tr.isTurnActive('c')).toBe(true)
    tr.observeCodexState('c', 'working')
    expect(tr.isTurnActive('c')).toBe(true)
    tr.observeCodexState('c', 'idle')
    expect(tr.isTurnActive('c')).toBe(false)
    tr.observeCodexState('c', 'working')
    tr.observeCodexState('c', 'clear')
    expect(tr.isTurnActive('c')).toBe(false)
    expect(lines.filter(l => l.startsWith('[turn]'))).toEqual([
      '[turn] terminal=c → started (osc working)',
      '[turn] terminal=c → ended (osc idle)',
      '[turn] terminal=c → started (osc working)',
      '[turn] terminal=c → ended (osc clear)',
    ])
  })

  it('codex: a hook tab ignores the sequence', () => {
    const { tr } = makeTracker()
    tr.report('h', 'session-start')
    expect(tr.observeCodexState('h', 'working')).toBe('ignored')
    expect(tr.isTurnActive('h')).toBe(false)
    tr.report('h', 'user-prompt-submit')
    expect(tr.observeCodexState('h', 'idle')).toBe('ignored')
    expect(tr.isTurnActive('h')).toBe(true)
  })

  it('the PTY ending (clearStarted), the Terminal Server recovery (clearAll) and dispose end it', () => {
    const { tr, clock, lines } = makeTracker()
    tr.report('a', 'user-prompt-submit')
    tr.report('b', 'user-prompt-submit')
    tr.observeCodexState('c', 'working')
    expect(clock.timers).toBe(3)
    tr.clearStarted('a')
    expect(tr.isTurnActive('a')).toBe(false)
    tr.clearAll('Terminal Server recovery')
    expect(tr.isTurnActive('b')).toBe(false)
    expect(tr.isTurnActive('c')).toBe(false)
    expect(clock.timers).toBe(0)
    expect(lines.filter(l => l.startsWith('[turn]') && l.includes('ended'))).toEqual([
      '[turn] terminal=a → ended (the PTY ended)',
      '[turn] terminal=b → ended (Terminal Server recovery)',
      '[turn] terminal=c → ended (Terminal Server recovery)',
    ])
    tr.report('d', 'user-prompt-submit')
    tr.dispose()
    expect(tr.isTurnActive('d')).toBe(false)
    expect(clock.timers).toBe(0)
  })

  it('a throwing onChange listener changes nothing', () => {
    const lines: string[] = []
    const tr = new TerminalBlockedTracker({ log: m => { lines.push(m) } }, () => 1, () => { throw new Error('boom') }, undefined, { quietEndMs: 0 })
    tr.report('a', 'user-prompt-submit')
    expect(tr.isTurnActive('a')).toBe(true)
    tr.report('a', 'stop')
    expect(tr.isTurnActive('a')).toBe(false)
    expect(lines.filter(l => l.includes('onChange listener failed'))).toHaveLength(2)
  })
})

describe('the quiet fallback (T0694 step 0: claude runs no Stop on Esc, StopFailure on an API error)', () => {
  it('the default is AGENT_TURN_QUIET_END_MS = 60 s', () => {
    expect(AGENT_TURN_QUIET_END_MS).toBe(60_000)
    const { tr, clock, lines } = makeTracker()
    tr.report('a', 'user-prompt-submit')
    clock.advance(AGENT_TURN_QUIET_END_MS - 1)
    expect(tr.isTurnActive('a')).toBe(true)
    clock.advance(1)
    expect(tr.isTurnActive('a')).toBe(false)
    expect(lines.at(-1)).toBe('[turn] terminal=a → ended (no output for 60000ms)')
    expect(clock.timers).toBe(0)
  })

  it('output keeps the turn; the silence counts from the last output', () => {
    const { tr, clock, output } = makeTracker(10_000)
    tr.report('a', 'user-prompt-submit')
    for (let i = 0; i < 10; i++) {
      clock.advance(5_000)
      output('a')
    }
    expect(tr.isTurnActive('a')).toBe(true)
    clock.advance(9_999)
    expect(tr.isTurnActive('a')).toBe(true)
    clock.advance(1)
    expect(tr.isTurnActive('a')).toBe(false)
  })

  it('output from before the turn does not count', () => {
    const { tr, clock, output } = makeTracker(10_000)
    output('a')
    clock.advance(60_000)
    tr.report('a', 'user-prompt-submit')
    clock.advance(9_999)
    expect(tr.isTurnActive('a')).toBe(true)
    clock.advance(1)
    expect(tr.isTurnActive('a')).toBe(false)
  })

  it('never while blocked (a prompt waits for the user inside the turn); after it, the silence counts again', () => {
    const { tr, clock, output } = makeTracker(10_000)
    tr.report('a', 'user-prompt-submit')
    tr.report('a', 'permission-request', 'Bash')
    clock.advance(100_000)
    expect(tr.isTurnActive('a')).toBe(true)
    tr.clearForUserInput('a')
    output('a')
    clock.advance(9_999)
    expect(tr.isTurnActive('a')).toBe(true)
    clock.advance(10_001)
    expect(tr.isTurnActive('a')).toBe(false)
  })

  it('codex input (blocked) also holds it', () => {
    const { tr, clock } = makeTracker(10_000)
    tr.observeCodexState('c', 'working')
    tr.observeCodexState('c', 'blocked')
    clock.advance(100_000)
    expect(tr.isTurnActive('c')).toBe(true)
  })

  it('quietEndMs 0 = no fallback; a turn ended by its signal leaves no timer', () => {
    const off = makeTracker(0)
    off.tr.report('a', 'user-prompt-submit')
    expect(off.clock.timers).toBe(0)
    off.clock.advance(10 * AGENT_TURN_QUIET_END_MS)
    expect(off.tr.isTurnActive('a')).toBe(true)
    const on = makeTracker()
    on.tr.report('a', 'user-prompt-submit')
    expect(on.clock.timers).toBe(1)
    on.tr.report('a', 'stop')
    expect(on.clock.timers).toBe(0)
  })

  it('a throwing lastOutputAt falls back to the turn start', () => {
    const clock = makeClock()
    const tr = new TerminalBlockedTracker(undefined, clock.now, undefined, undefined, {
      quietEndMs: 1_000,
      lastOutputAt: () => { throw new Error('boom') },
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    })
    tr.report('a', 'user-prompt-submit')
    clock.advance(1_000)
    expect(tr.isTurnActive('a')).toBe(false)
  })
})

describe('computeTerminalAttention / isEmptyAttention with busy (T0694)', () => {
  it('busy only when true; a busy-only event is not empty', () => {
    expect(computeTerminalAttention('a', null, null)).toEqual({ id: 'a', pendingQuestions: 0 })
    expect(computeTerminalAttention('a', null, null, false)).toEqual({ id: 'a', pendingQuestions: 0 })
    expect(computeTerminalAttention('a', null, null, true)).toEqual({ id: 'a', pendingQuestions: 0, busy: true })
    expect(computeTerminalAttention('a', { reason: 'permission', since: 5, event: 'permission-request' }, null, true))
      .toEqual({ id: 'a', blockedReason: 'permission', blockedSince: 5, pendingQuestions: 0, busy: true })
    expect(isEmptyAttention({ id: 'a', pendingQuestions: 0, busy: true })).toBe(false)
    expect(isEmptyAttention({ id: 'a', pendingQuestions: 0 })).toBe(true)
  })

  it('d2: the renderer\'s "still printing" window is main\'s CLOSE_WORKER_IDLE_MS', () => {
    expect(BATCH_CLOSE_RECENT_OUTPUT_MS).toBe(CLOSE_WORKER_IDLE_MS)
  })
})

// ── PtyManager (fake node-pty) + the notifier, wired as main.ts / headless do ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
const TAB = { cwd: os.tmpdir(), type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let dataDir: string
const managers: PtyManagerType[] = []
const logs: string[] = []

beforeEach(() => {
  logs.length = 0
  vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0694-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const settle = () => new Promise(resolve => setImmediate(resolve))

function setup() {
  const sent: TerminalAttentionEvent[] = []
  let notifier: TerminalAttentionNotifier | null = null
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({ emit: vi.fn(), dataDir, onBlockedChange: id => notifier?.refresh(id) })
  managers.push(manager)
  notifier = new TerminalAttentionNotifier({
    getBlockedState: id => manager.getBlockedState(id),
    isTurnActive: id => manager.isAgentTurnActive(id),
    emit: (channel, payload) => {
      expect(channel).toBe(ATTENTION_CHANGED_CHANNEL)
      sent.push(payload as TerminalAttentionEvent)
      return 1
    },
    logger,
  })
  const create = (id: string) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({ id, ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw', CT_MODE: 'yolo' } })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  const output = (id: string, data: string) => {
    const onData = fakes.get(id)!.onData.mock.calls.at(-1)![0] as (d: string) => void
    onData(data)
  }
  const exit = (id: string) => {
    const onExit = fakes.get(id)!.onExit.mock.calls.at(-1)![0] as (e: { exitCode: number }) => void
    onExit({ exitCode: 0 })
  }
  const of = (id: string) => sent.filter(e => e.id === id)
  return { manager, sent, create, output, exit, of }
}

describe('PtyManager.isAgentTurnActive → terminal:attention-changed busy (T0694)', () => {
  it('claude hooks: user-prompt-submit → busy; a prompt meanwhile keeps busy; stop → empty', async () => {
    const h = setup()
    h.create('wk')
    expect(h.manager.isAgentTurnActive('wk')).toBe(false)
    h.manager.reportHookEvent('wk', 'user-prompt-submit')
    await settle()
    expect(h.manager.isAgentTurnActive('wk')).toBe(true)
    expect(h.of('wk')).toEqual([{ id: 'wk', pendingQuestions: 0, busy: true }])
    h.manager.reportHookEvent('wk', 'permission-request', 'Bash')
    await settle()
    expect(h.of('wk').at(-1)).toEqual({ id: 'wk', blockedReason: 'permission', blockedSince: expect.any(Number), pendingQuestions: 0, busy: true })
    h.manager.noteUserInput('wk')
    await settle()
    expect(h.of('wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0, busy: true })
    h.manager.reportHookEvent('wk', 'stop')
    await settle()
    expect(h.of('wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(h.of('wk')).toHaveLength(4)
    expect(logs.some(l => l.includes('[attention] terminal=wk → pendingQuestions=0 busy windows=1'))).toBe(true)
    expect(logs.some(l => l.includes('[turn] terminal=wk → started (hook user-prompt-submit)'))).toBe(true)
  })

  it('codex OSC in the output: working → busy, idle → empty', async () => {
    const h = setup()
    h.create('cx')
    h.output('cx', `${CODEX_OSC_PREFIX}state=working:app=codex\x07`)
    await settle()
    expect(h.of('cx')).toEqual([{ id: 'cx', pendingQuestions: 0, busy: true }])
    h.output('cx', `${CODEX_OSC_PREFIX}state=idle:app=codex\x07`)
    await settle()
    expect(h.of('cx').at(-1)).toEqual({ id: 'cx', pendingQuestions: 0 })
  })

  it('the PTY ending ends the turn → empty; a gone PTY is never busy', async () => {
    const h = setup()
    h.create('wk')
    h.manager.reportHookEvent('wk', 'user-prompt-submit')
    await settle()
    h.exit('wk')
    await settle()
    expect(h.manager.isAgentTurnActive('wk')).toBe(false)
    expect(h.of('wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(h.manager.isAgentTurnActive('nope')).toBe(false)
  })

  it('a `none` tab (no hook, no OSC) never has a turn; user input does not start one', async () => {
    const h = setup()
    h.create('sh')
    h.manager.noteUserInput('sh')
    h.output('sh', 'hello\r\n')
    await settle()
    expect(h.manager.getBlockedDetection('sh')).toBe('none')
    expect(h.manager.isAgentTurnActive('sh')).toBe(false)
    expect(h.of('sh')).toEqual([])
  })

  it('the quiet fallback reads the PTY\'s output time: output keeps the turn, a minute of silence ends it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const h = setup()
    h.create('wk')
    h.manager.reportHookEvent('wk', 'user-prompt-submit') // Esc follows: no `stop`
    await settle()
    expect(h.of('wk')).toEqual([{ id: 'wk', pendingQuestions: 0, busy: true }])
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(30_000)
      h.output('wk', '✻ Working… (esc to interrupt)')
    }
    expect(h.manager.isAgentTurnActive('wk')).toBe(true)
    vi.advanceTimersByTime(AGENT_TURN_QUIET_END_MS - 1)
    expect(h.manager.isAgentTurnActive('wk')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(h.manager.isAgentTurnActive('wk')).toBe(false)
    vi.useRealTimers()
    await settle()
    expect(h.of('wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(logs.some(l => l.includes(`[turn] terminal=wk → ended (no output for ${AGENT_TURN_QUIET_END_MS}ms)`))).toBe(true)
  })

  it('D155: the event and the [attention] / [turn] lines carry state fields only', async () => {
    const h = setup()
    h.create('wk')
    h.manager.reportHookEvent('wk', 'user-prompt-submit')
    h.output('wk', 'SECRET-T0694-output batcap.abc')
    await settle()
    for (const event of h.sent) {
      for (const key of Object.keys(event)) expect(['id', 'blockedReason', 'blockedSince', 'pendingQuestions', 'questionsSince', 'busy']).toContain(key)
    }
    expect(JSON.stringify(h.sent)).not.toContain('SECRET-T0694')
    expect(logs.filter(l => l.includes('[attention]') || l.includes('[turn]')).join('\n')).not.toContain('SECRET-T0694')
  })
})

describe('wiring (source guard, T0694)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')
  const headless = fs.readFileSync(path.resolve(__dirname, '..', 'remote', 'headless-entry.ts'), 'utf8')
  const ptyManager = fs.readFileSync(path.resolve(__dirname, '..', 'pty-manager.ts'), 'utf8')

  it('Electron main and headless both pass the turn to their notifier', () => {
    expect(main).toMatch(/terminalAttention = new TerminalAttentionNotifier\(\{[^}]*isTurnActive: id => ptyManager\?\.isAgentTurnActive\(id\) \?\? false,/)
    expect(headless).toMatch(/attention = new TerminalAttentionNotifier\(\{[^}]*isTurnActive: id => opts\.getPtyManager\(\)\?\.isAgentTurnActive\(id\) \?\? false,/)
  })

  it('PtyManager gives the tracker its output time; app-paths-bootstrap is still main\'s first import', () => {
    expect(ptyManager).toContain('{ lastOutputAt: id => this.lastOutputAt.get(id) ?? null },')
    expect(main.match(/^import .*$/m)?.[0]).toContain('app-paths-bootstrap')
  })
})
