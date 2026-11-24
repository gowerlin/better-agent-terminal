/**
 * PLAN-068 W4 / T0906: one section of the「待辦」(Inbox) tab (§1). An empty section keeps a one-line
 * title (「⏸ 待你決定（無）」) so it never looks broken; a non-empty one folds on its title.
 * W5 / W6 fill the sections W4 leaves empty (待你決定、到期提醒、塔台訊息) through this same interface.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { InboxSectionId } from '../../lib/inbox-model'

export interface InboxSectionProps {
  id: InboxSectionId
  title: string
  /** Items in the section; 0 = the one-line empty title. */
  count: number
  folded: boolean
  onToggle: (id: InboxSectionId) => void
  children?: ReactNode
}

export function InboxSection({ id, title, count, folded, onToggle, children }: InboxSectionProps) {
  const { t } = useTranslation()
  if (count === 0) {
    return (
      <section className="inbox-section inbox-section-empty" data-inbox-section={id}>
        <div className="inbox-section-title">
          <span>{title}</span> <span className="inbox-section-none">{t('inbox.none')}</span>
        </div>
      </section>
    )
  }
  return (
    <section className={`inbox-section${folded ? ' folded' : ''}`} data-inbox-section={id}>
      <button
        type="button"
        className="inbox-section-title inbox-section-toggle"
        aria-expanded={!folded}
        onClick={() => onToggle(id)}
      >
        <span>{title}</span> <span className="inbox-section-count">({count})</span>
        <span className="inbox-section-caret">{folded ? '▸' : '▾'}</span>
      </button>
      {!folded && <div className="inbox-section-body">{children}</div>}
    </section>
  )
}
