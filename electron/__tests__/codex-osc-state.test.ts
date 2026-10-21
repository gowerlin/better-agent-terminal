// @vitest-environment node
/**
 * PLAN-047 M1b-2 / T0621 (D158): codex tabs report `blocked` / `agentStarted` through codex's own
 * OSC 7501 (src/lib/codex-terminal-state.ts → `TerminalBlockedTracker.observeCodexState`).
 *
 *   - tracker: the transition table (C-2 / C-3 / C-4), `osc` set by the first sequence, never over
 *     `hook`, user input does not clear `input`, C-8 log lines, `onChange`
 *   - PtyManager: the read-only tap in `enqueuePtyOutput` (split chunks, output unchanged), cleared by
 *     exit / kill / restart (the exited record keeps `agentStartedAt`), the replay scan (C-7), the
 *     Terminal Server recovery
 *   - query handlers: get-state / list / wait with `osc` / `input`, `agentStarted` false → true,
 *     `until: 'agent-started'`, precedence over `tower`; T0623: the attention push shows `input`
 *   - C-5: resolving the dispatched codex, `codex --version` (execFile, array args, timeout), the
 *     path + mtime cache, `[codex-version]` lines
 *   - C-5 / C-6 in `createAgentPromptCommandBuilder`: `osc` recorded after the MCP decision, only
 *     for a named codex dispatch; `-c check_for_update_on_startup=false` for dispatched codex only
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('codex OSC state must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { CODEX_OSC_PREFIX } from '../../src/lib/codex-terminal-state'
import { buildBatMcpLaunchArgs, type BatMcpHost } from '../bat-mcp-launch'
import { CODEX_VERSION_TIMEOUT_MS, createCodexOscVersionCheck, resolveDispatchCodexBinary, type ExecFileLike } from '../codex-osc-version'
import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import { computeTerminalAttention } from '../terminal-attention'
import { TerminalBlockedTracker } from '../terminal-blocked-state'
import {
  CODEX_DISPATCH_NO_UPDATE_CHECK,
  createAgentPromptCommandBuilder,
  userArgsSetCodexUpdateCheck,
  type AgentPromptCommandDeps,
} from '../terminal-command-handlers'
import { registerTerminalQueryHandlers, TERMINAL_QUERY_IDLE_MS, type TerminalQueryHandlers } from '../terminal-query-handlers'
import type { QuestionSummary } from '../tower-questions'

const ST = '\x1b\\'
const osc = (state: string, end = ST) => `${CODEX_OSC_PREFIX}state=${state}:app=codex${end}`

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
const CWD = os.tmpdir()
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let dataDir: string
const managers: PtyManagerType[] = []
const logs: string[] = []

beforeEach(() => {
  logs.length = 0
  vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0621-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function makeManager(opts: { onBlockedChange?: (id: string) => void } = {}) {
  const registry = new HelperCapabilityRegistry()
  const fakes = new Map<string, FakePty>()
  const emit = vi.fn()
  const manager = new PtyManager({
    emit,
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => { registry.revokeTerminal(id) },
    ...(opts.onBlockedChange ? { onBlockedChange: opts.onBlockedChange } : {}),
  })
  managers.push(manager)
  const create = (id: string, o: { towerId?: string; workspaceId?: string } = {}) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      ...TAB,
      ...(o.workspaceId ? { workspaceId: o.workspaceId } : {}),
      ...(o.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: o.towerId } } : {}),
    })).toBe(true)
    const fake = ptySpawn.mock.results[before].value as FakePty
    fakes.set(id, fake)
    return fake
  }
  const exit = (id: string, exitCode = 0) => {
    const onExit = fakes.get(id)!.onExit.mock.calls.at(-1)![0] as (e: { exitCode: number }) => void
    onExit({ exitCode })
  }
  const output = (id: string, data: string) => {
    const onData = fakes.get(id)!.onData.mock.calls.at(-1)![0] as (d: string) => void
    onData(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }
  return { manager, registry, create, exit, output, emit }
}

describe('TerminalBlockedTracker.observeCodexState (T0621)', () => {
  function tracker() {
    const lines: string[] = []
    const changes: string[] = []
    let t = 1000
    const tr = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t, id => changes.push(id))
    return { tr, lines, changes, at: (ms: number) => { t = ms } }
  }

  it('the transition table: first sequence → osc + agentStarted; blocked → input; working / idle / clear → cleared', () => {
    const { tr, lines, changes, at } = tracker()
    expect(tr.getDetection('a')).toBe('none')
    expect(tr.observeCodexState('a', 'idle')).toBe('unchanged')
    expect(tr.getDetection('a')).toBe('osc')
    expect(tr.getStartedAt('a')).toBe(1000)
    at(2000)
    expect(tr.observeCodexState('a', 'working')).toBe('unchanged')
    expect(tr.observeCodexState('a', 'blocked')).toBe('blocked')
    expect(tr.get('a')).toEqual({ reason: 'input', since: 2000, source: 'osc' })
    at(3000)
    expect(tr.observeCodexState('a', 'blocked')).toBe('unchanged') // same reason, since kept
    expect(tr.get('a')?.since).toBe(2000)
    expect(tr.observeCodexState('a', 'working')).toBe('cleared')
    expect(tr.get('a')).toBeNull()
    tr.observeCodexState('a', 'blocked')
    expect(tr.observeCodexState('a', 'idle')).toBe('cleared')
    tr.observeCodexState('a', 'blocked')
    expect(tr.observeCodexState('a', 'clear')).toBe('cleared')
    expect(tr.getStartedAt('a')).toBe(1000) // only the first one
    expect(lines).toEqual([
      '[codex-state] terminal=a → idle',
      '[agent-start] terminal=a → started (osc idle)',
      '[codex-state] terminal=a → working',
      '[turn] terminal=a → started (osc working)', // T0694
      '[codex-state] terminal=a → blocked',
      '[blocked] terminal=a → blocked reason=input (osc)',
      '[codex-state] terminal=a → working',
      '[blocked] terminal=a → cleared (osc working)',
      '[codex-state] terminal=a → blocked',
      '[blocked] terminal=a → blocked reason=input (osc)',
      '[codex-state] terminal=a → idle',
      '[turn] terminal=a → ended (osc idle)', // T0694
      '[blocked] terminal=a → cleared (osc idle)',
      '[codex-state] terminal=a → blocked',
      '[blocked] terminal=a → blocked reason=input (osc)',
      '[codex-state] terminal=a → clear',
      '[blocked] terminal=a → cleared (osc clear)',
    ])
    // T0694: + the turn's start (working) and end (idle)
    expect(changes).toEqual(['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'])
  })

  it('a hook tab ignores the sequence (C-1): detection, blocked and agentStarted untouched', () => {
    const { tr, lines } = tracker()
    tr.report('h', 'permission-request', 'Bash')
    expect(tr.observeCodexState('h', 'idle')).toBe('ignored')
    expect(tr.observeCodexState('h', 'blocked')).toBe('ignored')
    expect(tr.getDetection('h')).toBe('hook')
    expect(tr.get('h')).toMatchObject({ reason: 'permission' })
    expect(tr.getStartedAt('h')).toBeNull()
    expect(lines.some(l => l.includes('codex-state') || l.includes('(osc'))).toBe(false)
  })

  it('user input clears a hook reason, never input (C-2)', () => {
    const { tr } = tracker()
    tr.observeCodexState('c', 'blocked')
    expect(tr.clearForUserInput('c')).toBe(false)
    expect(tr.get('c')).toMatchObject({ reason: 'input' })
    tr.report('h', 'ask-user-question')
    expect(tr.clearForUserInput('h')).toBe(true)
    expect(tr.get('h')).toBeNull()
  })

  it('a dispatch-time `osc` (C-5): agentStarted stays unset until the first sequence', () => {
    const { tr } = tracker()
    tr.setDetection('w', 'osc')
    expect(tr.getStartedAt('w')).toBeNull()
    tr.observeCodexState('w', 'working')
    expect(tr.getStartedAt('w')).toBe(1000)
    expect(tr.getDetection('w')).toBe('osc')
  })

  it('clearAll (recovery) and clearStarted (PTY end) forget the codex state: the next one is logged again', () => {
    const { tr, lines } = tracker()
    tr.observeCodexState('a', 'blocked')
    tr.clearAll('Terminal Server recovery')
    expect(tr.get('a')).toBeNull()
    expect(tr.getStartedAt('a')).toBeNull()
    lines.length = 0
    tr.observeCodexState('a', 'blocked')
    expect(lines).toContain('[codex-state] terminal=a → blocked')
    expect(lines).toContain('[agent-start] terminal=a → started (osc blocked)')
    tr.clear('a', 'the PTY ended')
    tr.clearStarted('a')
    lines.length = 0
    tr.observeCodexState('a', 'blocked')
    expect(lines).toContain('[codex-state] terminal=a → blocked')
  })
})

describe('PtyManager: the OSC 7501 tap (T0621)', () => {
  it('a codex tab in a shell: osc, input, agentStarted; output reaches the renderer unchanged', () => {
    const changes: string[] = []
    const { manager, create, output, emit } = makeManager({ onBlockedChange: id => changes.push(id) })
    create('a')
    output('a', '$ codex\r\n')
    expect(manager.getBlockedDetection('a')).toBe('none')
    expect(manager.getAgentStartedAt('a')).toBeNull()
    const chunk = `\x1b[?1049h${osc('idle')}`
    output('a', chunk)
    expect(manager.getBlockedDetection('a')).toBe('osc')
    expect(manager.getAgentStartedAt('a')).toEqual(expect.any(Number))
    expect(emit).toHaveBeenCalledWith('pty:output', 'a', chunk)
    // split across two chunks
    const blocked = osc('blocked')
    output('a', `Would you like to run…${blocked.slice(0, 9)}`)
    expect(manager.getBlockedState('a')).toBeNull()
    output('a', blocked.slice(9))
    expect(manager.getBlockedState('a')).toMatchObject({ reason: 'input', source: 'osc' })
    expect(changes).toEqual(['a'])
    // the user's keys do not clear it; codex's own transition does
    manager.noteUserInput('a')
    expect(manager.getBlockedState('a')).toMatchObject({ reason: 'input' })
    output('a', osc('working'))
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs).toContain('[blocked] terminal=a → cleared (osc working)')
    expect(logs.some(l => l.includes('Would you like'))).toBe(false) // never the output
  })

  it('a PTY that never prints OSC 7501 stays as it was', () => {
    const { manager, create, output } = makeManager()
    create('p')
    manager.setBlockedDetection('p', 'hook')
    output('p', `\x1b]0;title\x07\x1b]9;note\x07plain\r\n${osc('blocked')}`) // a hook tab ignores it
    expect(manager.getBlockedDetection('p')).toBe('hook')
    expect(manager.getBlockedState('p')).toBeNull()
    expect(manager.getAgentStartedAt('p')).toBeNull()
    create('q')
    output('q', 'just a shell\r\n')
    expect(manager.getBlockedDetection('q')).toBe('none')
  })

  it('exit / kill / restart clear input and agentStarted; the exited record keeps agentStartedAt; detection is kept', () => {
    const { manager, create, output, exit } = makeManager()
    create('a')
    output('a', osc('blocked'))
    const startedAt = manager.getAgentStartedAt('a')!
    exit('a', 0)
    expect(manager.getBlockedState('a')).toBeNull()
    expect(manager.getExitedPty('a')?.agentStartedAt).toBe(startedAt)
    expect(manager.getBlockedDetection('a')).toBe('osc')

    create('b')
    output('b', osc('blocked'))
    manager.kill('b')
    expect(manager.getBlockedState('b')).toBeNull()

    create('c')
    output('c', `${osc('blocked')}${CODEX_OSC_PREFIX}state=wo`) // an open tail too
    expect(manager.restart('c', CWD, '/bin/sh')).toBe(true)
    expect(manager.getBlockedState('c')).toBeNull()
    expect(manager.getAgentStartedAt('c')).toBeNull()
    expect(manager.getBlockedDetection('c')).toBe('osc') // `false` until the new codex sends one
    output('c', `rking${ST}`) // the old tail is gone: no state from it
    expect(manager.getAgentStartedAt('c')).toBeNull()
  })

  it('C-7: the Terminal Server replay restores the last OSC 7501 (agentStarted = scan time); none → unchanged', () => {
    const { manager } = makeManager()
    const internals = manager as unknown as {
      handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void
      handleReplayBuffer(id: string, lines: string[]): void
      sendToServer(msg: unknown): void
    }
    internals.sendToServer = () => {}
    internals.handleReplayList([{ id: 'r1', pid: 1, cwd: CWD }, { id: 'r2', pid: 2, cwd: CWD }, { id: 'r3', pid: 3, cwd: CWD }])
    const before = Date.now()
    internals.handleReplayBuffer('r1', ['codex', `${osc('working')}…`, `${osc('blocked')}Allow?`])
    internals.handleReplayBuffer('r2', [`${osc('blocked')}`, `${osc('idle')}`, '$ '])
    internals.handleReplayBuffer('r3', ['plain shell', '$ '])
    expect(manager.getBlockedDetection('r1')).toBe('osc')
    expect(manager.getBlockedState('r1')).toMatchObject({ reason: 'input', source: 'osc' })
    expect(manager.getAgentStartedAt('r1')).toBeGreaterThanOrEqual(before)
    expect(manager.getBlockedDetection('r2')).toBe('osc')
    expect(manager.getBlockedState('r2')).toBeNull()
    expect(manager.getAgentStartedAt('r2')).toEqual(expect.any(Number))
    expect(manager.getBlockedDetection('r3')).toBe('none')
    expect(manager.getAgentStartedAt('r3')).toBeNull()
    expect(logs).toContain('[PtyManager] replay: PTY r1 last codex state=blocked')
    // replay-registered instances have no process here (no Terminal Server): not for a direct dispose
    ;(manager as unknown as { instances: Map<string, unknown> }).instances.clear()
  })

  it('the Terminal Server recovery clears codex state and the open tails (source)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'pty-manager.ts'), 'utf8')
    const recovery = src.slice(src.indexOf('Terminal Server died — attempting recovery'))
    expect(recovery).toMatch(/this\.blockedTracker\.clearAll\('Terminal Server recovery'\)\s*\n\s*this\.codexStates\.dispose\(\)/)
    // read only: the tap does not touch `data` before it is queued
    const tap = src.slice(src.indexOf('private enqueuePtyOutput('), src.indexOf('private flushPtyOutputs('))
    expect(tap).toMatch(/this\.codexStates\.feed\(id, data\)/)
    expect(tap).toMatch(/this\.outputBuffers\.set\(id, prev \+ data\)/)
  })
})

function setupQueries(questions: Map<string, QuestionSummary> = new Map()) {
  const env = makeManager()
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const queries = registerTerminalQueryHandlers({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getPtyManager: () => env.manager,
    isWorkerOf: (c, tw) => env.registry.isWorkerOf(c, tw),
    getQuestionSummary: id => questions.get(id) ?? { pending: 0, blockingSince: null },
    logger: { log: () => {} },
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = env.manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Promise<Record<string, unknown>> | Record<string, unknown>
  env.create('tw', { workspaceId: 'ws' })
  env.create('wk', { workspaceId: 'ws', towerId: 'tw' })
  env.manager.setTerminalRole('tw', 'tower')
  return { ...env, queries, asHelper, call }
}

describe('query handlers: osc / input (T0621)', () => {
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  it('get-state: agentStarted false (osc at launch) → true; blocked / input / source osc; exited keeps agentStartedAt', () => {
    const h = setupQueries()
    queries = h.queries
    h.manager.setBlockedDetection('wk', 'osc') // the dispatch's version check (C-5)
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' }))
      .toMatchObject({ ok: true, state: 'idle', source: 'output', blockedDetection: 'osc', agentStarted: false })
    h.output('wk', osc('idle'))
    const startedAt = h.manager.getAgentStartedAt('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' }))
      .toMatchObject({ state: 'working', blockedDetection: 'osc', agentStarted: true, agentStartedAt: startedAt })
    h.output('wk', osc('blocked'))
    const since = h.manager.getBlockedState('wk')!.since
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toEqual({
      ok: true,
      terminalId: 'wk',
      state: 'blocked',
      lastOutputAt: expect.any(Number),
      idleMs: expect.any(Number),
      blockedReason: 'input',
      blockedSince: since,
      source: 'osc',
      blockedDetection: 'osc',
      pendingQuestions: 0,
      agentStarted: true,
      agentStartedAt: startedAt,
      claudeSessionName: null, // T0642: codex
      claudeSessionId: null,
    })
    const list = h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }
    expect(list.terminals.find(t => t.id === 'wk')).toMatchObject({ state: 'blocked', blockedReason: 'input', blockedDetection: 'osc', agentStarted: true })
    h.manager.kill('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' }))
      .toMatchObject({ state: 'exited', blockedDetection: 'osc', agentStarted: true, agentStartedAt: startedAt })
  })

  it('a manual codex tab (no launch decision): none / null until the first sequence', () => {
    const h = setupQueries()
    queries = h.queries
    expect(h.call('terminal:get-state', h.asHelper('wk'))).toMatchObject({ blockedDetection: 'none', agentStarted: null })
    h.output('wk', osc('working'))
    expect(h.call('terminal:get-state', h.asHelper('wk'))).toMatchObject({ blockedDetection: 'osc', agentStarted: true })
  })

  it('precedence: input over tower; tower once input clears', () => {
    const questions = new Map<string, QuestionSummary>()
    const h = setupQueries(questions)
    queries = h.queries
    questions.set('wk', { pending: 1, blockingSince: 5 } as QuestionSummary)
    h.output('wk', osc('blocked'))
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ state: 'blocked', blockedReason: 'input', source: 'osc', pendingQuestions: 1 })
    h.output('wk', osc('working'))
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ state: 'blocked', blockedReason: 'tower', source: 'question' })
  })

  it('wait: state-change on entering and leaving input; until agent-started on the first sequence', async () => {
    vi.useFakeTimers()
    const h = setupQueries()
    queries = h.queries
    h.manager.setBlockedDetection('wk', 'osc')
    vi.setSystemTime(Date.now() + TERMINAL_QUERY_IDLE_MS + 10)
    const started = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'agent-started', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(500)
    h.output('wk', osc('idle'))
    await vi.advanceTimersByTimeAsync(300)
    expect(await started).toMatchObject({ ok: true, changed: true, agentStarted: true, blockedDetection: 'osc' })

    vi.setSystemTime(Date.now() + TERMINAL_QUERY_IDLE_MS + 10) // idle again
    const entering = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(300)
    h.output('wk', osc('blocked'))
    await vi.advanceTimersByTimeAsync(300)
    expect(await entering).toMatchObject({ changed: true, state: 'blocked', blockedReason: 'input' })
    const leaving = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change', fromState: 'blocked', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(300)
    h.output('wk', osc('working'))
    await vi.advanceTimersByTimeAsync(300)
    expect(await leaving).toMatchObject({ changed: true, state: 'working' })
  })

  it('T0623: the attention push (badge) shows input, over tower', () => {
    expect(computeTerminalAttention('a', { reason: 'input', since: 1, source: 'osc' }, null)).toEqual({ id: 'a', blockedReason: 'input', blockedSince: 1, pendingQuestions: 0 })
    expect(computeTerminalAttention('a', { reason: 'input', since: 1, source: 'osc' }, { pending: 1, blockingSince: 2, pendingSince: 2 } as QuestionSummary))
      .toMatchObject({ blockedReason: 'input', blockedSince: 1, pendingQuestions: 1 })
    expect(computeTerminalAttention('a', { reason: 'permission', since: 1, event: 'permission-request' }, null)).toMatchObject({ blockedReason: 'permission' })
  })
})

describe('C-5: the dispatched codex and its version (electron/codex-osc-version.ts)', () => {
  const files = (list: string[]) => (p: string) => list.includes(p)

  it('resolves `codex` on PATH (Windows: the first directory holding a codex must hold codex.exe)', () => {
    const win = { platform: 'win32' as const }
    expect(resolveDispatchCodexBinary('codex -c features.daemon_auto_start=false', {
      ...win, env: { Path: 'C:\\a;C:\\b' }, isFile: files(['C:\\b\\codex.exe']),
    })).toEqual({ path: 'C:\\b\\codex.exe' })
    expect(resolveDispatchCodexBinary('codex', {
      ...win, env: { PATH: 'C:\\npm;C:\\b' }, isFile: files(['C:\\npm\\codex.cmd', 'C:\\b\\codex.exe']),
    })).toEqual({ reason: 'first codex on PATH is C:\\npm\\codex.cmd (needs a shell)' })
    expect(resolveDispatchCodexBinary('codex', {
      ...win, env: { PATH: '"C:\\x y"' }, isFile: files(['C:\\x y\\codex.exe', 'C:\\x y\\codex.cmd']),
    })).toEqual({ path: 'C:\\x y\\codex.exe' })
    expect(resolveDispatchCodexBinary('codex', { ...win, env: {}, isFile: () => false })).toEqual({ reason: 'codex not on PATH' })
    expect(resolveDispatchCodexBinary('codex', { platform: 'linux', env: { PATH: '/usr/bin:/home/u/.npm/bin' }, isFile: files(['/home/u/.npm/bin/codex']) }))
      .toEqual({ path: '/home/u/.npm/bin/codex' })
  })

  it('a custom CLI: an absolute path is probed as it is; a bare other word is unknown', () => {
    expect(resolveDispatchCodexBinary('/opt/codex/bin/codex --x', { platform: 'linux', env: {}, isFile: files(['/opt/codex/bin/codex']) })).toEqual({ path: '/opt/codex/bin/codex' })
    expect(resolveDispatchCodexBinary('C:\\tools\\codex.cmd', { platform: 'win32', env: {}, isFile: () => true })).toEqual({ reason: 'custom CLI is not an .exe' })
    expect(resolveDispatchCodexBinary('mycodex', { platform: 'linux', env: {}, isFile: () => true })).toEqual({ reason: "launch command 'mycodex' is not codex on PATH" })
  })

  function check(outputs: Array<{ error?: Error; stdout?: string; stderr?: string } | 'throw'>, mtime: { value: number | null } = { value: 1 }) {
    const calls: Array<{ file: string; args: string[]; options: unknown }> = []
    const lines: string[] = []
    const execFile: ExecFileLike = (file, args, options, callback) => {
      calls.push({ file, args, options })
      const next = outputs.shift() ?? { stdout: '' }
      if (next === 'throw') throw new Error('EFTYPE')
      callback(next.error ?? null, next.stdout ?? '', next.stderr ?? '')
      return undefined
    }
    const run = createCodexOscVersionCheck({
      platform: 'linux',
      env: { PATH: '/usr/bin' },
      isFile: p => p === '/usr/bin/codex',
      mtimeMs: () => mtime.value,
      execFile,
      logger: { log: m => lines.push(m) },
    })
    return { run, calls, lines }
  }

  it('codex --version via execFile (array args, timeout 5 s); >= 0.163.0 → true; cached by path + mtime', async () => {
    const mtime = { value: 1 }
    const { run, calls, lines } = check([{ stdout: 'codex-cli 0.163.0\n' }, { stdout: 'codex-cli 0.162.1\n' }], mtime)
    expect(await run('codex')).toBe(true)
    expect(await run('codex -c x=1')).toBe(true)
    expect(calls).toEqual([{ file: '/usr/bin/codex', args: ['--version'], options: { timeout: CODEX_VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' } }])
    mtime.value = 2 // upgraded (here: downgraded) in place → probed again
    expect(await run('codex')).toBe(false)
    expect(calls).toHaveLength(2)
    expect(lines).toEqual([
      '[codex-version] path=/usr/bin/codex version=0.163.0 (probed)',
      '[codex-version] path=/usr/bin/codex version=0.163.0 (cached)',
      '[codex-version] path=/usr/bin/codex version=0.162.1 (probed)',
    ])
    expect(CODEX_VERSION_TIMEOUT_MS).toBe(5_000)
  })

  it('failure, timeout, unparsable, a throwing spawn → false and not cached (probed again)', async () => {
    const { run, calls, lines } = check([
      { error: Object.assign(new Error('timed out'), { killed: true, signal: 'SIGTERM' }) },
      { stdout: 'something else' },
      'throw',
      { stdout: '', stderr: 'codex-cli 0.170.0' },
    ])
    expect(await run('codex')).toBe(false)
    expect(await run('codex')).toBe(false)
    expect(await run('codex')).toBe(false)
    expect(await run('codex')).toBe(true) // stderr counts too
    expect(calls).toHaveLength(4)
    expect(lines.slice(0, 3)).toEqual(Array(3).fill('[codex-version] path=/usr/bin/codex version=unknown (probed)'))
  })

  it('not resolvable → false without running anything', async () => {
    const lines: string[] = []
    const execFile = vi.fn()
    const run = createCodexOscVersionCheck({ platform: 'linux', env: { PATH: '/nowhere' }, isFile: () => false, execFile, logger: { log: m => lines.push(m) } })
    expect(await run('codex')).toBe(false)
    expect(execFile).not.toHaveBeenCalled()
    expect(lines).toEqual(['[codex-version] path=- version=unknown (codex not on PATH)'])
  })

  it('source: execFile only (no shell-spawning API)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'codex-osc-version.ts'), 'utf8')
    expect(src).toMatch(/import \{ execFile \} from 'child_process'/)
    expect(src).not.toMatch(/\bexecSync\b|\bspawnSync\b|shell:\s*true/)
  })
})

describe('C-5 / C-6 in the dispatch builder (T0621)', () => {
  function deps(over: Partial<AgentPromptCommandDeps> = {}, settings: Record<string, unknown> | null = null) {
    const order: string[] = []
    const recorded: Array<[string, string]> = []
    const base: AgentPromptCommandDeps = {
      readSettings: () => settings as never,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: agentId => (agentId === 'codex-cli' ? 'codex' : agentId === 'gemini-cli' ? 'gemini' : null),
      resolveClaudeBaseCommand: async () => 'claude',
      batMcpLaunchArgs: request => {
        order.push(`mcp:${request.terminalId ?? '-'}`)
        if (request.terminalId) recorded.push([request.terminalId, 'none']) // what createBatMcpLaunchArgs records for codex
        return { injected: false, kind: request.agentId === 'codex-cli' ? 'codex' : 'claude', reason: 'turned off in Settings' }
      },
      codexWritesOsc: async (baseCommand) => { order.push(`probe:${baseCommand}`); return true },
      recordBlockedDetection: (id, detection) => { order.push(`record:${detection}`); recorded.push([id, detection]) },
      logger: { warn: () => {} },
      ...over,
    }
    return { deps: base, order, recorded }
  }

  it('a named codex dispatch: probe the base command, record osc after the MCP decision', async () => {
    const d = deps()
    const built = await createAgentPromptCommandBuilder(d.deps)({ skill: 'ct-exec', workorder: 'T0621', agent: 'codex-cli', terminalId: 'w1' })
    expect(built?.command).toBe("codex -c check_for_update_on_startup=false '$ct-exec T0621'")
    expect(d.order).toEqual(['mcp:w1', 'probe:codex', 'record:osc'])
    expect(d.recorded).toEqual([['w1', 'none'], ['w1', 'osc']])
  })

  it('an old / unknown codex → nothing recorded over none; no terminalId → no probe; claude never probes', async () => {
    const old = deps({ codexWritesOsc: async () => false })
    await createAgentPromptCommandBuilder(old.deps)({ prompt: 'p', agent: 'codex-cli', terminalId: 'w2' })
    expect(old.recorded).toEqual([['w2', 'none']])
    const unnamed = deps()
    await createAgentPromptCommandBuilder(unnamed.deps)({ prompt: 'p', agent: 'codex-cli' })
    expect(unnamed.order).toEqual(['mcp:-'])
    const claude = deps()
    const built = await createAgentPromptCommandBuilder(claude.deps)({ prompt: 'p', agent: 'claude-cli', terminalId: 'c1' })
    expect(claude.order).toEqual(['mcp:c1'])
    expect(built?.command).not.toContain('check_for_update_on_startup')
  })

  it('C-6: codex only, before the custom args; not added when the custom args set it', async () => {
    const withArgs = deps({}, { agentCustomArgs: { 'codex-cli': '--yolo resume --last' } })
    expect((await createAgentPromptCommandBuilder(withArgs.deps)({ prompt: 'p', agent: 'codex-cli', shellFamily: 'pwsh' }))?.command)
      .toBe("codex -c check_for_update_on_startup=false --yolo resume --last p")
    const own = deps({}, { agentCustomArgs: { 'codex-cli': '-c check_for_update_on_startup=true' } })
    expect((await createAgentPromptCommandBuilder(own.deps)({ prompt: 'p', agent: 'codex-cli' }))?.command)
      .toBe('codex -c check_for_update_on_startup=true p')
    const gemini = deps()
    expect((await createAgentPromptCommandBuilder(gemini.deps)({ prompt: 'p', agent: 'gemini-cli' }))?.command).toBe('gemini p')
    expect(CODEX_DISPATCH_NO_UPDATE_CHECK).toBe('check_for_update_on_startup=false')
    expect(userArgsSetCodexUpdateCheck('-c check_for_update_on_startup=false')).toBe(true)
    expect(userArgsSetCodexUpdateCheck(undefined)).toBe(false)
  })

  it('a tab the user opens (agent:bat-mcp-launch-args) never gets the override', () => {
    const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0621-shim-'))
    try {
      fs.writeFileSync(path.join(shimDir, 'bat-mcp.mjs'), '')
      const host: BatMcpHost = {
        dataDir: () => shimDir,
        helperDir: () => shimDir,
        nodeCommand: () => 'node',
        endpointReady: () => true,
        readSettings: () => null,
      }
      const r = buildBatMcpLaunchArgs(host, { agentId: 'codex-cli', shellFamily: 'posix', terminalId: 't' })
      expect(r.injected).toBe(true)
      expect(r.injected && r.args).not.toContain('check_for_update_on_startup')
    } finally {
      fs.rmSync(shimDir, { recursive: true, force: true })
    }
  })

  it('a throwing record is logged, the command still built', async () => {
    const warn = vi.fn()
    const d = deps({ recordBlockedDetection: () => { throw new Error('boom') }, logger: { warn } })
    expect((await createAgentPromptCommandBuilder(d.deps)({ prompt: 'p', agent: 'codex-cli', terminalId: 'w' }))?.command).toContain('codex')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('recording blockedDetection osc of w failed: boom'))
  })
})
