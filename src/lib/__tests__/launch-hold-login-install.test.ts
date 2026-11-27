// @vitest-environment node
/**
 * BUG-232 / T0956: the "not logged in" login tab (`openClaudeLoginTerminal`, typed, never
 * submitted) and the remote tool install tab (`runRemoteToolInstall`) type their command into a
 * new shell ~500 ms after `pty:create`, with the tab focused — the BUG-231 window. Both now use
 * the T0951 hold unchanged: `pty:create` with `holdInputUntilLaunch: true`, the command through
 * `sendLaunchCommand` → `pty:launch-command` (the command, then the held input).
 *
 * End to end on the real handlers + PtyManager (Terminal Server mode, fake fork channel, as
 * electron/__tests__/launch-input-hold.test.ts): what the PTY receives, in order.
 */
import { EventEmitter } from 'events'
import * as os from 'os'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('handlers/pty / pty-manager must not import electron')
})

import { PtyManager } from '../../../electron/pty-manager'
import { logger } from '../../../electron/logger'
import { registerPtyHandlers } from '../../../electron/handlers/pty'
import type { HandlerContext, SharedHandler } from '../../../electron/handlers/types'
import type { ServerRequest, ServerResponse } from '../../../electron/terminal-server/protocol'
import type { CreatePtyOptions, PtyCreateResult } from '../../types'
import { REMOTE_AUTH_ENV_VARS, REMOTE_TOOL_IDS, type RemoteToolsDetectResult, type RemoteToolsEnv } from '../../types/remote-tools'
import { openClaudeLoginTerminal } from '../claude-login-guide'
import { LAUNCH_COMMAND_DELAY_MS, sendLaunchCommand, type LaunchCommandApi } from '../launch-command'
import { runRemoteToolInstall, type InstallRunnerDeps } from '../remote-tools/install-runner'
import { wrapWithSentinel } from '../remote-tools/sentinel'

const ID = 'tab-1'
const CWD = os.tmpdir()
const BASH = '/bin/bash'
const CLI = '/home/demo/.local/bin/claude'
const LOGIN = `'${CLI}' auth login`
const NONCE = '0123456789abcdef'
const LOCAL: HandlerContext = { windowId: 'w1' } as HandlerContext

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let server: FakeServer
let manager: PtyManager
let handlers: Map<string, SharedHandler>

const call = (channel: string, ...args: unknown[]) => Promise.resolve(handlers.get(channel)!(LOCAL, ...args))

/** What reached the Terminal Server's PTY `id`, in order. */
function writes(id = ID): string[] {
  return server.sent.flatMap(m => (m.type === 'pty:write' && m.id === id ? [m.data] : []))
}

/** `createPtyThenLaunch` on the real handler: the server answers `pty:created`; `launch` only for a fresh shell. */
async function createThenLaunch(options: CreatePtyOptions, launch: () => void, oldHost = false): Promise<PtyCreateResult> {
  // a host before T0951 does not know the flag (no hold)
  const { holdInputUntilLaunch: _flag, ...withoutFlag } = options
  const result = await call('pty:create', oldHost ? withoutFlag : options) as PtyCreateResult
  server.reply({ type: 'pty:created', id: options.id, pid: 100 })
  if (result.created) launch()
  return result
}

/** The renderer's PTY API against the handlers; `oldHost` = no `pty:launch-command` handler. */
function ptyApi(oldHost = false): LaunchCommandApi {
  return {
    write: (id, data) => call('pty:write', id, data),
    launchCommand: async (id, command) => {
      if (oldHost) throw new Error('No handler for channel: pty:launch-command')
      return call('pty:launch-command', id, command)
    },
  }
}

/** The user types `text` into the tab before the command: the window's own `pty:write`. */
async function typeBeforeCommand(text: string): Promise<unknown> {
  return call('pty:write', ID, text)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  server = new FakeServer()
  manager = new PtyManager({ emit: () => undefined, dataDir: os.tmpdir() })
  manager.setServerProcess(server as unknown as ChildProcess)
  handlers = new Map()
  registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, { getPtyManager: () => manager })
})

afterEach(() => {
  vi.useRealTimers()
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

// ─── Login tab ───────────────────────────────────────────────────────────────

async function openLoginTab(opts: { oldHost?: boolean; withHold?: boolean } = {}) {
  const { oldHost = false, withHold = true } = opts
  const api = ptyApi(oldHost)
  const creates: CreatePtyOptions[] = []
  await openClaudeLoginTerminal({
    addTerminal: () => ID,
    getShell: async () => BASH,
    getCliPath: async () => CLI,
    // the WorkspaceView wiring: the hold options go into pty:create as they are
    createShell: (terminalId, shell, launch, launchHold) => {
      const options: CreatePtyOptions = { id: terminalId, cwd: CWD, type: 'terminal', shell, ...launchHold }
      creates.push(options)
      return createThenLaunch(options, launch, oldHost)
    },
    write: (terminalId, data) => { void api.write(terminalId, data) },
    ...(withHold ? { sendLaunchCommand: (terminalId: string, data: string) => sendLaunchCommand(terminalId, data, api) } : {}),
  })
  return creates
}

describe('login tab (BUG-232): the typed login command goes ahead of the input', () => {
  it('typed before the command → the PTY gets the command, complete and without Enter, then the input', async () => {
    const creates = await openLoginTab()
    expect(creates[0].holdInputUntilLaunch).toBe(true)
    // the flag is not passed on to the Terminal Server
    expect(JSON.stringify(server.sent.find(m => m.type === 'pty:create'))).not.toContain('holdInputUntilLaunch')

    expect(await typeBeforeCommand('ls')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(await typeBeforeCommand('中')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(writes()).toEqual([])

    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual([LOGIN, 'ls', '中'])
    expect(writes()[0]).not.toMatch(/[\r\n]/)
    // after the command: written at once (no hold left)
    expect(await typeBeforeCommand('x')).toEqual({ ok: true, reason: 'queued' })
    expect(writes()).toEqual([LOGIN, 'ls', '中', 'x'])
  })

  it('nothing typed → only the command (no Enter)', async () => {
    await openLoginTab()
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual([LOGIN])
  })

  it('a host before T0951 (no hold, `No handler`) → pty:write, the same line as before the fix', async () => {
    await openLoginTab({ oldHost: true })
    await typeBeforeCommand('ls')
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual(['ls', LOGIN])
  })

  it('without `sendLaunchCommand` (as before T0956): no hold requested, plain write after 500 ms', async () => {
    const creates = await openLoginTab({ withHold: false })
    expect(creates[0]).not.toHaveProperty('holdInputUntilLaunch')
    expect(await typeBeforeCommand('ls')).toEqual({ ok: true, reason: 'queued' })
    await vi.advanceTimersByTimeAsync(500)
    expect(writes()).toEqual(['ls', LOGIN])
  })
})

// ─── Remote tool install tab ─────────────────────────────────────────────────

const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']
const MISSING: RemoteToolsDetectResult = {
  ok: true,
  report: {
    schemaVersion: 1,
    env: { osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: NO_AUTH_ENV },
    tools: REMOTE_TOOL_IDS.map((id) => ({ id, status: 'missing', login: 'n/a', serverVisible: false })),
    serverViewAvailable: true,
    warnings: [],
  },
}

async function startInstall(opts: { oldHost?: boolean; withHold?: boolean } = {}) {
  const { oldHost = false, withHold = true } = opts
  const api = ptyApi(oldHost)
  const creates: CreatePtyOptions[] = []
  const deps: InstallRunnerDeps = {
    detectHere: async () => MISSING,
    ensureWorkspace: async () => ({ id: 'ws-1', folderPath: CWD }),
    resolveShell: async () => BASH,
    addTerminal: () => ID,
    createPty: (options, launch) => { creates.push(options); return createThenLaunch(options, launch, oldHost) },
    write: (id, data) => { void api.write(id, data) },
    onOutput: () => () => undefined,
    onExit: () => () => undefined,
    notify: () => undefined,
    generateNonce: () => NONCE,
    // the useRemoteToolInstall wiring
    ...(withHold ? { sendLaunchCommand: (id: string, data: string) => sendLaunchCommand(id, data, api) } : {}),
  }
  const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, deps)
  if (start.status !== 'started') throw new Error(`install did not start: ${start.status}`)
  return { creates, line: wrapWithSentinel(start.plan.command, NONCE) + '\r' }
}

describe('remote tool install tab (BUG-232): the install line goes ahead of the input', () => {
  it('typed before the line → the PTY gets the line, complete with its Enter, then the input', async () => {
    const { creates, line } = await startInstall()
    expect(creates[0].holdInputUntilLaunch).toBe(true)
    expect(JSON.stringify(server.sent.find(m => m.type === 'pty:create'))).not.toContain('holdInputUntilLaunch')

    expect(await typeBeforeCommand('ls')).toEqual({ ok: true, reason: 'held-until-dispatch' })
    expect(writes()).toEqual([])
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual([line, 'ls'])
  })

  it('nothing typed → only the line', async () => {
    const { line } = await startInstall()
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual([line])
  })

  it('a host before T0951 → pty:write, the same line as before the fix', async () => {
    const { line } = await startInstall({ oldHost: true })
    await typeBeforeCommand('ls')
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(writes()).toEqual(['ls', line])
  })

  it('without `sendLaunchCommand` (as before T0956): the pty:create options carry no flag', async () => {
    const { creates, line } = await startInstall({ withHold: false })
    expect(creates[0]).not.toHaveProperty('holdInputUntilLaunch')
    await typeBeforeCommand('ls')
    await vi.advanceTimersByTimeAsync(500)
    expect(writes()).toEqual(['ls', line])
  })
})
