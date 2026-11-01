/**
 * T0567: the one place that turns Esc into "close the dialog".
 *
 * Every `ModalOverlay` registers here while it is mounted. On Esc only the topmost open dialog
 * reacts:
 *  - it declared `onEscape` → that is called (its [X] / cancel action)
 *  - it did not (RecoveryPrompt, the setup wizards) → Esc does nothing at all, and the dialogs
 *    underneath it do not react either (a wizard on top of Profiles keeps Profiles open, so
 *    the wizard is not unmounted / cancelled / rolled back)
 *
 * "Topmost": a dialog nested inside another one is above it; otherwise the one opened later is
 * above. Dialogs that are not rendered (a hidden agent panel's modal) are skipped.
 *
 * The listener sits on `document` in the bubble phase, so handlers inside the dialog run first:
 * a menu / autocomplete / file picker that handled Esc (`preventDefault` or
 * `stopPropagation`) keeps it, and the dialog stays open. Esc during IME composition is ignored.
 * When a dialog takes Esc it stops propagation, so window-level shortcuts underneath (an agent
 * panel's "Esc = interrupt") do not also fire.
 */

export interface ModalStackEntry {
  /** The backdrop element. */
  el: HTMLElement | null
  /** Latest Esc action; `undefined` = this dialog has no Esc (and blocks the ones below). */
  onEscape: (() => void) | undefined
  seq: number
}

const entries = new Set<ModalStackEntry>()
let nextSeq = 1
let listening = false

function isShown(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  // Chromium; jsdom has no layout, so every connected dialog counts as shown there.
  const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility
  return typeof check === 'function' ? check.call(el) : true
}

/** True when `a` is drawn above `b`. */
function isAbove(a: ModalStackEntry, b: ModalStackEntry): boolean {
  if (a.el && b.el) {
    if (b.el.contains(a.el)) return true
    if (a.el.contains(b.el)) return false
  }
  return a.seq > b.seq
}

export function topModal(): ModalStackEntry | undefined {
  let top: ModalStackEntry | undefined
  for (const entry of entries) {
    if (!entry.el || !isShown(entry.el)) continue
    if (!top || isAbove(entry, top)) top = entry
  }
  return top
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return
  if (e.isComposing || e.keyCode === 229) return
  if (e.defaultPrevented) return
  const top = topModal()
  if (!top) return
  e.preventDefault()
  e.stopPropagation()
  top.onEscape?.()
}

/** An element focus can go back to: not `<body>` / `<html>` (= nothing had the focus). */
function returnTarget(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null
  if (el === document.body || el === document.documentElement) return null
  return el
}

/**
 * T0776 (BUG-194): a dialog that mounts while the focus is outside it (it opened by itself — a
 * Terminal Server recovery, an IPC event — while an xterm had the focus) takes the focus on its
 * backdrop (`tabIndex=-1`), so the first Esc reaches this module instead of being written into
 * the background PTY by xterm. A dialog whose `autoFocus` child already has the focus keeps it.
 *
 * Returns the element to give the focus back to when the dialog closes: the one focused now when
 * that is outside the dialog (an earlier dialog of the same commit counts), otherwise
 * `focusBeforeRender` (read on the dialog's first render, before an `autoFocus` child took it).
 */
export function takeDialogFocus(el: HTMLElement | null, focusBeforeRender: Element | null): HTMLElement | null {
  if (!el) return null
  const active = document.activeElement
  if (active && el.contains(active)) return returnTarget(focusBeforeRender)
  const before = returnTarget(active)
  el.focus({ preventScroll: true })
  return before
}

/**
 * T0776: on close, the focus goes back to `restoreTo` (still in the document) — but only when it
 * is still in this dialog or nowhere (`<body>`): a dialog that moved the focus elsewhere itself
 * (a panel focusing its input box) or a dialog closing under another one keeps it where it is.
 */
export function restoreDialogFocus(el: HTMLElement | null, restoreTo: HTMLElement | null): void {
  if (!restoreTo || !restoreTo.isConnected) return
  const active = document.activeElement
  const focusInDialogOrNowhere = !active || active === document.body || active === document.documentElement || (!!el && el.contains(active))
  if (!focusInDialogOrNowhere) return
  restoreTo.focus({ preventScroll: true })
}

export function registerModal(entry: Omit<ModalStackEntry, 'seq'>): ModalStackEntry {
  const registered: ModalStackEntry = { ...entry, seq: nextSeq++ }
  entries.add(registered)
  if (!listening) {
    document.addEventListener('keydown', onKeyDown)
    listening = true
  }
  return registered
}

export function unregisterModal(entry: ModalStackEntry): void {
  entries.delete(entry)
  if (entries.size === 0 && listening) {
    document.removeEventListener('keydown', onKeyDown)
    listening = false
  }
}
