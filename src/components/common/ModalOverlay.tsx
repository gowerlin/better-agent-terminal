import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { registerModal, restoreDialogFocus, takeDialogFocus, unregisterModal, type ModalStackEntry } from './modal-stack'

interface ModalOverlayProps {
  /** The backdrop class (`settings-overlay`, `dialog-overlay`, `claude-plan-overlay`, ...). */
  className: string
  style?: CSSProperties
  /**
   * T0567: what Esc does while this is the topmost dialog — its [X] action, or cancel for a
   * confirmation. Leave it out for a dialog that must not close on Esc (RecoveryPrompt, the
   * setup wizards); Esc then does nothing while it is on top.
   */
  onEscape?: () => void
  children: ReactNode
}

/**
 * T0563: backdrop for every Dialog / modal. It deliberately takes no click handler — a click
 * (or a text selection dragged out of the dialog) on the backdrop never closes the dialog.
 * Dialogs close only through their own [X] / confirm / cancel buttons, plus Esc through
 * `onEscape` (T0567, `./modal-stack`: only the topmost dialog reacts). Menus, dropdowns and
 * small popovers keep closing on an outside click and do not use this component.
 * `src/components/__tests__/dialog-no-outside-close.test.tsx` and
 * `src/components/__tests__/dialog-escape.test.tsx` guard that dialog backdrops go through here.
 */
export function ModalOverlay({ className, style, onEscape, children }: Readonly<ModalOverlayProps>) {
  const ref = useRef<HTMLDivElement>(null)
  const entryRef = useRef<ModalStackEntry | null>(null)
  // T0776: the element that had the focus before this dialog mounted. Read during the first
  // render, because an `autoFocus` child takes the focus in the commit before our layout effect.
  const [focusBeforeRender] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))

  useLayoutEffect(() => {
    const el = ref.current
    const entry = registerModal({ el, onEscape: undefined })
    entryRef.current = entry
    // T0776 (BUG-194): opened while the focus is outside (an xterm) → focus the backdrop, so
    // the first Esc closes the dialog; on close the focus goes back (./modal-stack).
    const restoreTo = takeDialogFocus(el, focusBeforeRender)
    return () => {
      unregisterModal(entry)
      entryRef.current = null
      restoreDialogFocus(el, restoreTo)
    }
  }, [focusBeforeRender])

  // Keep the latest action without re-registering (re-registering would move it to the top).
  useLayoutEffect(() => {
    if (entryRef.current) entryRef.current.onEscape = onEscape
  })

  return (
    // T0776: focusable only by script (tabIndex -1), no focus ring around the whole backdrop.
    <div ref={ref} className={className} style={{ outline: 'none', ...style }} data-modal-overlay="" tabIndex={-1}>
      {children}
    </div>
  )
}
