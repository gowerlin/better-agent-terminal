// @vitest-environment node
/**
 * PLAN-068 W2 / T0904 (T0902 §2.4, R2′ / R9′; GitHub #23 / #24): what NotifyHoldController adds for a
 * Tower tab that declared the BAT ↔ CT contract 2 — and that every other tab behaves exactly as
 * before (the T0788 suite, notify-hold.test.ts, stays as it was).
 *
 *   - `draft` (S1): the user's unsent text holds helper notifications and answers; released by the
 *     user's Enter / Ctrl+C + 1 s quiet, or「立即送出」; no time limit; one reminder after 5 min
 *   - `reading`: holds helper notifications only (never an answer), at most 60 s
 *   - atomic send: a helper write nothing holds is written at once; until its Enter reaches the PTY
 *     (1 s at most) the user's input waits and is written right after it — typing and Enter both
 *   - answers: held by a prompt / `draft`, not by `reading`; contract-2 Towers only; one line ≤ 1000
 *   - the T0788 reasons still hold (every tab); a v1 / undeclared Tower or a plain tab: unchanged
 *   - the windows see why (`reason`); logs never carry text
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold must not import electron')
})

import {
  NOTIFY_HOLD_ATOMIC_MAX_MS,
  NOTIFY_HOLD_DRAFT_REMIND_MS,
  NOTIFY_HOLD_ENTER_DELAY_MS,
  NOTIFY_HOLD_MAX_PER_TARGET,
  NOTIFY_HOLD_QUIET_MS,
  NOTIFY_HOLD_READING_MAX_MS,
  NotifyHoldController,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import type { HandlerContext } from '../remote/handler-registry'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'
import type { NotifyHoldChangedEvent, NotifyHoldReminderEvent } from '../../src/types/notify-hold'

const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const WORKER2: HandlerContext = { windowId: null, connectionId: 'conn-w2', helper: { terminalId: 'worker-2', role: 'worker', towerId: 'tower' } }

const enter = (source = 'T0001'): NotifyHoldKeypress => ({ targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source, reason: 'submit', traceId: 'tr' })
const HELD = { ok: true, held: true }

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  detection = new Map<string, BlockedDetection>([['tower', 'hook']])
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(id: string): BlockedDetection { return this.detection.get(id) ?? 'none' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return { ok: true }
  }
  getWorkorder(id: string): string | undefined { return id === 'worker-1' ? 'T0001' : undefined }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.role.get(id) === 'tower' ? this.contract.get(id) : undefined }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const changes: NotifyHoldChangedEvent[] = []
  const reminders: NotifyHoldReminderEvent[] = []
  /** Writes and Enters in the order they happened (`text:…` / `enter:…`). */
  const order: string[] = []
  const origWrite = pm.writeWithResult.bind(pm)
  pm.writeWithResult = (id, data) => { order.push(`pty:${JSON.stringify(data)}`); return origWrite(id, data) }
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); order.push(`enter:${payload.source}`); return true },
    emitChanged: (event) => { changes.push(event) },
    emitReminder: (event) => { reminders.push(event) },
    logger: { log: (m) => { lines.push(m) } },
  })
  /** The user types into the Tower (what pty.ts does for a user write: track, then keep or write). */
  const userTypes = (data: string, opts: { submit?: boolean } = {}) => {
    controller.onUserInput('tower', data)
    if (!controller.holdUserWrite('tower', data, opts)) {
      pm.writeWithResult('tower', data)
      if (opts.submit) controller.afterSubmitWrite('tower', data)
    }
  }
  /** The window answered a keypress event with its `{ auto: true }` `\r` (renderer → pty:write). */
  const windowEnter = () => {
    if (!controller.holdUserWrite('tower', '\r', { submit: true })) pm.writeWithResult('tower', '\r')
    controller.afterSubmitWrite('tower', '\r')
  }
  const notify = (ctx = WORKER, text = 'T0001 完成') => {
    const w = controller.interceptWrite(ctx, 'tower', text)
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    const k = controller.interceptKeypress(ctx, enter())
    return { w, k }
  }
  return { pm, controller, lines, keypresses, changes, reminders, order, userTypes, windowEnter, notify }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('version gate (R9′): only a contract-2 Tower gets the new holds', () => {
  it.each([
    ['a v1 Tower (contract 1)', (pm: FakeManager) => { pm.contract.set('tower', 1) }],
    ['an undeclared Tower', (pm: FakeManager) => { pm.contract.delete('tower') }],
    ['a newer contract (3)', (pm: FakeManager) => { pm.contract.set('tower', 3) }],
    ['not a Tower', (pm: FakeManager) => { pm.role.delete('tower') }],
  ])('%s with a draft and a reader: written at once as before (null), no reason, no atomic window', (_name, arrange) => {
    const { pm, controller, userTypes, changes } = setup()
    arrange(pm)
    userTypes('half a sentence')
    controller.setReading('tower', 'win:1', true)
    expect(controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toBeNull()
    expect(controller.interceptKeypress(WORKER, enter())).toBeNull()
    expect(controller.count('tower')).toBe(0)
    expect(controller.holdUserWrite('tower', 'x')).toBe(false)
    expect(changes).toEqual([])
  })

  it('a v1 Tower at a permission prompt: T0788 holds as before, the event has no `reason`', () => {
    const { pm, controller, changes } = setup()
    pm.contract.set('tower', 1)
    pm.blocked.set('tower', { reason: 'permission', since: 1 })
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toEqual(HELD)
    expect(changes.at(-1)).toEqual({ terminalId: 'tower', items: [expect.objectContaining({ hasText: true })] })
    expect(changes.at(-1)).not.toHaveProperty('reason')
  })

  it('a contract-2 Tower at a permission prompt: held (T0788 reason, shown)', () => {
    const { pm, controller, changes } = setup()
    pm.blocked.set('tower', { reason: 'permission', since: 1 })
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toEqual(HELD)
    expect(changes.at(-1)?.reason).toBe('permission')
  })
})

describe('draft (#23)', () => {
  it('the draft + notification of #23: held instead of joining the user\'s text; sent 1 s after the user\'s Enter', async () => {
    const { pm, controller, userTypes, notify, order, changes, windowEnter } = setup()
    userTypes('my half sentence')
    const { w, k } = notify()
    expect(w).toEqual(HELD)
    expect(k).toEqual(HELD)
    expect(changes.at(-1)?.reason).toBe('draft')
    vi.advanceTimersByTime(10 * 60_000)
    expect(pm.writes.map(x => x[1])).toEqual(['my half sentence']) // nothing joined the draft
    userTypes('\r') // the user sends their own message
    expect(controller.hasDraft('tower')).toBe(false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    windowEnter()
    expect(order).toEqual(['pty:"my half sentence"', 'pty:"\\r"', 'pty:"T0001 完成"', 'enter:T0001', 'pty:"\\r"'])
    expect(controller.count('tower')).toBe(0)
  })

  it('Ctrl+C clears the draft too', async () => {
    const { controller, userTypes, notify, keypresses } = setup()
    userTypes('abc')
    notify()
    userTypes('\x03')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(keypresses).toHaveLength(1)
    expect(controller.count('tower')).toBe(0)
  })

  it('typing again during the quiet wait holds it again', async () => {
    const { controller, userTypes, notify, keypresses, changes } = setup()
    userTypes('abc')
    notify()
    userTypes('\r')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS / 2)
    userTypes('n')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS * 5)
    expect(keypresses).toEqual([])
    expect(controller.count('tower')).toBe(1)
    expect(changes.at(-1)?.reason).toBe('draft')
  })

  it('no time limit; one reminder after 5 min (not again)', async () => {
    const { controller, userTypes, notify, reminders, lines } = setup()
    userTypes('abc')
    notify()
    // counted from the hold (the text came `NOTIFY_HOLD_ENTER_DELAY_MS` before the Enter)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_DRAFT_REMIND_MS - NOTIFY_HOLD_ENTER_DELAY_MS - 1)
    expect(reminders).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(reminders).toEqual([{ terminalId: 'tower', count: 1, heldSince: expect.any(Number), reason: 'draft' }])
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000)
    expect(reminders).toHaveLength(1)
    expect(controller.count('tower')).toBe(1)
    expect(lines.some(l => l.startsWith('[notify-hold] reminder terminal=tower reason=draft count=1'))).toBe(true)
  })

  it('「立即送出」sends despite the draft; the order is kept', async () => {
    const { controller, userTypes, notify, keypresses, order, windowEnter } = setup()
    userTypes('abc')
    notify(WORKER, 'first')
    notify(WORKER2, 'second')
    expect(controller.sendNow('tower')).toBe(2)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    windowEnter()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS * 2)
    windowEnter()
    expect(keypresses).toHaveLength(2)
    expect(order.filter(o => o.startsWith('pty:"f') || o.startsWith('pty:"s'))).toEqual(['pty:"first"', 'pty:"second"'])
  })

  it('「立即送出」does not override a prompt (its Enter would answer it, BUG-196)', async () => {
    const { pm, controller, userTypes, notify, keypresses } = setup()
    userTypes('abc')
    notify()
    pm.blocked.set('tower', { reason: 'permission', since: 1 })
    controller.onBlockedChange('tower')
    controller.sendNow('tower')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(keypresses).toEqual([])
    expect(pm.writes.map(x => x[1])).toEqual(['abc'])
  })

  it('a bracketed paste with `\\r` inside is a draft (it does not send it)', () => {
    const { controller, userTypes } = setup()
    userTypes('\x1b[200~a\rb\x1b[201~')
    expect(controller.hasDraft('tower')).toBe(true)
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toEqual(HELD)
  })
})

describe('reading (#24)', () => {
  it('held while the user reads; sent 1 s after it stops', async () => {
    const { controller, notify, keypresses, changes, pm } = setup()
    controller.setReading('tower', 'win:1', true)
    expect(notify().w).toEqual(HELD)
    expect(changes.at(-1)?.reason).toBe('reading')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(pm.writes).toEqual([])
    controller.setReading('tower', 'win:1', false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(pm.writes.map(x => x[1])).toEqual(['T0001 完成'])
    expect(keypresses).toHaveLength(1)
  })

  it(`at most ${NOTIFY_HOLD_READING_MAX_MS / 1000} s: sent while the user still reads`, async () => {
    const { controller, notify, keypresses, lines } = setup()
    controller.setReading('tower', 'win:1', true)
    notify()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_READING_MAX_MS - 1)
    expect(keypresses).toEqual([])
    await vi.advanceTimersByTimeAsync(1 + NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(keypresses).toHaveLength(1)
    expect(lines.some(l => l.startsWith('[notify-hold] reading limit terminal=tower'))).toBe(true)
  })

  it('two windows on one tab: reading while either says so', () => {
    const { controller } = setup()
    controller.setReading('tower', 'win:1', true)
    controller.setReading('tower', 'conn:c', true)
    controller.setReading('tower', 'win:1', false)
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toEqual(HELD)
  })

  it('never holds an answer', () => {
    const { controller, pm, keypresses } = setup()
    controller.setReading('tower', 'win:1', true)
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toMatchObject({ ok: true, held: false })
    expect(pm.writes.map(x => x[1])).toEqual(['U-3：B'])
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    return vi.waitFor(() => expect(keypresses).toEqual([expect.objectContaining({ source: 'answer', userInput: true })]))
  })
})

describe('atomic send (the 250 ms window)', () => {
  it('nothing holds it: the text is written at once ({ ok: true }); the Enter goes out as before (null)', () => {
    const { controller, pm } = setup()
    expect(controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual({ ok: true })
    expect(pm.writes.map(x => x[1])).toEqual(['T0001 完成'])
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(controller.interceptKeypress(WORKER, enter())).toBeNull()
  })

  it('the user types inside the window: written after the notification\'s Enter (not joined to it)', () => {
    const { controller, userTypes, windowEnter, order } = setup()
    controller.interceptWrite(WORKER, 'tower', 'T0001 完成')
    vi.advanceTimersByTime(100)
    userTypes('n')
    userTypes('e')
    vi.advanceTimersByTime(150)
    controller.interceptKeypress(WORKER, enter())
    windowEnter()
    expect(order).toEqual(['pty:"T0001 完成"', 'pty:"\\r"', 'pty:"n"', 'pty:"e"'])
    expect(controller.hasDraft('tower')).toBe(true) // what the user typed is now a draft
  })

  it('the user presses Enter inside the window: the notification goes alone, then the user\'s Enter', () => {
    const { controller, userTypes, windowEnter, order } = setup()
    controller.interceptWrite(WORKER, 'tower', 'T0001 完成')
    vi.advanceTimersByTime(100)
    userTypes('\r')
    vi.advanceTimersByTime(150)
    controller.interceptKeypress(WORKER, enter())
    windowEnter()
    expect(order).toEqual(['pty:"T0001 完成"', 'pty:"\\r"', 'pty:"\\r"'])
  })

  it(`no Enter comes (a pre-fill): the user's input is written after ${NOTIFY_HOLD_ATOMIC_MAX_MS} ms`, () => {
    const { controller, userTypes, order, lines } = setup()
    controller.interceptWrite(WORKER, 'tower', 'pre-fill')
    userTypes('x')
    vi.advanceTimersByTime(NOTIFY_HOLD_ATOMIC_MAX_MS - 1)
    expect(order).toEqual(['pty:"pre-fill"'])
    vi.advanceTimersByTime(1)
    expect(order).toEqual(['pty:"pre-fill"', 'pty:"x"'])
    expect(lines.some(l => l === '[notify-hold] atomic closed terminal=tower cause=timeout kept=1 bytes=1')).toBe(true)
  })

  it('a second notification inside the window queues behind the first', async () => {
    const { controller, windowEnter, order, keypresses } = setup()
    controller.interceptWrite(WORKER, 'tower', 'one')
    expect(controller.interceptWrite(WORKER2, 'tower', 'two')).toEqual(HELD)
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    controller.interceptKeypress(WORKER, enter())
    expect(controller.interceptKeypress(WORKER2, enter('T0002'))).toEqual(HELD) // joins its write
    windowEnter()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    windowEnter()
    expect(order).toEqual(['pty:"one"', 'pty:"\\r"', 'pty:"two"', 'enter:T0002', 'pty:"\\r"'])
    expect(keypresses.map(k => k.source)).toEqual(['T0002'])
  })

  it('a held notification sent later: the user\'s typing between its text and Enter waits too', async () => {
    const { controller, userTypes, notify, windowEnter, order } = setup()
    controller.setReading('tower', 'win:1', true)
    notify()
    controller.setReading('tower', 'win:1', false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    userTypes('z')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    windowEnter()
    expect(order).toEqual(['pty:"T0001 完成"', 'enter:T0001', 'pty:"\\r"', 'pty:"z"'])
  })
})

describe('answers (W5 interface)', () => {
  it('nothing holds it: written, then the Enter as user input', async () => {
    const { controller, keypresses, pm } = setup()
    const r = controller.enqueueAnswer('tower', 'A-2：完成')
    expect(r).toMatchObject({ ok: true, held: false })
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(pm.writes.map(x => x[1])).toEqual(['A-2：完成'])
    expect(keypresses).toEqual([{ targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source: 'answer', reason: 'answer', userInput: true }])
  })

  it('held by the draft; sent after the user\'s Enter', async () => {
    const { controller, userTypes, keypresses, changes } = setup()
    userTypes('abc')
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toMatchObject({ ok: true, held: true })
    expect(changes.at(-1)).toMatchObject({ reason: 'draft', items: [expect.objectContaining({ kind: 'answer' })] })
    userTypes('\r')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(keypresses.map(k => k.source)).toEqual(['answer'])
  })

  it('held by a prompt', () => {
    const { pm, controller } = setup()
    pm.blocked.set('tower', { reason: 'question', since: 1 })
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toMatchObject({ ok: true, held: true })
  })

  it('queues behind held notifications', () => {
    const { controller, userTypes } = setup()
    userTypes('abc')
    controller.interceptWrite(WORKER, 'tower', 'x')
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toMatchObject({ ok: true, held: true })
    expect(controller.list('tower')[0].items.map(i => i.kind)).toEqual([undefined, 'answer'])
  })

  it.each([
    ['empty', ''],
    ['two lines', 'U-3：B\nmore'],
    ['a carriage return', 'U-3：B\r'],
    ['over 1000 characters', `U-3：${'x'.repeat(1000)}`],
  ])('refused: %s', (_name, text) => {
    const { controller, pm } = setup()
    expect(controller.enqueueAnswer('tower', text)).toEqual({ ok: false, reason: 'invalid' })
    expect(pm.writes).toEqual([])
  })

  it('refused for a tab that is not a contract-2 Tower, and for a PTY that is gone', () => {
    const { pm, controller } = setup()
    pm.contract.set('tower', 1)
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toEqual({ ok: false, reason: 'not-contract-tower' })
    expect(controller.enqueueAnswer('gone', 'U-3：B')).toEqual({ ok: false, reason: 'pty-not-found' })
  })

  it(`counts toward the ${NOTIFY_HOLD_MAX_PER_TARGET}-item limit`, () => {
    const { controller, userTypes } = setup()
    userTypes('abc')
    for (let i = 0; i < NOTIFY_HOLD_MAX_PER_TARGET; i++) controller.interceptWrite(WORKER, 'tower', `n${i}`)
    expect(controller.enqueueAnswer('tower', 'U-3：B')).toEqual({ ok: false, reason: 'held-full' })
  })
})

describe('lifecycle and logs', () => {
  it('the PTY ending forgets the draft, the readers and the atomic window', () => {
    const { controller, userTypes } = setup()
    userTypes('abc')
    controller.setReading('tower', 'win:1', true)
    controller.onPtyExit('tower')
    expect(controller.hasDraft('tower')).toBe(false)
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toEqual({ ok: true }) // passes (atomic)
    controller.onServerRecovery()
    expect(controller.holdUserWrite('tower', 'y')).toBe(false)
  })

  it('logs carry ids, reasons and lengths — never the text, the draft or the answer', async () => {
    const { controller, userTypes, notify, lines } = setup()
    userTypes('SECRET-DRAFT')
    notify(WORKER, 'SECRET-NOTIFY')
    controller.enqueueAnswer('tower', 'U-1：SECRET-ANSWER')
    controller.sendNow('tower')
    await vi.advanceTimersByTimeAsync(5_000)
    controller.cancel('tower')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).not.toMatch(/SECRET/)
    expect(lines.some(l => /\[notify-hold\] held terminal=tower source=worker-1 workorder=T0001 reason=draft part=text len=13/.test(l))).toBe(true)
  })
})
