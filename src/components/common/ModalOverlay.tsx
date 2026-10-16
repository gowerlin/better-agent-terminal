import type { CSSProperties, ReactNode } from 'react'

interface ModalOverlayProps {
  /** The backdrop class (`settings-overlay`, `dialog-overlay`, `claude-plan-overlay`, ...). */
  className: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * T0563: backdrop for every Dialog / modal. It deliberately takes no click handler — a click
 * (or a text selection dragged out of the dialog) on the backdrop never closes the dialog.
 * Dialogs close only through their own [X] / confirm / cancel buttons, plus Esc where the
 * dialog already handled it. Menus, dropdowns and small popovers keep closing on an outside
 * click and do not use this component. `src/components/__tests__/dialog-no-outside-close.test.tsx`
 * guards that dialog backdrops go through here.
 */
export function ModalOverlay({ className, style, children }: Readonly<ModalOverlayProps>) {
  return (
    <div className={className} style={style} data-modal-overlay="">
      {children}
    </div>
  )
}
