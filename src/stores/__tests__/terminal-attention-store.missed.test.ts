/**
 * T0735 (D203): a wait for the user that ends before the user looked at the tab leaves a "missed"
 * mark (faded ⚠️). Looked at = the tab is the active tab while the window has focus.
 *
 * - ended unseen → missed; ended while looked at → cleared
 * - missed, then the tab becomes active in a focused window → cleared
 * - the window had no focus when it ended → missed; focus back with the tab active → cleared
 * - a PTY exit ends a wait too; a closed tab is forgotten (`retainTerminals`)
 * - waiting again → solid (the miss goes); the time is this renderer's clock at the wait's start
 * - `nextWaitMemory` / `waitingSummary`: solid wins over faded in a summary
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTerminalAttention,
  getMissedWait,
  resetTerminalAttention,
  retainTerminals,
  setTerminalAttention,
  setViewingState,
} from '../terminal-attention-store'
import {
  nextWaitMemory,
  waitingClickTarget,
  waitingMarkKind,
  waitingSummary,
  type MissedWait,
  type TerminalAttentionEvent,
} from '../../lib/terminal-attention'

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const START = new Date(2026, 10, 1, 13, 30).getTime()

beforeEach(() => {
  resetTerminalAttention()
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
  resetTerminalAttention()
})

/** A wait that main says began long ago (its time is never used: the renderer's clock is). */
function startWait(id: string) {
  setTerminalAttention(ev(id, { blockedReason: 'question', blockedSince: 1 }))
  vi.setSystemTime(START + 90_000)
}

describe('missed waits (D203)', () => {
  it('ended while nobody looked → missed, with the renderer time the wait began', () => {
    setViewingState('other', true)
    startWait('tower')
    expect(getMissedWait('tower')).toBeNull() // still waiting: solid, not faded
    setTerminalAttention(ev('tower')) // ask-user-question-done
    expect(getMissedWait('tower')).toEqual({ reason: 'question', startedAt: START })
  })

  it('ended while the user looks at it → cleared at once', () => {
    setViewingState('tower', true)
    startWait('tower')
    setTerminalAttention(ev('tower', { busy: true })) // answered, the turn goes on
    expect(getMissedWait('tower')).toBeNull()
  })

  it('missed, then the tab becomes active in a focused window → cleared', () => {
    setViewingState('other', true)
    startWait('tower')
    setTerminalAttention(ev('tower'))
    expect(getMissedWait('tower')).not.toBeNull()
    setViewingState('other', true) // switching workspaces alone does not count
    expect(getMissedWait('tower')).not.toBeNull()
    setViewingState('tower', true)
    expect(getMissedWait('tower')).toBeNull()
  })

  it('the window had no focus when it ended → missed; focus back with the tab active → cleared', () => {
    setViewingState('tower', true)
    startWait('tower')
    setViewingState('tower', false) // the user left the BAT window
    setTerminalAttention(ev('tower'))
    expect(getMissedWait('tower')).not.toBeNull()
    setViewingState('other', true) // focus back on another tab
    expect(getMissedWait('tower')).not.toBeNull()
    setViewingState('tower', true)
    expect(getMissedWait('tower')).toBeNull()
  })

  it('a PTY exit ends a wait (missed when unseen); a closed tab is forgotten', () => {
    startWait('codex')
    clearTerminalAttention('codex')
    expect(getMissedWait('codex')).toEqual({ reason: 'question', startedAt: START })
    retainTerminals(['other'])
    expect(getMissedWait('codex')).toBeNull()
  })

  it('waiting again → solid (the miss goes); ? / ✓ / ↻ states never make a miss', () => {
    startWait('w')
    setTerminalAttention(ev('w'))
    expect(getMissedWait('w')).not.toBeNull()
    setTerminalAttention(ev('w', { blockedReason: 'permission', blockedSince: 2 }))
    expect(getMissedWait('w')).toBeNull()
    // the Tower's questions (?) and a turn (↻) are no wait for the user
    setTerminalAttention(ev('asker', { blockedReason: 'tower', blockedSince: 1, pendingQuestions: 1 }))
    setTerminalAttention(ev('asker'))
    setTerminalAttention(ev('busy', { busy: true }))
    setTerminalAttention(ev('busy'))
    expect(getMissedWait('asker')).toBeNull()
    expect(getMissedWait('busy')).toBeNull()
  })

  it('a wait whose start this window did not see (reloaded window) leaves no miss', () => {
    // first event this window gets is already "waiting": counted from now
    setTerminalAttention(ev('x', { blockedReason: 'elicitation', blockedSince: 1 }))
    resetTerminalAttention()
    setTerminalAttention(ev('x')) // only the end seen
    expect(getMissedWait('x')).toBeNull()
  })
})

describe('nextWaitMemory / summary (D203 ④)', () => {
  const waiting = ev('t', { blockedReason: 'input', blockedSince: 5 })
  it('start, end unseen, end seen, unchanged', () => {
    const empty = { startedAt: null, missed: null }
    const started = nextWaitMemory(empty, null, waiting, false, 100)
    expect(started).toEqual({ startedAt: 100, missed: null })
    expect(nextWaitMemory(started, waiting, ev('t', { blockedReason: 'question' }), false, 200)).toBe(started)
    expect(nextWaitMemory(started, waiting, null, false, 300)).toEqual({ startedAt: null, missed: { reason: 'input', startedAt: 100 } })
    expect(nextWaitMemory(started, waiting, null, true, 300)).toEqual({ startedAt: null, missed: null })
    expect(nextWaitMemory(empty, null, ev('t', { busy: true }), false, 300)).toBe(empty)
  })

  it('solid wins over faded; the number counts waiting tabs only; the click target', () => {
    const terminals = [
      { id: 'a1', workspaceId: 'A', title: 'A one' },
      { id: 'a2', workspaceId: 'A', title: 'A two' },
      { id: 'b1', workspaceId: 'B', title: 'B one' },
      { id: 'b2', workspaceId: 'B', title: 'B two' },
    ]
    const states = new Map([['a1', ev('a1', { blockedReason: 'permission', blockedSince: 9 })]])
    const misses = new Map<string, MissedWait>([
      ['a2', { reason: 'question', startedAt: 1 }],
      ['b1', { reason: 'question', startedAt: 20 }],
      ['b2', { reason: 'input', startedAt: 10 }],
    ])
    const summary = waitingSummary(terminals, [{ id: 'A', name: 'e2e-a' }, { id: 'B', name: 'e2e-b', alias: 'B alias' }], id => states.get(id), id => misses.get(id))
    expect(summary.total).toBe(1)
    expect(summary.missedTotal).toBe(3)
    expect(waitingMarkKind(summary.total, summary.missedTotal)).toBe('waiting')
    const [a, b] = summary.workspaces
    expect(waitingMarkKind(a.tabs.length, a.missed.length)).toBe('waiting')
    expect(waitingClickTarget(a)?.id).toBe('a1') // a waiting tab before any missed one
    expect(b.name).toBe('B alias')
    expect(waitingMarkKind(b.tabs.length, b.missed.length)).toBe('missed')
    expect(waitingClickTarget(b)?.id).toBe('b2') // earliest wait first
    expect(waitingMarkKind(0, 0)).toBeNull()
    // a tab that waits again is not shown as missed
    states.set('b2', ev('b2', { blockedReason: 'input', blockedSince: 30 }))
    const again = waitingSummary(terminals, [{ id: 'B', name: 'e2e-b' }], id => states.get(id), id => misses.get(id))
    expect(again.workspaces[0].tabs.map(t => t.id)).toEqual(['b2'])
    expect(again.workspaces[0].missed.map(t => t.id)).toEqual(['b1'])
  })
})
