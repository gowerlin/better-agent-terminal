// @vitest-environment node
/**
 * BUG-231 / T0951: input that reaches a new shell before the renderer types the agent's launch
 * command (⏻ / a new, restored or resumed agent tab: `pty:create` / `pty:restart`, then the command
 * ~500 ms later) follows the command instead of being prefixed to it — the BUG-151 hold
 * (`holdInputForDispatch`, electron/__tests__/dispatch-input-before-command.test.ts, unchanged)
 * started by the handler (`holdInputUntilLaunch`) and ended by `pty:launch-command`.
 *
 *   - PtyManager (Terminal Server mode, fake fork channel): `holdInputForLaunch` →
 *     `writeLaunchCommand` / `releaseLaunchHold`, the timeout and the byte cap, the PTY ending
 *   - handlers end to end on a real PtyManager: `pty:create` / `pty:restart` with and without the
 *     flag, a local window's `pty:write` in between, `pty:launch-command` (refused to a helper)
 */
import { EventEmitter } from 'events'
import * as os from 'os'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('handlers/pty / pty-manager must not import electron')
})

import { PtyManager } from '../pty-manager'
import { logger } from '../logger'
import { registerPtyHandlers } from '../handlers/pty'
import type { HandlerContext, SharedHandler } from '../handlers/types'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const ID = 'tab-1'
const CWD = os.tmpdir()
const COMMAND = "'C:\\Users\\demo\\.local\\bin\\claude.exe' --mcp-config=x --name=ws\r"
const WIN_GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'
const LOCAL: HandlerContext = { windowId: 'w1' } as HandlerContext

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let server: FakeServer
let manager: PtyManager
let logs: string[]

function writes(id = ID): string[] {
  return server.sent.flatMap(m => (m.type === 'pty:write' && m.id === id ? [m.data] : []))
}

beforeEach(() => {
  logs = []
  vi.spyOn(logger, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  server = new FakeServer()
  manager = new PtyManager({ emit: () => undefined, dataDir: os.tmpdir() })
  manager.setServerProcess(server as unknown as ChildProcess)
})

afterEach(() => {
  vi.useRealTimers()
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

describe('PtyManager: input held until the renderer launch command', () => {
  beforeEach(() => {
    expect(manager.create({ id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH })).toBe(true)
    server.reply({ type: 'pty:created', id: ID, pid: 100 })
  })

  it('typed before the command → the command, complete, then the input (the BUG-231 line)', () => {
    manager.holdInputForLaunch(ID)
    expect(manager.writeWithResult(ID, 'ls')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(manager.writeWithResult(ID, '中')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(writes()).toEqual([])

    manager.writeLaunchCommand(ID, COMMAND)
    expect(writes()).toEqual([COMMAND, 'ls', '中'])
    expect(logs).toContain(`[agent-command] id=${ID} input before the launch command: 2 write(s), 5 bytes → sent after it`)

    // the hold is over: input goes straight through again
    expect(manager.writeWithResult(ID, 'x')).toEqual({ ok: true, reason: 'queued' })
    expect(writes()).toEqual([COMMAND, 'ls', '中', 'x'])
  })

  it('nothing typed → only the command, nothing logged', () => {
    manager.holdInputForLaunch(ID)
    manager.writeLaunchCommand(ID, COMMAND)
    expect(writes()).toEqual([COMMAND])
    expect(logs.some(l => l.includes('launch command'))).toBe(false)
  })

  it('the terminal\'s own replies are not held (as BUG-151)', () => {
    manager.holdInputForLaunch(ID)
    manager.writeWithResult(ID, '\x1b[I')
    manager.writeWithResult(ID, '\x1b[12;1R')
    manager.writeLaunchCommand(ID, COMMAND)
    expect(writes()).toEqual(['\x1b[I', '\x1b[12;1R', COMMAND])
  })

  it('released without a command (`no-command`) → the input as it is, in order', () => {
    manager.holdInputForLaunch(ID)
    manager.writeWithResult(ID, 'a')
    manager.writeWithResult(ID, 'b')
    manager.releaseLaunchHold(ID, 'no-command')
    expect(writes()).toEqual(['a', 'b'])
    expect(manager.writeWithResult(ID, 'c')).toEqual({ ok: true, reason: 'queued' })
  })

  it('no command within LAUNCH_INPUT_HOLD_TIMEOUT_MS → the input is written (never dropped); a late command is a plain write', () => {
    vi.useFakeTimers()
    manager.holdInputForLaunch(ID)
    manager.writeWithResult(ID, 'abc')
    vi.advanceTimersByTime(PtyManager.LAUNCH_INPUT_HOLD_TIMEOUT_MS - 1)
    expect(writes()).toEqual([])
    vi.advanceTimersByTime(1)
    expect(writes()).toEqual(['abc'])
    expect(logs).toContain(`[agent-command] id=${ID} launch hold ended (timeout) before the launch command`)
    manager.writeLaunchCommand(ID, COMMAND)
    expect(writes()).toEqual(['abc', COMMAND])
  })

  it('held input past LAUNCH_INPUT_HOLD_MAX_BYTES → written at once, in order', () => {
    manager.holdInputForLaunch(ID)
    const chunk = 'x'.repeat(PtyManager.LAUNCH_INPUT_HOLD_MAX_BYTES / 2)
    manager.writeWithResult(ID, chunk)
    manager.writeWithResult(ID, chunk)
    expect(writes()).toEqual([])
    manager.writeWithResult(ID, 'y')
    expect(writes()).toEqual([chunk, chunk, 'y'])
    expect(logs).toContain(`[agent-command] id=${ID} launch hold ended (limit) before the launch command`)
  })

  it('the hold ends with the PTY (kill before the command): nothing replayed, no timer left', () => {
    vi.useFakeTimers()
    manager.holdInputForLaunch(ID)
    manager.writeWithResult(ID, 'k')
    manager.kill(ID)
    manager.writeLaunchCommand(ID, COMMAND)
    vi.advanceTimersByTime(PtyManager.LAUNCH_INPUT_HOLD_TIMEOUT_MS)
    expect(writes()).not.toContain('k')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('without a hold: the command is a plain write; release is a no-op; an unknown id is not held', () => {
    manager.writeLaunchCommand(ID, COMMAND)
    manager.releaseLaunchHold(ID, 'no-command')
    expect(writes()).toEqual([COMMAND])
    manager.holdInputForLaunch('no-such-pty')
    expect(manager.writeWithResult('no-such-pty', 'z')).toEqual({ ok: false, reason: 'pty-not-found' })
  })

  it('a helper dispatch hold is not ended by the launch path (BUG-151 unchanged)', () => {
    manager.holdInputForDispatch(ID)
    manager.writeWithResult(ID, ', ')
    manager.releaseLaunchHold(ID, 'timeout') // not a launch hold: nothing happens
    manager.writeLaunchCommand(ID, 'other\r') // not a launch hold: plain write, the dispatch hold stays
    expect(writes()).toEqual(['other\r'])
    manager.writeDispatchCommand(ID, COMMAND)
    expect(writes()).toEqual(['other\r', COMMAND, ', '])
  })
})

describe('handlers: pty:create / pty:restart / pty:launch-command', () => {
  let handlers: Map<string, SharedHandler>
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args)

  beforeEach(() => {
    handlers = new Map()
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, { getPtyManager: () => manager })
  })

  function created(id = ID) {
    server.reply({ type: 'pty:created', id, pid: 100 })
  }

  it('⏻ / new agent tab: `holdInputUntilLaunch` → a keystroke before the command follows it', async () => {
    expect(await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH, holdInputUntilLaunch: true }))
      .toEqual({ ok: true, created: true })
    created()
    // the flag is not passed on to the Terminal Server
    const createMsg = server.sent.find(m => m.type === 'pty:create') as Record<string, unknown>
    expect(JSON.stringify(createMsg)).not.toContain('holdInputUntilLaunch')

    expect(await call('pty:write', LOCAL, ID, 'q')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(await call('pty:launch-command', LOCAL, ID, COMMAND)).toEqual({ ok: true })
    expect(writes()).toEqual([COMMAND, 'q'])
  })

  it('no keystroke → only the command', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH, holdInputUntilLaunch: true })
    created()
    await call('pty:launch-command', LOCAL, ID, COMMAND)
    expect(writes()).toEqual([COMMAND])
  })

  it('a plain shell tab (no flag): input is not delayed; the options reach PtyManager as they were', async () => {
    const spy = vi.spyOn(manager, 'createWithResult')
    const opts = { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH }
    await call('pty:create', LOCAL, opts)
    created()
    expect(spy.mock.calls[0][0]).toBe(opts)
    expect(await call('pty:write', LOCAL, ID, 'q')).toEqual({ ok: true, reason: 'queued' })
    expect(writes()).toEqual(['q'])
  })

  it('created: false (the PTY already ran) → no hold', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH })
    created()
    expect(await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH, holdInputUntilLaunch: true }))
      .toEqual({ ok: true, created: false })
    expect(await call('pty:write', LOCAL, ID, 'q')).toEqual({ ok: true, reason: 'queued' })
  })

  it('pty:restart with `{ holdInputUntilLaunch: true }` holds; with three arguments it does not', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH })
    created()
    expect(await call('pty:restart', LOCAL, ID, CWD, undefined, { holdInputUntilLaunch: true })).toBe(true)
    created()
    expect(await call('pty:write', LOCAL, ID, 'q')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    await call('pty:launch-command', LOCAL, ID, COMMAND)
    expect(writes()).toEqual([COMMAND, 'q'])

    expect(await call('pty:restart', LOCAL, ID, CWD)).toBe(true)
    created()
    expect(await call('pty:write', LOCAL, ID, 'r')).toEqual({ ok: true, reason: 'queued' })
  })

  it('pty:launch-command null → the held input as it is', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH, holdInputUntilLaunch: true })
    created()
    await call('pty:write', LOCAL, ID, 'q')
    expect(await call('pty:launch-command', LOCAL, ID, null)).toEqual({ ok: true })
    expect(writes()).toEqual(['q'])
  })

  it('`{ auto: true }` writes outside a hold are unchanged (written at once)', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH })
    created()
    expect(await call('pty:write', LOCAL, ID, 'continue', { auto: true })).toEqual({ ok: true, reason: 'queued' })
    expect(writes()).toEqual(['continue'])
  })

  it('pty:launch-command is refused to a helper and checks its arguments', async () => {
    await call('pty:create', LOCAL, { id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH, holdInputUntilLaunch: true })
    created()
    await call('pty:write', LOCAL, ID, 'q')
    const helperCtx = { windowId: null, connectionId: 'c1', helper: { role: 'worker' } } as unknown as HandlerContext
    expect(await call('pty:launch-command', helperCtx, ID, 'evil\r')).toEqual({ ok: false, reason: 'forbidden' })
    expect(await call('pty:launch-command', LOCAL, ID, 42)).toEqual({ ok: false, reason: 'invalid-args' })
    expect(await call('pty:launch-command', LOCAL, '', COMMAND)).toEqual({ ok: false, reason: 'invalid-args' })
    expect(writes()).toEqual([]) // still held
  })
})
