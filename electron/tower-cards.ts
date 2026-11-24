/**
 * PLAN-068 W3 / T0905 (T0902 §2.3 / §3 / §5 / §7.4, D328 R1′): the Tower turn cards — the data layer
 * (the UI is W6). One card per turn of a Tower tab, holding the turn's last assistant message:
 *
 *   source                                   → how a message arrives
 *   claude-cli Tower (`hook`)                → its `Stop` hook sends `last_assistant_message`
 *                                              (scripts/bat-hook.mjs → `terminal:report-hook` →
 *                                              `ReportHookDeps.onStop` → `offerHookStop`)
 *   Claude Agent panel Tower (`panel`)       → the panel's turn result (`ClaudeAgentManager`
 *                                              `setTurnResultListener` → `offerPanelMessage`)
 *
 * Rules (🔴 all of them):
 * - Kept only for a tab whose state is `match` (`towerContractStatus`, src/lib/tower-contract.ts: a
 *   declared Tower with `--bat-contract 2`). Every other tab's message is dropped on receipt, its text
 *   never stored or logged (one log line per tab, length only). A panel has no `--set-role`: it is a
 *   Tower only after `setPanelTower(id, true)` — the caller decides (T0902 §6′: the panel is judged by
 *   `_tower-state.md` `bat_contract`, a renderer read, W4); nothing calls it before then.
 * - Masked on receipt (`redactTerminalSecrets`, the server token as a known secret), then cut to
 *   `TOWER_CARD_MAX_BYTES` UTF-8 bytes on a character boundary (`truncated`).
 * - Per tab: the latest `TOWER_CARDS_MAX` unpinned cards (older ones go first) plus at most
 *   `TOWER_CARDS_PINNED_MAX` pinned ones (pinning an 11th → `PIN_LIMIT`).
 * - Read / pinned live here (host), so every window sees the same; a window reads them with
 *   `tower-cards:list` and refetches on `tower-cards:changed` (counts and a revision only, never text).
 * - De-duplicated (§7.4: BAT's injected hooks and W9's plugin may both report one `Stop`): a card with
 *   the same session id + content hash as one added within `TOWER_CARDS_DEDUPE_WINDOW_MS` is dropped.
 * - Memory only: never written to a file, never in a helper answer. Cleared when the PTY ends (exit /
 *   kill, so ⏻ restart too: `terminalEnded`), by the Terminal Server recovery (`serverRecovered`), and
 *   for a panel when its session is disposed or it stops being a Tower.
 * - Logs (`[tower-cards] …`) carry the terminal id, lengths and counts — never a message.
 *
 * Channels (`registerTowerCardHandlers`, Electron main and headless alike; proxied): `tower-cards:list`,
 * `tower-cards:mark-read`, `tower-cards:pin`, `tower-cards:clear`; event `tower-cards:changed`.
 * 🔴 None of them is in `HELPER_CHANNEL_ROLES`, and each handler also refuses a helper capability
 * (`FORBIDDEN`): an agent can neither read the cards nor mark / pin / clear them.
 *
 * 🔴 No `electron` import here (shared with headless).
 */
import { createHash, randomBytes } from 'crypto'
import { redactTerminalSecrets } from '../src/lib/terminal-output-redaction'
import { towerContractStatus } from '../src/lib/tower-contract'
import {
  TOWER_CARD_MAX_BYTES,
  TOWER_CARDS_MAX,
  TOWER_CARDS_PINNED_MAX,
  type TowerCard,
  type TowerCardsChangedEvent,
  type TowerCardsEntry,
  type TowerCardSource,
  type TowerCardsFailureCode,
  type TowerCardsListResult,
  type TowerCardsOpResult,
} from '../src/types/tower-cards'
import type { HandlerContext } from './remote/handler-registry'

export { TOWER_CARD_MAX_BYTES, TOWER_CARDS_MAX, TOWER_CARDS_PINNED_MAX }

export const TOWER_CARDS_CHANGED_CHANNEL = 'tower-cards:changed'
/** §7.4: a card equal to one added this recently (same session, same content) is a duplicate. */
export const TOWER_CARDS_DEDUPE_WINDOW_MS = 10_000
/** At most this many ids per `tower-cards:list` / card ids per operation (the rest are ignored). */
export const TOWER_CARDS_MAX_IDS = 1000
const ID_MAX_LENGTH = 256
/** Tabs whose "not a contract-2 Tower, dropped" line was logged (oldest forgotten first). */
const DROP_LOGGED_MAX = 512

/** `text` cut to at most `maxBytes` UTF-8 bytes on a character boundary. */
export function truncateUtf8(text: string, maxBytes: number = TOWER_CARD_MAX_BYTES): { text: string; truncated: boolean } {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= maxBytes) return { text, truncated: false }
  let end = maxBytes
  // a continuation byte (10xxxxxx) at the cut: back off to the start of that character
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--
  return { text: buf.subarray(0, end).toString('utf8'), truncated: true }
}

export interface TowerCardStoreDeps {
  /** `PtyManager.getTerminalRole` (undefined = not a declared Tower / no such PTY). */
  getTerminalRole(id: string): string | undefined
  /** `PtyManager.getTowerContract`. */
  getTowerContract(id: string): number | undefined
  /** `PtyManager.isAlive` — whether a PTY tab still runs here (a list entry's `alive`). */
  isAlive?(id: string): boolean
  /** `PtyManager.getClaudeSessionId` — the de-duplication key of a hook card (absent / null = none). */
  getSessionId?(id: string): string | null
  /** Literal secrets masked besides the patterns (the server token). */
  knownSecrets?(): readonly string[]
  /** `tower-cards:changed` to the windows (Electron) / the connected clients (headless). */
  emit?(channel: string, payload: unknown): unknown
  logger?: { log(...args: unknown[]): void }
  /** Tests. Default `Date.now`. */
  now?(): number
}

/** What happened to an offered message. */
export type TowerCardOfferResult = 'added' | 'duplicate' | 'not-tower' | 'empty'

interface StoredCard extends TowerCard {
  /** session id (or `-`) + content hash, for §7.4 de-duplication; never leaves this module. */
  key: string
  seq: number
}

interface TabCards {
  cards: StoredCard[]
  revision: number
  stopsWithoutMessage: number
}

export class TowerCardStore {
  private readonly tabs = new Map<string, TabCards>()
  private readonly panelTowers = new Set<string>()
  private readonly dropLogged = new Set<string>()
  private readonly boot = randomBytes(3).toString('hex')
  private seq = 0
  /** Store-wide, so a tab's revision keeps increasing even after its cards were dropped and came back. */
  private revisionSeq = 0

  constructor(private readonly deps: TowerCardStoreDeps) {}

  private nextRevision(): number {
    this.revisionSeq++
    return this.revisionSeq
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now()
  }

  private log(message: string): void {
    this.deps.logger?.log(`[tower-cards] ${message}`)
  }

  /** §6′: PTY `id` is a declared Tower with contract 2 (the only tabs whose messages are kept). */
  isContractTower(id: string): boolean {
    return towerContractStatus(this.deps.getTerminalRole(id), this.deps.getTowerContract(id)) === 'match'
  }

  /**
   * An applied `stop` hook report of PTY `id` (`ReportHookDeps.onStop`). `message` absent = the hook
   * sent none (`stopsWithoutMessage` of a contract-2 Tower counts it, T0902 G7).
   */
  offerHookStop(id: string, report: { message?: { text: string; truncated?: boolean } }): TowerCardOfferResult {
    if (!this.isContractTower(id)) {
      this.logDrop(id, report.message?.text)
      return 'not-tower'
    }
    if (!report.message) {
      const tab = this.tab(id)
      tab.stopsWithoutMessage++
      tab.revision = this.nextRevision()
      this.emitChanged(id, tab)
      return 'empty'
    }
    return this.add(id, 'hook', report.message.text, report.message.truncated === true, this.deps.getSessionId?.(id) ?? null)
  }

  /** The turn result of Claude Agent panel `id` (its session id is the tab id). Kept only for a panel Tower. */
  offerPanelMessage(id: string, text: string): TowerCardOfferResult {
    if (!this.panelTowers.has(id)) {
      this.logDrop(id, text)
      return 'not-tower'
    }
    return this.add(id, 'panel', text, false, `panel:${id}`)
  }

  /**
   * Whether Claude Agent panel `id` is a Tower whose turns become cards (the caller decides: T0902 §6′,
   * the workspace's `_tower-state.md` `bat_contract`, W4). false also clears its cards.
   */
  setPanelTower(id: string, tower: boolean): void {
    if (!validId(id)) return
    if (tower) {
      if (!this.panelTowers.has(id)) {
        this.panelTowers.add(id)
        this.log(`terminal=${id} panel Tower on`)
      }
      return
    }
    if (!this.panelTowers.delete(id)) return
    this.log(`terminal=${id} panel Tower off`)
    this.terminalEnded(id, 'panel is no longer a Tower')
  }

  isPanelTower(id: string): boolean {
    return this.panelTowers.has(id)
  }

  private logDrop(id: string, text: string | undefined): void {
    if (this.dropLogged.has(id)) return
    this.dropLogged.add(id)
    while (this.dropLogged.size > DROP_LOGGED_MAX) {
      const oldest = this.dropLogged.values().next().value
      if (oldest === undefined) break
      this.dropLogged.delete(oldest)
    }
    this.log(`terminal=${id} dropped: not a contract-2 Tower (length=${text?.length ?? 0}; logged once per tab)`)
  }

  private tab(id: string): TabCards {
    let tab = this.tabs.get(id)
    if (!tab) {
      tab = { cards: [], revision: 0, stopsWithoutMessage: 0 }
      this.tabs.set(id, tab)
    }
    return tab
  }

  private add(id: string, source: TowerCardSource, raw: string, cutByHook: boolean, session: string | null): TowerCardOfferResult {
    if (typeof raw !== 'string' || raw.trim() === '') return 'empty'
    const masked = redactTerminalSecrets(raw, this.deps.knownSecrets?.() ?? [])
    const cut = truncateUtf8(masked.text)
    const key = `${session ?? '-'}:${createHash('sha256').update(cut.text, 'utf8').digest('hex').slice(0, 32)}`
    const now = this.now()
    const tab = this.tab(id)
    if (tab.cards.some(c => c.key === key && now - c.createdAt < TOWER_CARDS_DEDUPE_WINDOW_MS)) {
      this.log(`terminal=${id} duplicate dropped (source=${source} bytes=${Buffer.byteLength(cut.text, 'utf8')})`)
      return 'duplicate'
    }
    this.seq++
    const card: StoredCard = {
      id: `tc-${this.boot}-${this.seq}`,
      terminalId: id,
      source,
      text: cut.text,
      truncated: cutByHook || cut.truncated,
      createdAt: now,
      read: false,
      pinned: false,
      key,
      seq: this.seq,
    }
    tab.cards.push(card)
    const evicted = this.trim(tab)
    tab.revision = this.nextRevision()
    this.log(`terminal=${id} card added source=${source} bytes=${Buffer.byteLength(card.text, 'utf8')}${card.truncated ? ' truncated' : ''}${masked.count ? ` masked=${masked.count}` : ''} cards=${tab.cards.length}${evicted ? ` evicted=${evicted}` : ''}`)
    this.emitChanged(id, tab)
    return 'added'
  }

  /** Drops the oldest unpinned cards beyond `TOWER_CARDS_MAX`; how many went. */
  private trim(tab: TabCards): number {
    let unpinned = tab.cards.filter(c => !c.pinned).length
    let evicted = 0
    while (unpinned > TOWER_CARDS_MAX) {
      const index = tab.cards.findIndex(c => !c.pinned)
      if (index < 0) break
      tab.cards.splice(index, 1)
      unpinned--
      evicted++
    }
    return evicted
  }

  private emitChanged(id: string, tab: TabCards): void {
    if (!this.deps.emit) return
    const event: TowerCardsChangedEvent = {
      terminalId: id,
      revision: tab.revision,
      unread: tab.cards.filter(c => !c.read).length,
      total: tab.cards.length,
    }
    try {
      this.deps.emit(TOWER_CARDS_CHANGED_CHANNEL, event)
    } catch (e) {
      this.log(`terminal=${id} changed event failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** The tabs' cards now (`ids` absent = every tab with cards or a known panel Tower). */
  list(ids?: readonly string[]): TowerCardsEntry[] {
    const wanted = ids ?? [...new Set([...this.tabs.keys(), ...this.panelTowers])]
    return wanted.map(id => this.entry(id))
  }

  private entry(id: string): TowerCardsEntry {
    const tab = this.tabs.get(id)
    const cards = tab ? tab.cards.map(publicCard) : []
    return {
      terminalId: id,
      alive: this.panelTowers.has(id) || (this.deps.isAlive?.(id) ?? false),
      // a tab without cards: "none as of now" — never older than a revision a window saw for it
      revision: tab?.revision ?? this.revisionSeq,
      cards,
      unread: cards.filter(c => !c.read).length,
      stopsWithoutMessage: tab?.stopsWithoutMessage ?? 0,
    }
  }

  /** Marks `cardIds` (absent = every card) of tab `id` read. */
  markRead(id: string, cardIds?: readonly string[]): TowerCardsOpResult {
    const tab = this.tabs.get(id)
    if (!tab) return { ok: true, changed: 0 }
    const only = cardIds ? new Set(cardIds) : null
    let changed = 0
    for (const card of tab.cards) {
      if (card.read || (only && !only.has(card.id))) continue
      card.read = true
      changed++
    }
    if (changed) {
      tab.revision = this.nextRevision()
      this.log(`terminal=${id} read=${changed}`)
      this.emitChanged(id, tab)
    }
    return { ok: true, changed }
  }

  /** Pins / unpins card `cardId` of tab `id`. Pinning beyond `TOWER_CARDS_PINNED_MAX` → `PIN_LIMIT`. */
  setPinned(id: string, cardId: string, pinned: boolean): TowerCardsOpResult {
    const tab = this.tabs.get(id)
    const card = tab?.cards.find(c => c.id === cardId)
    if (!tab || !card) return { ok: false, code: 'NOT_FOUND' }
    if (card.pinned === pinned) return { ok: true, changed: 0 }
    if (pinned && tab.cards.filter(c => c.pinned).length >= TOWER_CARDS_PINNED_MAX) return { ok: false, code: 'PIN_LIMIT' }
    card.pinned = pinned
    // unpinned again: it counts toward TOWER_CARDS_MAX (the oldest unpinned card may go)
    const evicted = pinned ? 0 : this.trim(tab)
    tab.revision = this.nextRevision()
    this.log(`terminal=${id} ${pinned ? 'pinned' : 'unpinned'} pinned=${tab.cards.filter(c => c.pinned).length}${evicted ? ` evicted=${evicted}` : ''}`)
    this.emitChanged(id, tab)
    return { ok: true, changed: 1 }
  }

  /** Removes `cardIds` of tab `id`, or (absent) every unpinned card — every card with `includePinned`. */
  clear(id: string, opts: { cardIds?: readonly string[]; includePinned?: boolean } = {}): TowerCardsOpResult {
    const tab = this.tabs.get(id)
    if (!tab) return { ok: true, changed: 0 }
    const only = opts.cardIds ? new Set(opts.cardIds) : null
    const before = tab.cards.length
    tab.cards = tab.cards.filter(c => (only ? !only.has(c.id) : (c.pinned && !opts.includePinned)))
    const changed = before - tab.cards.length
    if (changed) {
      tab.revision = this.nextRevision()
      this.log(`terminal=${id} cleared=${changed} cards=${tab.cards.length}`)
      this.emitChanged(id, tab)
    }
    return { ok: true, changed }
  }

  /** The tab is gone (PTY exit / kill, so ⏻ restart too; a disposed panel session): its cards go. */
  terminalEnded(id: string, cause = 'the PTY ended'): void {
    this.dropLogged.delete(id)
    this.panelTowers.delete(id)
    const tab = this.tabs.get(id)
    if (!tab) return
    this.tabs.delete(id)
    const removed = tab.cards.length
    if (removed || tab.stopsWithoutMessage) {
      this.log(`terminal=${id} cleared ${removed} card(s) (${cause})`)
      // a window holding them drops them on this event (revision moves past what it has)
      this.emitChanged(id, { cards: [], revision: this.nextRevision(), stopsWithoutMessage: 0 })
    }
  }

  /** The Terminal Server recovery rebuilt every PTY as a shell: every PTY tab's cards go (panels stay). */
  serverRecovered(): void {
    for (const id of [...this.tabs.keys()]) {
      if (!this.panelTowers.has(id)) this.terminalEnded(id, 'Terminal Server recovery')
    }
  }

  dispose(): void {
    this.tabs.clear()
    this.panelTowers.clear()
    this.dropLogged.clear()
  }
}

function publicCard(card: StoredCard): TowerCard {
  return {
    id: card.id,
    terminalId: card.terminalId,
    source: card.source,
    text: card.text,
    truncated: card.truncated,
    createdAt: card.createdAt,
    read: card.read,
    pinned: card.pinned,
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX_LENGTH
}

/** Ids of a request: non-empty strings ≤ 256 chars, de-duplicated, at most `TOWER_CARDS_MAX_IDS`; null = not an array. */
export function normalizeTowerCardIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (ids.length >= TOWER_CARDS_MAX_IDS) break
    if (!validId(value) || seen.has(value)) continue
    seen.add(value)
    ids.push(value)
  }
  return ids
}

function argsObject(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
}

function failure(code: TowerCardsFailureCode): { ok: false; code: TowerCardsFailureCode } {
  return { ok: false, code }
}

/**
 * `tower-cards:list` `{ terminalIds? }` → `{ ok: true, entries }` (absent = every tab the host has cards
 * for); `tower-cards:mark-read` `{ terminalId, cardIds? }`; `tower-cards:pin` `{ terminalId, cardId,
 * pinned }`; `tower-cards:clear` `{ terminalId, cardIds?, includePinned? }` → `TowerCardsOpResult`.
 * 🔴 A helper capability (`ctx.helper`) is refused (`FORBIDDEN`) — the channels are for the windows.
 */
export function registerTowerCardHandlers(opts: {
  registerHandler: (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => void
  getStore: () => TowerCardStore | null
  logger?: { log(...args: unknown[]): void }
}): void {
  const refuse = (ctx: HandlerContext, channel: string): boolean => {
    if (!ctx?.helper) return false
    opts.logger?.log(`[tower-cards] ${channel} refused: helper capability terminal=${ctx.helper.terminalId}`)
    return true
  }

  // literal channel names: the IPC binding guards scan for them (proxied-channels-binding.test.ts)
  opts.registerHandler('tower-cards:list', (ctx: HandlerContext, raw?: unknown): TowerCardsListResult => {
    if (refuse(ctx, 'tower-cards:list')) return failure('FORBIDDEN')
    const args = raw === undefined || raw === null ? {} : argsObject(raw)
    if (!args) return failure('INVALID_ARGS')
    let ids: string[] | undefined
    if (args.terminalIds !== undefined && args.terminalIds !== null) {
      const normalized = normalizeTowerCardIds(args.terminalIds)
      if (!normalized) return failure('INVALID_ARGS')
      ids = normalized
    }
    const store = opts.getStore()
    if (!store) return { ok: true, entries: (ids ?? []).map(id => ({ terminalId: id, alive: false, revision: 0, cards: [], unread: 0, stopsWithoutMessage: 0 })) }
    return { ok: true, entries: store.list(ids) }
  })

  opts.registerHandler('tower-cards:mark-read', (ctx: HandlerContext, raw?: unknown): TowerCardsOpResult => {
    if (refuse(ctx, 'tower-cards:mark-read')) return failure('FORBIDDEN')
    const args = argsObject(raw)
    if (!args || !validId(args.terminalId)) return failure('INVALID_ARGS')
    let cardIds: string[] | undefined
    if (args.cardIds !== undefined && args.cardIds !== null) {
      const normalized = normalizeTowerCardIds(args.cardIds)
      if (!normalized) return failure('INVALID_ARGS')
      cardIds = normalized
    }
    return opts.getStore()?.markRead(args.terminalId, cardIds) ?? { ok: true, changed: 0 }
  })

  opts.registerHandler('tower-cards:pin', (ctx: HandlerContext, raw?: unknown): TowerCardsOpResult => {
    if (refuse(ctx, 'tower-cards:pin')) return failure('FORBIDDEN')
    const args = argsObject(raw)
    if (!args || !validId(args.terminalId) || !validId(args.cardId) || typeof args.pinned !== 'boolean') return failure('INVALID_ARGS')
    return opts.getStore()?.setPinned(args.terminalId, args.cardId, args.pinned) ?? failure('NOT_FOUND')
  })

  opts.registerHandler('tower-cards:clear', (ctx: HandlerContext, raw?: unknown): TowerCardsOpResult => {
    if (refuse(ctx, 'tower-cards:clear')) return failure('FORBIDDEN')
    const args = argsObject(raw)
    if (!args || !validId(args.terminalId)) return failure('INVALID_ARGS')
    if (args.includePinned !== undefined && typeof args.includePinned !== 'boolean') return failure('INVALID_ARGS')
    let cardIds: string[] | undefined
    if (args.cardIds !== undefined && args.cardIds !== null) {
      const normalized = normalizeTowerCardIds(args.cardIds)
      if (!normalized) return failure('INVALID_ARGS')
      cardIds = normalized
    }
    return opts.getStore()?.clear(args.terminalId, { ...(cardIds ? { cardIds } : {}), ...(args.includePinned === true ? { includePinned: true } : {}) }) ?? { ok: true, changed: 0 }
  })
}
