// @vitest-environment node
/**
 * T0757 / BUG-188 (D209): an answer by mouse clears the claude hook `blocked` like a key does.
 *
 *   - `hasMouseButtonPress`: a left-button press in SGR / urxvt / X10 encoding (Shift / Meta / Ctrl
 *     allowed); never a release, motion / drag, the wheel, buttons 8–11, the middle / right button,
 *     focus / cursor reports or typed text
 *   - every press it accepts is a terminal auto-reply (`isTerminalAutoReply`), so `pty:write` keeps
 *     treating it as not user input (T0551: `--close-worker`, usage-limit wait unchanged)
 *   - `pty:write` (local window / headless client): a press clears `permission` / `question` /
 *     `elicitation`, logged `→ cleared (mouse press)`; the wheel / motion / a release alone / a helper
 *     connection / `{ auto: true }` do not; `lastUserInputAt` and `onUserInput` stay untouched
 *   - codex `input` (OSC 7501) is not cleared by a press (CLAUDE.md: user input never clears it)
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

import { isTerminalAutoReply } from '../close-worker'
import { logger } from '../logger'
import type { registerPtyHandlers as RegisterPtyHandlers } from '../handlers/pty'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { hasMouseButtonPress, TerminalBlockedTracker } from '../terminal-blocked-state'

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
let PtyManager: typeof PtyManagerType
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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0757-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// SGR: ESC [ < b ; x ; y M (press) / m (release); urxvt: ESC [ b+32 ; x ; y M; X10: ESC [ M <b+32><x+32><y+32>
const sgr = (b: number, final: 'M' | 'm' = 'M') => `\x1b[<${b};12;7${final}`
const urxvt = (b: number) => `\x1b[${b + 32};12;7M`
const x10 = (b: number) => `\x1b[M${String.fromCharCode(b + 32)}${String.fromCharCode(12 + 32)}${String.fromCharCode(7 + 32)}`

const PRESSES: Array<[string, string]> = [
  ['SGR left press', sgr(0)],
  ['SGR Shift + left press', sgr(4)],
  ['SGR Meta + left press', sgr(8)],
  ['SGR Ctrl + left press', sgr(16)],
  ['SGR press + release in one write', sgr(0) + sgr(0, 'm')],
  ['SGR release + press', sgr(0, 'm') + sgr(0)],
  ['SGR motion then press', sgr(35) + sgr(0)],
  ['urxvt left press', urxvt(0)],
  ['X10 left press', x10(0)],
  ['X10 Ctrl + left press', x10(16)],
]

const NOT_PRESSES: Array<[string, unknown]> = [
  ['SGR release', sgr(0, 'm')],
  ['SGR middle press', sgr(1)],
  ['SGR right press', sgr(2)],
  ['SGR drag with the left button (motion + 32)', sgr(32)],
  ['SGR motion, no button (35)', sgr(35)],
  ['SGR wheel up', sgr(64)],
  ['SGR wheel down', sgr(65)],
  ['SGR Shift + wheel', sgr(68)],
  ['SGR button 8 (back)', sgr(128)],
  ['SGR several wheel reports', sgr(64) + sgr(64) + sgr(65)],
  ['urxvt release (3)', urxvt(3)],
  ['urxvt wheel', urxvt(64)],
  ['X10 release (3)', x10(3)],
  ['X10 wheel', x10(64)],
  ['X10 drag', x10(32)],
  ['focus in', '\x1b[I'],
  ['cursor position report', '\x1b[12;40R'],
  ['typed text', '1'],
  ['Enter', '\r'],
  ['Esc', '\x1b'],
  ['empty', ''],
  ['not a string', 42],
]

describe('hasMouseButtonPress', () => {
  it.each(PRESSES)('%s → a press', (_name, data) => {
    expect(hasMouseButtonPress(data)).toBe(true)
  })
  it.each(NOT_PRESSES)('%s → not a press', (_name, data) => {
    expect(hasMouseButtonPress(data)).toBe(false)
  })
  it.each(PRESSES)('%s is a terminal auto-reply (not user input for --close-worker, T0551)', (_name, data) => {
    expect(isTerminalAutoReply(data)).toBe(true)
  })
})

describe('TerminalBlockedTracker.clearForMousePress', () => {
  it('clears a hook reason with cause "mouse press"; never codex input; false when not blocked', () => {
    const lines: string[] = []
    const changed: string[] = []
    const tracker = new TerminalBlockedTracker({ log: m => { lines.push(m) } }, () => 1000, id => { changed.push(id) })
    expect(tracker.clearForMousePress('a')).toBe(false)
    for (const event of ['permission-request', 'ask-user-question', 'elicitation'] as const) {
      tracker.report('a', event)
      expect(tracker.clearForMousePress('a')).toBe(true)
      expect(tracker.get('a')).toBeNull()
    }
    expect(lines.filter(l => l === '[blocked] terminal=a → cleared (mouse press)')).toHaveLength(3)
    expect(changed.length).toBe(6) // entered + cleared, three times (the renderer push)

    tracker.observeCodexState('b', 'blocked')
    expect(tracker.clearForMousePress('b')).toBe(false)
    expect(tracker.get('b')).toMatchObject({ reason: 'input', source: 'osc' })
  })
})

function setup(opts: { onUserInput?: (id: string) => void } = {}) {
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({ emit: vi.fn(), dataDir, helperEnv: () => ({}) })
  managers.push(manager)
  const create = (id: string) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({ id, cwd: CWD, type: 'terminal', shell: '/bin/sh' })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  const output = (id: string, data: string) => {
    ;(fakes.get(id)!.onData.mock.calls[0][0] as (d: string) => void)(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  registerPtyHandlers((channel, handler) => { handlers.set(channel, handler as never) }, { getPtyManager: () => manager, onUserInput: opts.onUserInput })
  const write = (ctx: HandlerContext, id: string, data: string, wopts?: unknown) => handlers.get('pty:write')!(ctx, id, data, wopts)
  return { manager, create, output, write, fakes }
}

const LOCAL: HandlerContext = { windowId: 'w1' }
const HELPER: HandlerContext = { windowId: null, connectionId: 'c1' }

describe('pty:write: a mouse press answers a hook prompt (T0757)', () => {
  it.each(['permission-request', 'ask-user-question', 'elicitation'] as const)('%s → cleared by a left press, not by the wheel / motion / a release / a helper / { auto }', (event) => {
    const onUserInput = vi.fn()
    const { manager, create, write, fakes } = setup({ onUserInput })
    create('a')
    manager.reportHookEvent('a', event, event === 'permission-request' ? 'Bash' : undefined)
    const reason = manager.getBlockedState('a')!.reason

    write(LOCAL, 'a', sgr(64) + sgr(65)) // scrolling the blocked tab
    write(LOCAL, 'a', sgr(35)) // moving over it
    write(LOCAL, 'a', sgr(0, 'm')) // a release alone
    write(LOCAL, 'a', sgr(2)) // a right press
    write(HELPER, 'a', sgr(0)) // a helper over RemoteServer
    write(LOCAL, 'a', sgr(0), { auto: true }) // BAT's own write
    expect(manager.getBlockedState('a')).toMatchObject({ reason })

    write(LOCAL, 'a', sgr(0) + sgr(0, 'm')) // the click
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs).toContain('[blocked] terminal=a → cleared (mouse press)')
    // still not user input: --close-worker / usage-limit wait unchanged (T0551)
    expect(manager.getLastUserInputAt('a')).toBeNull()
    expect(onUserInput).not.toHaveBeenCalled()
    // the write itself reached the PTY every time
    expect(fakes.get('a')!.write).toHaveBeenCalledTimes(7)
  })

  it('a press on a tab that is not blocked changes nothing; unknown id is ignored', () => {
    const { manager, create, write } = setup()
    create('a')
    write(LOCAL, 'a', sgr(0))
    write(LOCAL, 'nope', sgr(0))
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs.some(l => l.includes('cleared (mouse press)'))).toBe(false)
  })

  it('codex input (OSC 7501 blocked) is not cleared by a press; codex own OSC still clears it', () => {
    const { manager, create, output, write } = setup()
    create('c')
    output('c', '\x1b]7501;state=blocked:app=codex\x07')
    expect(manager.getBlockedState('c')).toMatchObject({ reason: 'input' })
    write(LOCAL, 'c', sgr(0) + sgr(0, 'm'))
    expect(manager.getBlockedState('c')).toMatchObject({ reason: 'input' })
    output('c', '\x1b]7501;state=working:app=codex\x07')
    expect(manager.getBlockedState('c')).toBeNull()
  })

  it('typed input still clears as before (T0590) and is user input', () => {
    const onUserInput = vi.fn()
    const { manager, create, write } = setup({ onUserInput })
    create('a')
    manager.reportHookEvent('a', 'ask-user-question')
    write(LOCAL, 'a', '\r')
    expect(manager.getBlockedState('a')).toBeNull()
    expect(logs).toContain('[blocked] terminal=a → cleared (user input)')
    expect(manager.getLastUserInputAt('a')).not.toBeNull()
    expect(onUserInput).toHaveBeenCalledWith('a')
  })
})
