/**
 * PLAN-068 W3 / T0905 (T0902 §2.3 / §3 / §7.4, D328 R1′): the Tower turn card store
 * (electron/tower-cards.ts) and its `tower-cards:*` handlers.
 *
 *   only a contract-2 Tower keeps cards (towerContractStatus `match`); every other tab: dropped, no text logged
 *   masked on receipt, cut to 16 KiB UTF-8 bytes (marked), 30 unpinned + 10 pinned per tab
 *   read / pinned / cleared on the host, `tower-cards:changed` carries counts only
 *   session id + content hash de-duplication within the window
 *   PTY end / ⏻ / recovery clear; panels only after setPanelTower
 *   handlers refuse a helper capability; not in HELPER_CHANNEL_ROLES
 */
import { describe, expect, it } from 'vitest'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import { PROXIED_CHANNELS, PROXIED_EVENTS } from '../remote/protocol'
import {
  normalizeTowerCardIds,
  registerTowerCardHandlers,
  TOWER_CARD_MAX_BYTES,
  TOWER_CARDS_CHANGED_CHANNEL,
  TOWER_CARDS_DEDUPE_WINDOW_MS,
  TOWER_CARDS_MAX,
  TOWER_CARDS_PINNED_MAX,
  TowerCardStore,
  truncateUtf8,
} from '../tower-cards'
import type { HandlerContext } from '../remote/handler-registry'
import type { TowerCardsChangedEvent, TowerCardsEntry } from '../../src/types/tower-cards'

const SECRET_TOKEN = 'srv-token-0123456789abcdef0123456789abcdef'

function setup(opts: { roles?: Record<string, string>; contracts?: Record<string, number>; sessions?: Record<string, string> } = {}) {
  const roles = { ...(opts.roles ?? { tower: 'tower', old: 'tower', newer: 'tower' }) }
  const contracts = { ...(opts.contracts ?? { tower: 2, newer: 3 }) }
  const alive = new Set(['tower', 'old', 'newer', 'shell'])
  const logs: string[] = []
  const events: TowerCardsChangedEvent[] = []
  let now = 1_000_000
  const store = new TowerCardStore({
    getTerminalRole: id => roles[id],
    getTowerContract: id => (roles[id] === 'tower' ? contracts[id] : undefined),
    isAlive: id => alive.has(id),
    getSessionId: id => opts.sessions?.[id] ?? null,
    knownSecrets: () => [SECRET_TOKEN],
    emit: (channel, payload) => {
      expect(channel).toBe(TOWER_CARDS_CHANGED_CHANNEL)
      events.push(payload as TowerCardsChangedEvent)
      return 1
    },
    logger: { log: (...args: unknown[]) => logs.push(args.map(String).join(' ')) },
    now: () => now,
  })
  return {
    store, logs, events, roles, contracts, alive,
    advance: (ms: number) => { now += ms },
    stop: (id: string, text?: string, truncated?: boolean) => store.offerHookStop(id, text === undefined ? {} : { message: { text, ...(truncated ? { truncated } : {}) } }),
    entry: (id: string): TowerCardsEntry => store.list([id])[0],
  }
}

describe('truncateUtf8 / normalizeTowerCardIds', () => {
  it('cuts on a character boundary', () => {
    expect(truncateUtf8('abc', 2)).toEqual({ text: 'ab', truncated: true })
    expect(truncateUtf8('塔台', 5)).toEqual({ text: '塔', truncated: true })
    expect(truncateUtf8('a😀', 4)).toEqual({ text: 'a', truncated: true })
    expect(truncateUtf8('x'.repeat(TOWER_CARD_MAX_BYTES))).toEqual({ text: 'x'.repeat(TOWER_CARD_MAX_BYTES), truncated: false })
  })

  it('ids: strings only, de-duplicated; not an array → null', () => {
    expect(normalizeTowerCardIds(['a', 'a', '', 3, 'b'])).toEqual(['a', 'b'])
    expect(normalizeTowerCardIds('a')).toBeNull()
  })
})

describe('TowerCardStore: who keeps cards (§6′, R1′)', () => {
  it('only a declared Tower with contract 2; others dropped (one log line per tab, length only, never the text)', () => {
    const t = setup({ roles: { tower: 'tower', old: 'tower', newer: 'tower' }, contracts: { tower: 2, newer: 3 } })
    expect(t.stop('tower', 'TURN-ONE 完成')).toBe('added')
    expect(t.stop('old', 'OLD-TEXT')).toBe('not-tower') // declared no contract (ct-outdated)
    expect(t.stop('newer', 'NEWER-TEXT')).toBe('not-tower') // contract 3 (bat-outdated)
    expect(t.stop('shell', 'SHELL-TEXT')).toBe('not-tower') // not a Tower
    expect(t.stop('shell', 'SHELL-TEXT-2')).toBe('not-tower')
    expect(t.store.list().map(e => e.terminalId)).toEqual(['tower'])
    expect(t.entry('shell')).toMatchObject({ cards: [], alive: true })
    expect(t.logs.filter(l => l.includes('terminal=shell'))).toEqual(['[tower-cards] terminal=shell dropped: not a contract-2 Tower (length=10; logged once per tab)'])
    const all = t.logs.join('\n')
    for (const text of ['TURN-ONE', 'OLD-TEXT', 'NEWER-TEXT', 'SHELL-TEXT']) expect(all).not.toContain(text)
    expect(t.events.map(e => e.terminalId)).toEqual(['tower'])
  })

  it('a Tower that drops to no contract keeps no new card; back to 2 → kept again', () => {
    const t = setup()
    t.contracts.tower = 1
    expect(t.stop('tower', 'a')).toBe('not-tower')
    t.contracts.tower = 2
    expect(t.stop('tower', 'b')).toBe('added')
  })

  it('a stop without a message: counted for a contract-2 Tower (G7), nothing for others', () => {
    const t = setup()
    expect(t.stop('tower')).toBe('empty')
    expect(t.stop('tower')).toBe('empty')
    expect(t.stop('shell')).toBe('not-tower')
    expect(t.entry('tower')).toMatchObject({ cards: [], stopsWithoutMessage: 2 })
    expect(t.stop('tower', '   ')).toBe('empty')
  })
})

describe('TowerCardStore: content', () => {
  it('masked on receipt (known secret + patterns); the log says how many, never the text', () => {
    const t = setup()
    t.stop('tower', `token ${SECRET_TOKEN} and key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789`)
    const [card] = t.entry('tower').cards
    expect(card.text).not.toContain(SECRET_TOKEN)
    expect(card.text).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789')
    expect(t.logs.join('\n')).toMatch(/card added source=hook bytes=\d+ masked=2 cards=1/)
    expect(t.logs.join('\n')).not.toContain(SECRET_TOKEN)
  })

  it('cut to 16 KiB bytes (truncated); a message the hook already cut stays marked', () => {
    const t = setup()
    t.stop('tower', '台'.repeat(10_000))
    t.stop('tower', 'short, but the hook cut it', true)
    const [big, cut] = t.entry('tower').cards
    expect(Buffer.byteLength(big.text, 'utf8')).toBeLessThanOrEqual(TOWER_CARD_MAX_BYTES)
    expect(big.truncated).toBe(true)
    expect(cut).toMatchObject({ text: 'short, but the hook cut it', truncated: true })
  })

  it('a card: id, terminal, source, text, times; unread; createdAt from the host clock', () => {
    const t = setup()
    t.stop('tower', 'hello')
    expect(t.entry('tower')).toMatchObject({
      terminalId: 'tower',
      alive: true,
      unread: 1,
      stopsWithoutMessage: 0,
      cards: [{ terminalId: 'tower', source: 'hook', text: 'hello', truncated: false, createdAt: 1_000_000, read: false, pinned: false }],
    })
    expect(t.entry('tower').cards[0].id).toMatch(/^tc-[0-9a-f]{6}-1$/)
    expect(Object.keys(t.entry('tower').cards[0]).sort()).toEqual(['createdAt', 'id', 'pinned', 'read', 'source', 'terminalId', 'text', 'truncated'])
  })
})

describe('TowerCardStore: limits 30 / 10', () => {
  it(`keeps the latest ${TOWER_CARDS_MAX} unpinned cards; pinned ones are kept apart`, () => {
    const t = setup()
    for (let i = 1; i <= 3; i++) t.stop('tower', `pin-${i}`)
    const pins = t.entry('tower').cards.map(c => c.id)
    for (const id of pins) expect(t.store.setPinned('tower', id, true)).toEqual({ ok: true, changed: 1 })
    for (let i = 1; i <= 40; i++) t.stop('tower', `turn-${i}`)
    const cards = t.entry('tower').cards
    expect(cards.filter(c => c.pinned).map(c => c.text)).toEqual(['pin-1', 'pin-2', 'pin-3'])
    const unpinned = cards.filter(c => !c.pinned).map(c => c.text)
    expect(unpinned).toHaveLength(TOWER_CARDS_MAX)
    expect(unpinned[0]).toBe('turn-11')
    expect(unpinned.at(-1)).toBe('turn-40')
    expect(t.logs.join('\n')).toContain('evicted=1')
  })

  it(`pinning beyond ${TOWER_CARDS_PINNED_MAX} → PIN_LIMIT; unpin returns it to the 30 (the oldest unpinned may go)`, () => {
    const t = setup()
    for (let i = 1; i <= TOWER_CARDS_MAX + TOWER_CARDS_PINNED_MAX; i++) t.stop('tower', `c-${i}`)
    const ids = t.entry('tower').cards.map(c => c.id)
    expect(ids).toHaveLength(TOWER_CARDS_MAX)
    for (const id of ids.slice(0, TOWER_CARDS_PINNED_MAX)) expect(t.store.setPinned('tower', id, true)).toMatchObject({ ok: true })
    expect(t.store.setPinned('tower', ids[TOWER_CARDS_PINNED_MAX], true)).toEqual({ ok: false, code: 'PIN_LIMIT' })
    expect(t.store.setPinned('tower', ids[0], true)).toEqual({ ok: true, changed: 0 })
    expect(t.store.setPinned('tower', 'nope', true)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(t.store.setPinned('ghost', ids[0], true)).toEqual({ ok: false, code: 'NOT_FOUND' })
    for (let i = 0; i < TOWER_CARDS_PINNED_MAX; i++) t.stop('tower', `more-${i}`)
    expect(t.entry('tower').cards).toHaveLength(TOWER_CARDS_MAX + TOWER_CARDS_PINNED_MAX)
    expect(t.store.setPinned('tower', ids[0], false)).toEqual({ ok: true, changed: 1 })
    expect(t.entry('tower').cards).toHaveLength(TOWER_CARDS_MAX + TOWER_CARDS_PINNED_MAX - 1)
  })
})

describe('TowerCardStore: read / clear / events', () => {
  it('mark read (some / all), clear (some / unpinned / all); every change → one changed event, counts only', () => {
    const t = setup()
    for (const text of ['SECRET-ONE', 'two', 'three']) t.stop('tower', text)
    const [a, b, c] = t.entry('tower').cards.map(x => x.id)
    expect(t.store.markRead('tower', [a])).toEqual({ ok: true, changed: 1 })
    expect(t.entry('tower').unread).toBe(2)
    expect(t.store.markRead('tower')).toEqual({ ok: true, changed: 2 })
    expect(t.store.markRead('tower')).toEqual({ ok: true, changed: 0 })
    expect(t.store.markRead('ghost')).toEqual({ ok: true, changed: 0 })
    t.store.setPinned('tower', c, true)
    expect(t.store.clear('tower', { cardIds: [a] })).toEqual({ ok: true, changed: 1 })
    expect(t.store.clear('tower')).toEqual({ ok: true, changed: 1 }) // b; c is pinned
    expect(t.entry('tower').cards.map(x => x.id)).toEqual([c])
    expect(t.store.clear('tower', { includePinned: true })).toEqual({ ok: true, changed: 1 })
    expect(b).toBeTruthy()
    const revisions = t.events.map(e => e.revision)
    expect(revisions).toEqual([...revisions].sort((x, y) => x - y))
    expect(new Set(revisions).size).toBe(revisions.length)
    expect(t.events.at(-1)).toMatchObject({ terminalId: 'tower', unread: 0, total: 0 })
    expect(JSON.stringify(t.events)).not.toContain('SECRET-ONE')
    for (const e of t.events) expect(Object.keys(e).sort()).toEqual(['revision', 'terminalId', 'total', 'unread'])
  })

  it('a tab without cards answers a revision not older than any it had (a window drops its copy)', () => {
    const t = setup()
    t.stop('tower', 'x')
    const had = t.entry('tower').revision
    t.store.terminalEnded('tower')
    expect(t.entry('tower').revision).toBeGreaterThanOrEqual(had)
  })
})

describe('TowerCardStore: de-duplication (§7.4)', () => {
  it('same session + same content within the window → one card; later, another session or other content → kept', () => {
    const t = setup({ sessions: { tower: '0f3c2a9e-6b1d-4c8e-9a7f-1d2e3f4a5b6c' } })
    expect(t.stop('tower', 'same turn')).toBe('added')
    expect(t.stop('tower', 'same turn')).toBe('duplicate') // injected + plugin of one Stop
    expect(t.stop('tower', 'other turn')).toBe('added')
    t.advance(TOWER_CARDS_DEDUPE_WINDOW_MS)
    expect(t.stop('tower', 'same turn')).toBe('added') // a later turn that said the same
    expect(t.entry('tower').cards).toHaveLength(3)
    expect(t.logs.join('\n')).toContain('duplicate dropped (source=hook')
  })
})

describe('TowerCardStore: lifecycle', () => {
  it('PTY end (exit / kill, so ⏻ too) clears the tab; recovery clears every PTY tab but not a panel', () => {
    const t = setup()
    t.stop('tower', 'a')
    t.store.terminalEnded('tower')
    expect(t.entry('tower').cards).toEqual([])
    expect(t.events.at(-1)).toMatchObject({ terminalId: 'tower', total: 0, unread: 0 })
    t.stop('tower', 'b')
    t.store.setPanelTower('panel-1', true)
    t.store.offerPanelMessage('panel-1', 'panel turn')
    t.store.serverRecovered()
    expect(t.entry('tower').cards).toEqual([])
    expect(t.entry('panel-1').cards.map(c => c.text)).toEqual(['panel turn'])
    expect(t.logs.join('\n')).toContain('(Terminal Server recovery)')
    t.store.dispose()
    expect(t.store.list()).toEqual([])
  })

  it('the Claude panel source: only after setPanelTower(true); off / disposed clears it', () => {
    const t = setup()
    expect(t.store.offerPanelMessage('panel-1', 'PANEL-SECRET')).toBe('not-tower')
    expect(t.logs.join('\n')).not.toContain('PANEL-SECRET')
    t.store.setPanelTower('panel-1', true)
    expect(t.store.isPanelTower('panel-1')).toBe(true)
    expect(t.store.offerPanelMessage('panel-1', 'turn 1')).toBe('added')
    expect(t.entry('panel-1')).toMatchObject({ alive: true, cards: [{ source: 'panel', text: 'turn 1' }] })
    expect(t.store.list().map(e => e.terminalId)).toEqual(['panel-1'])
    t.store.setPanelTower('panel-1', false)
    expect(t.entry('panel-1')).toMatchObject({ alive: false, cards: [] })
    expect(t.store.offerPanelMessage('panel-1', 'turn 2')).toBe('not-tower')
    t.store.setPanelTower('panel-2', true)
    t.store.offerPanelMessage('panel-2', 'x')
    t.store.terminalEnded('panel-2', 'panel session disposed')
    expect(t.store.isPanelTower('panel-2')).toBe(false)
    expect(t.entry('panel-2').cards).toEqual([])
  })
})

describe('tower-cards:* handlers', () => {
  function handlers(store: TowerCardStore | null) {
    const map = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const logs: string[] = []
    registerTowerCardHandlers({
      registerHandler: (channel, handler) => map.set(channel, handler),
      getStore: () => store,
      logger: { log: (...a: unknown[]) => logs.push(a.map(String).join(' ')) },
    })
    return { map, logs, call: (channel: string, ctx: HandlerContext, ...args: unknown[]) => map.get(channel)!(ctx, ...args) }
  }
  const local: HandlerContext = { windowId: 'w1' }
  const helper: HandlerContext = { windowId: null, connectionId: 'c1', helper: { terminalId: 'tower', role: 'tower' } }

  it('registers the four channels; all proxied; the event is proxied; none is a helper channel', () => {
    const { map } = handlers(null)
    const channels = ['tower-cards:list', 'tower-cards:mark-read', 'tower-cards:pin', 'tower-cards:clear']
    expect([...map.keys()]).toEqual(channels)
    for (const channel of channels) {
      expect(PROXIED_CHANNELS.has(channel)).toBe(true)
      expect(Object.hasOwn(HELPER_CHANNEL_ROLES, channel)).toBe(false)
    }
    expect(PROXIED_EVENTS.has('tower-cards:changed')).toBe(true)
    expect(Object.keys(HELPER_CHANNEL_ROLES).filter(c => c.startsWith('tower-cards'))).toEqual([])
  })

  it('a helper capability is refused on every channel (FORBIDDEN, logged without content)', () => {
    const t = setup()
    t.stop('tower', 'TOWER-TURN')
    const { call, logs } = handlers(t.store)
    expect(call('tower-cards:list', helper, {})).toEqual({ ok: false, code: 'FORBIDDEN' })
    expect(call('tower-cards:mark-read', helper, { terminalId: 'tower' })).toEqual({ ok: false, code: 'FORBIDDEN' })
    expect(call('tower-cards:pin', helper, { terminalId: 'tower', cardId: 'x', pinned: true })).toEqual({ ok: false, code: 'FORBIDDEN' })
    expect(call('tower-cards:clear', helper, { terminalId: 'tower' })).toEqual({ ok: false, code: 'FORBIDDEN' })
    expect(t.entry('tower')).toMatchObject({ unread: 1 })
    expect(logs).toHaveLength(4)
    expect(logs.join('\n')).not.toContain('TOWER-TURN')
  })

  it('a window: list (all / ids), mark-read, pin, clear; bad args → INVALID_ARGS', () => {
    const t = setup()
    t.stop('tower', 'one')
    const { call } = handlers(t.store)
    const listed = call('tower-cards:list', local) as { ok: true; entries: TowerCardsEntry[] }
    expect(listed.ok).toBe(true)
    expect(listed.entries.map(e => e.terminalId)).toEqual(['tower'])
    const cardId = listed.entries[0].cards[0].id
    expect(call('tower-cards:list', local, { terminalIds: ['tower', 'shell'] })).toMatchObject({ ok: true, entries: [{ terminalId: 'tower' }, { terminalId: 'shell', cards: [] }] })
    expect(call('tower-cards:pin', local, { terminalId: 'tower', cardId, pinned: true })).toEqual({ ok: true, changed: 1 })
    expect(call('tower-cards:mark-read', local, { terminalId: 'tower', cardIds: [cardId] })).toEqual({ ok: true, changed: 1 })
    expect(call('tower-cards:clear', local, { terminalId: 'tower' })).toEqual({ ok: true, changed: 0 })
    expect(call('tower-cards:clear', local, { terminalId: 'tower', includePinned: true })).toEqual({ ok: true, changed: 1 })
    expect(call('tower-cards:list', local, 'x')).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(call('tower-cards:list', local, { terminalIds: 'tower' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(call('tower-cards:mark-read', local, {})).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(call('tower-cards:pin', local, { terminalId: 'tower', cardId, pinned: 'yes' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(call('tower-cards:clear', local, { terminalId: 'tower', includePinned: 1 })).toEqual({ ok: false, code: 'INVALID_ARGS' })
  })

  it('no store yet: empty answers, no throw', () => {
    const { call } = handlers(null)
    expect(call('tower-cards:list', local, { terminalIds: ['a'] })).toEqual({ ok: true, entries: [{ terminalId: 'a', alive: false, revision: 0, cards: [], unread: 0, stopsWithoutMessage: 0 }] })
    expect(call('tower-cards:mark-read', local, { terminalId: 'a' })).toEqual({ ok: true, changed: 0 })
    expect(call('tower-cards:pin', local, { terminalId: 'a', cardId: 'b', pinned: true })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })
})
