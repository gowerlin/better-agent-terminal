import { Fragment, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export interface AddMenuSection {
  /** Stable id for React keying */
  id: string
  /** Optional section header label. Empty/undefined → render as plain divider (or skip if first). */
  label?: string
  /** Items rendered inside this section. Empty array → entire section hidden. */
  items: ReactNode[]
}

interface Props {
  /** Whether menu is open. Parent controls visibility. */
  open: boolean
  /** Anchor element ref — used to compute position on each open. */
  anchorRef: React.RefObject<HTMLElement>
  /** Called when user clicks outside the menu. */
  onClose: () => void
  /** Sections in render order. Sections with zero items are skipped entirely. */
  sections: AddMenuSection[]
  /** Optional class to add on the menu root (extends `.thumbnail-add-menu`). */
  menuClassName?: string
  /** Estimated menu height for openUpward decision (default 200). */
  estimatedHeight?: number
}

/**
 * Shared dropdown shell extracted from ThumbnailBar's add-menu pattern.
 * Handles: portal render, openUpward viewport detection, outside-click close,
 * and section grouping with header + divider styling.
 *
 * Items are caller-rendered (passed as ReactNode) and rendered as direct
 * children of the menu root, preserving CSS expectations like
 * `.has-submenu { position: relative }`.
 */
export function AddMenu({ open, anchorRef, onClose, sections, menuClassName, estimatedHeight = 200 }: Props) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight
    setStyle(openUpward
      ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
      : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
    )
  }, [open, anchorRef, estimatedHeight])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const anchor = anchorRef.current
      const popup = popupRef.current
      if (anchor && anchor.contains(target)) return
      if (popup && popup.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, anchorRef, onClose])

  if (!open) return null

  const visibleSections = sections.filter(s => s.items.length > 0)

  const className = `thumbnail-add-menu${menuClassName ? ` ${menuClassName}` : ''}`

  return createPortal(
    <div className={className} ref={popupRef} style={style}>
      {visibleSections.map((section, idx) => (
        <Fragment key={section.id}>
          {section.label
            ? <div className="thumbnail-add-menu-section-header">{section.label}</div>
            : idx > 0 ? <div className="thumbnail-add-menu-divider" /> : null
          }
          {section.items.map((item, i) => (
            <Fragment key={`${section.id}-${i}`}>{item}</Fragment>
          ))}
        </Fragment>
      ))}
    </div>,
    document.body
  )
}
