/**
 * PLAN-068 W3 / T0905 (T0902 §2.3 / §3 / §5): the Tower turn cards — one card per turn of a Tower tab
 * that declared BAT ↔ CT contract 2, holding the turn's last assistant message. Kept in the memory of
 * the host that runs the tab (Electron main or a headless bat-server; electron/tower-cards.ts), read by
 * the windows over the proxied `tower-cards:*` channels. Shared by main, headless and the renderer:
 * types only, no `electron` / DOM import.
 *
 * 🔴 Never in `HELPER_CHANNEL_ROLES`: an agent (a Worker's or the Tower's own PTY capability) can
 * neither read nor change the cards.
 */

/** Where a card came from: a claude-cli Tower's `Stop` hook, or a Claude Agent panel Tower's turn result. */
export type TowerCardSource = 'hook' | 'panel'

export interface TowerCard {
  /** Unique on the host while it runs (`tc-<boot>-<n>`). */
  id: string
  terminalId: string
  source: TowerCardSource
  /** The message, masked (`redactTerminalSecrets`) and cut to `TOWER_CARD_MAX_BYTES` UTF-8 bytes. */
  text: string
  /** True when the message was cut (by the hook or by the host). */
  truncated: boolean
  /** Host clock, ms epoch — for display / order only, never compared with the renderer's clock. */
  createdAt: number
  read: boolean
  pinned: boolean
}

/** One tab's cards as the host has them now (`tower-cards:list`). */
export interface TowerCardsEntry {
  terminalId: string
  /** Whether the host still has the tab (a running PTY, or a panel it knows as a Tower). */
  alive: boolean
  /** Increases with every change of this tab's cards (a window refetches when it moves). */
  revision: number
  /** Oldest first. */
  cards: TowerCard[]
  unread: number
  /**
   * `stop` reports of this contract-2 Tower that carried no message (T0902 G7: a claude too old to send
   * `last_assistant_message`, or a turn that ended with no text). 0 for a panel.
   */
  stopsWithoutMessage: number
}

/** `tower-cards:changed` — state only (counts and the revision), never a card's text. */
export interface TowerCardsChangedEvent {
  terminalId: string
  revision: number
  unread: number
  total: number
}

export type TowerCardsFailureCode = 'INVALID_ARGS' | 'NOT_FOUND' | 'PIN_LIMIT' | 'FORBIDDEN'

export type TowerCardsListResult = { ok: true; entries: TowerCardsEntry[] } | { ok: false; code: TowerCardsFailureCode }

/** `tower-cards:mark-read` / `:pin` / `:clear`: `changed` = how many cards changed. */
export type TowerCardsOpResult = { ok: true; changed: number } | { ok: false; code: TowerCardsFailureCode }

/** `window.electronAPI.towerCards` (electron/preload.ts); src/stores/tower-cards-store.ts uses it. */
export interface TowerCardsApi {
  /** `terminalIds` absent = every tab the host has cards for. */
  list(terminalIds?: string[]): Promise<TowerCardsListResult>
  /** `cardIds` absent = every card of the tab. */
  markRead(terminalId: string, cardIds?: string[]): Promise<TowerCardsOpResult>
  pin(terminalId: string, cardId: string, pinned: boolean): Promise<TowerCardsOpResult>
  /** No `cardIds` = every unpinned card (every card with `includePinned`). */
  clear(terminalId: string, opts?: { cardIds?: string[]; includePinned?: boolean }): Promise<TowerCardsOpResult>
  onChanged(callback: (info: TowerCardsChangedEvent) => void): () => void
}

/** Each Tower tab keeps its most recent this many unpinned cards (T0901 / T0902 §3). */
export const TOWER_CARDS_MAX = 30
/** Pinned cards are kept apart from `TOWER_CARDS_MAX`, at most this many per Tower tab. */
export const TOWER_CARDS_PINNED_MAX = 10
/** One card holds at most this many UTF-8 bytes of the message (cut and marked `truncated`). */
export const TOWER_CARD_MAX_BYTES = 16 * 1024
