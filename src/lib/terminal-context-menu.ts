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
 * menu's Copy stays reachable.
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
