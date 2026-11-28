// @vitest-environment node
/**
 * T0965 / BUG-236 (U-59：A): an inbox answer to a contract-2 Tower whose AskUserQuestion menu is open went
 * into the menu as keys (the reported case: a click in the tab cleared `question` 5 s before the answer,
 * the menu stayed open, the answer was "sent" and the menu ended as 放棄). Now:
 *
 *   - the tracker keeps the menu (`hasOpenQuestionMenu`) past a clear by the user's input / a mouse press;
 *     only the hooks that say it is gone, the user's lone Esc / Ctrl+C, BAT's Esc, the PTY end close it
 *   - an answer is held while the tab is `question` or the menu may be open; with no draft, no input /
 *     click for NOTIFY_HOLD_MENU_INPUT_QUIET_MS and quiet output, BAT writes one Esc (not user input), the
 *     PTY's redraw closes the menu, and the answer goes after NOTIFY_HOLD_QUIET_MS
 *   - no redraw within NOTIFY_HOLD_MENU_ESC_MAX_MS → the answer stays held, never a second Esc
 *   - unchanged: `permission` / `elicitation` / `input`, Worker notifications, non-contract-2 tabs
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import {
  NOTIFY_HOLD_ENTER_DELAY_MS,
  NOTIFY_HOLD_MENU_ESC_MAX_MS,
  NOTIFY_HOLD_MENU_INPUT_QUIET_MS,
  NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS,
  NOTIFY_HOLD_QUIET_MS,
  NotifyHoldController,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { TerminalBlockedTracker, type BlockedDetection, type BlockedState } from '../terminal-blocked-state'

const ESC = '\x1b'
const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const LOCAL: HandlerContext = { windowId: 'win-1' }
/** A left-button press, SGR encoding (what xterm writes for a click while claude tracks the mouse). */
const CLICK = '\x1b[<0;12;7M\x1b[<0;12;7m'

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  menus = new Set<string>()
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  lastOutput: number | null = null
  closed: string[] = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(): BlockedDetection { return 'hook' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return { ok: true }
  }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.role.get(id) === 'tower' ? this.contract.get(id) : undefined }
  hasOpenQuestionMenu(id: string): boolean { return this.menus.has(id) }
  closeQuestionMenu(id: string, cause: string): boolean {
    this.closed.push(cause)
    const had = this.menus.delete(id)
    if (this.blocked.get(id)?.reason === 'question') {
      this.blocked.delete(id)
      return true
    }
    return had
  }
  getLastOutputAt(): number | null { return this.lastOutput }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); return true },
    logger: { log: (m) => { lines.push(m) } },
    now: () => Date.now(), // the fake timers' clock
  })
  /** claude's AskUserQuestion menu is shown (both hooks applied). */
  const menu = () => {
    pm.blocked.set('tower', { reason: 'question', since: Date.now(), event: 'ask-user-question' })
    pm.menus.add('tower')
    controller.onBlockedChange('tower')
  }
  /** The PTY wrote output (claude redrew). */
  const output = (data = 'redraw') => {
    pm.lastOutput = Date.now()
    controller.onPtyOutput('tower', data)
  }
  const escs = () => pm.writes.filter(([, d]) => d === ESC).length
  const texts = () => pm.writes.filter(([, d]) => d !== ESC).map(([, d]) => d)
  return { pm, controller, lines, keypresses, menu, output, escs, texts }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('BUG-236: an answer to an open AskUserQuestion menu', () => {
  it('`question`: held, one Esc, the redraw closes the menu, then the text and its Enter', async () => {
    const s = setup()
    s.menu()
    expect(s.controller.enqueueAnswer('tower', 'U-57：A')).toMatchObject({ ok: true, held: true })
    expect(s.escs()).toBe(1)
    expect(s.texts()).toEqual([])
    s.output()
    expect(s.pm.closed).toEqual(['BAT Esc'])
    expect(s.pm.blocked.has('tower')).toBe(false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS - 1)
    expect(s.texts()).toEqual([])
    await vi.advanceTimersByTimeAsync(1 + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.texts()).toEqual(['U-57：A'])
    expect(s.keypresses).toEqual([expect.objectContaining({ source: 'answer', userInput: true })])
    expect(s.escs()).toBe(1)
    expect(s.controller.count('tower')).toBe(0)
    expect(s.lines).toContain('[notify-hold] menu esc terminal=tower holdId=h-1 (question)')
  })

  it('no redraw after the Esc: the text is never written, no second Esc, logged; the user answering in the tab lets it go', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'U-57：A')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_MENU_ESC_MAX_MS + 10)
    expect(s.lines.some(l => l.startsWith('[notify-hold] menu esc no effect terminal=tower holdId=h-1'))).toBe(true)
    s.controller.onBlockedChange('tower')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.escs()).toBe(1)
    expect(s.texts()).toEqual([])
    expect(s.controller.count('tower')).toBe(1)
    // output now does not count as the Esc's answer
    s.output()
    expect(s.pm.closed).toEqual([])
    // the user answers in the terminal: the hooks close the menu → the answer goes as before
    s.pm.blocked.delete('tower')
    s.pm.menus.delete('tower')
    s.controller.onBlockedChange('tower')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.texts()).toEqual(['U-57：A'])
  })

  it('the reported case: `question` already cleared by a click, the menu still open → held (sent at once before the fix), Esc, then sent', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower') // the click cleared `question`; the menu record stays
    s.controller.onMousePress('tower')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.controller.enqueueAnswer('tower', 'U-57：A')).toMatchObject({ ok: true, held: true })
    expect(s.texts()).toEqual([])
    expect(s.controller.list('tower')[0]).toMatchObject({ reason: 'question' })
    expect(s.escs()).toBe(1)
    expect(s.lines).toContain('[notify-hold] menu esc terminal=tower holdId=h-1 (menu still open)')
    s.output()
    expect(s.pm.menus.has('tower')).toBe(false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.texts()).toEqual(['U-57：A'])
  })

  it('a click / a key in the tab less than NOTIFY_HOLD_MENU_INPUT_QUIET_MS ago: the Esc waits', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower') // the click cleared `question`
    s.controller.onMousePress('tower')
    s.controller.enqueueAnswer('tower', 'U-1：A')
    expect(s.escs()).toBe(0)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_MENU_INPUT_QUIET_MS - 500)
    // ↓ in the menu (pty.ts asks isPromptShown first): a menu key, not a draft
    s.controller.onUserInput('tower', '\x1b[B', { duringPrompt: s.controller.isPromptShown('tower') })
    expect(s.controller.hasDraft('tower')).toBe(false)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_MENU_INPUT_QUIET_MS - 1)
    expect(s.escs()).toBe(0)
    await vi.advanceTimersByTimeAsync(2)
    expect(s.escs()).toBe(1)
    expect(s.lines.filter(l => l.startsWith('[notify-hold] menu esc waits'))).toEqual(['[notify-hold] menu esc waits terminal=tower holdId=h-1 (input)'])
  })

  it('output less than NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS ago: the Esc waits for the quiet', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower')
    s.output('spinner')
    s.controller.enqueueAnswer('tower', 'U-1：A')
    expect(s.escs()).toBe(0)
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_MENU_OUTPUT_QUIET_MS + 1)
    expect(s.escs()).toBe(1)
  })

  it('a draft (the menu\'s text field): no Esc; held', async () => {
    const s = setup()
    s.menu()
    s.pm.blocked.delete('tower')
    s.controller.onUserInput('tower', 'my own words')
    s.controller.enqueueAnswer('tower', 'U-1：A')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.escs()).toBe(0)
    expect(s.texts()).toEqual([])
    expect(s.controller.count('tower')).toBe(1)
  })

  it.each(['permission', 'elicitation', 'input'] as const)('`%s`: the answer is held as before — no Esc', async (reason) => {
    const s = setup()
    s.pm.blocked.set('tower', { reason, since: 1 })
    expect(s.controller.enqueueAnswer('tower', 'U-1：A')).toMatchObject({ ok: true, held: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('a Worker notification to the menu: held as before — no Esc (also behind it, an answer waits)', async () => {
    const s = setup()
    s.menu()
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual({ ok: true, held: true })
    s.controller.enqueueAnswer('tower', 'U-1：A')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  // T0968 changed this case by the Tower's ruling (Q-3, D492): before, it passed through (`{ ok: true }`,
  // written at once); now a contract-2 Tower's Worker notification is held by the menu record alone too
  it('a Worker notification with only the menu record (no `question`): held (T0968, Tower ruling D492), no Esc, sent once the record closes', async () => {
    const s = setup()
    s.pm.menus.add('tower')
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual({ ok: true, held: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
    s.pm.menus.delete('tower')
    s.controller.onBlockedChange('tower')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + 10)
    expect(s.pm.writes).toEqual([['tower', 'T0001 完成']])
    expect(s.escs()).toBe(0)
  })

  it('not a contract-2 Tower: no answer is taken, a Worker notification is held as before, no Esc', async () => {
    const s = setup()
    s.pm.contract.set('tower', 1)
    s.menu()
    expect(s.controller.enqueueAnswer('tower', 'U-1：A')).toEqual({ ok: false, reason: 'not-contract-tower' })
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual({ ok: true, held: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('「立即送出」: releases an answer held by the menu record alone, not one held by `question`', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'U-1：A')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_MENU_ESC_MAX_MS + 10) // the Esc had no effect
    s.controller.sendNow('tower')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.texts()).toEqual([])
    s.pm.blocked.delete('tower') // only the record left (stale)
    s.controller.onBlockedChange('tower')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.texts()).toEqual(['U-1：A'])
    expect(s.escs()).toBe(1)
  })

  it('a fake manager without the menu methods (older hosts): `question` holds as before, no Esc', async () => {
    const s = setup()
    Object.defineProperty(s.pm, 'closeQuestionMenu', { value: undefined })
    s.pm.blocked.set('tower', { reason: 'question', since: 1 })
    expect(s.controller.enqueueAnswer('tower', 'U-1：A')).toMatchObject({ ok: true, held: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.pm.writes).toEqual([])
  })

  it('logs ids only — never the answer text', async () => {
    const s = setup()
    s.menu()
    s.controller.enqueueAnswer('tower', 'U-57：secret-choice')
    s.output()
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.lines.join('\n')).not.toContain('secret-choice')
  })
})

describe('TerminalBlockedTracker: the AskUserQuestion menu record', () => {
  const tracker = () => new TerminalBlockedTracker(undefined, () => 1)

  it('opened by `question`; outlives the user\'s input and a mouse press; `blocked` itself is unchanged', () => {
    const t = tracker()
    t.report('p', 'ask-user-question')
    t.report('p', 'permission-request', 'AskUserQuestion')
    expect(t.hasOpenQuestionMenu('p')).toBe(true)
    expect(t.clearForMousePress('p')).toBe(true)
    expect(t.get('p')).toBeNull()
    expect(t.hasOpenQuestionMenu('p')).toBe(true)
    t.clearForUserInput('p', '\x1b[B')
    expect(t.hasOpenQuestionMenu('p')).toBe(true)
  })

  it.each([
    ['ask-user-question-done', undefined],
    ['stop', undefined],
    ['user-prompt-submit', undefined],
    ['post-tool-batch', undefined],
  ] as const)('closed by %s', (event, agentId) => {
    const t = tracker()
    t.report('p', 'ask-user-question')
    t.clearForUserInput('p', '1')
    t.report('p', event, undefined, undefined, agentId)
    expect(t.hasOpenQuestionMenu('p')).toBe(false)
  })

  it('not closed by a sub-agent\'s post-tool-batch, a permission prompt, an elicitation, a late hook (`at` earlier)', () => {
    const t = tracker()
    t.report('p', 'ask-user-question', undefined, undefined, undefined, 100n)
    t.report('p', 'post-tool-batch', undefined, undefined, 'agent-1')
    t.report('p', 'permission-request', 'Bash')
    t.report('p', 'elicitation')
    t.report('p', 'user-prompt-submit', undefined, undefined, undefined, 50n)
    expect(t.hasOpenQuestionMenu('p')).toBe(true)
  })

  it('closed by the user\'s lone Esc / Ctrl+C (logged), not by an arrow key', () => {
    const lines: string[] = []
    const t = new TerminalBlockedTracker({ log: m => { lines.push(m) } }, () => 1)
    t.report('p', 'ask-user-question')
    t.clearForUserInput('p', '\x1b[A')
    expect(t.hasOpenQuestionMenu('p')).toBe(true)
    t.clearForUserInput('p', ESC)
    expect(t.hasOpenQuestionMenu('p')).toBe(false)
    expect(lines).toContain('[blocked] terminal=p question menu closed (user Esc)')
    t.report('p', 'ask-user-question')
    t.clearForUserInput('p', '\x03')
    expect(t.hasOpenQuestionMenu('p')).toBe(false)
  })

  it('closeQuestionMenu (BAT\'s Esc): the record and a `question` still set go; the late second hook does not set it back (T0926)', () => {
    const t = tracker()
    t.report('p', 'ask-user-question')
    expect(t.closeQuestionMenu('p', 'BAT Esc')).toBe(true)
    expect(t.get('p')).toBeNull()
    expect(t.hasOpenQuestionMenu('p')).toBe(false)
    t.report('p', 'permission-request', 'AskUserQuestion')
    expect(t.get('p')).toBeNull()
    expect(t.closeQuestionMenu('p', 'BAT Esc')).toBe(false)
  })

  it('the PTY ending and the recovery drop it', () => {
    const t = tracker()
    t.report('p', 'ask-user-question')
    t.clearStarted('p')
    expect(t.hasOpenQuestionMenu('p')).toBe(false)
    t.report('q', 'ask-user-question')
    t.clearAll('Terminal Server recovery')
    expect(t.hasOpenQuestionMenu('q')).toBe(false)
  })

  it('codex OSC never opens it', () => {
    const t = tracker()
    t.observeCodexState('c', 'blocked')
    expect(t.hasOpenQuestionMenu('c')).toBe(false)
  })
})

// ── the reported sequence, real PtyManager + TerminalBlockedTracker + pty:write handler ──

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

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ registerPtyHandlers } = await import('../handlers/pty'))
})

describe('BUG-236 end to end: real PtyManager', () => {
  let dataDir: string
  const managers: PtyManagerType[] = []
  const logs: string[] = []

  beforeEach(() => {
    logs.length = 0
    vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0965-menu-'))
  })

  afterEach(() => {
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function setup(contract = 2) {
    let hold: NotifyHoldController | null = null
    const keypresses: NotifyHoldKeypress[] = []
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperEnv: () => ({}),
      onBlockedChange: id => hold?.onBlockedChange(id),
      onPtyOutput: (id, data) => hold?.onPtyOutput(id, data),
      onPtyExit: id => hold?.onPtyExit(id),
    })
    managers.push(manager)
    hold = new NotifyHoldController({
      getPtyManager: () => manager,
      emitKeypress: payload => { keypresses.push(payload); return true },
      logger,
      now: () => Date.now(),
    })
    expect(manager.create({ id: 'tower', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
    const fake = ptySpawn.mock.results.at(-1)!.value as FakePty
    const onData = fake.onData.mock.calls[0][0] as (data: string) => void
    manager.setBlockedDetection('tower', 'hook')
    manager.setTerminalRole('tower', 'tower', undefined, contract)
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    registerPtyHandlers((channel: string, handler: unknown) => { handlers.set(channel, handler as never) }, {
      getPtyManager: () => manager,
      notifyHold: hold,
    })
    const write = (ctx: HandlerContext, data: string) => handlers.get('pty:write')!(ctx, 'tower', data)
    const written = () => fake.write.mock.calls.map(c => c[0] as string)
    return { manager, hold: hold!, fake, onData, write, written, keypresses }
  }

  it('AskUserQuestion, a click 5 s before, the answer from the inbox: held, Esc (not user input), the redraw, then the answer', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'ask-user-question')
    s.manager.reportHookEvent('tower', 'permission-request', 'AskUserQuestion')
    await vi.advanceTimersByTimeAsync(4_000)
    await s.write(LOCAL, CLICK) // the click (focus regain / in the menu) — `blocked` clears (T0757)
    expect(s.manager.getBlockedState('tower')).toBeNull()
    expect(s.manager.hasOpenQuestionMenu('tower')).toBe(true)
    const inputBefore = s.manager.getLastUserInputAt('tower')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.hold.enqueueAnswer('tower', 'U-57：A')).toMatchObject({ ok: true, held: true })
    expect(s.written()).not.toContain('U-57：A')
    expect(s.written().at(-1)).toBe(ESC)
    expect(s.manager.getLastUserInputAt('tower')).toBe(inputBefore) // BAT's Esc is not the user's input
    s.onData('\x1b[2J interrupted') // claude closed the menu
    expect(s.manager.hasOpenQuestionMenu('tower')).toBe(false)
    expect(logs).toContain('[blocked] terminal=tower question menu closed (BAT Esc)')
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS + 10)
    expect(s.written().filter(d => d === 'U-57：A')).toHaveLength(1)
    expect(s.written().filter(d => d === ESC)).toHaveLength(1)
    expect(s.keypresses).toEqual([expect.objectContaining({ source: 'answer', userInput: true })])
  })

  it('the user answered in the menu (the PostToolUse hook came): the answer goes as before, no Esc', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'ask-user-question')
    await s.write(LOCAL, '1')
    s.manager.reportHookEvent('tower', 'ask-user-question-done')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(s.hold.enqueueAnswer('tower', 'U-57：A')).toMatchObject({ ok: true, held: false })
    expect(s.written()).toContain('U-57：A')
    expect(s.written()).not.toContain(ESC)
  })

  it('the user dismissed the menu with Esc: the answer goes as before, no Esc of BAT', async () => {
    const s = setup()
    s.manager.reportHookEvent('tower', 'ask-user-question')
    await s.write(LOCAL, ESC)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(s.hold.enqueueAnswer('tower', 'U-57：A')).toMatchObject({ ok: true, held: false })
    expect(s.written().filter(d => d === ESC)).toHaveLength(1) // the user's own
  })
})
