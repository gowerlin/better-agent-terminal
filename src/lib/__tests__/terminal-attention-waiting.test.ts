/**
 * T0735 (D200): "waits for the user" — one rule for every tab (`waitingForUser`), summed per
 * workspace for the workspace list (`workspaceWaitingTabs`), and the tab a ⚠️ click goes to
 * (`oldestWaitingTab`).
 *
 * - only a hook reason (permission / question / elicitation, codex `input`) counts; `tower`, pending
 *   questions and a busy turn never do
 * - Worker or not makes no difference (no Worker fields are read)
 * - longest waiting first; an unknown `blockedSince` last; ties keep the tab order
 * - the Worker ⚠️ is still the same rule (`workerAttention`'s first branch)
 */
import { describe, expect, it } from 'vitest'
import {
  compareWaitingTabs,
  isWaitingForUser,
  oldestWaitingTab,
  waitingForUser,
  workerAttention,
  workspaceWaitingTabs,
  type TerminalAttentionEvent,
} from '../terminal-attention'

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })

describe('waitingForUser (D200 ①)', () => {
  it.each(['permission', 'question', 'elicitation', 'input'] as const)('hook reason %s → waits for the user', (reason) => {
    expect(waitingForUser(ev('a', { blockedReason: reason, blockedSince: 5 }))).toEqual({ reason, since: 5 })
    expect(isWaitingForUser(ev('a', { blockedReason: reason }))).toBe(true)
  })

  it('the Tower (? / tower reason / pending questions), a busy turn or nothing → not', () => {
    expect(waitingForUser(ev('a', { blockedReason: 'tower', blockedSince: 5, pendingQuestions: 1 }))).toBeNull()
    expect(waitingForUser(ev('a', { pendingQuestions: 2, questionsSince: 5 }))).toBeNull()
    expect(waitingForUser(ev('a', { busy: true }))).toBeNull()
    expect(waitingForUser(ev('a'))).toBeNull()
    expect(waitingForUser(null)).toBeNull()
    expect(waitingForUser(undefined)).toBeNull()
  })

  it('an unknown or invalid since → null since', () => {
    expect(waitingForUser(ev('a', { blockedReason: 'question' }))).toEqual({ reason: 'question', since: null })
    expect(waitingForUser(ev('a', { blockedReason: 'question', blockedSince: Number.NaN }))).toEqual({ reason: 'question', since: null })
  })

  it('the Worker ⚠️ is the same rule (workerAttention unchanged)', () => {
    const blocked = ev('w', { blockedReason: 'input', blockedSince: 7, pendingQuestions: 1 })
    expect(workerAttention({}, blocked)).toEqual({ kind: 'blocked', reason: 'input', since: 7 })
    expect(workerAttention({}, ev('w', { blockedReason: 'permission' }))).toEqual({ kind: 'blocked', reason: 'permission', since: null })
    // the Tower still wins over a report, a report still shows when nothing waits
    const report = { workerReport: { message: 'T1 完成', reportedAt: 1 } }
    expect(workerAttention(report, ev('w', { blockedReason: 'tower', blockedSince: 3, pendingQuestions: 1 }))?.kind).toBe('question')
    expect(workerAttention(report, null)?.kind).toBe('reported')
    expect(workerAttention(report, null, true)?.kind).toBe('resumed')
  })
})

describe('workspaceWaitingTabs / oldestWaitingTab (D200 ②③⑤)', () => {
  const terminals = [
    { id: 'tower', workspaceId: 'A', title: 'Claude CLI · Tower' },
    { id: 'worker', workspaceId: 'A', title: 'claude · Worker · T0001', towerTerminalId: 'tower', workorder: 'T0001' },
    { id: 'shell', workspaceId: 'A', title: 'Terminal 1' },
    { id: 'codex', workspaceId: 'B', title: 'Codex CLI' },
    { id: 'asking', workspaceId: 'B', title: 'claude · Worker · T0002' },
  ]

  it('sums each workspace, Worker or not; ? / ✓ / ↻ tabs do not count', () => {
    const states = new Map<string, TerminalAttentionEvent>([
      ['tower', ev('tower', { blockedReason: 'question', blockedSince: 300 })],
      ['worker', ev('worker', { blockedReason: 'permission', blockedSince: 100 })],
      ['shell', ev('shell', { busy: true })],
      ['codex', ev('codex', { blockedReason: 'input', blockedSince: 50 })],
      ['asking', ev('asking', { blockedReason: 'tower', blockedSince: 10, pendingQuestions: 1 })],
    ])
    const get = (id: string) => states.get(id) ?? null
    expect(workspaceWaitingTabs(terminals, 'A', get).map(t => t.id)).toEqual(['worker', 'tower'])
    expect(workspaceWaitingTabs(terminals, 'B', get)).toEqual([{ id: 'codex', title: 'Codex CLI', reason: 'input', since: 50 }])
    expect(workspaceWaitingTabs(terminals, 'C', get)).toEqual([])
  })

  it('longest waiting first, unknown since last, ties keep the tab order', () => {
    const states = new Map<string, TerminalAttentionEvent>([
      ['tower', ev('tower', { blockedReason: 'question' })],
      ['worker', ev('worker', { blockedReason: 'permission', blockedSince: 200 })],
      ['shell', ev('shell', { blockedReason: 'elicitation', blockedSince: 200 })],
    ])
    const waiting = workspaceWaitingTabs(terminals, 'A', id => states.get(id))
    expect(waiting.map(t => t.id)).toEqual(['worker', 'shell', 'tower'])
    expect(oldestWaitingTab(waiting)?.id).toBe('worker')
    expect(oldestWaitingTab([])).toBeNull()
    // only unknown times → the first in tab order
    expect(oldestWaitingTab([{ id: 'x', title: 'x', reason: 'question', since: null }, { id: 'y', title: 'y', reason: 'question', since: null }])?.id).toBe('x')
    expect(compareWaitingTabs({ reason: 'question', since: 1 }, { reason: 'question', since: null })).toBeLessThan(0)
  })

  it('a cleared state drops the tab (the ⚠️ goes away)', () => {
    const states = new Map<string, TerminalAttentionEvent>([['codex', ev('codex', { blockedReason: 'input', blockedSince: 1 })]])
    const get = (id: string) => states.get(id) ?? null
    expect(workspaceWaitingTabs(terminals, 'B', get)).toHaveLength(1)
    states.delete('codex')
    expect(workspaceWaitingTabs(terminals, 'B', get)).toEqual([])
  })
})
