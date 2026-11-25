/**
 * PLAN-068 W2 / T0904 (T0902 §2.4 `reading`, GitHub #24): is the user reading a Tower tab?
 *
 * The renderer of a Tower tab that declared the BAT ↔ CT contract 2 tells the host (proxied
 * `terminal:reading-state { terminalId, reading }`, a boolean only) so the host delays a Worker
 * notification instead of moving the screen under the user (electron/notify-hold.ts):
 *
 *   - reading while: the normal buffer is scrolled up (`viewportY < baseY`), or text is selected
 *     (`setCondition`); or a wheel / PageUp / Shift+PageUp happened (`noteActivity`)
 *   - stays reading `TOWER_READING_LINGER_MS` after the last of them ended (「停手 10 s」)
 *   - T0917 / BUG-221 (D337), alt buffer only: a fullscreen program (claude, codex) scrolls itself and
 *     BAT cannot see where it is. After scrolling up there (`noteAltScroll` with a negative amount) the
 *     tab stays reading — no 10 s limit — until the user acts on the tab (`endAltScroll`: a key, a
 *     click, the tab hidden), scrolls back down as far as up (approximated by summing the amounts;
 *     then the 10 s linger starts), or the buffer switches (`setAltBuffer`). The normal buffer rules
 *     above are unchanged; `noteAltScroll` does nothing outside the alt buffer.
 *
 * The 60 s limit of the delay is the host's (it holds the notification, `NOTIFY_HOLD_READING_MAX_MS`).
 *
 * 🔴 No `electron` / DOM import; times and timers are injected (tests).
 */

export const TOWER_READING_LINGER_MS = 10_000

/** Why the alt-buffer "scrolled up" state ended (log only). */
export type AltScrollEndCause = 'key' | 'click' | 'inactive' | 'scrolled-back' | 'buffer-switch' | 'disabled'

/** Less than this many rows still up counts as scrolled back (pixel wheels give fractions of a row). */
const ALT_SCROLL_EPSILON_ROWS = 0.01

/** `WheelEvent.deltaMode` values (no DOM import). */
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

/**
 * T0917: a wheel event's vertical amount in terminal rows (negative = up), the way xterm 5.5 converts it
 * (`Viewport.getLinesScrolled`, without its partial-row carry): pixels / row height, lines as is, pages ×
 * rows. Shift (horizontal intent; xterm sends nothing) and Ctrl (BAT zoom) wheels → 0.
 */
export function wheelRows(
  e: { deltaY: number; deltaMode: number; shiftKey?: boolean; ctrlKey?: boolean },
  rowHeight: number,
  rows: number,
): number {
  if (!Number.isFinite(e.deltaY) || e.deltaY === 0 || e.shiftKey || e.ctrlKey) return 0
  if (e.deltaMode === DOM_DELTA_LINE) return e.deltaY
  if (e.deltaMode === DOM_DELTA_PAGE) return e.deltaY * Math.max(1, rows)
  return e.deltaY / (rowHeight > 0 ? rowHeight : 16)
}

const MODIFIER_ONLY_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'Super', 'Hyper', 'Fn', 'FnLock',
  'CapsLock', 'NumLock', 'ScrollLock', 'Symbol', 'SymbolLock',
])

/** T0917: `KeyboardEvent.key` of a modifier pressed alone — not a key typed into the tab. */
export function isModifierOnlyKey(key: string): boolean {
  return MODIFIER_ONLY_KEYS.has(key)
}

export interface TowerReadingDeps {
  /** The value changed (called only on a change). */
  report(reading: boolean): void
  /** The alt-buffer "scrolled up" state started / ended (log only; never the content). */
  onAltScroll?(event: { active: boolean; cause?: AltScrollEndCause }): void
  now?(): number
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

export class TowerReadingTracker {
  private condition = false
  /** ms when the condition ended or the last activity happened; null = never. */
  private lastActiveAt: number | null = null
  private reported = false
  private timer: unknown = null
  private enabled = false
  /** The active buffer is the alternate one (a fullscreen program). */
  private alt = false
  /** T0917: rows scrolled up in the alt buffer, not yet scrolled back; > 0 = reading. */
  private altUp = 0
  private readonly now: () => number

  constructor(private readonly deps: TowerReadingDeps) {
    this.now = deps.now ?? (() => Date.now())
  }

  /** On only for a Tower tab of contract 2; turning it off reports `false` once if needed. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return
    this.enabled = enabled
    if (!enabled) {
      this.clearPending()
      this.condition = false
      this.lastActiveAt = null
      this.endAlt('disabled')
      this.publish(false)
      return
    }
    this.evaluate()
  }

  /** Scrolled up in the normal buffer, or a selection — true while it lasts. */
  setCondition(active: boolean): void {
    if (active === this.condition) return
    this.condition = active
    if (!active) this.lastActiveAt = this.now()
    this.evaluate()
  }

  /** A wheel / PageUp / Shift+PageUp now. */
  noteActivity(): void {
    this.lastActiveAt = this.now()
    this.evaluate()
  }

  /** The active buffer changed; a switch either way ends the alt "scrolled up" state (no linger added). */
  setAltBuffer(alt: boolean): void {
    if (alt === this.alt) return
    this.alt = alt
    if (this.endAlt('buffer-switch')) this.evaluate()
  }

  /**
   * T0917: the user scrolled the alt buffer by `rows` (negative = up; a wheel, PageUp / PageDown).
   * Up starts / extends the "scrolled up" state; down counts against it, and once it is scrolled back as
   * far as it went up the state ends and the 10 s linger starts. Outside the alt buffer: nothing.
   */
  noteAltScroll(rows: number): void {
    if (!this.enabled || !this.alt || !Number.isFinite(rows) || rows === 0) return
    if (rows < 0) {
      const started = this.altUp === 0
      this.altUp += -rows
      if (started) this.notifyAlt({ active: true })
      this.evaluate()
      return
    }
    if (this.altUp === 0) return
    this.altUp -= rows
    if (this.altUp >= ALT_SCROLL_EPSILON_ROWS) return
    this.altUp = 0
    this.lastActiveAt = this.now()
    this.notifyAlt({ active: false, cause: 'scrolled-back' })
    this.evaluate()
  }

  /**
   * T0917: the user acted on the tab (a key, a click) or the tab was hidden: the alt "scrolled up" state
   * ends without a linger of its own (the 10 s after the last wheel / PageUp still applies).
   */
  endAltScroll(cause: Exclude<AltScrollEndCause, 'scrolled-back' | 'buffer-switch' | 'disabled'>): void {
    if (this.endAlt(cause)) this.evaluate()
  }

  /** The alt buffer is scrolled up (T0917). */
  get altScrolledUp(): boolean {
    return this.altUp > 0
  }

  get reading(): boolean {
    return this.reported
  }

  dispose(): void {
    this.clearPending()
    this.enabled = false
  }

  private evaluate(): void {
    if (!this.enabled) return
    this.clearPending()
    if (this.condition || this.altUp > 0) {
      this.publish(true)
      return
    }
    const since = this.lastActiveAt
    const left = since === null ? 0 : since + TOWER_READING_LINGER_MS - this.now()
    if (left > 0) {
      this.publish(true)
      this.timer = this.setTimer(() => {
        this.timer = null
        this.evaluate()
      }, left)
      return
    }
    this.publish(false)
  }

  /** Ends the alt "scrolled up" state; true when it was on. */
  private endAlt(cause: AltScrollEndCause): boolean {
    if (this.altUp === 0) return false
    this.altUp = 0
    this.notifyAlt({ active: false, cause })
    return true
  }

  private notifyAlt(event: { active: boolean; cause?: AltScrollEndCause }): void {
    try {
      this.deps.onAltScroll?.(event)
    } catch { /* logging only */ }
  }

  private publish(reading: boolean): void {
    if (reading === this.reported) return
    this.reported = reading
    try {
      this.deps.report(reading)
    } catch { /* reporting only */ }
  }

  private clearPending(): void {
    if (this.timer === null) return
    if (this.deps.clearTimer) this.deps.clearTimer(this.timer)
    else clearTimeout(this.timer as ReturnType<typeof setTimeout>)
    this.timer = null
  }

  private setTimer(fn: () => void, ms: number): unknown {
    return this.deps.setTimer ? this.deps.setTimer(fn, ms) : setTimeout(fn, ms)
  }
}
