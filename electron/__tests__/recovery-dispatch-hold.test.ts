// @vitest-environment node
/**
 * T0580 (BUG-146 follow-up to T0578): while the Recovery prompt is unanswered the two callers
 * that create a PTY synchronously wait for the create hold too:
 *   - `terminal:create-with-command` (helper dispatch; `terminal:create-agent-command` goes
 *     through it) waits at most HELPER_CREATE_HOLD_WAIT_MS — below bat-terminal.mjs's 3 s invoke
 *     timeout — then refuses with RECOVERY_PENDING and never creates it later
 *   - `pty:restart` waits for the answer (a renderer invoke, no timeout)
 * Released by "recover" (PTY list registered the surviving ids) the dispatch lands on the
 * surviving Terminal Server; by "fresh start" on the new one. Without a hold (no surviving
 * server, direct mode, headless) both answer as before T0580.
 *
 * The Terminal Server is a fake fork IPC channel, as in recovery-create-hold.test.ts.
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager } from '../pty-manager'
import { registerPtyHandlers } from '../handlers/pty'
import type { SharedHandler } from '../handlers/types'
import { logger } from '../logger'
import {
  HELPER_CREATE_HOLD_WAIT_MS,
  RECOVERY_PENDING,
  registerTerminalCommandHandlers,
} from '../terminal-command-handlers'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const SURVIVING = 'tab-surviving'
const WORKER = 'worker-new'
const CWD = os.tmpdir()
const WORKER_ENV = { MSYS_NO_PATHCONV: '1', BAT_TOWER_TERMINAL_ID: SURVIVING, CT_MODE: 'yolo', CT_INTERACTIVE: '0' }

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

let manager: PtyManager
let createSpy: ReturnType<typeof vi.spyOn>
let commandHandlers: Map<string, Handler>
let ptyHandlers: Map<string, SharedHandler>
let mirrored: Array<{ event: string; payload: Record<string, unknown> }>
let emitted: Array<{ channel: string; payload: Record<string, unknown> }>
let logs: string[]
let warns: string[]

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir(), helperEnv: () => ({}) })
  createSpy = vi.spyOn(manager, 'create')
  commandHandlers = new Map()
  mirrored = []
  emitted = []
  logs = []
  warns = []
  registerTerminalCommandHandlers({
    registerHandler(channel, handler) { commandHandlers.set(channel, handler) },
    getPtyManager: () => manager,
    readPersistedSettingsSync: () => null,
    buildAgentPromptCommand: async () => ({ command: 'claude "/ct-exec T0580"', agentId: 'claude-cli', prompt: '/ct-exec T0580', prefixNormalized: false }),
    pickWhitelistedEnv: (env) => ({ ...(env ?? {}) }),
    mirrorToBatScripts: (event, payload) => { mirrored.push({ event, payload }) },
    emit: (channel, payload) => { emitted.push({ channel, payload: payload as Record<string, unknown> }) },
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: (...a: unknown[]) => { warns.push(a.join(' ')) } },
    setTimeout: (callback: () => void) => { callback(); return 0 },
  })
  ptyHandlers = new Map()
  registerPtyHandlers((channel, handler) => { ptyHandlers.set(channel, handler) }, { getPtyManager: () => manager })
})

afterEach(() => {
  vi.useRealTimers()
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

const dispatch = (id = WORKER) => commandHandlers.get('terminal:create-with-command')!(
  { windowId: null }, { id, cwd: CWD, command: 'claude "/ct-exec T0580"', customEnv: WORKER_ENV, reportLanding: true },
) as Promise<unknown>
const dispatchAgent = (id = WORKER) => commandHandlers.get('terminal:create-agent-command')!(
  { windowId: null }, { id, cwd: CWD, skill: 'ct-exec', workorder: 'T0580', customEnv: WORKER_ENV, reportLanding: true },
) as Promise<unknown>
const restart = (id: string) => ptyHandlers.get('pty:restart')!({ windowId: 'w1' } as never, id, CWD)

/** Lets resolved hold waiters and the awaits after them run. */
const flush = () => new Promise<void>(r => setTimeout(r, 0))

function connectServer(): FakeServer {
  const server = new FakeServer()
  manager.setServerProcess(server as unknown as ChildProcess)
  return server
}

const serverCreates = (server: FakeServer) => server.sent.filter(m => m.type === 'pty:create').map(m => (m as { id: string }).id)
const serverWrites = (server: FakeServer) => server.sent.filter(m => m.type === 'pty:write').map(m => (m as { id: string; data: string }))
const directSpawnWarned = () => (logger.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
  .some(([msg]) => String(msg).includes('spawns directly while creates are held'))

describe('helper dispatch while the Recovery prompt is pending (BUG-146 / T0580)', () => {
  it('holds: no create, no spawn until the answer', async () => {
    manager.holdCreates('Recovery prompt pending')
    let settled = false
    const pending = dispatch().then(() => { settled = true })
    await flush()
    expect(settled).toBe(false)
    expect(createSpy).not.toHaveBeenCalled()
    expect(manager.isAlive(WORKER)).toBe(false)
    expect(logger.log).toHaveBeenCalledWith(`[BUG-146] terminal:create-with-command id=${WORKER} held until the Recovery prompt is answered (at most ${HELPER_CREATE_HOLD_WAIT_MS} ms)`)
    connectServer() // not a direct shell when the test releases it
    manager.releaseCreates('test end')
    await pending
  })

  it.each([
    ['terminal:create-with-command', dispatch],
    ['terminal:create-agent-command', dispatchAgent],
  ])('recover: %s lands on the surviving Terminal Server after the PTY list', async (_channel, run) => {
    manager.holdCreates('Recovery prompt pending')
    const result = run()
    await flush()
    const server = connectServer()
    manager.releaseCreatesOnReplayList()
    await flush()
    expect(createSpy).not.toHaveBeenCalled() // still held until the list
    server.reply({ type: 'pty:list', ptys: [{ id: SURVIVING, pid: 4242, cwd: CWD }] })

    await expect(result).resolves.toMatchObject({ ok: true, terminalId: WORKER })
    expect(serverCreates(server)).toEqual([WORKER])
    expect(serverWrites(server)).toEqual([{ type: 'pty:write', id: WORKER, data: 'claude "/ct-exec T0580"\r' }])
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy.mock.calls[0][0]).toMatchObject({ id: WORKER, customEnv: WORKER_ENV })
    expect(emitted.map(e => [e.channel, e.payload.id])).toEqual([['terminal:created-externally', WORKER]])
    // reused is computed after the release
    expect(mirrored.find(m => m.event === 'terminal-created')?.payload.reusedExisting).toBe(false)
    expect(logs).toContain(`[BUG-146] terminal:create-with-command id=${WORKER} released: reused=false`)
    expect(directSpawnWarned()).toBe(false)
  })

  it('fresh start: lands on the new Terminal Server', async () => {
    manager.holdCreates('Recovery prompt pending')
    const result = dispatch()
    await flush()
    const server = connectServer() // startTerminalServer forked a new server
    manager.releaseCreates('fresh start')
    await expect(result).resolves.toMatchObject({ ok: true, terminalId: WORKER })
    expect(serverCreates(server)).toEqual([WORKER])
    expect(directSpawnWarned()).toBe(false)
  })

  it('reused is recomputed after the release (an id registered by the PTY list)', async () => {
    manager.holdCreates('Recovery prompt pending')
    const result = dispatch(SURVIVING)
    await flush()
    const server = connectServer()
    server.reply({ type: 'pty:list', ptys: [{ id: SURVIVING, pid: 4242, cwd: CWD }] })
    await result
    expect(mirrored.find(m => m.event === 'ipc-invoke')?.payload.reusedExisting).toBe(false) // before the answer
    expect(mirrored.find(m => m.event === 'terminal-reused')?.payload.reusedExisting).toBe(true)
    expect(serverCreates(server)).toEqual([]) // idempotent: nothing spawned
  })

  it(`still held after ${HELPER_CREATE_HOLD_WAIT_MS} ms → RECOVERY_PENDING, and not created when the answer comes later`, async () => {
    vi.useFakeTimers()
    manager.holdCreates('Recovery prompt pending')
    let result: unknown
    const pending = dispatch().then(r => { result = r })
    await vi.advanceTimersByTimeAsync(HELPER_CREATE_HOLD_WAIT_MS - 1)
    expect(result).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(result).toMatchObject({ ok: false, code: RECOVERY_PENDING })
    expect(String((result as { error: string }).error)).toContain('dispatch again')
    expect(mirrored.find(m => m.event === 'ipc-result')?.payload).toMatchObject({ result: false, reason: RECOVERY_PENDING })
    expect(warns.some(w => w.includes(`[BUG-146] terminal:create-with-command id=${WORKER} not created`))).toBe(true)

    // the answer comes: the refused dispatch has left the hold
    const server = connectServer()
    manager.releaseCreates('fresh start')
    await vi.advanceTimersByTimeAsync(0)
    expect(createSpy).not.toHaveBeenCalled()
    expect(serverCreates(server)).toEqual([])
    expect(emitted).toEqual([])
    expect(logger.log).toHaveBeenCalledWith('[BUG-146] pty:create released (fresh start): 0 held create(s)')
  })

  it('a refused dispatch does not disturb the tabs still held', async () => {
    vi.useFakeTimers()
    manager.holdCreates('Recovery prompt pending')
    const tab = ptyHandlers.get('pty:create')!({ windowId: 'w1' } as never, { id: SURVIVING, cwd: CWD, type: 'terminal', shell: 'test-shell' }) as Promise<unknown>
    const refused = dispatch()
    await vi.advanceTimersByTimeAsync(HELPER_CREATE_HOLD_WAIT_MS)
    await expect(refused).resolves.toMatchObject({ code: RECOVERY_PENDING })
    const server = connectServer()
    manager.releaseCreates('fresh start')
    await expect(tab).resolves.toEqual({ ok: true, created: true })
    expect(serverCreates(server)).toEqual([SURVIVING])
    expect(logger.log).toHaveBeenCalledWith(`[BUG-146] pty:create released (fresh start): 1 held create(s) [${SURVIVING}]`)
  })
})

describe('pty:restart while the Recovery prompt is pending (BUG-146 / T0580)', () => {
  it('holds, then restarts the surviving id on the Terminal Server after a recover', async () => {
    manager.holdCreates('Recovery prompt pending')
    const result = restart(SURVIVING)
    expect(result).toBeInstanceOf(Promise)
    let settled = false
    void (result as Promise<unknown>).then(() => { settled = true })
    await flush()
    expect(settled).toBe(false)
    expect(createSpy).not.toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledWith(`[BUG-146] pty:restart id=${SURVIVING} held until the Recovery prompt is answered`)

    const server = connectServer()
    manager.releaseCreatesOnReplayList()
    server.reply({ type: 'pty:list', ptys: [{ id: SURVIVING, pid: 4242, cwd: CWD }] })
    await expect(result).resolves.toBe(true)
    expect(server.sent.filter(m => m.type === 'pty:kill' || m.type === 'pty:create').map(m => [m.type, (m as { id: string }).id]))
      .toEqual([['pty:kill', SURVIVING], ['pty:create', SURVIVING]])
    expect(directSpawnWarned()).toBe(false)
  })

  it('fresh start: an id the new server does not have answers false (the renderer then creates it)', async () => {
    manager.holdCreates('Recovery prompt pending')
    const result = restart(SURVIVING)
    await flush()
    const server = connectServer()
    manager.releaseCreates('fresh start')
    await expect(result).resolves.toBe(false)
    expect(createSpy).not.toHaveBeenCalled()
    expect(serverCreates(server)).toEqual([])
  })
})

describe('without a hold nothing changes', () => {
  it('pty:restart answers synchronously', () => {
    const server = connectServer()
    expect(manager.createWithResult({ id: SURVIVING, cwd: CWD, type: 'terminal' })).toEqual({ ok: true, created: true })
    const result = restart(SURVIVING)
    expect(result).not.toBeInstanceOf(Promise)
    expect(result).toBe(true)
    expect(restart('unknown')).toBe(false)
    expect(serverCreates(server)).toEqual([SURVIVING, SURVIVING])
  })

  it('pty:restart with a manager that has no hold API (older test doubles / hosts)', () => {
    const handlers = new Map<string, SharedHandler>()
    const restartFn = vi.fn(() => true)
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, {
      getPtyManager: () => ({ restart: restartFn }) as unknown as PtyManager,
    })
    expect(handlers.get('pty:restart')!({} as never, SURVIVING, CWD)).toBe(true)
    expect(restartFn).toHaveBeenCalledWith(SURVIVING, CWD, undefined)
  })

  it('helper dispatch creates on the first pass, with no BUG-146 log', async () => {
    const server = connectServer()
    await expect(dispatch()).resolves.toMatchObject({ ok: true, terminalId: WORKER })
    expect(serverCreates(server)).toEqual([WORKER])
    expect(mirrored.map(m => m.event)).toEqual(['ipc-invoke', 'shell-resolution', 'terminal-created'])
    expect(logs.some(l => l.includes('[BUG-146]'))).toBe(false)
  })

  it('whenCreatesReleased resolves true right away without a hold (headless never holds)', async () => {
    await expect(manager.whenCreatesReleased(WORKER, { timeoutMs: 10 })).resolves.toBe(true)
    await expect(manager.whenCreatesReleased()).resolves.toBe(true)
  })

  it('headless builds its PtyManager without a create hold (source guard)', () => {
    const headless = fs.readFileSync(path.join(__dirname, '..', 'remote', 'headless-entry.ts'), 'utf8')
    expect(headless).not.toContain('holdCreates')
  })
})
