/**
 * PLAN-068 W3 / T0905: renderer side of the Tower turn cards (src/stores/tower-cards-store.ts) —
 * apply / skip by revision, `tower-cards:changed` → refetch of that tab, start fetch, reconnect
 * reconcile (T0749's pattern), pty exit, failures keep what the window has.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  applyTowerCardsEntries,
  createTowerCardsSync,
  forgetTowerCards,
  getTowerCards,
  resetTowerCardsStore,
  towerCardsUnread,
  towerCardTerminalIds,
  useTowerCards,
} from '../tower-cards-store'
import type { TowerCard, TowerCardsChangedEvent, TowerCardsEntry, TowerCardsListResult } from '../../types/tower-cards'

const card = (id: string, extra: Partial<TowerCard> = {}): TowerCard => ({
  id, terminalId: 'tw', source: 'hook', text: `text ${id}`, truncated: false, createdAt: 1, read: false, pinned: false, ...extra,
})
const entry = (terminalId: string, revision: number, cards: TowerCard[], extra: Partial<TowerCardsEntry> = {}): TowerCardsEntry => ({
  terminalId, alive: true, revision, cards, unread: cards.filter(c => !c.read).length, stopsWithoutMessage: 0, ...extra,
})
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => resetTowerCardsStore())

describe('applyTowerCardsEntries', () => {
  it('stores, replaces with a newer revision, skips an older one unless forced; empty / gone drops', () => {
    expect(applyTowerCardsEntries([entry('tw', 2, [card('a')])])).toBe(1)
    expect(getTowerCards('tw')?.cards.map(c => c.id)).toEqual(['a'])
    expect(towerCardsUnread('tw')).toBe(1)
    expect(applyTowerCardsEntries([entry('tw', 1, [card('old')])])).toBe(0)
    expect(applyTowerCardsEntries([entry('tw', 3, [card('a', { read: true }), card('b')])])).toBe(1)
    expect(towerCardsUnread('tw')).toBe(1)
    expect(applyTowerCardsEntries([entry('tw', 1, [card('x')])], { force: true })).toBe(1)
    expect(getTowerCards('tw')?.cards.map(c => c.id)).toEqual(['x'])
    expect(applyTowerCardsEntries([entry('tw', 9, [])])).toBe(1)
    expect(getTowerCards('tw')).toBeNull()
    applyTowerCardsEntries([entry('tw', 10, [card('y')])])
    expect(applyTowerCardsEntries([entry('tw', 11, [card('y')], { alive: false })])).toBe(1)
    expect(getTowerCards('tw')).toBeNull()
    // a contract-2 Tower with only message-less stops is kept (G7 hint)
    applyTowerCardsEntries([entry('tw', 12, [], { stopsWithoutMessage: 2 })])
    expect(getTowerCards('tw')).toMatchObject({ cards: [], stopsWithoutMessage: 2 })
    // junk is ignored
    expect(applyTowerCardsEntries([null, 3, { terminalId: '' }, { terminalId: 'z', revision: 'x', cards: [] }])).toBe(0)
  })

  it('useTowerCards re-renders on changes; forgetTowerCards drops a tab', () => {
    const { result } = renderHook(() => useTowerCards('tw'))
    expect(result.current).toBeNull()
    act(() => { applyTowerCardsEntries([entry('tw', 1, [card('a')])]) })
    expect(result.current?.cards.map(c => c.id)).toEqual(['a'])
    act(() => forgetTowerCards('tw'))
    expect(result.current).toBeNull()
    expect(towerCardTerminalIds()).toEqual([])
  })
})

function fakeApi() {
  let onChanged: ((info: TowerCardsChangedEvent) => void) | null = null
  const host = new Map<string, TowerCardsEntry>()
  const list = vi.fn(async (ids?: string[]): Promise<TowerCardsListResult> => ({
    ok: true,
    entries: (ids ?? [...host.keys()]).map(id => host.get(id) ?? entry(id, 0, [], { alive: false })),
  }))
  return {
    host,
    list,
    api: { list, onChanged: (cb: (info: TowerCardsChangedEvent) => void) => { onChanged = cb; return () => { onChanged = null } } },
    fire: (info: TowerCardsChangedEvent) => onChanged?.(info),
    subscribed: () => onChanged !== null,
  }
}

describe('createTowerCardsSync', () => {
  it('start: fetches the window tabs once; a changed event refetches that tab; an event not newer than the copy is ignored', async () => {
    const f = fakeApi()
    f.host.set('tw', entry('tw', 5, [card('a')]))
    const logs: string[] = []
    const sync = createTowerCardsSync({ api: f.api, terminalIds: () => ['tw', 'other'], log: m => logs.push(m) })
    const stop = sync.start()
    await flush()
    expect(f.list).toHaveBeenCalledWith(['tw', 'other'])
    expect(getTowerCards('tw')?.revision).toBe(5)
    f.host.set('tw', entry('tw', 6, [card('a'), card('b')]))
    f.fire({ terminalId: 'tw', revision: 6, unread: 2, total: 2 })
    await flush()
    expect(f.list).toHaveBeenLastCalledWith(['tw'])
    expect(getTowerCards('tw')?.cards.map(c => c.id)).toEqual(['a', 'b'])
    const calls = f.list.mock.calls.length
    f.fire({ terminalId: 'tw', revision: 6, unread: 2, total: 2 })
    await flush()
    expect(f.list.mock.calls.length).toBe(calls)
    expect(logs.join('\n')).not.toContain('text ')
    stop()
    expect(f.subscribed()).toBe(false)
  })

  it('the host cleared a tab (PTY ended): the refetch drops the copy', async () => {
    const f = fakeApi()
    f.host.set('tw', entry('tw', 5, [card('a')]))
    const sync = createTowerCardsSync({ api: f.api, terminalIds: () => ['tw'] })
    sync.start()
    await flush()
    f.host.delete('tw')
    f.host.set('tw', entry('tw', 7, [], { alive: false }))
    f.fire({ terminalId: 'tw', revision: 7, unread: 0, total: 0 })
    await flush()
    expect(getTowerCards('tw')).toBeNull()
  })

  it('reconnect (not connected → connected): one forced fetch of the window and held tabs; the first status never fetches', async () => {
    const f = fakeApi()
    const sync = createTowerCardsSync({ api: f.api, terminalIds: () => ['tw'] })
    applyTowerCardsEntries([entry('held', 50, [card('h')]), entry('tw', 40, [card('a')])])
    await sync.onStatus({ connected: true })
    expect(f.list).not.toHaveBeenCalled()
    await sync.onStatus({ connected: false })
    // a restarted server: revisions start again, it has no cards for `held`
    f.host.set('tw', entry('tw', 1, [card('new')]))
    await sync.onStatus({ connected: true, profileId: 'p1' })
    expect(f.list).toHaveBeenCalledWith(['tw', 'held'])
    expect(getTowerCards('tw')?.cards.map(c => c.id)).toEqual(['new'])
    expect(getTowerCards('held')).toBeNull()
  })

  it('a failed or refused fetch keeps what the window has (an older bat-server without the handler)', async () => {
    applyTowerCardsEntries([entry('tw', 3, [card('a')])])
    const logs: string[] = []
    const failing = { list: vi.fn(async () => { throw new Error('No handler for channel: tower-cards:list') }), onChanged: () => () => {} }
    await createTowerCardsSync({ api: failing, terminalIds: () => ['tw'], log: m => logs.push(m) }).refresh()
    const refused = { list: vi.fn(async (): Promise<TowerCardsListResult> => ({ ok: false, code: 'FORBIDDEN' })), onChanged: () => () => {} }
    await createTowerCardsSync({ api: refused, terminalIds: () => ['tw'], log: m => logs.push(m) }).refresh(['tw'], { force: true })
    expect(getTowerCards('tw')?.cards.map(c => c.id)).toEqual(['a'])
    expect(logs).toEqual([
      '[tower-cards] refresh ids=1 → not fetched (No handler for channel: tower-cards:list)',
      '[tower-cards] refresh ids=1 → FORBIDDEN',
    ])
  })

  it('pty exit and client status are wired by start()', async () => {
    const f = fakeApi()
    let exit: ((id: string) => void) | null = null
    let status: ((s: { connected: boolean }) => void) | null = null
    const sync = createTowerCardsSync({
      api: f.api,
      terminalIds: () => [],
      onPtyExit: cb => { exit = cb; return () => { exit = null } },
      onClientStatusChanged: cb => { status = cb; return () => { status = null } },
    })
    const stop = sync.start()
    applyTowerCardsEntries([entry('tw', 1, [card('a')])])
    exit!('tw')
    expect(getTowerCards('tw')).toBeNull()
    expect(status).not.toBeNull()
    stop()
    expect(exit).toBeNull()
    expect(status).toBeNull()
  })
})
