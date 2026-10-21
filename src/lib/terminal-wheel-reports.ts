/**
 * Wheel → mouse reports for codex tabs (T0698 / BUG-165).
 *
 * codex (0.163) takes the mouse on its alternate screen (DECSET 1000 + 1002 + 1003 + 1006) and
 * scrolls `tui.mouse_scroll_speed` lines (default 1) per wheel report. xterm.js 5.5.0 sends at
 * most one report per `wheel` event (`Terminal.bindMouse` → `sendEvent`: one
 * `triggerMouseEvent` whatever `Viewport.getLinesScrolled` returns), so the extra lines of a
 * trackpad's high-rate pixel deltas and of its momentum are dropped and codex scrolls slower
 * than claude's tab. iTerm2 sends as many reports as lines scrolled.
 *
 * In a codex tab on the alternate screen with wheel-reporting tracking and SGR encoding, BAT's
 * `attachCustomWheelEventHandler` sends one report per whole line instead (the fraction carried
 * to the next event, at most `MAX_WHEEL_REPORTS_PER_EVENT` per event) and xterm sends none. Every
 * other case (any other tab, normal buffer, no tracking, X10, non-SGR encoding, Shift, no
 * vertical delta) goes to xterm unchanged.
 *
 * The reports are the bytes xterm writes for a wheel event (xterm 5.5.0 `CoreMouseService`
 * `eventCode` + `DEFAULT_ENCODINGS.SGR`, coordinates as `MouseService.getMouseReportCoords`) and
 * go out through `terminal.input(report, true)`, the same `CoreService.triggerDataEvent(…, true)`
 * → `onData` path, so `MouseReportEchoDetector` (T0672) sees them.
 *
 * Pure functions, no DOM / xterm import; TerminalPanel wires them up.
 */

/** Reports sent for one wheel event at most; more lines than this are dropped (with the fraction). */
export const MAX_WHEEL_REPORTS_PER_EVENT = 8

/** `WheelEvent.DOM_DELTA_*` (jsdom-safe copies). */
export const DOM_DELTA_PIXEL = 0
export const DOM_DELTA_LINE = 1
export const DOM_DELTA_PAGE = 2

/** xterm tracking modes that report the wheel (X10 reports presses only). */
const WHEEL_TRACKING_MODES = new Set(['vt200', 'drag', 'any'])

/**
 * Whether the tab runs codex in its terminal: its agent preset is Codex CLI. Helper-dispatched codex
 * Workers have no `agentPreset` (`addExternalTerminal`), so they keep xterm's handling (T0698 Q-1).
 */
export function isCodexTerminal(agentPreset: string | undefined): boolean {
  return agentPreset === 'codex-cli'
}

export interface WheelReportConditions {
  /** `TerminalInstance.agentPreset`. */
  agentPreset: string | undefined
  /** `terminal.buffer.active.type`. */
  bufferType: string
  /** `terminal.modes.mouseTrackingMode`. */
  mouseTrackingMode: string
  /** `mouseReportEncoding(terminal)`. */
  mouseEncoding: string | undefined
}

/** Whether BAT sends this tab's wheel reports itself; false = xterm handles the event as before. */
export function shouldSendWheelReports(c: WheelReportConditions): boolean {
  return isCodexTerminal(c.agentPreset)
    && c.bufferType === 'alternate'
    && WHEEL_TRACKING_MODES.has(c.mouseTrackingMode)
    && c.mouseEncoding === 'SGR'
}

/**
 * xterm's active mouse encoding (`DEFAULT` / `SGR` / `SGR_PIXELS`). The public API has no field for
 * it (`terminal.modes` gives the protocol only), so this reads xterm 5.5.0's
 * `_core.coreMouseService.activeEncoding`; anything else (another xterm layout) is `undefined`,
 * which turns BAT's handling off rather than guessing.
 */
export function mouseReportEncoding(terminal: unknown): string | undefined {
  const encoding = (terminal as { _core?: { coreMouseService?: { activeEncoding?: unknown } } } | null)
    ?._core?.coreMouseService?.activeEncoding
  return typeof encoding === 'string' ? encoding : undefined
}

export type WheelInput = Pick<WheelEvent, 'deltaY' | 'deltaMode' | 'shiftKey' | 'altKey' | 'ctrlKey'>

export interface WheelScrollOptions {
  /** CSS px of one row (`.xterm-screen` height ÷ rows). */
  rowHeight: number
  rows: number
  /** xterm options; defaults as xterm's. */
  scrollSensitivity?: number
  fastScrollSensitivity?: number
  fastScrollModifier?: 'none' | 'alt' | 'ctrl' | 'shift'
}

/**
 * Lines one wheel event scrolls (signed, fractional; > 0 = down). The same sensitivity and
 * `deltaMode` handling as xterm 5.5.0 `Viewport._applyScrollModifier` / `getLinesScrolled`
 * (pixel ÷ row height, line as is, page × rows); 0 when xterm would scroll nothing (no vertical
 * delta, or Shift held).
 */
export function wheelLines(ev: WheelInput, opts: WheelScrollOptions): number {
  if (ev.deltaY === 0 || ev.shiftKey) return 0
  const sensitivity = opts.scrollSensitivity ?? 1
  const modifier = opts.fastScrollModifier ?? 'alt'
  const fast = (modifier === 'alt' && ev.altKey) || (modifier === 'ctrl' && ev.ctrlKey)
  let amount = ev.deltaY * sensitivity * (fast ? opts.fastScrollSensitivity ?? 5 : 1)
  if (ev.deltaMode === DOM_DELTA_PIXEL) {
    if (!(opts.rowHeight > 0)) return 0
    amount /= opts.rowHeight
  } else if (ev.deltaMode === DOM_DELTA_PAGE) {
    amount *= opts.rows
  }
  return Number.isFinite(amount) ? amount : 0
}

/**
 * Whole lines to report per event, the fraction carried to the next one. A change of direction
 * drops the carried fraction; more than `max` lines are cut to `max` and the fraction dropped, so
 * a burst (momentum) does not build up a backlog.
 */
export class WheelLineAccumulator {
  private partial = 0

  constructor(private readonly max = MAX_WHEEL_REPORTS_PER_EVENT) {}

  /** Signed whole lines for this event (|result| ≤ max). */
  take(lines: number): number {
    if (lines === 0 || !Number.isFinite(lines)) return 0
    if (this.partial !== 0 && Math.sign(this.partial) !== Math.sign(lines)) this.partial = 0
    const total = this.partial + lines
    const whole = Math.trunc(total) || 0 // no -0
    if (Math.abs(whole) > this.max) {
      this.partial = 0
      return Math.sign(whole) * this.max
    }
    this.partial = total - whole
    return whole
  }

  reset(): void {
    this.partial = 0
  }
}

export interface WheelReportCell {
  /** 1-based, as in the report. */
  col: number
  row: number
}

export interface ScreenGeometry {
  /** `.xterm-screen` `getBoundingClientRect()` left / top / width / height. */
  left: number
  top: number
  width: number
  height: number
  /** Its computed `padding-left` / `padding-top` (px). */
  paddingLeft: number
  paddingTop: number
  cols: number
  rows: number
}

/**
 * The cell under the pointer, 1-based, as xterm 5.5.0 `MouseService.getMouseReportCoords` +
 * `CoreMouseService.triggerMouseEvent` compute it (offset in the screen element, clamped to the
 * canvas, ÷ cell size, + 1); null when xterm would send no report (no size yet, out of range).
 */
export function wheelReportCell(ev: Pick<MouseEvent, 'clientX' | 'clientY'>, g: ScreenGeometry): WheelReportCell | null {
  if (!(g.width > 0) || !(g.height > 0) || !(g.cols > 0) || !(g.rows > 0)) return null
  const x = Math.min(Math.max(ev.clientX - g.left - (g.paddingLeft || 0), 0), g.width - 1)
  const y = Math.min(Math.max(ev.clientY - g.top - (g.paddingTop || 0), 0), g.height - 1)
  const col = Math.floor(x / (g.width / g.cols))
  const row = Math.floor(y / (g.height / g.rows))
  if (col < 0 || col >= g.cols || row < 0 || row >= g.rows) return null
  return { col: col + 1, row: row + 1 }
}

/**
 * One SGR wheel report, byte for byte as xterm 5.5.0 writes it: `CSI < Pb ; Px ; Py M`, Pb = 64
 * (wheel) | 0 up / 1 down | 16 Ctrl | 8 Alt. Shift (4) never occurs: xterm scrolls nothing with
 * Shift held (`wheelLines` = 0), so no report.
 */
export function sgrWheelReport(direction: 'up' | 'down', cell: WheelReportCell, mods: Pick<WheelEvent, 'ctrlKey' | 'altKey'>): string {
  const code = 64 | (direction === 'down' ? 1 : 0) | (mods.ctrlKey ? 16 : 0) | (mods.altKey ? 8 : 0)
  return `\x1b[<${code};${cell.col};${cell.row}M`
}

export interface WheelReportPlan {
  /** Reports to send, in order (empty = this event scrolls less than a line so far). */
  reports: string[]
  /** Signed lines this event added (before the carry), for the log. */
  lines: number
}

/**
 * The reports for one wheel event BAT handles; null = hand the event to xterm: no vertical delta
 * or Shift held (xterm scrolls nothing), or no geometry yet (xterm sends nothing either).
 * Direction as xterm: `deltaY < 0` = up.
 */
export function planWheelReports(
  ev: WheelInput & Pick<MouseEvent, 'clientX' | 'clientY'>,
  geometry: ScreenGeometry,
  scroll: Omit<WheelScrollOptions, 'rowHeight' | 'rows'>,
  accumulator: WheelLineAccumulator,
): WheelReportPlan | null {
  if (ev.deltaY === 0 || ev.shiftKey) return null
  const cell = wheelReportCell(ev, geometry)
  if (!cell) return null
  const lines = wheelLines(ev, { ...scroll, rowHeight: geometry.height / geometry.rows, rows: geometry.rows })
  const whole = accumulator.take(lines)
  const report = sgrWheelReport(ev.deltaY < 0 ? 'up' : 'down', cell, ev)
  return { reports: Array.from({ length: Math.abs(whole) }, () => report), lines }
}
