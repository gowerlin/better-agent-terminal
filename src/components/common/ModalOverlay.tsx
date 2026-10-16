import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { registerModal, unregisterModal, type ModalStackEntry } from './modal-stack'

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

  useLayoutEffect(() => {
    const entry = registerModal({ el: ref.current, onEscape: undefined })
    entryRef.current = entry
    return () => {
      unregisterModal(entry)
      entryRef.current = null
    }
  }, [])

  // Keep the latest action without re-registering (re-registering would move it to the top).
  useLayoutEffect(() => {
    if (entryRef.current) entryRef.current.onEscape = onEscape
  })

  return (
    <div ref={ref} className={className} style={style} data-modal-overlay="">
      {children}
    </div>
  )
}
