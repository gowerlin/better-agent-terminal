// @vitest-environment node
/**
 * T0609 (BUG-153): `terminal:attention-changed` (electron/terminal-attention.ts) on a real PtyManager
 * (fake node-pty) + the real tower-question store, with a manual clock (no vitest fake timers).
 *
 *   - precedence (as `terminal:get-state`): a hook reason over `tower`; pendingQuestions / questionsSince
 *   - hook blocked → sent; same reason again → not resent; user input / PTY exit → empty state
 *   - ask (blocking / not) → sent; answer / cancel / worker exit → empty; expiry (timeout /
 *     not-polled) is sent by the store's own timer, without any query
 *   - one microtask coalesces several changes; nothing is sent for an unchanged state
 *   - D155: no event / log line carries a question, an option, a detail or an answer
 *   - tracker / store listeners that throw change nothing; dispose stops sending
 *   - main.ts / headless wiring (source guard)
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-attention / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import { ATTENTION_CHANGED_CHANNEL, computeTerminalAttention, TerminalAttentionNotifier } from '../terminal-attention'
import { TerminalBlockedTracker } from '../terminal-blocked-state'
import { QUESTION_DEFAULT_EXPIRES_MS, QUESTION_POLL_LEASE_MS, registerTowerQuestionHandlers, type TowerQuestionHandlers } from '../tower-questions'
import type { TerminalAttentionEvent } from '../../src/lib/terminal-attention'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
const CWD = os.tmpdir()
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
const QUESTION = 'QTEXT-T0609-要部署到哪個環境？'
const OPTION = 'OPT-T0609-staging'
const DETAIL = 'DETAIL-T0609-影響 2 個檔案'
const ANSWER = 'ANSWER-T0609-先用 staging'

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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0609-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

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
    async advance(ms: number) {
      const end = t + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        t = Math.max(t, due[1].at)
        due[1].fn()
      }
      t = end
      await settle()
    },
    get timers() { return timers.size },
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve))

/** Tower `tw` with Workers `wk` / `wk2`, wired as main.ts does (PTY exit, recovery, blocked, questions). */
function setup() {
  const clock = makeClock()
  const registry = new HelperCapabilityRegistry()
  const sent: TerminalAttentionEvent[] = []
  const emit = vi.fn((channel: string, payload: unknown) => {
    expect(channel).toBe(ATTENTION_CHANGED_CHANNEL)
    sent.push(payload as TerminalAttentionEvent)
    return 1
  })
  let store: TowerQuestionHandlers | null = null
  let notifier: TerminalAttentionNotifier | null = null
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => {
      registry.revokeTerminal(id)
      store?.terminalEnded(id)
    },
    onServerRecovery: () => store?.serverRecovered(),
    onBlockedChange: id => notifier?.refresh(id),
  })
  managers.push(manager)
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  store = registerTowerQuestionHandlers({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getPtyManager: () => manager,
    isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
    logger: { log: (...args: unknown[]) => { logs.push(args.map(String).join(' ')) } },
    bootId: 'aaaabbbb',
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onChange: id => notifier?.refresh(id),
  })
  const questions = store
  notifier = new TerminalAttentionNotifier({
    getBlockedState: id => manager.getBlockedState(id),
    getQuestionSummary: id => questions.summaryFor(id),
    emit,
    logger,
  })
  const create = (id: string, towerId?: string) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({ id, ...TAB, ...(towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: towerId, CT_MODE: 'yolo' } } : {}) })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  create('tw')
  create('wk', 'tw')
  create('wk2', 'tw')
  const exit = (id: string) => {
    const onExit = fakes.get(id)!.onExit.mock.calls.at(-1)![0] as (e: { exitCode: number }) => void
    onExit({ exitCode: 0 })
  }
  const worker = (terminalId: string): HandlerContext => ({ windowId: null, connectionId: `c-${terminalId}`, helper: { terminalId, role: 'worker', towerId: 'tw' } })
  const tower: HandlerContext = { windowId: null, connectionId: 'c-tw', helper: { terminalId: 'tw', role: 'tower' } }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Record<string, unknown>
  const ask = (id: string, body: Record<string, unknown> = {}) =>
    call('question:ask', worker(id), { question: QUESTION, options: [OPTION], detail: DETAIL, ...body })
  return { clock, manager, store: questions, notifier: notifier!, sent, emit, exit, call, ask, worker, tower }
}

const of = (sent: TerminalAttentionEvent[], id: string) => sent.filter(e => e.id === id)

describe('computeTerminalAttention', () => {
  it('a hook reason over tower; tower from a blocking question; counts and times', () => {
    const blocked = { reason: 'permission' as const, since: 5, event: 'permission-request' as const }
    expect(computeTerminalAttention('a', null, null)).toEqual({ id: 'a', pendingQuestions: 0 })
    expect(computeTerminalAttention('a', blocked, { pending: 2, blockingSince: 3, pendingSince: 1 }))
      .toEqual({ id: 'a', blockedReason: 'permission', blockedSince: 5, pendingQuestions: 2, questionsSince: 1 })
    expect(computeTerminalAttention('a', null, { pending: 1, blockingSince: 3, pendingSince: 3 }))
      .toEqual({ id: 'a', blockedReason: 'tower', blockedSince: 3, pendingQuestions: 1, questionsSince: 3 })
    // non-blocking only: no blockedReason, still pending
    expect(computeTerminalAttention('a', null, { pending: 1, blockingSince: null, pendingSince: 9 }))
      .toEqual({ id: 'a', pendingQuestions: 1, questionsSince: 9 })
  })
})

describe('hook blocked → terminal:attention-changed (T0609)', () => {
  it('blocked is sent once; another reason is sent; the user input clears it', async () => {
    const h = setup()
    h.manager.reportHookEvent('wk', 'permission-request', 'Bash')
    await settle()
    expect(of(h.sent, 'wk')).toEqual([{ id: 'wk', blockedReason: 'permission', blockedSince: expect.any(Number), pendingQuestions: 0 }])
    h.manager.reportHookEvent('wk', 'permission-request', 'Bash') // unchanged
    await settle()
    expect(of(h.sent, 'wk')).toHaveLength(1)
    h.manager.reportHookEvent('wk', 'elicitation')
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toMatchObject({ blockedReason: 'elicitation' })
    h.manager.noteUserInput('wk')
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    // nothing more when nothing changed
    h.manager.noteUserInput('wk')
    await settle()
    expect(of(h.sent, 'wk')).toHaveLength(3)
    expect(logs.some(l => l.includes('[attention] terminal=wk → blocked reason=permission pendingQuestions=0 windows=1'))).toBe(true)
    expect(logs.some(l => l.includes('[attention] terminal=wk → none windows=1'))).toBe(true)
  })

  it('the PTY ending clears it; a hook `stop` clears it', async () => {
    const h = setup()
    h.manager.reportHookEvent('wk', 'ask-user-question')
    h.manager.reportHookEvent('wk2', 'ask-user-question')
    await settle()
    expect(h.sent.map(e => [e.id, e.blockedReason])).toEqual([['wk', 'question'], ['wk2', 'question']])
    h.manager.reportHookEvent('wk', 'stop')
    h.exit('wk2')
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(of(h.sent, 'wk2').at(-1)).toEqual({ id: 'wk2', pendingQuestions: 0 })
  })

  it('several changes in one tick → one event with the final state', async () => {
    const h = setup()
    h.manager.reportHookEvent('wk', 'permission-request')
    h.manager.noteUserInput('wk')
    h.manager.reportHookEvent('wk', 'elicitation')
    await settle()
    expect(of(h.sent, 'wk')).toEqual([{ id: 'wk', blockedReason: 'elicitation', blockedSince: expect.any(Number), pendingQuestions: 0 }])
  })
})

describe('tower questions → terminal:attention-changed (T0609)', () => {
  it('ask → tower; a hook prompt meanwhile wins; cleared → tower again; answer → empty', async () => {
    const h = setup()
    const asked = h.ask('wk')
    expect(asked).toMatchObject({ ok: true })
    await settle()
    const t0 = h.clock.now()
    expect(of(h.sent, 'wk')).toEqual([{ id: 'wk', blockedReason: 'tower', blockedSince: t0, pendingQuestions: 1, questionsSince: t0 }])
    h.manager.reportHookEvent('wk', 'permission-request')
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toMatchObject({ blockedReason: 'permission', pendingQuestions: 1 })
    // the user's input clears the hook reason only (T0607: not the question)
    h.manager.noteUserInput('wk')
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toMatchObject({ blockedReason: 'tower', pendingQuestions: 1 })
    expect(h.call('question:answer', h.tower, { towerId: 'tw', questionId: asked.questionId, text: ANSWER })).toMatchObject({ ok: true })
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(h.sent.some(e => e.id === 'tw')).toBe(false)
  })

  it('a non-blocking question → pending only; cancel → empty; a Worker exit cancels → empty', async () => {
    const h = setup()
    const q = h.ask('wk', { blocking: false })
    await settle()
    expect(of(h.sent, 'wk')).toEqual([{ id: 'wk', pendingQuestions: 1, questionsSince: h.clock.now() }])
    expect(h.call('question:cancel', h.worker('wk'), { questionId: q.questionId })).toMatchObject({ ok: true, status: 'cancelled' })
    await settle()
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    h.ask('wk2')
    await settle()
    h.exit('wk2')
    await settle()
    expect(of(h.sent, 'wk2').map(e => e.blockedReason ?? 'none')).toEqual(['tower', 'none'])
  })

  it('expiry is sent by the store timer, without a query: not-polled, then timeout', async () => {
    const h = setup()
    h.ask('wk') // blocking: nobody waits → not-polled after the lease
    h.ask('wk2', { blocking: false, expiresInMs: QUESTION_POLL_LEASE_MS * 3 })
    await settle()
    expect(h.sent.map(e => e.id)).toEqual(['wk', 'wk2'])
    await h.clock.advance(QUESTION_POLL_LEASE_MS)
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
    expect(of(h.sent, 'wk2')).toHaveLength(1)
    await h.clock.advance(QUESTION_POLL_LEASE_MS * 2)
    expect(of(h.sent, 'wk2').at(-1)).toEqual({ id: 'wk2', pendingQuestions: 0 })
    expect(h.clock.timers).toBe(0)
  })

  it('a Worker that keeps waiting keeps its question; its timeout is still sent', async () => {
    const h = setup()
    const q = h.ask('wk', { expiresInMs: QUESTION_DEFAULT_EXPIRES_MS })
    await settle()
    // an open question:wait of the asking Worker keeps the lease
    const wait = Promise.resolve(h.call('question:wait', h.worker('wk'), { questionId: q.questionId, timeoutMs: 45_000 }))
    await h.clock.advance(QUESTION_POLL_LEASE_MS + 1_000)
    expect(of(h.sent, 'wk')).toHaveLength(1)
    await wait
    // the lease restarted when the wait ended: the store timer sees `not-polled` without a query
    await h.clock.advance(QUESTION_POLL_LEASE_MS)
    expect(of(h.sent, 'wk').at(-1)).toEqual({ id: 'wk', pendingQuestions: 0 })
  })

  it('D155: no event and no [attention] line carries the content', async () => {
    const h = setup()
    const q = h.ask('wk')
    h.manager.reportHookEvent('wk', 'permission-request', 'Bash')
    await settle()
    h.call('question:answer', h.tower, { towerId: 'tw', questionId: q.questionId, text: ANSWER })
    await settle()
    const text = JSON.stringify([h.sent, logs.filter(l => l.includes('[attention]'))])
    for (const secret of [QUESTION, OPTION, DETAIL, ANSWER, 'Bash']) expect(text).not.toContain(secret)
    for (const event of h.sent) {
      expect(Object.keys(event).every(k => ['id', 'blockedReason', 'blockedSince', 'pendingQuestions', 'questionsSince'].includes(k))).toBe(true)
    }
  })

  it('dispose: nothing more is sent', async () => {
    const h = setup()
    h.notifier.dispose()
    h.ask('wk')
    h.manager.reportHookEvent('wk2', 'permission-request')
    await settle()
    expect(h.emit).not.toHaveBeenCalled()
  })
})

describe('listeners that throw', () => {
  it('the blocked tracker still reports and clears', () => {
    const lines: string[] = []
    const tracker = new TerminalBlockedTracker({ log: m => { lines.push(m) } }, () => 1, () => { throw new Error('boom') })
    expect(tracker.report('a', 'permission-request').result).toBe('blocked')
    expect(tracker.clear('a', 'test')).toBe(true)
    expect(lines.filter(l => l.includes('onChange listener failed'))).toHaveLength(2)
  })

  it('the question store still answers', () => {
    const registry = new HelperCapabilityRegistry()
    registry.issue('wk', { towerId: 'tw' })
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const pm = { getTerminalInfo: () => ({}), getExitedPty: () => null, getTerminalRole: () => undefined }
    registerTowerQuestionHandlers({
      registerHandler: (c, fn) => { handlers.set(c, fn) },
      getPtyManager: () => pm,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      logger: { log: () => {} },
      setTimer: () => 1,
      clearTimer: () => {},
      onChange: () => { throw new Error('boom') },
    })
    const ctx: HandlerContext = { windowId: null, connectionId: 'c', helper: { terminalId: 'wk', role: 'worker', towerId: 'tw' } }
    expect(handlers.get('question:ask')!(ctx, { question: 'x' })).toMatchObject({ ok: true })
  })
})

describe('wiring (source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')
  const headless = fs.readFileSync(path.resolve(__dirname, '..', 'remote', 'headless-entry.ts'), 'utf8')

  it('Electron main: blocked + questions → the notifier → every window and broadcastHub (terminalEmit)', () => {
    expect(main).toContain('onBlockedChange: (id) => terminalAttention?.refresh(id)')
    expect(main).toContain('onChange: (workerId) => terminalAttention?.refresh(workerId)')
    expect(main).toMatch(/terminalAttention = new TerminalAttentionNotifier\(\{[^}]*emit: terminalEmit,/)
    expect(main).toContain('terminalAttention?.dispose()')
  })

  it('headless: the pty module\'s blocked changes and the question store feed the notifier → host.emit', () => {
    expect(headless).toContain('onChange: workerId => attention?.refresh(workerId)')
    expect(headless).toContain('const unsubscribeBlocked = opts.onBlockedChange?.(id => notifier.refresh(id))')
    expect(headless).toContain('emit: (channel, payload) => host.emit(channel, payload),')
    expect(headless).toContain('for (const listener of [...blockedChangeListeners]) listener(id)')
  })
})
