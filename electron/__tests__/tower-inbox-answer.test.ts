// @vitest-environment node
/**
 * PLAN-068 W5 / T0908 (T0902 §2.4 / §5, R7; T0904 follow-up 1):
 *
 *   - `tower-inbox:answer { terminalId, text }`: a helper capability is refused (`FORBIDDEN`); the text
 *     must be one line of ≤ 1,000 chars starting `U-n：` / `A-n：` (+ text); a good one goes to
 *     `NotifyHoldController.enqueueAnswer` (held by a prompt / `draft`, never by `reading`; contract-2
 *     Towers only); logs carry ids and lengths, never the text
 *   - `terminal:notify-hold-list` / `-cancel` / `-send-now` are shared handlers now (both hosts),
 *     refused to a helper capability ([] / 0), same answers as the T0788 local IPC
 *   - all four are proxied (PROXIED_CHANNELS), the two events are PROXIED_EVENTS, none is a helper channel
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold must not import electron')
})

import {
  NotifyHoldController,
  registerNotifyHoldHandlers,
  registerTowerInboxAnswerHandler,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import { PROXIED_CHANNELS, PROXIED_EVENTS } from '../remote/protocol'
import type { HandlerContext } from '../remote/handler-registry'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'

const WINDOW: HandlerContext = { windowId: 'w1' }
const CLIENT: HandlerContext = { windowId: null, connectionId: 'conn-1' }
const TOWER_HELPER: HandlerContext = { windowId: null, connectionId: 'conn-h', helper: { terminalId: 'tower', role: 'tower' } }
const WORKER_HELPER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower', 'old-tower'])
  blocked = new Map<string, BlockedState>()
  role = new Map<string, string>([['tower', 'tower'], ['old-tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(): BlockedDetection { return 'hook' }
  writeWithResult(id: string, data: string) { this.writes.push([id, data]); return { ok: true } }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.contract.get(id) }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); return true },
    logger: { log: (m) => { lines.push(m) } },
    setTimer: () => null,
    clearTimer: () => {},
  })
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const registerHandler = (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => { handlers.set(channel, handler) }
  registerTowerInboxAnswerHandler({ registerHandler, getNotifyHold: () => controller, logger: { log: (m) => { lines.push(m) } } })
  registerNotifyHoldHandlers({ registerHandler, getNotifyHold: () => controller, logger: { log: (m) => { lines.push(m) } } })
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args)
  return { pm, lines, keypresses, controller, handlers, call }
}

const SECRET = 'B 回合卡片 secret-answer'

describe('T0908 tower-inbox:answer', () => {
  it('a window answer reaches the Tower PTY at once (its text; the Enter follows from the controller)', async () => {
    const { pm, call } = setup()
    const result = call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'U-3：B' })
    expect(result).toMatchObject({ ok: true, held: false })
    await new Promise(r => setTimeout(r, 0))
    expect(pm.writes).toEqual([['tower', 'U-3：B']])
    // (the Enter, `userInput: true`, and its timing are covered by notify-hold-contract-tower.test.ts)
  })

  it('refuses a helper capability — a Tower or a Worker cannot answer for the user', () => {
    const { pm, lines, call } = setup()
    expect(call('tower-inbox:answer', TOWER_HELPER, { terminalId: 'tower', text: 'U-3：B' })).toEqual({ ok: false, reason: 'FORBIDDEN' })
    expect(call('tower-inbox:answer', WORKER_HELPER, { terminalId: 'tower', text: 'A-2：完成' })).toEqual({ ok: false, reason: 'FORBIDDEN' })
    expect(pm.writes).toEqual([])
    expect(lines.some(l => l.includes('answer refused: helper capability'))).toBe(true)
  })

  it('checks the arguments and the line format', () => {
    const { pm, call } = setup()
    for (const bad of [undefined, null, 'U-3：B', [], { text: 'U-3：B' }, { terminalId: '', text: 'U-3：B' }, { terminalId: 7, text: 'U-3：B' }]) {
      expect(call('tower-inbox:answer', WINDOW, bad)).toEqual({ ok: false, reason: 'INVALID_ARGS' })
    }
    for (const text of ['hello', 'U-3', 'U-3：', 'U-3：   ', 'X-3：B', 'u-3：B', 'U-x：B', 'U-3：B\rrm -rf', 'U-3：B\nnext', `U-3：${'a'.repeat(1000)}`, 42]) {
      expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text })).toEqual({ ok: false, reason: 'invalid' })
    }
    // half-width colon accepted too (CT accepts both)
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'A-2:完成' })).toMatchObject({ ok: true })
    expect(pm.writes.length).toBeLessThanOrEqual(1)
  })

  it('only a contract-2 Tower takes an answer; a gone PTY is reported', () => {
    const { call } = setup()
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'old-tower', text: 'U-1：A' })).toEqual({ ok: false, reason: 'not-contract-tower' })
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'gone', text: 'U-1：A' })).toEqual({ ok: false, reason: 'pty-not-found' })
  })

  it('held by a prompt (and listed as an answer); never by reading', () => {
    const { pm, controller, call } = setup()
    pm.blocked.set('tower', { reason: 'permission', since: 1 } as unknown as BlockedState)
    const held = call('tower-inbox:answer', CLIENT, { terminalId: 'tower', text: 'U-3：B' })
    expect(held).toMatchObject({ ok: true, held: true })
    expect(pm.writes).toEqual([])
    const listed = call('terminal:notify-hold-list', WINDOW) as Array<{ terminalId: string; items: Array<{ kind?: string }> }>
    expect(listed).toHaveLength(1)
    expect(listed[0].items[0].kind).toBe('answer')

    // reading does not hold an answer
    const second = setup()
    second.controller.setReading('tower', 'win:w1', true)
    expect(second.call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'A-2：完成' })).toMatchObject({ ok: true, held: false })
    void controller
  })

  it('held by the user’s draft in the Tower input box', () => {
    const { pm, controller, call } = setup()
    controller.onUserInput('tower', 'half typed')
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'U-3：B' })).toMatchObject({ ok: true, held: true })
    expect(pm.writes).toEqual([])
  })

  it('logs ids and lengths only — never the answer text', () => {
    const { lines, call, pm } = setup()
    pm.blocked.set('tower', { reason: 'question', since: 1 } as unknown as BlockedState)
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: `U-9：${SECRET}` })
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: `bad ${SECRET}` })
    const all = lines.join('\n')
    expect(all).toContain('[tower-inbox] answer terminal=tower id=U-9')
    expect(all).not.toContain('secret-answer')
    expect(all).not.toContain('回合卡片')
  })

  it('without a controller → unavailable', () => {
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    registerTowerInboxAnswerHandler({ registerHandler: (c, h) => { handlers.set(c, h) }, getNotifyHold: () => null, logger: { log: () => {} } })
    expect(handlers.get('tower-inbox:answer')!(WINDOW, { terminalId: 'tower', text: 'U-1：A' })).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('PLAN-069 / T0922 tower-inbox:answer — 放棄 / 略過 batches', () => {
  it('a batch 放棄 / 略過 line reaches the Tower PTY as one line', async () => {
    const { pm, call } = setup()
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'U-1、U-3、U-4：放棄 改方向' })).toMatchObject({ ok: true, held: false })
    await new Promise(r => setTimeout(r, 0))
    // (this setup's timers never fire: the Enter and the next item are covered by notify-hold-contract-tower.test.ts)
    expect(pm.writes).toEqual([['tower', 'U-1、U-3、U-4：放棄 改方向']])
    expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'A-2、A-3：略過' })).toMatchObject({ ok: true })
  })

  it('other multi-id lines, wildcards and ranges are refused like any bad line', () => {
    const { pm, lines, call } = setup()
    for (const text of ['U-1、U-3：A', 'U-1、U-3：先不要', 'A-2、A-3：完成', 'U-*：放棄', 'U-1～U-5：放棄', 'U-1、U-3：放棄\nU-4：放棄', `U-1、U-3：放棄 ${'a'.repeat(1000)}`]) {
      expect(call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text })).toEqual({ ok: false, reason: 'invalid' })
    }
    expect(pm.writes).toEqual([])
    expect(lines.some(l => l.includes('check=bad-batch'))).toBe(true)
  })

  it('still refuses a helper capability for a batch line', () => {
    const { pm, call } = setup()
    expect(call('tower-inbox:answer', TOWER_HELPER, { terminalId: 'tower', text: 'U-1、U-3：放棄' })).toEqual({ ok: false, reason: 'FORBIDDEN' })
    expect(pm.writes).toEqual([])
  })

  it('logs the first id and the id count, never the note', () => {
    const { pm, lines, call } = setup()
    pm.blocked.set('tower', { reason: 'question', since: 1 } as unknown as BlockedState)
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: `U-1、U-3、U-4：放棄 ${SECRET}` })
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: `U-1、U-3：A ${SECRET}` })
    const all = lines.join('\n')
    expect(all).toContain('[tower-inbox] answer terminal=tower id=U-1 ids=3 len=')
    expect(all).toContain('check=bad-batch')
    expect(all).not.toContain('secret-answer')
    expect(all).not.toContain('回合卡片')
    expect(all).not.toContain('放棄')
  })
})

describe('T0908 terminal:notify-hold-* shared handlers', () => {
  it('list / cancel / send-now keep the T0788 answers; a helper capability gets [] / 0', () => {
    const { pm, call } = setup()
    pm.blocked.set('tower', { reason: 'permission', since: 1 } as unknown as BlockedState)
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'U-3：B' })
    call('tower-inbox:answer', WINDOW, { terminalId: 'tower', text: 'U-4：A' })
    expect(call('terminal:notify-hold-list', TOWER_HELPER)).toEqual([])
    expect(call('terminal:notify-hold-cancel', WORKER_HELPER, 'tower')).toBe(0)
    expect(call('terminal:notify-hold-send-now', TOWER_HELPER, 'tower')).toBe(0)
    expect((call('terminal:notify-hold-list', CLIENT) as unknown[]).length).toBe(1)
    // a prompt still holds after「立即送出」; the count says how many were released from draft / reading
    expect(call('terminal:notify-hold-send-now', CLIENT, 'tower')).toBe(2)
    expect(call('terminal:notify-hold-cancel', CLIENT, 'tower', 'nope')).toBe(0)
    expect(call('terminal:notify-hold-cancel', CLIENT, 'tower')).toBe(2)
    expect(call('terminal:notify-hold-list', CLIENT)).toEqual([])
    expect(call('terminal:notify-hold-cancel', CLIENT, 42)).toBe(0)
    expect(call('terminal:notify-hold-send-now', CLIENT, undefined)).toBe(0)
  })

  it('without a controller: [] / 0', () => {
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    registerNotifyHoldHandlers({ registerHandler: (c, h) => { handlers.set(c, h) }, getNotifyHold: () => null, logger: { log: () => {} } })
    expect(handlers.get('terminal:notify-hold-list')!(WINDOW)).toEqual([])
    expect(handlers.get('terminal:notify-hold-cancel')!(WINDOW, 'tower')).toBe(0)
    expect(handlers.get('terminal:notify-hold-send-now')!(WINDOW, 'tower')).toBe(0)
  })
})

describe('T0908 channel lists (R7)', () => {
  const channels = ['tower-inbox:answer', 'terminal:notify-hold-list', 'terminal:notify-hold-cancel', 'terminal:notify-hold-send-now']
  it('proxied, never a helper channel', () => {
    for (const channel of channels) {
      expect(PROXIED_CHANNELS.has(channel)).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel)).toBe(false)
    }
  })
  it('the two events reach remote clients', () => {
    expect(PROXIED_EVENTS.has('terminal:notify-hold-changed')).toBe(true)
    expect(PROXIED_EVENTS.has('terminal:notify-hold-reminder')).toBe(true)
  })
})
