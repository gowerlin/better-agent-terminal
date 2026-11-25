/**
 * PLAN-068 W4 / T0906: the「待辦」(Inbox) tab's pure decisions (src/lib/inbox-model.ts).
 *
 * - §6′ verdict: every row of「每個塔台分頁的判定」(tab declaration × state file), plus the
 *   no-declared-Tower case judged by the state file alone (Tower answer Q-2)
 * - the state-file-only status (Claude panel Tower; for W3 / W5)
 * - sections, folding, BAT data (pending-verify BUGs, counts, `todo` folding, Worker waits), badge
 */
import { describe, expect, it } from 'vitest'
import {
  INBOX_SECTIONS,
  TODO_FOLD_CHARS,
  foldTodo,
  inboxActionCount,
  inboxApplies,
  inboxCounts,
  inboxGateCode,
  inboxGateHint,
  inboxTabBadge,
  inboxVerdict,
  parseFoldedSections,
  pendingVerifyBugs,
  pickInboxTower,
  showsTowerPicker,
  stateFileContractStatus,
  workerWaitItems,
} from '../inbox-model'
import type { BugEntry, BugStatus } from '../../types/bug-tracker'
import type { BacklogEntry, PlanStatus } from '../../types/backlog'
import type { TerminalAttentionEvent } from '../terminal-attention'

const tab = (towerContract: number | null) => ({ towerContract })

describe('stateFileContractStatus (Tower known only by _tower-state.md)', () => {
  it('2 = match, missing / 1 = CT too old, > 2 = BAT too old', () => {
    expect(stateFileContractStatus(2)).toBe('match')
    expect(stateFileContractStatus(null)).toBe('ct-outdated')
    expect(stateFileContractStatus(undefined)).toBe('ct-outdated')
    expect(stateFileContractStatus(1)).toBe('ct-outdated')
    expect(stateFileContractStatus(3)).toBe('bat-outdated')
    expect(stateFileContractStatus(Number.NaN)).toBe('ct-outdated')
  })
})

describe('inboxVerdict — T0902 §6′ table', () => {
  it('tab 2 × state 2 → match', () => {
    expect(inboxVerdict(tab(2), 2)).toEqual({ kind: 'match', source: 'tab' })
  })
  it('tab 2 × state missing / 1 → P-3 (state file behind)', () => {
    expect(inboxVerdict(tab(2), null)).toEqual({ kind: 'state-behind' })
    expect(inboxVerdict(tab(2), 1)).toEqual({ kind: 'state-behind' })
  })
  it('tab 2 × state > 2 → P-2 (the data is newer than BAT)', () => {
    expect(inboxVerdict(tab(2), 3)).toEqual({ kind: 'bat-outdated', source: 'state', requested: 3 })
  })
  it('tab not declared (or 1) × any state → P-1', () => {
    for (const state of [null, 1, 2, 3]) {
      expect(inboxVerdict(tab(null), state)).toEqual({ kind: 'ct-outdated', source: 'tab' })
      expect(inboxVerdict(tab(1), state)).toEqual({ kind: 'ct-outdated', source: 'tab' })
    }
  })
  it('tab > 2 × any state → P-2', () => {
    for (const state of [null, 1, 2, 3]) {
      expect(inboxVerdict(tab(3), state)).toEqual({ kind: 'bat-outdated', source: 'tab', requested: 3 })
    }
  })
  it('no declared Tower → the state file decides (2 on, missing / 1 P-1, > 2 P-2)', () => {
    expect(inboxVerdict(null, 2)).toEqual({ kind: 'match', source: 'state' })
    expect(inboxVerdict(null, null)).toEqual({ kind: 'ct-outdated', source: 'state' })
    expect(inboxVerdict(null, 1)).toEqual({ kind: 'ct-outdated', source: 'state' })
    expect(inboxVerdict(null, 4)).toEqual({ kind: 'bat-outdated', source: 'state', requested: 4 })
  })
})

describe('gate hints', () => {
  it('codes and i18n keys per verdict', () => {
    expect(inboxGateHint({ kind: 'match', source: 'tab' })).toBeNull()
    expect(inboxGateCode({ kind: 'match', source: 'tab' })).toBeNull()
    expect(inboxGateHint({ kind: 'ct-outdated', source: 'tab' })).toEqual({ key: 'towerContract.ctOutdated', values: { supported: 2 } })
    expect(inboxGateHint({ kind: 'ct-outdated', source: 'state' })).toEqual({ key: 'inbox.gate.stateV1', values: { supported: 2 } })
    expect(inboxGateHint({ kind: 'bat-outdated', source: 'state', requested: 3 })).toEqual({ key: 'towerContract.batOutdated', values: { supported: 2, requested: 3 } })
    expect(inboxGateHint({ kind: 'state-behind' })).toEqual({ key: 'inbox.gate.stateBehind', values: { supported: 2 } })
    expect(inboxGateCode({ kind: 'ct-outdated', source: 'state' })).toBe('P-1')
    expect(inboxGateCode({ kind: 'bat-outdated', source: 'tab', requested: 3 })).toBe('P-2')
    expect(inboxGateCode({ kind: 'state-behind' })).toBe('P-3')
  })
})

describe('Tower picker', () => {
  const towers = [{ id: 'a' }, { id: 'b' }]
  it('the picked one while declared, else the first; none → null', () => {
    expect(pickInboxTower(towers, 'b')).toEqual({ id: 'b' })
    expect(pickInboxTower(towers, 'gone')).toEqual({ id: 'a' })
    expect(pickInboxTower(towers, null)).toEqual({ id: 'a' })
    expect(pickInboxTower([], 'a')).toBeNull()
  })
  it('shown only with more than one declared Tower', () => {
    expect(showsTowerPicker([])).toBe(false)
    expect(showsTowerPicker([{}])).toBe(false)
    expect(showsTowerPicker(towers)).toBe(true)
  })
  it('the tab applies with a declared Tower or a _ct-workorders/ folder', () => {
    expect(inboxApplies(true, false)).toBe(true)
    expect(inboxApplies(false, true)).toBe(true)
    expect(inboxApplies(false, false)).toBe(false)
    expect(inboxApplies(false, null)).toBe(false)
  })
})

describe('sections and folding', () => {
  it('fixed order (§1)', () => {
    expect(INBOX_SECTIONS).toEqual(['decide', 'act', 'remind', 'workers', 'messages', 'todo', 'counts'])
  })
  it('defaults: only todo folded; stored booleans win; junk → defaults', () => {
    const defaults = parseFoldedSections(null)
    expect(Object.entries(defaults).filter(([, v]) => v).map(([k]) => k)).toEqual(['todo'])
    expect(parseFoldedSections('{"todo":false,"workers":true,"act":"x"}')).toMatchObject({ todo: false, workers: true, act: false })
    expect(parseFoldedSections('not json')).toEqual(defaults)
    expect(parseFoldedSections('[1]')).toEqual(defaults)
  })
})

const bug = (id: string, status: BugStatus, isArchived = false): BugEntry => ({
  id, filename: `${id}.md`, title: `${id} title`, severity: 'Low', status, reportedAt: '', isArchived, linkPath: `${id}.md`,
})
const plan = (id: string, status: PlanStatus, isArchived = false): BacklogEntry =>
  ({ id, filename: `${id}.md`, title: id, priority: 'Low', status, createdAt: '', isArchived, linkPath: `${id}.md` }) as BacklogEntry

describe('BAT data', () => {
  it('pending-verify BUGs: FIXED / VERIFY, not archived, file order', () => {
    const list = [bug('BUG-1', 'OPEN'), bug('BUG-2', 'VERIFY'), bug('BUG-3', 'FIXED'), bug('BUG-4', 'FIXED', true), bug('BUG-5', 'CLOSED')]
    expect(pendingVerifyBugs(list).map(b => b.id)).toEqual(['BUG-2', 'BUG-3'])
  })
  it('counts: open BUGs, PLANs in progress, open work orders', () => {
    expect(inboxCounts(
      [bug('B1', 'OPEN'), bug('B2', 'FIXING'), bug('B3', 'FIXED'), bug('B4', 'OPEN', true)],
      [plan('P1', 'IN_PROGRESS'), plan('P2', 'PLANNED'), plan('P3', 'IN_PROGRESS', true)],
      ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'ABANDONED', 'UNKNOWN', 'INVALID'],
    )).toEqual({ openBugs: 2, plansInProgress: 1, openOrders: 3 })
  })
  it('todo folding: long or multi-line items fold', () => {
    expect(foldTodo('short')).toEqual({ short: 'short', folded: false })
    const long = 'x'.repeat(TODO_FOLD_CHARS + 5)
    expect(foldTodo(long)).toEqual({ short: `${'x'.repeat(TODO_FOLD_CHARS)}…`, folded: true })
    expect(foldTodo('first\nsecond')).toEqual({ short: 'first…', folded: true })
  })
  it('Worker waits: ⚠️ longest first, then 📨, then ⏸; ? / ✓ are not listed', () => {
    const attention: Record<string, TerminalAttentionEvent> = {
      a: { id: 'a', pendingQuestions: 0, blockedReason: 'permission', blockedSince: 200 },
      b: { id: 'b', pendingQuestions: 0, blockedReason: 'question', blockedSince: 100 },
      c: { id: 'c', pendingQuestions: 1, blockedReason: 'tower' },
    }
    const items = workerWaitItems(
      [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 't', title: 'Tower' }],
      {
        getAttention: id => attention[id],
        getHeld: id => (id === 't' ? { count: 2, since: 5 } : { count: 0, since: null }),
        getInterrupted: id => (id === 'c' ? { agent: 'claude-cli', at: 9 } : null),
      },
    )
    expect(items).toEqual([
      { kind: 'waiting', terminalId: 'b', title: 'B', reason: 'question', since: 100 },
      { kind: 'waiting', terminalId: 'a', title: 'A', reason: 'permission', since: 200 },
      { kind: 'held', terminalId: 't', title: 'Tower', count: 2, since: 5 },
      { kind: 'interrupted', terminalId: 'c', title: 'C', agent: 'claude-cli', at: 9 },
    ])
  })
  it('title: count on a match (none at 0), `!` otherwise', () => {
    expect(inboxActionCount({ workerItems: 2, pendingBugs: 3 })).toBe(5)
    expect(inboxTabBadge({ kind: 'match', source: 'tab' }, 5)).toBe('5')
    expect(inboxTabBadge({ kind: 'match', source: 'state' }, 0)).toBeNull()
    expect(inboxTabBadge({ kind: 'state-behind' }, 5)).toBe('!')
    expect(inboxTabBadge({ kind: 'ct-outdated', source: 'tab' }, 0)).toBe('!')
  })
})
