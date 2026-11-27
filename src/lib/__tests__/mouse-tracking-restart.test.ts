/**
 * BUG-229 / T0947: ⏻ on a claude-cli tab killed claude with any-event tracking on; the same xterm kept
 * sending `ESC [ < 35 ; x ; y M` for every pointer move, into the new shell, ahead of the launch
 * command (`35;77;25M35;78;25M<command>` → `command not found`). The tracking the old program left on
 * is now turned off in the tab's own xterm before the new PTY starts and once it runs.
 *
 * Real xterm 5.5.0 instances: the reports are the ones its CoreMouseService encodes for a pointer move.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Terminal } from '@xterm/xterm'
import type { CreatePtyOptions } from '../../types'
import {
  LEFTOVER_MOUSE_RESET_WAIT_MS,
  MOUSE_REPORT_ECHO_WINDOW_MS,
  MOUSE_TRACKING_RESET,
  MouseReportEchoDetector,
  registerLeftoverMouseTrackingView,
  resetLeftoverMouseTracking,
  resetLeftoverMouseTrackingRegistry,
  type LeftoverMouseTrackingReason,
} from '../mouse-tracking-reset'
import { createPtyWithReplay, resetPtyReplayRegistry, restartOrCreatePty } from '../pty-replay'

/** What the claude CLI turns on (T0573): normal + button + any-event tracking, SGR encoding. */
const CLAUDE_TRACKING = '\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h'

async function realXterm(modes = ''): Promise<Terminal> {
  const terminal = new Terminal({ allowProposedApi: true, cols: 120, rows: 30 })
  if (modes) await write(terminal, modes)
  return terminal
}

const write = (terminal: Terminal, data: string) => new Promise<void>(resolve => terminal.write(data, resolve))

/** The pointer moving to 0-based (col, row) with no button down: xterm 5.5.0 `CoreMouseService.triggerMouseEvent`. */
function pointerMove(terminal: Terminal, col: number, row: number): void {
  const core = (terminal as unknown as { _core: { coreMouseService: { triggerMouseEvent(e: object): boolean } } })._core
  // CoreMouseButton.NONE = 3, CoreMouseAction.MOVE = 32
  core.coreMouseService.triggerMouseEvent({ col, row, x: 0, y: 0, button: 3, action: 32, ctrl: false, alt: false, shift: false })
}

/** The tab's view as TerminalPanel registers it: its xterm's mode, `MOUSE_TRACKING_RESET` written to that xterm. */
function registerView(id: string, terminal: Terminal) {
  const resets: LeftoverMouseTrackingReason[] = []
  const unregister = registerLeftoverMouseTrackingView(id, {
    mouseTrackingMode: () => terminal.modes.mouseTrackingMode,
    reset: (reason, done) => {
      resets.push(reason)
      terminal.write(MOUSE_TRACKING_RESET, done)
    },
  })
  return { resets, unregister }
}

/** What xterm sends to the PTY (TerminalPanel's `onData` → `pty:write`). */
function ptyInput(terminal: Terminal): string[] {
  const sent: string[] = []
  terminal.onData(data => sent.push(data))
  return sent
}

const OPTS: CreatePtyOptions = { id: 't1', cwd: '/w', type: 'terminal', agentPreset: 'claude-cli', shell: '/usr/bin/bash' }

afterEach(() => {
  resetLeftoverMouseTrackingRegistry()
  resetPtyReplayRegistry()
  vi.useRealTimers()
})

describe('the bug, as a real xterm sees it (BUG-229)', () => {
  test('tracking the killed program left on: every pointer move is still a report for whatever PTY comes next', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const sent = ptyInput(terminal)
    // the program is gone; nothing in xterm knows — it is the same Terminal instance after ⏻
    pointerMove(terminal, 76, 24)
    pointerMove(terminal, 77, 24)
    expect(terminal.modes.mouseTrackingMode).toBe('any')
    expect(sent).toEqual(['\x1b[<35;77;25M', '\x1b[<35;78;25M'])
  })
})

describe('resetLeftoverMouseTracking', () => {
  test('tracking on: turned off in xterm, resolved once parsed; a pointer move after that sends nothing', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const sent = ptyInput(terminal)
    const { resets } = registerView('t1', terminal)
    expect(await resetLeftoverMouseTracking('t1', 'before-new-pty')).toBe(true)
    expect(resets).toEqual(['before-new-pty'])
    expect(terminal.modes.mouseTrackingMode).toBe('none')
    pointerMove(terminal, 10, 5)
    expect(sent).toEqual([])
  })

  test('tracking off (a plain shell): nothing written, nothing reset', async () => {
    const terminal = await realXterm()
    const spy = vi.spyOn(terminal, 'write')
    const { resets } = registerView('t1', terminal)
    expect(await resetLeftoverMouseTracking('t1', 'before-new-pty')).toBe(false)
    expect(resets).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  test('no mounted view for the id (or unregistered): nothing', async () => {
    expect(await resetLeftoverMouseTracking('nobody', 'new-pty-spawned')).toBe(false)
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { unregister } = registerView('t1', terminal)
    unregister()
    expect(await resetLeftoverMouseTracking('t1', 'new-pty-spawned')).toBe(false)
    expect(terminal.modes.mouseTrackingMode).toBe('any')
  })

  test('only its own id: another tab with tracking on keeps it', async () => {
    const a = await realXterm(CLAUDE_TRACKING)
    const b = await realXterm(CLAUDE_TRACKING)
    registerView('a', a)
    registerView('b', b)
    await resetLeftoverMouseTracking('a', 'before-new-pty')
    expect(a.modes.mouseTrackingMode).toBe('none')
    expect(b.modes.mouseTrackingMode).toBe('any')
  })

  test('a view that never reports the reset parsed (disposed meanwhile): resolves after the wait cap', async () => {
    vi.useFakeTimers()
    registerLeftoverMouseTrackingView('t1', { mouseTrackingMode: () => 'any', reset: () => { /* never done */ } })
    let resolved: boolean | null = null
    void resetLeftoverMouseTracking('t1', 'before-new-pty').then(r => { resolved = r })
    await vi.advanceTimersByTimeAsync(LEFTOVER_MOUSE_RESET_WAIT_MS - 1)
    expect(resolved).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  test('a program running in the tab: its reports are untouched (nothing calls the reset outside a new PTY)', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const sent = ptyInput(terminal)
    const { resets } = registerView('t1', terminal)
    pointerMove(terminal, 10, 5)
    pointerMove(terminal, 11, 5)
    expect(sent).toEqual(['\x1b[<35;11;6M', '\x1b[<35;12;6M'])
    expect(resets).toEqual([])
    expect(terminal.modes.mouseTrackingMode).toBe('any')
  })
})

describe('⏻ through restartOrCreatePty: tracking on → old program ends → new PTY → pointer moves', () => {
  test('no report reaches the new shell, before or after the spawn; the next program turns tracking on again', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const sent = ptyInput(terminal)
    const { resets } = registerView('t1', terminal)
    const api = {
      // the host kills the old program and spawns the new shell while the pointer keeps moving
      restart: vi.fn(async () => {
        pointerMove(terminal, 76, 24)
        pointerMove(terminal, 77, 24)
        return true
      }),
      create: vi.fn(async () => ({ ok: true, created: true })),
    }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'restart', spawned: true })
    expect(resets).toEqual(['before-new-pty']) // tracking already off at the spawn: nothing left to reset
    pointerMove(terminal, 84, 21)
    expect(sent).toEqual([])
    // the launch command the renderer types 500 ms later is the only input: nothing in front of it
    terminal.input('claude --name=x\r')
    expect(sent).toEqual(['claude --name=x\r'])
    // the new claude turns tracking on itself; its reports go out byte for byte as before
    await write(terminal, CLAUDE_TRACKING)
    pointerMove(terminal, 10, 5)
    expect(sent.at(-1)).toBe('\x1b[<35;11;6M')
  })

  test('the old program turned tracking on again on its way out: reset again once the new PTY runs', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { resets } = registerView('t1', terminal)
    const api = {
      restart: vi.fn(async () => {
        await write(terminal, CLAUDE_TRACKING) // late output of the killed program (e.g. a focus redraw)
        return true
      }),
      create: vi.fn(async () => ({ ok: true, created: true })),
    }
    await restartOrCreatePty(OPTS, api)
    await vi.waitFor(() => expect(terminal.modes.mouseTrackingMode).toBe('none'))
    expect(resets).toEqual(['before-new-pty', 'new-pty-spawned'])
  })

  test('PTY gone (restart → false): created anew; tracking off before and checked again after the spawn', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { resets } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => false), create: vi.fn(async () => ({ ok: true, created: true })) }
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: true })
    expect(resets).toEqual(['before-new-pty'])
    expect(terminal.modes.mouseTrackingMode).toBe('none')
  })

  test('a plain shell tab (tracking off): ⏻ writes nothing to xterm', async () => {
    const terminal = await realXterm()
    const spy = vi.spyOn(terminal, 'write')
    const { resets } = registerView('t1', terminal)
    const api = { restart: vi.fn(async () => true), create: vi.fn(async () => ({ ok: true, created: true })) }
    await restartOrCreatePty({ ...OPTS, agentPreset: undefined }, api)
    expect(resets).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('createPtyWithReplay (claude-cli ⏻: kill, then startClaudeCliPty → createPtyThenLaunch)', () => {
  test('created: a new shell — tracking still on is the old program\'s and goes', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { resets } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: true }) })
    await vi.waitFor(() => expect(terminal.modes.mouseTrackingMode).toBe('none'))
    expect(resets).toEqual(['new-pty-spawned'])
  })

  test('not created (the PTY survived, its program still runs): tracking is left alone', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { resets } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(resets).toEqual([])
    expect(terminal.modes.mouseTrackingMode).toBe('any')
  })

  test('create failed: nothing', async () => {
    const terminal = await realXterm(CLAUDE_TRACKING)
    const { resets } = registerView('t1', terminal)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false }) })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(resets).toEqual([])
  })
})

/**
 * Why the T0672 echo detector missed it: Git Bash (UCRT64) under ConPTY, measured with node-pty in
 * T0947 (`bash --login -i`, reports written to its input). readline flashes the screen (`?5h` …
 * `?5l`, ~100 ms) for every sequence it does not know, then echoes the rest, one report after the
 * other; what was typed ahead is echoed only once the shell reads its input.
 */
describe('T0672 detector and Git Bash echo timing (measured, T0947)', () => {
  const move = (x: number, y: number) => `\x1b[<35;${x};${y}M`

  /** The measured output after the two reports typed ahead at 66 ms (shell up at ~430 ms). */
  const TYPEAHEAD_OUTPUT: Array<[number, string]> = [
    [426, '\x1b[?2004h'],
    [436, '\x1b[32m\r\nuser@host \x1b[35mUCRT64 \x1b[33m/tmp\x1b[m\r\n$ '],
    [533, '\x1b[?5h'],
    [545, '35;77;25M'],
    [638, '\x1b[?5l'],
    [654, '35;78;25M'],
  ]

  test('typed ahead while the shell starts: each echo comes ~110 ms after the one before, from the shell\'s start on', () => {
    // the first report (echoed 479 ms after it was sent) is just inside the window
    const first = new MouseReportEchoDetector()
    first.noteInput(move(77, 25), 66, true)
    expect(TYPEAHEAD_OUTPUT.slice(0, 4).map(([t, out]) => first.noteOutput(out, t, true))).toEqual([false, false, false, true])
    // the second (588 ms) is not: with a shell that starts slower, or more reports, none is found
    const second = new MouseReportEchoDetector()
    second.noteInput(move(78, 25), 66, true)
    expect(654 - 66).toBeGreaterThan(MOUSE_REPORT_ECHO_WINDOW_MS)
    expect(TYPEAHEAD_OUTPUT.map(([t, out]) => second.noteOutput(out, t, true))).toEqual([false, false, false, false, false, false])
  })

  test('at an idle prompt (sent at 4025 ms, echoed at 4164 ms): found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(90, 25), 4025, true)
    expect(d.noteOutput('\x1b[?5h', 4044, true)).toBe(false)
    expect(d.noteOutput('\x1b[?5l', 4148, true)).toBe(false)
    expect(d.noteOutput('35;90;25M', 4164, true)).toBe(true)
  })
})

describe('source guards (WorkspaceView claude-cli ⏻ / resume)', () => {
  const view = readFileSync(join(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')

  test('the leftover tracking is reset before the kill, the kill before startClaudeCliPty', () => {
    const restart = view.slice(view.indexOf('const handleRestart = useCallback('))
    const r = restart.indexOf("await resetLeftoverMouseTracking(id, 'before-new-pty')")
    expect(r).toBeGreaterThan(-1)
    expect(restart.indexOf('await window.electronAPI.pty.kill(id)')).toBeGreaterThan(r)
    expect(restart.indexOf('await startClaudeCliPty(id,')).toBeGreaterThan(restart.indexOf('await window.electronAPI.pty.kill(id)'))

    const resume = view.slice(view.indexOf('registerTabResumeHandler(workspace.id'))
    const rr = resume.indexOf("await resetLeftoverMouseTracking(terminal.id, 'before-new-pty')")
    expect(rr).toBeGreaterThan(-1)
    expect(resume.indexOf('await window.electronAPI.pty.kill(terminal.id)')).toBeGreaterThan(rr)
  })
})
