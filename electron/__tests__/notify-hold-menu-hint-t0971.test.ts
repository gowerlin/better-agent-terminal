// @vitest-environment node
/**
 * T0971 / BUG-237: the Inbox hint line asks the host (`tower-inbox:menu-hint`, read only) which `U-n` an
 * answer would close the Tower's menu for — the same decision `considerMenuEsc` makes (`menuEscDecision`).
 *
 *   - `menuEscPreview`: `question` + a matching record → the ids; a `menu_open` left from an earlier menu
 *     (`stale`, T0969 H-7) / written after this menu (`not-this-menu`) → none; the record alone (`via: 'menu'`,
 *     T0968 Q-2) → the ids; not a contract-2 Tower / no record / no menu → none
 *   - every case agrees with what the held answer actually does (an Esc or not)
 *   - the handler: a helper capability is refused, only `{ terminalId, menu }` with a menu object, nothing
 *     logged for an answered call; the channel is proxied and never a helper channel
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold must not import electron')
})

import {
  NotifyHoldController,
  registerTowerInboxMenuHintHandler,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import type { HandlerContext } from '../remote/handler-registry'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import { PROXIED_CHANNELS } from '../remote/protocol'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'
import type { MenuOpen } from '../../src/lib/tower-inbox'

const ESC = '\x1b'
const LOCAL: HandlerContext = { windowId: 'win-1' }
const TOWER_HELPER: HandlerContext = { windowId: null, connectionId: 'c', helper: { terminalId: 'tower', role: 'tower' } }
const OPENED_AT = '2026-11-28T12:23:00+08:00'
const RECORD_AT = Date.parse('2026-11-28T12:23:20+08:00')
const MENU: MenuOpen = { ids: ['U-57', 'U-58'], openedAt: OPENED_AT }
/** T0969 H-7: `menu_open` an hour older than the menu now open (CT stopped before its next write). */
const LEFTOVER: MenuOpen = { ids: ['U-57'], openedAt: '2026-11-28T11:23:00+08:00' }
const LATER: MenuOpen = { ids: ['U-57'], openedAt: '2026-11-28T12:24:00+08:00' }

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  menus = new Map<string, number>()
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(): BlockedDetection { return 'hook' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return { ok: true }
  }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.role.get(id) === 'tower' ? this.contract.get(id) : undefined }
  hasOpenQuestionMenu(id: string): boolean { return this.menus.has(id) }
  getQuestionMenuOpenedAt(id: string): number | null { return this.menus.get(id) ?? null }
  closeQuestionMenu(id: string): boolean {
    const had = this.menus.delete(id)
    if (this.blocked.get(id)?.reason === 'question') {
      this.blocked.delete(id)
      return true
    }
    return had
  }
  getLastOutputAt(): number | null { return null }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: () => true,
    logger: { log: (m) => { lines.push(m) } },
    now: () => Date.now(),
  })
  const menu = (at = RECORD_AT) => {
    pm.blocked.set('tower', { reason: 'question', since: at, event: 'ask-user-question' })
    pm.menus.set('tower', at)
    controller.onBlockedChange('tower')
  }
  const escs = () => pm.writes.filter(([, d]) => d === ESC).length
  return { pm, controller, lines, menu, escs }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(RECORD_AT + 5_000)
})
afterEach(() => { vi.useRealTimers() })

describe('menuEscPreview', () => {
  it('`question` and the record of this menu → every id, via question', () => {
    const s = setup()
    s.menu()
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: ['U-57', 'U-58'], via: 'question', decision: 'esc' })
  })

  it('BUG-237 (T0969 H-7): a menu_open left from an earlier menu, another menu open → nothing (stale)', () => {
    const s = setup()
    s.menu()
    expect(s.controller.menuEscPreview('tower', LEFTOVER)).toEqual({ ids: [], via: 'question', decision: 'stale' })
    expect(s.controller.menuEscPreview('tower', LATER)).toEqual({ ids: [], via: 'question', decision: 'not-this-menu' })
  })

  it('T0968 Q-2: the record alone (a key / click cleared `question`) → the ids, via menu', () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower')
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: ['U-57', 'U-58'], via: 'menu', decision: 'esc' })
  })

  it('nothing BAT could close: no record and no `question`, another prompt, not a contract-2 Tower, gone', () => {
    const s = setup()
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: [], via: null, decision: 'no-menu' })
    s.menu()
    s.pm.blocked.set('tower', { reason: 'permission', since: 1 })
    expect(s.controller.menuEscPreview('tower', MENU).ids).toEqual([])
    s.pm.blocked.set('tower', { reason: 'question', since: 1 })
    s.pm.contract.set('tower', 1)
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: [], via: null, decision: 'no-menu' })
    s.pm.contract.set('tower', 2)
    s.pm.alive.delete('tower')
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: [], via: null, decision: 'no-menu' })
  })

  it('`question` without a record → nothing (no-record)', () => {
    const s = setup()
    s.pm.blocked.set('tower', { reason: 'question', since: 1 })
    expect(s.controller.menuEscPreview('tower', MENU)).toEqual({ ids: [], via: 'question', decision: 'no-record' })
  })

  it.each([
    ['question, this menu', MENU, false, true],
    ['question, a leftover menu_open', LEFTOVER, false, false],
    ['question, a later menu_open', LATER, false, false],
    ['the record alone, this menu', MENU, true, true],
    ['the record alone, a leftover menu_open', LEFTOVER, true, false],
  ] as const)('agrees with the held answer: %s', async (_name, menu, recordOnly, esc) => {
    const s = setup()
    s.menu()
    if (recordOnly) s.pm.blocked.delete('tower')
    const preview = s.controller.menuEscPreview('tower', menu)
    expect(preview.ids.includes('U-57')).toBe(esc)
    s.controller.enqueueAnswer('tower', 'U-57：A', { menu })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.escs()).toBe(esc ? 1 : 0)
  })

  it('changes nothing: no write, no log, the queue untouched', () => {
    const s = setup()
    s.menu()
    s.controller.menuEscPreview('tower', MENU)
    s.controller.menuEscPreview('tower', LEFTOVER)
    expect(s.pm.writes).toEqual([])
    expect(s.lines).toEqual([])
    expect(s.controller.list('tower')).toEqual([])
    expect(s.pm.menus.has('tower')).toBe(true)
  })
})

describe('tower-inbox:menu-hint', () => {
  function handler(controller: Pick<NotifyHoldController, 'menuEscPreview'> | null) {
    const lines: string[] = []
    const handlers = new Map<string, (ctx: HandlerContext, raw?: unknown) => unknown>()
    registerTowerInboxMenuHintHandler({
      registerHandler: (channel, fn) => { handlers.set(channel, fn as (ctx: HandlerContext, raw?: unknown) => unknown) },
      getNotifyHold: () => controller,
      logger: { log: (m) => { lines.push(m) } },
    })
    return { handlers, lines, call: (ctx: HandlerContext, raw: unknown) => handlers.get('tower-inbox:menu-hint')!(ctx, raw) }
  }

  it('the window asks → the preview; nothing logged', () => {
    const s = setup()
    s.menu()
    const h = handler(s.controller)
    expect([...h.handlers.keys()]).toEqual(['tower-inbox:menu-hint'])
    expect(h.call(LOCAL, { terminalId: 'tower', menu: MENU })).toEqual({ ok: true, ids: ['U-57', 'U-58'], via: 'question', decision: 'esc' })
    expect(h.call(LOCAL, { terminalId: 'tower', menu: LEFTOVER })).toEqual({ ok: true, ids: [], via: 'question', decision: 'stale' })
    expect(h.lines).toEqual([])
  })

  it('a helper capability is refused (FORBIDDEN), logged without ids', () => {
    const s = setup()
    const h = handler(s.controller)
    expect(h.call(TOWER_HELPER, { terminalId: 'tower', menu: MENU })).toEqual({ ok: false, reason: 'FORBIDDEN' })
    expect(h.lines).toEqual(['[tower-inbox] menu-hint refused: helper capability terminal=tower'])
  })

  it.each([
    undefined, null, 'tower', [], {}, { terminalId: '' }, { terminalId: 'tower' }, { terminalId: 'tower', menu: null },
    { terminalId: 'tower', menu: { ids: 'U-57', openedAt: OPENED_AT } }, { terminalId: 'tower', menu: { ids: ['U-57'] } },
    { terminalId: 3, menu: MENU }, { terminalId: 'x'.repeat(257), menu: MENU },
  ])('%j → INVALID_ARGS', (raw) => {
    const s = setup()
    expect(handler(s.controller).call(LOCAL, raw)).toEqual({ ok: false, reason: 'INVALID_ARGS' })
  })

  it('no controller → unavailable', () => {
    expect(handler(null).call(LOCAL, { terminalId: 'tower', menu: MENU })).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('proxied like tower-inbox:answer, never a helper channel; registered on both hosts; preload is additive', () => {
    expect(PROXIED_CHANNELS.has('tower-inbox:menu-hint')).toBe(true)
    expect(Object.keys(HELPER_CHANNEL_ROLES)).not.toContain('tower-inbox:menu-hint')
    const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
    const headless = readFileSync(resolve(__dirname, '../remote/headless-entry.ts'), 'utf8')
    expect(main).toContain('registerTowerInboxMenuHintHandler({ registerHandler, getNotifyHold: () => notifyHold, logger })')
    expect(headless).toContain('registerTowerInboxMenuHintHandler({ registerHandler: register, getNotifyHold: () => notifyHold, logger: defaultLogger })')
    const preload = readFileSync(resolve(__dirname, '../preload.ts'), 'utf8')
    expect(preload).toContain(`ipcRenderer.invoke('tower-inbox:menu-hint', { terminalId, menu })`)
    // T0968's answer call is unchanged
    expect(preload).toContain(`ipcRenderer.invoke('tower-inbox:answer', menu === undefined ? { terminalId, text } : { terminalId, text, menu })`)
  })
})
