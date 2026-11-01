/**
 * T0749 (BUG-182): a remote profile window that connects again applies its server's
 * `terminal:attention-snapshot` (`reconcileTerminalAttention`, `createReconnectAttentionReconciler`).
 *
 * - the PTY is gone on the server (a restarted server) → handled as a PTY exit: ⚠️ cleared, the total
 *   no longer counts it; unseen → faded (D203, same as `clearTerminalAttention`), seen → nothing
 * - the PTY still runs and still waits → ⚠️ kept; it no longer waits (a change missed while
 *   disconnected) → cleared; it began waiting while disconnected → ⚠️
 * - a push received after the request was sent wins over the snapshot
 * - the reconciler: only a `connected` after a not-connected status asks; the first status never
 *   does; a failed request (older bat-server, disconnected again) keeps the state; it asks about the
 *   window's tabs + the tabs it holds attention for
 * - two windows of two profiles (separate renderers): one's reconnect never touches the other
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attentionChangeMark,
  clearTerminalAttention,
  createReconnectAttentionReconciler,
  getMissedWait,
  getTerminalAttention,
  isWorkerResumedAfterReport,
  reconcileTerminalAttention,
  resetTerminalAttention,
  setTerminalAttention,
  setViewingState,
} from '../terminal-attention-store'
import { waitingSummary, type TerminalAttentionEvent, type TerminalAttentionSnapshotEntry } from '../../lib/terminal-attention'

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })
const waiting = (id: string) => ev(id, { blockedReason: 'input', blockedSince: 1 })
const gone = (id: string): TerminalAttentionSnapshotEntry => ({ id, alive: false, attention: null })
const alive = (id: string, attention: TerminalAttentionEvent | null = ev(id)): TerminalAttentionSnapshotEntry => ({ id, alive: true, attention })
const START = new Date(2026, 10, 1, 21, 0).getTime()
const TABS = [{ id: 'r-shell', workspaceId: 'ws-r', title: 'R shell' }, { id: 'r-claude', workspaceId: 'ws-r', title: 'R claude' }]
const WORKSPACES = [{ id: 'ws-r', name: 'ws-r' }]
const summary = () => waitingSummary(TABS, WORKSPACES, getTerminalAttention, getMissedWait)

beforeEach(() => {
  resetTerminalAttention()
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
  resetTerminalAttention()
})

describe('reconcileTerminalAttention', () => {
  it('a PTY gone on the server → ⚠️ and the count cleared; unseen → faded, as a PTY exit', () => {
    setTerminalAttention(waiting('r-shell'))
    expect(summary().total).toBe(1)
    const result = reconcileTerminalAttention([gone('r-shell')], attentionChangeMark())
    expect(result).toEqual({ gone: 1, applied: 0, skipped: 0 })
    expect(getTerminalAttention('r-shell')).toBeNull()
    expect(summary().total).toBe(0)
    expect(getMissedWait('r-shell')).toMatchObject({ reason: 'input' })
    expect(summary().missedTotal).toBe(1)
  })

  it('gone while the user looks at the tab → nothing left (as a PTY exit seen)', () => {
    setViewingState('r-shell', true)
    setTerminalAttention(waiting('r-shell'))
    reconcileTerminalAttention([gone('r-shell')], attentionChangeMark())
    expect(getTerminalAttention('r-shell')).toBeNull()
    expect(getMissedWait('r-shell')).toBeNull()
    expect(summary()).toMatchObject({ total: 0, missedTotal: 0 })
  })

  it('the same outcome as clearTerminalAttention (a PTY exit)', () => {
    setTerminalAttention(waiting('r-shell'))
    reconcileTerminalAttention([gone('r-shell')], attentionChangeMark())
    const viaSnapshot = { attention: getTerminalAttention('r-shell'), missed: getMissedWait('r-shell') }
    resetTerminalAttention()
    vi.setSystemTime(START)
    setTerminalAttention(waiting('r-shell'))
    clearTerminalAttention('r-shell')
    expect({ attention: getTerminalAttention('r-shell'), missed: getMissedWait('r-shell') }).toEqual(viaSnapshot)
  })

  it('the PTY still runs and still waits → ⚠️ kept', () => {
    setTerminalAttention(waiting('r-shell'))
    const result = reconcileTerminalAttention([alive('r-shell', waiting('r-shell'))], attentionChangeMark())
    expect(result).toEqual({ gone: 0, applied: 1, skipped: 0 })
    expect(getTerminalAttention('r-shell')).toMatchObject({ blockedReason: 'input' })
    expect(summary().total).toBe(1)
    expect(getMissedWait('r-shell')).toBeNull()
  })

  it('it runs but no longer waits (missed while disconnected) → cleared; began waiting meanwhile → ⚠️', () => {
    setTerminalAttention(waiting('r-shell'))
    reconcileTerminalAttention([alive('r-shell'), alive('r-claude', ev('r-claude', { blockedReason: 'permission', blockedSince: 2 }))], attentionChangeMark())
    expect(getTerminalAttention('r-shell')).toBeNull()
    expect(getTerminalAttention('r-claude')).toMatchObject({ blockedReason: 'permission' })
    expect(summary().total).toBe(1)
  })

  it('a tab with nothing before and nothing now → unchanged; a null attention of a live tab = empty', () => {
    reconcileTerminalAttention([alive('r-claude', null), gone('r-shell')], attentionChangeMark())
    expect(getTerminalAttention('r-claude')).toBeNull()
    expect(getMissedWait('r-shell')).toBeNull()
    expect(summary()).toMatchObject({ total: 0, missedTotal: 0 })
  })

  it('a push received after the request was sent wins over the snapshot', () => {
    setTerminalAttention(waiting('r-shell'))
    const mark = attentionChangeMark()
    setTerminalAttention(waiting('r-claude')) // arrives while the request is in flight
    const result = reconcileTerminalAttention([gone('r-shell'), alive('r-claude')], mark)
    expect(result).toEqual({ gone: 1, applied: 0, skipped: 1 })
    expect(getTerminalAttention('r-claude')).toMatchObject({ blockedReason: 'input' })
  })

  it('a gone tab loses its running turn (T0694 ↻ state), as a PTY exit', () => {
    setTerminalAttention(ev('r-shell', { busy: true }))
    expect(isWorkerResumedAfterReport('r-shell')).toBe(true)
    reconcileTerminalAttention([gone('r-shell')], attentionChangeMark())
    expect(isWorkerResumedAfterReport('r-shell')).toBe(false)
  })

  it('ignores malformed entries', () => {
    setTerminalAttention(waiting('r-shell'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = reconcileTerminalAttention([null as any, { id: '' } as any, alive('r-shell', waiting('other-id'))], attentionChangeMark())
    expect(result.applied).toBe(1)
    expect(getTerminalAttention('r-shell')).toBeNull() // an attention for another id is not applied to this tab
  })
})

describe('createReconnectAttentionReconciler', () => {
  const status = (connected: boolean) => ({ profileId: 'p-wsl', connected })

  it('connected after not connected → asks once for the window tabs + attention tabs and applies', async () => {
    setTerminalAttention(waiting('r-shell'))
    setTerminalAttention(waiting('elsewhere')) // held by this window, not in its list
    const snapshot = vi.fn(async (ids: string[]) => ids.map(id => (id === 'r-claude' ? alive(id) : gone(id))))
    const log = vi.fn()
    const reconciler = createReconnectAttentionReconciler({ snapshot, terminalIds: () => TABS.map(t => t.id), log })
    await reconciler.onStatus(status(true)) // first status seen: nothing missed yet
    expect(snapshot).not.toHaveBeenCalled()
    await reconciler.onStatus(status(false))
    expect(snapshot).not.toHaveBeenCalled()
    await reconciler.onStatus(status(true))
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(snapshot.mock.calls[0][0].sort()).toEqual(['elsewhere', 'r-claude', 'r-shell'])
    expect(getTerminalAttention('r-shell')).toBeNull()
    expect(getTerminalAttention('elsewhere')).toBeNull()
    expect(summary().total).toBe(0)
    expect(log.mock.calls.at(-1)?.[0]).toMatch(/^\[attention\] reconnect reconcile profile=p-wsl ids=3 gone=2 applied=1 skipped=0$/)
    await reconciler.onStatus(status(true)) // still connected: not asked again
    expect(snapshot).toHaveBeenCalledTimes(1)
  })

  it('the first status is a disconnect → the next connect asks', async () => {
    const snapshot = vi.fn(async (ids: string[]) => ids.map(gone))
    const reconciler = createReconnectAttentionReconciler({ snapshot, terminalIds: () => ['r-shell'] })
    await reconciler.onStatus(status(false))
    await reconciler.onStatus(status(true))
    expect(snapshot).toHaveBeenCalledTimes(1)
  })

  it('a failed request (older bat-server, disconnected again) keeps the state', async () => {
    setTerminalAttention(waiting('r-shell'))
    const log = vi.fn()
    const reconciler = createReconnectAttentionReconciler({
      snapshot: async () => { throw new Error('No handler for channel: terminal:attention-snapshot') },
      terminalIds: () => ['r-shell'],
      log,
    })
    await reconciler.onStatus(status(false))
    await reconciler.onStatus(status(true))
    expect(getTerminalAttention('r-shell')).toMatchObject({ blockedReason: 'input' })
    expect(log.mock.calls.at(-1)?.[0]).toMatch(/not reconciled \(No handler for channel/)
  })

  it('no tab at all → no request', async () => {
    const snapshot = vi.fn(async () => [])
    const reconciler = createReconnectAttentionReconciler({ snapshot, terminalIds: () => [] })
    await reconciler.onStatus(status(false))
    await reconciler.onStatus(status(true))
    expect(snapshot).not.toHaveBeenCalled()
  })
})

describe('two profiles, two windows (each its own renderer)', () => {
  it('one window reconnecting never changes the other window', async () => {
    vi.resetModules()
    const winA = await import('../terminal-attention-store')
    vi.resetModules()
    const winB = await import('../terminal-attention-store')
    expect(winA).not.toBe(winB)
    winA.setTerminalAttention(waiting('a-tab'))
    winB.setTerminalAttention(waiting('b-tab'))
    const snapshotA = vi.fn(async (ids: string[]) => ids.map(gone))
    const snapshotB = vi.fn(async (ids: string[]) => ids.map(gone))
    const reconcilerA = winA.createReconnectAttentionReconciler({ snapshot: snapshotA, terminalIds: () => ['a-tab'] })
    winB.createReconnectAttentionReconciler({ snapshot: snapshotB, terminalIds: () => ['b-tab'] })
    // only profile A's windows get A's status events (main: getWindowsForProfile)
    await reconcilerA.onStatus({ profileId: 'p-a', connected: false })
    await reconcilerA.onStatus({ profileId: 'p-a', connected: true })
    expect(snapshotA).toHaveBeenCalledWith(['a-tab'])
    expect(snapshotB).not.toHaveBeenCalled()
    expect(winA.getTerminalAttention('a-tab')).toBeNull()
    expect(winB.getTerminalAttention('b-tab')).toMatchObject({ blockedReason: 'input' })
    winA.resetTerminalAttention()
    winB.resetTerminalAttention()
  })
})
