// @vitest-environment node
/**
 * T0918 / BUG-222: claude asks for several permission prompts of one batch at once ("2 of 3", "3 of 3";
 * claude 2.1.331 runs every queued prompt's `PermissionRequest` hook before the user answered the first,
 * T0915 M-C5). Answering the first must not clear `blocked` while the others are still open.
 *
 *   - TerminalBlockedTracker: each prompt counts (`getOpenPermissionPrompts`); with 2 or more open the
 *     user's input and a mouse press keep the state (logged once per count); `post-tool-batch` ends the
 *     prompts of its agent that happened before it, a later prompt (the agent's next batch) stays;
 *     `stop` / `user-prompt-submit` / `clear` end all; one prompt: input / press clear as before
 *   - out of order / late: a batch reported after the next batch's prompts, without `at` (an older hook),
 *     several agents, more than PERMISSION_AGENTS_MAX agents, the per-agent bound
 *   - `pty:write` (a local window): the first answer keeps the tab blocked and is still user input
 *   - NotifyHoldController (T0788): a Worker's submit after the first answer is still held; the batch
 *     ending releases it
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-blocked-state / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import { NOTIFY_HOLD_ENTER_DELAY_MS, NOTIFY_HOLD_QUIET_MS, NotifyHoldController } from '../notify-hold'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { registerTerminalHandlers as RegisterTerminalHandlers } from '../handlers/terminal'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import {
  PERMISSION_AGENTS_MAX,
  PERMISSION_PROMPTS_PER_AGENT_MAX,
  QUEUED_PERMISSION_PROMPTS_MIN,
  TerminalBlockedTracker,
} from '../terminal-blocked-state'

const sgrPress = '\x1b[<0;12;7M\x1b[<0;12;7m'

function makeTracker() {
  const lines: string[] = []
  const changed: string[] = []
  const tracker = new TerminalBlockedTracker({ log: m => { lines.push(m) } }, () => 1000, id => { changed.push(id) })
  return { tracker, lines, changed }
}

describe('TerminalBlockedTracker: queued permission prompts (T0918 / BUG-222)', () => {
  it('BUG-222 timeline: 3 prompts, the first answered by key → still blocked; the batch ending clears', () => {
    const { tracker, lines } = makeTracker()
    expect(QUEUED_PERMISSION_PROMPTS_MIN).toBe(2)
    // T0915 M-C5: Bash + 2 Read of one batch, hooks ~0.7 s apart, all before the answer
    expect(tracker.report('a', 'permission-request', 'Bash', undefined, undefined, 1_000n).result).toBe('blocked')
    expect(tracker.report('a', 'permission-request', 'Read', undefined, undefined, 1_700n).result).toBe('unchanged')
    expect(tracker.report('a', 'permission-request', 'Read', undefined, undefined, 2_500n).result).toBe('unchanged')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(3)
    // the user answers "1 of 3", then "2 of 3" (each with a few keys)
    for (let i = 0; i < 4; i++) expect(tracker.clearForUserInput('a')).toBe(false)
    expect(tracker.get('a')).toMatchObject({ reason: 'permission', toolName: 'Bash', since: 1000 })
    // the batch resolved (all three answered, the tools ran): cleared
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, 9_000n)).toEqual({ result: 'cleared', state: null })
    expect(tracker.getOpenPermissionPrompts('a')).toBe(0)
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a kept: user input while 3 permission prompts are open (cleared by their tool batch, the turn\'s end or the next prompt)',
      '[blocked] terminal=a → cleared (hook post-tool-batch)',
    ])
  })

  it('a mouse press (T0757) follows the same rule: kept with 2+ open, clears a single prompt', () => {
    const { tracker, lines } = makeTracker()
    tracker.report('a', 'permission-request', 'Read')
    tracker.report('a', 'permission-request', 'Read')
    expect(tracker.clearForMousePress('a')).toBe(false)
    expect(tracker.get('a')).toMatchObject({ reason: 'permission' })
    expect(lines).toContain('[blocked] terminal=a kept: mouse press while 2 permission prompts are open (cleared by their tool batch, the turn\'s end or the next prompt)')
    tracker.report('b', 'permission-request', 'Bash')
    expect(tracker.clearForMousePress('b')).toBe(true)
    expect(lines).toContain('[blocked] terminal=b → cleared (mouse press)')
  })

  it('one prompt: user input / a press clear exactly as before T0918 (no new log line)', () => {
    const { tracker, lines, changed } = makeTracker()
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(1)
    expect(tracker.clearForUserInput('a')).toBe(true)
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.clearForMousePress('a')).toBe(true)
    // a question / an elicitation is never counted
    tracker.report('a', 'ask-user-question')
    tracker.report('a', 'permission-request', 'AskUserQuestion')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(0)
    expect(tracker.clearForUserInput('a')).toBe(true)
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → cleared (user input)',
      '[blocked] terminal=a → blocked reason=permission (hook permission-request tool=Bash)',
      '[blocked] terminal=a → cleared (mouse press)',
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → cleared (user input)',
    ])
    expect(changed).toHaveLength(6)
  })

  it('stop / user-prompt-submit / clear (the PTY ending, recovery) end every queued prompt', () => {
    const { tracker } = makeTracker()
    for (const end of ['stop', 'user-prompt-submit'] as const) {
      tracker.report('a', 'permission-request', 'Bash', undefined, undefined, 100n)
      tracker.report('a', 'permission-request', 'Read', undefined, undefined, 200n)
      expect(tracker.report('a', end, undefined, undefined, undefined, 300n).result).toBe('cleared')
      expect(tracker.getOpenPermissionPrompts('a')).toBe(0)
    }
    tracker.report('a', 'permission-request', 'Bash')
    tracker.report('a', 'permission-request', 'Read')
    expect(tracker.clear('a', 'the PTY ended')).toBe(true)
    // the next prompt starts a new count: a single one clears by input again
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.clearForUserInput('a')).toBe(true)
  })

  it('another reason replaces the state and forgets the prompts; codex input too', () => {
    const { tracker } = makeTracker()
    tracker.report('a', 'permission-request', 'Bash')
    tracker.report('a', 'permission-request', 'Read')
    tracker.report('a', 'elicitation')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(0)
    expect(tracker.clearForUserInput('a')).toBe(true)
    tracker.report('a', 'permission-request', 'Bash')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(1)
    tracker.dispose()
    expect(tracker.getOpenPermissionPrompts('a')).toBe(0)
  })

  it('the kept line is logged once per open count, again after the state was left', () => {
    const { tracker, lines } = makeTracker()
    tracker.report('a', 'permission-request', 'Read')
    tracker.report('a', 'permission-request', 'Read')
    tracker.clearForUserInput('a')
    tracker.clearForUserInput('a')
    tracker.report('a', 'permission-request', 'Read')
    tracker.clearForMousePress('a')
    tracker.clearForUserInput('a')
    tracker.report('a', 'stop')
    tracker.report('a', 'permission-request', 'Read')
    tracker.report('a', 'permission-request', 'Read')
    tracker.clearForUserInput('a')
    expect(lines.filter(l => l.includes(' kept: '))).toEqual([
      '[blocked] terminal=a kept: user input while 2 permission prompts are open (cleared by their tool batch, the turn\'s end or the next prompt)',
      '[blocked] terminal=a kept: mouse press while 3 permission prompts are open (cleared by their tool batch, the turn\'s end or the next prompt)',
      '[blocked] terminal=a kept: user input while 2 permission prompts are open (cleared by their tool batch, the turn\'s end or the next prompt)',
    ])
  })
})

describe('TerminalBlockedTracker: queued prompts out of order (T0918 with T0657 / T0790)', () => {
  it('a batch ends the prompts before it; the agent’s next batch’s prompt stays (its batch reported late)', () => {
    const { tracker, lines } = makeTracker()
    // batch 1: two prompts; both answered, the tools ran, but its PostToolBatch (300) reaches BAT
    // after the next batch's prompt (500)
    tracker.report('a', 'permission-request', 'Read', undefined, undefined, 100n)
    tracker.report('a', 'permission-request', 'Read', undefined, undefined, 200n)
    tracker.report('a', 'permission-request', 'Bash', undefined, undefined, 500n)
    expect(tracker.getOpenPermissionPrompts('a')).toBe(3)
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, 300n)).toMatchObject({ result: 'unchanged', state: { reason: 'permission' } })
    expect(tracker.getOpenPermissionPrompts('a')).toBe(1)
    // one prompt left: answered by key as before
    expect(tracker.clearForUserInput('a')).toBe(true)
    expect(lines.some(l => l.includes('reported late'))).toBe(false)
  })

  it('a batch older than every open prompt of its agent: kept, logged as reported late (T0790 line)', () => {
    const { tracker, lines } = makeTracker()
    tracker.report('a', 'permission-request', 'Read', undefined, undefined, 500n)
    tracker.report('a', 'permission-request', 'Read', undefined, undefined, 600n)
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, 450n).result).toBe('unchanged')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(2)
    expect(lines).toContain('[blocked] terminal=a kept: hook post-tool-batch happened 0.0ms before the blocked state (reported late)')
    // at the same time as the newest prompt: it ended (T0790: equal clears)
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, 600n).result).toBe('cleared')
  })

  it('without `at` (an older hook script): any batch of the agent ends all its prompts', () => {
    const { tracker } = makeTracker()
    tracker.report('a', 'permission-request', 'Read')
    tracker.report('a', 'permission-request', 'Read', undefined, undefined, 900n)
    expect(tracker.clearForUserInput('a')).toBe(false)
    expect(tracker.report('a', 'post-tool-batch').result).toBe('cleared')
    // a prompt without `at` is ended by a batch with one
    tracker.report('b', 'permission-request', 'Read')
    tracker.report('b', 'permission-request', 'Read')
    expect(tracker.report('b', 'post-tool-batch', undefined, undefined, undefined, 5n).result).toBe('cleared')
  })

  it('several agents: a subagent’s and the main thread’s prompt — the main batch leaves one, input then clears it', () => {
    const { tracker } = makeTracker()
    tracker.report('a', 'permission-request', 'Bash', undefined, 'sub1', 100n)
    tracker.report('a', 'permission-request', 'Edit', undefined, undefined, 200n)
    expect(tracker.getOpenPermissionPrompts('a')).toBe(2)
    expect(tracker.clearForUserInput('a')).toBe(false) // which one was answered is unknown
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, 300n).result).toBe('unchanged')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(1)
    expect(tracker.clearForUserInput('a')).toBe(true)
  })

  it(`more than ${PERMISSION_AGENTS_MAX} agents: still counted (input kept), any batch clears`, () => {
    const { tracker } = makeTracker()
    for (let i = 0; i <= PERMISSION_AGENTS_MAX; i++) tracker.report('a', 'permission-request', 'Bash', undefined, `ag${i}`)
    tracker.report('a', 'permission-request', 'Bash', undefined, 'one-more')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(PERMISSION_AGENTS_MAX + 2)
    expect(tracker.clearForUserInput('a')).toBe(false)
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, 'stranger').result).toBe('cleared')
  })

  it(`one agent keeps at most ${PERMISSION_PROMPTS_PER_AGENT_MAX} prompts; more merge into the newest (still open)`, () => {
    const { tracker } = makeTracker()
    for (let i = 1; i <= PERMISSION_PROMPTS_PER_AGENT_MAX + 6; i++) tracker.report('a', 'permission-request', 'Read', undefined, undefined, BigInt(i * 10))
    expect(tracker.getOpenPermissionPrompts('a')).toBe(PERMISSION_PROMPTS_PER_AGENT_MAX)
    // the newest merged time counts: a batch before it leaves that one
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, BigInt((PERMISSION_PROMPTS_PER_AGENT_MAX + 5) * 10)).result).toBe('unchanged')
    expect(tracker.getOpenPermissionPrompts('a')).toBe(1)
    expect(tracker.report('a', 'post-tool-batch', undefined, undefined, undefined, BigInt((PERMISSION_PROMPTS_PER_AGENT_MAX + 6) * 10)).result).toBe('cleared')
  })
})

// ── wired: real PtyManager, the shared pty:write handler, NotifyHoldController ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
let PtyManager: typeof PtyManagerType
let registerPtyHandlers: typeof RegisterPtyHandlers
let registerTerminalHandlers: typeof RegisterTerminalHandlers

const LOCAL: HandlerContext = { windowId: 'win-1' }
const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const HELD = { ok: true, held: true }

describe('pty:write and the Worker notification hold with queued prompts (T0918 / BUG-222)', () => {
  let dataDir: string
  const managers: PtyManagerType[] = []
  const logs: string[] = []

  beforeAll(async () => {
    const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    ;({ PtyManager } = await import('../pty-manager'))
    ;({ registerPtyHandlers } = await import('../handlers/pty'))
    ;({ registerTerminalHandlers } = await import('../handlers/terminal'))
  })

  beforeEach(() => {
    logs.length = 0
    vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0918-queued-'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function setup() {
    const userInput: string[] = []
    const keypresses: unknown[] = []
    let hold: NotifyHoldController | null = null
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperEnv: () => ({}),
      onBlockedChange: id => hold?.onBlockedChange(id),
      onPtyExit: id => hold?.onPtyExit(id),
    })
    managers.push(manager)
    hold = new NotifyHoldController({
      getPtyManager: () => manager,
      emitKeypress: payload => { keypresses.push(payload); return true },
      logger,
    })
    expect(manager.create({ id: 'tower', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const fake = ptySpawn.mock.results.at(-1)!.value as FakePty
    manager.setBlockedDetection('tower', 'hook')
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    const register = (channel: string, handler: unknown) => { handlers.set(channel, handler as never) }
    registerPtyHandlers(register, { getPtyManager: () => manager, onUserInput: id => { userInput.push(id) }, notifyHold: hold })
    registerTerminalHandlers(register, {
      getPtyManager: () => manager,
      emit: () => 1,
      readSettings: () => null,
      buildAgentPromptCommand: async () => null,
      existsSync: () => false,
      notifyHold: hold,
    })
    const write = (ctx: HandlerContext, data: string) => handlers.get('pty:write')!(ctx, 'tower', data)
    const keypress = (ctx: HandlerContext) => handlers.get('terminal:keypress')!(ctx, { targetId: 'tower', key: 'Enter', code: 'Enter', keyCode: 13, source: 'T0001', reason: 'submit', traceId: 'tr' })
    return { manager, fake, write, keypress, keypresses, userInput }
  }

  it('the first answer (a key, then a click) keeps the tab blocked; it is still user input; the batch clears', () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request', 'Bash', undefined, undefined, 1_000n)
    s.manager.reportHookEvent('tower', 'permission-request', 'Read', undefined, undefined, 1_700n)
    s.manager.reportHookEvent('tower', 'permission-request', 'Read', undefined, undefined, 2_500n)
    s.write(LOCAL, '1')
    expect(s.manager.getBlockedState('tower')).toMatchObject({ reason: 'permission' })
    expect(s.manager.getLastUserInputAt('tower')).not.toBeNull() // --close-worker / usage-limit: unchanged
    expect(s.userInput).toEqual(['tower'])
    s.write(LOCAL, sgrPress)
    expect(s.manager.getBlockedState('tower')).toMatchObject({ reason: 'permission' })
    expect(s.fake.write).toHaveBeenCalledTimes(2) // the user's answers reach claude
    expect(s.manager.reportHookEvent('tower', 'post-tool-batch', undefined, undefined, undefined, 9_000n)).toMatchObject({ result: 'cleared' })
    expect(logs).toContain('[blocked] terminal=tower → cleared (hook post-tool-batch)')
  })

  it('a Worker submit after the first answer is held (BUG-196 / T0788 still apply); the batch ending releases it', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request', 'Bash', undefined, undefined, 1_000n)
    s.manager.reportHookEvent('tower', 'permission-request', 'Read', undefined, undefined, 1_700n)
    s.write(LOCAL, '1') // "1 of 2" answered; "2 of 2" is on screen
    expect(await s.write(WORKER, 'T0001 完成')).toEqual(HELD)
    expect(await s.keypress(WORKER)).toEqual(HELD)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS * 3)
    expect(s.fake.write).not.toHaveBeenCalledWith('T0001 完成')
    expect(s.keypresses).toEqual([])
    // "2 of 2" answered, the tools ran: the batch clears, then the held notification goes out
    s.write(LOCAL, '1')
    s.manager.reportHookEvent('tower', 'post-tool-batch', undefined, undefined, undefined, 5_000n)
    expect(s.manager.getBlockedState('tower')).toBeNull()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.fake.write).toHaveBeenLastCalledWith('T0001 完成')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypresses).toHaveLength(1)
  })

  it('a single prompt: the answer clears and the held notification follows, as before T0918', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'permission-request', 'Bash')
    expect(await s.write(WORKER, 'T0001 完成')).toEqual(HELD)
    await s.keypress(WORKER)
    s.write(LOCAL, '1')
    expect(s.manager.getBlockedState('tower')).toBeNull()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS)
    expect(s.fake.write).toHaveBeenLastCalledWith('T0001 完成')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.keypresses).toHaveLength(1)
  })
})
