/**
 * Turning off mouse tracking a program left on (BUG-166 / T0672).
 *
 * A TUI that tracks the mouse (codex 0.163.0: DECSET 1000 + 1002 + 1003 + 1006) and is ended by a
 * signal or crashes does not send the DECRSTs (T0671: codex on SIGINT / SIGTERM / SIGHUP / SIGKILL;
 * the claude CLI only on SIGKILL). xterm keeps tracking, so every pointer move and wheel step is
 * written to the shell as an SGR report (`ESC [ < 35 ; 52 ; 69 M`); zsh and bash drop `ESC [ <`
 * and type the rest into the command line (`35;52;69M35;55;66M…`).
 *
 * BAT does not need to know how the program ended: a report it just sent coming back as text in
 * the output means nothing reads the mouse, so the tab turns tracking off in its own xterm
 * (`MOUSE_TRACKING_RESET`, written to xterm only, never to the PTY). The right-click menu offers
 * the same reset by hand. Only "tracking on and the program echoes its input as is" matches; codex
 * and the claude CLI read the reports and never echo them.
 *
 * BUG-229 / T0947: ⏻ (and the interrupted-agent resume) ends the program and starts a new shell in
 * the same xterm. A program killed there (the claude CLI: `taskkill /F`) leaves tracking on, and the
 * reports of the pointer moving over the tab went into the new shell before the launch command, so
 * the command came out as `35;77;25M35;78;25M<command>` and failed. The echo detector above misses
 * them: the shell only echoes what was typed ahead once it reads its input (after its startup or the
 * commands it runs), later than `MOUSE_REPORT_ECHO_WINDOW_MS`. So BAT turns the leftover tracking off
 * itself, in the tab's own xterm, before the new PTY is spawned (`resetLeftoverMouseTracking`) and
 * again once it runs (late output of the old program). Only while tracking is on; never the PTY.
 *
 * No DOM / electron.
 */
import { isMouseTrackingOn } from './terminal-context-menu'

/** DECRST for every mouse mode xterm knows: X10 / normal / button / any-event tracking, SGR, urxvt, SGR-pixels. */
export const MOUSE_TRACKING_RESET = '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l'

/** Leaves the alternate screen (DECRST 1049); the menu offers it apart from the mouse reset. */
export const ALT_SCREEN_EXIT = '\x1b[?1049l'

/** A report counts as echoed when its text appears in the output within this long after it was sent. */
export const MOUSE_REPORT_ECHO_WINDOW_MS = 500

/** Reports remembered at once (any-event tracking sends one per pointer move). */
const MAX_PENDING_REPORTS = 64
/** Output kept for matching, so a report echoed across several output chunks still matches. */
const MAX_OUTPUT_TAIL_CHARS = 2048

const SGR_MOUSE_REPORT = /\x1b\[<(\d+;\d+;\d+[Mm])/g

/** The bodies (`35;52;69M`, without `ESC [ <`) of the SGR mouse reports in what xterm sends. */
export function sgrMouseReportBodies(data: string): string[] {
  return Array.from(data.matchAll(SGR_MOUSE_REPORT), m => m[1])
}

/**
 * Output as text to look for an echoed report in: escape sequences (CSI, OSC, other ESC pairs) and
 * control characters removed. Shells put some between the echoed characters: bash a BEL for the
 * `ESC [ <` it does not know (`^G35;52;69M`), zsh a backspace (`3^H35;…`), line editors colours.
 * Removing CSI also keeps an SGR colour such as `ESC [ 48;2;0;52;69 m` from matching `0;52;69m`.
 */
export function echoMatchText(output: string): string {
  return output
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
}

/**
 * Whether the mouse reports a tab sends come back as text in its output (F1). `noteInput` with
 * what xterm sends (`onData`), `noteOutput` with what the PTY writes; `noteOutput` is true once a
 * report sent at most `windowMs` before shows up, and the state starts over after that.
 * `tracking` = xterm's mouse tracking is on at that moment; with it off nothing is noted or found.
 */
export class MouseReportEchoDetector {
  /** body → when it was last sent; insertion order = oldest first */
  private readonly reports = new Map<string, number>()
  private tail = ''

  constructor(private readonly windowMs = MOUSE_REPORT_ECHO_WINDOW_MS) {}

  noteInput(data: string, now: number, tracking: boolean): void {
    if (!tracking) return
    for (const body of sgrMouseReportBodies(data)) {
      this.reports.delete(body)
      this.reports.set(body, now)
      if (this.reports.size > MAX_PENDING_REPORTS) this.reports.delete(this.reports.keys().next().value!)
    }
  }

  noteOutput(data: string, now: number, tracking: boolean): boolean {
    for (const [body, sentAt] of this.reports) {
      if (now - sentAt > this.windowMs) this.reports.delete(body)
    }
    if (!tracking || this.reports.size === 0) {
      this.clear()
      return false
    }
    this.tail = (this.tail + data).slice(-MAX_OUTPUT_TAIL_CHARS)
    const text = echoMatchText(this.tail)
    for (const body of this.reports.keys()) {
      if (text.includes(body)) {
        this.clear()
        return true
      }
    }
    return false
  }

  clear(): void {
    this.reports.clear()
    this.tail = ''
  }
}

/**
 * BUG-229 / T0947: why a new PTY's tracking reset runs — `before-new-pty`: the old program is about
 * to end (⏻, the interrupted-agent resume); `new-pty-spawned`: a new shell has just been spawned.
 */
export type LeftoverMouseTrackingReason = 'before-new-pty' | 'new-pty-spawned'

/** A mounted terminal view (TerminalPanel): its xterm's tracking mode, and its reset. */
export interface LeftoverMouseTrackingView {
  /** xterm's `modes.mouseTrackingMode` now. */
  mouseTrackingMode(): unknown
  /** Turns tracking off in this xterm (`MOUSE_TRACKING_RESET`); `done` once xterm has parsed it. */
  reset(reason: LeftoverMouseTrackingReason, done: () => void): void
}

/** Longest wait for xterm to parse the reset (a view disposed meanwhile never calls `done`). */
export const LEFTOVER_MOUSE_RESET_WAIT_MS = 200

const leftoverViews = new Map<string, LeftoverMouseTrackingView>()

/** TerminalPanel hook-up. Returns unregister. */
export function registerLeftoverMouseTrackingView(id: string, view: LeftoverMouseTrackingView): () => void {
  leftoverViews.set(id, view)
  return () => {
    if (leftoverViews.get(id) === view) leftoverViews.delete(id)
  }
}

/**
 * BUG-229 / T0947: a new PTY replaces the program in terminal `id`'s xterm — turn off the mouse
 * tracking the old program left on, so no report reaches the new shell. Nothing when no view is
 * mounted or tracking is off (a plain shell). Resolves true after the reset was parsed by xterm (a
 * report from a pointer move after that can no longer be sent), false when nothing was done.
 * Callers: `restartOrCreatePty` / `createPtyWithReplay` (created) in pty-replay, and WorkspaceView
 * before the `pty:kill` of a claude-cli tab's ⏻ / interrupted-agent resume (then `startClaudeCliPty`).
 */
export function resetLeftoverMouseTracking(id: string, reason: LeftoverMouseTrackingReason): Promise<boolean> {
  const view = leftoverViews.get(id)
  if (!view || !isMouseTrackingOn(view.mouseTrackingMode())) return Promise.resolve(false)
  return new Promise<boolean>(resolve => {
    const timer = setTimeout(() => resolve(true), LEFTOVER_MOUSE_RESET_WAIT_MS)
    view.reset(reason, () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/** Test helper. */
export function resetLeftoverMouseTrackingRegistry(): void {
  leftoverViews.clear()
}
