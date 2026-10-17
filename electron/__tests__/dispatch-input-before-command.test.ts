// @vitest-environment node
/**
 * BUG-151 / T0598: input that reaches a dispatched PTY before its launch command.
 *
 * A helper dispatch creates the PTY, and the tab lands in the active workspace with the keyboard
 * focus (BUG-135 / T0532); the launch command is written 500 ms later. A keystroke meant for the
 * Tower tab in between went to the new shell first — `, ` became `, 'C:\…\claude.exe' …` →
 * `bash: ,: command not found` (BMad-Guide T0161, settings.json `shell = "git-bash"`).
 *
 *   - PtyManager (Terminal Server mode, fake fork channel): `holdInputForDispatch` →
 *     `writeWithResult` input waits → `writeDispatchCommand` writes the command, then the input
 *   - the terminal's own replies (`isTerminalAutoReply`) are not held
 *   - no held input → no log; the hold ends with the command or with the PTY
 *   - `terminal:create-agent-command` end to end on a real PtyManager: the stray input follows
 *     the command; a pty manager without the T0598 methods still gets the command by `write`
 */
import { EventEmitter } from 'events'
import * as os from 'os'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-command-handlers / pty-manager must not import electron')
})

import { PtyManager } from '../pty-manager'
import { logger } from '../logger'
import { registerTerminalCommandHandlers } from '../terminal-command-handlers'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

const ID = 'worker-1'
const CWD = os.tmpdir()
const COMMAND = "'C:\\Users\\u\\.local\\bin\\claude.exe' --effort high '/ct-exec T0598'\r"
const WIN_GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let server: FakeServer
let manager: PtyManager
let logs: string[]

function writes(): string[] {
  return server.sent.flatMap(m => (m.type === 'pty:write' && m.id === ID ? [m.data] : []))
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
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

describe('PtyManager: input held until the dispatch command', () => {
  beforeEach(() => {
    expect(manager.create({ id: ID, cwd: CWD, type: 'terminal', shell: WIN_GIT_BASH })).toBe(true)
    server.reply({ type: 'pty:created', id: ID, pid: 100 })
  })

  it('a keystroke before the command follows it (the BUG-151 line)', () => {
    manager.holdInputForDispatch(ID)
    expect(manager.writeWithResult(ID, ', ')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(writes()).toEqual([])

    manager.writeDispatchCommand(ID, COMMAND)
    expect(writes()).toEqual([COMMAND, ', '])
    expect(logs).toContain(`[agent-command] id=${ID} input before the dispatch command: 1 write(s), 2 bytes → sent after it`)

    // the hold is over: input goes straight through again
    expect(manager.writeWithResult(ID, 'x')).toEqual({ ok: true, reason: 'queued' })
    expect(writes()).toEqual([COMMAND, ', ', 'x'])
  })

  it('several writes keep their order; bytes are UTF-8 bytes', () => {
    manager.holdInputForDispatch(ID)
    manager.writeWithResult(ID, 'ab')
    manager.writeWithResult(ID, '中')
    manager.writeDispatchCommand(ID, COMMAND)
    expect(writes()).toEqual([COMMAND, 'ab', '中'])
    expect(logs).toContain(`[agent-command] id=${ID} input before the dispatch command: 2 write(s), 5 bytes → sent after it`)
  })

  it('the terminal\'s own replies (focus report, DSR answer) are not held', () => {
    manager.holdInputForDispatch(ID)
    manager.writeWithResult(ID, '\x1b[I')
    manager.writeWithResult(ID, '\x1b[12;1R')
    expect(writes()).toEqual(['\x1b[I', '\x1b[12;1R'])
    manager.writeDispatchCommand(ID, COMMAND)
    expect(writes()).toEqual(['\x1b[I', '\x1b[12;1R', COMMAND])
    expect(logs.some(l => l.includes('input before the dispatch command'))).toBe(false)
  })

  it('without a hold the command is a plain write and nothing is logged', () => {
    manager.writeDispatchCommand(ID, COMMAND)
    expect(writes()).toEqual([COMMAND])
    expect(logs.some(l => l.includes('input before the dispatch command'))).toBe(false)
  })

  it('the hold ends with the PTY (kill before the command)', () => {
    manager.holdInputForDispatch(ID)
    manager.writeWithResult(ID, ', ')
    manager.kill(ID)
    expect(manager.writeWithResult(ID, 'y')).toEqual({ ok: false, reason: 'pty-not-found' })
    manager.writeDispatchCommand(ID, COMMAND) // the delayed write still fires: nothing held is replayed
    expect(writes()).not.toContain(', ')
  })

  it('an unknown id is not held', () => {
    manager.holdInputForDispatch('no-such-pty')
    expect(manager.writeWithResult('no-such-pty', 'z')).toEqual({ ok: false, reason: 'pty-not-found' })
  })
})

interface DispatchHarness {
  handler: Handler
  fireDelayed(): void
}

function harness(pty: unknown): DispatchHarness {
  const handlers = new Map<string, Handler>()
  const delayed: Array<() => void> = []
  registerTerminalCommandHandlers({
    registerHandler(channel, handler) {
      handlers.set(channel, handler as Handler)
    },
    getPtyManager: () => pty as never,
    getAllWindows: () => [],
    readPersistedSettingsSync: () => ({ shell: 'git-bash', customShellPath: '' }),
    buildAgentPromptCommand: async o => ({
      command: `'C:\\Users\\u\\.local\\bin\\claude.exe' --effort high ${o.shellFamily === 'posix' ? "'/ct-exec T0598'" : '?'}`,
      agentId: 'claude-cli',
      prompt: '/ct-exec T0598',
      prefixNormalized: false,
    }),
    pickWhitelistedEnv: () => ({}),
    mirrorToBatScripts: () => undefined,
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: () => undefined },
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' },
    existsSync: p => p === WIN_GIT_BASH,
    setTimeout: (callback: () => void) => {
      delayed.push(callback)
      return 0
    },
  })
  const handler = handlers.get('terminal:create-agent-command')
  if (!handler) throw new Error('terminal:create-agent-command was not registered')
  return { handler, fireDelayed: () => { for (const cb of delayed.splice(0)) cb() } }
}

describe('terminal:create-agent-command (git-bash) on a real PtyManager', () => {
  it('a keystroke between create and the 500 ms command follows the command', async () => {
    const h = harness(manager)
    expect(await h.handler({ windowId: null }, { id: ID, cwd: CWD, skill: 'ct-exec', workorder: 'T0598', agent: 'claude-cli' })).toBe(true)
    const create = server.sent.find(m => m.type === 'pty:create')
    expect(create && create.type === 'pty:create' ? create.shell : null).toBe(WIN_GIT_BASH)
    server.reply({ type: 'pty:created', id: ID, pid: 100 })

    // the renderer's xterm (the new tab has the focus) → pty:write → writeWithResult
    manager.writeWithResult(ID, ', ')
    expect(writes()).toEqual([])

    h.fireDelayed()
    expect(writes()).toEqual([COMMAND, ', '])
    expect(writes()[0].startsWith("'C:\\")).toBe(true)
  })

  it('a pty manager without the T0598 methods (older interface) still gets the command by write', async () => {
    const written: string[] = []
    const h = harness({
      isAlive: () => false,
      create: () => true,
      write: (_id: string, data: string) => { written.push(data) },
    })
    expect(await h.handler({ windowId: null }, { id: ID, cwd: CWD, skill: 'ct-exec', workorder: 'T0598', agent: 'claude-cli' })).toBe(true)
    h.fireDelayed()
    expect(written).toEqual([COMMAND])
  })
})
