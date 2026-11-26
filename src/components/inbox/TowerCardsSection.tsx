/**
 * PLAN-068 W6 / T0909 (T0902 §1 / §2.3 / §4 / G7): the「💬 塔台訊息」section of the Inbox tab — the
 * Tower turn cards of the selected Tower (or, with no declared Tower, of the workspace's panel Towers
 * merged, T0909 Q-1 A).
 *
 * - Newest first, pinned on top; ● = unread; opening a card marks it read (host); 📌 pins (host limit
 *   `TOWER_CARDS_PINNED_MAX`, `PIN_LIMIT` shows a line); 「全部已讀」/「清除」(unpinned only).
 * - 🔴 The card text is plain text: rendered only as React text nodes, never as HTML / Markdown.
 * - Lines starting with `⏸ 待你決定：` / `🙋 待你執行：` are highlighted — a hint only.
 * - The unread count shows on the section title and the thumbnail `💬N`; 🔴 never in the tab title
 *   number (§1: informing, not nagging).
 * - codex Tower → one fixed line (§4, D158); G7 → "claude too old" line.
 * - T0934: file references in the shown card text — a collapsed card's highlighted lines, an open
 *   card's lines (the folded head, or the whole text after「顯示全部」) — are links that open in the
 *   「檔案」tab, through T0930's single implementation (recognition `src/lib/inbox-file-refs.ts`,
 *   existence check `useInboxFileRefs` over the shown parts only, display `InboxRefText`). 🔴 The
 *   collapsed one-line preview sits inside the toggle `<button>`, so it stays plain text (no button in
 *   a button); a link click does not toggle the card nor change read / pinned. Without `folder`: plain text.
 * Rendered only when the Inbox verdict matches (the whole tab is gated, §6′ / R9′).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InboxSection } from './InboxSection'
import { InboxRefText } from './InboxRefText'
import { itemFileRefs, useInboxFileRefs } from './useInboxFileRefs'
import { getTowerCards, useTowerCardsVersion } from '../../stores/tower-cards-store'
import type { InboxSectionId } from '../../lib/inbox-model'
import {
  TOWER_CARDS_MIN_CLAUDE_VERSION,
  showsClaudeTooOldHint,
  towerCardFold,
  towerCardHighlights,
  towerCardLines,
  towerCardPreview,
  towerCardsForSection,
  towerCardTime,
  type TowerCardLine,
  type TowerCardView,
} from '../../lib/tower-card-view'
import { TOWER_CARDS_PINNED_MAX, type TowerCardsOpResult } from '../../types/tower-cards'

export interface TowerCardsSource {
  terminalId: string
  title: string
}

export interface TowerCardsSectionProps {
  /** The tabs whose cards are shown (one Tower, or the merged panel Towers). */
  sources: readonly TowerCardsSource[]
  /** The selected Tower runs codex: no cards, the fixed line instead (§4). */
  codex: boolean
  folded: boolean
  onToggle: (id: InboxSectionId) => void
  /** T0934: the workspace root the file references resolve under; none → plain text. */
  folder?: string | null
}

export function TowerCardsSection({ sources, codex, folded, onToggle, folder = null }: Readonly<TowerCardsSectionProps>) {
  const { t } = useTranslation()
  useTowerCardsVersion()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [full, setFull] = useState<Set<string>>(() => new Set())
  const [message, setMessage] = useState<string | null>(null)

  const entries = codex ? [] : sources.map(source => ({ ...source, entry: getTowerCards(source.terminalId) }))
  const cards = towerCardsForSection(entries)
  const unread = cards.filter(card => !card.read).length
  const tooOld = !codex && cards.length === 0 && entries.some(source => showsClaudeTooOldHint(source.entry))

  // T0934: what each card shows outside its toggle button — a collapsed card's highlighted lines, an
  // open card's lines (the folded head or the whole text) — and only those references are checked.
  const shown = new Map(cards.map(card => {
    if (!open.has(card.id)) return [card.id, { highlights: towerCardHighlights(card.text), folded: false, lines: [] as TowerCardLine[] }] as const
    const fold = towerCardFold(card.text)
    const body = fold.folded && !full.has(card.id) ? fold.head : card.text
    return [card.id, { highlights: [] as string[], folded: fold.folded, lines: towerCardLines(body) }] as const
  }))
  const links = useInboxFileRefs(
    folder,
    [...shown.values()].flatMap(part => itemFileRefs([], [...part.highlights, ...part.lines.map(line => line.text)])),
  )

  const api = window.electronAPI?.towerCards
  const report = (result: TowerCardsOpResult | undefined) => {
    if (!result || result.ok) { setMessage(null); return }
    setMessage(result.code === 'PIN_LIMIT'
      ? t('inbox.cards.pinLimit', { limit: TOWER_CARDS_PINNED_MAX })
      : t('inbox.cards.opFailed', { code: result.code }))
  }
  const run = (op: () => Promise<TowerCardsOpResult> | undefined) => {
    let pending: Promise<TowerCardsOpResult> | undefined
    try {
      pending = op()
    } catch (error) {
      setMessage(t('inbox.cards.opFailed', { code: error instanceof Error ? error.message : String(error) }))
      return
    }
    void pending?.then(report, (error: unknown) => setMessage(t('inbox.cards.opFailed', { code: error instanceof Error ? error.message : String(error) })))
  }

  const toggleCard = (card: TowerCardView) => {
    const opening = !open.has(card.id)
    setOpen(prev => {
      const next = new Set(prev)
      if (opening) next.add(card.id)
      else next.delete(card.id)
      return next
    })
    if (opening && !card.read) run(() => api?.markRead(card.terminalId, [card.id]))
  }

  const note = codex
    ? <div className="inbox-muted tower-cards-note" data-tower-cards-note="codex">{t('inbox.cards.codexNote')}</div>
    : tooOld
      ? <div className="inbox-muted tower-cards-note" data-tower-cards-note="claude-too-old">{t('inbox.cards.claudeTooOld', { version: TOWER_CARDS_MIN_CLAUDE_VERSION })}</div>
      : null

  const actions = cards.length > 0 ? (
    <>
      <button
        type="button"
        className="inbox-link"
        disabled={unread === 0}
        onClick={() => { for (const source of entries) if (source.entry && source.entry.unread > 0) run(() => api?.markRead(source.terminalId)) }}
      >
        {t('inbox.cards.markAllRead')}
      </button>
      <button
        type="button"
        className="inbox-link"
        title={t('inbox.cards.clearTooltip')}
        onClick={() => { for (const source of entries) if (source.entry && source.entry.cards.length > 0) run(() => api?.clear(source.terminalId)) }}
      >
        {t('inbox.cards.clear')}
      </button>
    </>
  ) : undefined

  return (
    <InboxSection
      id="messages"
      title={t('inbox.section.messages')}
      count={cards.length}
      countLabel={unread > 0 ? t('inbox.cards.unread', { count: unread }) : t('inbox.cards.total', { count: cards.length })}
      folded={folded}
      onToggle={onToggle}
      actions={actions}
      note={note}
    >
      {message && <div className="inbox-muted tower-cards-message" role="status">{message}</div>}
      <ul className="inbox-list tower-cards">
        {cards.map(card => {
          const isOpen = open.has(card.id)
          const showFull = full.has(card.id)
          const part = shown.get(card.id)!
          return (
            <li
              key={card.id}
              className={`tower-card${card.read ? '' : ' unread'}${card.pinned ? ' pinned' : ''}${isOpen ? ' open' : ''}`}
              data-tower-card={card.id}
              data-tower-card-read={card.read ? 'true' : 'false'}
              data-tower-card-pinned={card.pinned ? 'true' : 'false'}
            >
              <div className="tower-card-head">
                <button type="button" className="tower-card-toggle" aria-expanded={isOpen} onClick={() => toggleCard(card)}>
                  <span className="tower-card-unread" aria-label={card.read ? undefined : t('inbox.cards.unreadMark')}>{card.read ? '' : '●'}</span>
                  {card.pinned && <span className="tower-card-pin-mark">📌</span>}
                  <span className="tower-card-time">{towerCardTime(card.createdAt)}</span>
                  {card.sourceTitle && <span className="tower-card-source" title={t('inbox.cards.source', { title: card.sourceTitle })}>{card.sourceTitle}</span>}
                  {!isOpen && <span className="tower-card-preview">{towerCardPreview(card.text)}</span>}
                </button>
                <button
                  type="button"
                  className={`tower-card-pin${card.pinned ? ' active' : ''}`}
                  aria-pressed={card.pinned}
                  title={card.pinned ? t('inbox.cards.unpin') : t('inbox.cards.pin')}
                  onClick={() => run(() => api?.pin(card.terminalId, card.id, !card.pinned))}
                >
                  📌
                </button>
              </div>
              {!isOpen && part.highlights.map((line, i) => (
                <div key={i} className="tower-card-line highlight" data-tower-card-highlight="true"><InboxRefText text={line} links={links} /></div>
              ))}
              {isOpen && (
                <div className="tower-card-body">
                  {part.lines.map((line, i) => (
                    <div
                      key={i}
                      className={`tower-card-line${line.highlight ? ' highlight' : ''}`}
                      data-tower-card-highlight={line.highlight ? 'true' : undefined}
                    >
                      {line.text ? <InboxRefText text={line.text} links={links} /> : ' '}
                    </div>
                  ))}
                  {part.folded && (
                    <button
                      type="button"
                      className="inbox-link"
                      onClick={() => setFull(prev => {
                        const next = new Set(prev)
                        if (next.has(card.id)) next.delete(card.id)
                        else next.add(card.id)
                        return next
                      })}
                    >
                      {showFull ? t('inbox.cards.showLess') : t('inbox.cards.showAll')}
                    </button>
                  )}
                </div>
              )}
              {card.truncated && <div className="tower-card-truncated" data-tower-card-truncated="true">{t('inbox.cards.truncated')}</div>}
            </li>
          )
        })}
      </ul>
    </InboxSection>
  )
}
