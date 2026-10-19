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
 * Pure functions, no DOM / electron.
 */

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
