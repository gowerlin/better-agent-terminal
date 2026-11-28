// @vitest-environment node
/**
 * T0968 (CT 6.4.0-pre.1 `menu_open`, D492): which inbox answer may close a contract-2 Tower's open
 * AskUserQuestion menu, and Worker notifications while the menu record is open.
 *
 *   - `menu` sent with the answer (`tower-inbox:answer`): Esc only when one of the answer's U-n is in
 *     `menu.ids` and `opened_at` belongs to the open menu record (`menuEscDecision`); otherwise held until
 *     the menu closes, logged `menu esc skipped`
 *   - no `menu` (CT before 6.4.0, an older window, a malformed one) → exactly T0965
 *   - Worker notifications held by the menu record alone, never an Esc; sent once it closes
 *   - the tracker's record start time (`questionMenuOpenedAt`)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold must not import electron')
})

import {
  NOTIFY_HOLD_ENTER_DELAY_MS,
  NOTIFY_HOLD_MENU_OPENED_AFTER_MS,
  NOTIFY_HOLD_MENU_OPENED_BEFORE_MS,
  NOTIFY_HOLD_QUIET_MS,
  NotifyHoldController,
  menuEscDecision,
  registerTowerInboxAnswerHandler,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import type { HandlerContext } from '../remote/handler-registry'
import { TerminalBlockedTracker, type BlockedDetection, type BlockedState } from '../terminal-blocked-state'
import type { InboxMenuInfo } from '../../src/lib/tower-inbox'

const ESC = '\x1b'
const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const LOCAL: HandlerContext = { windowId: 'win-1' }
/** CT wrote `menu_open` at 12:23:00, the menu's hook reached BAT 20 s later. */
const OPENED_AT = '2026-11-28T12:23:00+08:00'
const RECORD_AT = Date.parse('2026-11-28T12:23:20+08:00')
const MENU: InboxMenuInfo = { ids: ['U-57', 'U-58'], openedAt: OPENED_AT }

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  menus = new Map<string, number>()
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  closed: string[] = []
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
  closeQuestionMenu(id: string, cause: string): boolean {
    this.closed.push(cause)
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
  const keypresses: NotifyHoldKeypress[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); return true },
    logger: { log: (m) => { lines.push(m) } },
    now: () => Date.now(),
  })
  /** claude's AskUserQuestion menu, its record begun at `at`. */
  const menu = (at = RECORD_AT) => {
    pm.blocked.set('tower', { reason: 'question', since: at, event: 'ask-user-question' })
    pm.menus.set('tower', at)
    controller.onBlockedChange('tower')
  }
  const closeMenu = () => {
    pm.blocked.delete('tower')
    pm.menus.delete('tower')
    controller.onBlockedChange('tower')
  }
  const output = () => controller.onPtyOutput('tower', 'redraw')
  const escs = () => pm.writes.filter(([, d]) => d === ESC).length
  const texts = () => pm.writes.filter(([, d]) => d !== ESC).map(([, d]) => d)
  const settle = () => vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
  return { pm, controller, lines, keypresses, menu, closeMenu, output, escs, texts, settle }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(RECORD_AT + 5_000) // the user answers 5 s after the menu opened
})
afterEach(() => { vi.useRealTimers() })

describe('menuEscDecision', () => {
  it('no menu information → esc (T0965)', () => {
    expect(menuEscDecision(undefined, 'A-1：完成', null)).toBe('esc')
  })
  it('in the menu, opened_at belongs to the record → esc (a batch line: one id in the menu is enough)', () => {
    expect(menuEscDecision(MENU, 'U-57：A', RECORD_AT)).toBe('esc')
    expect(menuEscDecision(MENU, 'U-3、U-58：放棄', RECORD_AT)).toBe('esc')
  })
  it('no menu_open / not in it / an A-n → held', () => {
    expect(menuEscDecision(null, 'U-57：A', RECORD_AT)).toBe('no-menu-open')
    expect(menuEscDecision(MENU, 'U-3：A', RECORD_AT)).toBe('not-in-menu')
    expect(menuEscDecision(MENU, 'A-1：完成', RECORD_AT)).toBe('not-in-menu')
    expect(menuEscDecision(MENU, 'U-57：A', null)).toBe('no-record')
  })
  it('the window around the record start', () => {
    const opened = Date.parse(OPENED_AT)
    expect(menuEscDecision(MENU, 'U-57：A', opened + NOTIFY_HOLD_MENU_OPENED_BEFORE_MS)).toBe('esc')
    expect(menuEscDecision(MENU, 'U-57：A', opened + NOTIFY_HOLD_MENU_OPENED_BEFORE_MS + 1)).toBe('stale')
    expect(menuEscDecision(MENU, 'U-57：A', opened - NOTIFY_HOLD_MENU_OPENED_AFTER_MS)).toBe('esc')
    expect(menuEscDecision(MENU, 'U-57：A', opened - NOTIFY_HOLD_MENU_OPENED_AFTER_MS - 1)).toBe('not-this-menu')
  })
})

describe('T0968: the answer and CT\'s menu_open', () => {
  it('U-n in menu_open, the same menu (H-3): held, one Esc, the redraw, then the line (as T0965)', async () => {
    const s = setup()
    s.menu()
    expect(s.controller.enqueueAnswer('tower', 'U-57：A', { menu: MENU })).toMatchObject({ ok: true, held: true })
    expect(s.escs()).toBe(1)
    s.output()
    await s.settle()
    expect(s.texts()).toEqual(['U-57：A'])
    expect(s.lines).toContain('[notify-hold] menu esc terminal=tower holdId=h-1 (question)')
  })

  it('the menu record alone (a click cleared `question`) and U-n in menu_open: Esc as T0965', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower')
    s.controller.enqueueAnswer('tower', 'U-58：B', { menu: MENU })
    expect(s.escs()).toBe(1)
    s.output()
    await s.settle()
    expect(s.texts()).toEqual(['U-58：B'])
  })

  it.each([
    ['a U-n not in the menu', 'U-3：A', MENU, 'not-in-menu'],
    ['an A-n', 'A-1：完成', MENU, 'not-in-menu'],
    ['CT declares menu, no menu_open (H-7: a menu without U-n)', 'U-57：A', null, 'no-menu-open'],
    ['menu_open left from an earlier menu (H-8)', 'U-57：A', { ids: ['U-57'], openedAt: '2026-11-28T12:00:00+08:00' }, 'stale'],
    ['menu_open written after this menu opened', 'U-57：A', { ids: ['U-57'], openedAt: '2026-11-28T12:24:00+08:00' }, 'not-this-menu'],
  ] as const)('%s: no Esc, held until the menu closes, then sent', async (_name, line, menu, why) => {
    const s = setup()
    s.menu()
    expect(s.controller.enqueueAnswer('tower', line, { menu: menu as InboxMenuInfo })).toMatchObject({ ok: true, held: true })
    await vi.advanceTimersByTimeAsync(10_000)
    s.controller.onBlockedChange('tower') // more changes: still no Esc, logged once
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.escs()).toBe(0)
    expect(s.texts()).toEqual([])
    expect(s.controller.list('tower')[0]).toMatchObject({ reason: 'question' })
    expect(s.lines.filter(l => l.startsWith('[notify-hold] menu esc skipped'))).toEqual([
      `[notify-hold] menu esc skipped terminal=tower holdId=h-1 (${why}; held until the menu closes)`,
    ])
    // the user answers / closes the menu in the tab: the hooks close it → the line goes as before
    s.closeMenu()
    await s.settle()
    expect(s.texts()).toEqual([line])
    expect(s.escs()).toBe(0)
  })

  it('no menu information (CT 6.3.x / an older window, H-12 / H-13): exactly T0965 — an A-n closes the menu too', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'A-1：完成')
    expect(s.escs()).toBe(1)
    s.output()
    await s.settle()
    expect(s.texts()).toEqual(['A-1：完成'])
  })

  it('the tracker began a new menu for the same answer later (H-6, re-asked): the fresh record matches', async () => {
    const s = setup()
    s.menu(RECORD_AT - 2 * NOTIFY_HOLD_MENU_OPENED_BEFORE_MS) // an old, never-closed record
    s.controller.enqueueAnswer('tower', 'U-57：A', { menu: MENU })
    expect(s.escs()).toBe(0)
    s.menu(RECORD_AT) // ask-user-question of the re-asked menu
    expect(s.escs()).toBe(1)
  })

  it('a duplicate line takes the newer menu information', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'U-57：A', { menu: null })
    expect(s.escs()).toBe(0)
    expect(s.controller.enqueueAnswer('tower', 'U-57：A', { menu: MENU })).toMatchObject({ ok: true, held: true, holdId: 'h-1' })
    s.controller.onBlockedChange('tower')
    expect(s.escs()).toBe(1)
  })

  it.each(['permission', 'elicitation', 'input'] as const)('`%s` (H-11): held as before, no Esc, whatever menu says', async (reason) => {
    const s = setup()
    s.pm.blocked.set('tower', { reason, since: 1 })
    s.controller.enqueueAnswer('tower', 'U-57：A', { menu: MENU })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('logs ids only — never the answer text', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'U-3：secret-choice', { menu: MENU })
    s.closeMenu()
    await s.settle()
    expect(s.lines.join('\n')).not.toContain('secret-choice')
  })
})

describe('T0968: Worker notifications while the menu record is open', () => {
  it('`question` cleared by a click, the record open: held (text and its Enter), never an Esc; sent once it closes', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower')
    s.controller.onBlockedChange('tower')
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual({ ok: true, held: true })
    expect(s.controller.interceptKeypress(WORKER, { targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source: 'T0001' })).toEqual({ ok: true, held: true })
    expect(s.controller.list('tower')[0]).toMatchObject({ reason: 'question' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
    s.pm.menus.delete('tower')
    s.controller.onBlockedChange('tower')
    await s.settle()
    expect(s.texts()).toEqual(['T0001 完成'])
    expect(s.keypresses).toEqual([expect.objectContaining({ source: 'T0001' })])
    expect(s.escs()).toBe(0)
  })

  it('「立即送出」releases a notification held by the record alone (it may be stale)', async () => {
    const s = setup()
    s.pm.menus.set('tower', RECORD_AT)
    s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')
    expect(s.controller.sendNow('tower')).toBe(1)
    await s.settle()
    expect(s.texts()).toEqual(['T0001 完成'])
  })

  it('not a contract-2 Tower: the record alone does not hold (as before)', () => {
    const s = setup()
    s.pm.contract.set('tower', 1)
    s.pm.menus.set('tower', RECORD_AT)
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toBeNull()
  })
})

describe('T0968: tower-inbox:answer carries menu', () => {
  function handler() {
    const calls: Array<[string, string, unknown]> = []
    const lines: string[] = []
    let registered: ((ctx: HandlerContext, raw?: unknown) => unknown) | null = null
    registerTowerInboxAnswerHandler({
      registerHandler: (_channel, fn) => { registered = fn as typeof registered },
      getNotifyHold: () => ({
        enqueueAnswer: (id, text, opts) => {
          calls.push([id, text, opts])
          return { ok: true, held: true, holdId: 'h-1' }
        },
      }),
      logger: { log: (m) => { lines.push(m) } },
    })
    return { call: (raw: unknown) => registered!(LOCAL, raw), calls, lines }
  }

  it('no menu key (an older window) → enqueueAnswer gets no menu; no new log line', () => {
    const h = handler()
    h.call({ terminalId: 'tower', text: 'U-57：A' })
    expect(h.calls).toEqual([['tower', 'U-57：A', { connectionId: null }]])
    expect(h.lines.some(l => l.includes('answer menu'))).toBe(false)
  })

  it('menu object / null → passed on; logged with ids only', () => {
    const h = handler()
    h.call({ terminalId: 'tower', text: 'U-57：A', menu: MENU })
    h.call({ terminalId: 'tower', text: 'U-57：A', menu: null })
    expect(h.calls.map(c => (c[2] as { menu?: unknown }).menu)).toEqual([MENU, null])
    expect(h.lines).toContain('[tower-inbox] answer menu terminal=tower menu_open=U-57,U-58')
    expect(h.lines).toContain('[tower-inbox] answer menu terminal=tower menu_open=none')
  })

  it('a malformed menu → ignored (T0965), logged; the answer still goes', () => {
    const h = handler()
    expect(h.call({ terminalId: 'tower', text: 'U-57：A', menu: { ids: 'U-57' } })).toMatchObject({ ok: true })
    expect(h.calls).toEqual([['tower', 'U-57：A', { connectionId: null }]])
    expect(h.lines).toContain('[tower-inbox] answer menu ignored terminal=tower (malformed)')
  })
})

describe('preload: towerInbox.answer (Tower answer Q-1: one line, additive)', () => {
  it('without menu the invoke object is exactly `{ terminalId, text }`; with it `menu` is added', () => {
    const preload = readFileSync(resolve(__dirname, '../preload.ts'), 'utf8')
    expect(preload).toContain(`answer: (terminalId: string, text: string, menu?: InboxMenuInfo) =>`)
    expect(preload).toContain(`ipcRenderer.invoke('tower-inbox:answer', menu === undefined ? { terminalId, text } : { terminalId, text, menu })`)
  })
})

describe('TerminalBlockedTracker: the menu record\'s start time', () => {
  it('set when the record is made; again by a new ask-user-question; not by its permission-request; gone when closed', () => {
    let now = 1_000
    const tracker = new TerminalBlockedTracker(undefined, () => now)
    expect(tracker.questionMenuOpenedAt('t')).toBeNull()
    tracker.report('t', 'ask-user-question')
    expect(tracker.questionMenuOpenedAt('t')).toBe(1_000)
    now = 2_000
    tracker.report('t', 'permission-request', 'AskUserQuestion')
    expect(tracker.questionMenuOpenedAt('t')).toBe(1_000)
    now = 3_000
    tracker.clearForUserInput('t', 'x') // `question` cleared, the record stays
    tracker.report('t', 'ask-user-question') // the next AskUserQuestion call
    expect(tracker.questionMenuOpenedAt('t')).toBe(3_000)
    tracker.closeQuestionMenu('t', 'BAT Esc')
    expect(tracker.questionMenuOpenedAt('t')).toBeNull()
  })
})
