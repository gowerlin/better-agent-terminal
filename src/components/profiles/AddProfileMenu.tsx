import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddMenu, type AddMenuSection } from '../common/AddMenu'

export type ProfileSection = 'container' | 'remote' | 'experimental'

export interface ProfileTypeOption {
  id: string
  /** Already-translated label shown in the menu item. */
  label: string
  icon: string
  iconColor?: string
  section: ProfileSection
  suggested?: boolean
  onClick: () => void
}

interface Props {
  options: ProfileTypeOption[]
  /** Optional override for the trigger button label. Defaults to i18n `profiles.addMore`. */
  buttonLabel?: string
  /** Optional override for trigger button className. Defaults to `profile-action-btn`. */
  buttonClassName?: string
}

const SECTION_ORDER: Array<{ id: ProfileSection; labelKey: string }> = [
  { id: 'container',    labelKey: 'profiles.section.container' },
  { id: 'remote',       labelKey: 'profiles.section.remote' },
  { id: 'experimental', labelKey: 'profiles.section.experimental' },
]

/**
 * Group-by-category dropdown for the ProfilePanel toolbar.
 *
 * Renders a `[+ More ▼]` trigger that opens an AddMenu with options
 * grouped by `section` (container / remote / experimental). Empty
 * sections are hidden automatically (handled by AddMenu).
 */
export function AddProfileMenu({ options, buttonLabel, buttonClassName }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const sections: AddMenuSection[] = SECTION_ORDER.map(({ id, labelKey }) => {
    const items = options
      .filter(o => o.section === id)
      .map(o => (
        <div
          className="thumbnail-add-menu-item"
          onClick={() => { o.onClick(); setOpen(false) }}
        >
          <span className="thumbnail-add-menu-icon" style={o.iconColor ? { color: o.iconColor } : undefined}>{o.icon}</span>
          {o.label}
          {o.suggested && <span className="thumbnail-add-menu-suggested">suggested</span>}
        </div>
      ))
    return { id, label: t(labelKey), items }
  })

  return (
    <>
      <button
        ref={btnRef}
        className={buttonClassName ?? 'profile-action-btn'}
        onClick={() => setOpen(prev => !prev)}
      >
        {buttonLabel ?? t('profiles.addMore')}
      </button>
      <AddMenu
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        sections={sections}
      />
    </>
  )
}
