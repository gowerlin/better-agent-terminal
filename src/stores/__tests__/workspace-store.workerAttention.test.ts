/**
 * T0609 (BUG-153): a Worker that waits for the user (claude hook `blocked`) or for its Tower's
 * answer is not "reported" — its badge says so and the Tower's batch close leaves it out.
 *
 * - workerAttention: precedence waits for the user > waits for the Tower (main's state, then the
 *   old CT `T#### 提問` fallback) > reported
 * - markWorkerReported: `… 提問` → `workerQuestion` (not `workerReport`); the next notify replaces it;
 *   saved / loaded / adopted like `workerReport`
 * - reportedWorkersOfTower: excludes blocked / question tabs (main's state from the attention store)
 * - terminal-attention-store: an empty event forgets the tab
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { reportedWorkersOfTower, workspaceStore } from '../workspace-store'
import { clearTerminalAttention, getTerminalAttention, resetTerminalAttention, setTerminalAttention } from '../terminal-attention-store'
import { isQuestionNotifyMessage, workerAttention, type TerminalAttentionEvent } from '../../lib/terminal-attention'
import type { TerminalInstance } from '../../types'

interface SavedTerminal { id: string; workerReport?: unknown; workerQuestion?: unknown; [key: string]: unknown }

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

const report = { message: 'T0609 完成', reportedAt: 10 }
const question = { message: 'T0609 提問', askedAt: 20 }
const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const terminal = (id: string) => workspaceStore.getState().terminals.find(t => t.id === id)
const lastSaved = () => saves[saves.length - 1].terminals

describe('isQuestionNotifyMessage (old CT fallback)', () => {
  it('a message ending with 提問 (trailing whitespace ignored)', () => {
    expect(isQuestionNotifyMessage('T0609 提問')).toBe(true)
    expect(isQuestionNotifyMessage('T0609 提問 \n')).toBe(true)
    expect(isQuestionNotifyMessage('提問')).toBe(true)
  })

  it('anything else is a report', () => {
    for (const m of ['T0609 完成', 'T0609 部分完成', 'T0609 需要協助', 'T0609 提問了嗎', '提問 T0609', '', undefined, 42]) {
      expect(isQuestionNotifyMessage(m)).toBe(false)
    }
  })
})

describe('workerAttention precedence', () => {
  it('nothing → null; a report → reported', () => {
    expect(workerAttention({}, null)).toBeNull()
    expect(workerAttention({ workerReport: report }, null)).toEqual({ kind: 'reported', message: 'T0609 完成', reportedAt: 10 })
  })

  it('a hook reason wins over questions and reports', () => {
    for (const reason of ['permission', 'question', 'elicitation'] as const) {
      expect(workerAttention({ workerReport: report, workerQuestion: question }, ev('w', { blockedReason: reason, blockedSince: 5, pendingQuestions: 2, questionsSince: 3 })))
        .toEqual({ kind: 'blocked', reason, since: 5 })
    }
  })

  it('blocked / tower or a pending (non-blocking) question → question, over a report and the fallback', () => {
    expect(workerAttention({ workerReport: report }, ev('w', { blockedReason: 'tower', blockedSince: 7, pendingQuestions: 1, questionsSince: 7 })))
      .toEqual({ kind: 'question', since: 7, pending: 1, source: 'question' })
    expect(workerAttention({ workerReport: report, workerQuestion: question }, ev('w', { pendingQuestions: 2, questionsSince: 4 })))
      .toEqual({ kind: 'question', since: 4, pending: 2, source: 'question' })
  })

  it('the old CT fallback → question; main\'s empty state does not hide it', () => {
    expect(workerAttention({ workerQuestion: question }, null)).toEqual({ kind: 'question', since: 20, pending: 0, source: 'notify' })
    expect(workerAttention({ workerQuestion: question }, ev('w'))).toEqual({ kind: 'question', since: 20, pending: 0, source: 'notify' })
  })
})

describe('terminal-attention-store', () => {
  it('keeps the latest event; an empty one or clear forgets the tab', () => {
    setTerminalAttention(ev('w1', { blockedReason: 'permission', blockedSince: 1 }))
    expect(getTerminalAttention('w1')).toMatchObject({ blockedReason: 'permission' })
    setTerminalAttention(ev('w1', { pendingQuestions: 1, questionsSince: 2 }))
    expect(getTerminalAttention('w1')).toEqual(ev('w1', { pendingQuestions: 1, questionsSince: 2 }))
    setTerminalAttention(ev('w1'))
    expect(getTerminalAttention('w1')).toBeNull()
    setTerminalAttention(ev('w2', { blockedReason: 'tower', blockedSince: 3, pendingQuestions: 1 }))
    clearTerminalAttention('w2')
    expect(getTerminalAttention('w2')).toBeNull()
  })
})

describe('reportedWorkersOfTower excludes Workers that wait (T0609)', () => {
  const tab = (id: string, extra: Partial<TerminalInstance> = {}) => ({ id, towerTerminalId: 'tower', ...extra })
  const tabs = [
    { id: 'tower' },
    tab('reported', { workorder: 'T0601', workerReport: report }),
    tab('asked-old-ct', { workorder: 'T0602', workerQuestion: question }),
    tab('asked-structured', { workorder: 'T0603', workerReport: report }),
    tab('blocked', { workorder: 'T0604', workerReport: report }),
    tab('running', { workorder: 'T0605' }),
  ]

  it('only `reported` is counted (attention store by default)', () => {
    setTerminalAttention(ev('asked-structured', { blockedReason: 'tower', blockedSince: 1, pendingQuestions: 1, questionsSince: 1 }))
    setTerminalAttention(ev('blocked', { blockedReason: 'permission', blockedSince: 1 }))
    expect(reportedWorkersOfTower(tabs, 'tower').map(t => t.id)).toEqual(['reported'])
    // the waits end → back to their reports
    setTerminalAttention(ev('asked-structured'))
    setTerminalAttention(ev('blocked'))
    expect(reportedWorkersOfTower(tabs, 'tower').map(t => t.id)).toEqual(['reported', 'asked-structured', 'blocked'])
  })

  it('an explicit attention source is used instead of the store', () => {
    const attention = (id: string) => id === 'reported' ? ev(id, { pendingQuestions: 1 }) : null
    expect(reportedWorkersOfTower(tabs, 'tower', attention).map(t => t.id)).toEqual(['asked-structured', 'blocked'])
  })
})

describe('workspaceStore.markWorkerReported with `提問` (T0609)', () => {
  function setup() {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    const tower = workspaceStore.addTerminal(ws.id)
    workspaceStore.addExternalTerminal({ id: 'w1', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0609' })
    return { ws, tower }
  }

  it('`T#### 提問` → workerQuestion, not reported; the next notify replaces it with a report', async () => {
    const { tower } = setup()
    expect(workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0609', message: 'T0609 提問' })).toEqual(['w1'])
    expect(terminal('w1')?.workerQuestion).toMatchObject({ message: 'T0609 提問' })
    expect(typeof terminal('w1')?.workerQuestion?.askedAt).toBe('number')
    expect(terminal('w1')).not.toHaveProperty('workerReport')
    expect(reportedWorkersOfTower(workspaceStore.getState().terminals, tower.id)).toEqual([])
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'w1')?.workerQuestion).toMatchObject({ message: 'T0609 提問' })

    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0609', message: 'T0609 完成' })
    expect(terminal('w1')?.workerReport).toMatchObject({ message: 'T0609 完成' })
    expect(terminal('w1')).not.toHaveProperty('workerQuestion')
    expect(reportedWorkersOfTower(workspaceStore.getState().terminals, tower.id).map(t => t.id)).toEqual(['w1'])
    await workspaceStore.save()
    expect(lastSaved().find(t => t.id === 'w1')).not.toHaveProperty('workerQuestion')
  })

  it('a reported Worker that asks again goes back to question', () => {
    const { tower } = setup()
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0609', message: 'T0609 需要協助' })
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0609', message: 'T0609 提問' })
    expect(terminal('w1')).not.toHaveProperty('workerReport')
    expect(workerAttention(terminal('w1')!, null)?.kind).toBe('question')
  })

  it('save() → load() keeps workerQuestion; invalid saved values are dropped', async () => {
    const { ws, tower } = setup()
    workspaceStore.addExternalTerminal({ id: 'w2', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: tower.id, workorder: 'T0610' })
    workspaceStore.markWorkerReported({ targetId: tower.id, source: 'T0609', message: 'T0609 提問' })
    await workspaceStore.save()
    const saved = saves[saves.length - 1]
    saved.terminals.find(t => t.id === 'w2')!.workerQuestion = { message: 'x', askedAt: 'soon' }
    loadData = JSON.stringify(saved)
    workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
    await workspaceStore.load()
    expect(terminal('w1')).toMatchObject({ workorder: 'T0609', workerQuestion: { message: 'T0609 提問' } })
    expect(terminal('w2')).not.toHaveProperty('workerQuestion')
  })

  it('a detached window\'s list adopted back: its newer report clears the question this window kept', async () => {
    const ws = workspaceStore.addWorkspace('ws', '/tmp/ws')
    workspaceStore.addExternalTerminal({ id: 'w-d', cwd: '/tmp/ws', workspaceId: ws.id, towerTerminalId: 'tower-d', workorder: 'T0609' })
    workspaceStore.markWorkerReported({ targetId: 'tower-d', source: 'T0609', message: 'T0609 提問' })
    adoptResult = { terminals: [{ id: 'w-d', workspaceId: ws.id, type: 'terminal', title: 'Remote: claude', towerTerminalId: 'tower-d', workorder: 'T0609', workerReport: { message: 'T0609 完成', reportedAt: 5 } }] }
    await workspaceStore.adoptDetachedWorkspaceTerminals(ws.id)
    expect(terminal('w-d')?.workerReport).toEqual({ message: 'T0609 完成', reportedAt: 5 })
    expect(terminal('w-d')?.workerQuestion).toBeUndefined()
  })
})
