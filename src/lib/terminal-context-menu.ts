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
