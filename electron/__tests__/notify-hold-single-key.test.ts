// @vitest-environment node
/**
 * T0940 / BUG-227 (D406): in a contract-2 Tower, keys that never stay in claude's input box do not
 * hold the inbox answers / notifications as `draft`.
 *
 *   - 案 B: claude's single-key survey in the output (onPtyOutput, read only) + exactly one of its keys
 *     → no draft; the answer goes at once. Survey < 1 s, another key, a draft before, any other write
 *     (helper, mouse press, user) since, a v1 / undeclared Tower → as before (held by `draft`)
 *   - 案 A: one key while a hook / osc prompt is shown leaves the draft as it was (pty.ts asks before
 *     `noteUserInput` clears the prompt); a paste / several characters → as before
 *   - T0904 / T0788 suites are unchanged (notify-hold*.test.ts)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('notify-hold must not import electron')
})

import { NOTIFY_HOLD_ENTER_DELAY_MS, NotifyHoldController, type NotifyHoldKeypress, type NotifyHoldPtyManager } from '../notify-hold'
import { registerPtyHandlers } from '../handlers/pty'
import type { HandlerContext } from '../remote/handler-registry'
import type { BlockedDetection, BlockedState } from '../terminal-blocked-state'
import type { NotifyHoldChangedEvent } from '../../src/types/notify-hold'
import { SINGLE_KEY_PROMPT_SETTLE_MS } from '../../src/lib/tower-input-draft'

const ESC = '\x1b'
const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-w', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower' } }
const LOCAL: HandlerContext = { windowId: 'win-1' }
const HELD = { ok: true, held: true }

/** claude 2.1.331's rating survey as ConPTY wrote it (T0939 S1 M-3, cut down; nothing identifying). */
const RATING_SURVEY =
  `${ESC}[38;2;177;185;249m●${ESC}[m${ESC}[1m${ESC}[1CHow is Claude doing this session? (optional)${ESC}[22m      ` +
  `${ESC}[38;2;177;185;249m${ESC}[30;3H1${ESC}[m:${ESC}[1CBad    ${ESC}[38;2;177;185;249m2${ESC}[m: Fine   ` +
  `${ESC}[38;2;177;185;249m3${ESC}[m: Good   ${ESC}[38;2;177;185;249m0${ESC}[m: Dismiss        ` +
  `${ESC}[33;3H${ESC}[?25h${ESC}[?2004h${ESC}[?1000h${ESC}[?1002h${ESC}[?1003h${ESC}[?1006h`
/** What claude writes right after the key (its echo in the input row). */
const KEY_ECHO = `${ESC}[33;3H0${ESC}[?25l`

class FakeManager implements NotifyHoldPtyManager {
  alive = new Set<string>(['tower'])
  blocked = new Map<string, BlockedState>()
  detection = new Map<string, BlockedDetection>([['tower', 'hook']])
  role = new Map<string, string>([['tower', 'tower']])
  contract = new Map<string, number>([['tower', 2]])
  writes: Array<[string, string]> = []
  isAlive(id: string): boolean { return this.alive.has(id) }
  getBlockedState(id: string): BlockedState | null { return this.blocked.get(id) ?? null }
  getBlockedDetection(id: string): BlockedDetection { return this.detection.get(id) ?? 'none' }
  writeWithResult(id: string, data: string) {
    this.writes.push([id, data])
    return { ok: true }
  }
  getTerminalRole(id: string): string | undefined { return this.role.get(id) }
  getTowerContract(id: string): number | undefined { return this.role.get(id) === 'tower' ? this.contract.get(id) : undefined }
  // what pty.ts calls on a user write (PtyManager: the hook reason is cleared by the user's input)
  noteUserInput(id: string): void { this.blocked.delete(id) }
  noteMousePress(id: string): void { this.blocked.delete(id) }
}

function setup() {
  const pm = new FakeManager()
  const lines: string[] = []
  const keypresses: NotifyHoldKeypress[] = []
  const changes: NotifyHoldChangedEvent[] = []
  const controller = new NotifyHoldController({
    getPtyManager: () => pm,
    emitKeypress: (payload) => { keypresses.push(payload); return true },
    emitChanged: (event) => { changes.push(event) },
    logger: { log: (m) => { lines.push(m) } },
  })
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  registerPtyHandlers((channel, handler) => { handlers.set(channel, handler as never) }, {
    getPtyManager: () => pm as never,
    notifyHold: controller,
  })
  /** The user's key through `pty:write` (pty.ts: prompt state → noteUserInput → onUserInput → write). */
  const userTypes = (data: string) => handlers.get('pty:write')!(LOCAL, 'tower', data)
  const output = (data: string) => controller.onPtyOutput('tower', data)
  const answer = () => controller.enqueueAnswer('tower', 'U-5：放棄')
  return { pm, controller, lines, keypresses, changes, userTypes, output, answer }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('案 B: claude\'s single-key survey (BUG-227)', () => {
  it('the survey answered with `0` → no draft; the inbox answer is sent at once', async () => {
    const s = setup()
    s.output(RATING_SURVEY)
    expect(s.lines).toContain('[notify-hold] single-key prompt shown terminal=tower legend=rating')
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('0')
    s.output(KEY_ECHO)
    expect(s.controller.hasDraft('tower')).toBe(false)
    expect(s.lines).toContain('[notify-hold] single-key prompt answered terminal=tower legend=rating (no draft)')
    expect(s.answer()).toMatchObject({ ok: true, held: false })
    await vi.advanceTimersByTimeAsync(NOTIFY_HOLD_ENTER_DELAY_MS)
    expect(s.pm.writes.map(w => w[1])).toEqual(['0', 'U-5：放棄'])
    expect(s.keypresses).toHaveLength(1)
  })

  it.each(['1', '2', '3'])('a rating `%s` → no draft', (key) => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes(key)
    expect(s.controller.hasDraft('tower')).toBe(false)
  })

  it('before T0940 (no survey seen) `0` is a draft and the answer is held — still so', () => {
    const s = setup()
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
    expect(s.answer()).toMatchObject({ ok: true, held: true })
    expect(s.changes.at(-1)?.reason).toBe('draft')
  })

  it('a key within 1 s of the survey (claude leaves it in the input box) → draft', () => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS - 1)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it.each([
    ['a key the survey does not take', '5'],
    ['two digits', '10'],
    ['a letter', 'a'],
  ])('%s → draft', (_name, data) => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes(data)
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('normal typing in the input box is still a draft (and the digit after it too)', () => {
    const s = setup()
    s.userTypes('half')
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it.each([
    ['the user\'s other key', (s: ReturnType<typeof setup>) => { s.userTypes(`${ESC}[D`) }],
    ['a helper write', (s: ReturnType<typeof setup>) => { s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成') }],
    ['BAT\'s own `{ auto }` write', (s: ReturnType<typeof setup>) => { s.controller.afterSubmitWrite('tower', '\r') }],
    ['a mouse press', (s: ReturnType<typeof setup>) => { s.controller.onMousePress('tower') }],
  ])('after %s the survey record is gone → `0` is a draft', (_name, between) => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    between(s)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('a mouse press through pty:write forgets the survey', () => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes(`${ESC}[<0;10;5M`)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('claude\'s echo frame right after the key is not a new survey', () => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('0')
    s.output(RATING_SURVEY) // the frame that echoes the key may still draw the legend
    vi.advanceTimersByTime(5 * 60_000)
    s.userTypes('1') // the first key of a new message
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it.each([
    ['a v1 Tower', (pm: FakeManager) => { pm.contract.set('tower', 1) }],
    ['an undeclared tab', (pm: FakeManager) => { pm.role.delete('tower') }],
  ])('%s: the output is not scanned; `0` tracked as before', (_name, arrange) => {
    const s = setup()
    arrange(s.pm)
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
    expect(s.lines.some(l => l.includes('single-key prompt'))).toBe(false)
  })

  it('the transcript prompt answered with `n`', () => {
    const s = setup()
    s.output(`${ESC}[1;3Hy${ESC}[m:${ESC}[1CYes      n: No       d: Don't ask again`)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('n')
    expect(s.controller.hasDraft('tower')).toBe(false)
  })

  it('the PTY ending forgets the survey', () => {
    const s = setup()
    s.output(RATING_SURVEY)
    s.controller.onPtyExit('tower')
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('0')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('logs carry the legend id only — never the key', () => {
    const s = setup()
    s.output(RATING_SURVEY)
    vi.advanceTimersByTime(SINGLE_KEY_PROMPT_SETTLE_MS)
    s.userTypes('2')
    expect(s.lines.filter(l => l.includes('single-key')).every(l => !/key=|=2\b|'2'/.test(l))).toBe(true)
  })
})

describe('案 A: one key while a hook / osc prompt is shown', () => {
  it.each([
    ['permission', '1'],
    ['question', `${ESC}[B`],
    ['elicitation', 'y'],
    ['input', 'n'],
  ])('%s: the answering key `%s` is no draft', (reason, key) => {
    const s = setup()
    s.pm.blocked.set('tower', { reason } as BlockedState)
    s.userTypes(key)
    expect(s.pm.blocked.has('tower')).toBe(false) // pty.ts asked before noteUserInput cleared it
    expect(s.controller.hasDraft('tower')).toBe(false)
  })

  it('Enter that answers the prompt keeps a draft typed before it', () => {
    const s = setup()
    s.userTypes('half typed')
    s.pm.blocked.set('tower', { reason: 'permission' } as BlockedState)
    s.userTypes('\r')
    expect(s.controller.hasDraft('tower')).toBe(true)
    expect(s.answer()).toMatchObject({ ok: true, held: true })
  })

  it('a paste during the prompt is still a draft', () => {
    const s = setup()
    s.pm.blocked.set('tower', { reason: 'question' } as BlockedState)
    s.userTypes(`${ESC}[200~pasted${ESC}[201~`)
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('several characters at once during the prompt are still a draft', () => {
    const s = setup()
    s.pm.blocked.set('tower', { reason: 'input' } as BlockedState)
    s.userTypes('abc')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('no prompt: the same key is a draft as before', () => {
    const s = setup()
    s.userTypes('1')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('`tower` (a Worker waiting for its Tower) is not a prompt: the key is a draft', () => {
    const s = setup()
    s.pm.blocked.set('tower', { reason: 'tower' } as unknown as BlockedState)
    s.userTypes('1')
    expect(s.controller.hasDraft('tower')).toBe(true)
  })

  it('a helper write is not the user\'s input: interceptWrite is unchanged (held by the prompt)', () => {
    const s = setup()
    s.pm.blocked.set('tower', { reason: 'permission' } as BlockedState)
    expect(s.controller.interceptWrite(WORKER, 'tower', 'T0001 完成')).toEqual(HELD)
  })
})
