/**
 * Whether a right-click in a terminal tab opens BAT's Copy / Paste menu (T0568 / BUG-142).
 *
 * A program that turned on mouse tracking (DECSET 9 / 1000 / 1002 / 1003) receives the right
 * button as a mouse report and handles it itself. The claude CLI's TUI does (2.1.300: mouse
 * mode `full` = 1000 + 1002 + 1003 + 1006, `scroll` = 1000 + 1006); on Windows / WSL / Linux its
 * right-click copies its own selection or pastes the clipboard, so BAT's menu on top of it was a
 * second action for the same click. Every xterm tracking mode reports the right button, so the
 * mode alone tells whether the program gets the click.
 *
 * Shift + right-click still opens the menu: xterm does not send the mouse report while Shift is
 * held (Windows / Linux; on macOS xterm bypasses with Option instead, so there the program gets
 * the click as well), and Shift + drag is how a selection is made while tracking is on, so the
 * menu's Copy stays reachable. With any-event tracking that selection only survives until the
 * right-click because `MouseReportSelectionKeeper` (below) brings it back (T0571 / BUG-144), also
 * after the program sets mouse tracking again on focus (T0573).
 *
 * Only the right-click menu of the xterm tab; the mouse reports xterm writes to the PTY are not
 * touched.
 */

const MOUSE_TRACKING_MODES = new Set(['x10', 'vt200', 'drag', 'any'])

/** `mode` is xterm's `terminal.modes.mouseTrackingMode`; anything unrecognised counts as off. */
export function isMouseTrackingOn(mode: unknown): boolean {
  return typeof mode === 'string' && MOUSE_TRACKING_MODES.has(mode)
}

export function shouldShowTerminalContextMenu(mouseTrackingMode: unknown, shiftKey: boolean): boolean {
  return shiftKey || !isMouseTrackingOn(mouseTrackingMode)
}

/** One SGR mouse report as xterm writes it to the PTY (`CSI < b ; x ; y M|m`, also SGR-pixels). */
export function isSgrMouseReport(data: string): boolean {
  return /^\x1b\[<\d+;\d+;\d+[Mm]$/.test(data)
}

const MOUSE_TRACKING_DECSET_PARAMS = new Set([9, 1000, 1002, 1003])

/**
 * Whether the params of a `CSI ? … h` (DECSET) turn on a mouse tracking mode (9 / 1000 / 1002 /
 * 1003). xterm sets its mouse protocol for each of them, and setting it clears the selection
 * (`onProtocolChange` → `SelectionService.disable()`), even when tracking was on already.
 */
export function isMouseTrackingDecset(params: ReadonlyArray<number | number[]>): boolean {
  return params.some(p => typeof p === 'number' && MOUSE_TRACKING_DECSET_PARAMS.has(p))
}

/**
 * Whether this mouse press makes an xterm selection while the program tracks the mouse: the same
 * test as xterm 5.5.0 `SelectionService.shouldForceSelection` (macOS: Option when
 * `macOptionClickForcesSelection`, elsewhere Shift).
 */
export function forcesTerminalSelection(
  event: Pick<MouseEvent, 'shiftKey' | 'altKey'>,
  platform: string | undefined,
  macOptionClickForcesSelection: boolean | undefined,
): boolean {
  return platform === 'darwin' ? event.altKey && !!macOptionClickForcesSelection : event.shiftKey
}

/** The part of xterm's `Terminal` the selection keeper uses. */
export interface SelectionKeeperTerminal {
  readonly cols: number
  hasSelection(): boolean
  getSelection(): string
  getSelectionPosition(): { start: { x: number; y: number }; end: { x: number; y: number } } | undefined
  select(column: number, row: number, length: number): void
  clearSelection(): void
}

/** The Shift + drag selection in progress, as the tab sees it (T0573). */
export interface SelectionDrag {
  /** A drag that makes an xterm selection (`forcesTerminalSelection`) has its button still down. */
  isDragging(): boolean
  /** Presses again where that drag began, so xterm selects from there to the pointer; false when it cannot. */
  resume(): boolean
}

interface KeptSelection {
  text: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

interface TrackingSet {
  selection: KeptSelection | null
  dragging: boolean
  cleared: boolean
}

/**
 * Keeps the xterm selection that xterm drops only because it sent a mouse report (T0571 / BUG-144).
 *
 * xterm 5.5.0 clears the selection on every user input (`SelectionService` listens to
 * `coreService.onUserInput`), and a mouse report counts as user input (`CoreMouseService` →
 * `triggerDataEvent(report, true)`). With any-event tracking (DECSET 1003, the claude CLI's `full`
 * mouse mode) every pointer move over the terminal is a report, Shift held or not, so the
 * Shift + drag selection was gone before the Shift + right-click and the menu had no Copy.
 *
 * Order inside xterm: `onUserInput` clears the selection (`onSelectionChange` fires) and then
 * `onData` carries the input, synchronously. So a clear followed in the same task by an `onData`
 * that is a mouse report puts the same range back; a clear followed by anything else (keys, paste,
 * or nothing: buffer switch, trim, tracking turned on) stays. The report itself still reaches the
 * PTY unchanged.
 *
 * `forget()` on a mouse press other than Shift + right-click and on the wheel: the program gets
 * those (or a new selection starts), so the selection is not brought back after them. A range that
 * no longer yields the same text (resize, column selection with Alt) is not brought back either.
 *
 * The program setting mouse tracking again (T0573): the claude CLI re-sends
 * `?1000h ?1002h ?1003h ?1006h` when the tab gets focus back after about 5 s without it (2.1.300,
 * measured: focus report `ESC [ I` after 6 s out → re-sent, after 2 s → not). xterm sets its mouse
 * protocol for each DECSET and that clears the selection, with no `onData` at all. So
 * `handleMouseTrackingSet()` (called before xterm handles a tracking DECSET while tracking is
 * already on) brings the selection back once the write is parsed. When the Shift + drag is still
 * going on (the press that focused the tab is the press that started it), the clear also ended
 * xterm's drag; `SelectionDrag.resume()` presses again where the drag began so the selection keeps
 * following the pointer. Tracking turned on from off is not this case and is left alone.
 *
 * `lastAction` is for the right-click diagnostic log only.
 */
export class MouseReportSelectionKeeper {
  private kept: KeptSelection | null = null
  private cleared: KeptSelection | null = null
  private trackingSet: TrackingSet | null = null
  private restoring = false
  lastAction = 'none'

  constructor(
    private readonly terminal: SelectionKeeperTerminal,
    // Not `queueMicrotask` itself: called as a method it throws "Illegal invocation" in Chromium.
    private readonly schedule: (fn: () => void) => void = fn => queueMicrotask(fn),
    private readonly drag?: SelectionDrag,
  ) {}

  handleSelectionChange(): void {
    if (this.restoring) return
    if (this.terminal.hasSelection()) {
      const position = this.terminal.getSelectionPosition()
      this.kept = position ? { text: this.terminal.getSelection(), start: position.start, end: position.end } : null
      this.cleared = null
      this.lastAction = 'selected'
      return
    }
    if (this.trackingSet) this.trackingSet.cleared = true
    const cleared = this.kept
    this.kept = null
    if (!cleared) return
    this.cleared = cleared
    this.lastAction = 'cleared'
    // Nothing followed in the same task: the clear was not caused by a mouse report.
    this.schedule(() => {
      if (this.cleared !== cleared) return
      this.cleared = null
      if (!this.trackingSet && !this.terminal.hasSelection()) this.lastAction = 'dropped (cleared, no mouse report followed)'
    })
  }

  /**
   * The Shift + drag was released (T0573). xterm fires `onSelectionChange` for a drag only when the
   * range differs from the last one it reported, and its `clearSelection()` / `select()` fire
   * without updating that record. So selecting exactly the range that was cleared before (trying
   * the same text again) fires nothing and the keeper would not know the selection.
   */
  handleSelectionDragEnd(): void {
    if (!this.restoring && this.terminal.hasSelection()) this.handleSelectionChange()
  }

  handleData(data: string): void {
    const cleared = this.cleared
    this.cleared = null
    if (!cleared) return
    if (isSgrMouseReport(data)) this.restore(cleared, 'mouse report')
    else this.lastAction = 'dropped (input that is not a mouse report)'
  }

  /** The program sets mouse tracking while it is already on (before xterm handles the DECSET). */
  handleMouseTrackingSet(): void {
    if (this.trackingSet) return
    const dragging = this.drag?.isDragging() ?? false
    if (!this.kept && !dragging) return
    const pending: TrackingSet = { selection: this.kept, dragging, cleared: false }
    this.trackingSet = pending
    // After the rest of the write is parsed (claude sends 1000, 1002, 1003 and 1006 together).
    this.schedule(() => {
      if (this.trackingSet !== pending) return
      this.trackingSet = null
      if (!pending.cleared) return
      if (pending.dragging && this.drag?.isDragging()) {
        if (this.drag.resume()) {
          this.cleared = null
          this.lastAction = 'drag resumed (mouse tracking set again)'
          return
        }
      }
      if (pending.selection && !this.terminal.hasSelection()) this.restore(pending.selection, 'mouse tracking set again')
      else this.lastAction = 'dropped (mouse tracking set again, nothing to bring back)'
    })
  }

  forget(reason = 'mouse press'): void {
    this.kept = null
    this.cleared = null
    this.trackingSet = null
    this.lastAction = `forgotten (${reason})`
  }

  private restore(selection: KeptSelection, why: string): void {
    const { start, end, text } = selection
    this.restoring = true
    let restored = false
    try {
      this.terminal.select(start.x, start.y, (end.y - start.y) * this.terminal.cols + end.x - start.x)
      restored = this.terminal.getSelection() === text
      if (!restored) this.terminal.clearSelection()
    } finally {
      this.restoring = false
    }
    this.cleared = null
    if (restored) {
      this.kept = selection
      this.lastAction = `restored (${why})`
    } else {
      this.lastAction = `not restored (${why}: the range now reads different text)`
    }
  }
}

/**
 * Whether a keydown in the xterm tab closes BAT's open right-click menu (T0569 / BUG-143).
 *
 * The menu leaves focus in xterm's textarea, and xterm 5.5.0 handles Escape there itself: it
 * writes `ESC` to the PTY and then calls `cancel(event, true)` (`preventDefault` +
 * `stopPropagation`), so the `document` listener never saw the key and the program (claude CLI:
 * Esc = interrupt) got it instead. The tab's `attachCustomKeyEventHandler` runs before that, so it
 * asks this: Escape while the menu is open closes the menu and is not passed on. Not while an IME
 * is composing (Escape then cancels the composition, as T0567 does for dialogs); with the menu
 * closed Escape goes to the program unchanged.
 */
export function shouldCloseTerminalContextMenuOnKey(
  event: Pick<KeyboardEvent, 'key' | 'isComposing' | 'keyCode'>,
  menuOpen: boolean,
  imeComposing: boolean,
): boolean {
  return menuOpen && event.key === 'Escape' && !imeComposing && !event.isComposing && event.keyCode !== 229
}
