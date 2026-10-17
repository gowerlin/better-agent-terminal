// @vitest-environment node
/**
 * PLAN-047 M1b-1 / T0590: `blocked` (claude hooks → `terminal:report-hook`, electron/terminal-blocked-state.ts).
 *
 *   - TerminalBlockedTracker: each event enters / clears, same reason unchanged, another reason
 *     replaces, transitions logged, `blockedDetection` default / set by a report / bounded
 *   - PtyManager: a report needs a running PTY; cleared by the user's input (noteUserInput), exit,
 *     kill, restart; `blockedDetection` set before the PTY exists, kept across restart and exit
 *   - `pty:write`: the user's input clears; `{ auto: true }`, terminal auto-replies and a remote
 *     (helper) connection do not
 *   - `terminal:report-hook`: only the caller's own terminal; tower / worker / undeclared shell;
 *     INVALID_ARGS / NOT_FOUND; toolName for a permission prompt only; mirror throttled
 *   - query handlers: get-state blocked JSON (reason / since / source hook / blockedDetection),
 *     exited > blocked, list, wait state-change on entering / leaving blocked, fromState blocked,
 *     until idle satisfied by blocked
 *   - a real RemoteServer with scoped capabilities and the real scripts/bat-hook.mjs process:
 *     stdin hook JSON → blocked; `wait until=state-change` returns when the hook fires; exit 0,
 *     nothing on stdout, tool_input never sent; not in BAT / dead port → exit 0, stdout empty
 *   - T0597 (BUG-150): claude's real AskUserQuestion order — PreToolUse, PermissionRequest with
 *     tool_name AskUserQuestion, PostToolUse — stays a question and the answer clears it
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-blocked-state / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { registerHandler, type HandlerContext } from '../remote/handler-registry'
import { authorizeHelperInvoke, HELPER_CHANNEL_ROLES, HelperCapabilityRegistry } from '../remote/helper-capability'
import { RemoteServer } from '../remote/remote-server'
import {
  BLOCKED_DETECTION_MAX,
  hookEventReason,
  HOOK_REPORT_EVENTS,
  registerReportHookHandler,
  REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS,
  TerminalBlockedTracker,
} from '../terminal-blocked-state'
import { registerTerminalQueryHandlers, TERMINAL_QUERY_IDLE_MS, type TerminalQueryHandlers } from '../terminal-query-handlers'

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
const HOOK = path.resolve(__dirname, '..', '..', 'scripts', 'bat-hook.mjs')
let PtyManager: typeof PtyManagerType
// dynamic: handlers/pty imports pty-manager, which must load after the fake node-pty is in place
let registerPtyHandlers: typeof RegisterPtyHandlers

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ registerPtyHandlers } = await import('../handlers/pty'))
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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0590-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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
  const create = (id: string, opts: { towerId?: string; workspaceId?: string } = {}) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      ...TAB,
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      ...(opts.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: opts.towerId } } : {}),
    })).toBe(true)
    const fake = ptySpawn.mock.results[before].value as FakePty
    fakes.set(id, fake)
    return fake
  }
  const exit = (id: string, exitCode = 0) => {
    const onExit = fakes.get(id)!.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode })
  }
  const output = (id: string, data: string) => {
    const onData = fakes.get(id)!.onData.mock.calls[0][0] as (d: string) => void
    onData(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }
  return { manager, registry, create, exit, output, fakes }
}

describe('TerminalBlockedTracker', () => {
  it('each event enters its reason or clears; transitions logged; same reason unchanged', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    expect(tracker.get('a')).toBeNull()
    expect(tracker.report('a', 'ask-user-question')).toEqual({ result: 'blocked', state: { reason: 'question', since: 1000, event: 'ask-user-question' } })
    t = 2000
    expect(tracker.report('a', 'ask-user-question')).toMatchObject({ result: 'unchanged', state: { reason: 'question', since: 1000 } })
    expect(tracker.report('a', 'permission-request', 'Bash')).toEqual({ result: 'blocked', state: { reason: 'permission', since: 2000, event: 'permission-request', toolName: 'Bash' } })
    expect(tracker.report('a', 'elicitation')).toMatchObject({ result: 'blocked', state: { reason: 'elicitation' } })
    expect(tracker.report('a', 'stop')).toEqual({ result: 'cleared', state: null })
    expect(tracker.report('a', 'stop')).toEqual({ result: 'unchanged', state: null })
    tracker.report('a', 'ask-user-question')
    expect(tracker.report('a', 'user-prompt-submit')).toEqual({ result: 'cleared', state: null })
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → blocked reason=elicitation (hook elicitation)',
      '[blocked] terminal=a → cleared (hook stop)',
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → cleared (hook user-prompt-submit)',
    ])
    expect(HOOK_REPORT_EVENTS).toEqual(['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'user-prompt-submit', 'stop'])
  })

  it('T0594: ask-user-question-done clears a question only; another reason (or none) is unchanged', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    // not blocked: nothing to clear, but the tab is evidently reporting
    expect(tracker.report('a', 'ask-user-question-done')).toEqual({ result: 'unchanged', state: null })
    expect(tracker.getDetection('a')).toBe('hook')
    tracker.report('a', 'ask-user-question')
    expect(tracker.report('a', 'ask-user-question-done')).toEqual({ result: 'cleared', state: null })
    expect(tracker.get('a')).toBeNull()
    // a permission prompt (or an elicitation) is not answered by the question tool finishing
    tracker.report('a', 'permission-request', 'Bash')
    t = 2000
    expect(tracker.report('a', 'ask-user-question-done')).toEqual({
      result: 'unchanged',
      state: { reason: 'permission', since: 1000, event: 'permission-request', toolName: 'Bash' },
    })
    tracker.report('a', 'elicitation')
    expect(tracker.report('a', 'ask-user-question-done')).toMatchObject({ result: 'unchanged', state: { reason: 'elicitation' } })
    expect(tracker.get('a')).toMatchObject({ reason: 'elicitation' })
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → cleared (hook ask-user-question-done)',
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → blocked reason=elicitation (hook elicitation)',
    ])
  })

  it('T0597: PermissionRequest of AskUserQuestion is a question — claude’s real order ask → permission-request → done clears', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    expect(hookEventReason('permission-request', 'AskUserQuestion')).toBe('question')
    expect(hookEventReason('permission-request', 'Bash')).toBe('permission')
    expect(hookEventReason('permission-request')).toBe('permission')
    expect(hookEventReason('ask-user-question-done', 'AskUserQuestion')).toBeNull()
    // claude 2.1.302: PreToolUse(AskUserQuestion), ~90 ms later PermissionRequest(AskUserQuestion)
    tracker.report('a', 'ask-user-question')
    t = 1090
    expect(tracker.report('a', 'permission-request', 'AskUserQuestion')).toEqual({
      result: 'unchanged',
      state: { reason: 'question', since: 1000, event: 'ask-user-question' },
    })
    t = 5000
    expect(tracker.report('a', 'ask-user-question-done')).toEqual({ result: 'cleared', state: null })
    // no PreToolUse first: the permission prompt of the question enters question itself
    expect(tracker.report('b', 'permission-request', 'AskUserQuestion')).toEqual({
      result: 'blocked',
      state: { reason: 'question', since: 5000, event: 'permission-request', toolName: 'AskUserQuestion' },
    })
    expect(tracker.report('b', 'ask-user-question-done')).toEqual({ result: 'cleared', state: null })
    // another tool's permission prompt during a question still replaces it (T0594 case unchanged)
    tracker.report('c', 'ask-user-question')
    expect(tracker.report('c', 'permission-request', 'Bash')).toMatchObject({ result: 'blocked', state: { reason: 'permission', toolName: 'Bash' } })
    expect(tracker.report('c', 'ask-user-question-done')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → cleared (hook ask-user-question-done)',
      '[blocked] terminal=b → blocked reason=question (hook permission-request tool=AskUserQuestion)',
      '[blocked] terminal=b → cleared (hook ask-user-question-done)',
      '[blocked] terminal=c → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=c → blocked reason=permission (hook permission-request tool=Bash)',
    ])
  })

  it('blockedDetection: none by default; a report sets hook; bounded, oldest dropped', () => {
    const tracker = new TerminalBlockedTracker()
    expect(tracker.getDetection('x')).toBe('none')
    tracker.report('x', 'stop')
    expect(tracker.getDetection('x')).toBe('hook')
    tracker.setDetection('x', 'none')
    expect(tracker.getDetection('x')).toBe('none')
    for (let i = 0; i < BLOCKED_DETECTION_MAX; i++) tracker.setDetection(`d${i}`, 'hook')
    expect(tracker.getDetection('x')).toBe('none') // dropped (oldest), default again
    expect(tracker.getDetection('d0')).toBe('hook')
    tracker.setDetection('extra', 'hook')
    expect(tracker.getDetection('d0')).toBe('none')
    expect(tracker.getDetection(`d${BLOCKED_DETECTION_MAX - 1}`)).toBe('hook')
  })
})

describe('PtyManager (T0590)', () => {
  it('a report needs a running PTY; cleared by the user input, kill, exit and restart', () => {
    const { manager, create, exit } = makeManager()
    expect(manager.reportHookEvent('nope', 'ask-user-question')).toBeNull()
    create('a')
    expect(manager.reportHookEvent('a', 'ask-user-question')).toMatchObject({ result: 'blocked' })
    expect(manager.getBlockedState('a')).toMatchObject({ reason: 'question' })
    manager.noteUserInput('a')
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs).toContain('[blocked] terminal=a → cleared (user input)')

    manager.reportHookEvent('a', 'permission-request', 'Edit')
    manager.kill('a')
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs).toContain('[blocked] terminal=a → cleared (the PTY ended)')

    create('b')
    manager.reportHookEvent('b', 'elicitation')
    exit('b', 3)
    expect(manager.getBlockedState('b')).toBeNull()
    expect(manager.reportHookEvent('b', 'elicitation')).toBeNull()

    create('c')
    manager.reportHookEvent('c', 'ask-user-question')
    expect(manager.restart('c', CWD, '/bin/sh')).toBe(true)
    expect(manager.getBlockedState('c')).toBeNull()
  })

  it('blockedDetection: set before the PTY exists, kept across restart and after exit, replaced by a later decision', () => {
    const { manager, create, exit } = makeManager()
    manager.setBlockedDetection('a', 'hook') // claude-cli tabs decide before pty:create
    expect(manager.getBlockedDetection('a')).toBe('hook')
    create('a')
    expect(manager.getBlockedDetection('a')).toBe('hook')
    expect(manager.restart('a', CWD, '/bin/sh')).toBe(true)
    expect(manager.getBlockedDetection('a')).toBe('hook')
    exit('a')
    expect(manager.getBlockedDetection('a')).toBe('hook') // the exited record still says it
    manager.setBlockedDetection('a', 'none')
    expect(manager.getBlockedDetection('a')).toBe('none')
    expect(manager.getBlockedDetection('never')).toBe('none')
  })
})

describe('pty:write clears blocked on the user input only (T0551 / T0566 rule)', () => {
  it('local write clears; { auto: true }, terminal auto-replies and a helper connection do not', () => {
    const { manager, create } = makeManager()
    create('a')
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler as never) }, { getPtyManager: () => manager })
    const write = (ctx: HandlerContext, data: string, opts?: unknown) => handlers.get('pty:write')!(ctx, 'a', data, opts)
    const local: HandlerContext = { windowId: 'w1' }
    const helper: HandlerContext = { windowId: null, connectionId: 'c1' }

    manager.reportHookEvent('a', 'ask-user-question')
    write(local, '\x1b[I') // focus in (switching tabs)
    write(local, '\x1b[12;40R') // cursor position report
    write(local, 'continue', { auto: true }) // BAT's own write (usage-limit continue)
    write(helper, 'prefill') // a helper over RemoteServer
    expect(manager.getBlockedState('a')).toMatchObject({ reason: 'question' })
    write(local, '1')
    expect(manager.getBlockedState('a')).toBeNull()
  })
})

// ── terminal:report-hook ──

function setupHandlers() {
  const env = makeManager()
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const hookLogs: string[] = []
  const mirrors: Array<[string, Record<string, unknown>]> = []
  let t = 10_000
  const register = (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => { handlers.set(channel, handler) }
  registerReportHookHandler({
    registerHandler: register,
    getPtyManager: () => env.manager,
    logger: { log: (m: unknown) => { hookLogs.push(String(m)) } },
    mirrorToBatScripts: (event, payload) => { mirrors.push([event, payload]) },
    now: () => t,
  })
  const queries = registerTerminalQueryHandlers({
    registerHandler: register,
    getPtyManager: () => env.manager,
    isWorkerOf: (c, tw) => env.registry.isWorkerOf(c, tw),
    logger: { log: () => {} },
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = env.manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Promise<Record<string, unknown>> | Record<string, unknown>
  return { ...env, handlers, hookLogs, mirrors, queries, asHelper, call, advance: (ms: number) => { t += ms } }
}

describe('terminal:report-hook', () => {
  let h: ReturnType<typeof setupHandlers>
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  function scene() {
    h = setupHandlers()
    queries = h.queries
    h.create('tw', { workspaceId: 'ws' })
    h.create('wk', { workspaceId: 'ws', towerId: 'tw' })
    h.create('sh', { workspaceId: 'ws' })
    h.manager.setTerminalRole('tw', 'tower')
  }

  it('is a helper channel for both roles (14 in the table)', () => {
    expect(HELPER_CHANNEL_ROLES['terminal:report-hook']).toEqual(['tower', 'worker'])
    expect(Object.keys(HELPER_CHANNEL_ROLES)).toHaveLength(14)
    for (const cap of [{ terminalId: 'a', role: 'tower' as const }, { terminalId: 'b', role: 'worker' as const, towerId: 'a' }]) {
      expect(authorizeHelperInvoke(cap, 'terminal:report-hook', [{ event: 'stop' }])).toEqual({ ok: true })
    }
  })

  it('the caller’s own terminal only — tower, worker and an undeclared shell alike; a terminalId parameter is ignored', () => {
    scene()
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question', terminalId: 'tw' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'blocked', state: 'blocked', blockedReason: 'question' })
    expect(h.manager.getBlockedState('tw')).toBeNull()
    expect(h.manager.getBlockedState('wk')).toMatchObject({ reason: 'question' })
    expect(h.call('terminal:report-hook', h.asHelper('tw'), { event: 'elicitation' })).toMatchObject({ ok: true, terminalId: 'tw', result: 'blocked' })
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'permission-request', toolName: 'Bash' })).toMatchObject({ ok: true, terminalId: 'sh', blockedReason: 'permission' })
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'user-prompt-submit' })).toEqual({ ok: true, terminalId: 'sh', result: 'cleared', state: 'not-blocked' })
    expect(h.hookLogs).toEqual([])
    expect(logs).toContain('[blocked] terminal=sh → blocked reason=permission (hook permission-request tool=Bash)')
    expect(logs).toContain('[blocked] terminal=sh → cleared (hook user-prompt-submit)')
    // a report marks the tab as reporting (a `none` tab never reads blocked)
    expect(h.manager.getBlockedDetection('sh')).toBe('hook')
  })

  it('INVALID_ARGS / NOT_FOUND; toolName kept for a permission prompt only', () => {
    scene()
    const client: HandlerContext = { windowId: null, connectionId: 'client-1' }
    expect(h.call('terminal:report-hook', client, { event: 'stop' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('terminal:report-hook', { windowId: 'w1' }, { event: 'stop' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    for (const bad of [undefined, null, 'stop', ['stop'], {}, { event: 'blocked' }, { event: 42 }, { event: 'stop', toolName: 'a b' }, { event: 'stop', toolName: 7 }, { event: 'stop', toolName: 'x'.repeat(129) }]) {
      expect(h.call('terminal:report-hook', h.asHelper('wk'), bad), JSON.stringify(bad)).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    }
    h.manager.kill('sh')
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'stop' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(h.hookLogs.some(l => l.startsWith('[blocked] report-hook caller=sh event=stop → NOT_FOUND'))).toBe(true)
    // the tool name of AskUserQuestion is not kept (nothing but the event is needed)
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question', toolName: 'AskUserQuestion' })
    expect(h.manager.getBlockedState('wk')).toEqual({ reason: 'question', since: expect.any(Number), event: 'ask-user-question' })
  })

  it('T0594: ask-user-question-done over the channel — clears the caller’s question, leaves a permission prompt', () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question-done', toolName: 'AskUserQuestion' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'cleared', state: 'not-blocked' })
    h.call('terminal:report-hook', h.asHelper('sh'), { event: 'permission-request', toolName: 'Bash' })
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'ask-user-question-done' }))
      .toEqual({ ok: true, terminalId: 'sh', result: 'unchanged', state: 'blocked', blockedReason: 'permission' })
    expect(h.manager.getBlockedState('sh')).toMatchObject({ reason: 'permission', toolName: 'Bash' })
    expect(logs).toContain('[blocked] terminal=wk → cleared (hook ask-user-question-done)')
    // PermissionDenied is not reported (claude 2.1.300 fires it for auto-mode classifier denials only)
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'permission-denied' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
  })

  it('T0597: PermissionRequest of AskUserQuestion over the channel answers blockedReason question; the answer clears it', () => {
    scene()
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question' })).toMatchObject({ result: 'blocked', blockedReason: 'question' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'AskUserQuestion' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'unchanged', state: 'blocked', blockedReason: 'question' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, state: 'blocked', blockedReason: 'question', source: 'hook' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question-done' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'cleared', state: 'not-blocked' })
    // without the PreToolUse first
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'permission-request', toolName: 'AskUserQuestion' }))
      .toEqual({ ok: true, terminalId: 'sh', result: 'blocked', state: 'blocked', blockedReason: 'question' })
    expect(logs).toContain('[blocked] terminal=sh → blocked reason=question (hook permission-request tool=AskUserQuestion)')
    expect(logs).toContain('[blocked] terminal=wk → cleared (hook ask-user-question-done)')
    expect(logs.some(l => l.includes('reason=permission'))).toBe(false)
  })

  it('bat-scripts.log: every transition, an unchanged report at most once per 5 s per terminal; never content', () => {
    scene()
    const r = (event: string) => h.call('terminal:report-hook', h.asHelper('wk'), { event })
    r('stop') // unchanged (not blocked)
    r('stop')
    r('stop')
    r('ask-user-question')
    r('ask-user-question')
    h.advance(REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS)
    r('ask-user-question')
    r('stop')
    expect(h.mirrors).toEqual([
      ['report-hook', { terminalId: 'wk', hook: 'stop', result: 'unchanged' }],
      ['report-hook', { terminalId: 'wk', hook: 'ask-user-question', result: 'blocked' }],
      ['report-hook', { terminalId: 'wk', hook: 'ask-user-question', result: 'unchanged' }],
      ['report-hook', { terminalId: 'wk', hook: 'stop', result: 'cleared' }],
    ])
  })
})

describe('query handlers: blocked (T0590)', () => {
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

  it('get-state: blocked with reason / since / source hook; blockedDetection on every answer; exited > blocked', () => {
    scene()
    h.manager.setBlockedDetection('wk', 'hook')
    h.output('wk', 'thinking\r\n')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' }))
      .toMatchObject({ ok: true, state: 'working', source: 'output', blockedDetection: 'hook' })
    expect(h.call('terminal:get-state', h.asHelper('tw'))).toMatchObject({ ok: true, terminalId: 'tw', source: 'output', blockedDetection: 'none' })
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question' })
    const since = h.manager.getBlockedState('wk')!.since
    // blocked wins over working (it printed just now)
    const state = h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })
    expect(state).toEqual({
      ok: true,
      terminalId: 'wk',
      state: 'blocked',
      lastOutputAt: expect.any(Number),
      idleMs: expect.any(Number),
      blockedReason: 'question',
      blockedSince: since,
      source: 'hook',
      blockedDetection: 'hook',
    })
    // the worker itself, and its tower's metadata view
    expect(h.call('terminal:get-state', h.asHelper('wk'))).toMatchObject({ state: 'blocked' })
    h.manager.kill('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ state: 'exited', source: 'output', blockedDetection: 'hook' })
  })

  it('list: state blocked with blockedReason and blockedDetection', () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash' })
    const r = h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }
    expect(r.terminals.find(t => t.id === 'wk')).toMatchObject({ state: 'blocked', blockedReason: 'permission', blockedDetection: 'hook', alive: true })
    expect(r.terminals.find(t => t.id === 'tw')).toMatchObject({ state: 'idle', blockedDetection: 'none' })
    expect(r.terminals.find(t => t.id === 'tw')).not.toHaveProperty('blockedReason')
    // the tool name is never returned
    expect(JSON.stringify(r)).not.toContain('Bash')
  })

  it('wait: state-change on entering and leaving blocked; fromState blocked; until idle is met by blocked', async () => {
    vi.useFakeTimers()
    scene()
    const now = Date.now()
    vi.setSystemTime(now + TERMINAL_QUERY_IDLE_MS + 10) // both idle
    const entering = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(500)
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'elicitation' })
    await vi.advanceTimersByTimeAsync(300)
    expect(await entering).toMatchObject({ ok: true, changed: true, state: 'blocked', blockedReason: 'elicitation', source: 'hook' })

    // already blocked: until idle is met at once (blocked is not working)
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'idle' })).toMatchObject({ changed: true, state: 'blocked' })
    // fromState blocked: met when it leaves blocked
    const leaving = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change', fromState: 'blocked', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(500)
    h.manager.noteUserInput('wk')
    await vi.advanceTimersByTimeAsync(300)
    expect(await leaving).toMatchObject({ ok: true, changed: true, state: 'idle', source: 'output' })
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change', fromState: 'idle', timeoutMs: 0 })).toMatchObject({ changed: false })
  })
})

// ── a real RemoteServer + scripts/bat-hook.mjs ──

interface HookRun { code: number | null; stdout: string; stderr: string; ms: number }

function runHook(event: string, stdin: string, env: NodeJS.ProcessEnv): Promise<HookRun> {
  const base: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_')))
  return new Promise(resolve => {
    const started = Date.now()
    const child = spawn(process.execPath, [HOOK, event], { env: { ...base, ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d })
    child.stderr.on('data', d => { stderr += d })
    child.on('exit', code => resolve({ code, stdout, stderr, ms: Date.now() - started }))
    child.stdin.on('error', () => {})
    child.stdin.end(stdin)
  })
}

describe('scripts/bat-hook.mjs ↔ RemoteServer + capabilities', () => {
  let dir: string
  let logDir: string
  let manager: PtyManagerType
  let registry: HelperCapabilityRegistry
  let server: RemoteServer
  let port: number
  let queries: TerminalQueryHandlers
  const received: unknown[][] = []
  const tokens = new Map<string, string>()
  /** T0594: answer like a T0590 BAT, which does not know `ask-user-question-done`. */
  let oldBat = false
  const T0590_EVENTS = ['permission-request', 'ask-user-question', 'elicitation', 'user-prompt-submit', 'stop']

  const hookEnv = (id: string): NodeJS.ProcessEnv => ({
    BAT_REMOTE_PORT: String(port),
    BAT_REMOTE_TOKEN: tokens.get(id)!,
    BAT_TERMINAL_ID: id,
    BAT_SERVER_CERT_PATH: path.join(dir, 'server-cert.json'),
    BAT_HELPER_LOG_DIR: logDir,
  })

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0590-rs-'))
    logDir = path.join(dir, 'Logs')
    registry = new HelperCapabilityRegistry()
    manager = new PtyManager({
      emit: () => {},
      dataDir: dir,
      helperEnv: (id, customEnv) => {
        tokens.set(id, registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined }))
        return {}
      },
      onPtyExit: id => { registry.revokeTerminal(id) },
    })
    manager.create({ id: 'hk-tower', ...TAB, workspaceId: 'ws' })
    manager.create({ id: 'hk-worker', ...TAB, workspaceId: 'ws', customEnv: { BAT_TOWER_TERMINAL_ID: 'hk-tower' } })
    manager.setTerminalRole('hk-tower', 'tower')
    manager.setBlockedDetection('hk-worker', 'hook')
    queries = registerTerminalQueryHandlers({
      registerHandler,
      getPtyManager: () => manager,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      logger: { log: () => {} },
    })
    registerReportHookHandler({
      // record what crosses the wire: the event (and a tool name), never the hook input
      registerHandler: (channel, handler) => registerHandler(channel, (ctx, ...args) => {
        received.push(args)
        const event = (args[0] as { event?: unknown } | undefined)?.event
        if (oldBat && !T0590_EVENTS.includes(String(event))) return { ok: false, code: 'INVALID_ARGS', message: 'event' }
        return handler(ctx, ...args)
      }),
      getPtyManager: () => manager,
      logger: { log: () => {} },
    })
    server = new RemoteServer({
      logger: { log: () => {}, warn: () => {}, error: () => {} },
      helperCapabilities: registry,
      isTerminalAlive: id => manager.isAlive(id),
      getPtyCapacity: () => manager.getCapacity(),
    })
    server.configDir = dir
    port = (await server.start(0, 'h'.repeat(32), 'localhost')).port
  })

  afterAll(() => {
    queries?.dispose()
    server?.stop()
    manager?.dispose()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('PreToolUse AskUserQuestion → blocked; exit 0, stdout empty, tool_input / prompt never sent; Stop clears', async () => {
    const input = {
      session_id: 's1',
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'SECRET-QUESTION-TEXT?' }] },
      prompt: 'SECRET-PROMPT',
    }
    const run = await runHook('ask-user-question', JSON.stringify(input), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'question' })
    expect(received.at(-1)).toEqual([{ event: 'ask-user-question' }])
    expect(JSON.stringify(received)).not.toMatch(/SECRET|tool_input|batcap/)

    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    const line = log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).find(e => e.script === 'bat-hook')
    expect(line).toMatchObject({ event: 'report-hook', hook: 'ask-user-question', result: 'blocked', terminalId: 'hk-worker' })
    expect(log).not.toMatch(/SECRET|batcap\./)
    // node start + TLS + one invoke, well inside the script's own 1.8 s deadline
    expect(run.ms).toBeLessThan(2_000)

    const stop = await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))
    expect(stop).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toBeNull()
  })

  it('a tower’s wait until=state-change returns when the Worker’s hook fires; PermissionRequest sends the tool name only', async () => {
    const towerCtx: HandlerContext = { windowId: null, connectionId: 'tw', helper: { terminalId: 'hk-tower', role: 'tower' } }
    const { invokeHandler } = await import('../remote/handler-registry')
    const waiting = invokeHandler('terminal:wait', [{ terminalId: 'hk-worker', until: 'state-change', timeoutMs: 10_000 }], null, 'tw', towerCtx.helper) as Promise<Record<string, unknown>>
    const run = await runHook('permission-request', JSON.stringify({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf SECRET' } }), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(await waiting).toMatchObject({ ok: true, changed: true, state: 'blocked', blockedReason: 'permission', blockedDetection: 'hook' })
    expect(received.at(-1)).toEqual([{ event: 'permission-request', toolName: 'Bash' }])
    // the tower (shell tab capability too) reports for itself
    expect(await runHook('elicitation', JSON.stringify({ hook_event_name: 'Notification', notification_type: 'elicitation_dialog' }), hookEnv('hk-tower'))).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-tower')).toMatchObject({ reason: 'elicitation' })
    // another notification type is not an elicitation: nothing is sent
    const before = received.length
    expect(await runHook('elicitation', JSON.stringify({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }), hookEnv('hk-tower'))).toMatchObject({ code: 0, stdout: '' })
    expect(received.length).toBe(before)
  })

  it('T0594: PostToolUse AskUserQuestion → cleared (no keyboard); another tool sends nothing; tool_response never sent', async () => {
    await runHook('ask-user-question', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'question' })
    const before = received.length
    const other = await runHook('ask-user-question-done', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Bash' }), hookEnv('hk-worker'))
    expect(other).toMatchObject({ code: 0, stdout: '' })
    expect(received.length).toBe(before)
    const input = {
      session_id: 's1',
      hook_event_name: 'PostToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'SECRET-QUESTION?' }] },
      tool_response: { answers: { 'SECRET-QUESTION?': 'SECRET-ANSWER' } },
      tool_use_id: 'toolu_1',
    }
    const run = await runHook('ask-user-question-done', JSON.stringify(input), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    expect(received.at(-1)).toEqual([{ event: 'ask-user-question-done' }])
    expect(JSON.stringify(received)).not.toMatch(/SECRET|tool_response|tool_input/)
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    expect(log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1))
      .toMatchObject({ event: 'report-hook', hook: 'ask-user-question-done', result: 'cleared', terminalId: 'hk-worker' })
    expect(log).not.toMatch(/SECRET/)
  })

  it('T0597: PermissionRequest of AskUserQuestion after its PreToolUse → the tower reads question; PostToolUse clears it', async () => {
    const tower = { terminalId: 'hk-tower', role: 'tower' as const }
    const { invokeHandler } = await import('../remote/handler-registry')
    const towerState = () => invokeHandler('terminal:get-state', [{ terminalId: 'hk-worker' }], null, 'tw', tower) as Promise<Record<string, unknown>>
    await runHook('ask-user-question', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
    const since = manager.getBlockedState('hk-worker')!.since
    const input = {
      session_id: 's1',
      hook_event_name: 'PermissionRequest',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'SECRET-QUESTION?' }] },
      permission_suggestions: [],
    }
    const run = await runHook('permission-request', JSON.stringify(input), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(received.at(-1)).toEqual([{ event: 'permission-request', toolName: 'AskUserQuestion' }])
    expect(JSON.stringify(received)).not.toMatch(/SECRET|tool_input/)
    expect(await towerState()).toMatchObject({ ok: true, state: 'blocked', blockedReason: 'question', blockedSince: since, source: 'hook' })
    await runHook('ask-user-question-done', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    // the question's permission prompt alone (no PreToolUse) is a question too
    await runHook('permission-request', JSON.stringify(input), hookEnv('hk-worker'))
    expect(await towerState()).toMatchObject({ state: 'blocked', blockedReason: 'question' })
    await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toBeNull()
  })

  it('T0594: a BAT that does not know the event answers INVALID_ARGS → still exit 0, stdout empty; state untouched', async () => {
    await runHook('ask-user-question', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
    oldBat = true
    try {
      const run = await runHook('ask-user-question-done', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
      expect(run).toMatchObject({ code: 0, stdout: '' })
      expect(run.ms).toBeLessThan(2_000)
    } finally {
      oldBat = false
    }
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'question' })
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    expect(log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1))
      .toMatchObject({ hook: 'ask-user-question-done', result: 'failed', code: 'INVALID_ARGS' })
    await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toBeNull()
  })

  it('not in BAT / a dead port / a revoked token / garbage stdin → exit 0, stdout empty, quickly', async () => {
    const outside = await runHook('stop', '{}', {})
    expect(outside).toMatchObject({ code: 0, stdout: '', stderr: '' })
    const dead = await runHook('stop', '{"hook_event_name":"Stop"}', { ...hookEnv('hk-worker'), BAT_REMOTE_PORT: '1' })
    expect(dead).toMatchObject({ code: 0, stdout: '' })
    expect(dead.ms).toBeLessThan(2_500)
    const bad = await runHook('stop', 'not json', { ...hookEnv('hk-worker'), BAT_REMOTE_TOKEN: 'batcap.unknown' })
    expect(bad).toMatchObject({ code: 0, stdout: '' })
    const unknownEvent = await runHook('bogus', '{}', hookEnv('hk-worker'))
    expect(unknownEvent).toMatchObject({ code: 0, stdout: '' })
  })
})
