// @vitest-environment node
/**
 * T0788 / BUG-196: a helper's text + Enter into a tab that waits for the user is held
 * (electron/notify-hold.ts) and sent once the tab is answered and quiet.
 *
 *   - held: helper (`ctx.helper`) `pty:write` / `terminal:keypress` to a tab blocked by a hook / osc
 *     reason (`permission` / `question` / `elicitation` / `input`); not `tower`; not `none` (logged)
 *   - the keypress of the same connection within 2 s joins the held write; a lone keypress is its own
 *   - `{ ok: true, held: true }`; the 9th item → `{ ok: false, reason: 'held-full' }`
 *   - sent after 1 s quiet (user input restarts it, a new `blocked` stops it), text → 250 ms → Enter,
 *     `blocked` checked again before every step; order kept, later writes queue behind
 *   - no expiry (Renew #1, D228); PTY exit / Terminal Server recovery → dropped; cancel one / all
 *   - logs never carry the text
 *   - wired: `pty:write` / `terminal:keypress` handlers (real PtyManager + TerminalBlockedTracker)
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import {
  NOTIFY_HOLD_ENTER_DELAY_MS,
  NOTIFY_HOLD_MAX_PER_TARGET,
  NOTIFY_HOLD_PAIR_WINDOW_MS,
  NOTIFY_HOLD_QUIET_MS,
  NotifyHoldController,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { registerTerminalHandlers as RegisterTerminalHandlers } from '../handlers/terminal'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'
import type { NotifyHoldChangedEvent } from '../../src/types/notify-hold'

const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const WORKER2: HandlerContext = { windowId: null, connectionId: 'conn-w2', helper: { terminalId: 'worker-2', role: 'worker', towerId: 'tower' } }
const LOCAL: HandlerContext = { windowId: 'win-1' }
const CLIENT: HandlerContext = { windowId: null, connectionId: 'client-1' }

const enter = (source = 'T0001', traceId = 'tr-1'): NotifyHoldKeypress => ({ targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source, reason: 'submit', traceId })

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  detection = new Map<string, BlockedDetection>([['tower', 'hook']])
  writes: Array<[string, string]> = []
  writeOk = true
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(id: string): BlockedDetection { return this.detection.get(id) ?? 'none' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return this.writeOk ? { ok: true } : { ok: false, reason: 'pty-not-found' }
  }
  getWorkorder(id: string): string | undefined { return id === 'worker-1' ? 'T0001' : undefined }
  /** `tower` is never a tracked reason (the query handlers synthesize it); the controller must not hold on it anyway. */
  block(reason: BlockedState['reason'] | 'tower', id = 'tower') { this.blocked.set(id, { reason: reason as BlockedState['reason'], since: 1 }) }
}

function setupController(opts: { keypressOk?: boolean } = {}) {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const changes: NotifyHoldChangedEvent[] = []
  const order: string[] = []
  const origWrite = pm.writeWithResult.bind(pm)
  pm.writeWithResult = (id, data) => { order.push(`text:${data}`); return origWrite(id, data) }
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); order.push(`enter:${payload.source}`); return opts.keypressOk ?? true },
    emitChanged: (event) => { changes.push(event) },
    logger: { log: (m) => { lines.push(m) } },
  })
  /** The tracker changed (main's `onBlockedChange`). */
  const unblock = (id = 'tower') => { pm.blocked.delete(id); controller.onBlockedChange(id) }
  const block = (reason: BlockedState['reason'], id = 'tower') => { pm.block(reason, id); controller.onBlockedChange(id) }
  return { pm, controller, lines, keypresses, changes, order, unblock, block }
}

const HELD = { ok: true, held: true }

describe('NotifyHoldController — when it holds', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it.each(['permission', 'question', 'elicitation', 'input'] as const)('a helper write to a tab blocked by %s is held (text + Enter as one item)', (reason) => {
    const { pm, controller } = setupController()
    pm.block(reason)
    expect(controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual(HELD)
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(controller.interceptKeypress(WORKER, enter())).toEqual(HELD)
    expect(controller.count('tower')).toBe(1)
    expect(controller.list('tower')[0].items[0]).toMatchObject({ hasText: true, hasEnter: true, workorder: 'T0001', sourceTerminalId: 'worker-1' })
    expect(pm.writes).toEqual([])
  })

  it('the list shows the notify `--source` (keypress) over the Worker tab work order; a pre-fill shows the tab one', () => {
    const { pm, controller } = setupController()
    pm.block('permission')
    controller.interceptWrite(WORKER, 'tower', 'a') // worker-1's tab work order is T0001
    controller.interceptKeypress(WORKER, enter('T0901'))
    controller.interceptWrite(WORKER2, 'tower', 'b') // worker-2 has none
    controller.interceptWrite(WORKER, 'tower', 'c')
    expect(controller.list('tower')[0].items.map(i => i.workorder)).toEqual(['T0901', undefined, 'T0001'])
  })

  it('a tab that does not wait for the user: written at once (null)', () => {
    const { controller } = setupController()
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toBeNull()
    expect(controller.interceptKeypress(WORKER, enter())).toBeNull()
  })

  it('`tower` (a Worker waiting for its Tower) never holds', () => {
    const { pm, controller } = setupController()
    pm.block('tower')
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toBeNull()
    expect(controller.interceptKeypress(WORKER, enter())).toBeNull()
  })

  it('not a helper (a local window, a headless client) → never held', () => {
    const { pm, controller } = setupController()
    pm.block('permission')
    expect(controller.interceptWrite(LOCAL, 'tower', 'x')).toBeNull()
    expect(controller.interceptWrite(CLIENT, 'tower', 'x')).toBeNull()
    expect(controller.interceptKeypress(LOCAL, enter())).toBeNull()
  })

  it('`blockedDetection: none` → written as before, logged `skipped (detection none)`', () => {
    const { pm, controller, lines } = setupController()
    pm.detection.set('tower', 'none')
    expect(controller.interceptWrite(WORKER, 'tower', 'x')).toBeNull()
    expect(lines.some(l => l.startsWith('[notify-hold] skipped (detection none) terminal=tower'))).toBe(true)
  })

  it('a lone keypress into a waiting tab is held on its own (Enter only)', () => {
    const { pm, controller } = setupController()
    pm.block('question')
    expect(controller.interceptKeypress(WORKER, enter('T0009'))).toEqual(HELD)
    expect(controller.list('tower')[0].items[0]).toMatchObject({ hasText: false, hasEnter: true, workorder: 'T0009' })
  })

  it('the keypress joins only the write of the same connection within the pair window', () => {
    const { pm, controller } = setupController()
    pm.block('permission')
    controller.interceptWrite(WORKER, 'tower', 'a')
    controller.interceptKeypress(WORKER2, enter('T0002')) // another connection: its own item
    expect(controller.count('tower')).toBe(2)
    vi.advanceTimersByTime(NOTIFY_HOLD_PAIR_WINDOW_MS + 1)
    controller.interceptKeypress(WORKER, enter()) // too late: its own item
    expect(controller.count('tower')).toBe(3)
    expect(controller.list('tower')[0].items.map(i => [i.hasText, i.hasEnter])).toEqual([[true, false], [false, true], [false, true]])
  })

  it(`at most ${NOTIFY_HOLD_MAX_PER_TARGET} items: the next is refused (held-full), the Enter of a held write still joins`, () => {
    const { pm, controller, lines } = setupController()
    pm.block('permission')
    for (let i = 0; i < NOTIFY_HOLD_MAX_PER_TARGET; i++) expect(controller.interceptWrite(WORKER, 'tower', `n${i}`)).toEqual(HELD)
    expect(controller.interceptKeypress(WORKER, enter())).toEqual(HELD) // joins the 8th
    expect(controller.interceptWrite(WORKER, 'tower', 'n9')).toEqual({ ok: false, reason: 'held-full' })
    expect(controller.interceptKeypress(WORKER2, enter('T0002'))).toEqual({ ok: false, reason: 'held-full' })
    expect(controller.count('tower')).toBe(NOTIFY_HOLD_MAX_PER_TARGET)
    expect(lines.some(l => l.includes('dropped terminal=tower') && l.includes('reason=held-full'))).toBe(true)
  })

  it('logs never carry the text (its length only)', () => {
    const { pm, controller, lines } = setupController()
    pm.block('permission')
    controller.interceptWrite(WORKER, 'tower', 'SECRET-TEXT 完成')
    controller.cancel('tower')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.join('\n')).not.toContain('SECRET-TEXT')
    expect(lines.find(l => l.startsWith('[notify-hold] held'))).toContain('len=14')
  })
})

describe('NotifyHoldController — sending', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('after the tab is answered and quiet 1 s: text, 250 ms, Enter (the keypress event)', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')
    s.controller.interceptKeypress(WORKER, enter())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(s.pm.writes).toEqual([]) // still waiting for the user
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS - 1)
    expect(s.pm.writes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(s.pm.writes).toEqual([['tower', 'T0001 完成']])
    expect(s.keypresses).toEqual([])
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypresses).toEqual([enter()])
    expect(s.controller.count('tower')).toBe(0)
    expect(s.changes.at(-1)).toEqual({ terminalId: 'tower', items: [] })
    expect(s.lines.filter(l => l.startsWith('[notify-hold] sent')).length).toBe(2)
  })

  it('user input during the quiet wait starts it again', async () => {
    const s = setupController()
    s.pm.block('question')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.unblock()
    await vi.advanceTimersByTimeAsync(800)
    s.controller.onUserInput('tower')
    await vi.advanceTimersByTimeAsync(800)
    expect(s.pm.writes).toEqual([])
    await vi.advanceTimersByTimeAsync(200)
    expect(s.pm.writes).toEqual([['tower', 'x']])
  })

  it('a new blocked during the quiet wait stops it; the next answer starts it again', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.unblock()
    await vi.advanceTimersByTimeAsync(500)
    s.block('permission')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.pm.writes).toEqual([])
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.pm.writes).toEqual([['tower', 'x']])
  })

  it('blocked again between the text and its Enter: the Enter waits for the next answer', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.controller.interceptKeypress(WORKER, enter())
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.pm.writes.length).toBe(1)
    s.block('question')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS + 10_000)
    expect(s.keypresses).toEqual([])
    expect(s.controller.list('tower')[0].items[0]).toMatchObject({ hasText: false, hasEnter: true })
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.keypresses.length).toBe(1)
    expect(s.pm.writes.length).toBe(1) // the text is not written twice
  })

  it('order is kept: items go out one after another; a write while items are held queues behind them', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'one')
    s.controller.interceptKeypress(WORKER, enter('T0001'))
    s.controller.interceptWrite(WORKER2, 'tower', 'two')
    s.controller.interceptKeypress(WORKER2, enter('T0002'))
    s.unblock()
    // not blocked any more, but items are still held: a third one queues behind (no overtaking)
    expect(s.controller.interceptWrite(WORKER, 'tower', 'three')).toEqual(HELD)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.order).toEqual(['text:one', 'enter:T0001', 'text:two', 'enter:T0002', 'text:three'])
    expect(s.lines.find(l => l.includes('part=text len=5') && l.startsWith('[notify-hold] held'))).toContain('reason=queued')
  })

  it('a failed write drops that item (logged) and goes on with the next', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'one')
    s.controller.interceptKeypress(WORKER, enter())
    s.unblock()
    s.pm.writeOk = false
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.keypresses).toEqual([])
    expect(s.lines.some(l => l.startsWith('[notify-hold] dropped') && l.includes('write-failed:pty-not-found'))).toBe(true)
    expect(s.controller.count('tower')).toBe(0)
  })

  it('the Enter cannot be delivered (headless, no client): dropped, logged', async () => {
    const s = setupController({ keypressOk: false })
    s.pm.block('permission')
    s.controller.interceptKeypress(WORKER, enter())
    s.unblock()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.lines.some(l => l.startsWith('[notify-hold] dropped') && l.includes('no-receiver'))).toBe(true)
    expect(s.controller.count('tower')).toBe(0)
  })
})

describe('NotifyHoldController — no expiry, lifecycle, cancel', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('Renew #1 (D228): no expiry — held for hours, still sent once the tab is answered', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.controller.interceptKeypress(WORKER, enter())
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
    expect(s.controller.count('tower')).toBe(1)
    expect(s.lines.some(l => /\[notify-hold\] (expired|dropped)/.test(l))).toBe(false)
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.pm.writes).toEqual([['tower', 'x']])
    expect(s.keypresses.length).toBe(1)
  })

  it(`Renew #1: with ${NOTIFY_HOLD_MAX_PER_TARGET} writes held, the Enter of each one joins it (never held-full); the next write is held-full`, () => {
    const { pm, controller } = setupController()
    pm.block('permission')
    for (let i = 0; i < NOTIFY_HOLD_MAX_PER_TARGET; i++) {
      const ctx: HandlerContext = { windowId: null, connectionId: `conn-${i}`, helper: { terminalId: `worker-${i}`, role: 'worker', towerId: 'tower' } }
      expect(controller.interceptWrite(ctx, 'tower', `n${i}`)).toEqual(HELD)
      expect(controller.count('tower')).toBe(i + 1)
    }
    for (let i = 0; i < NOTIFY_HOLD_MAX_PER_TARGET; i++) {
      const ctx: HandlerContext = { windowId: null, connectionId: `conn-${i}`, helper: { terminalId: `worker-${i}`, role: 'worker', towerId: 'tower' } }
      expect(controller.interceptKeypress(ctx, enter(`T09${i}`))).toEqual(HELD)
    }
    expect(controller.count('tower')).toBe(NOTIFY_HOLD_MAX_PER_TARGET)
    expect(controller.list('tower')[0].items.every(i => i.hasText && i.hasEnter)).toBe(true)
    expect(controller.interceptWrite(WORKER, 'tower', 'one more')).toEqual({ ok: false, reason: 'held-full' })
  })

  it('the PTY ending (exit / kill / ⏻ restart) drops everything held for it (count logged)', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.controller.interceptWrite(WORKER2, 'tower', 'y')
    s.controller.onPtyExit('tower')
    expect(s.controller.count('tower')).toBe(0)
    expect(s.lines).toContain('[notify-hold] dropped terminal=tower count=2 (pty-ended)')
    expect(s.changes.at(-1)).toEqual({ terminalId: 'tower', items: [] })
    s.unblock()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('the Terminal Server recovery drops everything', () => {
    const s = setupController()
    s.pm.block('permission')
    s.pm.block('question', 'other')
    s.pm.alive.add('other')
    s.pm.detection.set('other', 'hook')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.controller.interceptWrite(WORKER, 'other', 'y')
    s.controller.onServerRecovery()
    expect(s.controller.list()).toEqual([])
    expect(s.lines.filter(l => l.includes('count=1 (server-recovery)')).length).toBe(2) // one summary per tab
    expect(s.lines.filter(l => l.startsWith('[notify-hold] dropped terminal=') && l.includes('source=worker-1')).length).toBe(2) // + one line per item
  })

  it('the PTY gone when sending: dropped, nothing written', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.pm.alive.delete('tower')
    s.unblock()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
    expect(s.controller.count('tower')).toBe(0)
  })

  it('cancel one / all: only the PTY write is dropped; the windows hear of it', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'one')
    s.controller.interceptWrite(WORKER2, 'tower', 'two')
    const [first, second] = s.controller.list('tower')[0].items
    expect(s.controller.cancel('tower', first.holdId)).toBe(1)
    expect(s.changes.at(-1)!.items.map(i => i.holdId)).toEqual([second.holdId])
    expect(s.controller.cancel('tower', 'h-nope')).toBe(0)
    expect(s.controller.cancel('tower')).toBe(1)
    expect(s.controller.cancel('nobody')).toBe(0)
    expect(s.lines.filter(l => l.startsWith('[notify-hold] cancelled')).length).toBe(2)
    s.unblock()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('cancelled between its text and its Enter: the Enter is not sent', async () => {
    const s = setupController()
    s.pm.block('permission')
    s.controller.interceptWrite(WORKER, 'tower', 'x')
    s.controller.interceptKeypress(WORKER, enter())
    s.unblock()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.pm.writes.length).toBe(1)
    s.controller.cancel('tower')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.keypresses).toEqual([])
  })
})

// ── wired into the shared handlers, real PtyManager + TerminalBlockedTracker ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
let PtyManager: typeof PtyManagerType
let registerPtyHandlers: typeof RegisterPtyHandlers
let registerTerminalHandlers: typeof RegisterTerminalHandlers

describe('pty:write / terminal:keypress handlers hold through NotifyHoldController', () => {
  let dataDir: string
  const managers: PtyManagerType[] = []
  const logs: string[] = []

  beforeAll(async () => {
    const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    ;({ PtyManager } = await import('../pty-manager'))
    ;({ registerPtyHandlers } = await import('../handlers/pty'))
    ;({ registerTerminalHandlers } = await import('../handlers/terminal'))
  })

  beforeEach(() => {
    logs.length = 0
    vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0788-hold-'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function setup(opts: { withHold?: boolean } = {}) {
    const withHold = opts.withHold ?? true
    const userInput: string[] = []
    const emitted: Array<{ channel: string; payload: unknown }> = []
    let hold: NotifyHoldController | null = null
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperEnv: () => ({}),
      onBlockedChange: id => hold?.onBlockedChange(id),
      onPtyExit: id => hold?.onPtyExit(id),
    })
    managers.push(manager)
    const emit = (channel: string, payload: unknown) => { emitted.push({ channel, payload }); return 1 }
    if (withHold) {
      hold = new NotifyHoldController({
        getPtyManager: () => manager,
        emitKeypress: payload => { emit('terminal:keypress', payload); return true },
        logger,
      })
    }
    expect(manager.create({ id: 'tower', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const fake = ptySpawn.mock.results.at(-1)!.value as FakePty
    manager.setBlockedDetection('tower', 'hook')
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const register = (channel: string, handler: unknown) => { handlers.set(channel, handler as never) }
    registerPtyHandlers(register, {
      getPtyManager: () => manager,
      onUserInput: id => { userInput.push(id) },
      ...(hold ? { notifyHold: hold } : {}),
    })
    registerTerminalHandlers(register, {
      getPtyManager: () => manager,
      emit,
      readSettings: () => null,
      buildAgentPromptCommand: async () => null,
      existsSync: () => false,
      ...(hold ? { notifyHold: hold } : {}),
    })
    const write = (ctx: HandlerContext, data: string, wopts?: unknown) => handlers.get('pty:write')!(ctx, 'tower', data, wopts)
    const keypress = (ctx: HandlerContext) => handlers.get('terminal:keypress')!(ctx, { targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source: 'T0001', reason: 'submit', traceId: 'tr' })
    const keypressEvents = () => emitted.filter(e => e.channel === 'terminal:keypress')
    return { manager, fake, write, keypress, keypressEvents, userInput, hold }
  }

  it('BUG-196: the submit of a Worker into a tower at a permission prompt is held — nothing reaches the PTY, no keypress event', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request', 'Bash')
    expect(await s.write(WORKER, 'T0001 完成')).toEqual(HELD)
    expect(await s.keypress(WORKER)).toEqual(HELD)
    expect(s.fake.write).not.toHaveBeenCalled()
    expect(s.keypressEvents()).toEqual([])
    expect(s.manager.getBlockedState('tower')?.reason).toBe('permission') // the prompt stays
  })

  it('the user answers (types into the tab) → after 1 s quiet the text, then the Enter event', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'ask-user-question')
    await s.write(WORKER, 'T0001 完成')
    await s.keypress(WORKER)
    expect(await s.write(LOCAL, '2')).toEqual({ ok: true }) // the user's own answer goes through
    expect(s.fake.write).toHaveBeenCalledWith('2')
    expect(s.manager.getBlockedState('tower')).toBeNull()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.fake.write).toHaveBeenLastCalledWith('T0001 完成')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypressEvents().map(e => e.payload)).toEqual([enter('T0001', 'tr')])
  })

  it('codex `input` (OSC 7501) holds too; its next state releases', async () => {
    const s = setup()
    s.manager.setBlockedDetection('tower', 'none')
    // PtyManager has no test hook for OSC: drive the tracker the way the output does
    ;(s.manager as unknown as { blockedTracker: { observeCodexState(id: string, st: string): unknown } }).blockedTracker.observeCodexState('tower', 'blocked')
    expect(s.manager.getBlockedState('tower')?.reason).toBe('input')
    expect(await s.write(WORKER, 'T0001 完成')).toEqual(HELD)
    ;(s.manager as unknown as { blockedTracker: { observeCodexState(id: string, st: string): unknown } }).blockedTracker.observeCodexState('tower', 'working')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.fake.write).toHaveBeenCalledWith('T0001 完成')
  })

  it('a tower that does not wait for the user: written and pressed at once (unchanged)', async () => {
    const s = setup()
    expect(await s.write(WORKER, 'T0001 完成')).toEqual({ ok: true })
    expect(s.fake.write).toHaveBeenCalledWith('T0001 完成')
    expect(await s.keypress(WORKER)).toMatchObject({ ok: true, broadcastWindows: 1 })
    expect(s.keypressEvents().length).toBe(1)
  })

  it('the tower PTY ends while items are held → dropped', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request')
    await s.write(WORKER, 'x')
    s.manager.kill('tower')
    expect(s.hold!.count('tower')).toBe(0)
    expect(logs).toContain('[notify-hold] dropped terminal=tower count=1 (pty-ended)')
  })

  it('mutation check: without the controller the Worker write reaches the prompt (the BUG-196 path)', async () => {
    const s = setup({ withHold: false })
    s.manager.reportHookEvent('tower', 'permission-request')
    expect(await s.write(WORKER, 'T0001 完成')).toEqual({ ok: true })
    expect(s.fake.write).toHaveBeenCalledWith('T0001 完成')
    expect(await s.keypress(WORKER)).toMatchObject({ ok: true })
    expect(s.keypressEvents().length).toBe(1)
  })

  it('contract item 9: the renderer writes the submit Enter `{ auto: true }` — not user input, the prompt stays', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request')
    expect(await s.write(LOCAL, '\r', { auto: true })).toEqual({ ok: true })
    expect(s.userInput).toEqual([])
    expect(s.manager.getLastUserInputAt('tower')).toBeNull()
    expect(s.manager.getBlockedState('tower')?.reason).toBe('permission')
    // the user's own Enter still answers it (T0590 unchanged)
    await s.write(LOCAL, '\r')
    expect(s.userInput).toEqual(['tower'])
    expect(s.manager.getBlockedState('tower')).toBeNull()
  })
})
