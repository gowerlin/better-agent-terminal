/**
 * T0762 (D200 / D203): a Claude Agent panel's permission / AskUserQuestion card is a wait for the
 * user like a PTY tab's hook reason — same ⚠️, same workspace summary, same faded ⚠️ when it ends
 * unseen — through the one rule in src/lib/terminal-attention.ts.
 *
 * - `claudePanelWaitingReason`: permission card → `permission`, AskUserQuestion → `question`,
 *   permission first; stopped / failed after the request → nothing
 * - the store: `setPanelWaiting` → `getTerminalAttention` / `waitingSummary` see the tab waiting;
 *   it ends while looked at → cleared; unseen → faded (renderer clock); waits again → solid
 * - two panels of one tab (pinned pane): the tab waits while either does; the start time is kept
 * - a PTY exit / reconnect snapshot of the same id never clears a panel's wait
 * - a panel that unmounts (`forgetPanelWaiting`) leaves no faded ⚠️
 * - a PTY tab's attention reads as before (main's push is returned as is)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTerminalAttention,
  forgetPanelWaiting,
  getMissedWait,
  getTerminalAttention,
  reconcileTerminalAttention,
  attentionChangeMark,
  resetTerminalAttention,
  setPanelWaiting,
  setTerminalAttention,
  setViewingState,
} from '../terminal-attention-store'
import {
  claudePanelWaitingReason,
  combinePanelWaitingReasons,
  panelAttentionEvent,
  pickTerminalAttention,
  waitingForUser,
  waitingSummary,
  type TerminalAttentionEvent,
} from '../../lib/terminal-attention'

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const START = new Date(2026, 10, 2, 3, 30).getTime()
const PANEL = 'panel-tab'
const terminals = [{ id: PANEL, workspaceId: 'ws-a', title: 'Claude Agent' }, { id: 'pty-tab', workspaceId: 'ws-a', title: 'Shell' }]
const workspaces = [{ id: 'ws-a', name: 'A' }]
const summary = () => waitingSummary(terminals, workspaces, getTerminalAttention, getMissedWait)

beforeEach(() => {
  resetTerminalAttention()
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
  resetTerminalAttention()
})

describe('claudePanelWaitingReason (T0762)', () => {
  it('the permission card → permission; AskUserQuestion → question; permission first', () => {
    expect(claudePanelWaitingReason({ permission: true, question: false, turnEnded: false })).toBe('permission')
    expect(claudePanelWaitingReason({ permission: false, question: true, turnEnded: false })).toBe('question')
    expect(claudePanelWaitingReason({ permission: true, question: true, turnEnded: false })).toBe('permission')
  })

  it('no card, or the query failed / was stopped after the request → nothing', () => {
    expect(claudePanelWaitingReason({ permission: false, question: false, turnEnded: false })).toBeNull()
    expect(claudePanelWaitingReason({ permission: true, question: false, turnEnded: true })).toBeNull()
    expect(claudePanelWaitingReason({ permission: false, question: true, turnEnded: true })).toBeNull()
  })

  it('several panels: permission over question; none → null', () => {
    expect(combinePanelWaitingReasons(['question', 'permission'])).toBe('permission')
    expect(combinePanelWaitingReasons([null, 'question'])).toBe('question')
    expect(combinePanelWaitingReasons([])).toBeNull()
  })

  it('pickTerminalAttention: main waiting wins, else the panel, else main; returns the given objects', () => {
    const pty = ev('x', { blockedReason: 'input', blockedSince: 1 })
    const panel = panelAttentionEvent('x', 'permission', 2)
    expect(pickTerminalAttention(pty, panel)).toBe(pty)
    const busy = ev('x', { busy: true })
    expect(pickTerminalAttention(busy, panel)).toBe(panel)
    expect(pickTerminalAttention(busy, null)).toBe(busy)
    expect(pickTerminalAttention(null, null)).toBeNull()
    expect(waitingForUser(panel)).toEqual({ reason: 'permission', since: 2 })
  })
})

describe('the store: a panel wait is a wait for the user (T0762)', () => {
  it('waiting → ⚠️ in the summary; the click target is the panel tab', () => {
    const owner = {}
    setPanelWaiting(PANEL, owner, 'permission')
    expect(waitingForUser(getTerminalAttention(PANEL))).toEqual({ reason: 'permission', since: START })
    const s = summary()
    expect(s.total).toBe(1)
    expect(s.workspaces[0].tabs.map(t => [t.id, t.reason])).toEqual([[PANEL, 'permission']])
  })

  it('the same object while nothing changes (useSyncExternalStore needs a stable snapshot)', () => {
    const owner = {}
    setPanelWaiting(PANEL, owner, 'question')
    const first = getTerminalAttention(PANEL)
    setPanelWaiting(PANEL, owner, 'question')
    expect(getTerminalAttention(PANEL)).toBe(first)
  })

  it('answered while looked at → cleared, no faded ⚠️', () => {
    const owner = {}
    setViewingState(PANEL, true)
    setPanelWaiting(PANEL, owner, 'permission')
    setPanelWaiting(PANEL, owner, null)
    expect(getTerminalAttention(PANEL)).toBeNull()
    expect(getMissedWait(PANEL)).toBeNull()
    expect(summary().workspaces).toEqual([])
  })

  it('ends unseen → faded ⚠️ (start = renderer clock); looked at → cleared; waits again → solid', () => {
    const owner = {}
    setViewingState('pty-tab', true)
    setPanelWaiting(PANEL, owner, 'question')
    vi.setSystemTime(START + 60_000)
    setPanelWaiting(PANEL, owner, null)
    expect(getMissedWait(PANEL)).toEqual({ reason: 'question', startedAt: START })
    expect(summary()).toMatchObject({ total: 0, missedTotal: 1 })
    setPanelWaiting(PANEL, owner, 'permission')
    expect(getMissedWait(PANEL)).toBeNull()
    expect(summary()).toMatchObject({ total: 1, missedTotal: 0 })
    setPanelWaiting(PANEL, owner, null)
    expect(getMissedWait(PANEL)).not.toBeNull()
    setViewingState(PANEL, true)
    expect(getMissedWait(PANEL)).toBeNull()
  })

  it('reason changes (question → permission) keep the start time', () => {
    const owner = {}
    setPanelWaiting(PANEL, owner, 'question')
    vi.setSystemTime(START + 5_000)
    setPanelWaiting(PANEL, owner, 'permission')
    expect(getTerminalAttention(PANEL)).toMatchObject({ blockedReason: 'permission', blockedSince: START })
  })

  it('two panels of one tab: waits while either does', () => {
    const main = {}
    const pinned = {}
    setPanelWaiting(PANEL, main, 'permission')
    setPanelWaiting(PANEL, pinned, 'permission')
    setPanelWaiting(PANEL, pinned, null)
    expect(waitingForUser(getTerminalAttention(PANEL))?.reason).toBe('permission')
    forgetPanelWaiting(PANEL, pinned)
    expect(waitingForUser(getTerminalAttention(PANEL))?.reason).toBe('permission')
    setPanelWaiting(PANEL, main, null)
    expect(getTerminalAttention(PANEL)).toBeNull()
  })

  it('a PTY exit or a reconnect snapshot (alive: false) of the id never clears a panel wait', () => {
    setPanelWaiting(PANEL, {}, 'permission')
    clearTerminalAttention(PANEL)
    expect(waitingForUser(getTerminalAttention(PANEL))?.reason).toBe('permission')
    const mark = attentionChangeMark()
    reconcileTerminalAttention([{ id: PANEL, alive: false, attention: null }], mark)
    expect(waitingForUser(getTerminalAttention(PANEL))?.reason).toBe('permission')
  })

  it('a panel that unmounts forgets its wait — no faded ⚠️', () => {
    const owner = {}
    setPanelWaiting(PANEL, owner, 'permission')
    forgetPanelWaiting(PANEL, owner)
    expect(getTerminalAttention(PANEL)).toBeNull()
    expect(getMissedWait(PANEL)).toBeNull()
    forgetPanelWaiting(PANEL, owner) // twice: no-op
    expect(summary().workspaces).toEqual([])
  })

  it('a PTY tab reads main push as before', () => {
    const pushed = ev('pty-tab', { blockedReason: 'question', blockedSince: 9 })
    setTerminalAttention(pushed)
    expect(getTerminalAttention('pty-tab')).toBe(pushed)
    setTerminalAttention(ev('pty-tab'))
    expect(getTerminalAttention('pty-tab')).toBeNull()
    expect(getMissedWait('pty-tab')).toEqual({ reason: 'question', startedAt: START })
  })
})
