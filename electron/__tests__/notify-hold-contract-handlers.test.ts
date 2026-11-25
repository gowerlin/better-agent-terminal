// @vitest-environment node
/**
 * PLAN-068 W2 / T0904: the shared `pty:write` / `terminal:keypress` / `terminal:reading-state`
 * handlers (Electron main and headless) with a real PtyManager — what reaches the PTY of a Tower that
 * declared the BAT ↔ CT contract 2, and that a v1 Tower is unchanged.
 *
 *   - #23: the user's draft + a Worker's `--submit` → the notification waits; the user's Enter sends
 *     the draft alone, the notification follows after 1 s quiet
 *   - the 250 ms window: the user's keys between a notification's text and its Enter reach the PTY
 *     after the Enter (`{ auto: true }` `\r` from the window)
 *   - `{ submit: true }` (an answer's Enter) is the user's input and closes the window
 *   - `terminal:reading-state`: a helper may not call it; bad args refused; a window's `true` holds
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
import { NOTIFY_HOLD_ENTER_DELAY_MS, NOTIFY_HOLD_QUIET_MS, NotifyHoldController } from '../notify-hold'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { registerTerminalHandlers as RegisterTerminalHandlers } from '../handlers/terminal'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'

const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const LOCAL: HandlerContext = { windowId: 'win-1' }

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

describe('contract-2 Tower through the shared handlers', () => {
  let dataDir: string
  const managers: PtyManagerType[] = []

  beforeAll(async () => {
    const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    ;({ PtyManager } = await import('../pty-manager'))
    ;({ registerPtyHandlers } = await import('../handlers/pty'))
    ;({ registerTerminalHandlers } = await import('../handlers/terminal'))
  })

  beforeEach(() => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0904-hold-'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function setup(contract: number | null = 2) {
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
    hold = new NotifyHoldController({
      getPtyManager: () => manager,
      emitKeypress: payload => { emit('terminal:keypress', payload); return true },
      logger,
    })
    expect(manager.create({ id: 'tower', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const fake = ptySpawn.mock.results.at(-1)!.value as FakePty
    manager.setBlockedDetection('tower', 'hook')
    manager.setTerminalRole('tower', 'tower', 'yolo', contract ?? undefined)
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const register = (channel: string, handler: unknown) => { handlers.set(channel, handler as never) }
    registerPtyHandlers(register, {
      getPtyManager: () => manager,
      onUserInput: id => { userInput.push(id) },
      notifyHold: hold,
    })
    registerTerminalHandlers(register, {
      getPtyManager: () => manager,
      emit,
      readSettings: () => null,
      buildAgentPromptCommand: async () => null,
      existsSync: () => false,
      notifyHold: hold,
    })
    const write = (ctx: HandlerContext, data: string, wopts?: unknown) => handlers.get('pty:write')!(ctx, 'tower', data, wopts)
    const keypress = (ctx: HandlerContext) => handlers.get('terminal:keypress')!(ctx, { targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source: 'T0001', reason: 'submit', traceId: 'tr' })
    const readingState = (ctx: HandlerContext, args: unknown) => handlers.get('terminal:reading-state')!(ctx, args)
    const keypressEvents = () => emitted.filter(e => e.channel === 'terminal:keypress')
    /** What reached the PTY, in order. */
    const ptyWrites = () => fake.write.mock.calls.map(c => c[0] as string)
    return { manager, hold, write, keypress, readingState, keypressEvents, ptyWrites, userInput }
  }

  it('#23: the draft is sent alone by the user\'s Enter; the notification follows 1 s later with its own Enter', async () => {
    const s = setup()
    await s.write(LOCAL, 'half a sent')
    await s.write(LOCAL, 'ence')
    expect(await s.write(WORKER, 'T0001 完成')).toEqual({ ok: true, held: true })
    vi.advanceTimersByTime(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(await s.keypress(WORKER)).toEqual({ ok: true, held: true })
    expect(s.keypressEvents()).toEqual([])
    await s.write(LOCAL, '\r')
    expect(s.ptyWrites()).toEqual(['half a sent', 'ence', '\r'])
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypressEvents()).toHaveLength(1)
    await s.write(LOCAL, '\r', { auto: true }) // the window's Enter for the event
    expect(s.ptyWrites()).toEqual(['half a sent', 'ence', '\r', 'T0001 完成', '\r'])
  })

  it('a v1 Tower: unchanged — the notification joins the draft (the #23 behaviour), nothing held', async () => {
    const s = setup(1)
    await s.write(LOCAL, 'half')
    expect(await s.write(WORKER, ' T0001 完成')).toEqual({ ok: true })
    expect(s.ptyWrites()).toEqual(['half', ' T0001 完成'])
    expect(await s.keypress(WORKER)).toMatchObject({ ok: true })
    expect(s.keypressEvents()).toHaveLength(1)
  })

  it('the 250 ms window: typing goes after the notification\'s Enter', async () => {
    const s = setup()
    expect(await s.write(WORKER, 'T0001 完成')).toEqual({ ok: true })
    vi.advanceTimersByTime(100)
    expect(await s.write(LOCAL, 'n')).toEqual({ ok: true })
    expect(s.ptyWrites()).toEqual(['T0001 完成']) // kept
    expect(s.userInput).toEqual(['tower']) // still the user's input (⚠️, usage-limit wait)
    vi.advanceTimersByTime(150)
    expect(await s.keypress(WORKER)).toMatchObject({ ok: true })
    expect(s.keypressEvents()).toHaveLength(1)
    await s.write(LOCAL, '\r', { auto: true })
    expect(s.ptyWrites()).toEqual(['T0001 完成', '\r', 'n'])
  })

  it('the 250 ms window: the user\'s Enter inside it goes after the notification\'s Enter', async () => {
    const s = setup()
    await s.write(WORKER, 'T0001 完成')
    await s.write(LOCAL, '\r')
    await s.keypress(WORKER)
    await s.write(LOCAL, '\r', { auto: true })
    expect(s.ptyWrites()).toEqual(['T0001 完成', '\r', '\r'])
  })

  it('an undeclared Tower: the window does not exist (typing is written at once, as before)', async () => {
    const s = setup(null) // declared nothing
    await s.write(WORKER, 'T0001 完成')
    await s.write(LOCAL, 'n')
    expect(s.ptyWrites()).toEqual(['T0001 完成', 'n'])
  })

  it('`{ submit: true }` (an answer\'s Enter) is the user\'s input and closes the window', async () => {
    const s = setup()
    expect(s.hold!.enqueueAnswer('tower', 'U-3：B')).toMatchObject({ ok: true, held: false })
    await s.write(LOCAL, 'k')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypressEvents()).toEqual([{ channel: 'terminal:keypress', payload: expect.objectContaining({ source: 'answer', userInput: true }) }])
    s.userInput.length = 0
    await s.write(LOCAL, '\r', { submit: true })
    expect(s.userInput).toEqual(['tower'])
    expect(s.ptyWrites()).toEqual(['U-3：B', '\r', 'k'])
  })

  it('terminal:reading-state: a helper may not; bad args refused; a window\'s `true` holds a notification', async () => {
    const s = setup()
    expect(await s.readingState(WORKER, { terminalId: 'tower', reading: true })).toEqual({ ok: false, reason: 'forbidden' })
    expect(await s.readingState(LOCAL, { terminalId: 'tower', reading: 'yes' })).toEqual({ ok: false, reason: 'invalid-args' })
    expect(await s.readingState(LOCAL, null)).toEqual({ ok: false, reason: 'invalid-args' })
    expect(await s.readingState(LOCAL, { terminalId: 'tower', reading: true })).toEqual({ ok: true })
    expect(await s.write(WORKER, 'T0001 完成')).toEqual({ ok: true, held: true })
    expect(await s.readingState(LOCAL, { terminalId: 'tower', reading: false })).toEqual({ ok: true })
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.ptyWrites()).toEqual(['T0001 完成'])
  })
})
