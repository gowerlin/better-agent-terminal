/**
 * PLAN-068 W6 / T0909 (T0902 §1 / §2.3 / §4 / G7): how the「💬 塔台訊息」section of the Inbox tab shows
 * the Tower turn cards (the data is W3: electron/tower-cards.ts, src/stores/tower-cards-store.ts).
 * Pure functions, no IO, no React, no `electron` / DOM import.
 *
 * - Order: pinned first, then the rest; newest first within each (§1「塔台訊息新 → 舊」).
 * - Lines starting with `⏸ 待你決定：` / `🙋 待你執行：` are highlighted — a hint only, never parsed
 *   into data (the lists come only from the CT frontmatter, W5).
 * - A card's text is plain text (🔴 never HTML): the UI renders these strings as React text nodes.
 * - A codex Tower has no cards (D158): the section shows one fixed line instead (§4).
 * - G7: a contract-2 Tower whose `Stop` reports carry no message and that has no card → its claude is
 *   too old (`last_assistant_message` since claude 2.1.47, T0905).
 */
import type { TowerCard, TowerCardsEntry } from '../types/tower-cards'

/** claude first sends `last_assistant_message` in its `Stop` hook input in this version (T0905). */
export const TOWER_CARDS_MIN_CLAUDE_VERSION = '2.1.47'

/** Line prefixes highlighted in a card (a hint only; full-width colon, half-width accepted too). */
export const TOWER_CARD_HIGHLIGHT_PREFIXES: readonly string[] = ['⏸ 待你決定', '🙋 待你執行']

/** A collapsed card shows its first line cut to this many characters. */
export const TOWER_CARD_PREVIEW_CHARS = 120
/** An open card longer than this (lines / characters) shows its start and a "show all" button. */
export const TOWER_CARD_FOLD_LINES = 24
export const TOWER_CARD_FOLD_CHARS = 2400

// leading blanks, then an optional Markdown list / quote marker ("- ", "* ", "> ", "1. ")
const LINE_LEAD = /^\s*(?:[-*>]\s+|\d+[.)]\s+)?/

/** Whether `line` starts with `⏸ 待你決定：` / `🙋 待你執行：` (after blanks and a list marker). */
export function isTowerCardHighlightLine(line: string): boolean {
  const rest = line.replace(LINE_LEAD, '')
  return TOWER_CARD_HIGHLIGHT_PREFIXES.some(prefix => rest.startsWith(`${prefix}：`) || rest.startsWith(`${prefix}:`))
}

export interface TowerCardLine {
  text: string
  highlight: boolean
}

/** The text split into lines (`\r\n` / `\n`), each marked for highlighting. */
export function towerCardLines(text: string): TowerCardLine[] {
  return text.split(/\r?\n/).map(line => ({ text: line, highlight: isTowerCardHighlightLine(line) }))
}

/** The highlighted lines only (shown under a collapsed card's preview). */
export function towerCardHighlights(text: string): string[] {
  return towerCardLines(text).filter(line => line.highlight).map(line => line.text.trim())
}

// BUG-225 / T0931: Markdown structure lines skipped by the collapsed preview.
// A code fence: 3+ backticks (info string without backticks, else it is an inline code span) or 3+ tildes.
const FENCE_OPEN = /^\s*(?:(`{3,})[^`]*|(~{3,}).*)$/
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/
// A thematic break (`---`, `***`, `___`, spaces allowed between the marks).
const THEMATIC_BREAK = /^\s*([-*_])(?:\s*\1){2,}\s*$/
// A table separator row (`|---|:---:|`): only pipes, dashes, colons and blanks, with a pipe and a dash.
const TABLE_SEPARATOR = /^(?=[^|]*\|)(?=[^-]*-)[\s|:-]+$/
// An ATX heading marker and its optional closing hashes (`## Title ##` → `Title`).
const HEADING_MARK = /^#{1,6}(?:\s+|$)/
const HEADING_CLOSE = /\s+#+$/

/** The words of a line outside a code block, or '' for a structure line (thematic break, table separator, empty heading). */
function previewWords(line: string): string {
  const trimmed = line.trim()
  if (trimmed === '' || THEMATIC_BREAK.test(trimmed) || TABLE_SEPARATOR.test(trimmed)) return ''
  if (!HEADING_MARK.test(trimmed)) return trimmed
  return trimmed.replace(HEADING_MARK, '').replace(HEADING_CLOSE, '').trim()
}

/**
 * A collapsed card's one line, cut to `TOWER_CARD_PREVIEW_CHARS` (BUG-225):
 * the first line with words outside code blocks (fence lines, thematic breaks and table separator rows
 * skipped, a heading's `#` marks dropped; list / quote markers kept); else the first non-empty line inside
 * a code block; else (only structure lines) the first non-empty line as it is.
 */
export function towerCardPreview(text: string): string {
  const lines = text.split(/\r?\n/)
  let fence: { mark: string; length: number } | null = null
  let firstInBlock = ''
  let first = ''
  for (const line of lines) {
    if (fence) {
      const close = FENCE_CLOSE.exec(line)
      if (close && close[1][0] === fence.mark && close[1].length >= fence.length) fence = null
      else if (!firstInBlock && line.trim() !== '') firstInBlock = line.trim()
      continue
    }
    const open = FENCE_OPEN.exec(line)
    if (open) {
      const marks = open[1] ?? open[2]
      fence = { mark: marks[0], length: marks.length }
      continue
    }
    first = previewWords(line)
    if (first) break
  }
  if (!first) first = firstInBlock || (lines.find(line => line.trim() !== '')?.trim() ?? '')
  const chars = [...first]
  return chars.length > TOWER_CARD_PREVIEW_CHARS ? `${chars.slice(0, TOWER_CARD_PREVIEW_CHARS).join('')}…` : first
}

/** An open card: `folded` = the text is long; `head` = what is shown until "show all". */
export function towerCardFold(text: string): { folded: boolean; head: string } {
  const lines = text.split(/\r?\n/)
  if (lines.length <= TOWER_CARD_FOLD_LINES && text.length <= TOWER_CARD_FOLD_CHARS) return { folded: false, head: text }
  let head = lines.slice(0, TOWER_CARD_FOLD_LINES).join('\n')
  if (head.length > TOWER_CARD_FOLD_CHARS) head = [...head].slice(0, TOWER_CARD_FOLD_CHARS).join('')
  return { folded: true, head }
}

/** A card with the tab it came from (merged panel Towers show where each card is from). */
export interface TowerCardView extends TowerCard {
  /** The source tab's title (only set when several tabs are merged). */
  sourceTitle?: string
}

/** Pinned first, then the others; newest first within each (same time → later id first). */
export function orderTowerCards<T extends TowerCard>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })
}

/**
 * The cards of the section: the entries of `sources` (one tab, or several merged panel Towers),
 * each card labelled with its tab title when there is more than one source.
 */
export function towerCardsForSection(
  sources: readonly { terminalId: string; title: string; entry: TowerCardsEntry | null }[],
): TowerCardView[] {
  const merged = sources.length > 1
  const cards: TowerCardView[] = []
  for (const source of sources) {
    for (const card of source.entry?.cards ?? []) cards.push(merged ? { ...card, sourceTitle: source.title } : { ...card })
  }
  return orderTowerCards(cards)
}

/** G7: a contract-2 Tower that sent `Stop` reports without a message and has no card at all. */
export function showsClaudeTooOldHint(entry: TowerCardsEntry | null | undefined): boolean {
  return !!entry && entry.stopsWithoutMessage > 0 && entry.cards.length === 0
}

/**
 * Whether a Tower tab runs codex (§4: no turn cards). The agent the Tower named (`--agent` hint / the
 * PTY's preset, from `terminal:role-changed`) wins; else the tab's own agent preset.
 */
export function isCodexTower(tower: { agent?: string | null; agentPreset?: string | null }): boolean {
  const agent = (tower.agent || tower.agentPreset || '').toLowerCase()
  return agent.startsWith('codex')
}

/**
 * The thumbnail's `💬N`: unread cards of a tab whose cards count now — a Tower tab whose contract
 * matches, or a panel Tower. 0 = no badge. (Never in the Inbox title number, §1.)
 */
export function towerCardsBadgeCount(unread: number, applies: boolean): number {
  return applies && unread > 0 ? unread : 0
}

/** Card time as `HH:MM` (local); the host's clock, shown only. */
export function towerCardTime(createdAt: number): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
