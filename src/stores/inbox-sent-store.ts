/**
 * T0942 (D412): the「已送出」records of the「待辦」(Inbox) tab's answers.
 *
 * An answer that went out (`sent`, or `held` in the Tower tab's「📨 待送」) is recorded here per
 * workspace folder (the `_tower-state.md` the items come from) and item id (`U-n` / `A-n`; a batch line
 * also under `batchSentKey(kind)`), with the line, the time and — for a ⏸ row — the selection it was
 * sent with. The rows show「✓ 已送出：<line>（HH:MM）」from it and start from that selection, so the
 * mark and the choice survive a tab switch / remount. Only a reminder: nothing is blocked.
 *
 * A record is forgotten when its items leave the lists (`pruneInboxSent`, called by `setInboxFiles`
 * when the lists were read): the Tower handled it.
 *
 * 🔴 In memory only: never saved, never written to any CT file, never logged (the line is the user's
 * answer). Failed sends (`failed` / `no-target` / `draft` / `not-mounted`) are never recorded.
 */
import { useSyncExternalStore } from 'react'

/** What a ⏸ row showed when it was sent (restored when the row mounts again). */
export interface InboxAwaitingSelection {
  /** The picked option code (single choice); null = none. */
  choice: string | null
  /** The checked option codes (multiple choice); null = not a multiple-choice item. */
  checks: readonly string[] | null
  /**「其他（自由回答）」picked. */
  other: boolean
  otherText: string
  /** The plain answer box (`options: []` / invalid options). */
  free: string
}

export interface InboxSentRecord {
  /** The line that went out (`U-3：A`, `A-2：完成`, `U-1、U-3：放棄 …`). */
  text: string
  /** When it went out (ms, this renderer's clock). */
  at: number
  status: 'sent' | 'held'
  /** The item ids the line answers (one, or a batch's ids); the record lives while any is listed. */
  ids: readonly string[]
  selection?: InboxAwaitingSelection
  /**
   * T0966: a `held` line's queue item — the Tower tab it waits in and its `holdId` — so the mark can show
   * why it still waits (the tab's notify-hold reason). Absent: a panel Tower, `sent`, or an older host.
   */
  hold?: { terminalId: string; holdId: string }
}

export type InboxSentMap = ReadonlyMap<string, InboxSentRecord>

/** The key a list's batch toolbar record is kept under (never a `U-n` / `A-n`). */
export function batchSentKey(kind: 'awaiting' | 'action'): string {
  return `__batch__:${kind}`
}

const EMPTY: InboxSentMap = new Map()
const scopes = new Map<string, InboxSentMap>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Records one answer that went out (replaces the key's previous record). */
export function recordInboxSent(scope: string, key: string, record: InboxSentRecord): void {
  const next = new Map(scopes.get(scope) ?? EMPTY)
  next.set(key, record)
  scopes.set(scope, next)
  notify()
}

export function getInboxSentMap(scope: string | null | undefined): InboxSentMap {
  return scopes.get(scope ?? '') ?? EMPTY
}

/** The records of one workspace folder (a new map object whenever one changes). */
export function useInboxSentMap(scope: string | null | undefined): InboxSentMap {
  return useSyncExternalStore(subscribe, () => getInboxSentMap(scope), () => EMPTY)
}

/** Forgets the records none of whose items is still open (`openIds` = the ids the lists have now). */
export function pruneInboxSent(scope: string, openIds: ReadonlySet<string>): void {
  const current = scopes.get(scope)
  if (!current) return
  const next = new Map([...current].filter(([, record]) => record.ids.some(id => openIds.has(id))))
  if (next.size === current.size) return
  if (next.size === 0) scopes.delete(scope)
  else scopes.set(scope, next)
  notify()
}

/** Tests only (also called by `resetInboxStore`). */
export function resetInboxSentStore(): void {
  if (scopes.size === 0) return
  scopes.clear()
  notify()
}
