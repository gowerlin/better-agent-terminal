// @vitest-environment node
/**
 * T0964 / BUG-235 (D-answer Q-1 = B): an inbox answer to an idle contract-2 Tower stayed in "📨 待送" until
 * the user sent the next message — the Tower was taken for a tab with an unsent draft (`reason=draft`).
 *
 *   - claude's `user-prompt-submit` (PtyManager `onUserPromptSubmit` → `onPromptSubmitted`) clears a
 *     contract-2 Tower's draft typed before it — the input box was just taken — and a held answer goes
 *   - never what the user typed after the submit: no input in the `NOTIFY_HOLD_SUBMIT_QUIET_MS` before the
 *     hook and no Enter in the `NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS` before it, else the draft is kept
 *   - an open paste: unchanged
 *   - T0972 (D503 ①): any tab, not only a contract-2 Tower — the launch-prompt turn submits before the
 *     Tower declares contract 2 (T0970 B3); only a contract-2 Tower reads the draft
 *   - the same answer line already waiting is not queued twice (answered `held`, the same item)
 *   - `[notify-hold] draft set … cause=<kind> bytes=<n>`: a kind and a length, never the text
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

import {
  NOTIFY_HOLD_ENTER_DELAY_MS,
  NOTIFY_HOLD_QUIET_MS,
  NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS,
  NOTIFY_HOLD_SUBMIT_QUIET_MS,
  NotifyHoldController,
  type NotifyHoldKeypress,
  type NotifyHoldPtyManager,
} from '../notify-hold'
import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'
import { NO_DRAFT, draftCause, trackDraft } from '../../src/lib/tower-input-draft'

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(): BlockedDetection { return 'hook' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return { ok: true }
  }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.role.get(id) === 'tower' ? this.contract.get(id) : undefined }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); return true },
    logger: { log: (m) => { lines.push(m) } },
    now: () => Date.now(), // the fake timers' clock (also the submit windows' clock)
  })
  /** What pty.ts does for a user write: track it, then write it. */
  const userTypes = (data: string) => {
    controller.onUserInput('tower', data)
    if (!controller.holdUserWrite('tower', data)) pm.writeWithResult('tower', data)
  }
  /** Lets a queue that nothing holds go out: quiet wait, text, Enter. */
  const flush = () => vi.advanceTimersByTimeAsync(NOTIFY_HOLD_QUIET_MS + NOTIFY_HOLD_ENTER_DELAY_MS * 2 + 10)
  return { pm, controller, lines, keypresses, userTypes, flush }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('BUG-235: user-prompt-submit clears a draft typed before it', () => {
  it('the reported case: a draft before claude took the input box → the answer is sent at once (held before the fix)', () => {
    const { controller, pm, userTypes, lines } = setup()
    userTypes('\x1b[A') // ↑ (history) — a draft as far as BAT can tell
    expect(controller.hasDraft('tower')).toBe(true)
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(false)
    expect(lines).toContain('[notify-hold] draft cleared terminal=tower (user-prompt-submit)')
    const result = controller.enqueueAnswer('tower', 'A-25：完成')
    expect(result).toEqual({ ok: true, held: false, holdId: expect.any(String) })
    expect(pm.writes).toContainEqual(['tower', 'A-25：完成'])
  })

  it('an answer already held by that draft goes out after the submit (quiet wait, then text + Enter)', async () => {
    const { controller, pm, userTypes, keypresses, flush } = setup()
    userTypes('half')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    expect(controller.enqueueAnswer('tower', 'A-1：完成')).toMatchObject({ ok: true, held: true })
    await flush()
    expect(pm.writes).not.toContainEqual(['tower', 'A-1：完成'])
    controller.onPromptSubmitted('tower')
    await flush()
    expect(pm.writes).toContainEqual(['tower', 'A-1：完成'])
    expect(keypresses.at(-1)).toMatchObject({ source: 'answer', userInput: true })
    expect(controller.count('tower')).toBe(0)
  })

  it('typed right after the user\'s own Enter (the hook comes later): the draft stays', () => {
    const { controller, userTypes, lines } = setup()
    userTypes('first message\r')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_QUIET_MS + 50)
    userTypes('n')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_QUIET_MS + 50) // the hook later than the quiet window, still within the Enter guard
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
    expect(controller.enqueueAnswer('tower', 'A-2：完成')).toMatchObject({ ok: true, held: true })
    expect(lines.some(l => l.startsWith('[notify-hold] draft kept terminal=tower (user-prompt-submit;'))).toBe(true)
  })

  it('any input within the quiet window before the hook: the draft stays', () => {
    const { controller, userTypes } = setup()
    userTypes('abc')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_QUIET_MS - 1)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
  })

  it('the Enter guard: an Enter less than NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS ago keeps the draft; later it clears', () => {
    const { controller, userTypes } = setup()
    userTypes('a\rb')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS - 1)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
    vi.advanceTimersByTime(1)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(false)
  })

  it('a paste still open is not cleared', () => {
    const { controller, userTypes } = setup()
    userTypes('\x1b[200~pasted')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
  })

  // T0972 (塔台裁示 D503 / Q-1): before T0972 the draft of these tabs was left as it was (`hasDraft` stayed
  // true). Only a contract-2 Tower reads the draft, so it is now cleared in them too: nothing kept, no queue
  // scheduled, and declaring contract 2 later does not find it.
  it.each([
    ['a v1 Tower', (pm: FakeManager) => { pm.contract.set('tower', 1) }],
    ['not a Tower', (pm: FakeManager) => { pm.role.delete('tower') }],
  ])('%s: the draft is cleared too (T0972, D503 / Q-1); nothing kept or scheduled; a later contract-2 declaration does not find it', (_name, arrange) => {
    const { controller, pm, userTypes, lines } = setup()
    arrange(pm)
    userTypes('typed')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(false)
    expect(lines).toContain('[notify-hold] draft cleared terminal=tower (user-prompt-submit; not a contract-2 Tower yet)')
    expect(lines.some(l => l.startsWith('[notify-hold] draft kept'))).toBe(false)
    expect(controller.count('tower')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    pm.role.set('tower', 'tower')
    pm.contract.set('tower', 2)
    expect(controller.enqueueAnswer('tower', 'A-3：完成')).toMatchObject({ ok: true, held: false })
    expect(pm.writes).toContainEqual(['tower', 'A-3：完成'])
  })

  it('no draft / unknown tab: nothing happens, nothing logged', () => {
    const { controller, lines } = setup()
    controller.onPromptSubmitted('tower')
    controller.onPromptSubmitted('nope')
    expect(lines.filter(l => l.includes('user-prompt-submit'))).toEqual([])
  })
})

describe('T0972 / BUG-235: the launch-prompt turn submits before the Tower declares contract 2', () => {
  /** The tab before `--set-role tower --bat-contract 2` (T0970 B3: the hook ~64 s before the declaration). */
  const undeclared = (pm: FakeManager) => { pm.role.delete('tower'); pm.contract.delete('tower') }
  const declare = (pm: FakeManager) => { pm.role.set('tower', 'tower'); pm.contract.set('tower', 2) }

  it('T0970 B3: draft (F12) → 357 ms → submit (not declared yet) → declare 2 → the inbox answer goes at once (held before the fix)', () => {
    const { controller, pm, userTypes } = setup()
    undeclared(pm)
    userTypes('\x1b[24~') // F12 (`csi~:24`), the draft of the T0970 run
    expect(controller.hasDraft('tower')).toBe(true)
    vi.advanceTimersByTime(357)
    controller.onPromptSubmitted('tower')
    vi.advanceTimersByTime(64_000)
    declare(pm)
    expect(controller.hasDraft('tower')).toBe(false)
    const result = controller.enqueueAnswer('tower', 'U-1：A')
    expect(result).toEqual({ ok: true, held: false, holdId: expect.any(String) })
    expect(pm.writes).toContainEqual(['tower', 'U-1：A'])
  })

  it('typed after that submit (before the declaration): still a draft, the answer is held after declaring', () => {
    const { controller, pm, userTypes } = setup()
    undeclared(pm)
    userTypes('\x1b[24~')
    vi.advanceTimersByTime(357)
    controller.onPromptSubmitted('tower')
    vi.advanceTimersByTime(5_000)
    userTypes('next')
    vi.advanceTimersByTime(60_000)
    declare(pm)
    expect(controller.hasDraft('tower')).toBe(true)
    expect(controller.enqueueAnswer('tower', 'U-1：A')).toMatchObject({ ok: true, held: true })
    expect(pm.writes).not.toContainEqual(['tower', 'U-1：A'])
  })

  it('the quiet / Enter windows apply before the declaration too: the draft is kept', () => {
    const { controller, pm, userTypes, lines } = setup()
    undeclared(pm)
    userTypes('abc')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_QUIET_MS - 1)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
    userTypes('x\ry')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS - 1)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
    expect(lines.filter(l => l.startsWith('[notify-hold] draft kept terminal=tower (user-prompt-submit;'))).toHaveLength(2)
    declare(pm)
    expect(controller.enqueueAnswer('tower', 'U-2：B')).toMatchObject({ ok: true, held: true })
  })

  it('a paste still open at that submit is not cleared; the answer is held after declaring', () => {
    const { controller, pm, userTypes } = setup()
    undeclared(pm)
    userTypes('\x1b[200~pasted')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    controller.onPromptSubmitted('tower')
    expect(controller.hasDraft('tower')).toBe(true)
    declare(pm)
    expect(controller.enqueueAnswer('tower', 'U-3：C')).toMatchObject({ ok: true, held: true })
  })

  it('the log names no text and says the tab was not a contract-2 Tower yet', () => {
    const { controller, pm, userTypes, lines } = setup()
    undeclared(pm)
    userTypes('secret words')
    vi.advanceTimersByTime(NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS)
    controller.onPromptSubmitted('tower')
    const cleared = lines.filter(l => l.includes('user-prompt-submit'))
    expect(cleared).toEqual(['[notify-hold] draft cleared terminal=tower (user-prompt-submit; not a contract-2 Tower yet)'])
    expect(lines.join('\n')).not.toContain('secret')
  })
})

describe('T0964: the same answer is not queued twice', () => {
  it('a second identical line while the first waits → held, same item, one line in the queue, logged without text', () => {
    const { controller, userTypes, lines } = setup()
    userTypes('draft')
    const first = controller.enqueueAnswer('tower', 'A-25：完成')
    const second = controller.enqueueAnswer('tower', 'A-25：完成')
    expect(first).toMatchObject({ ok: true, held: true })
    expect(second).toEqual(first)
    expect(controller.count('tower')).toBe(1)
    const dup = lines.find(l => l.startsWith('[notify-hold] answer duplicate'))
    expect(dup).toBeDefined()
    expect(dup).toContain('len=')
    expect(dup).not.toContain('A-25')
    expect(dup).not.toContain('完成')
  })

  it('a different line is queued as before; after it went out the same line is sent again (resend, T0942)', async () => {
    const { controller, pm, userTypes, flush } = setup()
    userTypes('draft')
    controller.enqueueAnswer('tower', 'A-1：完成')
    expect(controller.enqueueAnswer('tower', 'A-2：完成')).toMatchObject({ ok: true, held: true })
    expect(controller.count('tower')).toBe(2)
    userTypes('\r')
    for (let i = 0; i < 3; i++) await flush()
    expect(controller.count('tower')).toBe(0)
    const sent = controller.enqueueAnswer('tower', 'A-1：完成')
    expect(sent).toMatchObject({ ok: true, held: false })
    expect(pm.writes.filter(([, d]) => d === 'A-1：完成')).toHaveLength(2)
  })
})

describe('T0964 diagnostics: what made the draft (a kind, never the text)', () => {
  it.each([
    ['abc', 'printable'],
    ['\x1b[A', 'csi:A'],
    ['\x1bOB', 'ss3:B'],
    ['\x1b[15~', 'csi~:15'],
    ['\x1bx', 'alt-key'],
    ['\t', 'tab'],
    ['\n', 'newline'],
    ['\x1b[200~secret\x1b[201~', 'paste'],
    ['\x1b[1;5', 'csi-cut'],
  ])('%j → %s', (data, cause) => {
    expect(draftCause(NO_DRAFT, data)).toBe(cause)
  })

  it('no draft made, or there already was one: null; trackDraft unchanged', () => {
    expect(draftCause(NO_DRAFT, '\r')).toBeNull()
    expect(draftCause(NO_DRAFT, '\x1b[I')).toBeNull()
    expect(draftCause(NO_DRAFT, 'abc\r')).toBeNull()
    expect(draftCause({ draft: true, inPaste: false }, 'x')).toBeNull()
    expect(draftCause(NO_DRAFT, '\rq')).toBe('printable')
    expect(trackDraft(NO_DRAFT, 'abc')).toEqual({ draft: true, inPaste: false })
  })

  it('the log line names the kind and the length only', () => {
    const { controller, lines } = setup()
    controller.onUserInput('tower', 'top secret')
    controller.onUserInput('tower', 'more')
    const set = lines.filter(l => l.startsWith('[notify-hold] draft set'))
    expect(set).toEqual(['[notify-hold] draft set terminal=tower cause=printable bytes=10'])
  })
})

// ── PtyManager: the hook reaches the listener ──

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

describe('PtyManager onUserPromptSubmit', () => {
  it('called for an applied user-prompt-submit only; a throwing listener is logged, the report still answered', () => {
    vi.useRealTimers()
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0964-pty-'))
    const calls: string[] = []
    let fail = false
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperEnv: () => ({}),
      onUserPromptSubmit: (id) => {
        calls.push(id)
        if (fail) throw new Error('boom')
      },
    })
    try {
      expect(manager.create({ id: 't1', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/sh' })).toBe(true)
      manager.reportHookEvent('t1', 'stop')
      manager.reportHookEvent('t1', 'permission-request', 'Bash')
      expect(calls).toEqual([])
      expect(manager.reportHookEvent('t1', 'user-prompt-submit')).not.toBeNull()
      expect(calls).toEqual(['t1'])
      fail = true
      expect(manager.reportHookEvent('t1', 'user-prompt-submit')).not.toBeNull()
      expect(warn).toHaveBeenCalled()
      expect(manager.reportHookEvent('nope', 'user-prompt-submit')).toBeNull()
      expect(calls).toEqual(['t1', 't1'])
    } finally {
      manager.dispose()
      fs.rmSync(dataDir, { recursive: true, force: true })
      vi.restoreAllMocks()
    }
  })
})
