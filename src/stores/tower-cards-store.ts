/**
 * PLAN-068 W3 / T0905 (T0902 §2.3 / §5): renderer side of the Tower turn cards — data only (the UI is
 * W6). The host that runs a Tower tab keeps its cards (electron/tower-cards.ts: memory only, masked,
 * read / pinned there so every window agrees); a window holds a copy per tab:
 *
 * - `tower-cards:changed` (counts + a revision, never text) → that tab is fetched again with
 *   `tower-cards:list` and the answer replaces the copy, unless a newer one already arrived
 *   (the host's revisions only increase while it runs).
 * - `startTowerCardsSync` also fetches the window's tabs once at start (a window opened after the cards).
 * - Reconnect (T0749's pattern, `remote:client-status-changed` from not connected to connected): one
 *   `tower-cards:list` of the window's tabs and the tabs it holds; the answer replaces everything for
 *   them (a restarted bat-server starts its revisions again and has no cards), `alive: false` drops a
 *   tab. A failed request (an older bat-server with no handler, disconnected again) keeps what the
 *   window has.
 * - `pty:exit` drops the tab's copy (the host dropped the cards too).
 *
 * Read / pin / clear go to the host (`window.electronAPI.towerCards`), whose `changed` brings the new
 * state back here — this store never changes a card on its own. Memory only, never saved; logs carry
 * ids and counts only.
 *
 * 🔴 Only a contract-2 Tower tab has cards (the host drops every other tab's messages); the UI still
 * gates the card area by the tab's contract (src/stores/tower-contract-store.ts).
 */
import { useSyncExternalStore } from 'react'
import type { TowerCardsApi, TowerCardsChangedEvent, TowerCardsEntry, TowerCardsListResult } from '../types/tower-cards'

type Listener = () => void

const entries = new Map<string, TowerCardsEntry>()
const listeners = new Set<Listener>()
let version = 0

function notify(): void {
  version++
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      /* a broken subscriber must not stop the others */
    }
  }
}

export function subscribeTowerCards(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Tab `terminalId`'s cards as this window has them, or null (none / unknown). */
export function getTowerCards(terminalId: string): TowerCardsEntry | null {
  return entries.get(terminalId) ?? null
}

/** The unread cards of tab `terminalId` (0 when none / unknown). */
export function towerCardsUnread(terminalId: string): number {
  return entries.get(terminalId)?.unread ?? 0
}

/** The tabs this window holds cards for. */
export function towerCardTerminalIds(): string[] {
  return [...entries.keys()]
}

/** React: re-renders when any tab's cards change; returns tab `terminalId`'s entry. */
export function useTowerCards(terminalId: string | null | undefined): TowerCardsEntry | null {
  useSyncExternalStore(subscribeTowerCards, () => version, () => version)
  return terminalId ? getTowerCards(terminalId) : null
}

function isEntry(value: unknown): value is TowerCardsEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Partial<TowerCardsEntry>
  return typeof e.terminalId === 'string' && e.terminalId.length > 0 && typeof e.revision === 'number' && Array.isArray(e.cards)
}

/**
 * Applies host answers. `force` (a reconnect): each answer replaces the copy whatever its revision.
 * Otherwise an answer older than the copy (a slower fetch) is skipped. An entry with no cards, or
 * `alive: false`, drops the copy. Returns how many tabs changed.
 */
export function applyTowerCardsEntries(list: readonly unknown[], opts: { force?: boolean } = {}): number {
  let changed = 0
  for (const raw of list) {
    if (!isEntry(raw)) continue
    const known = entries.get(raw.terminalId)
    if (!opts.force && known && raw.revision < known.revision) continue
    if (raw.alive === false || (raw.cards.length === 0 && (raw.stopsWithoutMessage ?? 0) === 0)) {
      if (entries.delete(raw.terminalId)) changed++
      continue
    }
    entries.set(raw.terminalId, {
      terminalId: raw.terminalId,
      alive: true,
      revision: raw.revision,
      cards: raw.cards.map(card => ({ ...card })),
      unread: typeof raw.unread === 'number' ? raw.unread : raw.cards.filter(card => !card.read).length,
      stopsWithoutMessage: typeof raw.stopsWithoutMessage === 'number' ? raw.stopsWithoutMessage : 0,
    })
    changed++
  }
  if (changed) notify()
  return changed
}

/** The tab is gone here (`pty:exit`, a closed tab): its copy goes. */
export function forgetTowerCards(terminalId: string): void {
  if (entries.delete(terminalId)) notify()
}

/** Tests. */
export function resetTowerCardsStore(): void {
  entries.clear()
  notify()
}

export interface TowerCardsSyncDeps {
  /** `window.electronAPI.towerCards`. */
  api: Pick<TowerCardsApi, 'list' | 'onChanged'>
  /** The window's tab ids (`workspaceStore` terminals). */
  terminalIds(): readonly string[]
  /** `window.electronAPI.pty.onExit`. */
  onPtyExit?(callback: (id: string) => void): () => void
  /** `window.electronAPI.remote.onClientStatusChanged` (local windows get no events). */
  onClientStatusChanged?(callback: (status: { connected: boolean; profileId?: string }) => void): () => void
  log?(message: string): void
}

export interface TowerCardsSync {
  /** Fetches `ids` (default: the window's tabs and the tabs held) and applies the answer. */
  refresh(ids?: readonly string[], opts?: { force?: boolean }): Promise<void>
  /** Feed `remote:client-status-changed` (done by `start` when `onClientStatusChanged` is given). */
  onStatus(status: { connected: boolean; profileId?: string }): Promise<void>
  /** Subscribes and fetches once; returns the unsubscribe. */
  start(): () => void
}

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160)
}

/**
 * The window's wiring (W6 calls `start()` once, e.g. from App). See the file header for the rules.
 */
export function createTowerCardsSync(deps: TowerCardsSyncDeps): TowerCardsSync {
  let lastConnected: boolean | null = null

  const fetchAndApply = async (ids: readonly string[], force: boolean, why: string): Promise<void> => {
    if (ids.length === 0) return
    let answer: TowerCardsListResult
    try {
      answer = await deps.api.list([...ids])
    } catch (error) {
      deps.log?.(`[tower-cards] ${why} ids=${ids.length} → not fetched (${describeError(error)})`)
      return
    }
    if (!answer || answer.ok !== true || !Array.isArray(answer.entries)) {
      deps.log?.(`[tower-cards] ${why} ids=${ids.length} → ${answer && answer.ok === false ? answer.code : 'no answer'}`)
      return
    }
    const changed = applyTowerCardsEntries(answer.entries, { force })
    if (force || changed) deps.log?.(`[tower-cards] ${why} ids=${ids.length} changed=${changed}`)
  }

  const allIds = (): string[] => [...new Set([...deps.terminalIds(), ...towerCardTerminalIds()])]

  const sync: TowerCardsSync = {
    refresh(ids, opts = {}) {
      return fetchAndApply(ids ? [...ids] : allIds(), opts.force === true, 'refresh')
    },
    async onStatus(status) {
      const was = lastConnected
      lastConnected = status.connected === true
      if (!lastConnected || was !== false) return
      await fetchAndApply(allIds(), true, `reconnect profile=${status.profileId ?? '-'}`)
    },
    start() {
      const unsubChanged = deps.api.onChanged((info: TowerCardsChangedEvent) => {
        if (!info || typeof info.terminalId !== 'string' || !info.terminalId) return
        const known = entries.get(info.terminalId)
        if (known && typeof info.revision === 'number' && info.revision <= known.revision) return
        void fetchAndApply([info.terminalId], false, 'changed')
      })
      const unsubExit = deps.onPtyExit?.((id) => forgetTowerCards(id))
      const unsubStatus = deps.onClientStatusChanged?.((status) => { void sync.onStatus(status) })
      void fetchAndApply(allIds(), false, 'start')
      return () => {
        unsubChanged()
        unsubExit?.()
        unsubStatus?.()
      }
    },
  }
  return sync
}
