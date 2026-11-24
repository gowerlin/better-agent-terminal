/**
 * PLAN-068 W2 / T0904 (T0902 §2.4 `reading`, GitHub #24): is the user reading a Tower tab?
 *
 * The renderer of a Tower tab that declared the BAT ↔ CT contract 2 tells the host (proxied
 * `terminal:reading-state { terminalId, reading }`, a boolean only) so the host delays a Worker
 * notification instead of moving the screen under the user (electron/notify-hold.ts):
 *
 *   - reading while: the normal buffer is scrolled up (`viewportY < baseY`), or text is selected
 *     (`setCondition`); or a wheel / PageUp / Shift+PageUp happened (`noteActivity`) — in fullscreen
 *     BAT cannot see claude's own scrolling, only those events
 *   - stays reading `TOWER_READING_LINGER_MS` after the last of them ended (「停手 10 s」)
 *
 * The 60 s limit of the delay is the host's (it holds the notification, `NOTIFY_HOLD_READING_MAX_MS`).
 *
 * 🔴 No `electron` / DOM import; times and timers are injected (tests).
 */

/** After the last reading signal ended, still reading this long. */
export const TOWER_READING_LINGER_MS = 10_000

export interface TowerReadingDeps {
  /** The value changed (called only on a change). */
  report(reading: boolean): void
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
    if (this.condition) {
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
