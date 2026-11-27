/**
 * T0950: ⏻ on a tab whose program was killed on the alternate screen (the claude CLI on `taskkill /F`,
 * codex on a signal) — the same xterm stayed on the alternate buffer, and the new shell drew there,
 * with no scrollback. The alternate screen the old program left is now left in the tab's own xterm
 * once the new PTY is spawned (`leaveLeftoverAltScreen`), never written to the PTY.
 *
 * Real xterm 5.5.0 instances, as in mouse-tracking-restart.test.ts (T0947).
 */
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Terminal } from '@xterm/xterm'
import type { CreatePtyOptions } from '../../types'
import {
  ALT_SCREEN_EXIT,
  LEFTOVER_MOUSE_RESET_WAIT_MS,
  MOUSE_TRACKING_RESET,
  leaveLeftoverAltScreen,
  registerLeftoverMouseTrackingView,
  resetLeftoverMouseTracking,
  resetLeftoverMouseTrackingRegistry,
} from '../mouse-tracking-reset'
import { createPtyWithReplay, resetPtyReplayRegistry, restartOrCreatePty } from '../pty-replay'

/** A full-screen TUI starting: alternate screen (with the cursor saved) + the claude CLI's tracking (T0573). */
const TUI_START = '\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h'
/** What the TUI draws on the alternate screen. */
const TUI_FRAME = '\x1b[H\x1b[2J\x1b[1;1H> claude frame'

const write = (terminal: Terminal, data: string) => new Promise<void>(resolve => terminal.write(data, resolve))

/** The shell's history, then a TUI on the alternate screen (`rows` small so the history scrolls). */
async function tuiOverHistory(): Promise<Terminal> {
  const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
  for (let i = 1; i <= 12; i++) await write(terminal, `history line ${i}\r\n`)
  await write(terminal, '$ claude\r\n')
  await write(terminal, TUI_START + TUI_FRAME)
  return terminal
}

/** The tab's view as TerminalPanel registers it (TerminalPanel reads the buffer from its `onBufferChange`). */
function registerView(id: string, terminal: Terminal) {
  const calls: string[] = []
  const unregister = registerLeftoverMouseTrackingView(id, {
    mouseTrackingMode: () => terminal.modes.mouseTrackingMode,
    reset: (reason, done) => {
      calls.push(`reset:${reason}`)
      terminal.write(MOUSE_TRACKING_RESET, done)
    },
    altScreenActive: () => terminal.buffer.active.type === 'alternate',
    leaveAltScreen: done => {
      calls.push('leave-alt')
      terminal.write(ALT_SCREEN_EXIT, done)
    },
  })
  return { calls, unregister }
}

/** All lines of the active buffer (scrollback included), trailing blanks trimmed. */
function lines(terminal: Terminal): string[] {
  const buffer = terminal.buffer.active
  const out: string[] = []
  for (let y = 0; y < buffer.length; y++) out.push(buffer.getLine(y)?.translateToString(true) ?? '')
  while (out.length && out.at(-1) === '') out.pop()
  return out
}

/** Settles the writes started with `void` (xterm parses on a timer). */
const settle = (terminal: Terminal) => write(terminal, '')

const OPTS: CreatePtyOptions = { id: 't1', cwd: '/w', type: 'terminal', agentPreset: 'claude-cli', shell: '/usr/bin/bash' }

afterEach(() => {
  resetLeftoverMouseTrackingRegistry()
  resetPtyReplayRegistry()
  vi.useRealTimers()
})

describe('the problem, as a real xterm sees it (T0950)', () => {
  test('killed on the alternate screen: the next shell draws there, with no scrollback', async () => {
    const terminal = await tuiOverHistory()
    // the program is gone (⏻ kills it without its DECRST 1049); the new shell's prompt arrives
    await write(terminal, '\r\nuser@host:/w$ ')
    expect(terminal.buffer.active.type).toBe('alternate')
    expect(terminal.buffer.active.length).toBe(terminal.rows) // the alternate buffer has no scrollback
    expect(lines(terminal).join('\n')).not.toContain('history line 1')
  })

  test('DECRST 1049 does not touch DECTCEM: a cursor the program hid stays hidden (recorded, not changed here)', async () => {
    const terminal = await tuiOverHistory()
    await write(terminal, '\x1b[?25l')
    await write(terminal, ALT_SCREEN_EXIT)
    const core = (terminal as unknown as { _core: { coreService: { isCursorHidden: boolean } } })._core
    expect(terminal.buffer.active.type).toBe('normal')
    expect(core.coreService.isCursorHidden).toBe(true)
  })
})

describe('leaveLeftoverAltScreen', () => {
  test('on the alternate screen: left in xterm, resolved once parsed; the history is back', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    expect(await leaveLeftoverAltScreen('t1')).toBe(true)
    expect(calls).toEqual(['leave-alt'])
    expect(terminal.buffer.active.type).toBe('normal')
    expect(lines(terminal)).toContain('history line 1')
    expect(lines(terminal).join('\n')).not.toContain('claude frame')
  })

  test('on the normal screen (a plain shell): nothing written', async () => {
    const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
    await write(terminal, 'plain\r\n')
    const spy = vi.spyOn(terminal, 'write')
    const { calls } = registerView('t1', terminal)
    expect(await leaveLeftoverAltScreen('t1')).toBe(false)
    expect(calls).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  test('no mounted view, an unregistered one, or a view that cannot tell: nothing', async () => {
    expect(await leaveLeftoverAltScreen('nobody')).toBe(false)
    const terminal = await tuiOverHistory()
    const { unregister } = registerView('t1', terminal)
    unregister()
    expect(await leaveLeftoverAltScreen('t1')).toBe(false)
    // a view registered the T0947 way (tracking only)
    registerLeftoverMouseTrackingView('t2', { mouseTrackingMode: () => 'any', reset: (_r, done) => done() })
    expect(await leaveLeftoverAltScreen('t2')).toBe(false)
    expect(terminal.buffer.active.type).toBe('alternate')
  })

  test('only its own id: another tab on the alternate screen stays there', async () => {
    const a = await tuiOverHistory()
    const b = await tuiOverHistory()
    registerView('a', a)
    registerView('b', b)
    await leaveLeftoverAltScreen('a')
    expect(a.buffer.active.type).toBe('normal')
    expect(b.buffer.active.type).toBe('alternate')
  })

  test('a view that never reports it parsed (disposed meanwhile): resolves after the wait cap', async () => {
    vi.useFakeTimers()
    registerLeftoverMouseTrackingView('t1', {
      mouseTrackingMode: () => 'none',
      reset: () => {},
      altScreenActive: () => true,
      leaveAltScreen: () => { /* never done */ },
    })
    let resolved: boolean | null = null
    void leaveLeftoverAltScreen('t1').then(r => { resolved = r })
    await vi.advanceTimersByTimeAsync(LEFTOVER_MOUSE_RESET_WAIT_MS - 1)
    expect(resolved).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  test('the T0947 tracking reset alone (before-new-pty, the program still runs) does not leave the alternate screen', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    expect(await resetLeftoverMouseTracking('t1', 'before-new-pty')).toBe(true)
    expect(calls).toEqual(['reset:before-new-pty'])
    expect(terminal.buffer.active.type).toBe('alternate')
  })

  test('a program running in the tab: its alternate screen is untouched (nothing calls it outside a new PTY)', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await write(terminal, TUI_FRAME)
    expect(calls).toEqual([])
    expect(terminal.buffer.active.type).toBe('alternate')
  })
})

describe('⏻ through restartOrCreatePty: alternate screen → old program ends → new PTY', () => {
  test('restart ok: the new shell draws on the normal screen, under the history', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = {
      // still on the alternate screen while the host kills the old program and spawns the new shell
      restart: vi.fn(async () => {
        expect(terminal.buffer.active.type).toBe('alternate')
        return true
      }),
      create: vi.fn(async () => ({ ok: true, created: true })),
    }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'restart', spawned: true })
    await settle(terminal)
    expect(calls).toEqual(['reset:before-new-pty', 'leave-alt'])
    expect(terminal.buffer.active.type).toBe('normal')
    // the new shell's first output comes after the create answer: it lands on the normal screen
    await write(terminal, 'user@host:/w$ ')
    const all = lines(terminal)
    expect(all.indexOf('history line 1')).toBeGreaterThan(-1)
    expect(all.at(-1)).toContain('user@host:/w$')
    expect(all.join('\n')).not.toContain('claude frame')
    expect(terminal.buffer.active.length).toBeGreaterThan(terminal.rows) // scrollback
  })

  test('PTY gone (restart → false): created anew, left once', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => false), create: vi.fn(async () => ({ ok: true, created: true })) }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: true })
    await settle(terminal)
    expect(calls.filter(c => c === 'leave-alt')).toHaveLength(1)
    expect(terminal.buffer.active.type).toBe('normal')
  })

  test('a plain shell tab (normal screen, tracking off): ⏻ writes nothing to xterm', async () => {
    const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
    await write(terminal, '$ ls\r\n')
    const spy = vi.spyOn(terminal, 'write')
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => true), create: vi.fn(async () => ({ ok: true, created: true })) }
    await restartOrCreatePty({ ...OPTS, agentPreset: undefined }, api)
    expect(calls).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  test('restart failed: nothing left', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => { throw new Error('boom') }), create: vi.fn() }
    expect(await restartOrCreatePty(OPTS, api)).toMatchObject({ ok: false, via: 'restart' })
    await settle(terminal)
    expect(calls).not.toContain('leave-alt')
    expect(terminal.buffer.active.type).toBe('alternate')
  })
})

describe('createPtyWithReplay (claude-cli ⏻ / resume: kill, then startClaudeCliPty → createPtyThenLaunch)', () => {
  test('created: a new shell — the alternate screen still on is the old program\'s and goes', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: true }) })
    await settle(terminal)
    expect(calls).toEqual(['reset:new-pty-spawned', 'leave-alt'])
    expect(terminal.buffer.active.type).toBe('normal')
    expect(lines(terminal)).toContain('history line 1')
  })

  test('not created (the PTY survived, its program still runs): the alternate screen is left alone', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(calls).toEqual([])
    expect(terminal.buffer.active.type).toBe('alternate')
  })

  test('create failed: nothing', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(calls).toEqual([])
    expect(terminal.buffer.active.type).toBe('alternate')
  })
})
