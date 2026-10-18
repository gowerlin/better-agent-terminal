// @vitest-environment node
/**
 * PLAN-050 / T0642 (D167): `claudeSessionName` / `claudeSessionId` of `terminal:whoami` / `list` /
 * `get-state`, the `sessionId` of a `session-start` report (T0600's contract, changed by D167) and
 * Electron's `claude-sessions.json` (C-8).
 *
 *   - TerminalBlockedTracker: the first `session-start` sets the session id with `agentStarted`, a
 *     later one (startup / resume / clear / compact) replaces it and keeps `agentStartedAt`; logs
 *     the first 8 characters only; `onSessionChange`; `restoreSessionId`; cleared with `agentStarted`
 *   - PtyManager: running only; exited record keeps it; restart / recovery drop it; restore
 *   - `terminal:report-hook`: a UUID of a `session-start` is recorded; not a UUID / another event →
 *     ignored without an error, `agentStarted` as without it; a BAT before T0642 (field ignored)
 *   - query handlers: injected / not injected / codex / exited; scope unchanged
 *   - ClaudeSessionPersistence: store format, no token, damaged file, invalid entries, two BAT
 *     "processes" around a Terminal Server that kept the PTYs, newer values win, no rewrite when
 *     unchanged
 *   - main.ts / headless wiring (source guards)
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-blocked-state / pty-manager / claude-session-name-record must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import {
  CLAUDE_SESSION_ID_PATTERN,
  registerReportHookHandler,
  sessionIdForLog,
  TerminalBlockedTracker,
} from '../terminal-blocked-state'
import { registerTerminalQueryHandlers, type TerminalQueryHandlers } from '../terminal-query-handlers'
import {
  CLAUDE_SESSION_STORE_FILE,
  CLAUDE_SESSION_STORE_VERSION,
  ClaudeSessionNameRecords,
  ClaudeSessionPersistence,
  readClaudeSessionStore,
  writeClaudeSessionStore,
} from '../claude-session-name-record'

const SID_1 = '0f3c2a9e-6b1d-4c8e-9a7f-1d2e3f4a5b6c'
const SID_2 = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d'
const SID_3 = 'deadbeef-0000-4000-8000-000000000003'
const ROOT = path.resolve(__dirname, '..', '..')

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string }> = []
  send = (msg: { type: string; id?: string }) => { this.sent.push(msg); return true }
  reply(msg: unknown): void { this.emit('message', msg) }
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

let tmpDirs: string[] = []
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0642-'))
  tmpDirs.push(dir)
  return dir
}
const managers: PtyManagerType[] = []
const logs: string[] = []

beforeEach(() => {
  logs.length = 0
  vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function makeManager(extra: { onClaudeSessionChange?: (id: string) => void } = {}) {
  const registry = new HelperCapabilityRegistry()
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir: tmpDir(),
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => { registry.revokeTerminal(id) },
    ...extra,
  })
  managers.push(manager)
  const create = (id: string, opts: { towerId?: string; workspaceId?: string } = {}) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      ...TAB,
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      ...(opts.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: opts.towerId } } : {}),
    })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  const exit = (id: string, exitCode = 0) => {
    const onExit = fakes.get(id)!.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode })
  }
  return { manager, registry, create, exit }
}

describe('session id pattern (T0642)', () => {
  it('accepts a UUID (any case), nothing else', () => {
    for (const ok of [SID_1, SID_2, SID_1.toUpperCase()]) expect(CLAUDE_SESSION_ID_PATTERN.test(ok)).toBe(true)
    for (const bad of ['', 's-start', `${SID_1}x`, ` ${SID_1}`, SID_1.replace(/-/g, ''), 'batcap.abc', `${SID_1}\n`]) {
      expect(CLAUDE_SESSION_ID_PATTERN.test(bad)).toBe(false)
    }
    expect(sessionIdForLog(SID_1)).toBe('0f3c2a9e')
  })
})

describe('TerminalBlockedTracker: session id (T0642)', () => {
  it('first session-start sets it with agentStarted; a later one replaces it and keeps agentStartedAt; logs the first 8 only', () => {
    const lines: string[] = []
    const changes: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t, undefined, id => changes.push(id))
    expect(tracker.getSessionId('a')).toBeNull()
    expect(tracker.report('a', 'session-start', undefined, SID_1)).toEqual({ result: 'started', state: null })
    expect(tracker.getSessionId('a')).toBe(SID_1)
    expect(tracker.getStartedAt('a')).toBe(1000)
    t = 2000
    // the same session again (a resume of itself): nothing changes, nothing logged
    expect(tracker.report('a', 'session-start', undefined, SID_1)).toEqual({ result: 'unchanged', state: null })
    // `/clear`: a new session id; agentStartedAt stays the first
    expect(tracker.report('a', 'session-start', undefined, SID_2)).toEqual({ result: 'unchanged', state: null })
    expect(tracker.getSessionId('a')).toBe(SID_2)
    expect(tracker.getStartedAt('a')).toBe(1000)
    // a report without one (an older hook script) keeps the last
    expect(tracker.report('a', 'session-start')).toEqual({ result: 'unchanged', state: null })
    expect(tracker.getSessionId('a')).toBe(SID_2)
    expect(changes).toEqual(['a', 'a'])
    expect(lines).toEqual([
      '[agent-start] terminal=a → started (hook session-start) session=0f3c2a9e',
      '[agent-start] terminal=a session=a1b2c3d4 (hook session-start)',
    ])
    expect(lines.join('\n')).not.toContain(SID_1)
    expect(lines.join('\n')).not.toContain(SID_2)
  })

  it('blocked events never touch it; cleared with agentStarted (PTY end) and by clearAll (recovery); a throwing listener is ignored', () => {
    const lines: string[] = []
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, undefined, undefined, () => { throw new Error('boom') })
    tracker.report('a', 'session-start', undefined, SID_1)
    tracker.report('a', 'permission-request', 'Bash')
    tracker.report('a', 'stop')
    expect(tracker.getSessionId('a')).toBe(SID_1)
    expect(lines.some(l => l.includes('onSessionChange listener failed terminal=a'))).toBe(true)
    tracker.clearStarted('a')
    expect(tracker.getSessionId('a')).toBeNull()
    tracker.report('b', 'session-start', undefined, SID_2)
    tracker.clearAll('Terminal Server recovery')
    expect(tracker.getSessionId('b')).toBeNull()
  })

  it('restoreSessionId: only a UUID, never over a reported one; logged with the first 8', () => {
    const lines: string[] = []
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) })
    expect(tracker.restoreSessionId('a', 'not-a-uuid')).toBe(false)
    expect(tracker.restoreSessionId('a', SID_1)).toBe(true)
    expect(tracker.getSessionId('a')).toBe(SID_1)
    expect(tracker.getStartedAt('a')).toBeNull() // the start time is not known after a restart
    tracker.report('b', 'session-start', undefined, SID_2)
    expect(tracker.restoreSessionId('b', SID_3)).toBe(false)
    expect(tracker.getSessionId('b')).toBe(SID_2)
    expect(lines).toContain('[agent-start] terminal=a session=0f3c2a9e (restored)')
  })
})

describe('PtyManager: claude session id (T0642)', () => {
  it('needs a running PTY; exited record keeps it; restart drops it; restore only for a running PTY', () => {
    const changes: string[] = []
    const { manager, create, exit } = makeManager({ onClaudeSessionChange: id => changes.push(id) })
    expect(manager.reportHookEvent('a', 'session-start', undefined, SID_1)).toBeNull()
    expect(manager.restoreClaudeSessionId('a', SID_1)).toBe(false)
    create('a')
    expect(manager.getClaudeSessionId('a')).toBeNull()
    manager.reportHookEvent('a', 'session-start', undefined, SID_1)
    expect(manager.getClaudeSessionId('a')).toBe(SID_1)
    expect(changes).toEqual(['a'])
    manager.noteUserInput('a') // user input keeps it
    expect(manager.getClaudeSessionId('a')).toBe(SID_1)
    exit('a', 0)
    expect(manager.getClaudeSessionId('a')).toBeNull()
    expect(manager.getExitedPty('a')).toMatchObject({ claudeSessionId: SID_1 })

    create('b')
    manager.reportHookEvent('b', 'session-start', undefined, SID_2)
    expect(manager.restart('b', CWD, '/bin/sh')).toBe(true)
    expect(manager.getClaudeSessionId('b')).toBeNull() // the new shell runs no claude yet
    expect(manager.restoreClaudeSessionId('b', SID_3)).toBe(true)
    expect(manager.getClaudeSessionId('b')).toBe(SID_3)

    create('c')
    exit('c')
    expect(manager.getExitedPty('c')).not.toHaveProperty('claudeSessionId')
  })

  it('the Terminal Server recovery drops them (source: clearAll) and Electron re-persists on it', () => {
    const tracker = fs.readFileSync(path.join(ROOT, 'electron', 'terminal-blocked-state.ts'), 'utf8')
    expect(tracker).toMatch(/clearAll\(cause: string\): void \{[\s\S]*?this\.sessionIds\.clear\(\) \/\/ T0642/)
    const pty = fs.readFileSync(path.join(ROOT, 'electron', 'pty-manager.ts'), 'utf8')
    expect(pty).toMatch(/id => this\.deps\.onClaudeSessionChange\?\.\(id\),/)
  })
})

// ── terminal:report-hook + query handlers ──

function setupHandlers(names: Record<string, string | null> = {}) {
  const env = makeManager()
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const hookLogs: string[] = []
  const mirrors: Array<[string, Record<string, unknown>]> = []
  const register = (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => { handlers.set(channel, handler) }
  registerReportHookHandler({
    registerHandler: register,
    getPtyManager: () => env.manager,
    logger: { log: (m: unknown) => { hookLogs.push(String(m)) } },
    mirrorToBatScripts: (event, payload) => { mirrors.push([event, payload]) },
  })
  const queries = registerTerminalQueryHandlers({
    registerHandler: register,
    getPtyManager: () => env.manager,
    isWorkerOf: (c, tw) => env.registry.isWorkerOf(c, tw),
    getClaudeSessionName: id => names[id] ?? null,
    logger: { log: () => {} },
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = env.manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Record<string, unknown>
  return { ...env, handlers, hookLogs, mirrors, queries, asHelper, call }
}

describe('terminal:report-hook sessionId (T0642)', () => {
  let h: ReturnType<typeof setupHandlers>
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  function scene() {
    h = setupHandlers()
    queries = h.queries
    h.create('tw', { workspaceId: 'ws' })
    h.create('wk', { workspaceId: 'ws', towerId: 'tw' })
    h.manager.setTerminalRole('tw', 'tower')
  }

  it('a session-start UUID is recorded for the caller; the answer is the T0600 one; the mirror has the first 8 only', () => {
    scene()
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: SID_1 }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'started', state: 'not-blocked' })
    expect(h.manager.getClaudeSessionId('wk')).toBe(SID_1)
    expect(h.manager.getClaudeSessionId('tw')).toBeNull()
    expect(h.mirrors.at(-1)).toEqual(['report-hook', { terminalId: 'wk', hook: 'session-start', result: 'started', session: '0f3c2a9e' }])
    // `/clear`: a second session-start replaces it, agentStartedAt stays
    const at = h.manager.getAgentStartedAt('wk')
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: SID_2 }))
      .toMatchObject({ ok: true, result: 'unchanged' })
    expect(h.manager.getClaudeSessionId('wk')).toBe(SID_2)
    expect(h.manager.getAgentStartedAt('wk')).toBe(at)
    expect(JSON.stringify(h.mirrors)).not.toContain(SID_1)
    expect(JSON.stringify(h.mirrors)).not.toContain(SID_2)
    expect(logs.join('\n')).not.toMatch(new RegExp(`${SID_1}|${SID_2}`))
  })

  it('not a UUID, not a string, or on another event: ignored without an error; agentStarted as without it', () => {
    scene()
    for (const bad of ['s-start', 42, { id: SID_1 }, `${SID_1} `]) {
      expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: bad })).toMatchObject({ ok: true })
    }
    expect(h.manager.getClaudeSessionId('wk')).toBeNull()
    expect(h.manager.getAgentStartedAt('wk')).toEqual(expect.any(Number))
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'stop', sessionId: SID_1 })).toMatchObject({ ok: true, result: 'unchanged' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash', sessionId: SID_1 })).toMatchObject({ ok: true, result: 'blocked' })
    expect(h.manager.getClaudeSessionId('wk')).toBeNull()
    expect(h.mirrors.every(([, p]) => !('session' in p))).toBe(true)
  })

  it('a BAT before T0642 (the field ignored) still answers the T0600 way', () => {
    scene()
    const t0600Handler = (ctx: HandlerContext, raw: Record<string, unknown>) => {
      const { sessionId: _ignored, ...rest } = raw
      return h.call('terminal:report-hook', ctx, rest)
    }
    expect(t0600Handler(h.asHelper('wk'), { event: 'session-start', sessionId: SID_1 }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'started', state: 'not-blocked' })
    expect(h.manager.getClaudeSessionId('wk')).toBeNull()
  })
})

describe('query handlers: claudeSessionName / claudeSessionId (T0642)', () => {
  let h: ReturnType<typeof setupHandlers>
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  const TOWER_NAME = 'BMad · Tower'
  const WORKER_NAME = 'BMad · Worker · T0642'

  function scene() {
    // tw / wk got a name; cx is a codex Worker (record name null, reason not-claude-cli); sh no launch at all
    h = setupHandlers({ tw: TOWER_NAME, wk: WORKER_NAME, cx: null })
    queries = h.queries
    h.create('tw', { workspaceId: 'ws' })
    h.create('wk', { workspaceId: 'ws', towerId: 'tw' })
    h.create('cx', { workspaceId: 'ws', towerId: 'tw' })
    h.create('sh', { workspaceId: 'ws' })
    h.manager.setTerminalRole('tw', 'tower')
    h.manager.setBlockedDetection('tw', 'hook')
    h.manager.setBlockedDetection('wk', 'hook')
    h.manager.setBlockedDetection('cx', 'none')
  }

  it('whoami: the caller\'s own name and session id (null before SessionStart)', () => {
    scene()
    expect(h.call('terminal:whoami', h.asHelper('wk'))).toMatchObject({ terminalId: 'wk', claudeSessionName: WORKER_NAME, claudeSessionId: null })
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: SID_1 })
    expect(h.call('terminal:whoami', h.asHelper('wk'))).toMatchObject({ claudeSessionName: WORKER_NAME, claudeSessionId: SID_1 })
    expect(h.call('terminal:whoami', h.asHelper('sh'))).toMatchObject({ claudeSessionName: null, claudeSessionId: null })
  })

  it('get-state / list: injected / not injected / codex; a tower reads its Workers\' and its own', () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: SID_1 })
    h.call('terminal:report-hook', h.asHelper('tw'), { event: 'session-start', sessionId: SID_2 })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ claudeSessionName: WORKER_NAME, claudeSessionId: SID_1, agentStarted: true })
    expect(h.call('terminal:get-state', h.asHelper('tw'))).toMatchObject({ claudeSessionName: TOWER_NAME, claudeSessionId: SID_2 })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'cx' })).toMatchObject({ claudeSessionName: null, claudeSessionId: null, agentStarted: null })
    const rows = (h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }).terminals
    expect(rows.find(t => t.id === 'wk')).toMatchObject({ claudeSessionName: WORKER_NAME, claudeSessionId: SID_1 })
    expect(rows.find(t => t.id === 'tw')).toMatchObject({ claudeSessionName: TOWER_NAME, claudeSessionId: SID_2 })
    expect(rows.find(t => t.id === 'cx')).toMatchObject({ claudeSessionName: null, claudeSessionId: null })
    // every row carries both keys
    for (const row of rows) {
      expect(row).toHaveProperty('claudeSessionName')
      expect(row).toHaveProperty('claudeSessionId')
    }
    // a worker reads its tower (metadata, scope unchanged); a shell outside the tower's scope stays out
    expect(h.call('terminal:get-state', h.asHelper('wk'), { terminalId: 'tw' })).toMatchObject({ claudeSessionId: SID_2 })
    expect(h.call('terminal:get-state', h.asHelper('wk'), { terminalId: 'sh' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('exited keeps both; wait answers are unchanged (no new fields)', async () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start', sessionId: SID_1 })
    h.manager.kill('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ state: 'exited', claudeSessionName: WORKER_NAME, claudeSessionId: SID_1 })
    const rows = (h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }).terminals
    expect(rows.find(t => t.id === 'wk')).toMatchObject({ alive: false, claudeSessionName: WORKER_NAME, claudeSessionId: SID_1 })
    const waited = await h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'exit' })
    expect(waited).toMatchObject({ ok: true, state: 'exited' })
    expect(waited).not.toHaveProperty('claudeSessionId')
  })

  it('a throwing name lookup answers null', () => {
    const env = makeManager()
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const q = registerTerminalQueryHandlers({
      registerHandler: (c, fn) => { handlers.set(c, fn) },
      getPtyManager: () => env.manager,
      isWorkerOf: () => false,
      getClaudeSessionName: () => { throw new Error('boom') },
      logger: { log: () => {} },
    })
    env.create('x')
    const ctx: HandlerContext = { windowId: null, connectionId: 'c', helper: { terminalId: 'x', role: 'tower' } }
    expect(handlers.get('terminal:get-state')!(ctx)).toMatchObject({ ok: true, claudeSessionName: null })
    q.dispose()
  })
})

// ── C-8: claude-sessions.json ──

const silentLog = () => ({ log: vi.fn<(m: string) => void>(), warn: vi.fn<(m: string) => void>() })

describe('claude session store file (T0642)', () => {
  it('round trip; atomic (no temp left); invalid entries skipped; damaged / other version = corrupt; missing', () => {
    const dir = tmpDir()
    const file = path.join(dir, CLAUDE_SESSION_STORE_FILE)
    expect(readClaudeSessionStore(file)).toEqual({ status: 'missing', sessions: [] })
    const sessions = [
      { terminalId: 'a', name: 'BMad · Tower', sessionId: SID_1 },
      { terminalId: 'b', name: null, sessionId: SID_2 },
      { terminalId: 'c', name: 'BMad · c1234567', sessionId: null },
    ]
    writeClaudeSessionStore(file, sessions)
    expect(fs.readdirSync(dir)).toEqual([CLAUDE_SESSION_STORE_FILE])
    expect(readClaudeSessionStore(file)).toEqual({ status: 'ok', sessions, skipped: 0 })
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ version: CLAUDE_SESSION_STORE_VERSION, sessions })

    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      sessions: [
        sessions[0],
        { terminalId: 'bad id!', name: 'x', sessionId: null },
        { terminalId: 'd', name: null, sessionId: 'not-a-uuid' },
        { terminalId: 'e', name: null, sessionId: null },
        { terminalId: 'f', name: 'x'.repeat(600), sessionId: null },
        'junk',
      ],
    }))
    expect(readClaudeSessionStore(file)).toEqual({ status: 'ok', sessions: [sessions[0]], skipped: 5 })
    fs.writeFileSync(file, '{ not json')
    expect(readClaudeSessionStore(file).status).toBe('corrupt')
    fs.writeFileSync(file, JSON.stringify({ version: 2, sessions: [] }))
    expect(readClaudeSessionStore(file).status).toBe('corrupt')
  })
})

describe('ClaudeSessionPersistence across a BAT restart (T0642, C-8)', () => {
  let dataDir: string
  let storeFile: string

  beforeEach(() => {
    dataDir = tmpDir()
    storeFile = path.join(dataDir, CLAUDE_SESSION_STORE_FILE)
  })

  /** One BAT main process wired like main.ts (load at whenReady, settle on the replay list). */
  function bat() {
    const records = new ClaudeSessionNameRecords()
    let manager: PtyManagerType | null = null
    const log = silentLog()
    const persistence = new ClaudeSessionPersistence({ records, getPtyManager: () => manager, log, now: () => 5 })
    persistence.load(storeFile)
    manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      onSurvivingPtys: ids => {
        const alive = new Set(ids)
        persistence.settle(id => alive.has(id), 'Terminal Server PTY list')
      },
      onPtyExit: () => persistence.persist(),
      onServerRecovery: () => persistence.persist(),
      onClaudeSessionChange: () => persistence.persist(),
    })
    managers.push(manager)
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    const recordName = (id: string, name: string | null) => {
      records.set(id, name ? { name, at: 1 } : { name: null, reason: 'not-claude-cli', at: 1 })
      persistence.persist()
    }
    return { records, manager, server, persistence, log, recordName }
  }

  const stored = () => (readClaudeSessionStore(storeFile) as { sessions: unknown[] }).sessions

  function firstRun() {
    const one = bat()
    one.recordName('tw', 'BMad · Tower')
    one.recordName('wk', 'BMad · Worker · T0642')
    one.recordName('cx', null) // codex: nothing to store
    for (const id of ['tw', 'wk', 'cx', 'sh']) one.manager.create({ id, ...TAB })
    one.manager.reportHookEvent('tw', 'session-start', undefined, SID_1)
    one.manager.reportHookEvent('wk', 'session-start', undefined, SID_2)
    expect(stored()).toEqual([
      { terminalId: 'tw', name: 'BMad · Tower', sessionId: SID_1 },
      { terminalId: 'wk', name: 'BMad · Worker · T0642', sessionId: SID_2 },
    ])
    const text = fs.readFileSync(storeFile, 'utf8')
    expect(text).not.toMatch(/batcap|token/i)
    // BAT quits, the Terminal Server keeps the PTYs: dispose reports no exit, the store stays
    one.manager.dispose()
    expect(stored()).toHaveLength(2)
    return one
  }

  it('the replay list puts both values back for the surviving PTYs; the queries read them', () => {
    firstRun()
    const two = bat()
    // before the list: nothing restored, the pending entries are kept in the file
    expect(two.records.get('tw')).toBeUndefined()
    expect(two.persistence.hasPending()).toBe(true)
    two.persistence.persist()
    expect(stored()).toHaveLength(2)
    two.server.reply({ type: 'pty:list', ptys: [{ id: 'tw', pid: 11, cwd: CWD }, { id: 'wk', pid: 12, cwd: CWD }] })
    expect(two.persistence.hasPending()).toBe(false)
    expect(two.records.get('tw')).toEqual({ name: 'BMad · Tower', at: 5 })
    expect(two.manager.getClaudeSessionId('tw')).toBe(SID_1)
    expect(two.manager.getClaudeSessionId('wk')).toBe(SID_2)
    expect(two.manager.getAgentStartedAt('wk')).toBeNull() // not persisted (T0600 lifetime unchanged)
    expect(stored()).toHaveLength(2)
    const messages = two.log.log.mock.calls.map(c => c[0]).join('\n')
    expect(messages).toContain('[claude-session] kept restored: terminal=wk name session=a1b2c3d4 (Terminal Server PTY list)')
    expect(messages).not.toContain(SID_2)

    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const q = registerTerminalQueryHandlers({
      registerHandler: (c, fn) => { handlers.set(c, fn) },
      getPtyManager: () => two.manager,
      isWorkerOf: () => false,
      getClaudeSessionName: id => two.records.get(id)?.name ?? null,
      logger: { log: () => {} },
    })
    const ctx: HandlerContext = { windowId: null, connectionId: 'c', helper: { terminalId: 'tw', role: 'tower' } }
    expect(handlers.get('terminal:get-state')!(ctx)).toMatchObject({ claudeSessionName: 'BMad · Tower', claudeSessionId: SID_1 })
    q.dispose()
  })

  it('a PTY gone while BAT was closed is dropped; no surviving Terminal Server drops all', () => {
    firstRun()
    const two = bat()
    two.server.reply({ type: 'pty:list', ptys: [{ id: 'tw', pid: 11, cwd: CWD }] })
    expect(two.manager.getClaudeSessionId('tw')).toBe(SID_1)
    expect(two.records.get('wk')).toBeUndefined()
    expect(stored()).toEqual([{ terminalId: 'tw', name: 'BMad · Tower', sessionId: SID_1 }])
    two.manager.dispose()

    const three = bat()
    three.persistence.settle(() => false, 'no surviving Terminal Server')
    expect(stored()).toEqual([])
  })

  it('newer values win: a launch decision before the list is not overwritten; a SessionStart after it replaces the restored id', () => {
    firstRun()
    const two = bat()
    two.recordName('tw', 'BMad · Tower (new)')
    two.server.reply({ type: 'pty:list', ptys: [{ id: 'tw', pid: 11, cwd: CWD }, { id: 'wk', pid: 12, cwd: CWD }] })
    expect(two.records.get('tw')?.name).toBe('BMad · Tower (new)')
    expect(two.manager.getClaudeSessionId('wk')).toBe(SID_2) // restored
    two.manager.reportHookEvent('wk', 'session-start', undefined, SID_3)
    expect(two.manager.getClaudeSessionId('wk')).toBe(SID_3)
    expect(stored()).toContainEqual({ terminalId: 'wk', name: 'BMad · Worker · T0642', sessionId: SID_3 })
  })

  it('an exit after the restart removes the entry; the Terminal Server recovery keeps names only', () => {
    firstRun()
    const two = bat()
    two.server.reply({ type: 'pty:list', ptys: [{ id: 'tw', pid: 11, cwd: CWD }, { id: 'wk', pid: 12, cwd: CWD }] })
    two.server.reply({ type: 'pty:exit', id: 'wk', exitCode: 0 })
    expect(stored()).toEqual([{ terminalId: 'tw', name: 'BMad · Tower', sessionId: SID_1 }])
    expect(two.manager.getExitedPty('wk')).toMatchObject({ claudeSessionId: SID_2 })
  })

  it('a damaged store: warned, rewritten empty, nothing restored; nothing written before load; no rewrite when unchanged', () => {
    fs.writeFileSync(storeFile, '{ broken')
    const two = bat()
    expect(two.log.warn).toHaveBeenCalledWith(expect.stringContaining('[claude-session] claude-sessions.json unreadable'))
    expect(readClaudeSessionStore(storeFile)).toEqual({ status: 'ok', sessions: [], skipped: 0 })

    const records = new ClaudeSessionNameRecords()
    const p = new ClaudeSessionPersistence({ records, getPtyManager: () => null, log: silentLog() })
    const other = path.join(tmpDir(), CLAUDE_SESSION_STORE_FILE)
    p.persist() // not loaded: no file
    expect(fs.existsSync(other)).toBe(false)
    p.load(other)
    p.persist() // a missing file and nothing to store: still no file
    expect(fs.existsSync(other)).toBe(false)

    // unchanged content is not written again (the file removed behind its back stays removed)
    fs.rmSync(storeFile)
    two.persistence.persist()
    expect(fs.existsSync(storeFile)).toBe(false)
  })
})

describe('wiring (T0642 source guards)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

  it('main.ts: loaded with the capabilities (before the PtyManager), settled with them, persisted on every change', () => {
    const main = read('electron/main.ts')
    const load = main.indexOf('  loadClaudeSessions() // T0642')
    expect(load).toBeGreaterThan(main.indexOf('  loadLocalHelperCapabilities()'))
    expect(load).toBeLessThan(main.indexOf('  // Initialize PtyManager before starting Terminal Server'))
    expect(main).toMatch(/function loadClaudeSessions\(\): void \{\n  claudeSessionPersistence\.load\(path\.join\(app\.getPath\('userData'\), CLAUDE_SESSION_STORE_FILE\)\)/)
    expect(main).toContain("claudeSessionPersistence.settle(() => false, 'no surviving Terminal Server') // T0642")
    expect(main).toContain("claudeSessionPersistence.settle(id => alive.has(id), 'Terminal Server PTY list') // T0642")
    const deps = main.match(/function createElectronPtyDeps\(\): PtyManagerDeps \{([\s\S]*?)\n\}/)![1]
    expect(deps).toContain('claudeSessionPersistence.persist() // T0642: its claude session is no longer stored')
    expect(deps).toMatch(/onServerRecovery: \(\) => \{\n      towerQuestionHandlers\?\.serverRecovered\(\)\n      claudeSessionPersistence\.persist\(\)/)
    expect(deps).toContain('onClaudeSessionChange: () => claudeSessionPersistence.persist(),')
    expect(main).toContain('getClaudeSessionName: terminalId => claudeSessionNameRecords.get(terminalId)?.name ?? null, // T0642')
  })

  it('headless: the name lookup, no persistence', () => {
    const headless = read('electron/remote/headless-entry.ts')
    expect(headless).toContain('getClaudeSessionName: terminalId => claudeSessionNameRecords.get(terminalId)?.name ?? null,')
    expect(headless).not.toContain('ClaudeSessionPersistence')
  })
})
