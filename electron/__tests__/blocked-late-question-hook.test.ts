// @vitest-environment node
/**
 * T0926 / BUG-224: the user answers an AskUserQuestion (Esc about 0.1 s after the dialog appeared)
 * before the prompt's second hook reported; that hook, reported late, must not set `question` back.
 *
 *   - BUG-224's order (T0923 log): `ask-user-question` → user input clears → `permission-request`
 *     tool=AskUserQuestion → stays cleared (fails before T0926: blocked again), logged `kept cleared`
 *   - the same with a mouse press (T0757) and with no `at` at all (an older hook script)
 *   - the reverse order: `permission-request` first, its `ask-user-question` late — ignored only with
 *     `at` on both sides and an earlier `at`
 *   - counter-examples, a real new prompt still blocks: the next AskUserQuestion after the answer
 *     (its `ask-user-question`, then its `permission-request`), a Bash permission prompt, an
 *     elicitation, a late hook past `ANSWERED_QUESTION_LATE_HOOK_MS`, the record used once, both
 *     hooks reported before the answer (nothing remembered), the PTY ending / recovery
 *   - typing again while not blocked keeps the record; permission prompts (T0918) are not affected
 *   - PtyManager: `noteUserInput` → late hook through `reportHookEvent` stays cleared
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
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { ANSWERED_QUESTION_LATE_HOOK_MS, TerminalBlockedTracker } from '../terminal-blocked-state'

const AUQ = 'AskUserQuestion'

function setup() {
  const lines: string[] = []
  let mono = 10_000
  const changes: string[] = []
  const tracker = new TerminalBlockedTracker(
    { log: m => lines.push(m) },
    () => 1000,
    id => changes.push(id),
    undefined,
    { quietEndMs: 0, monotonicNow: () => mono },
  )
  const advance = (ms: number) => { mono += ms }
  return { lines, tracker, advance, changes }
}

describe('T0926 / BUG-224: the late second hook of an answered AskUserQuestion', () => {
  it('BUG-224’s order: ask-user-question → user input (Esc) → late permission-request tool=AskUserQuestion stays cleared', () => {
    const { lines, tracker, advance, changes } = setup()
    expect(tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 1_000_000n)).toMatchObject({ result: 'blocked' })
    advance(100)
    expect(tracker.clearForUserInput('a')).toBe(true)
    advance(11)
    expect(tracker.report('a', 'permission-request', AUQ, undefined, undefined, 1_050_000n)).toEqual({ result: 'unchanged', state: null })
    expect(tracker.get('a')).toBeNull()
    expect(changes).toEqual(['a', 'a']) // blocked, cleared — not blocked again
    expect(lines).toEqual([
      '[blocked] terminal=a → blocked reason=question (hook ask-user-question)',
      '[blocked] terminal=a → cleared (user input)',
      '[blocked] terminal=a kept cleared: hook permission-request tool=AskUserQuestion is of the question the user answered 11ms ago (reported late)',
    ])
  })

  it('a mouse press (T0757) answers the same way; no `at` anywhere (an older hook script) too', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question')
    expect(tracker.clearForMousePress('a')).toBe(true)
    advance(20)
    expect(tracker.report('a', 'permission-request', AUQ)).toEqual({ result: 'unchanged', state: null })
    expect(tracker.get('a')).toBeNull()
  })

  it('after the late hook was absorbed, the next AskUserQuestion blocks (both of its hooks)', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 100n)
    tracker.clearForUserInput('a')
    advance(10)
    tracker.report('a', 'permission-request', AUQ, undefined, undefined, 150n)
    advance(500)
    expect(tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 900n)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })
    expect(tracker.report('a', 'permission-request', AUQ, undefined, undefined, 950n)).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    expect(tracker.get('a')).toMatchObject({ reason: 'question' })
  })

  it('counter-example: the late hook never came; the next AskUserQuestion’s own hooks block as usual', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 100n)
    tracker.clearForUserInput('a') // Esc before claude ran the PermissionRequest hook at all
    advance(1000)
    expect(tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 2_000n)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })
    // its PermissionRequest is that prompt's, not the answered one's (the record was dropped)
    expect(tracker.report('a', 'permission-request', AUQ, undefined, undefined, 2_100n)).toMatchObject({ result: 'unchanged', state: { reason: 'question' } })
    tracker.clearForUserInput('a') // both reported → nothing remembered
    expect(tracker.report('a', 'permission-request', AUQ, undefined, undefined, 3_000n)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })
  })

  it('counter-example: a permission prompt / an elicitation after the answer blocks', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question')
    tracker.clearForUserInput('a')
    advance(10)
    expect(tracker.report('a', 'permission-request', 'Bash')).toMatchObject({ result: 'blocked', state: { reason: 'permission' } })
    tracker.clearForUserInput('a')
    // the permission prompt dropped the record: a later question hook blocks
    expect(tracker.report('a', 'permission-request', AUQ)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })

    const t2 = setup()
    t2.tracker.report('b', 'ask-user-question')
    t2.tracker.clearForUserInput('b')
    expect(t2.tracker.report('b', 'elicitation')).toMatchObject({ result: 'blocked', state: { reason: 'elicitation' } })
  })

  it('counter-example: past ANSWERED_QUESTION_LATE_HOOK_MS the hook blocks as before T0926; exactly at the bound it is still absorbed', () => {
    const late = setup()
    late.tracker.report('a', 'ask-user-question')
    late.tracker.clearForUserInput('a')
    late.advance(ANSWERED_QUESTION_LATE_HOOK_MS + 1)
    expect(late.tracker.report('a', 'permission-request', AUQ)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })

    const edge = setup()
    edge.tracker.report('a', 'ask-user-question')
    edge.tracker.clearForUserInput('a')
    edge.advance(ANSWERED_QUESTION_LATE_HOOK_MS)
    expect(edge.tracker.report('a', 'permission-request', AUQ)).toEqual({ result: 'unchanged', state: null })
  })

  it('counter-example: the record is used once — a second permission-request tool=AskUserQuestion blocks', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question')
    tracker.clearForUserInput('a')
    advance(10)
    expect(tracker.report('a', 'permission-request', AUQ).result).toBe('unchanged')
    expect(tracker.report('a', 'permission-request', AUQ)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })
  })

  it('counter-example: both hooks reported before the answer — nothing is remembered', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 100n)
    tracker.report('a', 'permission-request', AUQ, undefined, undefined, 190n)
    tracker.clearForUserInput('a')
    advance(10)
    expect(tracker.report('a', 'permission-request', AUQ, undefined, undefined, 300n)).toMatchObject({ result: 'blocked', state: { reason: 'question' } })
  })

  it('typing again while nothing is blocked keeps the record; the PTY ending / the recovery drop it', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question')
    tracker.clearForUserInput('a')
    expect(tracker.clearForUserInput('a')).toBe(false)
    expect(tracker.clearForMousePress('a')).toBe(false)
    advance(30)
    expect(tracker.report('a', 'permission-request', AUQ).result).toBe('unchanged')

    tracker.report('b', 'ask-user-question')
    tracker.clearForUserInput('b')
    tracker.clear('b', 'the PTY ended')
    tracker.clearStarted('b')
    expect(tracker.report('b', 'permission-request', AUQ)).toMatchObject({ result: 'blocked' })

    tracker.report('c', 'ask-user-question')
    tracker.clearForUserInput('c')
    tracker.clearAll('Terminal Server recovery')
    expect(tracker.report('c', 'permission-request', AUQ)).toMatchObject({ result: 'blocked' })
  })

  it('a clearing hook in between leaves the record (an Esc-interrupted turn may still report one)', () => {
    const { tracker, advance } = setup()
    tracker.report('a', 'ask-user-question')
    tracker.clearForUserInput('a')
    expect(tracker.report('a', 'ask-user-question-done')).toEqual({ result: 'unchanged', state: null })
    advance(10)
    expect(tracker.report('a', 'permission-request', AUQ).result).toBe('unchanged')
  })

  it('the reverse order: permission-request first, its ask-user-question late — ignored only with an earlier `at`', () => {
    const earlier = setup()
    earlier.tracker.report('a', 'permission-request', AUQ, undefined, undefined, 2_000n)
    earlier.tracker.clearForUserInput('a')
    earlier.advance(5)
    expect(earlier.tracker.report('a', 'ask-user-question', undefined, undefined, undefined, 1_900n)).toEqual({ result: 'unchanged', state: null })
    expect(earlier.lines.at(-1)).toBe('[blocked] terminal=a kept cleared: hook ask-user-question is of the question the user answered 5ms ago (reported late)')

    // later `at` = a new prompt; same `at` (T0790: equal is not earlier); unknown `at` → blocks as before
    for (const [answeredAt, lateAt] of [[2_000n, 2_100n], [2_000n, 2_000n], [undefined, 1_900n], [2_000n, undefined]] as const) {
      const t = setup()
      t.tracker.report('a', 'permission-request', AUQ, undefined, undefined, answeredAt)
      t.tracker.clearForUserInput('a')
      expect(t.tracker.report('a', 'ask-user-question', undefined, undefined, undefined, lateAt), `${answeredAt} / ${lateAt}`)
        .toMatchObject({ result: 'blocked', state: { reason: 'question' } })
    }
  })

  it('permission prompts are not affected: a queued prompt reported after the answer still blocks (T0918)', () => {
    const { tracker } = setup()
    tracker.report('a', 'permission-request', 'Bash')
    tracker.clearForUserInput('a')
    expect(tracker.report('a', 'permission-request', 'Bash')).toMatchObject({ result: 'blocked', state: { reason: 'permission' } })
    tracker.report('a', 'permission-request', 'Edit')
    expect(tracker.clearForUserInput('a')).toBe(false) // 2 open: kept (T0918, unchanged)
  })

  it('codex `input` (OSC) is untouched by the user input (unchanged rule)', () => {
    const { tracker } = setup()
    tracker.observeCodexState('x', 'blocked')
    expect(tracker.clearForUserInput('x')).toBe(false)
    expect(tracker.get('x')).toMatchObject({ reason: 'input' })
  })
})

// ── PtyManager: the path pty:write → noteUserInput → reportHookEvent ──

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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0926-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('PtyManager (T0926)', () => {
  it('noteUserInput clears the question; the late permission-request tool=AskUserQuestion does not set it back; the next prompt does', () => {
    const manager = new PtyManager({ emit: vi.fn(), dataDir, helperEnv: () => ({}) })
    managers.push(manager)
    expect(manager.create({ id: 'a', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
    expect(manager.reportHookEvent('a', 'ask-user-question', undefined, undefined, undefined, 1_000n)).toMatchObject({ result: 'blocked' })
    manager.noteUserInput('a')
    expect(manager.getBlockedState('a')).toBeNull()
    expect(manager.reportHookEvent('a', 'permission-request', AUQ, undefined, undefined, 1_100n)).toEqual({ result: 'unchanged', state: null })
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs.some(l => l.includes('[blocked] terminal=a kept cleared: hook permission-request tool=AskUserQuestion is of the question the user answered'))).toBe(true)
    expect(manager.reportHookEvent('a', 'ask-user-question', undefined, undefined, undefined, 5_000n)).toMatchObject({ result: 'blocked' })
    expect(manager.getBlockedState('a')).toMatchObject({ reason: 'question' })
  })
})
