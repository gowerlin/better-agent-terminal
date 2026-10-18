// @vitest-environment node
/**
 * PLAN-047 M1 / T0582: read-only helper query channels (electron/terminal-query-handlers.ts).
 *
 *   - `authorizeHelperQueryTarget` / `helperQueryRole`: every row of the scope table (self, tower →
 *     its Workers, shell = undeclared tower, worker → its tower metadata only, server token)
 *   - `readOutput`: cursor increments, truncated (scrolled out / restarted), a line still being
 *     printed is read again, incomplete escape carried, maxLines, masking
 *   - PtyManager exit records: kill / exit / exit code after kill / restart / cap / TTL
 *   - the five handlers on a real PtyManager (fake node-pty) + a real capability registry:
 *     whoami, list (mine / workspace), get-state, read-output, wait (idle / exit / state-change /
 *     timeout / fromState / TOO_MANY_WAITS / dispose), audit lines without output
 *   - a real RemoteServer with the main.ts wiring: helpers query with their own capability, the
 *     identity is the capability (not a parameter), a wait does not hold up other invokes
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-query-handlers / pty-manager must not import electron')
})
const mirrored: Array<[string, Record<string, unknown>]> = []
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: (event: string, payload: Record<string, unknown>) => { mirrored.push([event, payload]) },
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { invokeHandler, registerHandler, type HandlerContext } from '../remote/handler-registry'
import {
  authorizeHelperInvoke,
  authorizeHelperQueryTarget,
  HELPER_CHANNEL_ROLES,
  HELPER_QUERY_CHANNELS,
  HelperCapabilityRegistry,
  helperQueryRole,
  type HelperCapability,
  type HelperQueryScopeContext,
} from '../remote/helper-capability'
import { RemoteServer } from '../remote/remote-server'
import type { RemoteFrame } from '../remote/protocol'
import {
  READ_OUTPUT_PARTIAL_LINE_MAX_CHARS,
  readOutput,
  registerTerminalQueryHandlers,
  savedTabsFromRegistry,
  screenLines,
  TERMINAL_QUERY_IDLE_MS,
  TERMINAL_WAIT_MAX_MS,
  TERMINAL_WAIT_MAX_PER_CALLER,
  type TerminalQueryHandlers,
} from '../terminal-query-handlers'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
const CWD = os.tmpdir()
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType
// from the dynamic import (a static one would load the real node-pty before the fake is in place)
let EXITED_PTY_RECORD_MAX = 0
let EXITED_PTY_RECORD_TTL_MS = 0

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager, EXITED_PTY_RECORD_MAX, EXITED_PTY_RECORD_TTL_MS } = await import('../pty-manager'))
})

let dataDir: string
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  mirrored.length = 0
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0582-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** A PtyManager against the fake node-pty; capabilities issued / revoked like main.ts. */
function makeManager(registry = new HelperCapabilityRegistry()) {
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => { registry.revokeTerminal(id) },
  })
  managers.push(manager)
  const create = (id: string, opts: { workspaceId?: string; towerId?: string; workorder?: string; agentPreset?: string } = {}) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      ...TAB,
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      ...(opts.agentPreset ? { agentPreset: opts.agentPreset } : {}),
      ...(opts.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: opts.towerId, CT_MODE: 'yolo' } } : {}),
      ...(opts.workorder ? { workorder: opts.workorder } : {}),
    })).toBe(true)
    const fake = ptySpawn.mock.results[before].value as FakePty
    fakes.set(id, fake)
    return fake
  }
  /** Output from PTY `id`, flushed into the replay buffer (16 ms batch). */
  const output = (id: string, data: string) => {
    const onData = fakes.get(id)!.onData.mock.calls[0][0] as (d: string) => void
    onData(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }
  const exit = (id: string, code: number) => {
    const onExit = fakes.get(id)!.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode: code })
  }
  return { manager, registry, create, output, exit }
}

// ── scope ──

describe('authorizeHelperQueryTarget / helperQueryRole (T0582 scope table)', () => {
  const ctx = (opts: { workers?: Array<[string, string]>; towers?: string[] } = {}): HelperQueryScopeContext => ({
    isWorkerOf: (child, tower) => (opts.workers ?? []).some(([c, t]) => c === child && t === tower),
    getTerminalRole: id => (opts.towers ?? []).includes(id) ? 'tower' : undefined,
  })
  const tower: HelperCapability = { terminalId: 'tw', role: 'tower' }
  const worker: HelperCapability = { terminalId: 'wk', role: 'worker', towerId: 'tw' }
  const sc = ctx({ workers: [['wk', 'tw'], ['other-wk', 'other-tw']], towers: ['tw'] })

  it('any capability: itself (metadata and output)', () => {
    for (const caller of [tower, worker, { terminalId: 'sh', role: 'tower' } as HelperCapability]) {
      expect(authorizeHelperQueryTarget(caller, caller.terminalId, 'metadata', sc)).toEqual({ ok: true })
      expect(authorizeHelperQueryTarget(caller, caller.terminalId, 'output', sc)).toEqual({ ok: true })
    }
  })

  it('tower capability: + its own Workers; another tower’s Worker / another tab → NOT_OWNER', () => {
    expect(authorizeHelperQueryTarget(tower, 'wk', 'output', sc)).toEqual({ ok: true })
    expect(authorizeHelperQueryTarget(tower, 'other-wk', 'metadata', sc)).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(authorizeHelperQueryTarget(tower, 'plain', 'metadata', sc)).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('shell (tower capability, not declared): its own Workers too, nothing else', () => {
    const shell: HelperCapability = { terminalId: 'other-tw', role: 'tower' }
    expect(helperQueryRole(shell, sc)).toBe('shell')
    expect(authorizeHelperQueryTarget(shell, 'other-wk', 'output', sc)).toEqual({ ok: true })
    expect(authorizeHelperQueryTarget(shell, 'tw', 'metadata', sc)).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('worker: its tower for metadata only; the tower’s output / another tab → NOT_OWNER', () => {
    expect(authorizeHelperQueryTarget(worker, 'tw', 'metadata', sc)).toEqual({ ok: true })
    expect(authorizeHelperQueryTarget(worker, 'tw', 'output', sc)).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(authorizeHelperQueryTarget(worker, 'other-wk', 'metadata', sc)).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('a server-token client (no capability): any target', () => {
    expect(authorizeHelperQueryTarget(null, 'anything', 'output', sc)).toEqual({ ok: true })
  })

  it('helperQueryRole: worker / declared tower / shell', () => {
    expect(helperQueryRole(worker, sc)).toBe('worker')
    expect(helperQueryRole(tower, sc)).toBe('tower')
    expect(helperQueryRole({ terminalId: 'x', role: 'tower' }, sc)).toBe('shell')
  })

  it('role table: the five channels for tower and worker; authorizeHelperInvoke lets them through', () => {
    expect(HELPER_QUERY_CHANNELS).toEqual(['terminal:whoami', 'terminal:list', 'terminal:get-state', 'terminal:read-output', 'terminal:wait'])
    for (const channel of HELPER_QUERY_CHANNELS) {
      expect(HELPER_CHANNEL_ROLES[channel]).toEqual(['tower', 'worker'])
      expect(authorizeHelperInvoke(tower, channel, [{ terminalId: 'anything' }])).toEqual({ ok: true })
      expect(authorizeHelperInvoke(worker, channel, [])).toEqual({ ok: true })
    }
  })
})

// ── readOutput / screenLines ──

describe('readOutput (T0582)', () => {
  it('screenLines: trailing blanks trimmed, blank runs collapsed, none at the ends', () => {
    expect(screenLines('\n\na  \n\n\n\nb\n\n')).toEqual(['a', '', 'b'])
  })

  it('no cursor: the whole buffer; a cursor: only what came after it', () => {
    const first = readOutput({ data: 'one\r\ntwo\r\n', total: 10 }, { maxLines: 200 })
    expect(first).toEqual({ lines: ['one', 'two'], nextCursor: '10', truncated: false, skippedLines: 0, partialLine: false, masked: 0 })
    const second = readOutput({ data: 'one\r\ntwo\r\nthree\r\n', total: 17 }, { cursor: Number(first.nextCursor), maxLines: 200 })
    expect(second.lines).toEqual(['three'])
    expect(second.nextCursor).toBe('17')
    expect(readOutput({ data: 'one\r\n', total: 5 }, { cursor: 5, maxLines: 200 }).lines).toEqual([])
  })

  it('a cursor scrolled out of the buffer, or past its end (PTY restarted) → from the start, truncated', () => {
    // the buffer holds the last 6 chars of 106
    const scrolled = readOutput({ data: 'tail\r\n', total: 106 }, { cursor: 50, maxLines: 200 })
    expect(scrolled).toMatchObject({ lines: ['tail'], truncated: true, nextCursor: '106' })
    const restarted = readOutput({ data: 'new\r\n', total: 5 }, { cursor: 900, maxLines: 200 })
    expect(restarted).toMatchObject({ lines: ['new'], truncated: true })
  })

  it('a line still being printed comes back whole on the next read', () => {
    const r1 = readOutput({ data: 'done\r\nPS C:\\> ', total: 14 }, { maxLines: 200 })
    expect(r1).toMatchObject({ lines: ['done', 'PS C:\\>'], partialLine: true, nextCursor: '6' })
    const r2 = readOutput({ data: 'done\r\nPS C:\\> dir\r\n', total: 19 }, { cursor: 6, maxLines: 200 })
    expect(r2).toMatchObject({ lines: ['PS C:\\> dir'], partialLine: false, nextCursor: '19' })
    // only escapes / blanks after the last newline: nothing held back
    expect(readOutput({ data: 'x\r\n\x1b[0m  ', total: 9 }, { maxLines: 200 })).toMatchObject({ partialLine: false, nextCursor: '9' })
    // a partial line longer than the limit is consumed as it is
    const long = 'y'.repeat(READ_OUTPUT_PARTIAL_LINE_MAX_CHARS + 1)
    expect(readOutput({ data: `a\n${long}`, total: long.length + 2 }, { maxLines: 200 })).toMatchObject({ partialLine: false, nextCursor: String(long.length + 2) })
  })

  it('a token split by a read is masked on both reads', () => {
    const token = 'batcap.' + 'Q'.repeat(43)
    const full = `BAT_REMOTE_TOKEN=${token}\r\n`
    const cut = full.slice(0, 26)
    const r1 = readOutput({ data: cut, total: cut.length }, { maxLines: 200 })
    expect(r1.lines).toEqual(['BAT_REMOTE_TOKEN=[REDACTED:batcap]'])
    expect(r1.masked).toBe(1)
    const r2 = readOutput({ data: full, total: full.length }, { cursor: Number(r1.nextCursor), maxLines: 200 })
    expect(r2.lines).toEqual(['BAT_REMOTE_TOKEN=[REDACTED:batcap]'])
    expect(JSON.stringify([r1, r2])).not.toContain('QQQQ')
  })

  it('an incomplete escape at the end is not consumed', () => {
    const r = readOutput({ data: 'ok\r\n\x1b[3', total: 7 }, { maxLines: 200 })
    expect(r.lines).toEqual(['ok'])
    expect(r.nextCursor).toBe('4')
  })

  it('maxLines keeps the last lines and reports the skipped ones', () => {
    const data = Array.from({ length: 10 }, (_, i) => `l${i}`).join('\n') + '\n'
    expect(readOutput({ data, total: data.length }, { maxLines: 3 })).toMatchObject({ lines: ['l7', 'l8', 'l9'], skippedLines: 7 })
  })

  it('masks known secrets and counts', () => {
    const secret = 'S'.repeat(20) + '1a'
    const r = readOutput({ data: `x ${secret}\n`, total: 25 }, { maxLines: 200, knownSecrets: [secret] })
    expect(r).toMatchObject({ lines: ['x [REDACTED:server-token]'], masked: 1 })
  })
})

// ── PtyManager exit records ──

describe('PtyManager exit records (T0582)', () => {
  it('kill: record with the instance metadata and the last output; exit code from a later exit', () => {
    const { manager, create, output, exit } = makeManager()
    create('w1', { workspaceId: 'ws', towerId: 'tw', workorder: 'T0582', agentPreset: 'claude-cli' })
    output('w1', 'bye\r\n')
    expect(manager.getExitedPty('w1')).toBeNull()
    expect(manager.kill('w1')).toBe(true)
    const record = manager.getExitedPty('w1')!
    expect(record).toMatchObject({ id: 'w1', workspaceId: 'ws', towerTerminalId: 'tw', workorder: 'T0582', agentPreset: 'claude-cli', tail: { data: 'bye\r\n', total: 5 } })
    expect(record.exitCode).toBeUndefined()
    expect(record.lastOutputAt).not.toBeNull()
    exit('w1', 3)
    expect(manager.getExitedPty('w1')?.exitCode).toBe(3)
    expect(manager.listExitedPtyIds()).toEqual(['w1'])
  })

  it('exit on its own: exit code; running again (restart / re-create) hides the record', () => {
    const { manager, create, exit } = makeManager()
    create('a')
    exit('a', 0)
    expect(manager.getExitedPty('a')).toMatchObject({ exitCode: 0 })
    create('a')
    expect(manager.getExitedPty('a')).toBeNull()
    expect(manager.listExitedPtyIds()).toEqual([])
    expect(manager.restart('a', CWD, '/bin/sh')).toBe(true)
    expect(manager.getExitedPty('a')).toBeNull()
  })

  it('at most EXITED_PTY_RECORD_MAX, oldest dropped; gone after the TTL', () => {
    expect(EXITED_PTY_RECORD_MAX).toBe(32)
    const { manager, create } = makeManager()
    for (let i = 0; i <= EXITED_PTY_RECORD_MAX; i++) {
      create(`p${i}`)
      manager.kill(`p${i}`)
    }
    expect(manager.getExitedPty('p0')).toBeNull()
    expect(manager.getExitedPty('p1')).not.toBeNull()
    expect(manager.listExitedPtyIds()).toHaveLength(EXITED_PTY_RECORD_MAX)
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + EXITED_PTY_RECORD_TTL_MS + 1)
    expect(manager.getExitedPty('p1')).toBeNull()
    expect(manager.listExitedPtyIds()).toEqual([])
  })

  it('getTerminalInfo: a copy of the metadata, yolo, declared role', () => {
    const { manager, create } = makeManager()
    create('tw', { workspaceId: 'ws' })
    create('wk', { towerId: 'tw', workorder: 'T0001' })
    manager.setTerminalRole('tw', 'tower', 'ask')
    expect(manager.getTerminalInfo('tw')).toEqual({ id: 'tw', cwd: CWD, workspaceId: 'ws', role: 'tower', towerMode: 'ask', yolo: false })
    expect(manager.getTerminalInfo('wk')).toEqual({ id: 'wk', cwd: CWD, towerTerminalId: 'tw', workorder: 'T0001', yolo: true })
    expect(manager.getTerminalInfo('none')).toBeNull()
    expect(manager.listTerminalIds().sort()).toEqual(['tw', 'wk'])
  })
})

// ── handlers ──

function setupHandlers(opts: { savedTabs?: Map<string, { title?: string; workspaceId?: string }> } = {}) {
  const env = makeManager()
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const logs: string[] = []
  const queries = registerTerminalQueryHandlers({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getPtyManager: () => env.manager,
    isWorkerOf: (c, t) => env.registry.isWorkerOf(c, t),
    ...(opts.savedTabs ? { savedTabs: () => opts.savedTabs! } : {}),
    knownSecrets: () => ['SERVERTOKENSERVERTOKEN'],
    logger: { log: (message: string) => { logs.push(message) } },
    mirrorToBatScripts: (event, payload) => { mirrored.push([event, payload]) },
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const role = env.manager.getTerminalInfo(terminalId)?.towerTerminalId ? 'worker' : 'tower'
    const towerId = env.manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role, towerId } : { terminalId, role } }
  }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Promise<Record<string, unknown>> | Record<string, unknown>
  return { ...env, handlers, logs, queries, asHelper, call }
}

describe('query handlers (T0582)', () => {
  let h: ReturnType<typeof setupHandlers>
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  /** Tower `tw` (declared), its Worker `wk`, a plain shell `sh` (same workspace), another tower's Worker. */
  function scene(savedTabs?: Map<string, { title?: string; workspaceId?: string }>) {
    h = setupHandlers(savedTabs ? { savedTabs } : {})
    queries = h.queries
    h.create('tw', { workspaceId: 'ws', agentPreset: 'claude-cli' })
    h.create('wk', { workspaceId: 'ws', towerId: 'tw', workorder: 'T0582' })
    h.create('sh', { workspaceId: 'ws' })
    h.create('other-tw', { workspaceId: 'ws2' })
    h.create('other-wk', { workspaceId: 'ws2', towerId: 'other-tw', workorder: 'T0001' })
    h.create('far', { workspaceId: 'ws2' })
    h.manager.setTerminalRole('tw', 'tower', 'yolo')
  }

  it('registers the five channels', () => {
    scene()
    expect([...h.handlers.keys()]).toEqual(HELPER_QUERY_CHANNELS)
  })

  it('whoami: tower / worker / shell; identity from the capability, not a parameter', () => {
    scene()
    expect(h.call('terminal:whoami', h.asHelper('tw'))).toEqual({
      ok: true, terminalId: 'tw', workspaceId: 'ws', role: 'tower', yolo: true, towerMode: 'yolo', agent: 'claude-cli', cwd: CWD,
      claudeSessionName: null, claudeSessionId: null, // T0642
    })
    expect(h.call('terminal:whoami', h.asHelper('wk'))).toEqual({
      ok: true, terminalId: 'wk', workspaceId: 'ws', role: 'worker', towerTerminalId: 'tw', workorder: 'T0582', yolo: true, cwd: CWD,
      claudeSessionName: null, claudeSessionId: null, // T0642
    })
    expect(h.call('terminal:whoami', h.asHelper('sh'))).toMatchObject({ ok: true, terminalId: 'sh', role: 'shell', yolo: false })
    // a parameter does not change who a helper is
    expect(h.call('terminal:whoami', h.asHelper('sh'), { terminalId: 'tw' })).toMatchObject({ terminalId: 'sh', role: 'shell' })
  })

  it('whoami without a capability (server token): terminalId required', () => {
    scene()
    const client: HandlerContext = { windowId: null, connectionId: 'client-1' }
    expect(h.call('terminal:whoami', client)).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:whoami', client, { terminalId: 'wk' })).toMatchObject({ ok: true, terminalId: 'wk', role: 'worker' })
  })

  it('list mine: a tower sees itself and its Workers; a worker itself and its tower; a shell itself', () => {
    scene()
    const ids = (r: Record<string, unknown>) => (r.terminals as Array<{ id: string }>).map(t => t.id).sort()
    expect(ids(h.call('terminal:list', h.asHelper('tw')) as Record<string, unknown>)).toEqual(['tw', 'wk'])
    expect(ids(h.call('terminal:list', h.asHelper('wk'), { scope: 'mine' }) as Record<string, unknown>)).toEqual(['tw', 'wk'])
    expect(ids(h.call('terminal:list', h.asHelper('sh')) as Record<string, unknown>)).toEqual(['sh'])
    expect(ids(h.call('terminal:list', h.asHelper('other-tw')) as Record<string, unknown>)).toEqual(['other-tw', 'other-wk'])
    const wk = (h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }).terminals.find(t => t.id === 'wk')
    expect(wk).toEqual({ id: 'wk', role: 'worker', workorder: 'T0582', towerTerminalId: 'tw', state: 'idle', blockedDetection: 'none', agentStarted: null, pendingQuestions: 0, claudeSessionName: null, claudeSessionId: null, alive: true })
  })

  it('list workspace: a declared tower lists its workspace (metadata + saved titles); a shell / worker → NOT_OWNER', () => {
    scene(new Map([['sh', { title: 'My shell' }]]))
    const r = h.call('terminal:list', h.asHelper('tw'), { scope: 'workspace' }) as { terminals: Array<Record<string, unknown>> }
    expect(r.terminals.map(t => t.id).sort()).toEqual(['sh', 'tw', 'wk'])
    expect(r.terminals.find(t => t.id === 'sh')).toEqual({ id: 'sh', role: 'shell', title: 'My shell', state: 'idle', blockedDetection: 'none', agentStarted: null, pendingQuestions: 0, claudeSessionName: null, claudeSessionId: null, alive: true })
    expect(h.call('terminal:list', h.asHelper('sh'), { scope: 'workspace' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:list', h.asHelper('wk'), { scope: 'workspace' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:list', h.asHelper('tw'), { scope: 'all' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    // still no output for a workspace peer
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'sh' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('get-state: working / idle / exited; NOT_FOUND; another tower’s Worker → NOT_OWNER; worker → its tower ok', () => {
    scene()
    h.output('wk', 'busy\r\n')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, terminalId: 'wk', state: 'working', source: 'output' })
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + TERMINAL_QUERY_IDLE_MS + 10)
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, state: 'idle' })
    expect((h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' }) as { idleMs: number }).idleMs).toBeGreaterThanOrEqual(TERMINAL_QUERY_IDLE_MS)
    vi.restoreAllMocks()
    expect(h.call('terminal:get-state', h.asHelper('tw'))).toMatchObject({ ok: true, terminalId: 'tw', state: 'idle', lastOutputAt: null, idleMs: null })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'nope' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'other-wk' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:get-state', h.asHelper('sh'), { terminalId: 'wk' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:get-state', h.asHelper('wk'), { terminalId: 'tw' })).toMatchObject({ ok: true, terminalId: 'tw' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'bad id!' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), 'wk')).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    h.exit('wk', 7)
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, state: 'exited', exitCode: 7 })
  })

  it('read-output: the tower reads its Worker (masked, incremental); a worker reading its tower → NOT_OWNER', () => {
    scene()
    h.output('wk', 'step 1\r\ntoken batcap.' + 'z'.repeat(43) + '\r\nkey SERVERTOKENSERVERTOKEN\r\n')
    const r1 = h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk' }) as Record<string, unknown>
    expect(r1).toMatchObject({ ok: true, terminalId: 'wk', lines: ['step 1', 'token [REDACTED:batcap]', 'key [REDACTED:server-token]'], masked: 2, truncated: false, state: 'working' })
    h.output('wk', 'step 2\r\n')
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk', cursor: r1.nextCursor })).toMatchObject({ ok: true, lines: ['step 2'] })
    expect(h.call('terminal:read-output', h.asHelper('wk'), { terminalId: 'tw' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:read-output', h.asHelper('wk'))).toMatchObject({ ok: true, terminalId: 'wk' })
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk', cursor: 12 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk', cursor: '-1' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk', maxLines: 0 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk', maxLines: 1 })).toMatchObject({ ok: true, lines: ['step 2'], skippedLines: 3 })
    // audit: no output in the log lines or the bat-scripts events
    expect(h.logs.some(l => l.startsWith('[helper-query] channel=terminal:read-output caller=tw target=wk → ok lines=3 masked=2'))).toBe(true)
    expect(h.logs.some(l => l.includes('[helper-query] channel=terminal:read-output caller=wk target=tw → NOT_OWNER'))).toBe(true)
    expect(JSON.stringify([h.logs, mirrored])).not.toMatch(/step 1|zzzz|SERVERTOKEN/)
    expect(mirrored.some(([event, p]) => event === 'helper-query' && p.channel === 'terminal:read-output' && p.caller === 'tw' && p.target === 'wk')).toBe(true)
  })

  it('read-output of an exited Worker: its last output', () => {
    scene()
    h.output('wk', 'final words\r\n')
    h.exit('wk', 0)
    expect(h.call('terminal:read-output', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, lines: ['final words'], state: 'exited' })
    // the capability is gone with the PTY; the exit record still says whose Worker it was
    expect(h.registry.isWorkerOf('wk', 'tw')).toBe(false)
    expect(h.call('terminal:get-state', h.asHelper('other-tw'), { terminalId: 'wk' })).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('wait until=idle / exit / state-change; timeout → changed:false; fromState', async () => {
    vi.useFakeTimers()
    scene()
    h.output('wk', 'x\r\n')
    const idle = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'idle' }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(TERMINAL_QUERY_IDLE_MS + 500)
    expect(await idle).toMatchObject({ ok: true, terminalId: 'wk', changed: true, state: 'idle' })

    const exit = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'exit', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(1_000)
    h.exit('wk', 2)
    await vi.advanceTimersByTimeAsync(500)
    expect(await exit).toMatchObject({ ok: true, changed: true, state: 'exited', exitCode: 2 })

    const change = h.call('terminal:wait', h.asHelper('tw'), { until: 'state-change', timeoutMs: 5_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(1_000)
    h.output('tw', 'printing\r\n')
    await vi.advanceTimersByTimeAsync(300)
    expect(await change).toMatchObject({ ok: true, terminalId: 'tw', changed: true, state: 'working' })

    // already in another state than fromState → answers at once
    expect(await h.call('terminal:wait', h.asHelper('tw'), { until: 'state-change', fromState: 'idle' })).toMatchObject({ changed: true, state: 'working' })
    // already exited → until=exit answers at once
    expect(await h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'exit' })).toMatchObject({ changed: true, state: 'exited' })

    const timeout = h.call('terminal:wait', h.asHelper('sh'), { until: 'exit', timeoutMs: 2_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(2_100)
    expect(await timeout).toMatchObject({ ok: true, changed: false, state: 'idle' })
    expect(h.logs.some(l => l === '[helper-query] channel=terminal:wait caller=sh target=sh → ok until=exit changed=false state=idle')).toBe(true)
  })

  it('wait: argument checks, scope, the 45 s ceiling, TOO_MANY_WAITS, dispose ends open waits', async () => {
    vi.useFakeTimers()
    scene()
    expect(h.call('terminal:wait', h.asHelper('tw'), {})).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:wait', h.asHelper('tw'), { until: 'blocked' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    // T0590: `blocked` is a state now (terminal-blocked-state.test.ts); an unknown one is not
    expect(h.call('terminal:wait', h.asHelper('tw'), { until: 'exit', fromState: 'waiting' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:wait', h.asHelper('tw'), { until: 'exit', timeoutMs: -1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:wait', h.asHelper('wk'), { terminalId: 'tw', until: 'exit' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'other-wk', until: 'exit' })).toEqual({ ok: false, code: 'NOT_OWNER' })

    const long = h.call('terminal:wait', h.asHelper('tw'), { until: 'exit', timeoutMs: 600_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(TERMINAL_WAIT_MAX_MS + 300)
    const answered = await long
    expect(answered).toMatchObject({ ok: true, changed: false })
    expect(answered.waitedMs).toBeGreaterThanOrEqual(TERMINAL_WAIT_MAX_MS)
    expect(answered.waitedMs).toBeLessThan(TERMINAL_WAIT_MAX_MS + 300)

    const open = Array.from({ length: TERMINAL_WAIT_MAX_PER_CALLER }, () =>
      h.call('terminal:wait', h.asHelper('tw'), { until: 'exit' }) as Promise<Record<string, unknown>>)
    expect(h.call('terminal:wait', h.asHelper('tw'), { until: 'exit' })).toMatchObject({ ok: false, code: 'TOO_MANY_WAITS' })
    // another caller is not affected
    const other = h.call('terminal:wait', h.asHelper('sh'), { until: 'exit' }) as Promise<Record<string, unknown>>
    h.queries.dispose()
    for (const result of await Promise.all([...open, other])) expect(result).toMatchObject({ ok: true, changed: false })
    // the slots are free again
    const again = h.call('terminal:wait', h.asHelper('tw'), { until: 'exit', timeoutMs: 0 })
    expect(await again).toMatchObject({ ok: true, changed: false })
  })

  it('savedTabsFromRegistry: id → title / workspace / tower, first wins', () => {
    expect(savedTabsFromRegistry([
      { terminals: [{ id: 'a', title: 'A', workspaceId: 'ws', towerTerminalId: ' tw ' }, { id: 'a', title: 'dup' }, null, { title: 'no id' }] },
      { terminals: 'bad' },
      { terminals: [{ id: 'b' }] },
    ])).toEqual(new Map([['a', { title: 'A', workspaceId: 'ws', towerTerminalId: 'tw' }], ['b', {}]]))
  })
})

// ── a real RemoteServer with the main.ts wiring ──

interface Conn { ws: WebSocket; frames: RemoteFrame[] }

describe('RemoteServer + capabilities: helpers query with their own capability (T0582)', () => {
  const SERVER_TOKEN = 'q'.repeat(32)
  let env: ReturnType<typeof makeManager>
  let server: RemoteServer
  let port: number
  let dir: string
  let queries: TerminalQueryHandlers
  const sockets: WebSocket[] = []

  beforeAll(async () => {
    // own data dir / manager: the per-test hooks above must not dispose it
    const ownDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0582-rs-pty-'))
    const registry = new HelperCapabilityRegistry()
    const fakes = new Map<string, FakePty>()
    const manager = new PtyManager({
      emit: () => {},
      dataDir: ownDir,
      helperEnv: (id, customEnv) => { registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined }); return {} },
      onPtyExit: id => { registry.revokeTerminal(id) },
    })
    const create = (id: string, towerId?: string) => {
      const before = ptySpawn.mock.results.length
      manager.create({ id, ...TAB, workspaceId: 'ws', ...(towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: towerId } } : {}) })
      fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
    }
    env = {
      manager, registry, create: create as never,
      output: (id: string, data: string) => {
        ;(fakes.get(id)!.onData.mock.calls[0][0] as (d: string) => void)(data)
        ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
      },
      exit: () => {},
    }
    dir = ownDir
    create('rs-tower')
    create('rs-worker', 'rs-tower')
    create('rs-shell')
    manager.setTerminalRole('rs-tower', 'tower')
    queries = registerTerminalQueryHandlers({
      registerHandler,
      getPtyManager: () => manager,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      knownSecrets: () => [SERVER_TOKEN],
      logger: { log: () => {} },
    })
    const silent = () => {}
    server = new RemoteServer({
      logger: { log: silent, warn: silent, error: silent },
      helperCapabilities: registry,
      isTerminalAlive: id => manager.isAlive(id),
      getPtyCapacity: () => manager.getCapacity(),
    })
    server.configDir = dir
    port = (await server.start(0, SERVER_TOKEN, 'localhost')).port
  })

  afterAll(() => {
    queries?.dispose()
    for (const ws of sockets) ws.terminate()
    server?.stop()
    env?.manager.dispose()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  async function connect(token: string): Promise<Conn> {
    const ws = new WebSocket(`wss://127.0.0.1:${port}`, { rejectUnauthorized: false })
    sockets.push(ws)
    const conn: Conn = { ws, frames: [] }
    ws.on('error', () => {})
    ws.on('message', data => { try { conn.frames.push(JSON.parse(data.toString())) } catch { /* ignore */ } })
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject) })
    ws.send(JSON.stringify({ type: 'auth', id: 'auth', token, args: ['t0582'] }))
    const frame = await frameOf(conn, 'auth')
    expect(frame.error).toBeUndefined()
    return conn
  }

  function frameOf(conn: Conn, id: string, timeoutMs = 5_000): Promise<RemoteFrame> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${id}`)), timeoutMs)
      const check = () => {
        const frame = conn.frames.find(f => f.id === id)
        if (!frame) return
        clearTimeout(timer)
        conn.ws.off('message', check)
        resolve(frame)
      }
      conn.ws.on('message', check)
      check()
    })
  }

  let seq = 0
  function send(conn: Conn, channel: string, ...args: unknown[]): string {
    const id = `q-${seq++}`
    conn.ws.send(JSON.stringify({ type: 'invoke', id, channel, args }))
    return id
  }
  const invoke = async (conn: Conn, channel: string, ...args: unknown[]) => (await frameOf(conn, send(conn, channel, ...args))).result as Record<string, unknown>

  it('tower: whoami is its capability; reads its Worker masked; a parameter cannot change who it is', async () => {
    const conn = await connect(env.registry.issue('rs-tower'))
    expect(await invoke(conn, 'terminal:whoami', { terminalId: 'rs-shell' })).toMatchObject({ ok: true, terminalId: 'rs-tower', role: 'tower' })
    env.output('rs-worker', `hello\r\nBAT_REMOTE_TOKEN=${SERVER_TOKEN}\r\n`)
    expect(await invoke(conn, 'terminal:read-output', { terminalId: 'rs-worker' })).toMatchObject({
      ok: true, lines: ['hello', 'BAT_REMOTE_TOKEN=[REDACTED:server-token]'], masked: 1,
    })
    expect(await invoke(conn, 'terminal:list', { scope: 'workspace' })).toMatchObject({ ok: true, scope: 'workspace' })
  })

  it('worker: its tower’s output → NOT_OWNER; its own → ok', async () => {
    // a worker capability for the running Worker PTY (its env would carry the one issued at spawn)
    const conn = await connect(env.registry.issue('rs-worker', { towerId: 'rs-tower' }))
    expect(await invoke(conn, 'terminal:whoami')).toMatchObject({ ok: true, terminalId: 'rs-worker', role: 'worker', towerTerminalId: 'rs-tower' })
    expect(await invoke(conn, 'terminal:read-output', { terminalId: 'rs-tower' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await invoke(conn, 'terminal:get-state', { terminalId: 'rs-tower' })).toMatchObject({ ok: true, terminalId: 'rs-tower' })
  })

  it('shell (undeclared tower): list scope=workspace → NOT_OWNER', async () => {
    const conn = await connect(env.registry.issue('rs-shell'))
    expect(await invoke(conn, 'terminal:whoami')).toMatchObject({ ok: true, role: 'shell' })
    expect(await invoke(conn, 'terminal:list', { scope: 'workspace' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('a pending wait does not hold up other invokes on the same connection', async () => {
    const conn = await connect(env.registry.issue('rs-shell'))
    const waitId = send(conn, 'terminal:wait', { until: 'exit', timeoutMs: 1_500 })
    const started = Date.now()
    expect(await invoke(conn, 'terminal:whoami')).toMatchObject({ ok: true, terminalId: 'rs-shell' })
    expect(Date.now() - started).toBeLessThan(1_000)
    const waited = await frameOf(conn, waitId, 5_000)
    expect(waited.result).toMatchObject({ ok: true, changed: false })
  })

  it('a server-token client is not scoped (names the terminal)', async () => {
    const conn = await connect(SERVER_TOKEN)
    expect(await invoke(conn, 'terminal:read-output', { terminalId: 'rs-worker' })).toMatchObject({ ok: true, terminalId: 'rs-worker' })
    expect(await invoke(conn, 'terminal:get-state')).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
  })

  it('invokeHandler hands the capability to the handler as ctx.helper (a copy)', async () => {
    let seen: HandlerContext | null = null
    registerHandler('t0582:probe', ctx => { seen = ctx; return true })
    const identity = { terminalId: 'x', role: 'tower' as const }
    await invokeHandler('t0582:probe', [], null, 'c1', identity)
    expect(seen).toMatchObject({ connectionId: 'c1', helper: { terminalId: 'x', role: 'tower' } })
    expect((seen as unknown as HandlerContext).helper).not.toBe(identity)
    await invokeHandler('t0582:probe', [], 'win-1')
    expect((seen as unknown as HandlerContext).helper).toBeUndefined()
  })
})
