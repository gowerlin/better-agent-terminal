// @vitest-environment node
/**
 * PLAN-055 B1 / T0766: the Terminal Server recovery hands `onAgentsInterrupted` what each rebuilt
 * PTY still knew — 🔴 before `blockedTracker.clearAll` drops its `agentStarted` / claude session id.
 * Same fake fork IPC server as pty-manager-heartbeat-recovery.test.ts (nothing signals a real process).
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager, type PtyManagerDeps, type ServerWatchdogDeps } from '../pty-manager'
import { logger } from '../logger'
import type { InterruptedAgentSource } from '../interrupted-agents'
import { buildInterruptedAgentSnapshot } from '../interrupted-agents'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const CWD = os.tmpdir()
const SESSION = '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e'

class FakeServer extends EventEmitter {
  connected = true
  exitCode: number | null = null
  signalCode: string | null = null
  sent: ServerRequest[] = []
  disconnect = vi.fn(() => { this.connected = false })
  constructor(readonly pid: number) { super() }
  send = (msg: ServerRequest) => {
    this.sent.push(msg)
    if (msg.type === 'server:ping') this.reply({ type: 'server:pong' })
    return true
  }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let dataDir: string
let alive: Set<number>
let emit: Mock<PtyManagerDeps['emit']>
let manager: PtyManager
let onAgentsInterrupted: Mock<(sources: InterruptedAgentSource[]) => void>
let seenDuringCall: { sessionId: string | null; startedAt: number | null } | null
let old: FakeServer
let next: FakeServer

function handleServerDeath(m: PtyManager): Promise<void> {
  return (m as unknown as { handleServerDeath(r?: string): Promise<void> }).handleServerDeath('ipc-exit')
}

function start(id: string, opts: Record<string, unknown> = {}): void {
  expect(manager.create({ id, cwd: CWD, type: 'terminal', shell: 'test-shell', ...opts } as Parameters<PtyManager['create']>[0])).toBe(true)
  old.reply({ type: 'pty:created', id, pid: 100 })
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0766-pty-'))
  alive = new Set()
  const watchdog: ServerWatchdogDeps = {
    now: () => 0,
    isProcessAlive: (pid) => alive.has(pid),
    killTree: vi.fn(async (pid: number) => { alive.delete(pid); return 'killed' as const }),
    kill: vi.fn((pid: number) => { alive.delete(pid) }),
    platform: 'win32',
  }
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  emit = vi.fn<PtyManagerDeps['emit']>()
  seenDuringCall = null
  onAgentsInterrupted = vi.fn((sources: InterruptedAgentSource[]) => {
    // what the tracker says at the moment of the call: still the session (clearAll comes after)
    seenDuringCall = { sessionId: manager.getClaudeSessionId('claude-tab'), startedAt: manager.getAgentStartedAt('claude-tab') }
    void sources
  })
  manager = new PtyManager({ emit, dataDir, serverWatchdog: watchdog, onAgentsInterrupted })
  old = new FakeServer(4000)
  manager.setServerProcess(old as unknown as ChildProcess)
  alive.add(old.pid)
  next = new FakeServer(9000)
  manager.onRequestNewServer = vi.fn(async () => {
    alive.add(next.pid)
    return next as unknown as ChildProcess
  })
})

afterEach(() => {
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('Terminal Server recovery → onAgentsInterrupted (T0766)', () => {
  it('is called before clearAll: the claude tab still has its session id and agentStarted; after the recovery both are gone', async () => {
    start('claude-tab', { agentPreset: 'claude-cli', workspaceId: 'ws-1' })
    expect(manager.reportHookEvent('claude-tab', 'session-start', undefined, SESSION)?.result).toBe('started')
    start('shell-tab')

    await handleServerDeath(manager)

    expect(onAgentsInterrupted).toHaveBeenCalledTimes(1)
    expect(seenDuringCall?.sessionId).toBe(SESSION)
    expect(seenDuringCall?.startedAt).not.toBeNull()
    const sources = onAgentsInterrupted.mock.calls[0][0]
    const claude = sources.find(s => s.terminalId === 'claude-tab')
    expect(claude).toMatchObject({ agentPreset: 'claude-cli', workspaceId: 'ws-1', sessionId: SESSION, blockedDetection: 'hook', shell: 'test-shell', cwd: CWD })
    expect(claude?.startedAt).not.toBeNull()
    expect(sources.find(s => s.terminalId === 'shell-tab')).toMatchObject({ sessionId: null, startedAt: null })

    // the recovery itself is unchanged: the tracker is cleared and both PTYs are rebuilt as shells
    expect(manager.getClaudeSessionId('claude-tab')).toBeNull()
    expect(manager.getAgentStartedAt('claude-tab')).toBeNull()
    expect(next.sent.filter(m => m.type === 'pty:create').map(m => (m as { id: string }).id).sort()).toEqual(['claude-tab', 'shell-tab'])

    // the snapshot main builds lists the claude tab only
    const snapshot = buildInterruptedAgentSnapshot(sources, { nameOf: () => null, now: 1 })
    expect(snapshot.map(a => [a.terminalId, a.claudeSessionId, a.launchedBy])).toEqual([['claude-tab', SESSION, 'tab']])
  })

  it('a helper-dispatched Worker carries its work order and Tower (launchedBy dispatch)', async () => {
    start('worker-tab', { agentPreset: 'claude-cli', workorder: 'T0766', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo' } })
    await handleServerDeath(manager)
    const [source] = onAgentsInterrupted.mock.calls[0][0]
    expect(source).toMatchObject({ terminalId: 'worker-tab', workorder: 'T0766', towerTerminalId: 'tower-1' })
    expect(buildInterruptedAgentSnapshot([source], { nameOf: () => 'BAT · Worker · T0766', now: 1 })[0]).toMatchObject({ launchedBy: 'dispatch', claudeSessionName: 'BAT · Worker · T0766' })
  })

  it('a throwing listener is logged and the recovery still completes', async () => {
    onAgentsInterrupted.mockImplementation(() => { throw new Error('boom') })
    start('claude-tab', { agentPreset: 'claude-cli' })
    await handleServerDeath(manager)
    expect(emit.mock.calls.filter(([c]) => c === 'terminal-server:status').map(([, s]) => s)).toEqual(['recovering', 'recovered'])
    expect(next.sent.some(m => m.type === 'pty:create')).toBe(true)
  })

  it('source: the call sits between the T0576 surviving list and clearAll; the T0704 log line is unchanged', () => {
    const src = fs.readFileSync(path.join(__dirname, '../pty-manager.ts'), 'utf8')
    const body = src.slice(src.indexOf('private async handleServerDeath('))
    const call = body.indexOf('this.deps.onAgentsInterrupted?.(this.collectInterruptedAgentSources())')
    const clear = body.indexOf("this.blockedTracker.clearAll('Terminal Server recovery')")
    expect(call).toBeGreaterThan(body.indexOf('this.notifySurvivingPtys([])'))
    expect(call).toBeLessThan(clear)
    expect(body).toContain('Terminal Server died — attempting recovery... (reason=${reason})')
  })
})
