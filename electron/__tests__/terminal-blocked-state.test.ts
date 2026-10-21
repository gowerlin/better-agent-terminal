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
 *   - T0600 (D154): `session-start` → `agentStarted` (first one only, blocked untouched); cleared by
 *     the PTY ending / restart / recovery, kept by the exited record, not by user input; get-state /
 *     list / wait `agentStarted` true / false / null; `until: 'agent-started'`; the real hook process
 *   - T0600 option B: `[agent-command] launch-suspect` — a "command not found" right after the
 *     dispatch command is logged (label only), nothing else changes
 *   - T0657 (BUG-162): `post-tool-batch` clears `permission` only, keyed by `agentId` (a batch
 *     clears its own agent's prompt; more than PERMISSION_AGENTS_MAX agents → any batch); the
 *     channel's agentId check; the real hook process (huge batch, never tool_calls) and a BAT
 *     before T0657 (agentId ignored, the event INVALID_ARGS, exit 0)
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
  isStartReportEvent,
  LAUNCH_SUSPECT_WINDOW_MS,
  LaunchSuspectWatcher,
  PERMISSION_AGENTS_MAX,
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
      '[turn] terminal=a → started (hook user-prompt-submit)', // T0694
      '[blocked] terminal=a → cleared (hook user-prompt-submit)',
    ])
    expect(HOOK_REPORT_EVENTS).toEqual(['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch', 'user-prompt-submit', 'stop', 'session-start'])
  })

  it('T0620: elicitation-done clears an elicitation only; another reason (or none) is unchanged', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    expect(hookEventReason('elicitation-done')).toBeNull()
    // not blocked: nothing to clear, but the tab is evidently reporting
    expect(tracker.report('a', 'elicitation-done')).toEqual({ result: 'unchanged', state: null })
    expect(tracker.getDetection('a')).toBe('hook')
    tracker.report('a', 'elicitation')
    expect(tracker.report('a', 'elicitation-done')).toEqual({ result: 'cleared', state: null })
    expect(tracker.get('a')).toBeNull()
    // ElicitationResult, then its `elicitation_response` notification: the second one is unchanged
    expect(tracker.report('a', 'elicitation-done')).toEqual({ result: 'unchanged', state: null })
    // a permission prompt or a question is not answered by the elicitation dialog closing
    tracker.report('a', 'permission-request', 'Bash')
    t = 2000
    expect(tracker.report('a', 'elicitation-done')).toEqual({
      result: 'unchanged',
      state: { reason: 'permission', since: 1000, event: 'permission-request', toolName: 'Bash' },
    })
    tracker.report('a', 'ask-user-question')
    expect(tracker.report('a', 'elicitation-done')).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    // and the answered question does not close an elicitation (T0594, the other direction)
    tracker.report('a', 'elicitation')
    expect(tracker.report('a', 'ask-user-question-done')).toMatchObject({ result: 'unchanged', state: { reason: 'elicitation' } })
    expect(tracker.report('a', 'elicitation-done')).toEqual({ result: 'cleared', state: null })
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=elicitation (hook elicitation)',
      '[blocked] terminal=a → cleared (hook elicitation-done)',
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → blocked reason=elicitation (hook elicitation)',
      '[blocked] terminal=a → cleared (hook elicitation-done)',
    ])
  })

  it('T0657: post-tool-batch clears a permission prompt only; another reason (or none) is unchanged', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    expect(hookEventReason('post-tool-batch')).toBeNull()
    // not blocked: every batch of a working claude lands here
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'unchanged', state: null })
    expect(tracker.getDetection('a')).toBe('hook')
    // the dangerous-rm safety check: prompt, auto-denied after 120 s, the batch resolves (no keyboard)
    tracker.report('a', 'permission-request', 'Bash')
    t = 121_000
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'unchanged', state: null })
    // a question / an elicitation dialog is not answered by a batch resolving
    tracker.report('a', 'ask-user-question')
    expect(tracker.report('a', 'post-tool-batch')).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    tracker.report('a', 'permission-request', 'AskUserQuestion') // T0597: still the question
    expect(tracker.report('a', 'post-tool-batch')).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    tracker.report('a', 'elicitation')
    expect(tracker.report('a', 'post-tool-batch')).toMatchObject({ result: 'unchanged', state: { reason: 'elicitation' } })
    // and the other clearing events still leave a permission prompt alone
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.report('a', 'ask-user-question-done')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(tracker.report('a', 'elicitation-done')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → cleared (hook post-tool-batch)',
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → blocked reason=elicitation (hook elicitation)',
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → cleared (hook post-tool-batch)',
    ])
  })

  it('T0657: prompts are keyed by agent — a batch clears only its own agent’s; blocked ends when none is left', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    // a background subagent's prompt; the main thread keeps working
    expect(tracker.report('a', 'permission-request', 'Bash', undefined, 'a1')).toMatchObject({ result: 'blocked', state: { reason: 'permission', since: 1000 } })
    t = 2000
    expect(tracker.report('a', 'post-tool-batch')).toMatchObject({ result: 'unchanged', state: { reason: 'permission', since: 1000 } })
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'a2')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    // the main thread's own prompt meanwhile: still blocked since the first one
    expect(tracker.report('a', 'permission-request', 'Write')).toMatchObject({ result: 'unchanged', state: { reason: 'permission', since: 1000, toolName: 'Bash' } })
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'a1')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    // the subagent's batch is a no-op the second time; the main thread's clears
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'a1')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    // leaving `permission` forgets the agents: a question in between, then a main-thread prompt
    tracker.report('a', 'permission-request', 'Bash', undefined, 'a1')
    tracker.report('a', 'ask-user-question')
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'a1')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    // and so does any other clearing (stop / user input / the PTY ending use clear())
    tracker.report('a', 'permission-request', 'Bash', undefined, 'a1')
    tracker.report('a', 'stop')
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    tracker.report('a', 'permission-request', 'Bash', undefined, 'a1')
    tracker.clearForUserInput('a')
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.report('a', 'post-tool-batch')).toEqual({ result: 'cleared', state: null })
    // agentId is only for these two events
    tracker.report('a', 'ask-user-question', undefined, undefined, 'a1')
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'a1')).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    expect(lines).toContain('[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash agent=a1)')
    expect(lines).toContain('[blocked] terminal=a → cleared (hook post-tool-batch)')
    expect(lines.filter(l => l.includes('agent=')).every(l => l.includes('reason=permission'))).toBe(true)
  })

  it(`T0657: more than ${PERMISSION_AGENTS_MAX} agents with a prompt → any batch clears (logged once)`, () => {
    const lines: string[] = []
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) })
    tracker.report('a', 'permission-request', 'Bash')
    for (let i = 1; i < PERMISSION_AGENTS_MAX; i++) tracker.report('a', 'permission-request', 'Bash', undefined, `a${i}`)
    // exactly the limit: still per agent
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'stranger')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(lines.some(l => l.includes('any post-tool-batch clears'))).toBe(false)
    tracker.report('a', 'permission-request', 'Bash', undefined, 'one-more')
    tracker.report('a', 'permission-request', 'Bash', undefined, 'and-another')
    expect(lines.filter(l => l.includes('any post-tool-batch clears'))).toEqual([
      `[blocked] terminal=a permission prompts of more than ${PERMISSION_AGENTS_MAX} agents → any post-tool-batch clears`,
    ])
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'stranger')).toEqual({ result: 'cleared', state: null })
    // the next prompt starts over per agent
    tracker.report('a', 'permission-request', 'Bash', undefined, 'a1')
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'stranger')).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
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

  it('is a helper channel for both roles (19 in the table; T0607: + 5 question channels)', () => {
    expect(HELPER_CHANNEL_ROLES['terminal:report-hook']).toEqual(['tower', 'worker'])
    expect(Object.keys(HELPER_CHANNEL_ROLES)).toHaveLength(19)
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

  it('T0620: elicitation-done over the channel — clears the caller’s elicitation, leaves a permission prompt', () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'elicitation' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'elicitation-done' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'cleared', state: 'not-blocked' })
    h.call('terminal:report-hook', h.asHelper('sh'), { event: 'permission-request', toolName: 'Bash' })
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'elicitation-done' }))
      .toEqual({ ok: true, terminalId: 'sh', result: 'unchanged', state: 'blocked', blockedReason: 'permission' })
    expect(h.manager.getBlockedState('sh')).toMatchObject({ reason: 'permission', toolName: 'Bash' })
    expect(logs).toContain('[blocked] terminal=wk → cleared (hook elicitation-done)')
    // the result hook's other names are not events
    for (const event of ['elicitation-result', 'elicitation-response', 'elicitation-complete']) {
      expect(h.call('terminal:report-hook', h.asHelper('wk'), { event })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    }
  })

  it('T0657: post-tool-batch over the channel — clears the caller’s permission prompt (its own agent’s), leaves a question; agentId checked', () => {
    scene()
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'post-tool-batch' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'cleared', state: 'not-blocked' })
    expect(logs).toContain('[blocked] terminal=wk → cleared (hook post-tool-batch)')
    h.call('terminal:report-hook', h.asHelper('sh'), { event: 'ask-user-question' })
    expect(h.call('terminal:report-hook', h.asHelper('sh'), { event: 'post-tool-batch' }))
      .toEqual({ ok: true, terminalId: 'sh', result: 'unchanged', state: 'blocked', blockedReason: 'question' })
    // a subagent's prompt: the main thread's batch does not clear it, the subagent's does
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash', agentId: 'a1b2' }))
      .toMatchObject({ ok: true, result: 'blocked', blockedReason: 'permission' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'post-tool-batch' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'unchanged', state: 'blocked', blockedReason: 'permission' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, state: 'blocked', blockedReason: 'permission', source: 'hook' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'post-tool-batch', agentId: 'a1b2' }))
      .toEqual({ ok: true, terminalId: 'wk', result: 'cleared', state: 'not-blocked' })
    expect(logs).toContain('[blocked] terminal=wk → blocked reason=permission (hook permission-request tool=Bash agent=a1b2)')
    expect(logs).toContain('[blocked] terminal=wk → cleared (hook post-tool-batch agent=a1b2)')
    expect(h.mirrors.some(([, p]) => p.hook === 'post-tool-batch' && p.agent === 'a1b2' && p.result === 'cleared')).toBe(true)
    // a malformed agent id is refused (it must not read as the main thread) on the two events that use it …
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash' })
    for (const event of ['permission-request', 'post-tool-batch']) {
      for (const agentId of ['a b', '', 'x'.repeat(129), 7, { id: 'a' }]) {
        expect(h.call('terminal:report-hook', h.asHelper('wk'), { event, agentId }), `${event} ${JSON.stringify(agentId)}`).toMatchObject({ ok: false, code: 'INVALID_ARGS', message: 'agentId' })
      }
    }
    expect(h.manager.getBlockedState('wk')).toMatchObject({ reason: 'permission' })
    // … and ignored on every other event (null = absent)
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'post-tool-batch', agentId: null })).toMatchObject({ ok: true, result: 'cleared' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'ask-user-question', agentId: 'a b' })).toMatchObject({ ok: true, result: 'blocked', blockedReason: 'question' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'stop', agentId: 7 })).toMatchObject({ ok: true, result: 'cleared' })
    // other names of the batch hook are not events
    for (const event of ['post-tool-use', 'post-tool-use-failure', 'permission-denied', 'PostToolBatch']) {
      expect(h.call('terminal:report-hook', h.asHelper('wk'), { event })).toMatchObject({ ok: false, code: 'INVALID_ARGS', message: 'event' })
    }
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
      agentStarted: false, // T0600: the hooks run (detection hook), but no session-start yet
      pendingQuestions: 0, // T0607
      claudeSessionName: null, // T0642
      claudeSessionId: null,
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
  /** T0642: answer like a T0600 BAT, which reads only `event` / `toolName` (the session id is dropped). */
  let t0600Bat = false
  /**
   * T0657: answer like a BAT before T0657 — `post-tool-batch` is not an event; an `agentId` field is
   * ignored like any other unknown field (the handler then reads only event / toolName / sessionId).
   */
  let t0642Bat = false
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
        if (t0642Bat) {
          if (event === 'post-tool-batch') return { ok: false, code: 'INVALID_ARGS', message: 'event' }
          const { agentId: _ignored, ...rest } = args[0] as Record<string, unknown>
          return handler(ctx, rest)
        }
        if (t0600Bat) {
          const { sessionId: _dropped, ...rest } = args[0] as Record<string, unknown>
          return handler(ctx, rest)
        }
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

  it('T0620: ElicitationResult / Notification elicitation_response → cleared (no keyboard); content / action never sent', async () => {
    const elicit = () => runHook('elicitation', JSON.stringify({ hook_event_name: 'Notification', notification_type: 'elicitation_dialog' }), hookEnv('hk-worker'))
    await elicit()
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'elicitation' })
    const input = {
      session_id: 's1',
      hook_event_name: 'ElicitationResult',
      mcp_server_name: 'srv',
      elicitation_id: 'el-1',
      mode: 'form',
      action: 'accept',
      content: { password: 'SECRET-ELICITATION-CONTENT' },
    }
    const run = await runHook('elicitation-done', JSON.stringify(input), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    expect(received.at(-1)).toEqual([{ event: 'elicitation-done' }])

    // the request cancelled / timed out: no ElicitationResult, only the notification
    await elicit()
    const note = await runHook('elicitation-done', JSON.stringify({
      hook_event_name: 'Notification',
      notification_type: 'elicitation_response',
      message: 'Elicitation response for server "SECRET-SERVER": cancel',
    }), hookEnv('hk-worker'))
    expect(note).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    expect(received.at(-1)).toEqual([{ event: 'elicitation-done' }])
    expect(JSON.stringify(received)).not.toMatch(/SECRET|content|accept|cancel/)

    // another notification type wired to the same event (none is, but a shared settings file could) sends nothing
    await elicit()
    const before = received.length
    for (const type of ['elicitation_complete', 'elicitation_dialog', 'idle_prompt']) {
      expect(await runHook('elicitation-done', JSON.stringify({ hook_event_name: 'Notification', notification_type: type }), hookEnv('hk-worker')))
        .toMatchObject({ code: 0, stdout: '' })
    }
    expect(received.length).toBe(before)
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'elicitation' })
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    expect(log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1))
      .toMatchObject({ event: 'report-hook', hook: 'elicitation', terminalId: 'hk-worker' })
    expect(log).not.toMatch(/SECRET/)

    // a BAT that does not know the event (before T0620): INVALID_ARGS, exit 0, the state stays
    oldBat = true
    try {
      expect(await runHook('elicitation-done', JSON.stringify(input), hookEnv('hk-worker'))).toMatchObject({ code: 0, stdout: '' })
    } finally {
      oldBat = false
    }
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'elicitation' })
    await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toBeNull()
  })

  it('T0657: PostToolBatch clears a permission prompt (no keyboard) — its own agent’s only; exit 0, stdout empty; tool_calls / tool_input never sent', async () => {
    const lastHookLog = () => fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8').trim().split('\n')
      .map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1)
    // claude 2.1.302 field order: the common fields (agent_id among them) first, then the payload
    const permission = (agent?: string) => JSON.stringify({
      session_id: 's1', cwd: 'C:\\w', permission_mode: 'bypassPermissions', ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
      hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf SECRET-PATH' }, permission_suggestions: [],
    })
    const batch = (agent?: string, responseBytes = 64) => JSON.stringify({
      session_id: 's1', cwd: 'C:\\w', permission_mode: 'bypassPermissions', ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
      hook_event_name: 'PostToolBatch',
      tool_calls: [
        { tool_name: 'Bash', tool_input: { command: 'rm -rf SECRET-PATH' }, tool_use_id: 'toolu_1', tool_response: 'Permission … denied by a built-in Claude Code safety check' },
        { tool_name: 'Read', tool_input: { file_path: 'SECRET-FILE' }, tool_use_id: 'toolu_2', tool_response: `SECRET-${'x'.repeat(responseBytes)}` },
      ],
    })

    // the main thread's prompt; a batch with a huge result (over the old 256 KiB stdin cap) still clears it
    expect(await runHook('permission-request', permission(), hookEnv('hk-worker'))).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'permission', toolName: 'Bash' })
    const run = await runHook('post-tool-batch', batch(undefined, 400 * 1024), hookEnv('hk-worker'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.ms).toBeLessThan(2_000)
    expect(received.at(-1)).toEqual([{ event: 'post-tool-batch' }])
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    expect(lastHookLog()).toMatchObject({ event: 'report-hook', hook: 'post-tool-batch', result: 'cleared', terminalId: 'hk-worker' })

    // a subagent's prompt: the main thread's batch leaves it, the subagent's own clears it
    await runHook('permission-request', permission('a4f1c2'), hookEnv('hk-worker'))
    expect(received.at(-1)).toEqual([{ event: 'permission-request', toolName: 'Bash', agentId: 'a4f1c2' }])
    await runHook('post-tool-batch', batch(), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'permission' })
    expect(lastHookLog()).toMatchObject({ hook: 'post-tool-batch', result: 'unchanged' })
    expect(await runHook('post-tool-batch', batch('a4f1c2'), hookEnv('hk-worker'))).toMatchObject({ code: 0, stdout: '' })
    expect(received.at(-1)).toEqual([{ event: 'post-tool-batch', agentId: 'a4f1c2' }])
    expect(manager.getBlockedState('hk-worker')).toBeNull()
    expect(lastHookLog()).toMatchObject({ hook: 'post-tool-batch', agent: 'a4f1c2', result: 'cleared' })

    // a question is not cleared by a batch
    await runHook('ask-user-question', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }), hookEnv('hk-worker'))
    await runHook('post-tool-batch', batch(), hookEnv('hk-worker'))
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'question' })
    await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))

    // an input it cannot tell apart (another hook, garbage, a malformed agent_id) sends nothing
    await runHook('permission-request', permission(), hookEnv('hk-worker'))
    const before = received.length
    for (const stdin of [JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Bash' }), 'not json', '', batch('a b')]) {
      expect(await runHook('post-tool-batch', stdin, hookEnv('hk-worker')), stdin.slice(0, 40)).toMatchObject({ code: 0, stdout: '' })
    }
    expect(received.length).toBe(before)
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'permission' })
    await runHook('stop', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-worker'))

    expect(JSON.stringify(received)).not.toMatch(/SECRET|tool_calls|tool_input|tool_response|batcap/)
    expect(fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')).not.toMatch(/SECRET|batcap\./)
  })

  it('T0657: a BAT before T0657 — the agentId field is ignored (the prompt is still recorded), post-tool-batch INVALID_ARGS → exit 0, state untouched', async () => {
    t0642Bat = true
    try {
      const prompt = await runHook('permission-request', JSON.stringify({ agent_id: 'a9', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: {} }), hookEnv('hk-worker'))
      expect(prompt).toMatchObject({ code: 0, stdout: '' })
      expect(received.at(-1)).toEqual([{ event: 'permission-request', toolName: 'Bash', agentId: 'a9' }])
      expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'permission', toolName: 'Bash' })
      for (const agent of [undefined, 'a9']) {
        const run = await runHook('post-tool-batch', JSON.stringify({ ...(agent ? { agent_id: agent } : {}), hook_event_name: 'PostToolBatch', tool_calls: [] }), hookEnv('hk-worker'))
        expect(run).toMatchObject({ code: 0, stdout: '', stderr: '' })
      }
    } finally {
      t0642Bat = false
    }
    expect(manager.getBlockedState('hk-worker')).toMatchObject({ reason: 'permission' })
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    expect(log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1))
      .toMatchObject({ hook: 'post-tool-batch', result: 'failed', code: 'INVALID_ARGS' })
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

  it('T0600: SessionStart → agentStarted; exit 0, stdout empty (claude would add it to the context), source never sent; a tower wait until=agent-started returns', async () => {
    manager.create({ id: 'hk-start', ...TAB, workspaceId: 'ws', customEnv: { BAT_TOWER_TERMINAL_ID: 'hk-tower' } })
    manager.setBlockedDetection('hk-start', 'hook')
    const { invokeHandler } = await import('../remote/handler-registry')
    const towerHelper = { terminalId: 'hk-tower', role: 'tower' as const }
    const waiting = invokeHandler('terminal:wait', [{ terminalId: 'hk-start', until: 'agent-started', timeoutMs: 10_000 }], null, 'tw', towerHelper) as Promise<Record<string, unknown>>
    const input = { session_id: 's-start', hook_event_name: 'SessionStart', source: 'startup', model: 'SECRET-MODEL', transcript_path: '/SECRET/path.jsonl' }
    const run = await runHook('session-start', JSON.stringify(input), hookEnv('hk-start'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.ms).toBeLessThan(2_000)
    expect(received.at(-1)).toEqual([{ event: 'session-start' }])
    expect(JSON.stringify(received)).not.toMatch(/SECRET|startup|batcap/)
    const startedAt = manager.getAgentStartedAt('hk-start')
    expect(startedAt).toEqual(expect.any(Number))
    expect(await waiting).toMatchObject({ ok: true, changed: true, agentStarted: true, agentStartedAt: startedAt, blockedDetection: 'hook' })
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    expect(log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook').at(-1))
      .toMatchObject({ hook: 'session-start', result: 'started', terminalId: 'hk-start' })
    expect(log).not.toMatch(/SECRET|batcap\./)
    // a BAT before T0600 refuses the event: still exit 0, nothing on stdout
    oldBat = true
    try {
      expect(await runHook('session-start', JSON.stringify(input), hookEnv('hk-start'))).toMatchObject({ code: 0, stdout: '' })
    } finally {
      oldBat = false
    }
    // another hook's input under this event is not reported
    const before = received.length
    expect(await runHook('session-start', JSON.stringify({ hook_event_name: 'Stop' }), hookEnv('hk-start'))).toMatchObject({ code: 0, stdout: '' })
    expect(received.length).toBe(before)
    manager.kill('hk-start')
  })

  it('T0642: SessionStart sends its session_id (a UUID) — exit 0, stdout empty, the log has its first 8; `/clear` replaces it, agentStartedAt stays', async () => {
    const sid1 = '0f3c2a9e-6b1d-4c8e-9a7f-1d2e3f4a5b6c'
    const sid2 = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d'
    manager.create({ id: 'hk-sid', ...TAB, workspaceId: 'ws', customEnv: { BAT_TOWER_TERMINAL_ID: 'hk-tower' } })
    manager.setBlockedDetection('hk-sid', 'hook')
    const input = (sessionId: string, source: string) => ({
      session_id: sessionId, hook_event_name: 'SessionStart', source, model: 'SECRET-MODEL', transcript_path: '/SECRET/path.jsonl', cwd: '/SECRET-CWD',
    })
    const run = await runHook('session-start', JSON.stringify(input(sid1, 'startup')), hookEnv('hk-sid'))
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.ms).toBeLessThan(2_000)
    expect(received.at(-1)).toEqual([{ event: 'session-start', sessionId: sid1 }])
    expect(manager.getClaudeSessionId('hk-sid')).toBe(sid1)
    const startedAt = manager.getAgentStartedAt('hk-sid')
    expect(await runHook('session-start', JSON.stringify(input(sid2, 'clear')), hookEnv('hk-sid'))).toMatchObject({ code: 0, stdout: '' })
    expect(manager.getClaudeSessionId('hk-sid')).toBe(sid2)
    expect(manager.getAgentStartedAt('hk-sid')).toBe(startedAt)
    expect(JSON.stringify(received)).not.toMatch(/SECRET|startup|"clear"|batcap/)
    const log = fs.readFileSync(path.join(logDir, 'bat-scripts.log'), 'utf8')
    const hookLines = log.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook' && e.terminalId === 'hk-sid')
    expect(hookLines.map(e => e.session)).toEqual(['0f3c2a9e', 'a1b2c3d4'])
    expect(log).not.toContain(sid1)
    expect(log).not.toContain(sid2)
    // not a UUID: not sent; the id stays
    await runHook('session-start', JSON.stringify(input('not-a-uuid', 'resume')), hookEnv('hk-sid'))
    expect(received.at(-1)).toEqual([{ event: 'session-start' }])
    expect(manager.getClaudeSessionId('hk-sid')).toBe(sid2)
    // a BAT before T0642 ignores the field: exit 0, nothing on stdout, nothing recorded
    t0600Bat = true
    try {
      expect(await runHook('session-start', JSON.stringify(input(sid1, 'compact')), hookEnv('hk-sid'))).toMatchObject({ code: 0, stdout: '' })
    } finally {
      t0600Bat = false
    }
    expect(manager.getClaudeSessionId('hk-sid')).toBe(sid2)
    // a BAT refusing the whole report (older than T0600): still exit 0
    oldBat = true
    try {
      expect(await runHook('session-start', JSON.stringify(input(sid1, 'startup')), hookEnv('hk-sid'))).toMatchObject({ code: 0, stdout: '' })
    } finally {
      oldBat = false
    }
    // the tower's query
    const { invokeHandler } = await import('../remote/handler-registry')
    const towerHelper = { terminalId: 'hk-tower', role: 'tower' as const }
    expect(await invokeHandler('terminal:get-state', [{ terminalId: 'hk-sid' }], null, 'tw', towerHelper)).toMatchObject({ ok: true, claudeSessionId: sid2 })
    manager.kill('hk-sid')
  })
})

// ── T0600 (D154): agentStarted ──

describe('agentStarted (T0600)', () => {
  it('tracker: the first session-start is `started`, later ones `unchanged`; blocked untouched; logged once', () => {
    const lines: string[] = []
    let t = 1000
    const tracker = new TerminalBlockedTracker({ log: m => lines.push(m) }, () => t)
    expect(tracker.getStartedAt('a')).toBeNull()
    expect(tracker.report('a', 'session-start')).toEqual({ result: 'started', state: null })
    expect(tracker.getDetection('a')).toBe('hook')
    expect(tracker.getStartedAt('a')).toBe(1000)
    t = 2000
    tracker.report('a', 'ask-user-question')
    // a resume / clear / compact SessionStart neither moves the time nor clears the question
    expect(tracker.report('a', 'session-start')).toEqual({ result: 'unchanged', state: { reason: 'question', since: 2000, event: 'ask-user-question' } })
    expect(tracker.getStartedAt('a')).toBe(1000)
    expect(tracker.get('a')).toMatchObject({ reason: 'question' })
    expect(isStartReportEvent('session-start')).toBe(true)
    expect(isStartReportEvent('stop')).toBe(false)
    expect(lines).toEqual([
      '[agent-start] terminal=a → started (hook session-start)',
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
    ])
    tracker.clearStarted('a')
    expect(tracker.getStartedAt('a')).toBeNull()
    tracker.report('b', 'session-start')
    tracker.clearAll('Terminal Server recovery')
    expect(tracker.getStartedAt('b')).toBeNull()
  })

  it('PtyManager: needs a running PTY; user input keeps it; kill / exit / restart clear it; the exited record keeps the time; recovery clears all', () => {
    const { manager, create, exit } = makeManager()
    expect(manager.reportHookEvent('a', 'session-start')).toBeNull()
    create('a')
    expect(manager.getAgentStartedAt('a')).toBeNull()
    expect(manager.reportHookEvent('a', 'session-start')).toMatchObject({ result: 'started' })
    const at = manager.getAgentStartedAt('a')
    expect(at).toEqual(expect.any(Number))
    manager.noteUserInput('a')
    expect(manager.getAgentStartedAt('a')).toBe(at)
    expect(logs).toContain('[agent-start] terminal=a → started (hook session-start)')
    exit('a', 1)
    expect(manager.getAgentStartedAt('a')).toBeNull()
    expect(manager.getExitedPty('a')).toMatchObject({ agentStartedAt: at, exitCode: 1 })

    create('b')
    manager.reportHookEvent('b', 'session-start')
    manager.kill('b')
    expect(manager.getExitedPty('b')?.agentStartedAt).toEqual(expect.any(Number))
    create('c')
    expect(manager.getExitedPty('c')).toBeNull()
    create('d')
    expect(manager.getExitedPty('d')).toBeNull()
    manager.reportHookEvent('d', 'session-start')
    expect(manager.restart('d', CWD, '/bin/sh')).toBe(true)
    expect(manager.getAgentStartedAt('d')).toBeNull() // the new shell runs no claude yet
    // not started before it ended: no field on the record
    exit('c')
    expect(manager.getExitedPty('c')).not.toHaveProperty('agentStartedAt')
  })

  it('PtyManager: the Terminal Server recovery clears agentStarted (source)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'pty-manager.ts'), 'utf8')
    const recovery = src.slice(src.indexOf('Terminal Server died — attempting recovery'))
    expect(recovery.indexOf("this.blockedTracker.clearAll('Terminal Server recovery')")).toBeGreaterThan(0)
    const tracker = fs.readFileSync(path.resolve(__dirname, '..', 'terminal-blocked-state.ts'), 'utf8')
    expect(tracker).toMatch(/clearAll\(cause: string\): void \{[\s\S]*?this\.started\.clear\(\)/)
  })
})

describe('query handlers: agentStarted (T0600)', () => {
  let h: ReturnType<typeof setupHandlers>
  let queries: TerminalQueryHandlers | null = null
  afterEach(() => { queries?.dispose(); queries = null })

  function scene() {
    h = setupHandlers()
    queries = h.queries
    h.create('tw', { workspaceId: 'ws' })
    h.create('wk', { workspaceId: 'ws', towerId: 'tw' })
    h.create('cx', { workspaceId: 'ws', towerId: 'tw' })
    h.manager.setTerminalRole('tw', 'tower')
    h.manager.setBlockedDetection('wk', 'hook')
    h.manager.setBlockedDetection('cx', 'none') // a codex Worker
  }

  it('get-state / list: false before SessionStart, true + agentStartedAt after, null for a none tab; exited keeps it', () => {
    scene()
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ agentStarted: false, blockedDetection: 'hook' })
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).not.toHaveProperty('agentStartedAt')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'cx' })).toMatchObject({ agentStarted: null, blockedDetection: 'none' })
    expect(h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start' })).toEqual({ ok: true, terminalId: 'wk', result: 'started', state: 'not-blocked' })
    const at = h.manager.getAgentStartedAt('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ agentStarted: true, agentStartedAt: at })
    // blocked answers carry it too
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'permission-request', toolName: 'Bash' })
    expect(h.call('terminal:get-state', h.asHelper('wk'))).toMatchObject({ state: 'blocked', agentStarted: true, agentStartedAt: at })
    const r = h.call('terminal:list', h.asHelper('tw')) as { terminals: Array<Record<string, unknown>> }
    expect(r.terminals.find(t => t.id === 'wk')).toMatchObject({ agentStarted: true })
    expect(r.terminals.find(t => t.id === 'cx')).toMatchObject({ agentStarted: null })
    expect(r.terminals.find(t => t.id === 'tw')).toMatchObject({ agentStarted: null })
    h.manager.kill('wk')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ state: 'exited', agentStarted: true, agentStartedAt: at })
    h.manager.kill('cx')
    expect(h.call('terminal:get-state', h.asHelper('tw'), { terminalId: 'cx' })).toMatchObject({ state: 'exited', agentStarted: null })
  })

  it('wait until=agent-started: returns on SessionStart; at once for a none tab or one already started; on exit; times out with changed=false', async () => {
    vi.useFakeTimers()
    scene()
    const pending = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'agent-started', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(500)
    h.call('terminal:report-hook', h.asHelper('wk'), { event: 'session-start' })
    await vi.advanceTimersByTimeAsync(300)
    expect(await pending).toMatchObject({ ok: true, changed: true, agentStarted: true, agentStartedAt: expect.any(Number) })
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'agent-started' })).toMatchObject({ changed: true, agentStarted: true })
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'cx', until: 'agent-started' })).toMatchObject({ changed: true, agentStarted: null })

    h.create('w2', { workspaceId: 'ws', towerId: 'tw' })
    h.manager.setBlockedDetection('w2', 'hook')
    expect(h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'w2', until: 'agent-started', timeoutMs: 0 })).toMatchObject({ changed: false, agentStarted: false })
    const timedOut = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'w2', until: 'agent-started', timeoutMs: 1_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(1_100)
    expect(await timedOut).toMatchObject({ changed: false, agentStarted: false })
    const ended = h.call('terminal:wait', h.asHelper('tw'), { terminalId: 'w2', until: 'agent-started', timeoutMs: 10_000 }) as Promise<Record<string, unknown>>
    await vi.advanceTimersByTimeAsync(500)
    h.exit('w2', 1)
    await vi.advanceTimersByTimeAsync(300)
    expect(await ended).toMatchObject({ changed: true, state: 'exited', agentStarted: false })
    // the scope is unchanged: a worker may not wait on its tower (output access)
    expect(h.call('terminal:wait', h.asHelper('wk'), { terminalId: 'tw', until: 'agent-started' })).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })
})

describe('launch-suspect log (T0600 option B)', () => {
  it('watcher: bash / cmd / pwsh messages within the window, across chunks and colors; once; never the output', () => {
    const lines: string[] = []
    let t = 0
    const w = new LaunchSuspectWatcher({ log: m => lines.push(m) }, () => t)
    w.output('x', 'bash: claude: command not found\r\n') // not watched
    expect(lines).toEqual([])
    w.watch('a')
    t = 120
    w.output('a', 'PS C:\\w> claude --x\r\n\x1b[31;1mclaude: The term \'claude\' is not rec')
    w.output('a', 'ognized as a name of a cmdlet, function, script file, or executable program.\x1b[0m\r\n')
    expect(lines).toEqual(['[agent-command] launch-suspect terminal=a pattern="is not recognized as" after=120ms'])
    w.output('a', 'bash: claude: command not found\r\n')
    expect(lines).toHaveLength(1) // once per dispatch
    expect(w.isWatching('a')).toBe(false)

    w.watch('b')
    w.output('b', 'CategoryInfo : ObjectNotFound: (claude:String) [], CommandNotFoundException\r\n')
    w.watch('c')
    w.output('c', 'zsh: command not found: claude\r\n')
    expect(lines.slice(1)).toEqual([
      '[agent-command] launch-suspect terminal=b pattern="CommandNotFoundException" after=0ms',
      '[agent-command] launch-suspect terminal=c pattern="command not found" after=0ms',
    ])
    expect(lines.join('\n')).not.toContain('claude:')

    // claude starting normally; then past the window nothing is looked at
    w.watch('d')
    w.output('d', '\x1b[?25l Claude Code v2.1.300 \r\n')
    t += LAUNCH_SUSPECT_WINDOW_MS + 1
    w.output('d', 'bash: foo: command not found\r\n')
    expect(lines).toHaveLength(3)
    expect(w.isWatching('d')).toBe(false)
    w.watch('e')
    w.clear('e')
    w.output('e', 'command not found')
    expect(lines).toHaveLength(3)
  })

  it('PtyManager: watched from writeDispatchCommand only; logged from its output; the PTY ending stops it', () => {
    const { manager, create, output } = makeManager()
    create('a')
    output('a', 'bash: x: command not found\r\n') // a tab without a dispatch command
    expect(logs.some(l => l.includes('launch-suspect'))).toBe(false)
    manager.writeDispatchCommand('a', 'claude /ct-exec T0600\r')
    output('a', 'bash: claude: command not found\r\n')
    expect(logs.filter(l => l.startsWith('[agent-command] launch-suspect terminal=a pattern="command not found"'))).toHaveLength(1)
    // nothing else changes
    expect(manager.getBlockedState('a')).toBeNull()
    expect(manager.getAgentStartedAt('a')).toBeNull()
    create('b')
    manager.writeDispatchCommand('b', 'claude\r')
    manager.kill('b')
    manager.writeDispatchCommand('gone', 'claude\r') // no PTY: not watched
    expect(logs.filter(l => l.includes('launch-suspect'))).toHaveLength(1)
  })
})
