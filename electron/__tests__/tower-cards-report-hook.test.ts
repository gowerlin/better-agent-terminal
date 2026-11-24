/**
 * PLAN-068 W3 / T0905 (T0902 §7.4, D328 R1′): `terminal:report-hook` with the new fields —
 * `origin` / `set` on every report, `lastAssistantMessage` (+ `messageTruncated`) on `stop` — against
 * the real `TerminalBlockedTracker` and `TowerCardStore`.
 *
 *   injected seen → later `plugin` reports of that PTY answer `duplicate` and change nothing
 *   the message goes to `onStop` only: never in the answer, the log or the bat-scripts mirror
 *   no T0590 regression: the answer of every report is the shape it was
 */
import { describe, expect, it } from 'vitest'
import { registerReportHookHandler, TerminalBlockedTracker, parseHookOrigin, parseHookSet, REPORT_HOOK_MESSAGE_MAX_CHARS, type HookOrigin, type HookReportEvent, type StopReport } from '../terminal-blocked-state'
import { TowerCardStore } from '../tower-cards'
import type { HandlerContext } from '../remote/handler-registry'

const MSG = 'T0905-LAST-MESSAGE 塔台回合總結'

function setup(opts: { withOrigin?: boolean; throwingOnStop?: boolean } = {}) {
  const logs: string[] = []
  const mirrored: Array<Record<string, unknown>> = []
  const stops: Array<[string, StopReport]> = []
  const tracker = new TerminalBlockedTracker({ log: m => logs.push(m) })
  const alive = new Set(['tower', 'worker'])
  const roles: Record<string, string> = { tower: 'tower' }
  const pm = {
    isAlive: (id: string) => alive.has(id),
    reportHookEvent: (id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string, at?: bigint) =>
      alive.has(id) ? tracker.report(id, event, toolName, sessionId, agentId, at) : null,
    ...(opts.withOrigin === false ? {} : { acceptHookOrigin: (id: string, origin?: HookOrigin, set?: number) => tracker.acceptHookOrigin(id, origin, set) }),
  }
  const cards = new TowerCardStore({
    getTerminalRole: id => roles[id],
    getTowerContract: id => (id === 'tower' ? 2 : undefined),
    isAlive: id => alive.has(id),
    logger: { log: (...a: unknown[]) => logs.push(a.map(String).join(' ')) },
  })
  let handler: ((ctx: HandlerContext, raw?: unknown) => unknown) | null = null
  registerReportHookHandler({
    registerHandler: (_channel, h) => { handler = h },
    getPtyManager: () => pm,
    logger: { log: (...a: unknown[]) => logs.push(a.map(String).join(' ')) },
    mirrorToBatScripts: (_event, payload) => { mirrored.push(payload) },
    onStop: (id, report) => {
      stops.push([id, report])
      if (opts.throwingOnStop) throw new Error('listener broke')
      cards.offerHookStop(id, report)
    },
  })
  const report = (terminalId: string, args: Record<string, unknown>) =>
    handler!({ windowId: null, connectionId: 'c', helper: { terminalId, role: terminalId === 'tower' ? 'tower' : 'worker' } }, args)
  return { logs, mirrored, stops, tracker, cards, alive, report }
}

describe('parseHookOrigin / parseHookSet', () => {
  it('known origins and whole numbers 1…1000 only', () => {
    expect(parseHookOrigin('injected')).toBe('injected')
    expect(parseHookOrigin('plugin')).toBe('plugin')
    expect(parseHookOrigin('other')).toBeUndefined()
    expect(parseHookOrigin(1)).toBeUndefined()
    expect(parseHookSet(2)).toBe(2)
    for (const bad of [0, -1, 1.5, '2', 1001, Number.NaN, null]) expect(parseHookSet(bad)).toBeUndefined()
  })
})

describe('terminal:report-hook + Tower turn cards (T0905)', () => {
  it('stop with the message: answer unchanged; onStop gets it; a contract-2 Tower keeps a card; no text in log / mirror / answer', () => {
    const t = setup()
    const answer = t.report('tower', { event: 'stop', lastAssistantMessage: MSG, origin: 'injected', set: 2, at: '123' })
    expect(answer).toEqual({ ok: true, terminalId: 'tower', result: 'unchanged', state: 'not-blocked' })
    expect(t.stops).toEqual([['tower', { message: { text: MSG, truncated: false }, set: 2 }]])
    expect(t.cards.list(['tower'])[0].cards.map(c => c.text)).toEqual([MSG])
    expect(t.tracker.getHookSet('tower')).toBe(2)
    const everything = JSON.stringify([t.logs, t.mirrored, answer])
    expect(everything).not.toContain('T0905-LAST-MESSAGE')
  })

  it('a Worker (not a Tower) sends one: dropped by the store, the hook answer is the same', () => {
    const t = setup()
    expect(t.report('worker', { event: 'stop', lastAssistantMessage: MSG, messageTruncated: true, origin: 'injected', set: 2 }))
      .toEqual({ ok: true, terminalId: 'worker', result: 'unchanged', state: 'not-blocked' })
    expect(t.stops).toEqual([['worker', { message: { text: MSG, truncated: true }, set: 2 }]])
    expect(t.cards.list(['worker'])[0].cards).toEqual([])
    expect(t.logs.join('\n')).not.toContain('T0905-LAST-MESSAGE')
  })

  it('the message only on stop; a non-string / too long one is ignored (no error); messageTruncated must be true exactly', () => {
    const t = setup()
    t.report('tower', { event: 'user-prompt-submit', lastAssistantMessage: 'x' })
    t.report('tower', { event: 'stop', lastAssistantMessage: 42 })
    t.report('tower', { event: 'stop', lastAssistantMessage: 'y'.repeat(REPORT_HOOK_MESSAGE_MAX_CHARS + 1) })
    t.report('tower', { event: 'stop', lastAssistantMessage: 'z', messageTruncated: 'yes', set: 'two' })
    expect(t.stops).toEqual([
      ['tower', {}],
      ['tower', {}],
      ['tower', { message: { text: 'z', truncated: false } }],
    ])
    expect(t.cards.list(['tower'])[0]).toMatchObject({ stopsWithoutMessage: 2, cards: [{ text: 'z' }] })
  })

  it('§7.4: once the injected hooks reported, a plugin report of that PTY → duplicate, nothing applied', () => {
    const t = setup()
    t.report('tower', { event: 'session-start', origin: 'injected', set: 2 })
    const dup = t.report('tower', { event: 'user-prompt-submit', origin: 'plugin', set: 1 })
    expect(dup).toEqual({ ok: true, terminalId: 'tower', result: 'duplicate' })
    expect(t.tracker.isTurnActive('tower')).toBe(false)
    expect(t.tracker.getHookSet('tower')).toBe(2)
    t.report('tower', { event: 'stop', origin: 'plugin', lastAssistantMessage: MSG })
    expect(t.stops).toEqual([])
    t.report('tower', { event: 'permission-request', origin: 'plugin' })
    expect(t.tracker.get('tower')).toBeNull()
    expect(t.logs.filter(l => l.includes('plugin reports dropped'))).toHaveLength(1)
    expect(t.mirrored.filter(m => m.result === 'duplicate')).toHaveLength(3)
  })

  it('§7.4: plugin reports before any injected one are applied; an unknown / absent origin counts as injected', () => {
    const t = setup()
    expect(t.report('tower', { event: 'user-prompt-submit', origin: 'plugin' })).toMatchObject({ ok: true, result: 'unchanged' })
    expect(t.tracker.isTurnActive('tower')).toBe(true)
    t.report('tower', { event: 'stop', origin: 'bogus' }) // = injected
    expect(t.report('tower', { event: 'user-prompt-submit', origin: 'plugin' })).toMatchObject({ result: 'duplicate' })
  })

  it('the PTY ending forgets the origins (a new claude in the restarted tab starts fresh)', () => {
    const t = setup()
    t.report('tower', { event: 'stop', origin: 'injected' })
    expect(t.tracker.acceptHookOrigin('tower', 'plugin')).toBe(false)
    t.tracker.clearStarted('tower')
    expect(t.tracker.acceptHookOrigin('tower', 'plugin')).toBe(true)
    t.tracker.clearAll('recovery')
    expect(t.tracker.getHookSet('tower')).toBeNull()
  })

  it('a PtyManager without acceptHookOrigin (as before T0905) applies every report', () => {
    const t = setup({ withOrigin: false })
    t.report('tower', { event: 'stop', origin: 'injected' })
    expect(t.report('tower', { event: 'user-prompt-submit', origin: 'plugin' })).toMatchObject({ result: 'unchanged' })
  })

  it('a throwing onStop is logged; the answer is unchanged', () => {
    const t = setup({ throwingOnStop: true })
    expect(t.report('tower', { event: 'stop', lastAssistantMessage: MSG })).toEqual({ ok: true, terminalId: 'tower', result: 'unchanged', state: 'not-blocked' })
    expect(t.logs.join('\n')).toContain('[tower-cards] onStop failed terminal=tower: listener broke')
  })

  it('a PTY that does not run → NOT_FOUND as before (no onStop)', () => {
    const t = setup()
    t.alive.delete('tower')
    expect(t.report('tower', { event: 'stop', lastAssistantMessage: MSG })).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(t.stops).toEqual([])
  })
})
