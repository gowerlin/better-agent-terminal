/**
 * BUG-233 / T0957: ⏻ on a tab whose program hid the cursor (DECRST 25) and was killed before it showed
 * it again. T0950 leaves the alternate screen it left (DECRST 1049), which does not restore DECTCEM,
 * and a new bash / zsh on Linux, macOS, WSL or SSH never sends DECSET 25 (T0957 measured WSL bash), so
 * the new prompt had no cursor. The cursor is now shown in the tab's own xterm once the new PTY is
 * spawned (`showLeftoverHiddenCursor`), never written to the PTY.
 *
 * Real xterm 5.5.0 instances, as in alt-screen-restart.test.ts (T0950) and mouse-tracking-restart.test.ts (T0947).
 */
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Terminal } from '@xterm/xterm'
import type { CreatePtyOptions } from '../../types'
import {
  ALT_SCREEN_EXIT,
  CURSOR_SHOW,
  LEFTOVER_MOUSE_RESET_WAIT_MS,
  MOUSE_TRACKING_RESET,
  registerLeftoverMouseTrackingView,
  resetLeftoverMouseTrackingRegistry,
  showLeftoverHiddenCursor,
  xtermCursorHidden,
} from '../mouse-tracking-reset'
import { createPtyWithReplay, resetPtyReplayRegistry, restartOrCreatePty } from '../pty-replay'

/** A full-screen TUI starting: alternate screen, the claude CLI's tracking (T0573), cursor hidden. */
const TUI_START = '\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h\x1b[?25l'
/** What the TUI draws on the alternate screen. */
const TUI_FRAME = '\x1b[H\x1b[2J\x1b[1;1H> claude frame'
/** What T0957 measured a new WSL bash (Ubuntu 24.04, `bash -i` / `bash -l -i`) write before its prompt: no DECSET 25. */
const BASH_STARTUP = '\x1b[?2004h\x1b]0;user@host: /w\x07user@host:/w$ '

const write = (terminal: Terminal, data: string) => new Promise<void>(resolve => terminal.write(data, resolve))

const hidden = (terminal: Terminal) => xtermCursorHidden(terminal)

async function tuiOverHistory(start = TUI_START): Promise<Terminal> {
  const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
  for (let i = 1; i <= 8; i++) await write(terminal, `history line ${i}\r\n`)
  await write(terminal, '$ claude\r\n')
  await write(terminal, start + TUI_FRAME)
  return terminal
}

/** The tab's view as TerminalPanel registers it (cursor state from xterm 5.5.0's coreService). */
function registerView(id: string, terminal: Terminal, opts: { cursor?: boolean } = {}) {
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
    ...(opts.cursor === false ? {} : {
      cursorHidden: () => xtermCursorHidden(terminal),
      showCursor: (done: () => void) => {
        calls.push('show-cursor')
        terminal.write(CURSOR_SHOW, done)
      },
    }),
  })
  return { calls, unregister }
}

/** Settles the writes started with `void` (xterm parses on a timer). */
const settle = (terminal: Terminal) => write(terminal, '')

const OPTS: CreatePtyOptions = { id: 't1', cwd: '/w', type: 'terminal', agentPreset: 'claude-cli', shell: '/usr/bin/bash' }

afterEach(() => {
  resetLeftoverMouseTrackingRegistry()
  resetPtyReplayRegistry()
  vi.useRealTimers()
})

describe('the bug, as a real xterm sees it (BUG-233)', () => {
  test('hidden → ⏻ (T0950 leaves the alternate screen) → a new bash that sends no DECSET 25: still hidden', async () => {
    const terminal = await tuiOverHistory()
    expect(hidden(terminal)).toBe(true)
    await write(terminal, ALT_SCREEN_EXIT) // what T0950 writes once the new PTY is spawned
    await write(terminal, BASH_STARTUP)
    expect(terminal.buffer.active.type).toBe('normal')
    expect(hidden(terminal)).toBe(true)
  })

  test('the same on the normal screen (a TUI that hid the cursor without the alternate screen)', async () => {
    const terminal = await tuiOverHistory('\x1b[?25l')
    await write(terminal, BASH_STARTUP)
    expect(terminal.buffer.active.type).toBe('normal')
    expect(hidden(terminal)).toBe(true)
  })
})

describe('xtermCursorHidden', () => {
  test('reads xterm 5.5.0: false at start, true after DECRST 25, false after DECSET 25', async () => {
    const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
    expect(xtermCursorHidden(terminal)).toBe(false)
    await write(terminal, '\x1b[?25l')
    expect(xtermCursorHidden(terminal)).toBe(true)
    await write(terminal, CURSOR_SHOW)
    expect(xtermCursorHidden(terminal)).toBe(false)
  })

  test('another layout: undefined', () => {
    expect(xtermCursorHidden(null)).toBeUndefined()
    expect(xtermCursorHidden({})).toBeUndefined()
    expect(xtermCursorHidden({ _core: { coreService: { isCursorHidden: 1 } } })).toBeUndefined()
  })
})

describe('showLeftoverHiddenCursor', () => {
  test('cursor hidden: shown in xterm, resolved once parsed', async () => {
    const terminal = await tuiOverHistory('\x1b[?25l')
    const { calls } = registerView('t1', terminal)
    expect(await showLeftoverHiddenCursor('t1')).toBe(true)
    expect(calls).toEqual(['show-cursor'])
    expect(hidden(terminal)).toBe(false)
  })

  test('cursor visible (a plain shell): nothing written', async () => {
    const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
    await write(terminal, 'plain\r\n')
    const spy = vi.spyOn(terminal, 'write')
    const { calls } = registerView('t1', terminal)
    expect(await showLeftoverHiddenCursor('t1')).toBe(false)
    expect(calls).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  test('no mounted view, an unregistered one, a view without cursor support, or one that cannot tell: nothing', async () => {
    expect(await showLeftoverHiddenCursor('nobody')).toBe(false)
    const terminal = await tuiOverHistory()
    const { unregister } = registerView('t1', terminal)
    unregister()
    expect(await showLeftoverHiddenCursor('t1')).toBe(false)
    registerView('t2', terminal, { cursor: false }) // registered the T0950 way
    expect(await showLeftoverHiddenCursor('t2')).toBe(false)
    const shown: string[] = []
    registerLeftoverMouseTrackingView('t3', {
      mouseTrackingMode: () => 'none',
      reset: () => {},
      cursorHidden: () => undefined,
      showCursor: done => { shown.push('show'); done() },
    })
    expect(await showLeftoverHiddenCursor('t3')).toBe(false)
    expect(shown).toEqual([])
    expect(hidden(terminal)).toBe(true)
  })

  test('only its own id: another tab with a hidden cursor keeps it', async () => {
    const a = await tuiOverHistory()
    const b = await tuiOverHistory()
    registerView('a', a)
    registerView('b', b)
    await showLeftoverHiddenCursor('a')
    expect(hidden(a)).toBe(false)
    expect(hidden(b)).toBe(true)
  })

  test('a view that never reports it parsed (disposed meanwhile): resolves after the wait cap', async () => {
    vi.useFakeTimers()
    registerLeftoverMouseTrackingView('t1', {
      mouseTrackingMode: () => 'none',
      reset: () => {},
      cursorHidden: () => true,
      showCursor: () => { /* never done */ },
    })
    let resolved: boolean | null = null
    void showLeftoverHiddenCursor('t1').then(r => { resolved = r })
    await vi.advanceTimersByTimeAsync(LEFTOVER_MOUSE_RESET_WAIT_MS - 1)
    expect(resolved).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  test('a program running in the tab: its hidden cursor is untouched (nothing calls it outside a new PTY)', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await write(terminal, TUI_FRAME)
    expect(calls).toEqual([])
    expect(hidden(terminal)).toBe(true)
  })
})

describe('⏻ through restartOrCreatePty: cursor hidden → old program ends → new PTY', () => {
  test('restart ok: alternate screen left first, then the cursor shown; the new bash prompt has a cursor', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = {
      restart: vi.fn(async () => {
        // still hidden while the host kills the old program and spawns the new shell
        expect(hidden(terminal)).toBe(true)
        return true
      }),
      create: vi.fn(async () => ({ ok: true, created: true })),
    }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'restart', spawned: true })
    await settle(terminal)
    expect(calls).toEqual(['reset:before-new-pty', 'leave-alt', 'show-cursor'])
    expect(terminal.buffer.active.type).toBe('normal')
    expect(hidden(terminal)).toBe(false)
    await write(terminal, BASH_STARTUP)
    expect(hidden(terminal)).toBe(false)
  })

  test('DECRST 1049 is parsed before DECSET 25 (the order xterm received them)', async () => {
    const terminal = await tuiOverHistory()
    registerView('t1', terminal)
    const spy = vi.spyOn(terminal, 'write')
    await restartOrCreatePty(OPTS, { restart: vi.fn(async () => true), create: vi.fn() })
    await settle(terminal)
    const written = spy.mock.calls.map(c => c[0]).filter(d => d === ALT_SCREEN_EXIT || d === CURSOR_SHOW)
    expect(written).toEqual([ALT_SCREEN_EXIT, CURSOR_SHOW])
  })

  test('a later program of the new shell hides the cursor again: it stays hidden', async () => {
    const terminal = await tuiOverHistory()
    registerView('t1', terminal)
    await restartOrCreatePty(OPTS, { restart: vi.fn(async () => true), create: vi.fn() })
    await write(terminal, BASH_STARTUP + '\x1b[?25l') // e.g. the launch command's claude starting
    expect(hidden(terminal)).toBe(true)
  })

  test('PTY gone (restart → false): created anew, shown once', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => false), create: vi.fn(async () => ({ ok: true, created: true })) }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: true })
    await settle(terminal)
    expect(calls.filter(c => c === 'show-cursor')).toHaveLength(1)
    expect(hidden(terminal)).toBe(false)
  })

  test('a plain shell tab (cursor visible, normal screen, tracking off): ⏻ writes nothing to xterm', async () => {
    const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 5 })
    await write(terminal, '$ ls\r\n')
    const spy = vi.spyOn(terminal, 'write')
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => true), create: vi.fn(async () => ({ ok: true, created: true })) }
    await restartOrCreatePty({ ...OPTS, agentPreset: undefined }, api)
    expect(calls).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  test('restart failed: nothing shown', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => { throw new Error('boom') }), create: vi.fn() }
    expect(await restartOrCreatePty(OPTS, api)).toMatchObject({ ok: false, via: 'restart' })
    await settle(terminal)
    expect(calls).not.toContain('show-cursor')
    expect(hidden(terminal)).toBe(true)
  })
})

describe('createPtyWithReplay (claude-cli ⏻ / resume: kill, then startClaudeCliPty → createPtyThenLaunch)', () => {
  test('created: a new shell — the hidden cursor is the old program\'s and is shown, after the alternate screen is left', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: true }) })
    await settle(terminal)
    expect(calls).toEqual(['reset:new-pty-spawned', 'leave-alt', 'show-cursor'])
    expect(terminal.buffer.active.type).toBe('normal')
    expect(hidden(terminal)).toBe(false)
  })

  test('not created (the PTY survived, its program still runs): the hidden cursor is left alone', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(calls).toEqual([])
    expect(hidden(terminal)).toBe(true)
  })

  test('create failed: nothing', async () => {
    const terminal = await tuiOverHistory()
    const { calls } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(calls).toEqual([])
    expect(hidden(terminal)).toBe(true)
  })
})
