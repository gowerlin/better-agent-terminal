/**
 * T0741 / BUG-180: may this terminal's container be fitted (FitAddon.fit + pty:resize) now?
 *
 * A hidden tab sits in a `display: none` wrapper (`.terminal-wrapper.hidden`). Its box is 0x0,
 * but FitAddon reads the container's size from `getComputedStyle`, which for an element that is
 * not rendered returns the declared value (`100%`); `parseInt('100%')` = 100 px, so the fit
 * comes out as about 9x5 cells. The fit resizes xterm itself and the PTY got that size too, until
 * the tab was shown again.
 *
 * Rule: no fit and no `pty:resize` while the container has no layout box (width or height 0,
 * or not a finite number). The caller also must not touch its resize dedup in that case, so the
 * size that is sent once the container is laid out again is never deduped away.
 *
 * Single implementation: `TerminalPanel` (`doResize`, the manual redraw) calls this with the
 * container's `getBoundingClientRect()`.
 */

export interface TerminalContainerBox {
  width: number
  height: number
}

export function canFitTerminalContainer(box: TerminalContainerBox | null | undefined): boolean {
  if (!box) return false
  const { width, height } = box
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}
