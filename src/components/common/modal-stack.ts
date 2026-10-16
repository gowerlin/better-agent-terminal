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
