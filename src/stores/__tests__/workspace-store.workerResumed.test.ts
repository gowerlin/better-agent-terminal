/**
 * T0694 (D180): a Worker that reported and then works again (a Renew in the same tab) is `resumed`
 * (↻), not ✓, and is not counted by the Tower's batch close — until that turn ends (✓ again) or it
 * reports again (✓).
 *
 * - workerAttention precedence: waits for the user > waits for the Tower > resumed > reported
 * - "after the report" = this window's receive order of the notify and of the turn start (`busy`
 *   absent → true); both arrival orders; no time of main / a remote host is compared
 * - a turn already running when the report arrives is not "resumed"; the next one is
 * - a report this window never saw (saved workspace / adopted from a detached window) counts as before
 * - memory only: never saved; PTY exit (`clearTerminalAttention`) ends it
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { reportedWorkersOfTower, workspaceStore } from '../workspace-store'
import {
  clearTerminalAttention,
  getTerminalAttention,
  isWorkerResumedAfterReport,
  noteWorkerNotified,
  resetTerminalAttention,
  setTerminalAttention,
} from '../terminal-attention-store'
import { isRecentlyPrinting, workerAttention, type TerminalAttentionEvent } from '../../lib/terminal-attention'

interface SavedTerminal { id: string; [key: string]: unknown }

const saves: Array<{ terminals: SavedTerminal[] }> = []
let loadData: string | null = null
let adoptResult: { terminals: unknown[] } | null = null

beforeEach(() => {
  saves.length = 0
  loadData = null
  adoptResult = null
  resetTerminalAttention()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { kill: vi.fn() },
    claude: { stopSession: vi.fn() },
    workspace: {
      save: vi.fn(async (data: string) => { saves.push(JSON.parse(data)); return true }),
      load: vi.fn(async () => loadData),
      adoptDetached: vi.fn(async () => adoptResult),
    },
  }
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
})

afterEach(() => {
  workspaceStore.stopAutoSave()
  resetTerminalAttention()
})

const report = { message: 'T0694 完成', reportedAt: 10 }
const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const busy = (id: string, extra: Partial<TerminalAttentionEvent> = {}) => ev(id, { busy: true, ...extra })
const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)

function setup() {
  const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
  const tower = workspaceStore.addTerminal(ws.id)
  workspaceStore.addExternalTerminal({ id: 'w1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0694' })
  return { ws, tower }
}
/** What the badge says (as TerminalThumbnail computes it). */
const kind = (id = 'w1') => workerAttention(terminal(id)!, getTerminalAttention(id), isWorkerResumedAfterReport(id))?.kind ?? null
const counted = (towerId: string) => reportedWorkersOfTower(workspaceStore.getState().terminals, towerId).map(t => t.id)

describe('workerAttention precedence with resumed (T0694)', () => {
  it('resumed only for a reported tab; under blocked and questions; over reported', () => {
    expect(workerAttention({ workerReport: report }, busy('w'), true)).toEqual({ kind: 'resumed', message: 'T0694 完成', reportedAt: 10 })
    expect(workerAttention({ workerReport: report }, busy('w'), false)).toEqual({ kind: 'reported', message: 'T0694 完成', reportedAt: 10 })
    expect(workerAttention({ workerReport: report }, null)).toMatchObject({ kind: 'reported' }) // default: not resumed
    expect(workerAttention({}, busy('w'), true)).toBeNull() // never reported: running
    for (const reason of ['permission', 'question', 'elicitation', 'input'] as const) {
      expect(workerAttention({ workerReport: report }, busy('w', { blockedReason: reason, blockedSince: 1 }), true)).toMatchObject({ kind: 'blocked', reason })
    }
    expect(workerAttention({ workerReport: report }, busy('w', { blockedReason: 'tower', blockedSince: 1, pendingQuestions: 1 }), true)).toMatchObject({ kind: 'question', source: 'question' })
    expect(workerAttention({ workerReport: report }, busy('w', { pendingQuestions: 1, questionsSince: 1 }), true)).toMatchObject({ kind: 'question' })
    expect(workerAttention({ workerQuestion: { message: 'T0694 提問', askedAt: 1 } }, busy('w'), true)).toMatchObject({ kind: 'question', source: 'notify' })
  })
})

describe('terminal-attention-store: the receive order (T0694)', () => {
  it('a busy-only event is kept; a turn start is busy absent → true; the turn end forgets it', () => {
    setTerminalAttention(busy('w1'))
    expect(getTerminalAttention('w1')).toEqual(busy('w1'))
    expect(isWorkerResumedAfterReport('w1')).toBe(true) // no notify seen = before
    noteWorkerNotified(['w1'])
    expect(isWorkerResumedAfterReport('w1')).toBe(false)
    // still the same turn: a blocked / unblocked change while busy is no new start
    setTerminalAttention(busy('w1', { blockedReason: 'permission', blockedSince: 1 }))
    setTerminalAttention(busy('w1'))
    expect(isWorkerResumedAfterReport('w1')).toBe(false)
    setTerminalAttention(ev('w1'))
    expect(getTerminalAttention('w1')).toBeNull()
    setTerminalAttention(busy('w1'))
    expect(isWorkerResumedAfterReport('w1')).toBe(true)
    clearTerminalAttention('w1') // the PTY exited
    expect(isWorkerResumedAfterReport('w1')).toBe(false)
  })
})

describe('reported → working again → ✓ (T0694)', () => {
  it('report (turn running) → ✓; the turn ends → ✓; Renew: a new turn → ↻, not counted; it ends → ✓ counted', () => {
    const { tower } = setup()
    setTerminalAttention(busy('w1')) // the Worker's ct-exec turn
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    expect(kind()).toBe('reported')
    expect(counted(tower.id)).toEqual(['w1'])
    setTerminalAttention(ev('w1')) // Stop
    expect(kind()).toBe('reported')

    setTerminalAttention(busy('w1')) // the user types 重讀工單 → UserPromptSubmit
    expect(kind()).toBe('resumed')
    expect(counted(tower.id)).toEqual([])
    setTerminalAttention(busy('w1', { blockedReason: 'permission', blockedSince: 2 }))
    expect(kind()).toBe('blocked')
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    setTerminalAttention(ev('w1')) // Stop without a new report (a chat, an Esc + quiet fallback)
    expect(kind()).toBe('reported')
    expect(counted(tower.id)).toEqual(['w1'])
  })

  it('a new report during the resumed turn → ✓ (counted), and stays ✓ when the turn ends', () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成（Renew #1）' })
    expect(kind()).toBe('reported')
    expect(terminal('w1')?.workerReport?.message).toBe('T0694 完成（Renew #1）')
    expect(counted(tower.id)).toEqual(['w1'])
    setTerminalAttention(ev('w1'))
    expect(kind()).toBe('reported')
  })

  it('both arrival orders of the notify and the turn start (cf. workerAttention.test.ts T0613)', () => {
    const { tower } = setup()
    // (1) turn start, then the notify: the report is from this turn → ✓
    setTerminalAttention(busy('w1'))
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    expect(kind()).toBe('reported')
    setTerminalAttention(ev('w1'))
    // (2) the notify, then a turn start: working again after it → ↻
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    setTerminalAttention(ev('w1'))
    // (2') the notify of the next report arrives first, its turn's start after: ↻ until that turn ends
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 部分完成' })
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    setTerminalAttention(ev('w1'))
    expect(kind()).toBe('reported')
  })

  it('the receive order decides, not reportedAt (a remote host\'s clock may be far off)', () => {
    const { tower } = setup()
    const realNow = Date.now
    try {
      Date.now = () => 4_000_000_000_000 // the renderer clock far ahead of anything main sends
      workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    } finally {
      Date.now = realNow
    }
    // main's blockedSince of the next turn (earlier than reportedAt) does not matter
    setTerminalAttention(busy('w1', { blockedReason: 'permission', blockedSince: 1 }))
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
  })

  it('--ask (T0613) and old CT 提問 notifies: no ✓, so no ↻; the next plain report while the turn runs → ✓', () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 提問', questionId: 'q-0123abcd-0123456789abcdef' })
    expect(kind()).toBeNull()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 提問' })
    expect(kind()).toBe('question')
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    expect(kind()).toBe('reported')
  })

  it('the PTY exits during the resumed turn → ✓', () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    setTerminalAttention(busy('w1'))
    clearTerminalAttention('w1')
    expect(kind()).toBe('reported')
    expect(counted(tower.id)).toEqual(['w1'])
  })

  it('only the notified tab: another Worker of the same Tower keeps its own state', () => {
    const { ws, tower } = setup()
    workspaceStore.addExternalTerminal({ id: 'w2', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0695' })
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0695', message: 'T0695 完成' })
    setTerminalAttention(busy('w2'))
    expect(kind('w1')).toBe('reported')
    expect(kind('w2')).toBe('resumed')
    expect(counted(tower.id)).toEqual(['w1'])
  })
})

describe('memory only; BAT reopened; detached windows (T0694)', () => {
  it('resumed is never saved: the saved report is the same with or without it', async () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    await workspaceStore.save()
    const saved = saves[saves.length - 1].terminals.find(t => t.id === 'w1')!
    expect(saved.workerReport).toEqual({ message: 'T0694 完成', reportedAt: expect.any(Number) })
    expect(JSON.stringify(saves[saves.length - 1])).not.toMatch(/resumed|busy|turn/i)
  })

  it('reopened (report loaded, no notify seen): ✓; the next turn start → ↻; its end → ✓', async () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0694', message: 'T0694 完成' })
    await workspaceStore.save()
    loadData = JSON.stringify(saves[saves.length - 1])
    workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
    resetTerminalAttention() // a new window process knows nothing
    await workspaceStore.load()
    expect(kind()).toBe('reported')
    setTerminalAttention(busy('w1'))
    expect(kind()).toBe('resumed')
    setTerminalAttention(ev('w1'))
    expect(kind()).toBe('reported')
  })

  it('adopted back from a detached window after the turn ended → ✓ (no stale ↻)', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    // the detached window had the Worker, reported and resumed there; this window saw the turn events
    setTerminalAttention(busy('w-d'))
    setTerminalAttention(ev('w-d'))
    adoptResult = { terminals: [{ id: 'w-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0694', workerReport: { message: 'T0694 完成', reportedAt: 5 } }] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(kind('w-d')).toBe('reported')
    expect(reportedWorkersOfTower(workspaceStore.getState().terminals, 'tower-d').map(t => t.id)).toEqual(['w-d'])
  })

  it('adopted while a turn runs whose report this window never saw → ↻ (not counted) until it ends', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    setTerminalAttention(busy('w-d'))
    adoptResult = { terminals: [{ id: 'w-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0694', workerReport: { message: 'T0694 完成', reportedAt: 5 } }] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(kind('w-d')).toBe('resumed')
    expect(reportedWorkersOfTower(workspaceStore.getState().terminals, 'tower-d')).toEqual([])
    setTerminalAttention(ev('w-d'))
    expect(kind('w-d')).toBe('reported')
  })

  it('a tab this window already had (it got the same notify and turn events as the detached one) keeps its state across the adopt', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'w-d', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: 'tower-d', workorder: 'T0694' })
    setTerminalAttention(busy('w-d'))
    workspaceStore.markWorkerReported({ targetId: 'tower-d', source: 'T0694', message: 'T0694 完成' })
    adoptResult = { terminals: [{ id: 'w-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0694', workerReport: { message: 'T0694 完成', reportedAt: 5 } }] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(kind('w-d')).toBe('reported') // the report came during this window's running turn
    setTerminalAttention(ev('w-d'))
    setTerminalAttention(busy('w-d'))
    expect(kind('w-d')).toBe('resumed')
  })
})

describe('isRecentlyPrinting (d2)', () => {
  it('output within 5 s → still printing; older / none → not', () => {
    expect(isRecentlyPrinting(10_000, 14_999)).toBe(true)
    expect(isRecentlyPrinting(10_000, 15_000)).toBe(false)
    expect(isRecentlyPrinting(null, 15_000)).toBe(false)
    expect(isRecentlyPrinting(undefined, 15_000)).toBe(false)
    expect(isRecentlyPrinting(Number.NaN, 15_000)).toBe(false)
  })
})
